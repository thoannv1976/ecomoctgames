// Game 3 – Shopper Stream: the hidden persona weight vectors (where each persona really drops off),
// the shared shopper pool, the service-recovery event and the scorecard (server only).
import { GameError } from '../room.js';
import type { Rng } from '../rng.js';
import type { RsGame, RsInput } from '../rs/room.js';
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';
import {
  SS_CHANNELS,
  SS_CHANNEL_INFO,
  SS_CLV_TARGET,
  SS_FUNNEL,
  SS_INCIDENT_ROUND,
  SS_INCIDENT_SHARE,
  SS_INTERVIEW_COST,
  SS_LOYAL_TARGET,
  SS_PERSONAS,
  SS_PERSONA_INFO,
  SS_POINTS,
  SS_POOL,
  SS_RECOVERY,
  SS_RESEARCH,
  SS_ROUNDS,
  SS_STAGES,
  SS_STAGE_INFO,
  type SsArchetype,
  type SsChannel,
  type SsDecision,
  type SsInsight,
  type SsPersona,
  type SsPub,
  type SsRecovery,
  type SsReport,
  type SsResearch,
  type SsStage,
  type SsView,
} from './types.js';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const vn = (v: number) => String(v).replace('.', ',');
const zeroStage = (): Record<SsStage, number> => ({ discover: 0, search: 0, compare: 0, buy: 0, review: 0, repeat: 0 });
const zeroPersona = (): Record<SsPersona, number> => ({ student: 0, mom: 0, office: 0, gifter: 0, pro: 0, senior: 0 });

// ───────── hidden model ─────────
/** Market-average conversion at each step with no investment. */
const BASE: Record<SsStage, number> = { discover: 0.12, search: 0.4, compare: 0.46, buy: 0.64, review: 0.18, repeat: 0 };
/** The best a step can be made. */
const CAP: Record<SsStage, number> = { discover: 0.3, search: 0.66, compare: 0.8, buy: 0.93, review: 0.66, repeat: 0 };
/** Points for ~63% of the gain available at a step (diminishing returns). */
const PK = 3.2;
/** How much a fully fixed Repurchase step adds to the repeat rate. */
const REP_GAIN = 0.3;
/** Share of the shoppers who are nobody's customer that shop in a given month. */
const MARKET_ACTIVE = 0.5;
/** How sharply each channel concentrates demand on the best-looking shop. */
const EXPO: Record<SsChannel, number> = { search: 1.6, discover: 1, agent: 3 };
/** Share of shoppers who actually use the channel in 2026 (few of them send an agent yet). */
const ADOPT: Record<SsChannel, number> = { search: 1, discover: 1, agent: 0.22 };
/** Customers who did not buy this month and leave the base. */
const LEAVE = 0.3;
/** Extra repeat rate the recovered customers keep for the rest of the game. */
const RECOVERY_BONUS = 0.1;
const IGNORE_PENALTY = 0.15;
/** Knowing a persona's jobs, pains and gains makes every fix work better on them. */
const KNOWN_BONUS = 1.18;

const SIZE: Record<SsPersona, number> = { student: 30_000, mom: 24_000, office: 26_000, gifter: 14_000, pro: 8_000, senior: 18_000 };
const LOYALTY: Record<SsPersona, number> = { student: 0.14, mom: 0.52, office: 0.34, gifter: 0.05, pro: 0.72, senior: 0.6 };
const REACH: Record<SsChannel, Record<SsPersona, number>> = {
  search: { student: 0.45, mom: 0.9, office: 0.8, gifter: 0.6, pro: 0.5, senior: 0.6 },
  discover: { student: 0.95, mom: 0.5, office: 0.7, gifter: 0.85, pro: 0.2, senior: 0.3 },
  agent: { student: 0.05, mom: 0.25, office: 0.4, gifter: 0.1, pro: 0.85, senior: 0.05 },
};
/** How much each persona responds to a fix at each step. The highest value is that persona's real pain. */
const BASE_W: Record<SsPersona, Record<SsStage, number>> = {
  student: { discover: 1.2, search: 0.9, compare: 1.6, buy: 0.8, review: 0.7, repeat: 0.5 },
  mom: { discover: 0.6, search: 0.8, compare: 1.0, buy: 0.9, review: 1.6, repeat: 1.3 },
  office: { discover: 0.8, search: 1.2, compare: 0.8, buy: 1.6, review: 0.7, repeat: 1.0 },
  gifter: { discover: 1.6, search: 0.9, compare: 1.1, buy: 1.0, review: 0.6, repeat: 0.3 },
  pro: { discover: 0.4, search: 0.9, compare: 1.6, buy: 1.0, review: 0.8, repeat: 1.3 },
  senior: { discover: 0.5, search: 0.8, compare: 0.9, buy: 1.6, review: 1.2, repeat: 1.1 },
};

