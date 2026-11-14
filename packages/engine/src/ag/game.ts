// Game 10 – Agent Arena: how an AI agent ranks a seller, the planted risks of running
// automated systems without controls, and what a dashboard without a control group reports (server only).
import { GameError } from '../room.js';
import type { Rng } from '../rng.js';
import type { RsGame, RsInput } from '../rs/room.js';
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';
import {
  AG_AGENT_SHARE,
  AG_AGENT_MARGIN,
  AG_AOV,
  AG_AX,
  AG_CAPS,
  AG_CAP_INFO,
  AG_GUARDS,
  AG_GUARD_INFO,
  AG_HANDOVERS,
  AG_HANDOVER_INFO,
  AG_LEVEL_COST,
  AG_MARGIN,
  AG_MAX_LEVEL,
  AG_OPEX,
  AG_ORDERS,
  AG_POINTS,
  AG_PROFIT_TARGET,
  AG_ROUNDS,
  type AgArchetype,
  type AgCap,
  type AgDecision,
  type AgGuard,
  type AgHandover,
  type AgPub,
  type AgReport,
  type AgRisk,
  type AgView,
} from './types.js';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** VND m to VND bn. */
const bn = (m: number) => r2(m / 1000);
const vn = (v: number) => String(v).replace('.', ',');
const zeroCaps = (): Record<AgCap, number> => ({ catalog: 0, stock: 0, price: 0, policy: 0, api: 0, reco: 0, bot: 0, trust: 0 });

// ───────── hidden model ─────────
/** How an agent weighs a seller. Sums to 1. */
const AGENT_W: Record<AgCap, number> = { catalog: 0.28, price: 0.22, stock: 0.18, policy: 0.16, trust: 0.16, api: 0, reco: 0, bot: 0 };
/** Without an ordering API an agent can recommend you but not buy from you. */
const API_GATE = [0, 0.55, 0.85, 1];
/** How sharply the two segments concentrate demand on the best-looking seller. */
const AGENT_EXPO = 2.5;
const HUMAN_EXPO = 1.3;
/** Even a shop that builds nothing still gets walk-in human traffic. */
const HUMAN_FLOOR = 0.06;
/** Share of the recommender's reported lift that the customer would have bought anyway. */
const CANNIB_LOOSE = 0.45;
const CANNIB_TIGHT = 0.3;
/** A control group costs you a tenth of the real lift. */
const HOLDOUT_COST = 0.1;
/** Cost of capital and slow stock when the catalogue concentrates, VND m per quarter at full concentration. */
const CONCENTRATION_COST = 320;

export interface AgCo {
  levels: Record<AgCap, number>;
  /** Cumulative, VND m. */
  profit: number;
  revenue: number;
  /** Trust damage still being carried, 0–1. */
  scar: number;
  concentration: number;
  controlSum: number;
  controlRounds: number;
  agentSum: number;
  agentDen: number;
  holdoutEver: boolean;
  holdoutRounds: number;
  govFails: number;
  lossRounds: number;
  /** AX levels held by the end of quarter 2. */
  earlyAx: number;
}

export interface AgState {
  cos: Record<string, AgCo>;
  /** Per-room jitter on the agent's weights – never enough to change what matters. */
  w: Record<AgCap, number>;
  market: Record<AgCap, number>;
  unmet: number;
}

export function initAg(order: string[], rng: Rng): AgState {
  const cos: Record<string, AgCo> = {};
  for (const id of order)
    cos[id] = {
      levels: zeroCaps(),
      profit: 0,
      revenue: 0,
      scar: 0,
      concentration: 0,
      controlSum: 0,
      controlRounds: 0,
      agentSum: 0,
      agentDen: 0,
      holdoutEver: false,
      holdoutRounds: 0,
      govFails: 0,
      lossRounds: 0,
      earlyAx: 0,
    };
  const w = zeroCaps();
  for (const c of AG_CAPS) w[c] = r3(AGENT_W[c] * (1 + (rng() - 0.5) * 0.08));
  return { cos, w, market: zeroCaps(), unmet: 0 };
}

const lv = (c: AgCo, cap: AgCap) => c.levels[cap] / AG_MAX_LEVEL;

