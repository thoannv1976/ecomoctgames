// Game 1 – Wave Rider: the hidden fit matrix between business models and each wave's
// infrastructure, the crowding model, the manager-numbers questions and the scorecard (server only).
import { GameError } from '../room.js';
import { shuffle, type Rng } from '../rng.js';
import type { RsGame, RsInput } from '../rs/room.js';
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';
import {
  WR_BONUS_CHIPS,
  WR_MODELS,
  WR_MODEL_INFO,
  WR_QUIZ_POINT,
  WR_ROUNDS,
  WR_START_CHIPS,
  type WrArchetype,
  type WrDecision,
  type WrModel,
  type WrModelResult,
  type WrPub,
  type WrQuestion,
  type WrReport,
  type WrView,
} from './types.js';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Vietnamese decimal comma. */
const vn = (v: number) => String(v).replace('.', ',');

// ───────── hidden model ─────────
/** Gross return of one chip in each model, by wave (index 0 = wave 1). Tuned with scripts/balance-wr.ts. */
const BASE_FIT: Record<WrModel, number[]> = {
  web: [1.45, 1.22, 1.06, 0.96, 0.9],
  seller: [0.78, 1.52, 1.42, 1.16, 1.06],
  social: [0.7, 1.12, 1.56, 1.34, 1.14],
  live: [0.55, 0.72, 1.22, 1.72, 1.3],
  app: [0.58, 0.74, 1.02, 1.36, 1.56],
  agent: [0.5, 0.56, 0.72, 1.06, 1.88],
};
/** Chips the market can absorb before the extra return is shared away. */
const CROWD_CAP = 12;
/** Chips of past experience that give the full head start. */
const EXP_FULL = 8;
const EXP_BONUS = 0.3;
const EXP_DECAY = 0.7;

export interface WrCo {
  capital: number;
  exp: Record<WrModel, number>;
  right: number;
  /** Share of chips placed on a model that rises next wave, summed over waves 1–4. */
  risingSum: number;
  risingRounds: number;
  lossRounds: number;
  peak: number;
  aloneRounds: number;
  earlyRounds: number;
}

export interface WrQ extends WrQuestion {
  correct: number;
  explain: T;
}

export interface WrState {
  cos: Record<string, WrCo>;
  fit: Record<WrModel, number[]>;
  questions: WrQ[];
  /** Best-returning model of the last wave and of the one before (what the herd follows). */
  lastBest: WrModel | null;
  prevBest: WrModel | null;
  crowd: Record<WrModel, number>;
}

const zeroChips = (): Record<WrModel, number> => ({ web: 0, seller: 0, social: 0, live: 0, app: 0, agent: 0 });

