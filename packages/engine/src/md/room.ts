// Game 4 room state machine (pure; the API loads/saves it in a Firestore transaction).
import { GameError, type LmsBinding, type LmsResult } from '../room.js';
import { randomToken, seededRng, shuffle, type Rng } from '../rng.js';
import { gradeOf } from '../scoring.js';
import { MAX_SEATS, type T } from '../types.js';
import { interviewDelaySec, mdBotPlay } from './bots.js';
import { decisionFor, drawCases, type MdCaseFull } from './cases.js';
import { scoreCase } from './score.js';
import {
  CASES_PER_GAME,
  DECISIONS,
  INTERVIEW_SLOTS,
  MD_ARCHETYPES,
  SOURCE_INFO,
  SOURCES,
  START_CREDITS,
  type MdArchetype,
  type MdCaseScore,
  type MdMe,
  type MdRoomDoc,
  type MdSettings,
  type MdSubmission,
  type SourceId,
} from './types.js';

export interface MdPrivate {
  hostToken: string;
  tokens: Record<string, string>;
  lti?: Record<string, LmsBinding>;
  archetypes: Record<string, MdArchetype>;
  cases: MdCaseFull[];
  credits: Record<string, number>;
  bought: Record<string, SourceId[]>;
  subs: Record<string, MdSubmission>;
  scores: Record<string, MdCaseScore[]>;
}

const E = (en: string, vi: string): T => ({ en, vi });
export const DEFAULT_MD_SETTINGS: MdSettings = { caseSec: 420, resultsSec: 0, botLevel: 'medium', fillBots: true };

export function normalizeMdSettings(s: Partial<MdSettings> | undefined): MdSettings {
  const int = (v: unknown, lo: number, hi: number, d: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    caseSec: s?.caseSec === 0 ? 0 : int(s?.caseSec, 60, 1200, DEFAULT_MD_SETTINGS.caseSec),
    resultsSec: int(s?.resultsSec ?? 0, 0, 300, 0),
    botLevel: s?.botLevel && ['easy', 'medium', 'hard'].includes(s.botLevel) ? s.botLevel : 'medium',
    fillBots: s?.fillBots ?? true,
  };
}

const BOT_NAMES = ['Sherlock', 'Poirot', 'Marple', 'Conan', 'Columbo', 'Holmes'];

export function createMdRoom(input: { code: string; title?: string; hostPlays: boolean; hostName?: string; settings?: Partial<MdSettings>; hostLms?: LmsBinding }, now: number, rng: Rng) {
  const room: MdRoomDoc = {
    code: input.code,
    game: 'market-detective',
    title: (input.title ?? '').trim().slice(0, 40) || `Room ${input.code}`,
    status: 'lobby',
    createdAt: now,
    hostPlays: input.hostPlays,
    hostPlayerId: null,
    settings: normalizeMdSettings(input.settings),
    players: {},
    order: [],
    round: 0,
    rounds: CASES_PER_GAME,
    openedAt: null,
    deadline: null,
    submitted: {},
    case: null,
    interviews: [],
    bought: {},
    reveal: null,
    standings: {},
    revealedAt: null,
    startedAt: null,
    finishedAt: null,
    version: 1,
  };
  const priv: MdPrivate = { hostToken: randomToken(rng), tokens: {}, archetypes: {}, cases: [], credits: {}, bought: {}, subs: {}, scores: {} };
  let player: { playerId: string; playerToken: string } | null = null;
  if (input.hostPlays) {
    player = joinMd(room, priv, input.hostName ?? '', now, rng, input.hostLms);
    room.hostPlayerId = player.playerId;
  }
  return { room, priv, hostToken: priv.hostToken, player };
}

function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) throw new GameError('bad_name', E('Please enter your name.', 'Vui lòng nhập tên.'));
  return name;
}

