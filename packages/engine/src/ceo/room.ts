// Game 12 room state machine (pure; the API loads/saves it in a Firestore transaction).
import { GameError, type LmsBinding, type LmsResult } from '../room.js';
import { randomToken, seededRng, shuffle, type Rng } from '../rng.js';
import { gradeOf } from '../scoring.js';
import { MAX_SEATS } from '../types.js';
import { ceoBotDecision, validateCeo } from './bots.js';
import { agentScore, ceoRanking, ceoScorecard, crisisPoints, initCeo, simulateQuarter, type CeoState, type QuarterInput } from './sim.js';
import { CEO_ARCHETYPES, CRISES, ROUNDS, type CeoArchetype, type CeoDecision, type CeoMe, type CeoReport, type CeoRoomDoc, type CeoSettings, type CrisisId } from './types.js';

export interface CeoPrivate {
  hostToken: string;
  tokens: Record<string, string>;
  lti?: Record<string, LmsBinding>;
  state: CeoState | null;
  archetypes: Record<string, CeoArchetype>;
  decisions: Record<string, CeoDecision>;
  lastDecisions: Record<string, CeoDecision>;
  reports: Record<string, CeoReport[]>;
}

const E = (en: string, vi: string) => ({ en, vi });
export const DEFAULT_CEO_SETTINGS: CeoSettings = { decideSec: 360, resultsSec: 0, botLevel: 'medium', fillBots: true };

export function normalizeCeoSettings(s: Partial<CeoSettings> | undefined): CeoSettings {
  const int = (v: unknown, lo: number, hi: number, d: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    decideSec: s?.decideSec === 0 ? 0 : int(s?.decideSec, 60, 900, DEFAULT_CEO_SETTINGS.decideSec),
    resultsSec: int(s?.resultsSec ?? 0, 0, 300, 0),
    botLevel: s?.botLevel && ['easy', 'medium', 'hard'].includes(s.botLevel) ? s.botLevel : 'medium',
    fillBots: s?.fillBots ?? true,
  };
}

const BOT_NAMES = ['GlowLab', 'SkinNest', 'PureVie', 'LumiCare', 'DewDrop', 'Velvet&Co'];

export function createCeoRoom(input: { code: string; title?: string; hostPlays: boolean; hostName?: string; settings?: Partial<CeoSettings>; hostLms?: LmsBinding }, now: number, rng: Rng) {
  const room: CeoRoomDoc = {
    code: input.code,
    game: 'ceo-sim',
    title: (input.title ?? '').trim().slice(0, 40) || `Room ${input.code}`,
    status: 'lobby',
    createdAt: now,
    hostPlays: input.hostPlays,
    hostPlayerId: null,
    settings: normalizeCeoSettings(input.settings),
    players: {},
    order: [],
    round: 0,
    rounds: ROUNDS,
    openedAt: null,
    deadline: null,
    submitted: {},
    standings: {},
    crises: {},
    history: [],
    news: [],
    revealedAt: null,
    startedAt: null,
    finishedAt: null,
    version: 1,
  };
  const priv: CeoPrivate = { hostToken: randomToken(rng), tokens: {}, state: null, archetypes: {}, decisions: {}, lastDecisions: {}, reports: {} };
  let player: { playerId: string; playerToken: string } | null = null;
  if (input.hostPlays) {
    player = joinCeo(room, priv, input.hostName ?? '', now, rng, input.hostLms);
    room.hostPlayerId = player.playerId;
  }
  return { room, priv, hostToken: priv.hostToken, player };
}

function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) throw new GameError('bad_name', E('Please enter your name.', 'Vui lòng nhập tên.'));
  return name;
}