/** Jobs, pains and gains – revealed only by research. */
const VOICE: Record<SsPersona, { jobs: T; pains: T; gains: T }> = {
  student: {
    jobs: tx('Get the thing I want for the lowest total price today.', 'Mua được món tôi muốn với giá cuối thấp nhất hôm nay.'),
    pains: tx('The price on the card is not the price at checkout: shipping and the voucher change everything.', 'Giá ở ngoài không phải giá lúc trả tiền: phí ship và voucher làm thay đổi hết.'),
    gains: tx('Show me the real total early and I stop comparing.', 'Cho tôi thấy tổng tiền thật ngay từ đầu thì tôi thôi so sánh.'),
  },
  mom: {
    jobs: tx('Buy the same safe things again without having to think about it.', 'Mua lại đúng những món an toàn mà không phải suy nghĩ.'),
    pains: tx('I do not know whether to believe the page. I read the reviews, including the one-star ones, and the answers to them.', 'Tôi không biết có nên tin trang hàng không. Tôi đọc đánh giá, kể cả đánh giá một sao, và đọc cả phần trả lời.'),
    gains: tx('Real reviews with photos, and a shop that answers them, and I will buy from you for years.', 'Đánh giá thật có ảnh, và một cửa hàng có trả lời đánh giá, thì tôi mua của bạn nhiều năm.'),
  },
  office: {
    jobs: tx('Order in two minutes between two meetings.', 'Đặt hàng trong hai phút giữa hai cuộc họp.'),
    pains: tx('Creating an account, confirming a code, typing my address again – I close the tab.', 'Phải tạo tài khoản, xác nhận mã, nhập lại địa chỉ – tôi đóng tab.'),
    gains: tx('Let me check out as a guest with the address you already have.', 'Cho tôi trả tiền mà không cần tài khoản, với địa chỉ bạn đã có.'),
  },
  gifter: {
    jobs: tx('Find something that looks special, before Saturday.', 'Tìm được món trông đặc biệt, trước thứ Bảy.'),
    pains: tx('I do not know what to give. I did not come looking for you.', 'Tôi không biết nên tặng gì. Tôi không đi tìm bạn.'),
    gains: tx('Show me the idea in a video and I will spend a lot – once.', 'Cho tôi thấy ý tưởng trong một video thì tôi chi nhiều – một lần.'),
  },
  pro: {
    jobs: tx('Restock every month at a price and a policy I can plan on.', 'Nhập hàng hằng tháng với giá và chính sách tôi có thể tính trước.'),
    pains: tx('Specifications are incomplete and the return policy is vague, so I cannot compare offers properly.', 'Thông số không đủ và chính sách đổi trả mơ hồ, nên tôi không so sánh được cho đúng.'),
    gains: tx('Complete specs, stock figures and a written policy – then I order every month and never haggle.', 'Thông số đầy đủ, số tồn kho và chính sách viết rõ – thì tôi đặt hàng hằng tháng và không mặc cả.'),
  },
  senior: {
    jobs: tx('Buy without risking my money or my time.', 'Mua mà không phải mạo hiểm tiền và thời gian của mình.'),
    pains: tx('Too many steps and too many fields. I want to pay when the goods arrive.', 'Quá nhiều bước và quá nhiều ô phải điền. Tôi muốn trả tiền khi hàng tới.'),
    gains: tx('One simple page, cash on delivery and a phone number that answers.', 'Một trang đơn giản, trả tiền khi nhận hàng, và một số điện thoại có người nghe.'),
  },
};

export interface SsCo {
  /** Customers who have bought at least once and have not left, per persona. */
  base: Record<SsPersona, number>;
  /** Value from repeat orders (VND bn) so far – the score. */
  clv: number;
  revenue: number;
  orders: number;
  repeatOrders: number;
  reviews: number;
  /** Satisfaction multiplier on repurchase. */
  sat: number;
  /** Rounds of reduced satisfaction left after an ignored failure. */
  badUntil: number;
  recovered: boolean;
  known: Record<SsPersona, boolean>;
  insightSum: number;
  insightRounds: number;
  /** Customers waiting for an answer to a delivery failure. */
  pending: Record<SsPersona, number> | null;
  buyersLast: number;
}

export interface SsState {
  cos: Record<string, SsCo>;
  w: Record<SsPersona, Record<SsStage, number>>;
  pool: Record<SsPersona, number>;
  /** Market-average conversion last month (public). */
  funnel: Record<SsStage, number>;
  channel: Record<string, SsChannel>;
  incidentDone: boolean;
}

export const ssPainOf = (state: SsState, p: SsPersona): SsStage =>
  SS_STAGES.slice().sort((a, b) => state.w[p][b]! - state.w[p][a]!)[0]!;

export const ssInsightOf = (state: SsState, p: SsPersona): SsInsight => ({
  persona: p,
  pain: ssPainOf(state, p),
  jobs: VOICE[p].jobs,
  pains: VOICE[p].pains,
  gains: VOICE[p].gains,
});

export function initSs(order: string[], rng: Rng): SsState {
  const cos: Record<string, SsCo> = {};
  for (const id of order)
    cos[id] = {
      base: zeroPersona(),
      clv: 0,
      revenue: 0,
      orders: 0,
      repeatOrders: 0,
      reviews: 0,
      sat: 1,
      badUntil: 0,
      recovered: false,
      known: { student: false, mom: false, office: false, gifter: false, pro: false, senior: false },
      insightSum: 0,
      insightRounds: 0,
      pending: null,
      buyersLast: 0,
    };
  // A little jitter so two rooms are never identical – never enough to move a persona's pain.
  const w = {} as Record<SsPersona, Record<SsStage, number>>;
  for (const p of SS_PERSONAS) {
    const row = {} as Record<SsStage, number>;
    for (const s of SS_STAGES) row[s] = r3(BASE_W[p][s]! * (1 + (rng() - 0.5) * 0.08));
    w[p] = row;
  }
  // Before anyone has done anything, the public repurchase rate is the market's own base loyalty.
  const loyalty = r3(SS_PERSONAS.reduce((a, p) => a + LOYALTY[p] * SIZE[p], 0) / SS_POOL);
  return { cos, w, pool: { ...SIZE }, funnel: { ...BASE, repeat: loyalty }, channel: {}, incidentDone: false };
}