export function joinMd(room: MdRoomDoc, priv: MdPrivate, rawName: string, now: number, rng: Rng, lms?: LmsBinding) {
  if (lms) {
    const seat = Object.entries(priv.lti ?? {}).find(([, b]) => b.hubUserId === lms.hubUserId)?.[0];
    if (seat && room.players[seat] && priv.tokens[seat]) return { playerId: seat, playerToken: priv.tokens[seat]! };
  }
  if (room.status !== 'lobby') throw new GameError('started', E('The game has started; no more seats.', 'Trận đã bắt đầu, không vào thêm được.'), 409);
  if (room.order.length >= MAX_SEATS) throw new GameError('full', E('The room already has 6 detectives.', 'Phòng đã đủ 6 thám tử.'), 409);
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

export function removeMdPlayer(room: MdRoomDoc, priv: MdPrivate, playerId: string) {
  if (room.status !== 'lobby') throw new GameError('started', E('Players can only be removed before the start.', 'Chỉ xóa được người chơi khi chưa bắt đầu.'), 409);
  if (!room.players[playerId]) throw new GameError('no_player', E('No such player.', 'Không có người chơi này.'), 404);
  if (playerId === room.hostPlayerId) throw new GameError('host', E('The host cannot be removed.', 'Không thể xóa chủ phòng.'), 409);
  delete room.players[playerId];
  delete priv.tokens[playerId];
  if (priv.lti) delete priv.lti[playerId];
  room.order = room.order.filter((id) => id !== playerId);
  room.version++;
}

const humansOf = (room: MdRoomDoc) => room.order.filter((id) => !room.players[id]?.bot);

export function startMd(room: MdRoomDoc, priv: MdPrivate, now: number, rng: Rng, onlyCases?: string[]) {
  if (room.status !== 'lobby') throw new GameError('started', E('The game has already started.', 'Trận đã bắt đầu.'), 409);
  if (humansOf(room).length === 0) throw new GameError('empty', E('The room has no players yet.', 'Phòng chưa có người chơi.'), 409);
  if (room.settings.fillBots) {
    // Always include one careful analyst; the other seats cycle through the styles.
    const kinds = ['careful' as MdArchetype, ...shuffle(rng, MD_ARCHETYPES.filter((a) => a !== 'careful')), 'careful' as MdArchetype];
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
  priv.cases = drawCases(seededRng(`${room.code}:${now}:cases`), CASES_PER_GAME, onlyCases);
  room.rounds = priv.cases.length;
  room.startedAt = now;
  for (const id of room.order) priv.scores[id] = [];
  openCase(room, priv, 1, now);
}

function openCase(room: MdRoomDoc, priv: MdPrivate, round: number, now: number) {
  room.status = 'decide';
  room.round = round;
  room.openedAt = now;
  room.deadline = room.settings.caseSec > 0 ? now + room.settings.caseSec * 1000 : null;
  room.submitted = {};
  room.case = priv.cases[round - 1]!.pub;
  room.interviews = [];
  room.bought = {};
  room.reveal = null;
  room.revealedAt = null;
  priv.credits = Object.fromEntries(room.order.map((id) => [id, START_CREDITS]));
  priv.bought = Object.fromEntries(room.order.map((id) => [id, [] as SourceId[]]));
  priv.subs = {};
  room.version++;
}

/** Interview slots are scarce: AI analysts book theirs some seconds after the case opens. */
function bookBotInterviews(room: MdRoomDoc, priv: MdPrivate, now: number) {
  if (room.status !== 'decide' || room.openedAt === null) return;
  const due = room.order
    .filter((id) => room.players[id]?.bot && !room.interviews.includes(id))
    .map((id) => ({ id, at: interviewDelaySec(priv.archetypes[id] ?? 'trends', room.players[id]!.level ?? 'medium') }))
    .filter((b): b is { id: string; at: number } => b.at !== null && now >= room.openedAt! + b.at * 1000)
    .sort((a, b) => a.at - b.at);
  for (const b of due) {
    if (room.interviews.length >= INTERVIEW_SLOTS) break;
    room.interviews.push(b.id);
    room.version++;
  }
}

function checkPlayer(room: MdRoomDoc, playerId: string, round: number, now: number) {
  if (room.status !== 'decide') throw new GameError('not_open', E('This case is closed.', 'Vụ này đã đóng.'), 409);
  if (round !== room.round) throw new GameError('stale', E('The game has moved to another case.', 'Đã sang vụ khác.'), 409);
  const p = room.players[playerId];
  if (!p || p.bot) throw new GameError('no_player', E('No such player.', 'Không có người chơi này.'), 404);
  if (room.deadline !== null && now > room.deadline + 2000) throw new GameError('late', E('Time is up.', 'Hết giờ.'), 409);
}

export function buyMd(room: MdRoomDoc, priv: MdPrivate, playerId: string, round: number, source: SourceId, now: number) {
  checkPlayer(room, playerId, round, now);
  if (!SOURCES.includes(source)) throw new GameError('bad_source', E('Unknown data source.', 'Nguồn dữ liệu không hợp lệ.'));
  const mine = priv.bought[playerId] ?? [];
  if (mine.includes(source)) return;
  const cost = SOURCE_INFO[source].cost;
  if ((priv.credits[playerId] ?? 0) < cost) throw new GameError('no_credits', E('Not enough research credits.', 'Không đủ điểm nghiên cứu.'), 409);
  bookBotInterviews(room, priv, now);
  if (source === 'interview') {
    if (room.interviews.length >= INTERVIEW_SLOTS) throw new GameError('no_slot', E('Both interview slots in this room are taken.', 'Cả 2 suất phỏng vấn của phòng đã có người lấy.'), 409);
    room.interviews.push(playerId);
  }
  priv.credits[playerId] = (priv.credits[playerId] ?? 0) - cost;
  priv.bought[playerId] = [...mine, source];
  room.bought[playerId] = priv.bought[playerId]!.length;
  room.version++;
}

export function validateMd(raw: MdSubmission, claims: number): MdSubmission {
  const estimate = Math.round(Number(raw?.estimate) * 10) / 10;
  if (!(estimate > 0) || estimate > 10000) throw new GameError('bad_estimate', E('Enter your market-size estimate.', 'Hãy nhập ước tính quy mô thị trường.'));
  if (!DECISIONS.includes(raw?.decision)) throw new GameError('bad_decision', E('Choose Launch, Pilot or Do not launch.', 'Hãy chọn Tung, Thử nhỏ hoặc Không tung.'));
  const flags = [...new Set((raw?.flags ?? []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < claims).sort();
  return { estimate, decision: raw.decision, flags };
}

export function submitMd(room: MdRoomDoc, priv: MdPrivate, playerId: string, round: number, raw: MdSubmission, now: number): boolean {
  checkPlayer(room, playerId, round, now);
  const c = priv.cases[room.round - 1]!;
  const sub = validateMd(raw, c.aiClaims.length);
  if (!(priv.bought[playerId] ?? []).includes('ai')) sub.flags = [];
  priv.subs[playerId] = sub;
  room.submitted[playerId] = true;
  bookBotInterviews(room, priv, now);
  room.version++;
  if (humansOf(room).every((id) => priv.subs[id])) {
    closeCase(room, priv, now);
    return true;
  }
  return false;
}

export function closeCase(room: MdRoomDoc, priv: MdPrivate, now: number) {
  if (room.status !== 'decide') throw new GameError('not_open', E('This case is closed.', 'Vụ này đã đóng.'), 409);
  bookBotInterviews(room, priv, now);
  const r = room.round;
  const c = priv.cases[r - 1]!;
  const rng = seededRng(`${room.code}:${room.startedAt}:md:${r}`);
  const scores: Record<string, MdCaseScore> = {};
  for (const id of room.order) {
    const p = room.players[id]!;
    if (p.bot) {
      const play = mdBotPlay(priv.archetypes[id] ?? 'trends', p.level ?? 'medium', c, room.interviews.includes(id), rng);
      priv.bought[id] = play.bought;
      priv.credits[id] = play.credits;
      priv.subs[id] = play.sub;
      room.bought[id] = play.bought.length;
    }
    scores[id] = scoreCase(c, priv.subs[id] ?? null, priv.bought[id] ?? [], priv.credits[id] ?? START_CREDITS);
    priv.scores[id] = [...(priv.scores[id] ?? []), scores[id]!];
  }
  const sourceRatios: Partial<Record<SourceId, number>> = {};
  for (const s of SOURCES) {
    const v = c.findings[s].implied;
    if (v !== undefined) sourceRatios[s] = Math.round((v / c.truth) * 100) / 100;
  }
  room.reveal = {
    caseId: c.pub.id,
    truth: c.truth,
    decision: decisionFor(c.truth, c.pub),
    sourceRatios,
    sourceNotes: c.sourceNotes,
    aiClaims: c.aiClaims,
    aiErrors: c.aiErrors,
    scores,
  };
  refreshStandings(room, priv, scores);
  room.revealedAt = now;
  room.deadline = null;
  room.status = r >= room.rounds ? 'finished' : 'results';
  if (room.status === 'finished') room.finishedAt = now;
  room.version++;
}

function refreshStandings(room: MdRoomDoc, priv: MdPrivate, last: Record<string, MdCaseScore>) {
  const totals = room.order.map((id) => ({ id, total: (priv.scores[id] ?? []).reduce((s, x) => s + x.total, 0), joinedAt: room.players[id]!.joinedAt }));
  totals.sort((a, b) => b.total - a.total || a.joinedAt - b.joinedAt);
  totals.forEach((row, k) => {
    const rank = k > 0 && row.total === totals[k - 1]!.total ? room.standings[totals[k - 1]!.id]!.rank : k + 1;
    room.standings[row.id] = { total: row.total, last: last[row.id]?.total ?? 0, rank, ...(last[row.id]?.estimate === null && !room.players[row.id]!.bot ? { defaulted: true } : {}) };
  });
}

export interface MdAdvanceOptions {
  isHost: boolean;
  expectStatus?: MdRoomDoc['status'];
  expectRound?: number;
}

export function advanceMd(room: MdRoomDoc, priv: MdPrivate, now: number, opts: MdAdvanceOptions): boolean {
  if (opts.expectStatus && opts.expectStatus !== room.status) return false;
  if (opts.expectRound !== undefined && opts.expectRound !== room.round) return false;
  if (room.status === 'decide') {
    const due = room.deadline !== null && now >= room.deadline;
    if (due || humansOf(room).every((id) => priv.subs[id]) || (opts.isHost && opts.expectStatus === 'decide')) {
      closeCase(room, priv, now);
      return true;
    }
    const before = room.interviews.length;
    bookBotInterviews(room, priv, now);
    return room.interviews.length !== before;
  }
  if (room.status === 'results' && room.revealedAt !== null) {
    const auto = room.settings.resultsSec > 0 && now >= room.revealedAt + room.settings.resultsSec * 1000;
    if (opts.isHost || auto) {
      openCase(room, priv, room.round + 1, now);
      return true;
    }
  }
  return false;
}

export function extendMd(room: MdRoomDoc, seconds = 60) {
  if (room.status !== 'decide' || room.deadline === null) throw new GameError('not_open', E('No timer to extend.', 'Không có đồng hồ để gia hạn.'), 409);
  room.deadline += seconds * 1000;
  room.version++;
}

/** Host "End": open cases are closed with whatever has been submitted. */
export function finishMd(room: MdRoomDoc, priv: MdPrivate, now: number) {
  if (room.status === 'finished') return;
  if (room.status === 'lobby') throw new GameError('not_started', E('The game has not started.', 'Trận chưa bắt đầu.'), 409);
  for (let guard = 0; guard < CASES_PER_GAME * 3 && (room.status as string) !== 'finished'; guard++) {
    if (room.status === 'decide') closeCase(room, priv, now);
    else if (room.status === 'results') openCase(room, priv, room.round + 1, now);
  }
}

/** Score out of 100: the average case total. */
export function mdScorecard(scores: MdCaseScore[], rounds: number): number {
  if (!rounds) return 0;
  return Math.round((scores.reduce((s, x) => s + x.total, 0) / rounds) * 10) / 10;
}

function badgesOf(scores: MdCaseScore[], priv: MdPrivate): T[] {
  const out: T[] = [];
  if (scores.some((s) => s.accuracy === 50)) out.push(E('🎯 Sharp estimate (within 10%)', '🎯 Ước tính chuẩn (sai dưới 10%)'));
  const allCaught = scores.some((s, i) => {
    const c = priv.cases[i];
    return c && s.sources.includes('ai') && s.flagPts === c.aiErrors.length * 5 && c.aiErrors.length > 0;
  });
  if (allCaught) out.push(E('🕵️ AI fact-checker (caught every AI error in a case)', '🕵️ Kiểm chứng AI (bắt hết lỗi AI trong một vụ)'));
  if (scores.length > 0 && scores.every((s) => s.decisionPts === 25)) out.push(E('🧭 Every decision right', '🧭 Quyết định đúng cả 3 vụ'));
  if (scores.some((s) => s.sources.includes('interview'))) out.push(E('🎤 Got a customer interview', '🎤 Giành được suất phỏng vấn'));
  if (scores.some((s) => s.creditPts >= 9 && s.accuracy >= 40)) out.push(E('💰 Lean researcher', '💰 Nghiên cứu tiết kiệm'));
  return out;
}

export function mdMe(room: MdRoomDoc, priv: MdPrivate, playerId: string): MdMe {
  const scores = priv.scores[playerId] ?? [];
  const c = room.status === 'decide' ? priv.cases[room.round - 1] : undefined;
  const mine = room.status === 'decide' ? (priv.bought[playerId] ?? []) : [];
  const st = room.standings[playerId];
  const done = room.status === 'finished';
  return {
    playerId,
    credits: room.status === 'decide' ? (priv.credits[playerId] ?? START_CREDITS) : START_CREDITS,
    findings: c ? mine.map((s) => c.findings[s]) : [],
    aiClaims: c && mine.includes('ai') ? c.aiClaims : [],
    pending: room.status === 'decide' ? (priv.subs[playerId] ?? null) : null,
    scores,
    grade: done && st ? gradeOf(mdScorecard(scores, room.rounds), st.rank, room.order.length) : null,
    badges: done ? badgesOf(scores, priv) : [],
  };
}

export function mdLmsResults(room: MdRoomDoc, priv: MdPrivate): LmsResult[] {
  if (room.status !== 'finished' || !priv.lti) return [];
  const out: LmsResult[] = [];
  for (const [playerId, binding] of Object.entries(priv.lti)) {
    if (!binding.gradeTarget || !room.players[playerId]) continue;
    const me = mdMe(room, priv, playerId);
    const st = room.standings[playerId];
    if (me.grade === null || !st) continue;
    out.push({
      playerId,
      binding: { ...binding, gradeTarget: binding.gradeTarget },
      score: me.grade,
      comment: `Market Detective · room ${room.code} · rank ${st.rank}/${room.order.length} · points ${st.total}/${room.rounds * 100}`,
      attemptId: `${room.code}:${playerId}`,
      occurredAt: new Date(room.finishedAt ?? Date.now()).toISOString(),
    });
  }
  return out;
}