/** What an AI agent sees: readable data, total cost, availability, policies and a delivery record. */
function agentScore(state: AgState, c: AgCo): number {
  const trust = lv(c, 'trust') * (1 - c.scar);
  const raw =
    state.w.catalog * lv(c, 'catalog') + state.w.price * lv(c, 'price') + state.w.stock * lv(c, 'stock') + state.w.policy * lv(c, 'policy') + state.w.trust * trust;
  return API_GATE[c.levels.api]! * raw;
}

function recoEff(c: AgCo, d: AgDecision): number {
  return lv(c, 'reco') * (d.diversity ? 0.92 : 1) * (1 - 0.5 * c.concentration);
}
const botEff = (c: AgCo, d: AgDecision) => lv(c, 'bot') * (d.handover === 'never' ? 0.55 : d.handover === 'risk' ? 0.85 : 1);

/** What a person sees: suggestions that fit, answers that help, and a reason to believe you. */
function humanScore(c: AgCo, d: AgDecision, reco = recoEff(c, d)): number {
  const raw = 0.3 * reco + 0.22 * botEff(c, d) + 0.24 * lv(c, 'trust') * (1 - c.scar) + 0.14 * lv(c, 'price') + 0.1 * lv(c, 'catalog');
  return HUMAN_FLOOR + (1 - HUMAN_FLOOR) * raw;
}

/** Every step of an agent's chain can fail; the chain is only as good as the data under it. */
const fulfilRate = (c: AgCo) => clamp(0.8 + 0.06 * c.levels.catalog + 0.05 * c.levels.stock + 0.03 * c.levels.policy, 0.8, 0.99);

/** Points needed to go from the level you hold to the level you want. */
export function agCost(from: number, to: number): number {
  let sum = 0;
  for (let l = from + 1; l <= to; l++) sum += AG_LEVEL_COST[l - 1]!;
  return sum;
}
export const agSpend = (c: AgCo, d: AgDecision) => AG_CAPS.reduce((a, cap) => a + agCost(c.levels[cap], d.invest[cap] ?? c.levels[cap]), 0);

/** Which automated systems are running, and whether each has its control in place. */
function controlOf(c: AgCo, d: AgDecision): number {
  const items: number[] = [];
  if (c.levels.price >= 2) items.push(d.guard === 'caps_log' ? 1 : d.guard === 'caps' ? 0.6 : 0);
  if (c.levels.bot >= 2) items.push(d.handover === 'risk_ask' ? 1 : d.handover === 'risk' ? 0.6 : 0);
  if (c.levels.reco >= 2) items.push(d.diversity ? 1 : 0);
  // The level of autonomy should be inversely proportional to how irreversible the action is.
  if (c.levels.api >= 2) items.push(c.levels.stock >= 2 ? 1 : 0);
  // There is only something to measure once there is something running.
  if (c.levels.reco >= 1) items.push(d.holdout ? 1 : 0.3);
  // Nothing automated is running: nothing to govern, and nothing to show for it either.
  if (!items.length) return 0.35;
  return items.reduce((a, b) => a + b, 0) / items.length;
}

