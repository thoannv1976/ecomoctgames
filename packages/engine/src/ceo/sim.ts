// Game 12 – CEO Simulator: the causal chain of §23.1 (server only).
// DECISION → CUSTOMER RESPONSE → COMPETITOR RESPONSE → MARKET OUTCOME → FINANCIAL RESULT
// Orders = Traffic × CR, Revenue = Orders × AOV, Profit = Revenue − COGS − Marketing − Platform − Fulfillment − Returns − AI.
import type { Rng } from '../rng.js';
import { tx, type T } from '../types.js';
import {
  AGENT_INFO,
  AI_INFO,
  CHANNELS,
  PRICE_INFO,
  SEGMENTS,
  SERVICE_INFO,
  START_CASH,
  type AgentInvest,
  type AiChoice,
  type CeoDecision,
  type CeoKpis,
  type CeoReport,
  type Channel,
  type CrisisId,
  type Kpi,
  type PricePos,
  type Segment,
  type Service,
  type SkuRange,
} from './types.js';

export interface CoState {
  cash: number;
  stock: number;
  rating: number;
  loyal: number;
  brand: Record<Channel, number>;
  ai: AiChoice | null;
  agent: AgentInvest[];
  profitCum: number;
  everNegative: boolean;
  crisis: CrisisId | null;
  crisisQuality: number;
  predictionsRight: Partial<Record<Kpi, boolean>>;
  last: CeoKpis | null;
  prev: CeoKpis | null;
}

export interface CeoState {
  round: number;
  players: Record<string, CoState>;
}

// ───────── Market model ─────────
export const BASE_SHOPPERS = 34000;
export const GROWTH = 0.06;
export const SEGMENT_SHARE: Record<Segment, number> = { genz: 0.4, office: 0.35, mom: 0.25 };
export const CHANNEL_PREF: Record<Segment, Record<Channel, number>> = {
  genz: { web: 0.1, shopee: 0.35, tiktok: 0.55 },
  office: { web: 0.35, shopee: 0.5, tiktok: 0.15 },
  mom: { web: 0.3, shopee: 0.55, tiktok: 0.15 },
};
const PRICE_FIT: Record<Segment, Record<PricePos, number>> = {
  genz: { value: 0.5, mid: 0.2, premium: -0.6 },
  office: { value: 0, mid: 0.3, premium: 0.1 },
  mom: { value: -0.2, mid: 0.2, premium: 0.35 },
};
const SERVICE_FIT: Record<Segment, Record<Service, number>> = {
  genz: { basic: 0, fast: 0.1, premium: 0.15 },
  office: { basic: -0.3, fast: 0.3, premium: 0.35 },
  mom: { basic: -0.1, fast: 0.15, premium: 0.3 },
};
const SKU_FIT: Record<Segment, Record<SkuRange, number>> = {
  genz: { focused: -0.1, medium: 0.1, wide: 0.25 },
  office: { focused: 0.15, medium: 0.1, wide: -0.05 },
  mom: { focused: 0.1, medium: 0.15, wide: 0 },
};
const LOYALTY: Record<Segment, number> = { genz: 0.6, office: 1, mom: 1.25 };
const OUTSIDE = 1.6;
const OPEX = 60;
export const AGENT_SHARE = 0.2;
const AGENT_WEIGHT: Record<AgentInvest, number> = { catalog: 0.9, api: 1.2, payment: 0.8, policy: 0.5 };
export const AGENT_MAX = Object.values(AGENT_WEIGHT).reduce((a, b) => a + b, 0);

const PRICE_ORDER: PricePos[] = ['value', 'mid', 'premium'];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

export function initCeo(order: string[]): CeoState {
  const players: Record<string, CoState> = {};
  for (const id of order) {
    players[id] = {
      cash: START_CASH,
      stock: 0,
      rating: 4.2,
      loyal: 0,
      brand: { web: 0.05, shopee: 0.05, tiktok: 0.05 },
      ai: null,
      agent: [],
      profitCum: 0,
      everNegative: false,
      crisis: null,
      crisisQuality: 0,
      predictionsRight: {},
      last: null,
      prev: null,
    };
  }
  return { round: 0, players };
}