// ───────── manager-numbers questions (fresh numbers per game) ─────────
function mkQuestions(rng: Rng): WrQ[] {
  const pick = <X>(xs: readonly X[]): X => xs[Math.floor(rng() * xs.length)]!;
  const opt = (correct: T, wrong: T[]): { options: T[]; correct: number } => {
    const all = shuffle(rng, [correct, ...wrong]);
    return { options: all, correct: all.indexOf(correct) };
  };

  // 1 – the classification criterion is the channel through which the order is formed.
  const q1 = (() => {
    const c = pick([
      {
        prompt: tx(
          'A customer orders on a marketplace app and chooses cash on delivery. The goods arrive by motorbike. Is this e-commerce?',
          'Khách đặt hàng trên ứng dụng của sàn và chọn trả tiền khi nhận (COD). Hàng được giao bằng xe máy. Đây có phải thương mại điện tử?',
        ),
        right: tx('Yes – the test is the channel the order was formed through, not how it is paid or delivered.', 'Có – tiêu chí là kênh hình thành đơn hàng, không phải cách trả tiền hay cách giao hàng.'),
      },
      {
        prompt: tx(
          'A customer buys a laptop on a website and collects it at the shop. Is this e-commerce?',
          'Khách mua laptop trên website rồi đến cửa hàng nhận. Đây có phải thương mại điện tử?',
        ),
        right: tx('Yes – the order was formed over a computer network; collection in person does not change that.', 'Có – đơn hàng được hình thành qua mạng; nhận hàng trực tiếp không làm thay đổi điều đó.'),
      },
    ]);
    const { options, correct } = opt(c.right, [
      tx('No – payment was not made online.', 'Không – vì chưa thanh toán trực tuyến.'),
      tx('No – the goods did not move digitally.', 'Không – vì hàng không được giao qua mạng.'),
      tx('Only if the customer pays with an e-wallet.', 'Chỉ tính nếu khách trả bằng ví điện tử.'),
    ]);
    return {
      id: 'order-channel',
      prompt: c.prompt,
      options,
      correct,
      explain: tx(
        'E-commerce is defined by the ordering process: an order placed over a computer network counts, whatever the payment or delivery method.',
        'Thương mại điện tử được định nghĩa theo quá trình đặt hàng: đơn hàng hình thành qua mạng là tính, bất kể cách thanh toán hay giao hàng.',
      ),
    };
  })();

  // 2 – take rate = platform revenue / GMV.
  const q2 = (() => {
    const gmv = pick([80, 100, 120, 150, 200]);
    const take = pick([6, 8, 9, 12]);
    const rev = r1((gmv * take) / 100);
    const { options, correct } = opt(tx(`${take}%`, `${take}%`), [
      tx(`${r1(take * 1.5)}%`, `${vn(r1(take * 1.5))}%`),
      tx(`${r1(gmv / rev)}%`, `${vn(r1(gmv / rev))}%`),
      tx(`${r1(take / 2)}%`, `${vn(r1(take / 2))}%`),
    ]);
    return {
      id: 'take-rate',
      prompt: tx(
        `A marketplace transacted VND ${gmv} bn of goods this month and recorded VND ${vn(rev)} bn of transaction revenue. What is its take rate?`,
        `Tháng này một sàn có tổng giá trị hàng hóa giao dịch ${gmv} tỷ đồng và ghi nhận ${vn(rev)} tỷ đồng doanh thu giao dịch. Take rate của sàn là bao nhiêu?`,
      ),
      options,
      correct,
      explain: tx(`Take rate = revenue / GMV = ${vn(rev)} / ${gmv} = ${take}%.`, `Take rate = doanh thu / GMV = ${vn(rev)} / ${gmv} = ${take}%.`),
    };
  })();

  // 3 – GMV is not revenue.
  const q3 = (() => {
    const gmv = pick([60, 90, 120, 180]);
    const take = pick([5, 8, 10, 12]);
    const rev = r1((gmv * take) / 100);
    const { options, correct } = opt(tx(`VND ${vn(rev)} bn`, `${vn(rev)} tỷ đồng`), [
      tx(`VND ${gmv} bn`, `${gmv} tỷ đồng`),
      tx(`VND ${vn(r1(gmv - rev))} bn`, `${vn(r1(gmv - rev))} tỷ đồng`),
      tx(`VND ${vn(r1(rev * 2))} bn`, `${vn(r1(rev * 2))} tỷ đồng`),
    ]);
    return {
      id: 'gmv-not-revenue',
      prompt: tx(
        `A newspaper writes: “platform X had revenue of VND ${gmv} bn last month”. In fact that figure is the total value of goods transacted, and the platform collects ${take}% of it. What is the platform’s actual revenue?`,
        `Một bài báo viết: “tháng trước doanh thu sàn X đạt ${gmv} tỷ đồng”. Thực ra đó là tổng giá trị hàng hóa giao dịch, và sàn thu ${take}% trên đó. Doanh thu thật của sàn là bao nhiêu?`,
      ),
      options,
      correct,
      explain: tx(
        `GMV ≠ revenue: ${gmv} × ${take}% = VND ${vn(rev)} bn. And revenue is not profit either – operating costs still come out of it.`,
        `GMV ≠ doanh thu: ${gmv} × ${take}% = ${vn(rev)} tỷ đồng. Và doanh thu cũng chưa phải lợi nhuận – còn phải trừ chi phí vận hành.`,
      ),
    };
  })();

  // 4 – what returns really cost per order.
  const q4 = (() => {
    const ship = pick([20, 25, 30]);
    const rate = pick([6, 8, 10, 12]);
    const cost = r1((2 * ship * rate) / 100);
    const { options, correct } = opt(tx(`about VND ${vn(cost)}k`, `khoảng ${vn(cost)} nghìn`), [
      tx(`about VND ${vn(r1(cost / 2))}k`, `khoảng ${vn(r1(cost / 2))} nghìn`),
      tx(`about VND ${2 * ship}k`, `khoảng ${2 * ship} nghìn`),
      tx(`about VND ${vn(r1(cost * 5))}k`, `khoảng ${vn(r1(cost * 5))} nghìn`),
    ]);
    return {
      id: 'cod-returns',
      prompt: tx(
        `Delivery costs VND ${ship}k per order one way, and ${rate}% of orders come back – a returned order pays the fee both ways. Spread over every order shipped, how much does the return rate cost per order?`,
        `Phí giao hàng ${ship} nghìn đồng một chiều, và ${rate}% đơn bị hoàn – đơn hoàn phải trả phí cả hai chiều. Tính bình quân trên mọi đơn gửi đi, tỷ lệ hoàn làm mất bao nhiêu mỗi đơn?`,
      ),
      options,
      correct,
      explain: tx(
        `2 × ${ship}k × ${rate}% = VND ${vn(cost)}k per order, before packaging and shrinkage. One percentage point of return rate can matter more than a whole promotion.`,
        `2 × ${ship} nghìn × ${rate}% = ${vn(cost)} nghìn mỗi đơn, chưa tính bao bì và hàng hư. Một điểm phần trăm tỷ lệ hoàn có thể đáng hơn cả một chiến dịch khuyến mãi.`,
      ),
    };
  })();

  // 5 – AI-assisted vs AI-driven vs Agentic: where the decision right sits.
  const q5 = (() => {
    const c = pick([
      {
        prompt: tx(
          'A manager sets the objective and the cost ceiling; the system then decides, case by case and in real time, how to spend the advertising budget. Which level of AI commerce is this?',
          'Người quản lý đặt mục tiêu và ngưỡng chi phí; hệ thống tự quyết từng trường hợp theo thời gian thực để phân bổ ngân sách quảng cáo. Đây là mức nào của AI commerce?',
        ),
        right: tx('AI-driven – people decide the rules, the system decides each case.', 'AI-driven – người quyết luật chơi, hệ thống quyết từng trường hợp.'),
      },
      {
        prompt: tx(
          'AI drafts the product descriptions and suggests prices, but a person still approves every item. Which level of AI commerce is this?',
          'AI viết mô tả sản phẩm và gợi ý giá, nhưng người vẫn duyệt từng món. Đây là mức nào của AI commerce?',
        ),
        right: tx('AI-assisted – people still decide each item; AI only saves time.', 'AI-assisted – người vẫn quyết từng món; AI chỉ giúp tiết kiệm thời gian.'),
      },
      {
        prompt: tx(
          'The customer states only the final goal and grants authority to act; the software searches sellers, compares, checks stock and completes the purchase. Which level of AI commerce is this?',
          'Khách chỉ nêu mục tiêu cuối cùng và cấp quyền hành động; phần mềm tự tìm người bán, so sánh, kiểm tra tồn kho và hoàn tất việc mua. Đây là mức nào của AI commerce?',
        ),
        right: tx('Agentic – the person grants authority, the agent acts.', 'Agentic – người cấp quyền, agent tự hành động.'),
      },
    ]);
    const all: T[] = [
      tx('AI-assisted – people still decide each item; AI only saves time.', 'AI-assisted – người vẫn quyết từng món; AI chỉ giúp tiết kiệm thời gian.'),
      tx('AI-driven – people decide the rules, the system decides each case.', 'AI-driven – người quyết luật chơi, hệ thống quyết từng trường hợp.'),
      tx('Agentic – the person grants authority, the agent acts.', 'Agentic – người cấp quyền, agent tự hành động.'),
      tx('None of these – this is ordinary automation, not AI commerce.', 'Không mức nào – đây chỉ là tự động hóa thông thường.'),
    ];
    const options = shuffle(rng, all);
    return {
      id: 'ai-levels',
      prompt: c.prompt,
      options,
      correct: options.findIndex((o) => o.en === c.right.en),
      explain: tx(
        'The three levels differ in one variable: where the decision right sits – each item (assisted), the rules (driven), or the final objective (agentic).',
        'Ba mức khác nhau ở một biến duy nhất: quyền quyết định nằm ở đâu – từng món (assisted), luật chơi (driven), hay mục tiêu cuối (agentic).',
      ),
    };
  })();

  return [q1, q2, q3, q4, q5];
}