export function joinCeo(room: CeoRoomDoc, priv: CeoPrivate, rawName: string, now: number, rng: Rng, lms?: LmsBinding) {
  if (lms) {
    const seat = Object.entries(priv.lti ?? {}).find(([, b]) => b.hubUserId === lms.hubUserId)?.[0];
    if (seat && room.players[seat] && priv.tokens[seat]) return { playerId: seat, playerToken: priv.tokens[seat]! };
  }
  if (room.status !== 'lobby') throw new GameError('started', E('The game has started; no more seats.', 'Trận đã bắt đầu, không vào thêm được.'), 409);
  if (room.order.length >= MAX_SEATS) throw new GameError('full', E('The room already has 6 companies.', 'Phòng đã đủ 6 công ty.'), 409);
  let name = cleanName(rawName);
  const taken = new Set(Object.values(room.players).map((p) => p.name.toLowerCase()));
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${cleanName(rawName).slice(0, 20)} (${i})`;
  const playerId = `p${room.order.length + 1}_${randomToken(rng, 6)}`;
  room.players[playerId] = { id: playerId, name, bot: false, joinedAt: now, ...(lms?.gradeTarget ? { lms: true } : {}) };
  if (lms) priv.lti = { ...(priv.lti ?? {}), [playerId]: lms };
  room.order.push(playerId);
  const playerToken = randomToken(rng);
  priv.tokens[playerId] = playerToken;
  room.version++;
  return { playerId, playerToken };
}

export function removeCeoPlayer(room: CeoRoomDoc, priv: CeoPrivate, playerId: string) {
  if (room.status !== 'lobby') throw new GameError('started', E('Players can only be removed before the start.', 'Chỉ xóa được người chơi khi chưa bắt đầu.'), 409);
  if (!room.players[playerId]) throw new GameError('no_player', E('No such player.', 'Không có người chơi này.'), 404);
  if (playerId === room.hostPlayerId) throw new GameError('host', E('The host cannot be removed.', 'Không thể xóa chủ phòng.'), 409);
  delete room.players[playerId];
  delete priv.tokens[playerId];
  if (priv.lti) delete priv.lti[playerId];
  room.order = room.order.filter((id) => id !== playerId);
  room.version++;
}

const humansOf = (room: CeoRoomDoc) => room.order.filter((id) => !room.players[id]?.bot);

export function startCeo(room: CeoRoomDoc, priv: CeoPrivate, now: number, rng: Rng) {
  if (room.status !== 'lobby') throw new GameError('started', E('The game has already started.', 'Trận đã bắt đầu.'), 409);
  if (humansOf(room).length === 0) throw new GameError('empty', E('The room has no players yet.', 'Phòng chưa có người chơi.'), 409);
  if (room.settings.fillBots) {
    const kinds = shuffle(rng, CEO_ARCHETYPES);
    let i = 0;
    while (room.order.length < MAX_SEATS) {
      const id = `b${i + 1}`;
      const archetype = kinds[i % kinds.length]!;
      room.players[id] = { id, name: `${BOT_NAMES[i % BOT_NAMES.length]} (AI)`, bot: true, level: room.settings.botLevel, archetype, joinedAt: now };
      priv.archetypes[id] = archetype;
      room.order.push(id);
      i++;
    }
  }
  priv.state = initCeo(room.order);
  // Crisis cards are dealt now (one each, all different) but only revealed in round 6.
  const cards = shuffle(seededRng(`${room.code}:${now}:crisis`), CRISES);
  room.order.forEach((id, k) => (priv.state!.players[id]!.crisis = cards[k % cards.length] as CrisisId));
  room.startedAt = now;
  for (const id of room.order) priv.reports[id] = [];
  openRound(room, priv, 1, now);
}

function openRound(room: CeoRoomDoc, priv: CeoPrivate, round: number, now: number) {
  room.status = 'decide';
  room.round = round;
  room.openedAt = now;
  room.deadline = room.settings.decideSec > 0 ? now + room.settings.decideSec * 1000 : null;
  room.submitted = {};
  room.revealedAt = null;
  priv.decisions = {};
  if (round === ROUNDS) for (const id of room.order) room.crises[id] = priv.state!.players[id]!.crisis!;
  room.version++;
}

export function submitCeo(room: CeoRoomDoc, priv: CeoPrivate, playerId: string, round: number, raw: CeoDecision, now: number): boolean {
  if (room.status !== 'decide') throw new GameError('not_open', E('This quarter is closed.', 'Quý này đã đóng.'), 409);
  if (round !== room.round) throw new GameError('stale', E('The game has moved to another quarter.', 'Đã sang quý khác.'), 409);
  const p = room.players[playerId];
  if (!p || p.bot) throw new GameError('no_player', E('No such player.', 'Không có người chơi này.'), 404);
  if (room.deadline !== null && now > room.deadline + 2000) throw new GameError('late', E('Time is up.', 'Hết giờ.'), 409);
  priv.decisions[playerId] = validateCeo(raw, room.round, priv.state!.players[playerId]!.crisis);
  room.submitted[playerId] = true;
  room.version++;
  if (humansOf(room).every((id) => priv.decisions[id])) {
    closeRound(room, priv, now);
    return true;
  }
  return false;
}

function defaultDecision(priv: CeoPrivate, id: string, round: number): CeoDecision {
  const last = priv.lastDecisions[id];
  const base: CeoDecision = last
    ? { ...last, mix: { ...last.mix }, stock: last.stock }
    : { price: 'mid', skus: 'medium', segment: 'office', service: 'fast', ads: 150, creators: 80, crm: 50, mix: { web: 30, shopee: 50, tiktok: 20 }, stock: 4000 };
  delete base.ai;
  delete base.crisis;
  delete base.predict;
  base.agent = [];
  if (round === 4) base.ai = 'E';
  if (round === ROUNDS) {
    const card = priv.state!.players[id]!.crisis!;
    base.crisis = ['cpc', 'pricecut', 'ban'].includes(card) ? (card === 'cpc' ? 'keep' : card === 'pricecut' ? 'ignore' : 'wait') : card === 'viral' ? 'all' : card === 'chatbot' ? 'deny' : card === 'agent' ? 'cancel' : card === 'supplier' ? 'absorb' : 'quiet';
  }
  return base;
}

export function closeRound(room: CeoRoomDoc, priv: CeoPrivate, now: number) {
  if (room.status !== 'decide' || !priv.state) throw new GameError('not_open', E('This quarter is closed.', 'Quý này đã đóng.'), 409);
  const r = room.round;
  const rng = seededRng(`${room.code}:${room.startedAt}:ceo:${r}`);
  const inputs: Record<string, QuarterInput> = {};
  for (const id of room.order) {
    const p = room.players[id]!;
    if (p.bot) inputs[id] = { decision: ceoBotDecision(priv.archetypes[id] ?? 'balanced', p.level ?? 'medium', priv.state.players[id]!, r, rng), defaulted: false };
    else if (priv.decisions[id]) inputs[id] = { decision: priv.decisions[id]!, defaulted: false };
    else inputs[id] = { decision: defaultDecision(priv, id, r), defaulted: true };
  }
  const out = simulateQuarter(priv.state, room.order, inputs, r, rng);
  const revenue: Record<string, number> = {};
  const profit: Record<string, number> = {};
  for (const id of room.order) {
    priv.reports[id] = [...(priv.reports[id] ?? []), out.reports[id]!];
    priv.lastDecisions[id] = inputs[id]!.decision;
    revenue[id] = out.reports[id]!.kpis.revenue;
    profit[id] = out.reports[id]!.kpis.profit;
  }
  room.history = [...room.history, { round: r, revenue, profit }];
  room.news = out.news;
  refreshStandings(room, priv, inputs);
  room.revealedAt = now;
  room.deadline = null;
  room.status = r >= ROUNDS ? 'finished' : 'results';
  if (room.status === 'finished') room.finishedAt = now;
  room.version++;
}

function refreshStandings(room: CeoRoomDoc, priv: CeoPrivate, inputs?: Record<string, QuarterInput>) {
  const state = priv.state!;
  const rows = ceoRanking(state, room.order);
  for (const id of room.order) {
    const p = state.players[id]!;
    room.standings[id] = {
      profitCum: p.profitCum,
      cash: p.cash,
      rating: p.rating,
      pdr: p.last?.pdr ?? 0,
      agentReady: Math.round(agentScore(p.agent) * 10) / 10,
      crisisPts: room.status === 'finished' || room.round >= ROUNDS ? crisisPoints(p) : 0,
      dashboard: rows[id]!.dashboard,
      rank: rows[id]!.rank,
      ...(inputs?.[id]?.defaulted ? { defaulted: true } : {}),
      ...(p.everNegative ? { bankrupt: true } : {}),
    };
  }
}

export interface CeoAdvanceOptions {
  isHost: boolean;
  expectStatus?: CeoRoomDoc['status'];
  expectRound?: number;
}

export function advanceCeo(room: CeoRoomDoc, priv: CeoPrivate, now: number, opts: CeoAdvanceOptions): boolean {
  if (opts.expectStatus && opts.expectStatus !== room.status) return false;
  if (opts.expectRound !== undefined && opts.expectRound !== room.round) return false;
  if (room.status === 'decide') {
    const due = room.deadline !== null && now >= room.deadline;
    if (due || humansOf(room).every((id) => priv.decisions[id]) || (opts.isHost && opts.expectStatus === 'decide')) {
      closeRound(room, priv, now);
      return true;
    }
    return false;
  }
  if (room.status === 'results' && room.revealedAt !== null) {
    const auto = room.settings.resultsSec > 0 && now >= room.revealedAt + room.settings.resultsSec * 1000;
    if (opts.isHost || auto) {
      openRound(room, priv, room.round + 1, now);
      return true;
    }
  }
  return false;
}

export function extendCeo(room: CeoRoomDoc, seconds = 60) {
  if (room.status !== 'decide' || room.deadline === null) throw new GameError('not_open', E('No timer to extend.', 'Không có đồng hồ để gia hạn.'), 409);
  room.deadline += seconds * 1000;
  room.version++;
}

/** Host "End": quarters not yet played are played with each company's last choices. */
export function finishCeo(room: CeoRoomDoc, priv: CeoPrivate, now: number) {
  if (room.status === 'finished') return;
  if (room.status === 'lobby') throw new GameError('not_started', E('The game has not started.', 'Trận chưa bắt đầu.'), 409);
  for (let guard = 0; guard < ROUNDS * 3 && (room.status as string) !== 'finished'; guard++) {
    if (room.status === 'decide') closeRound(room, priv, now);
    else if (room.status === 'results') openRound(room, priv, room.round + 1, now);
  }
}

export function ceoMe(room: CeoRoomDoc, priv: CeoPrivate, playerId: string): CeoMe {
  const p = priv.state?.players[playerId];
  const sc = p ? ceoScorecard(p) : { profit: 0, cash: 0, pdr: 0, crisis: 0, total: 0 };
  const st = room.standings[playerId];
  const done = room.status === 'finished';
  return {
    playerId,
    reports: priv.reports[playerId] ?? [],
    pending: room.status === 'decide' ? (priv.decisions[playerId] ?? null) : null,
    scorecard: sc,
    grade: done && st ? gradeOf(sc.total, st.rank, room.order.length) : null,
    stock: Math.round(p?.stock ?? 0),
    cash: p?.cash ?? 0,
    aiChoice: p?.ai ?? null,
    agentOwned: p?.agent ?? [],
    crisis: room.round >= ROUNDS || done ? (p?.crisis ?? null) : null,
    ...(done && p ? { crisisResult: { quality: p.crisisQuality, predictions: p.predictionsRight } } : {}),
  };
}

export function ceoLmsResults(room: CeoRoomDoc, priv: CeoPrivate): LmsResult[] {
  if (room.status !== 'finished' || !priv.lti || !priv.state) return [];
  const out: LmsResult[] = [];
  for (const [playerId, binding] of Object.entries(priv.lti)) {
    if (!binding.gradeTarget || !room.players[playerId]) continue;
    const me = ceoMe(room, priv, playerId);
    const st = room.standings[playerId];
    if (me.grade === null || !st) continue;
    out.push({
      playerId,
      binding: { ...binding, gradeTarget: binding.gradeTarget },
      score: me.grade,
      comment: `CEO Simulator · room ${room.code} · rank ${st.rank}/${room.order.length} · dashboard ${st.dashboard} · profit ${st.profitCum}m · scorecard ${me.scorecard.total}/100`,
      attemptId: `${room.code}:${playerId}`,
      occurredAt: new Date(room.finishedAt ?? Date.now()).toISOString(),
    });
  }
  return out;
}


