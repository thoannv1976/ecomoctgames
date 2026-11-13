// Game 6 – CRO Battle: hidden true effects, noisy A/B tests, peeking, novelty, the AI stores and the scorecard (server only).
import { GameError } from '../room.js';
import { shuffle, type Rng } from '../rng.js';
import type { RsGame, RsInput } from '../rs/room.js';
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';
import {
  CRO_BASE_CR,
  CRO_CHANGES,
  CRO_CHANGE_INFO,
  CRO_MARGIN,
  CRO_MAX_TESTS,
  CRO_ROUNDS,
  CRO_SHARES,
  CRO_SPRINT_WEEKS,
  CRO_WEEKS,
  CRO_WEEK_SESSIONS,
  type CroArchetype,
  type CroChange,
  type CroDecision,
  type CroPub,
  type CroReport,
  type CroShare,
  type CroTestPlan,
  type CroTestResult,
  type CroView,
  type CroWeeks,
} from './types.js';

/** True long-run relative lift, extra lift while new (first 2 weeks), extra return rate. */
interface Effect {
  lift: number;
  novelty: number;
  returns: number;
}
const BASE_EFFECTS: Record<CroChange, Effect> = {
  guest: { lift: 0.09, novelty: 0, returns: 0 },
  shipfee: { lift: 0.07, novelty: 0, returns: 0 },
  photos: { lift: 0.05, novelty: 0.01, returns: -0.02 },
  fields: { lift: 0.04, novelty: 0, returns: 0 },
  filters: { lift: 0.02, novelty: 0, returns: -0.01 },
  badges: { lift: 0.03, novelty: 0.01, returns: 0 },
  safari: { lift: 0.06, novelty: 0, returns: 0 },
  video: { lift: 0, novelty: 0.07, returns: 0 },
  carousel: { lift: -0.01, novelty: 0.01, returns: 0 },
  redesign: { lift: -0.02, novelty: 0.07, returns: 0 },
  urgency: { lift: 0.03, novelty: 0.05, returns: 0.12 },
  popup: { lift: -0.05, novelty: 0, returns: 0 },
  colour: { lift: 0, novelty: 0.02, returns: 0 },
};
const BASE_RETURNS = 0.08;
const RETURN_COST = 0.06; // million VND per returned order