export function initWr(order: string[], rng: Rng): WrState {
  const cos: Record<string, WrCo> = {};
  for (const id of order)
    cos[id] = { capital: WR_START_CHIPS, exp: zeroChips(), right: 0, risingSum: 0, risingRounds: 0, lossRounds: 0, peak: WR_START_CHIPS, aloneRounds: 0, earlyRounds: 0 };
  // A little jitter so two games are never identical, never enough to change the lesson.
  const fit = {} as Record<WrModel, number[]>;
  for (const m of WR_MODELS) fit[m] = BASE_FIT[m].map((v) => r3(v * (1 + (rng() - 0.5) * 0.06)));
  return { cos, fit, questions: mkQuestions(rng), lastBest: null, prevBest: null, crowd: zeroChips() };
}

/** Does this model earn more in the next wave than in this one? */
const rises = (state: WrState, m: WrModel, round: number) => round < WR_ROUNDS && state.fit[m][round]! > state.fit[m][round - 1]!;

/** The wave (1-based) in which this model pays best. */
function peakWave(state: WrState, m: WrModel): number {
  let best = 0;
  for (let i = 1; i < WR_ROUNDS; i++) if (state.fit[m][i]! > state.fit[m][best]!) best = i;
  return best + 1;
}
/** Riding the wave: the infrastructure already carries this model and its best wave has not passed. */
const onTheWayUp = (state: WrState, m: WrModel, round: number) => state.fit[m][round - 1]! >= 0.95 && round <= peakWave(state, m);