export function simulateAg(state: AgState, order: string[], inputs: Record<string, RsInput<AgDecision>>, round: number, rng: Rng) {
  const share = AG_AGENT_SHARE[round - 1]!;
  const agentPool = AG_ORDERS * share;
  const humanPool = AG_ORDERS * (1 - share);

  // Everyone builds first, then the market is divided.
  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    for (const cap of AG_CAPS) c.levels[cap] = Math.max(c.levels[cap], clamp(Math.floor(d.invest[cap] ?? 0), 0, AG_MAX_LEVEL));
    if (round <= 2) c.earlyAx = Math.max(c.earlyAx, AG_AX.reduce((a, cap) => a + c.levels[cap], 0));
  }

  const aScore: Record<string, number> = {};
  const hScore: Record<string, number> = {};
  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    aScore[id] = agentScore(state, c);
    hScore[id] = humanScore(c, d);
  }
  const aSum = order.reduce((a, id) => a + Math.pow(aScore[id]!, AGENT_EXPO), 0);
  const hSum = order.reduce((a, id) => a + Math.pow(hScore[id]!, HUMAN_EXPO), 0);

  const reports: Record<string, AgReport> = {};
  const values: Record<string, number> = {};
  const news: T[] = [];
  let unmet = agentPool;

  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    const notes: T[] = [];
    const risks: AgRisk[] = [];

    const agentWon = aSum > 0 ? Math.pow(aScore[id]!, AGENT_EXPO) / aSum : 0;
    const humanWon = hSum > 0 ? Math.pow(hScore[id]!, HUMAN_EXPO) / hSum : 0;
    const fulfil = fulfilRate(c);
    const agentClaimed = agentPool * agentWon;
    const ordersAgent = agentClaimed * fulfil;
    const ordersFailed = agentClaimed - ordersAgent;
    const ordersHuman = humanPool * humanWon;
    unmet -= agentClaimed;

    // Dynamic pricing lifts realised value a little; it also opens the door to the risks below.
    const priceIndex = c.levels.price >= 3 ? 1.04 : 1;
    const revenue = (ordersAgent + ordersHuman) * AG_AOV * priceIndex;
    // An agent order arrives already decided: no persuading, almost no service.
    const margin = (ordersAgent * AG_AGENT_MARGIN + ordersHuman) * AG_AOV * priceIndex * AG_MARGIN;

    const control = controlOf(c, d);
    c.controlSum += control;
    c.controlRounds++;
    c.agentSum += agentWon * share;
    c.agentDen += share;
    if (d.holdout) {
      c.holdoutEver = true;
      c.holdoutRounds++;
    }

    // ── the planted risks ──
    let riskCost = 0;
    const hit = (id2: string, text: T, cost: number) => {
      risks.push({ id: id2, text, cost: bn(cost) });
      riskCost += cost;
    };
    if (ordersFailed > 40)
      hit(
        'chain',
        tx(
          `${Math.round(ordersFailed)} agent orders could not be honoured: the chain is only as good as the data under it, and yours breaks at ${Math.round((1 - fulfil) * 100)}% of steps.`,
          `${Math.round(ordersFailed)} đơn từ agent không thực hiện được: chuỗi hành động chỉ tốt bằng dữ liệu bên dưới nó, và dữ liệu của bạn vỡ ở ${Math.round((1 - fulfil) * 100)}% các bước.`,
        ),
        ordersFailed * AG_AOV * 0.35,
      );
    if (c.levels.price >= 2) {
      const p = d.guard === 'none' ? 0.25 : d.guard === 'caps' ? 0.06 : 0.02;
      if (rng() < p) {
        const cost = d.guard === 'none' ? revenue * 0.08 + 160 : d.guard === 'caps' ? revenue * 0.02 : revenue * 0.01;
        hit(
          'misprice',
          d.guard === 'none'
            ? tx(
                'A configuration error sent a product group to near zero for a day. There was no ceiling, no floor and no emergency stop.',
                'Một lỗi cấu hình đưa giá một nhóm hàng xuống gần bằng không trong một ngày. Không có giá trần, không có giá sàn, không có nút dừng.',
              )
            : tx(
                'The pricing engine misfired, but the ceiling, the floor and the daily limit caught it quickly.',
                'Máy định giá chạy sai, nhưng giá trần, giá sàn và giới hạn mỗi ngày đã chặn lại kịp.',
              ),
          cost,
        );
        if (d.guard === 'none') c.scar = clamp(c.scar + 0.18, 0, 0.8);
        if (d.guard === 'none') c.govFails++;
      }
    }
    if (c.levels.price >= 3 && d.guard !== 'caps_log') {
      c.scar = clamp(c.scar + 0.06, 0, 0.8);
      notes.push(
        tx(
          'Customers are comparing screenshots of your prices. Without a logged reason for every change you have nothing to answer them with.',
          'Khách đang so ảnh chụp giá của bạn với nhau. Không có nhật ký lý do cho mỗi lần đổi giá thì bạn không có gì để trả lời họ.',
        ),
      );
    }
    if (c.levels.bot >= 2) {
      const rate = d.handover === 'never' ? 0.05 : d.handover === 'risk' ? 0.015 : 0;
      if (rate > 0) {
        const cost = ordersHuman * AG_AOV * rate;
        hit(
          'botwrong',
          d.handover === 'never'
            ? tx(
                'The assistant answered refund and warranty questions on its own and got some of them wrong. Containment looked excellent; the complaints were not.',
                'Trợ lý tự trả lời câu hỏi hoàn tiền và bảo hành, và trả lời sai một số. Tỷ lệ tự xử lý trông rất đẹp; còn các khiếu nại thì không.',
              )
            : tx(
                'A few low-confidence answers slipped through before the handover rule caught them.',
                'Một vài câu trả lời mà máy không chắc đã lọt qua trước khi luật chuyển người chặn được.',
              ),
          cost,
        );
        if (d.handover === 'never') {
          c.scar = clamp(c.scar + 0.1, 0, 0.8);
          c.govFails++;
        }
      }
    }
    if (c.levels.reco >= 2 && !d.diversity) {
      c.concentration = clamp(c.concentration + 0.18, 0, 1);
      c.govFails++;
    } else if (d.diversity) c.concentration = clamp(c.concentration - 0.08, 0, 1);
    if (c.levels.api >= 2 && c.levels.stock <= 1 && rng() < 0.3) {
      const batch = 3000 + Math.floor(rng() * 2000);
      hit(
        'overpromise',
        tx(
          `Your ordering API accepted ${batch} orders for stock you did not have. Giving an agent the authority to transact on day-old stock figures is autonomy without the data to support it.`,
          `API đặt hàng của bạn nhận ${batch} đơn cho số hàng bạn không có. Cho agent quyền giao dịch trên số tồn cũ một ngày là cấp tự chủ mà không có dữ liệu đỡ bên dưới.`,
        ),
        batch * AG_AOV * 0.3,
      );
      c.scar = clamp(c.scar + 0.22, 0, 0.8);
      c.govFails++;
    }

    const concentrationCost = c.concentration * CONCENTRATION_COST;
    const opex = AG_CAPS.reduce((a, cap) => a + AG_OPEX[c.levels[cap]]!, 0) + AG_GUARD_INFO[d.guard].cost + AG_HANDOVER_INFO[d.handover].cost + concentrationCost;
    const profit = margin - opex - riskCost;
    c.profit += profit;
    c.revenue += revenue;
    if (profit < 0) c.lossRounds++;

    // What the dashboard claims the recommender did, and what a control group would have shown.
    const noReco = humanScore(c, d, 0);
    const wonNoReco = hSum > 0 ? Math.pow(noReco, HUMAN_EXPO) / (hSum - Math.pow(hScore[id]!, HUMAN_EXPO) + Math.pow(noReco, HUMAN_EXPO)) : 0;
    const realLift = Math.max(0, (humanWon - wonNoReco) * humanPool * AG_AOV * AG_MARGIN) * (d.holdout ? 1 - HOLDOUT_COST : 1);
    const cannib = d.diversity ? CANNIB_TIGHT : CANNIB_LOOSE;
    const claimed = realLift / (1 - cannib);

    if (c.levels.api === 0)
      notes.push(
        tx(
          `Agents placed ${Math.round(agentPool)} orders this quarter and none of them could be placed with you: without an ordering API you can be consulted but not transacted with.`,
          `Quý này agent đặt ${Math.round(agentPool)} đơn và không đơn nào đặt được cho bạn: không có API đặt hàng thì bạn được tham khảo chứ không được giao dịch.`,
        ),
      );
    if (c.levels.api >= 2 && c.levels.catalog <= 1)
      notes.push(
        tx(
          'An agent cannot compare what has no standard attributes. You are connected but still hard to read.',
          'Agent không so sánh được thứ không có thuộc tính chuẩn. Bạn đã kết nối nhưng vẫn khó đọc.',
        ),
      );
    if (c.concentration >= 0.35)
      notes.push(
        tx(
          `The recommender has pushed ${Math.round(c.concentration * 80)}% of impressions onto a handful of products. The long tail is turning over slowly and a returning customer sees the same shop every time.`,
          `Hệ gợi ý đã dồn ${Math.round(c.concentration * 80)}% lượt hiển thị vào một nhóm nhỏ sản phẩm. Phần đuôi dài quay vòng chậm và khách quay lại thì lần nào cũng thấy đúng một cửa hàng ấy.`,
        ),
      );
    if (!d.holdout && c.levels.reco >= 1)
      notes.push(
        tx(
          `The dashboard credits the recommender with VND ${vn(bn(claimed))} bn of margin this quarter. Without a control group that figure includes everything the customer would have bought anyway.`,
          `Bảng điều khiển ghi công cho hệ gợi ý ${vn(bn(claimed))} tỷ đồng lợi nhuận đóng góp trong quý. Không có nhóm đối chứng thì con số đó bao gồm cả phần khách vốn đã mua.`,
        ),
      );
    if (opex > margin && round >= 2)
      notes.push(
        tx(
          `Running what you hold costs VND ${vn(bn(opex))} bn a quarter against VND ${vn(bn(margin))} bn of contribution. Capability you are not using is still a bill.`,
          `Chi phí vận hành những gì bạn đang giữ là ${vn(bn(opex))} tỷ đồng mỗi quý, so với ${vn(bn(margin))} tỷ đồng lợi nhuận đóng góp. Năng lực không dùng đến vẫn là một hóa đơn.`,
        ),
      );
    if (c.scar >= 0.25)
      notes.push(
        tx('Trust is still damaged from an earlier incident: both people and agents rank you lower until it heals.', 'Niềm tin vẫn còn tổn thương từ sự cố trước: cả người và agent đều xếp bạn thấp hơn cho tới khi nó lành lại.'),
      );

    reports[id] = {
      round,
      decision: d,
      defaulted: inputs[id]!.defaulted,
      spent: agSpend(c, d),
      levels: { ...c.levels },
      agentShare: share,
      agentWon: r3(agentWon),
      humanWon: r3(humanWon),
      ordersAgent: Math.round(ordersAgent),
      ordersHuman: Math.round(ordersHuman),
      ordersFailed: Math.round(ordersFailed),
      revenue: bn(revenue),
      margin: bn(margin),
      opex: bn(opex),
      control: r2(control),
      riskCost: bn(riskCost),
      profit: bn(profit),
      risks,
      liftClaimed: bn(claimed),
      liftReal: d.holdout ? bn(realLift) : null,
      notes,
    };
    values[id] = bn(c.profit);
    c.scar = r3(c.scar * 0.75);
  }

  for (const cap of AG_CAPS) state.market[cap] = r2(order.reduce((a, id) => a + state.cos[id]!.levels[cap], 0) / order.length);
  state.unmet = Math.max(0, Math.round(unmet));

  if (state.unmet > agentPool * 0.1)
    news.push(
      tx(
        `${state.unmet} agent orders found nobody in this market readable enough to buy from. They went elsewhere.`,
        `${state.unmet} đơn từ agent không tìm được ai trong thị trường này đủ máy đọc được để mua. Chúng đi nơi khác.`,
      ),
    );
  const next = AG_AGENT_SHARE[round] ?? null;
  if (next !== null)
    news.push(
      tx(
        `Next quarter agents are expected to place ${Math.round(next * 100)}% of all orders, up from ${Math.round(share * 100)}%.`,
        `Quý sau agent dự kiến đặt ${Math.round(next * 100)}% tổng số đơn, tăng từ ${Math.round(share * 100)}%.`,
      ),
    );
  const bestAx = order.slice().sort((a, b) => agentScore(state, state.cos[b]!) - agentScore(state, state.cos[a]!))[0]!;
  if (agentScore(state, state.cos[bestAx]!) > 0.2)
    news.push(
      tx(
        `Agents ranked ${AG_CAP_INFO.catalog.name.en.toLowerCase()} and total cost above everything else this quarter.`,
        `Quý này agent coi ${AG_CAP_INFO.catalog.name.vi.toLowerCase()} và tổng chi phí quan trọng hơn mọi thứ khác.`,
      ),
    );
  return { reports, values, news };
}