/** How good a crisis response is (0 / 10 / 20), Table 12.19's lessons. */
export const CRISIS_QUALITY: Record<CrisisId, Record<string, number>> = {
  cpc: { shift: 20, price: 10, keep: 0 },
  pricecut: { match: 0, value: 20, ignore: 0 },
  viral: { preorder: 20, all: 0, stop: 10 },
  chatbot: { govern: 20, deny: 0, pay: 10 },
  agent: { model: 20, blame: 0, cancel: 10 },
  ban: { appeal: 20, wait: 10, relist: 0 },
  supplier: { reprice: 20, absorb: 10, cheaper: 0 },
  breach: { cirl: 20, quiet: 0, vendor: 0 },
};

export const agentScore = (agent: AgentInvest[]) => agent.reduce((a, k) => a + AGENT_WEIGHT[k], 0);

interface Effects {
  scoreAll: number;
  scoreCh: Partial<Record<Channel, number>>;
  presence: Partial<Record<Channel, number>>;
  demandCh: Partial<Record<Channel, number>>;
  adsFactor: number;
  cogsFactor: number;
  aovFactor: number;
  returnsAdd: number;
  ratingAdd: number;
  extraCost: number;
  preorder: boolean;
  agentFactor: number;
  priceShift: number;
  crmAdd: number;
}

function crisisEffects(c: CrisisId | null, choice: string | undefined, d: CeoDecision): Effects {
  const e: Effects = { scoreAll: 0, scoreCh: {}, presence: {}, demandCh: {}, adsFactor: 1, cogsFactor: 1, aovFactor: 1, returnsAdd: 0, ratingAdd: 0, extraCost: 0, preorder: false, agentFactor: 1, priceShift: 0, crmAdd: 0 };
  if (!c) return e;
  switch (c) {
    case 'cpc':
      e.adsFactor = 1 / 1.5;
      if (choice === 'shift') {
        e.adsFactor = 0.5 / 1.5;
        e.crmAdd = d.ads * 0.5;
      } else if (choice === 'price') e.priceShift = 1;
      break;
    case 'pricecut':
      e.scoreAll = -0.35;
      if (choice === 'match') {
        e.scoreAll = 0;
        e.aovFactor = 0.8;
      } else if (choice === 'value') {
        e.scoreAll = -0.12;
        e.crmAdd = 40;
        e.extraCost = 30;
      }
      break;
    case 'viral':
      e.demandCh = { tiktok: 2.5 };
      if (choice === 'preorder') {
        e.preorder = true;
        e.ratingAdd = -0.05;
      } else if (choice === 'all') e.ratingAdd = -0.4;
      else if (choice === 'stop') e.demandCh = { tiktok: 1.1 };
      break;
    case 'chatbot':
      e.ratingAdd = choice === 'govern' ? -0.1 : choice === 'deny' ? -0.5 : -0.2;
      if (choice === 'pay') e.extraCost = 50;
      e.scoreAll = choice === 'deny' ? -0.15 : 0;
      break;
    case 'agent':
      e.extraCost = choice === 'model' ? 60 : choice === 'cancel' ? 20 : 0;
      e.ratingAdd = choice === 'model' ? 0 : choice === 'cancel' ? -0.2 : -0.4;
      e.agentFactor = choice === 'blame' ? 0.4 : choice === 'cancel' ? 0.7 : 1;
      break;
    case 'ban':
      e.presence = { shopee: 0.45 };
      if (choice === 'appeal') e.scoreCh = { web: 0.35, tiktok: 0.15 };
      else if (choice === 'relist') {
        e.presence = { shopee: 0.2 };
        e.ratingAdd = -0.2;
      }
      break;
    case 'supplier':
      e.cogsFactor = 1.3;
      if (choice === 'reprice') {
        e.aovFactor = 1.1;
        e.scoreAll = -0.08;
      } else if (choice === 'cheaper') {
        e.cogsFactor = 1.1;
        e.returnsAdd = 0.06;
        e.ratingAdd = -0.3;
      }
      break;
    case 'breach':
      e.ratingAdd = choice === 'cirl' ? -0.15 : choice === 'quiet' ? -0.7 : -0.4;
      e.extraCost = choice === 'cirl' ? 40 : 0;
      e.scoreAll = choice === 'quiet' ? -0.2 : -0.05;
      break;
  }
  return e;
}