export const wrChipsOf = (c: WrCo) => Math.max(0, Math.floor(c.capital));

export function simulateWr(state: WrState, order: string[], inputs: Record<string, RsInput<WrDecision>>, round: number) {
  const q = state.questions[round - 1]!;
  const crowd = zeroChips();
  for (const id of order) for (const m of WR_MODELS) crowd[m] += inputs[id]!.decision.chips[m] ?? 0;

  const reports: Record<string, WrReport> = {};
  const values: Record<string, number> = {};
  const gain: Record<WrModel, { chips: number; profit: number }> = {
    web: { chips: 0, profit: 0 },
    seller: { chips: 0, profit: 0 },
    social: { chips: 0, profit: 0 },
    live: { chips: 0, profit: 0 },
    app: { chips: 0, profit: 0 },
    agent: { chips: 0, profit: 0 },
  };

  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    const chipsBefore = wrChipsOf(c);
    const notes: T[] = [];
    const models = {} as Record<WrModel, WrModelResult>;
    let placed = 0;
    let back = 0;
    let rising = 0;
    for (const m of WR_MODELS) {
      const chips = clamp(Math.floor(d.chips[m] ?? 0), 0, chipsBefore);
      placed += chips;
      const gross = state.fit[m][round - 1]!;
      const early = 1 + EXP_BONUS * Math.min(1, c.exp[m] / EXP_FULL);
      const mult = gross >= 1 ? 1 + (gross - 1) * (CROWD_CAP / (CROWD_CAP + crowd[m])) * early : gross;
      models[m] = { chips, mult: r3(mult), crowd: crowd[m], earlyBonus: r3(early - 1) };
      back += chips * mult;
      if (onTheWayUp(state, m, round)) rising += chips;
      if (chips > 0) {
        gain[m].chips += chips;
        gain[m].profit += chips * (mult - 1);
      }
    }
    const cash = Math.max(0, c.capital - placed);
    const before = c.capital;
    c.capital = cash + back;
    // Experience decays but never disappears: a wave you rode is a capability you keep.
    for (const m of WR_MODELS) c.exp[m] = r2(c.exp[m] * EXP_DECAY + models[m].chips);
    if (placed > 0) {
      c.risingSum += rising / placed;
      c.risingRounds++;
    }
    if (c.capital < before) c.lossRounds++;
    c.peak = Math.max(c.peak, c.capital);
    const top = WR_MODELS.slice().sort((a, b) => models[b].chips - models[a].chips)[0]!;
    const avgCrowd = Object.values(crowd).reduce((a, b) => a + b, 0) / WR_MODELS.length;
    if (models[top].chips > 0 && crowd[top] < avgCrowd) c.aloneRounds++;
    if (WR_MODELS.some((m) => models[m].chips >= 2 && rises(state, m, round) && state.fit[m][round - 1]! >= 0.95)) c.earlyRounds++;

    const answer = d.answer;
    const right = answer === null || answer === undefined ? null : answer === q.correct;
    if (right) {
      c.right++;
      if (round < WR_ROUNDS) c.capital += WR_BONUS_CHIPS;
    }

    // Coaching notes: the lesson, not the formula.
    const crowdedTop = models[top].chips > 0 && crowd[top] >= 2.5 * CROWD_CAP;
    if (crowdedTop)
      notes.push(
        tx(
          `Everybody piled into ${WR_MODEL_INFO[top].name.en} this wave (${crowd[top]} chips): the extra return was shared away and you mostly got your money back.`,
          `Cả thị trường đổ vào ${WR_MODEL_INFO[top].name.vi.toLowerCase()} trong làn sóng này (${crowd[top]} chip): phần lãi bị chia hết, bạn gần như chỉ lấy lại vốn.`,
        ),
      );
    const tooEarly = WR_MODELS.filter((m) => models[m].chips >= 2 && state.fit[m][round - 1]! < 0.85);
    if (tooEarly.length)
      notes.push(
        tx(
          `${tooEarly.map((m) => WR_MODEL_INFO[m].name.en).join(', ')}: the infrastructure this model needs (${tooEarly.map((m) => WR_MODEL_INFO[m].needs.en).join('; ')}) is not there yet – two steps early costs as much as one step late.`,
          `${tooEarly.map((m) => WR_MODEL_INFO[m].name.vi).join(', ')}: hạ tầng mà mô hình này cần (${tooEarly.map((m) => WR_MODEL_INFO[m].needs.vi.toLowerCase()).join('; ')}) chưa có – đi sớm hai bước tốn kém như đi muộn một bước.`,
        ),
      );
    const earned = WR_MODELS.filter((m) => models[m].earlyBonus > 0.05 && models[m].chips > 0);
    if (earned.length)
      notes.push(
        tx(
          `Head start: you already knew ${earned.map((m) => WR_MODEL_INFO[m].name.en).join(', ')} from earlier waves, which added ${Math.round(Math.max(...earned.map((m) => models[m].earlyBonus)) * 100)}% to the upside.`,
          `Lợi thế đi trước: bạn đã làm ${earned.map((m) => WR_MODEL_INFO[m].name.vi.toLowerCase()).join(', ')} từ các làn sóng trước, nhờ đó phần lãi tăng thêm ${Math.round(Math.max(...earned.map((m) => models[m].earlyBonus)) * 100)}%.`,
        ),
      );
    if (cash >= 0.3 * before)
      notes.push(tx(`You kept ${r1(cash)} chips in cash – safe, but cash does not ride a wave.`, `Bạn giữ ${vn(r1(cash))} chip tiền mặt – an toàn, nhưng tiền mặt không đón được sóng.`));

    reports[id] = {
      round,
      decision: d,
      defaulted: inputs[id]!.defaulted,
      wave: round,
      models,
      cash: r1(cash),
      chipsBefore,
      chipsAfter: wrChipsOf(c),
      answerRight: right,
      correct: q.correct,
      explain: q.explain,
      notes,
    };
    values[id] = r1(c.capital);
  }

  const ranked = WR_MODELS.filter((m) => gain[m].chips >= 2).sort((a, b) => gain[b].profit / gain[b].chips - gain[a].profit / gain[a].chips);
  state.prevBest = state.lastBest;
  state.lastBest = ranked[0] ?? null;
  state.crowd = crowd;

  const news: T[] = [];
  if (state.lastBest) {
    const b = state.lastBest;
    news.push(
      tx(
        `Best wave for ${WR_MODEL_INFO[b].name.en}: one chip came back as ${vn(r2(1 + gain[b].profit / gain[b].chips))}. The market placed ${crowd[b]} chips there.`,
        `Làn sóng này ${WR_MODEL_INFO[b].name.vi.toLowerCase()} lãi nhất: một chip quay về thành ${vn(r2(1 + gain[b].profit / gain[b].chips))} chip. Thị trường đã đặt ${crowd[b]} chip vào đó.`,
      ),
    );
  }
  const worst = WR_MODELS.filter((m) => gain[m].chips >= 2).sort((a, b) => gain[a].profit / gain[a].chips - gain[b].profit / gain[b].chips)[0];
  if (worst && gain[worst].profit < 0)
    news.push(
      tx(
        `${WR_MODEL_INFO[worst].name.en} lost money this wave: the layers it needs are missing.`,
        `${WR_MODEL_INFO[worst].name.vi} lỗ trong làn sóng này: các lớp hạ tầng nó cần còn thiếu.`,
      ),
    );
  return { reports, values, news };
}