// ───────── the journey ─────────
const gainFrac = (pts: number) => 1 - Math.exp(-Math.max(0, pts) / PK);
const reviewBoost = (stock: number) => 0.12 * (1 - Math.exp(-Math.max(0, stock) / 7));

/** Conversion at one journey step for one persona. */
function convOf(state: SsState, s: SsStage, pts: number, p: SsPersona, reviews: number, known: boolean): number {
  const w = state.w[p][s]! * (known ? KNOWN_BONUS : 1);
  let v = BASE[s] + (CAP[s] - BASE[s]) * gainFrac(pts) * w;
  if (s === 'compare') v += reviewBoost(reviews) * w;
  return clamp(v, 0.01, CAP[s] + 0.06);
}

/** The steps a new shopper of this channel has to pass. */
const chainOf = (ch: SsChannel): SsStage[] => SS_FUNNEL.slice(SS_FUNNEL.indexOf(SS_CHANNEL_INFO[ch].entry));

function firstOrderRate(state: SsState, d: SsDecision, p: SsPersona, reviews: number, known: boolean): number {
  let v = 1;
  for (const s of chainOf(d.channel)) v *= convOf(state, s, d.fix[s] ?? 0, p, reviews, known);
  // An agent reads your specs and policy: with nothing to read it cannot choose you at all.
  if (d.channel === 'agent') v *= clamp(0.25 + 0.75 * gainFrac(d.fix.compare ?? 0), 0.2, 1);
  return v;
}

function repeatRate(state: SsState, c: SsCo, d: SsDecision, p: SsPersona): number {
  const w = state.w[p];
  const k = c.known[p] ? KNOWN_BONUS : 1;
  const lift = (REP_GAIN * gainFrac(d.fix.repeat ?? 0) * w.repeat! + 0.08 * (reviewBoost(c.reviews) / 0.12) * w.review!) * k;
  return clamp((LOYALTY[p] + lift) * c.sat, 0.02, 0.9);
}

/** How attractive this shop looks at the step where its channel's shoppers arrive. */
function appealOf(_state: SsState, d: SsDecision, p: SsPersona, known: boolean): number {
  const entry = SS_CHANNEL_INFO[d.channel].entry;
  const q = gainFrac(d.fix[entry] ?? 0);
  return REACH[d.channel][p] * (0.55 + 0.45 * q) * (known ? 1.1 : 1);
}
const weightOf = (state: SsState, d: SsDecision, p: SsPersona, known: boolean) => Math.pow(appealOf(state, d, p, known), EXPO[d.channel]);

/** Value of this month's plan: repeat value now plus what a new customer is worth over the months left. */
function valueOf(state: SsState, c: SsCo, d: SsDecision, round: number, rivalWeight: Record<SsPersona, number>): number {
  const stockAfter = c.reviews * 0.75 + (d.fix.review ?? 0) * clamp(0.3 + c.buyersLast / 300, 0.3, 1);
  const left = Math.max(0, SS_ROUNDS - round);
  let value = 0;
  for (const p of SS_PERSONAS) {
    const wgt = weightOf(state, d, p, c.known[p]!);
    const share = wgt / Math.max(1e-9, wgt + rivalWeight[p]);
    const entering = state.pool[p] * MARKET_ACTIVE * ADOPT[d.channel] * share;
    const newB = entering * firstOrderRate(state, d, p, c.reviews, c.known[p]!);
    const rep = repeatRate(state, c, d, p);
    // Next month the reviews written this month make the Compare step easier.
    const repNext = clamp(rep + 0.08 * (reviewBoost(stockAfter) / 0.12) * state.w[p].review! * (c.known[p] ? KNOWN_BONUS : 1) * c.sat, 0.02, 0.9);
    const aov = SS_PERSONA_INFO[p].aov / 1e6;
    value += aov * (c.base[p]! * rep + newB * repNext * left * 0.8);
  }
  return value;
}

/** The two steps where one more point would have added the most repeat value. */
function bestSteps(state: SsState, c: SsCo, d: SsDecision, round: number, rivalWeight: Record<SsPersona, number>): [SsStage, SsStage] {
  const base = valueOf(state, c, d, round, rivalWeight);
  const marginal = SS_STAGES.map((s) => {
    const alt: SsDecision = { ...d, fix: { ...d.fix, [s]: (d.fix[s] ?? 0) + 1 } };
    return [s, valueOf(state, c, alt, round, rivalWeight) - base] as [SsStage, number];
  }).sort((a, b) => b[1] - a[1]);
  return [marginal[0]![0], marginal[1]![0]];
}