export interface QuarterInput {
  decision: CeoDecision;
  defaulted: boolean;
}

export interface QuarterOut {
  reports: Record<string, CeoReport>;
  news: T[];
}

export function simulateQuarter(state: CeoState, order: string[], inputs: Record<string, QuarterInput>, round: number, rng: Rng): QuarterOut {
  state.round = round;
  const shoppers = BASE_SHOPPERS * (1 + GROWTH) ** (round - 1) * (0.97 + rng() * 0.06);
  const agentPart = round >= 5 ? AGENT_SHARE : 0;
  const news: T[] = [];

  // 1. Decisions → effective presence and attraction per channel.
  const eff: Record<string, Effects> = {};
  const newAgent: Record<string, AgentInvest[]> = {};
  const price: Record<string, PricePos> = {};
  const score: Record<string, Record<Segment, Record<Channel, number>>> = {};
  for (const id of order) {
    const p = state.players[id]!;
    const d = inputs[id]!.decision;
    if (round === 4 && d.ai) p.ai = d.ai;
    newAgent[id] = round >= 5 ? Array.from(new Set(d.agent ?? [])).filter((a) => !p.agent.includes(a)) : [];
    p.agent.push(...newAgent[id]!);
    const e = crisisEffects(round === 6 ? p.crisis : null, d.crisis, d);
    eff[id] = e;
    price[id] = PRICE_ORDER[clamp(PRICE_ORDER.indexOf(d.price) + e.priceShift, 0, 2)]!;
    const ads = (d.ads + (round === 4 && d.ai === 'D' ? AI_INFO.D.cost : 0)) * e.adsFactor;
    score[id] = { genz: { web: 0, shopee: 0, tiktok: 0 }, office: { web: 0, shopee: 0, tiktok: 0 }, mom: { web: 0, shopee: 0, tiktok: 0 } };
    for (const c of CHANNELS) {
      let presence = Math.min(1, (d.mix[c] ?? 0) / 20) * (e.presence[c] ?? 1);
      if (c === 'shopee' && round >= 3 && !d.shopeePromo) presence *= 0.7;
      const spend = ads * ((d.mix[c] ?? 0) / 100) + d.creators * (c === 'tiktok' ? 0.8 : c === 'web' ? 0.2 : 0);
      p.brand[c] = Math.min(1, p.brand[c] * 0.6 + spend * 0.004);
      for (const s of SEGMENTS) {
        if (presence <= 0) {
          score[id]![s][c] = -Infinity;
          continue;
        }
        let u = 1.1 * Math.log(1 + spend / 40) + 0.8 * p.brand[c] + Math.log(presence);
        u += PRICE_FIT[s][price[id]!] + SERVICE_FIT[s][d.service] + SKU_FIT[s][d.skus] + 1.2 * (p.rating - 4) + (d.segment === s ? 0.35 : 0);
        if (p.ai === 'A' && round >= 4) u += 0.15;
        u += e.scoreAll + (e.scoreCh[c] ?? 0);
        score[id]![s][c] = u;
      }
    }
  }

  // 2. Customers choose (multinomial logit with an outside option per segment and channel).
  const marketOrders: Record<string, Record<Channel, number>> = {};
  for (const id of order) marketOrders[id] = { web: 0, shopee: 0, tiktok: 0 };
  for (const s of SEGMENTS) {
    for (const c of CHANNELS) {
      const n = shoppers * SEGMENT_SHARE[s] * CHANNEL_PREF[s][c] * (1 - agentPart);
      const ex = order.map((id) => (Number.isFinite(score[id]![s][c]) ? Math.exp(score[id]![s][c]) : 0));
      const den = Math.exp(OUTSIDE) + ex.reduce((a, b) => a + b, 0);
      order.forEach((id, k) => {
        const demand = n * (ex[k]! / den) * (eff[id]!.demandCh[c] ?? 1);
        marketOrders[id]![c] += demand;
      });
    }
  }
  // Agent-mediated demand (round 5+): agents read structured data, not ads.
  const agentOrders: Record<string, number> = {};
  if (agentPart > 0) {
    const n = shoppers * agentPart;
    const ex = order.map((id) => {
      const p = state.players[id]!;
      const s = 0.6 * agentScore(p.agent) + 0.5 * (p.rating - 4) + (price[id] === 'value' ? 0.3 : price[id] === 'mid' ? 0.2 : 0) - (p.agent.length ? 0 : 1.5);
      return Math.exp(s) * eff[id]!.agentFactor;
    });
    const den = Math.exp(2.2) + ex.reduce((a, b) => a + b, 0);
    order.forEach((id, k) => (agentOrders[id] = (n * ex[k]!) / den));
  }

  // 3. Fulfilment, money, rating.
  const reports: Record<string, CeoReport> = {};
  for (const id of order) {
    const p = state.players[id]!;
    const { decision: d, defaulted } = inputs[id]!;
    const e = eff[id]!;
    const notes: T[] = [];
    const repeat = p.loyal * 0.45;
    const byCh: Record<Channel, number> = { ...marketOrders[id]! };
    const repeatCh: Channel = (d.mix.web ?? 0) > 0 ? 'web' : (d.mix.shopee ?? 0) >= (d.mix.tiktok ?? 0) ? 'shopee' : 'tiktok';
    byCh[repeatCh] += repeat;
    byCh.web += agentOrders[id] ?? 0;
    const demand = byCh.web + byCh.shopee + byCh.tiktok;
    // Stock: buy, then sell what we have.
    const baseCost = PRICE_INFO[price[id]!].unitCost;
    const unitCost = baseCost * e.cogsFactor;
    const bought = Math.max(0, Math.round(d.stock));
    let purchase = bought * baseCost;
    p.stock += bought;
    if ((p.ai === 'C' && round >= 4) || e.preorder) {
      const gap = Math.max(0, demand - p.stock);
      if (gap > 0) {
        p.stock += gap;
        purchase += gap * baseCost * (e.preorder ? 1.05 : 1.1);
      }
    }
    const fulfilled = Math.min(demand, p.stock);
    const unmet = demand - fulfilled;
    const scale = demand > 0 ? fulfilled / demand : 0;
    p.stock -= fulfilled;
    if (unmet > 1) notes.push(tx(`Stock ran out: ${Math.round(unmet)} orders lost.`, `Hết hàng: mất ${Math.round(unmet)} đơn.`));

    const aov = PRICE_INFO[price[id]!].aov * (p.ai === 'A' && round >= 4 ? 1.03 : 1) * e.aovFactor;
    const chOut = {} as CeoKpis['byChannel'];
    for (const c of CHANNELS) chOut[c] = { orders: Math.round(byCh[c] * scale), revenue: r1(byCh[c] * scale * aov) };
    const revenue = r1(fulfilled * aov);
    const creatorRate = round >= 3 ? 0.15 : 0.1;
    const fees = r1(chOut.web.revenue * 0.03 + chOut.shopee.revenue * (0.14 + (round >= 3 && d.shopeePromo ? 0.03 : 0)) + chOut.tiktok.revenue * (0.08 + creatorRate));
    const cogs = r1(fulfilled * unitCost);
    const fulfilCost = r1(fulfilled * SERVICE_INFO[d.service].cost * (p.ai === 'B' && round >= 4 ? 0.9 : 1));
    const retRate = clamp(0.07 + (d.skus === 'wide' ? 0.02 : d.skus === 'focused' ? -0.01 : 0) + (d.service === 'premium' ? -0.02 : 0) + (p.ai === 'B' && round >= 4 ? -0.01 : 0) + e.returnsAdd, 0.02, 0.3);
    const returns = r1(fulfilled * retRate * (0.05 + aov * 0.3));
    const crm = d.crm + e.crmAdd;
    const marketing = r1(d.ads + d.creators + d.crm + (round === 4 && d.ai === 'D' ? AI_INFO.D.cost : 0));
    const ai = round === 4 && d.ai && d.ai !== 'D' && d.ai !== 'E' ? AI_INFO[d.ai].cost : 0;
    const agentCost = (newAgent[id] ?? []).reduce((a, k) => a + AGENT_INFO[k].cost, 0);
    const holding = r1(p.stock * baseCost * (p.ai === 'C' && round >= 4 ? 0.015 : 0.03));
    // COGS increase hits stock bought earlier too (replacement cost).
    const profit = r1(revenue - cogs - fees - fulfilCost - returns - marketing - ai - agentCost - OPEX - holding - e.extraCost);
    let cash = p.cash - purchase + revenue - fees - fulfilCost - returns - marketing - ai - agentCost - OPEX - holding - e.extraCost - (cogs - fulfilled * baseCost);
    let penalty = 0;
    if (cash < 0) {
      penalty = r1(-cash * 0.1);
      cash -= penalty;
      p.everNegative = true;
      notes.push(tx(`Cash went negative: emergency loan, penalty ${penalty} million.`, `Tiền mặt âm: vay khẩn cấp, phạt ${penalty} triệu.`));
    }
    p.cash = r1(cash);
    p.profitCum = r1(p.profitCum + profit - penalty);

    // Loyalty: CRM keeps customers; loyal customers buy on owned channels.
    const newCustomers = Math.max(0, fulfilled - repeat * scale);
    const segMix = SEGMENTS.reduce((a, s) => a + SEGMENT_SHARE[s] * LOYALTY[s] * (d.segment === s ? 1.4 : 1), 0) / 1.2;
    const keep = (0.12 + 0.35 * (1 - Math.exp(-crm / 80))) * segMix;
    p.loyal = p.loyal * 0.55 + newCustomers * keep * Math.min(1, p.rating / 4.3);

    // Rating moves toward the service promise; stock-outs and returns pull it down.
    const target = d.service === 'basic' ? 3.9 : d.service === 'fast' ? 4.3 : 4.6;
    let rating = p.rating + 0.35 * (target - p.rating) - (demand > 0 ? Math.min(0.3, (unmet / demand) * 0.9) : 0) - Math.max(0, retRate - 0.08) * 2;
    if (p.ai === 'B' && round >= 4) rating += 0.08;
    rating += e.ratingAdd;
    p.rating = Math.round(clamp(rating, 2.5, 5) * 100) / 100;

    const marketing0 = d.ads + d.creators;
    const kpis: CeoKpis = {
      traffic: Math.round(demand / 0.025),
      orders: Math.round(fulfilled),
      cr: 0.025,
      aov: r1(aov * 1000) / 1000,
      revenue,
      byChannel: chOut,
      cogs,
      fees,
      fulfillment: fulfilCost,
      returns,
      marketing,
      ai: ai + agentCost,
      opex: OPEX,
      holding,
      profit: r1(profit - penalty),
      cash: p.cash,
      rating: p.rating,
      pdr: revenue > 0 ? Math.round(((chOut.shopee.revenue + chOut.tiktok.revenue) / revenue) * 1000) / 1000 : 0,
      stockouts: Math.round(unmet),
      stockLeft: Math.round(p.stock),
      newCustomers: Math.round(newCustomers),
      repeatOrders: Math.round(repeat * scale),
      cac: newCustomers > 0 ? Math.round((marketing0 / newCustomers) * 1e6) / 1000 : null,
      agentOrders: Math.round((agentOrders[id] ?? 0) * scale),
    };
    // A traffic figure students can read: sessions = orders / CR, CR from attractiveness.
    const cr = clamp(0.012 + 0.006 * (p.rating - 3.8) + (price[id] === 'value' ? 0.004 : price[id] === 'premium' ? -0.003 : 0) + (p.ai === 'A' && round >= 4 ? 0.003 : 0), 0.006, 0.05);
    kpis.cr = Math.round(cr * 10000) / 10000;
    kpis.traffic = Math.round(fulfilled / cr);
    if (kpis.pdr > 0.8) notes.push(tx('More than 80% of revenue comes from platforms: one policy change could hurt badly (§6.1).', 'Hơn 80% doanh thu đến từ sàn: chỉ một thay đổi chính sách có thể gây thiệt hại lớn (mục 6.1).'));
    if (holding > 25) notes.push(tx('Dead stock is costing you holding fees.', 'Hàng tồn đọng đang tốn chi phí lưu kho.'));
    if (round >= 5 && (agentOrders[id] ?? 0) > 50) notes.push(tx(`AI agents brought ${Math.round(agentOrders[id]!)} orders.`, `AI agent mang về ${Math.round(agentOrders[id]!)} đơn.`));
    p.prev = p.last;
    p.last = kpis;
    reports[id] = { round, decision: d, defaulted, kpis, notes };
  }

  // Round 6: score the crisis response and the KPI predictions.
  if (round === 6) {
    for (const id of order) {
      const p = state.players[id]!;
      const d = inputs[id]!.decision;
      if (!p.crisis) continue;
      p.crisisQuality = CRISIS_QUALITY[p.crisis][d.crisis ?? ''] ?? 0;
      const now = p.last!;
      const before = p.prev;
      if (before) {
        const moved: Record<Kpi, number> = { revenue: now.revenue - before.revenue, profit: now.profit - before.profit, rating: now.rating - before.rating, pdr: now.pdr - before.pdr };
        for (const k of Object.keys(moved) as Kpi[]) {
          const guess = d.predict?.[k];
          if (guess) p.predictionsRight[k] = (guess === 'up') === moved[k] > 0;
        }
      }
    }
  }
  if (round === 3) news.push(tx('Shopee’s promotion programme and TikTok’s higher creator commission now apply.', 'Chương trình khuyến mãi bắt buộc của Shopee và hoa hồng nhà sáng tạo cao hơn của TikTok bắt đầu áp dụng.'));
  if (round === 4) news.push(tx('AI arrives: recommendation, chatbots and forecasting change the game from this quarter.', 'AI xuất hiện: gợi ý sản phẩm, chatbot và dự báo thay đổi cuộc chơi từ quý này.'));
  if (round === 5) news.push(tx('20% of shoppers now buy through AI agents that read structured data, prices and policies.', '20% khách mua qua AI agent – agent đọc dữ liệu có cấu trúc, giá và chính sách.'));
  return { reports, news };
}