export function agPub(state: AgState, order: string[], round: number): AgPub {
  return {
    profit: Object.fromEntries(order.map((id) => [id, bn(state.cos[id]!.profit)])),
    agentWon: Object.fromEntries(order.map((id) => [id, r3(state.cos[id]!.agentDen > 0 ? state.cos[id]!.agentSum / state.cos[id]!.agentDen : 0)])),
    market: { ...state.market },
    agentShareNow: AG_AGENT_SHARE[Math.max(0, Math.min(AG_ROUNDS, round) - 1)]!,
    agentShareNext: AG_AGENT_SHARE[Math.min(AG_ROUNDS, round)] ?? null,
    unmet: state.unmet,
  };
}

/** Absolute scorecard, 0–100. */
export function agScorecard(c: AgCo) {
  const profit = 50 * clamp(c.profit / 1000 / AG_PROFIT_TARGET, 0, 1);
  // Twice a fair share of the agent orders is the full mark.
  const agent = 25 * clamp((c.agentDen > 0 ? c.agentSum / c.agentDen : 0) / 0.33, 0, 1);
  const control = 25 * (c.controlRounds ? c.controlSum / c.controlRounds : 0);
  return { total: profit + agent + control, parts: { profit: r1(profit), agent: r1(agent), control: r1(control) } };
}