// ───────── one month ─────────
export function simulateSs(state: SsState, order: string[], inputs: Record<string, RsInput<SsDecision>>, round: number) {
  const reports: Record<string, SsReport> = {};
  const values: Record<string, number> = {};
  const news: T[] = [];

  const totalWeight = zeroPersona();
  for (const id of order) for (const p of SS_PERSONAS) totalWeight[p] += weightOf(state, inputs[id]!.decision, p, state.cos[id]!.known[p]!);

  const acquired = zeroPersona();
  const left = zeroPersona();
  const marketConv: Record<SsStage, { sum: number; n: number }> = {
    discover: { sum: 0, n: 0 },
    search: { sum: 0, n: 0 },
    compare: { sum: 0, n: 0 },
    buy: { sum: 0, n: 0 },
    review: { sum: 0, n: 0 },
    repeat: { sum: 0, n: 0 },
  };

  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    const notes: T[] = [];
    const rival = zeroPersona();
    for (const p of SS_PERSONAS) rival[p] = Math.max(0, totalWeight[p] - weightOf(state, d, p, c.known[p]!));

    // The answer to a delivery failure comes before anything else this month.
    let cost = 0;
    let incident: T | null = null;
    if (c.pending) {
      const hit = c.pending;
      const customers = SS_PERSONAS.reduce((a, p) => a + hit[p]!, 0);
      const orderValue = SS_PERSONAS.reduce((a, p) => a + (hit[p]! * SS_PERSONA_INFO[p].aov) / 1e6, 0);
      const choice: SsRecovery = d.recovery ?? 'ignore';
      if (choice === 'ignore') {
        for (const p of SS_PERSONAS) {
          c.base[p] = Math.max(0, c.base[p]! - hit[p]!);
          left[p] += hit[p]!;
        }
        c.badUntil = round + 1;
        c.reviews = Math.max(0, c.reviews - 5);
        incident = tx(
          `You let ${Math.round(customers)} customers with a failed delivery go. They left, and the one-star reviews stay on the page.`,
          `Bạn để ${Math.round(customers)} khách bị lỗi giao hàng tự đi. Họ rời đi, và những đánh giá một sao thì còn lại trên trang.`,
        );
      } else if (choice === 'refund') {
        cost += orderValue;
        incident = tx(
          `You refunded ${Math.round(customers)} failed orders (VND ${vn(r2(orderValue))} bn). They stayed – as they were.`,
          `Bạn hoàn tiền ${Math.round(customers)} đơn bị lỗi (${vn(r2(orderValue))} tỷ đồng). Họ ở lại – như cũ.`,
        );
      } else {
        cost += orderValue * 1.45;
        c.recovered = true;
        incident = tx(
          `You refunded, apologised and followed up with ${Math.round(customers)} customers (VND ${vn(r2(orderValue * 1.45))} bn). They come back more loyal than before the failure.`,
          `Bạn hoàn tiền, xin lỗi và chăm sóc tiếp ${Math.round(customers)} khách (${vn(r2(orderValue * 1.45))} tỷ đồng). Họ quay lại trung thành hơn cả trước khi có sự cố.`,
        );
        notes.push(
          tx(
            'The service-recovery paradox: a complaint answered properly buys more loyalty than a month with no complaints.',
            'Nghịch lý phục hồi dịch vụ: một lời phàn nàn được xử lý đúng cách mua được nhiều lòng trung thành hơn cả một tháng không ai phàn nàn.',
          ),
        );
      }
      c.pending = null;
    }
    c.sat = clamp(1 + (c.recovered ? RECOVERY_BONUS : 0) - (round <= c.badUntil ? IGNORE_PENALTY : 0), 0.7, 1.2);

    // Research (before this month's work: what you learn you can use at once).
    let reveal: SsInsight | null = null;
    if (d.research === 'reviews') {
      const mine = SS_PERSONAS.slice().sort((a, b) => c.base[b]! - c.base[a]!)[0]!;
      if (c.base[mine]! > 0) {
        reveal = ssInsightOf(state, mine);
        c.known[mine] = true;
        notes.push(
          tx(
            `Review mining speaks only for ${SS_PERSONA_INFO[mine].name.en.toLowerCase()} – the persona that already buys from you. The shoppers you are losing never leave a review.`,
            `Đào dữ liệu đánh giá chỉ nói thay cho nhóm ${SS_PERSONA_INFO[mine].name.vi.toLowerCase()} – chân dung đã mua của bạn. Những khách bạn đang mất thì không để lại đánh giá nào.`,
          ),
        );
      } else
        notes.push(
          tx('You have no reviews yet: nobody has bought from you, so there is nothing to mine.', 'Bạn chưa có đánh giá nào: chưa ai mua của bạn, nên không có gì để đào.'),
        );
    } else if (d.research === 'interview' && d.interviewOf) {
      reveal = ssInsightOf(state, d.interviewOf);
      c.known[d.interviewOf] = true;
    }


    const [best, second] = bestSteps(state, c, d, round, rival);
    const spent = SS_STAGES.reduce((a, s) => a + (d.fix[s] ?? 0), 0);
    const budget = SS_POINTS - (d.research === 'interview' ? SS_INTERVIEW_COST : 0);
    const idle: SsDecision = { ...d, fix: zeroStage() };
    const floorValue = valueOf(state, c, idle, round, rival);
    const ceiling = bestPossible(state, c, round, budget, rival);
    const insight = clamp((valueOf(state, c, d, round, rival) - floorValue) / Math.max(1e-9, ceiling - floorValue), 0, 1);
    c.insightSum += insight;
    c.insightRounds++;

    const newBuyers = zeroPersona();
    const repeatOrders = zeroPersona();
    const funnel = zeroStage();
    let revenue = 0;
    let clvGain = 0;
    let buyers = 0;

    for (const p of SS_PERSONAS) {
      const wgt = weightOf(state, d, p, c.known[p]!);
      const share = wgt / Math.max(1e-9, wgt + rival[p]!);
      const entering = state.pool[p]! * MARKET_ACTIVE * ADOPT[d.channel] * share;
      const nb = Math.min(state.pool[p]! * 0.9, entering * firstOrderRate(state, d, p, c.reviews, c.known[p]!));
      const rep = repeatRate(state, c, d, p);
      const ro = c.base[p]! * rep;
      newBuyers[p] = r1(nb);
      repeatOrders[p] = r1(ro);
      const aov = SS_PERSONA_INFO[p].aov / 1e6;
      revenue += (nb + ro) * aov;
      clvGain += ro * aov;
      buyers += nb + ro;
      acquired[p] += nb;
      const leaving = c.base[p]! * (1 - rep) * LEAVE;
      left[p] += leaving;
      c.base[p] = c.base[p]! - leaving + nb;
    }
    for (const s of SS_STAGES) {
      if (s === 'repeat') funnel[s] = r3(SS_PERSONAS.reduce((a, p) => a + repeatRate(state, c, d, p) * SIZE[p], 0) / 120_000);
      else if (s === 'review') funnel[s] = r3(clamp(BASE.review + (CAP.review - BASE.review) * gainFrac(d.fix.review ?? 0), 0, 1));
      else funnel[s] = r3(SS_PERSONAS.reduce((a, p) => a + convOf(state, s, d.fix[s] ?? 0, p, c.reviews, c.known[p]!) * SIZE[p], 0) / 120_000);
      marketConv[s].sum += funnel[s]!;
      marketConv[s].n++;
    }

    c.reviews = r2(c.reviews * 0.75 + (d.fix.review ?? 0) * clamp(0.3 + c.buyersLast / 300, 0.3, 1));
    c.buyersLast = buyers;
    c.revenue += revenue;
    c.orders += buyers;
    c.repeatOrders += SS_PERSONAS.reduce((a, p) => a + repeatOrders[p]!, 0);
    c.clv = Math.max(0, c.clv + clvGain - cost);

    // Coaching notes: the lesson, not the formula.
    if ((d.fix[best] ?? 0) === 0)
      notes.push(
        tx(
          `One more point on ${SS_STAGE_INFO[best].name.en} would have been worth more than anything you bought this month.`,
          `Thêm một điểm vào bước ${SS_STAGE_INFO[best].name.vi.toLowerCase()} sẽ đáng hơn mọi thứ bạn đã mua trong tháng này.`,
        ),
      );
    const oneTime = SS_PERSONAS.reduce((a, p) => a + newBuyers[p]!, 0);
    if (oneTime > 0 && clvGain < 0.12 * revenue && round >= 2)
      notes.push(
        tx(
          'Almost all of this month’s revenue came from first orders. The month looks good and the score does not move: only repeat customers are counted.',
          'Gần như toàn bộ doanh thu tháng này đến từ đơn đầu tiên. Con số tháng trông đẹp mà điểm không nhích: chỉ khách mua lại được tính.',
        ),
      );
    const gifters = newBuyers.gifter + repeatOrders.gifter;
    if (gifters > 0.3 * (oneTime + 1))
      notes.push(
        tx(
          'Most of your buyers are gift buyers: the largest baskets in the market and almost no second order.',
          'Phần lớn khách của bạn là người mua quà: giỏ hàng lớn nhất thị trường và gần như không có đơn thứ hai.',
        ),
      );
    if ((d.fix.repeat ?? 0) === 0 && SS_PERSONAS.reduce((a, p) => a + c.base[p]!, 0) > 200)
      notes.push(
        tx('You have a customer base and spent nothing on Repurchase – the step the score is made of.', 'Bạn đã có tập khách mà không bỏ điểm nào vào bước Mua lại – đúng bước làm nên số điểm.'),
      );
    if (d.channel === 'agent' && (d.fix.compare ?? 0) < 3)
      notes.push(
        tx('An agent chooses by reading your specs and policy. With little on Compare there is nothing for it to read.', 'Agent chọn bằng cách đọc thông số và chính sách của bạn. Bỏ ít điểm vào bước So sánh thì nó không có gì để đọc.'),
      );

    reports[id] = {
      round,
      decision: d,
      defaulted: inputs[id]!.defaulted,
      funnel,
      newBuyers,
      repeatOrders,
      revenue: r2(revenue),
      clvGain: r2(clvGain),
      cost: r2(cost),
      best,
      second,
      insight: r2(insight),
      reveal,
      incident,
      notes,
    };
    values[id] = r2(c.clv);
    state.channel[id] = d.channel;
  }

  for (const p of SS_PERSONAS) state.pool[p] = Math.max(0, state.pool[p]! - acquired[p]! + left[p]!);
  for (const s of SS_STAGES) state.funnel[s] = r3(marketConv[s].sum / Math.max(1, marketConv[s].n));

  // The failure lands on whoever has the most customers to disappoint.
  if (round === SS_INCIDENT_ROUND && !state.incidentDone) {
    const biggest = order
      .slice()
      .sort((a, b) => SS_PERSONAS.reduce((x, p) => x + state.cos[b]!.base[p]!, 0) - SS_PERSONAS.reduce((x, p) => x + state.cos[a]!.base[p]!, 0))[0]!;
    const c = state.cos[biggest]!;
    const total = SS_PERSONAS.reduce((a, p) => a + c.base[p]!, 0);
    if (total > 50) {
      const hit = zeroPersona();
      for (const p of SS_PERSONAS) hit[p] = c.base[p]! * SS_INCIDENT_SHARE;
      c.pending = hit;
      state.incidentDone = true;
      news.push(
        tx(
          `A warehouse mix-up hit the biggest shop: ${Math.round(total * SS_INCIDENT_SHARE)} customers received the wrong goods late. Next month that company has to answer them.`,
          `Một sự cố kho rơi vào cửa hàng lớn nhất: ${Math.round(total * SS_INCIDENT_SHARE)} khách nhận sai hàng và nhận muộn. Tháng sau công ty đó phải trả lời họ.`,
        ),
      );
    }
  }

  const worst = SS_FUNNEL.slice()
    .map((s) => [s, state.funnel[s]!] as [SsStage, number])
    .sort((a, b) => a[1] - b[1])[0]!;
  news.push(
    tx(
      `Market funnel: the biggest drop-off is ${SS_STAGE_INFO[worst[0]].name.en} – only ${Math.round(worst[1] * 100)}% get through it.`,
      `Phễu của thị trường: chỗ rơi rụng lớn nhất là bước ${SS_STAGE_INFO[worst[0]].name.vi.toLowerCase()} – chỉ ${Math.round(worst[1] * 100)}% đi qua được.`,
    ),
  );
  const thin = SS_PERSONAS.slice().sort((a, b) => state.pool[a]! / SIZE[a] - state.pool[b]! / SIZE[b])[0]!;
  news.push(
    tx(
      `${SS_PERSONA_INFO[thin].name.en}: ${Math.round((state.pool[thin]! / SIZE[thin]) * 100)}% of that group still belongs to nobody.`,
      `Nhóm ${SS_PERSONA_INFO[thin].name.vi.toLowerCase()}: còn ${Math.round((state.pool[thin]! / SIZE[thin]) * 100)}% chưa thuộc về ai.`,
    ),
  );

  return { reports, values, news };
}