// ───────── Score ─────────

export function crisisPoints(p: CoState): number {
  const preds = Object.values(p.predictionsRight).filter(Boolean).length;
  return p.crisisQuality + preds * 5;
}

export interface CeoRow {
  id: string;
  dashboard: number;
  rank: number;
}

/** Strategy Dashboard: 40% profit, 15% survival, 15% low platform dependency, 10% agentic readiness, 20% crisis. */
export function ceoRanking(state: CeoState, order: string[]): Record<string, CeoRow> {
  const maxProfit = Math.max(1, ...order.map((id) => state.players[id]!.profitCum));
  const rows = order.map((id) => {
    const p = state.players[id]!;
    const pdr = p.last?.pdr ?? 1;
    const dash =
      40 * clamp(p.profitCum / maxProfit, -1, 1) +
      15 * (p.everNegative ? 0 : 1) +
      15 * (1 - pdr) +
      10 * (agentScore(p.agent) / AGENT_MAX) +
      20 * (crisisPoints(p) / 40);
    return { id, dashboard: Math.round(dash * 10) / 10, profit: p.profitCum };
  });
  rows.sort((a, b) => b.dashboard - a.dashboard || b.profit - a.profit || order.indexOf(a.id) - order.indexOf(b.id));
  const out: Record<string, CeoRow> = {};
  rows.forEach((r, i) => (out[r.id] = { id: r.id, dashboard: r.dashboard, rank: i + 1 }));
  return out;
}

/** Absolute goals (4 × 25): profitable, never out of cash, platform dependency ≤ 60%, crisis handled. */
export function ceoScorecard(p: CoState) {
  const profit = 25 * clamp(p.profitCum / 400, 0, 1);
  const cash = p.everNegative ? 0 : 25;
  const pdr = 25 * clamp((0.9 - (p.last?.pdr ?? 1)) / 0.3, 0, 1);
  const crisis = 25 * (crisisPoints(p) / 40);
  const r = (v: number) => Math.round(v * 10) / 10;
  return { profit: r(profit), cash, pdr: r(pdr), crisis: r(crisis), total: r(profit + cash + pdr + crisis) };
}