// ───────── AI sellers ─────────
const PLAN: Record<AgArchetype, Record<number, AgCap[]>> = {
  balanced: {
    1: ['trust', 'catalog', 'reco'],
    2: ['catalog', 'api', 'trust', 'price'],
    3: ['api', 'stock', 'policy', 'catalog'],
    4: ['stock', 'trust', 'catalog', 'policy'],
    5: ['policy', 'price', 'trust', 'api'],
  },
  nogov: {
    1: ['trust', 'catalog', 'reco'],
    2: ['catalog', 'api', 'reco', 'price'],
    3: ['api', 'stock', 'price', 'bot'],
    4: ['bot', 'trust', 'catalog', 'policy'],
    5: ['policy', 'price', 'reco', 'api'],
  },
  allin: { 1: AG_CAPS, 2: AG_CAPS, 3: AG_CAPS, 4: AG_CAPS, 5: AG_CAPS },
  human: { 1: ['reco', 'bot', 'trust'], 2: ['reco', 'bot', 'trust'], 3: ['reco', 'bot', 'trust'], 4: ['reco', 'bot', 'trust'], 5: ['reco', 'bot', 'trust'] },
  agentearly: { 1: ['api', 'catalog', 'price', 'stock', 'policy'], 2: AG_AX, 3: AG_AX, 4: AG_AX, 5: AG_AX },
  cheap: { 1: [], 2: [], 3: [], 4: [], 5: [] },
};