export function ssPub(state: SsState, order: string[]): SsPub {
  return {
    clv: Object.fromEntries(order.map((id) => [id, r2(state.cos[id]!.clv)])),
    base: Object.fromEntries(order.map((id) => [id, Math.round(SS_PERSONAS.reduce((a, p) => a + state.cos[id]!.base[p]!, 0))])),
    channel: { ...state.channel },
    funnel: { ...state.funnel },
    pool: Object.fromEntries(SS_PERSONAS.map((p) => [p, Math.round(state.pool[p]!)])) as Record<SsPersona, number>,
  };
}

/** Absolute scorecard, 0–100. */
export function ssScorecard(c: SsCo) {
  const clv = 55 * clamp(c.clv / SS_CLV_TARGET, 0, 1);
  const loyal = 25 * clamp(c.orders > 0 ? c.repeatOrders / c.orders / SS_LOYAL_TARGET : 0, 0, 1);
  const insight = 20 * (c.insightRounds ? c.insightSum / c.insightRounds : 0);
  return { total: clv + loyal + insight, parts: { clv: r1(clv), loyal: r1(loyal), insight: r1(insight) } };
}

// ───────── AI brands ─────────
function spread(points: number, weights: Partial<Record<SsStage, number>>): Record<SsStage, number> {
  const out = zeroStage();
  const entries = (Object.entries(weights) as [SsStage, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0 || points <= 0) return out;
  let rest = points;
  for (const [s, w] of entries) {
    const n = Math.min(rest, Math.floor((points * w) / total));
    out[s] = n;
    rest -= n;
  }
  if (rest > 0) {
    const [s] = entries.slice().sort((a, b) => b[1] - a[1])[0]!;
    out[s] += rest;
  }
  return out;
}

/** A rough guess at what the five rivals are worth, so a bot can estimate its own share. */
function guessRivals(state: SsState, ch: SsChannel): Record<SsPersona, number> {
  const neutral: SsDecision = { channel: ch, fix: { ...zeroStage(), [SS_CHANNEL_INFO[ch].entry]: 2 }, research: 'none', interviewOf: null, recovery: null };
  const out = zeroPersona();
  for (const p of SS_PERSONAS) out[p] = 5 * weightOf(state, neutral, p, false);
  return out;
}

/** Spends the points one at a time, each on the step that adds the most repeat value. */
function greedyPlan(
  state: SsState,
  c: SsCo,
  round: number,
  ch: SsChannel,
  points: number,
  rivals: Record<SsPersona, number>,
  fuzz?: Rng,
): { fix: Record<SsStage, number>; value: number } {
  const fix = zeroStage();
  const d: SsDecision = { channel: ch, fix, research: 'none', interviewOf: null, recovery: null };
  let value = valueOf(state, c, d, round, rivals);
  for (let i = 0; i < points; i++) {
    let bestStage: SsStage = 'repeat';
    let bestValue = -Infinity;
    let bestTrue = value;
    for (const s of SS_STAGES) {
      const v = valueOf(state, c, { ...d, fix: { ...fix, [s]: fix[s]! + 1 } }, round, rivals);
      const seen = fuzz ? v * (1 + (fuzz() - 0.5) * 0.3) : v;
      if (seen > bestValue) {
        bestValue = seen;
        bestTrue = v;
        bestStage = s;
      }
    }
    fix[bestStage] += 1;
    value = bestTrue;
  }
  return { fix, value };
}

/** The most repeat value these points could have bought, over every channel. */
function bestPossible(state: SsState, c: SsCo, round: number, points: number, rivals: Record<SsPersona, number>): number {
  return Math.max(...SS_CHANNELS.map((ch) => greedyPlan(state, c, round, ch, points, rivals).value));
}

export function ssBot(arch: SsArchetype, level: BotLevel, state: SsState, id: string, round: number, rng: Rng): SsDecision {
  const c = state.cos[id]!;
  let channel: SsChannel = 'search';
  let weights: Partial<Record<SsStage, number>> = {};
  let research: SsResearch = 'none';
  let interviewOf: SsPersona | null = null;
  let recovery: SsRecovery = 'refund';

  switch (arch) {
    case 'volume': {
      // Reads the market funnel and fixes the biggest drop-off, every month.
      channel = 'discover';
      const gaps = SS_FUNNEL.slice().sort((a, b) => state.funnel[a]! - state.funnel[b]!);
      weights = { [gaps[0]!]: 5, [gaps[1]!]: 3, [gaps[2]!]: 2 } as Partial<Record<SsStage, number>>;
      recovery = 'ignore';
      break;
    }
    case 'gifts':
      channel = 'discover';
      weights = { discover: 5, compare: 3, buy: 2 };
      recovery = 'ignore';
      break;
    case 'checkout':
      channel = 'search';
      weights = { buy: 6, search: 4 };
      break;
    case 'agentfirst':
      channel = 'agent';
      weights = { compare: 7, buy: 3 };
      break;
    case 'journey': {
      // Listens to the personas, then asks of every point what it is worth before spending it.
      // The weakest level listens to whoever is easiest to reach instead of whoever is worth keeping.
      const targets: SsPersona[] = level === 'easy' ? ['student', 'gifter', 'office'] : ['mom', 'pro', 'senior', 'office'];
      const want = targets.find((p) => !c.known[p]);
      if (want) {
        research = 'interview';
        interviewOf = want;
      } else research = 'reviews';
      const points = SS_POINTS - (research === 'interview' ? SS_INTERVIEW_COST : 0);
      const fuzz = level === 'hard' ? undefined : level === 'medium' ? rng : (() => 0.5 + (rng() - 0.5) * 2.4) as Rng;
      const plans = SS_CHANNELS.map((ch) => ({ ch, ...greedyPlan(state, c, round, ch, points, guessRivals(state, ch), fuzz) })).sort(
        (a, b) => b.value - a.value,
      );
      // Reading the journey well is not the same as reading it perfectly.
      const chosen = level === 'hard' || rng() > 0.3 ? plans[0]! : plans[1]!;
      return { channel: chosen.ch, fix: chosen.fix, research, interviewOf, recovery: c.pending ? 'care' : null };
    }
    default:
      channel = round <= 2 ? 'discover' : 'search';
      weights = { discover: 1, search: 1, compare: 1, buy: 1, review: 1, repeat: 1 };
  }
  const noise = level === 'easy' ? 1.6 : level === 'medium' ? 0.7 : 0;
  if (noise > 0) for (const s of SS_STAGES) weights[s] = (weights[s] ?? 0) + rng() * noise;
  return { channel, fix: spread(SS_POINTS, weights), research, interviewOf, recovery: c.pending ? recovery : null };
}

// ───────── validation ─────────
const E = (en: string, vi: string) => ({ en, vi });

export function validateSs(raw: unknown, _round: number, state: SsState, playerId: string): SsDecision {
  const bad = () => new GameError('bad_decision', E('Invalid plan – please check the points.', 'Kế hoạch không hợp lệ – vui lòng kiểm tra lại số điểm.'));
  if (!raw || typeof raw !== 'object') throw bad();
  const d = raw as Partial<SsDecision> & { fix?: Record<string, unknown> };
  const channel = SS_CHANNELS.includes(d.channel as SsChannel) ? (d.channel as SsChannel) : null;
  if (!channel) throw bad();
  const research = SS_RESEARCH.includes(d.research as SsResearch) ? (d.research as SsResearch) : 'none';
  if (!d.fix || typeof d.fix !== 'object') throw bad();
  const fix = zeroStage();
  let sum = 0;
  for (const s of SS_STAGES) {
    const v = Number(d.fix[s] ?? 0);
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) throw bad();
    fix[s] = v;
    sum += v;
  }
  const budget = SS_POINTS - (research === 'interview' ? SS_INTERVIEW_COST : 0);
  if (sum > budget)
    throw new GameError('too_many_points', E(`You have ${budget} points to spend, the plan uses ${sum}.`, `Bạn có ${budget} điểm, kế hoạch dùng ${sum} điểm.`));
  let interviewOf: SsPersona | null = null;
  if (research === 'interview') {
    if (!SS_PERSONAS.includes(d.interviewOf as SsPersona))
      throw new GameError('no_persona', E('Choose which persona to interview.', 'Hãy chọn chân dung khách để phỏng vấn.'));
    interviewOf = d.interviewOf as SsPersona;
  }
  const c = state.cos[playerId]!;
  let recovery: SsRecovery | null = null;
  if (c.pending) {
    if (!SS_RECOVERY.includes(d.recovery as SsRecovery))
      throw new GameError('no_recovery', E('Decide what to do about the failed deliveries.', 'Hãy quyết định xử lý những đơn giao lỗi.'));
    recovery = d.recovery as SsRecovery;
  }
  return { channel, fix, research, interviewOf, recovery };
}