export function wrPub(state: WrState, order: string[]): WrPub {
  return {
    capital: Object.fromEntries(order.map((id) => [id, r1(state.cos[id]!.capital)])),
    crowd: { ...state.crowd },
    best: state.lastBest,
  };
}

/** Absolute scorecard, 0–100. */
export function wrScorecard(c: WrCo) {
  const capital = 60 * clamp((c.capital / WR_START_CHIPS - 1) / 2.5, 0, 1);
  const timing = 25 * (c.risingRounds ? c.risingSum / c.risingRounds : 0);
  const quiz = Math.min(15, c.right * WR_QUIZ_POINT);
  return { total: capital + timing + quiz, parts: { capital: r1(capital), timing: r1(timing), quiz: r1(quiz) } };
}

// ───────── AI founders ─────────
function spread(chips: number, weights: Partial<Record<WrModel, number>>): Record<WrModel, number> {
  const out = zeroChips();
  const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
  if (total <= 0 || chips <= 0) return out;
  let left = chips;
  const entries = Object.entries(weights) as [WrModel, number][];
  for (const [m, w] of entries) {
    const n = Math.min(left, Math.floor((chips * w) / total));
    out[m] = n;
    left -= n;
  }
  if (left > 0) {
    const [m] = entries.slice().sort((a, b) => b[1] - a[1])[0]!;
    out[m] += left;
  }
  return out;
}