export function agBot(arch: AgArchetype, level: BotLevel, state: AgState, id: string, round: number, rng: Rng): AgDecision {
  const c = state.cos[id]!;
  const invest = { ...c.levels };
  const order = (PLAN[arch][round] ?? []).slice();
  if (level !== 'hard' && order.length > 1) {
    // A weaker seller gets the order of work a little wrong.
    const swaps = level === 'easy' ? 2 : 1;
    for (let i = 0; i < swaps; i++) {
      const a = Math.floor(rng() * order.length);
      const b = Math.floor(rng() * order.length);
      [order[a], order[b]] = [order[b]!, order[a]!];
    }
  }
  let left = AG_POINTS;
  for (let pass = 0; pass < AG_MAX_LEVEL && left > 0; pass++)
    for (const cap of order) {
      if (invest[cap] >= AG_MAX_LEVEL) continue;
      const cost = AG_LEVEL_COST[invest[cap]]!;
      if (cost <= left) {
        invest[cap] += 1;
        left -= cost;
      }
    }
  // Only the three archetypes that embody a specific mistake run their systems without controls.
  const governed = arch === 'balanced' || arch === 'human' || arch === 'cheap';
  const guard: AgGuard = governed ? (invest.price >= 3 ? 'caps_log' : invest.price >= 2 ? 'caps' : 'none') : 'none';
  const handover: AgHandover = governed ? (invest.bot >= 2 ? 'risk_ask' : 'never') : 'never';
  return {
    invest,
    guard,
    handover,
    diversity: governed && invest.reco >= 2,
    holdout: governed && level !== 'easy',
  };
}

// ───────── validation ─────────
const E = (en: string, vi: string) => ({ en, vi });

export function validateAg(raw: unknown, _round: number, state: AgState, playerId: string): AgDecision {
  const bad = () => new GameError('bad_decision', E('Invalid plan – please check the investment.', 'Kế hoạch không hợp lệ – vui lòng kiểm tra lại phần đầu tư.'));
  if (!raw || typeof raw !== 'object') throw bad();
  const d = raw as Partial<AgDecision> & { invest?: Record<string, unknown> };
  if (!d.invest || typeof d.invest !== 'object') throw bad();
  const c = state.cos[playerId]!;
  const invest = zeroCaps();
  for (const cap of AG_CAPS) {
    const v = Number(d.invest[cap] ?? c.levels[cap]);
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0 || v > AG_MAX_LEVEL) throw bad();
    if (v < c.levels[cap])
      throw new GameError(
        'no_downgrade',
        E(`${AG_CAP_INFO[cap].name.en} is already at level ${c.levels[cap]}; what is built stays built.`, `${AG_CAP_INFO[cap].name.vi} đã ở mức ${c.levels[cap]}; thứ đã xây thì vẫn còn đó.`),
      );
    invest[cap] = v;
  }
  const guard = AG_GUARDS.includes(d.guard as AgGuard) ? (d.guard as AgGuard) : 'none';
  const handover = AG_HANDOVERS.includes(d.handover as AgHandover) ? (d.handover as AgHandover) : 'never';
  const out: AgDecision = { invest, guard, handover, diversity: Boolean(d.diversity), holdout: Boolean(d.holdout) };
  const spend = agSpend(c, out);
  if (spend > AG_POINTS)
    throw new GameError(
      'too_many_points',
      E(`You have ${AG_POINTS} engineer-quarters, the plan uses ${spend}.`, `Bạn có ${AG_POINTS} quý-kỹ-sư, kế hoạch dùng ${spend}.`),
    );
  return out;
}