export interface CroCo {
  shipped: CroChange[];
  /** Round each change went live (for novelty on the dashboard). */
  since: Partial<Record<CroChange, number>>;
  extraOrders: number;
  profit: number;
  lastDash: number;
  testsRun: number;
  peeks: number;
  bugTested: boolean;
  shippedLosers: number;
  urgencyShipped: boolean;
  fined: boolean;
  wellPowered: number;
  history: CroTestResult[];
}
export interface CroState {
  effects: Record<string, Effect>;
  cos: Record<string, CroCo>;
  /** Common market factor per round (seasonality), shared by all stores. */
  season: number[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const r1 = (v: number) => Math.round(v * 10) / 10;

function gauss(rng: Rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
/** Two-sided p-value of a z statistic. */
function pValue(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return clamp(1 - erf, 0, 1);
}

export function initCro(order: string[], rng: Rng): CroState {
  const effects: Record<string, Effect> = {};
  for (const c of CRO_CHANGES) {
    const b = BASE_EFFECTS[c];
    // Real effects vary a little per game, so answers cannot be memorised exactly.
    const j = 0.75 + 0.5 * rng();
    effects[c] = { lift: r4(b.lift * j), novelty: r4(b.novelty * (0.8 + 0.4 * rng())), returns: b.returns };
  }
  const season = Array.from({ length: CRO_ROUNDS + 1 }, () => r4(1 + 0.04 * gauss(rng)));
  const cos: Record<string, CroCo> = {};
  for (const id of order)
    cos[id] = { shipped: [], since: {}, extraOrders: 0, profit: 0, lastDash: CRO_BASE_CR, testsRun: 0, peeks: 0, bugTested: false, shippedLosers: 0, urgencyShipped: false, fined: false, wellPowered: 0, history: [] };
  return { effects, cos, season };
}

export function trueCr(state: CroState, shipped: CroChange[]) {
  return shipped.reduce((cr, c) => cr * (1 + state.effects[c]!.lift), CRO_BASE_CR);
}

/** Runs one A/B test on top of the live store. Sprint 4 (mega sale) distorts results. */
function runTest(state: CroState, base: number, plan: CroTestPlan, round: number, rng: Rng): CroTestResult {
  const e = state.effects[plan.change]!;
  const sale = round === 4;
  const days = plan.weeks * 7;
  const perDay = (CRO_WEEK_SESSIONS / 7) * (plan.share / 100);
  let cA = 0;
  let cB = 0;
  let nA = 0;
  let nB = 0;
  let stoppedDay: number | null = null;
  let p = 1;
  for (let d = 1; d <= days; d++) {
    // Novelty decays over the first two weeks; the sale adds a distorted swing.
    const nov = d <= 14 ? e.novelty * (1 - (d - 1) / 14) * 2 : 0;
    const distort = sale ? 1.6 : 1;
    const weekday = 1 + 0.08 * Math.sin((2 * Math.PI * d) / 7);
    const crA = base * weekday;
    const crB = base * weekday * (1 + (e.lift + nov) * distort);
    const noiseA = Math.sqrt(perDay * crA * (1 - crA));
    const noiseB = Math.sqrt(perDay * crB * (1 - crB));
    cA += Math.max(0, perDay * crA + gauss(rng) * noiseA * (sale ? 1.6 : 1));
    cB += Math.max(0, perDay * crB + gauss(rng) * noiseB * (sale ? 1.6 : 1));
    nA += perDay;
    nB += perDay;
    const pa = cA / nA;
    const pb = cB / nB;
    const pool = (cA + cB) / (nA + nB);
    const se = Math.sqrt(pool * (1 - pool) * (1 / nA + 1 / nB));
    p = se > 0 ? pValue((pb - pa) / se) : 1;
    if (plan.peek && d >= 3 && p < 0.05) {
      stoppedDay = d;
      break;
    }
  }
  const crA = cA / nA;
  const crB = cB / nB;
  const seDiff = Math.sqrt((crA * (1 - crA)) / nA + (crB * (1 - crB)) / nB);
  return {
    ...plan,
    nA: Math.round(nA),
    nB: Math.round(nB),
    crA: r4(crA),
    crB: r4(crB),
    lift: r4(crB / crA - 1),
    ciLow: r4((crB - 1.96 * seDiff) / crA - 1),
    ciHigh: r4((crB + 1.96 * seDiff) / crA - 1),
    p: Math.round(p * 1000) / 1000,
    stoppedDay,
    autoShipped: false,
  };
}

export function simulateCro(state: CroState, order: string[], inputs: Record<string, RsInput<CroDecision>>, round: number, rng: Rng) {
  const reports: Record<string, CroReport> = {};
  const values: Record<string, number> = {};
  const sessions = CRO_WEEK_SESSIONS * CRO_SPRINT_WEEKS;
  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    const notes: T[] = [];
    for (const ch of d.ship) if (!c.shipped.includes(ch)) c.since[ch] = round;
    for (const ch of c.shipped) if (!d.ship.includes(ch)) delete c.since[ch];
    // Discipline is judged on what the store ends up keeping.
    c.shipped = d.ship.slice();
    const base = trueCr(state, c.shipped);
    const tests = d.tests.map((t) => runTest(state, base, t, round, rng));
    let liveCr = base;
    let testOrders = 0;
    for (const t of tests) {
      c.testsRun++;
      if (t.peek) c.peeks++;
      if (t.change === 'safari') c.bugTested = true;
      if (!t.peek && t.share >= 25 && t.weeks >= 2) c.wellPowered++;
      testOrders += t.nB * (t.crB - t.crA) * (round === 4 ? 0.6 : 1);
      if (t.peek && t.stoppedDay !== null && t.lift > 0 && round < CRO_ROUNDS) {
        // The peeker ships the “winner” immediately – for the rest of the sprint and onwards.
        t.autoShipped = true;
        c.shipped.push(t.change);
        c.since[t.change] = round;
        const left = (CRO_SPRINT_WEEKS * 7 - t.stoppedDay) / (CRO_SPRINT_WEEKS * 7);
        liveCr *= 1 + state.effects[t.change]!.lift * clamp(left, 0, 1);
        notes.push(tx(`Peeking: “${CRO_CHANGE_INFO[t.change].name.en}” looked significant on day ${t.stoppedDay} and went live.`, `Xem trộm: “${CRO_CHANGE_INFO[t.change].name.vi}” trông có ý nghĩa vào ngày ${t.stoppedDay} và đã được áp dụng ngay.`));
      }
      c.history.push(t);
    }
    // Dashboard: true rate + novelty of changes that went live this sprint + seasonality + noise.
    const novelty = c.shipped.reduce((a, ch) => a + (c.since[ch] === round ? state.effects[ch]!.novelty : 0), 0);
    const season = state.season[round] ?? 1;
    const dash = liveCr * (1 + novelty) * season * (1 + 0.025 * gauss(rng));
    const orders = sessions * liveCr * season + testOrders;
    const baseOrders = sessions * CRO_BASE_CR * season;
    const extra = orders - baseOrders;
    const returnRate = clamp(BASE_RETURNS + c.shipped.reduce((a, ch) => a + state.effects[ch]!.returns, 0), 0.02, 0.5);
    const returnsCost = orders * returnRate * RETURN_COST - baseOrders * BASE_RETURNS * RETURN_COST;
    let fine = 0;
    if (round === CRO_ROUNDS && c.shipped.includes('urgency')) {
      fine = 300;
      c.fined = true;
      notes.push(tx('Consumer-protection review: fake scarcity found. Fine VND 300m and a public warning.', 'Rà soát bảo vệ người tiêu dùng: phát hiện khan hiếm giả. Phạt 300 triệu đồng và bị cảnh báo công khai.'));
    }
    const profit = extra * CRO_MARGIN - returnsCost - fine;
    c.extraOrders += extra;
    c.profit += profit;
    c.lastDash = dash;
    if (c.shipped.includes('urgency')) c.urgencyShipped = true;
    if (round === 4 && tests.length) notes.push(tx('These tests ran during the mega sale: swings are bigger than normal and may not last.', 'Các thử nghiệm này chạy trong đợt siêu sale: dao động lớn hơn bình thường và có thể không bền.'));
    for (const t of tests) {
      if (t.weeks === 1) notes.push(tx(`${CRO_CHANGE_INFO[t.change].name.en}: a 1-week test covers one weekly cycle only and catches any novelty at its peak.`, `${CRO_CHANGE_INFO[t.change].name.vi}: thử 1 tuần chỉ phủ một chu kỳ tuần và bắt hiệu ứng mới lạ đúng lúc mạnh nhất.`));
      else if (t.share === 10 && t.p >= 0.05) notes.push(tx(`${CRO_CHANGE_INFO[t.change].name.en}: 10% of traffic is too little to see a small effect – the confidence interval is wide.`, `${CRO_CHANGE_INFO[t.change].name.vi}: 10% traffic quá ít để thấy hiệu ứng nhỏ – khoảng tin cậy rất rộng.`));
    }
    if (tests.some((t) => t.change === 'safari')) notes.push(tx('You A/B-tested a broken Pay button: half the iPhone buyers still could not pay. Obvious bugs are fixed, not tested.', 'Bạn A/B test nút Trả tiền bị hỏng: một nửa khách iPhone vẫn không trả tiền được. Lỗi hiển nhiên thì sửa, không thử.'));
    reports[id] = {
      round,
      decision: d,
      defaulted: inputs[id]!.defaulted,
      tests,
      dashCr: r4(dash),
      sessions,
      orders: Math.round(orders),
      extraOrders: Math.round(extra),
      returnsCost: r1(returnsCost),
      fine,
      profit: r1(profit),
      notes,
    };
    values[id] = r4(dash * 100);
  }
  const news: T[] = [tx('Dashboards show this sprint’s conversion rate – including novelty, seasonality and noise. True rates are revealed after sprint 5.', 'Bảng điều khiển hiện tỷ lệ chuyển đổi sprint này – gồm cả hiệu ứng mới lạ, mùa vụ và nhiễu. Tỷ lệ thật được công bố sau sprint 5.')];
  if (round === CRO_ROUNDS) {
    const best = order.slice().sort((a, b) => trueCr(state, state.cos[b]!.shipped) - trueCr(state, state.cos[a]!.shipped))[0]!;
    news.push(tx(`True conversion rates revealed. Best store: ${(trueCr(state, state.cos[best]!.shipped) * 100).toFixed(2)}%.`, `Công bố tỷ lệ chuyển đổi thật. Cửa hàng tốt nhất: ${(trueCr(state, state.cos[best]!.shipped) * 100).toFixed(2).replace('.', ',')}%.`));
  }
  return { reports, values, news };
}

export function croPub(state: CroState, order: string[], finished: boolean): CroPub {
  const pick = (f: (c: CroCo) => number) => Object.fromEntries(order.map((id) => [id, f(state.cos[id]!)]));
  return {
    dash: pick((c) => r4(c.lastDash)),
    tests: pick((c) => c.testsRun),
    shipped: pick((c) => c.shipped.length),
    ...(finished ? { trueCr: pick((c) => r4(trueCr(state, c.shipped))) } : {}),
  };
}

function discipline(state: CroState, c: CroCo) {
  let d = 30;
  const losers = c.shipped.filter((ch) => state.effects[ch]!.lift <= 0).length;
  d -= 6 * losers;
  if (c.shipped.includes('urgency')) d -= 10;
  if (c.bugTested) d -= 3;
  if (!c.shipped.includes('safari')) d -= 5;
  d -= Math.min(8, 2 * c.peeks);
  return clamp(d, 0, 30);
}

export function croScorecard(state: CroState, c: CroCo, finished: boolean) {
  const cr = finished ? trueCr(state, c.shipped) : c.lastDash;
  const crPts = 50 * clamp((cr / CRO_BASE_CR - 1) / 0.4, 0, 1);
  const orders = 20 * clamp(c.extraOrders / 10000, 0, 1);
  // During the game discipline is unknown: everyone shows the neutral 15.
  const disc = finished ? discipline(state, c) : 15;
  return { total: crPts + orders + disc, parts: { cr: r1(crPts), orders: r1(orders), discipline: r1(disc) } };
}

// ---------- AI stores ----------
const PRIORITY: CroChange[] = ['guest', 'shipfee', 'fields', 'photos', 'badges', 'filters', 'video', 'colour', 'carousel', 'redesign', 'popup'];

export function croBot(arch: CroArchetype, level: BotLevel, state: CroState, c: CroCo, round: number, rng: Rng): CroDecision {
  const ship = new Set<CroChange>(c.shipped);
  const tests: CroTestPlan[] = [];
  const tested = new Set(c.history.map((t) => t.change));
  const last = c.history.filter((t) => !t.autoShipped);
  const untested = (list: CroChange[]) => list.filter((ch) => !tested.has(ch) && !ship.has(ch));
  const sloppy = level === 'easy' ? 0.35 : level === 'medium' ? 0.15 : 0;
  const pickTests = (cands: CroChange[], share: CroShare, weeks: CroWeeks, peek: boolean) => {
    for (const ch of cands.slice(0, CRO_MAX_TESTS)) tests.push({ change: ch, share, weeks, peek });
  };
  switch (arch) {
    case 'hippo': {
      const plan: CroChange[] = ['redesign', 'video', 'urgency', 'carousel', 'safari'];
      for (let r = 1; r <= Math.min(round, plan.length); r++) ship.add(plan[r - 1]!);
      break;
    }
    case 'copycat': {
      const plan: CroChange[][] = [['guest', 'popup'], ['fields', 'video'], ['badges', 'safari'], ['carousel'], []];
      for (let r = 1; r <= round; r++) for (const ch of plan[r - 1] ?? []) ship.add(ch);
      break;
    }
    case 'peeker':
      if (round < CRO_ROUNDS) pickTests(shuffle(rng, untested(CRO_CHANGES)), 50, 2, true);
      break;
    case 'tiny':
      for (const t of last) if (t.lift > 0) ship.add(t.change);
      if (round < CRO_ROUNDS) pickTests(shuffle(rng, untested(CRO_CHANGES)), 10, 1, false);
      break;
    case 'cautious':
      if (round >= 2) ship.add('safari');
      for (const t of last) if (t.p < 0.05 && t.lift > 0 && t.change !== 'urgency') ship.add(t.change);
      if (round < CRO_ROUNDS && round !== 4) pickTests(untested(PRIORITY).slice(0, 1), 50, 4, false);
      break;
    default: {
      // Disciplined: fix the bug straight away, test the most promising ideas with full power.
      ship.add('safari');
      for (const t of last) if (t.p < 0.05 && t.lift > 0 && t.change !== 'urgency') ship.add(t.change);
      const order = level === 'hard' ? PRIORITY : shuffle(rng, PRIORITY);
      if (round < CRO_ROUNDS && round !== 4) pickTests(untested(order), 50, 4, false);
    }
  }
  if (sloppy > 0) {
    for (const t of tests) {
      if (rng() < sloppy) t.weeks = 1;
      if (rng() < sloppy) t.peek = true;
    }
    if (rng() < sloppy / 2) ship.add(CRO_CHANGES[Math.floor(rng() * CRO_CHANGES.length)]!);
  }
  return cleanCro({ ship: [...ship], tests }, round);
}

function cleanCro(d: CroDecision, round: number): CroDecision {
  const ship = CRO_CHANGES.filter((c) => d.ship.includes(c));
  const seen = new Set<CroChange>();
  const tests: CroTestPlan[] = [];
  if (round < CRO_ROUNDS)
    for (const t of d.tests) {
      if (tests.length >= CRO_MAX_TESTS || seen.has(t.change) || ship.includes(t.change)) continue;
      seen.add(t.change);
      tests.push({ change: t.change, share: t.share, weeks: t.weeks, peek: !!t.peek });
    }
  return { ship, tests };
}

const E = (en: string, vi: string) => ({ en, vi });

export function validateCro(raw: unknown, round: number): CroDecision {
  const bad = (en = 'Invalid plan – please check every field.', vi = 'Kế hoạch không hợp lệ – vui lòng kiểm tra từng mục.') => new GameError('bad_decision', E(en, vi));
  if (!raw || typeof raw !== 'object') throw bad();
  const d = raw as { ship?: unknown; tests?: unknown };
  if (!Array.isArray(d.ship) || !Array.isArray(d.tests)) throw bad();
  if (d.ship.length > CRO_CHANGES.length || d.ship.some((c) => !CRO_CHANGES.includes(c as CroChange))) throw bad();
  if (d.tests.length > CRO_MAX_TESTS) throw bad('At most two tests per sprint.', 'Tối đa hai thử nghiệm mỗi sprint.');
  if (round >= CRO_ROUNDS && d.tests.length) throw bad('No new tests in the final sprint.', 'Sprint cuối không chạy thử nghiệm mới.');
  const tests: CroTestPlan[] = d.tests.map((x) => {
    const t = x as Record<string, unknown>;
    if (!CRO_CHANGES.includes(t.change as CroChange) || !CRO_SHARES.includes(Number(t.share) as CroShare) || !CRO_WEEKS.includes(Number(t.weeks) as CroWeeks)) throw bad();
    return { change: t.change as CroChange, share: Number(t.share) as CroShare, weeks: Number(t.weeks) as CroWeeks, peek: t.peek === true };
  });
  if (new Set(tests.map((t) => t.change)).size !== tests.length) throw bad('Two tests on the same change.', 'Hai thử nghiệm trùng một thay đổi.');
  if (tests.some((t) => (d.ship as unknown[]).includes(t.change))) throw bad('A change that is already live cannot be A/B-tested.', 'Thay đổi đã áp dụng thì không A/B test được nữa.');
  return cleanCro({ ship: d.ship as CroChange[], tests }, round);
}

export function croBadges(state: CroState, id: string, order: string[]): string[] {
  const c = state.cos[id]!;
  const out: string[] = [];
  if (c.shipped.length >= 2 && c.shipped.every((ch) => state.effects[ch]!.lift > 0 && ch !== 'urgency')) out.push('scientist');
  if (c.testsRun > 0 && c.peeks === 0) out.push('noPeek');
  if (c.shipped.includes('safari') && !c.bugTested) out.push('fixer');
  if (!c.urgencyShipped) out.push('ethical');
  const best = order.slice().sort((a, b) => trueCr(state, state.cos[b]!.shipped) - trueCr(state, state.cos[a]!.shipped))[0];
  if (best === id) out.push('top');
  if (c.wellPowered >= 3) out.push('power');
  return out;
}

export const CRO_BATTLE: RsGame<CroDecision, CroState, CroReport, CroView> = {
  id: 'cro-battle',
  rounds: CRO_ROUNDS,
  label: 'CRO Battle',
  botNames: ['GlowCart', 'SkinBox', 'DewShop', 'PureMart', 'LumiStore', 'VelvetBuy'],
  archetypes: ['hippo', 'peeker', 'tiny', 'disciplined', 'copycat', 'cautious'],
  defaultSettings: { decideSec: 240, resultsSec: 0, botLevel: 'medium', fillBots: true },
  init: (order, _room, rng) => initCro(order, rng),
  validate: (raw, round) => validateCro(raw, round),
  fallback: (state, id, round) => cleanCro({ ship: state.cos[id]!.shipped.slice(), tests: [] }, round),
  bot: (arch, level, state, id, round, rng) => croBot(arch as CroArchetype, level, state, state.cos[id]!, round, rng),
  simulate: (state, order, inputs, round, rng) => {
    const out = simulateCro(state, order, inputs, round, rng);
    return { ...out, pub: croPub(state, order, round >= CRO_ROUNDS) as unknown as Record<string, unknown> };
  },
  scorecard: (state, id, finished) => croScorecard(state, state.cos[id]!, finished),
  cols: (state, id, finished) => {
    const c = state.cos[id]!;
    return { cr: r4(finished ? trueCr(state, c.shipped) : c.lastDash), extraOrders: Math.round(c.extraOrders), tests: c.testsRun, shipped: c.shipped.length };
  },
  view: (state, id, _round, finished) => {
    const c = state.cos[id]!;
    return {
      shipped: c.shipped,
      dashCr: r4(c.lastDash),
      ...(finished
        ? {
            truth: Object.fromEntries(CRO_CHANGES.map((ch) => [ch, { lift: state.effects[ch]!.lift, novelty: state.effects[ch]!.novelty }])),
            trueCr: r4(trueCr(state, c.shipped)),
          }
        : {}),
    };
  },
  badges: croBadges,
  pub: (state, order) => croPub(state, order, false) as unknown as Record<string, unknown>,
};