/** The model whose fit grows most from this wave to the next. */
function nextWinner(state: WrState, round: number): WrModel {
  if (round >= WR_ROUNDS) return WR_MODELS.slice().sort((a, b) => state.fit[b][round - 1]! - state.fit[a][round - 1]!)[0]!;
  return WR_MODELS.slice().sort((a, b) => state.fit[b][round]! - state.fit[a][round]!)[0]!;
}

export function wrBot(arch: WrArchetype, level: BotLevel, state: WrState, c: WrCo, round: number, rng: Rng): WrDecision {
  const chips = wrChipsOf(c);
  let weights: Partial<Record<WrModel, number>> = {};
  let hold = 0;
  switch (arch) {
    case 'web':
      weights = { web: 4, seller: 1 };
      break;
    case 'live':
      weights = { live: 4, social: 1 };
      break;
    case 'trend': {
      // Chases whatever paid best last wave: arrives exactly when everybody else does.
      const b = state.lastBest ?? 'web';
      weights = { [b]: 5, seller: 1 } as Partial<Record<WrModel, number>>;
      break;
    }
    case 'late': {
      const b = state.prevBest ?? 'web';
      weights = { [b]: 4, web: 1 } as Partial<Record<WrModel, number>>;
      break;
    }
    case 'reader': {
      // Reads the infrastructure: most chips on what this wave carries, a stake on the next wave's winner,
      // and some cash kept back. It judges from the same signals a student has, so it is often wrong.
      const now = WR_MODELS.slice().sort((a, b) => state.fit[b][round - 1]! - state.fit[a][round - 1]!);
      // It reads the same public signals a student has, so one time in three it backs the wrong next wave.
      const next = rng() < 0.35 ? WR_MODELS[Math.floor(rng() * WR_MODELS.length)]! : nextWinner(state, round);
      weights = { [now[0]!]: 3, [now[1]!]: 1.2 } as Partial<Record<WrModel, number>>;
      weights[next] = (weights[next] ?? 0) + 2;
      for (const m of WR_MODELS) weights[m] = (weights[m] ?? 0) + rng() * 1.8;
      hold = round === WR_ROUNDS ? 0 : 2;
      break;
    }
    default:
      weights = { web: 1, seller: 1, social: 1, live: 1, app: 1, agent: 1 };
  }
  const noise = level === 'easy' ? 1 : level === 'medium' ? 0.4 : 0;
  if (noise > 0) for (const m of WR_MODELS) weights[m] = (weights[m] ?? 0) + rng() * 2 * noise;
  const acc = level === 'hard' ? 0.85 : level === 'medium' ? 0.6 : 0.35;
  const q = state.questions[round - 1]!;
  const answer = rng() < acc ? q.correct : Math.floor(rng() * q.options.length);
  return { chips: spread(Math.max(0, chips - hold), weights), answer };
}

// ───────── validation ─────────
const E = (en: string, vi: string) => ({ en, vi });