export function agBadges(state: AgState, id: string, order: string[]): string[] {
  const c = state.cos[id]!;
  const out: string[] = [];
  if (c.earlyAx >= 4) out.push('readable');
  if (c.govFails === 0) out.push('governed');
  if (c.holdoutRounds >= AG_ROUNDS - 1) out.push('measurer');
  if (c.lossRounds === 0) out.push('thrifty');
  if (c.concentration <= 0.1) out.push('broad');
  if (order.slice().sort((a, b) => state.cos[b]!.profit - state.cos[a]!.profit)[0] === id) out.push('leader');
  return out;
}

export const AGENT_ARENA: RsGame<AgDecision, AgState, AgReport, AgView> = {
  id: 'agent-arena',
  rounds: AG_ROUNDS,
  label: 'Agent Arena',
  // Neutral shop names: the framework hands out names by seat and archetypes at random,
  // so a name must never hint at the strategy behind it.
  botNames: ['SenMart', 'NhaViet', 'ChoDien', 'TanPhat', 'MinhLong', 'BaoAn'],
  archetypes: ['allin', 'human', 'agentearly', 'cheap', 'nogov', 'balanced'],
  defaultSettings: { decideSec: 240, resultsSec: 0, botLevel: 'medium', fillBots: true },
  init: (order, _room, rng) => initAg(order, rng),
  validate: (raw, round, state, playerId) => validateAg(raw, round, state, playerId),
  // No plan submitted: nothing new is built and the controls stay as they were.
  fallback: (state, playerId, _round, last) => {
    const prev = last as AgDecision | undefined;
    return {
      invest: { ...state.cos[playerId]!.levels },
      guard: prev?.guard ?? 'none',
      handover: prev?.handover ?? 'never',
      diversity: prev?.diversity ?? false,
      holdout: prev?.holdout ?? false,
    };
  },
  bot: (arch, level, state, id, round, rng) => agBot(arch as AgArchetype, level, state, id, round, rng),
  simulate: (state, order, inputs, round, rng) => {
    const out = simulateAg(state, order, inputs, round, rng);
    return { ...out, pub: agPub(state, order, round) as unknown as Record<string, unknown> };
  },
  scorecard: (state, id) => agScorecard(state.cos[id]!),
  cols: (state, id) => {
    const c = state.cos[id]!;
    return {
      profit: bn(c.profit),
      agent: r3(c.agentDen > 0 ? c.agentSum / c.agentDen : 0),
      built: AG_CAPS.reduce((a, cap) => a + c.levels[cap], 0),
      opex: bn(AG_CAPS.reduce((a, cap) => a + AG_OPEX[c.levels[cap]]!, 0)),
    };
  },
  flag: (state, id) => (state.cos[id]!.profit < 0 ? 'bankrupt' : undefined),
  view: (state, id, round, _finished) => {
    const c = state.cos[id]!;
    return {
      levels: { ...c.levels },
      profit: bn(c.profit),
      revenue: bn(c.revenue),
      opexNext: bn(AG_CAPS.reduce((a, cap) => a + AG_OPEX[c.levels[cap]]!, 0)),
      points: AG_POINTS,
      scar: r2(c.scar),
      concentration: r2(c.concentration),
      agentShareNow: AG_AGENT_SHARE[Math.max(0, Math.min(AG_ROUNDS, round) - 1)]!,
      agentShareNext: AG_AGENT_SHARE[Math.min(AG_ROUNDS, round)] ?? null,
      holdoutEver: c.holdoutEver,
    };
  },
  badges: agBadges,
  pub: (state, order, round) => agPub(state, order, round) as unknown as Record<string, unknown>,
};