export function ssBadges(state: SsState, id: string, order: string[]): string[] {
  const c = state.cos[id]!;
  const out: string[] = [];
  if (c.orders > 0 && c.repeatOrders / c.orders >= 0.5) out.push('loyalist');
  if (c.recovered) out.push('recoverer');
  if (SS_PERSONAS.filter((p) => c.known[p]).length >= 4) out.push('listener');
  if (c.insightRounds && c.insightSum / c.insightRounds >= 0.7) out.push('sniper');
  const proLeader = order.slice().sort((a, b) => state.cos[b]!.base.pro - state.cos[a]!.base.pro)[0];
  if (proLeader === id && c.base.pro >= 400) out.push('wholesale');
  if (order.slice().sort((a, b) => state.cos[b]!.clv - state.cos[a]!.clv)[0] === id) out.push('leader');
  return out;
}

export const SHOPPER_STREAM: RsGame<SsDecision, SsState, SsReport, SsView> = {
  id: 'shopper-stream',
  rounds: SS_ROUNDS,
  label: 'Shopper Stream',
  // Neutral shop names: names are handed out by seat and archetypes at random, so a name
  // must never hint at the strategy behind it.
  botNames: ['NhaXanh', 'ChoMai', 'BupSen', 'HaiAu', 'AnKhang', 'ThaoNguyen'],
  archetypes: ['volume', 'gifts', 'checkout', 'spread', 'agentfirst', 'journey'],
  defaultSettings: { decideSec: 240, resultsSec: 0, botLevel: 'medium', fillBots: true },
  init: (order, _room, rng) => initSs(order, rng),
  validate: (raw, round, state, playerId) => validateSs(raw, round, state, playerId),
  // No plan submitted: nothing is improved this month and a failure is left unanswered.
  fallback: (state, playerId, _round, last) => ({
    channel: (last as SsDecision | undefined)?.channel ?? 'search',
    fix: zeroStage(),
    research: 'none',
    interviewOf: null,
    recovery: state.cos[playerId]!.pending ? 'ignore' : null,
  }),
  bot: (arch, level, state, id, round, rng) => ssBot(arch as SsArchetype, level, state, id, round, rng),
  simulate: (state, order, inputs, round) => {
    const out = simulateSs(state, order, inputs, round);
    return { ...out, pub: ssPub(state, order) as unknown as Record<string, unknown> };
  },
  scorecard: (state, id) => ssScorecard(state.cos[id]!),
  cols: (state, id) => {
    const c = state.cos[id]!;
    return {
      clv: r2(c.clv),
      base: Math.round(SS_PERSONAS.reduce((a, p) => a + c.base[p]!, 0)),
      orders: Math.round(c.orders),
      loyal: c.orders > 0 ? r2(c.repeatOrders / c.orders) : 0,
    };
  },
  view: (state, id, _round, _finished) => {
    const c = state.cos[id]!;
    const pendingTotal = c.pending ? SS_PERSONAS.reduce((a, p) => a + c.pending![p]!, 0) : 0;
    const pendingValue = c.pending ? SS_PERSONAS.reduce((a, p) => a + (c.pending![p]! * SS_PERSONA_INFO[p].aov) / 1e6, 0) : 0;
    return {
      clv: r2(c.clv),
      revenue: r2(c.revenue),
      orders: Math.round(c.orders),
      repeatOrders: Math.round(c.repeatOrders),
      base: Object.fromEntries(SS_PERSONAS.map((p) => [p, Math.round(c.base[p]!)])) as Record<SsPersona, number>,
      reviews: r1(c.reviews),
      sat: r2(c.sat),
      known: Object.fromEntries(SS_PERSONAS.map((p) => [p, c.known[p] ? ssInsightOf(state, p) : null])) as Record<SsPersona, SsInsight | null>,
      funnel: { ...state.funnel },
      incident: c.pending ? { customers: Math.round(pendingTotal), refund: r2(pendingValue), care: r2(pendingValue * 1.45) } : null,
      points: SS_POINTS,
    };
  },
  badges: ssBadges,
  pub: (state, order) => ssPub(state, order) as unknown as Record<string, unknown>,
};