function cleanWr(d: WrDecision, chipsAvailable: number, optionCount: number): WrDecision {
  const chips = zeroChips();
  let left = chipsAvailable;
  for (const m of WR_MODELS) {
    const n = Math.max(0, Math.floor(Number(d.chips?.[m]) || 0));
    chips[m] = Math.min(n, left);
    left -= chips[m];
  }
  // Number(null) is 0, so an unanswered question must never go through Number().
  const a = d.answer === null || d.answer === undefined ? NaN : Number(d.answer);
  return { chips, answer: Number.isInteger(a) && a >= 0 && a < optionCount ? a : null };
}

export function validateWr(raw: unknown, round: number, state: WrState, playerId: string): WrDecision {
  const bad = () => new GameError('bad_decision', E('Invalid plan – please check the chips.', 'Kế hoạch không hợp lệ – vui lòng kiểm tra lại số chip.'));
  if (!raw || typeof raw !== 'object') throw bad();
  const d = raw as { chips?: Record<string, unknown>; answer?: unknown };
  if (!d.chips || typeof d.chips !== 'object') throw bad();
  const chipsAvailable = wrChipsOf(state.cos[playerId]!);
  let sum = 0;
  for (const m of WR_MODELS) {
    const v = Number(d.chips[m] ?? 0);
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) throw bad();
    sum += v;
  }
  if (sum > chipsAvailable)
    throw new GameError(
      'too_many_chips',
      E(`You have ${chipsAvailable} chips, the plan uses ${sum}.`, `Bạn có ${chipsAvailable} chip, kế hoạch dùng ${sum} chip.`),
    );
  return cleanWr(d as WrDecision, chipsAvailable, state.questions[round - 1]!.options.length);
}

export function wrBadges(state: WrState, id: string, order: string[]): string[] {
  const c = state.cos[id]!;
  const out: string[] = [];
  if (c.earlyRounds >= 2) out.push('surfer');
  if (c.capital >= 3 * WR_START_CHIPS) out.push('grower');
  if (c.aloneRounds >= 3) out.push('contrarian');
  if (c.right === WR_ROUNDS) out.push('analyst');
  if (c.lossRounds === 0) out.push('survivor');
  const byCapital = order.slice().sort((a, b) => state.cos[b]!.capital - state.cos[a]!.capital);
  if (byCapital[0] === id) out.push('leader');
  return out;
}

export const WAVE_RIDER: RsGame<WrDecision, WrState, WrReport, WrView> = {
  id: 'wave-rider',
  rounds: WR_ROUNDS,
  label: 'Wave Rider',
  botNames: ['ChoRaoVat', 'MuaChung', 'SanDau', 'LiveHoa', 'AppXanh', 'AgentBot'],
  archetypes: ['trend', 'web', 'live', 'balanced', 'late', 'reader'],
  defaultSettings: { decideSec: 180, resultsSec: 0, botLevel: 'medium', fillBots: true },
  init: (order, _room, rng) => initWr(order, rng),
  validate: (raw, round, state, playerId) => validateWr(raw, round, state, playerId),
  // No plan submitted: the chips stay in cash and no question is answered.
  fallback: () => ({ chips: zeroChips(), answer: null }),
  bot: (arch, level, state, id, round, rng) => wrBot(arch as WrArchetype, level, state, state.cos[id]!, round, rng),
  simulate: (state, order, inputs, round) => {
    const out = simulateWr(state, order, inputs, round);
    return { ...out, pub: wrPub(state, order) as unknown as Record<string, unknown> };
  },
  scorecard: (state, id) => wrScorecard(state.cos[id]!),
  cols: (state, id) => {
    const c = state.cos[id]!;
    return { capital: r1(c.capital), right: c.right, early: c.earlyRounds, peak: r1(c.peak) };
  },
  view: (state, id, round, finished) => {
    const c = state.cos[id]!;
    const q = state.questions[round - 1];
    return {
      capital: r1(c.capital),
      chips: wrChipsOf(c),
      experience: Object.fromEntries(WR_MODELS.map((m) => [m, c.exp[m]])) as Record<WrModel, number>,
      right: c.right,
      question: q && !finished ? { id: q.id, prompt: q.prompt, options: q.options } : null,
    };
  },
  badges: wrBadges,
  pub: (state, order) => wrPub(state, order) as unknown as Record<string, unknown>,
};
