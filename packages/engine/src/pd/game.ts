// Game 8 – Peak Day Ops "11.11": shared peak demand over three 8-hour blocks, stock-outs that spill to rivals,
// COD failures, capacity and carrier overload, customer service, returns and dead stock after the sale (server only).
import { GameError } from '../room.js';
import { shuffle, type Rng } from '../rng.js';
import type { RsGame, RsInput } from '../rs/room.js';
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';
import {
  PD_COSTS,
  PD_COST_INFO,
  PD_CS_CAPACITY,
  PD_CS_COST,
  PD_LAST_YEAR,
  PD_MARKET_FORECAST,
  PD_PRICE,
  PD_ROUNDS,
  PD_SELF_CAPACITY,
  PD_SHOP_FORECAST,
  PD_UNIT_COST,
  type PdArchetype,
  type PdBlock,
  type PdCod,
  type PdCost,
  type PdDecision,
  type PdFraud,
  type PdFulfil,
  type PdPub,
  type PdReport,
  type PdReturns,
  type PdSpeed,
  type PdView,
} from './types.js';

export interface PdCo {
  stock: number;
  bought: number;
  incoming: number;
  incomingRound: number;
  fulfil: PdFulfil;
  speed: PdSpeed;
  returnsPolicy: PdReturns;
  fraud: PdFraud;
  rating: number;
  totals: Record<PdCost, number>;
  cogs: number;
  revenue: number;
  orders: number;
  pendingReturns: number;
  pendingReturnRevenue: number;
  profitCum: number;
  stockouts: number;
  deadShare: number;
  diagnosisHits: number;
  codPolicies: string;
  lastOrders: number;
  lastDiscount: number;
  stockoutNow: boolean;
}
export interface PdState {
  cos: Record<string, PdCo>;
  market: number;
  viral: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const zero = (): Record<PdCost, number> => Object.fromEntries(PD_COSTS.map((k) => [k, 0])) as Record<PdCost, number>;
const BLOCK_DEMAND = [0, 0, 0.32, 0.4, 0.28]; // share of the day's demand per round (rounds 2–4)
const FULFIL_COST: Record<PdFulfil, number> = { self: 0.014, '3pl': 0.017, fbs: 0.02 };
const SPEED_COST: Record<PdSpeed, number> = { standard: 0, fast: 0.008, sameday: 0.02 };
const RETURN_RATE: Record<PdReturns, number> = { strict: 0.04, '7day': 0.08, free30: 0.13 };

export function initPd(order: string[], rng: Rng): PdState {
  const cos: Record<string, PdCo> = {};
  for (const id of order)
    cos[id] = { stock: 0, bought: 0, incoming: 0, incomingRound: 0, fulfil: '3pl', speed: 'fast', returnsPolicy: '7day', fraud: 'basic', rating: 4.6, totals: zero(), cogs: 0, revenue: 0, orders: 0, pendingReturns: 0, pendingReturnRevenue: 0, profitCum: 0, stockouts: 0, deadShare: 0, diagnosisHits: 0, codPolicies: '', lastOrders: 0, lastDiscount: 0, stockoutNow: false };
  const viral = shuffle(rng, order).slice(0, 2).join(',');
  return { cos, market: Math.round((0.75 + 0.55 * rng()) * 1000) / 1000, viral };
}

function topTwo(t: Record<PdCost, number>): PdCost[] {
  return PD_COSTS.slice().sort((a, b) => t[b] - t[a]).slice(0, 2);
}

export function simulatePd(state: PdState, order: string[], inputs: Record<string, RsInput<PdDecision>>, round: number, rng: Rng) {
  const reports: Record<string, PdReport> = {};
  const values: Record<string, number> = {};
  const news: T[] = [];
  const blocks: Record<string, PdBlock> = {};
  if (round === 1) {
    for (const id of order) {
      const c = state.cos[id]!;
      const d = inputs[id]!.decision;
      c.stock = d.stock ?? 0;
      c.bought = c.stock;
      c.fulfil = d.fulfil ?? '3pl';
      c.speed = d.speed ?? 'fast';
      c.returnsPolicy = d.returns ?? '7day';
      c.fraud = d.fraud ?? 'basic';
    }
    news.push(tx('Stock is in the warehouses. Tonight at midnight the sale opens.', 'Hàng đã về kho. Nửa đêm nay mở bán.'));
  } else if (round <= 4) {
    // ---- Demand split across shops (logit), then stock-outs spill to rivals that still have stock ----
    for (const id of order) {
      const c = state.cos[id]!;
      if (c.incoming && c.incomingRound === round) {
        c.stock += c.incoming;
        c.incoming = 0;
      }
    }
    const viral = state.viral.split(',');
    const total = PD_MARKET_FORECAST * state.market * BLOCK_DEMAND[round]!;
    const att = order.map((id) => {
      const c = state.cos[id]!;
      const d = inputs[id]!.decision;
      return 0.06 * (d.discount ?? 0) + 0.4 * Math.log(1 + (d.ads ?? 0) / 100) + (c.speed === 'fast' ? 0.2 : c.speed === 'sameday' ? 0.35 : 0) + (c.returnsPolicy === 'free30' ? 0.25 : c.returnsPolicy === 'strict' ? -0.2 : 0) + (c.fulfil === 'fbs' ? 0.2 : 0) + 0.8 * (c.rating - 4.5) + (d.cod === 'off' ? -0.5 : 0);
    });
    const ex = att.map((a) => Math.exp(a / 0.6));
    // Outside option ≈ a typical shop: the six shops share about half of all 11.11 shoppers in the category.
    const sum = ex.reduce((a, b) => a + b, 0) + 6 * Math.exp(1.1 / 0.6);
    const want: Record<string, number> = {};
    order.forEach((id, k) => (want[id] = ((total * 2 * ex[k]!) / sum) * (round === 3 && viral.includes(id) ? 3 : 1)));
    const served: Record<string, number> = {};
    let spill = 0;
    for (const id of order) {
      served[id] = Math.min(want[id]!, state.cos[id]!.stock);
      spill += want[id]! - served[id]!;
    }
    const withStock = order.filter((id) => state.cos[id]!.stock - served[id]! > 1);
    const wsum = withStock.reduce((a, id) => a + want[id]!, 0);
    for (const id of withStock) {
      const extra = Math.min(state.cos[id]!.stock - served[id]!, (0.5 * spill * want[id]!) / Math.max(1, wsum));
      served[id]! += extra;
    }
    for (const id of order) {
      const c = state.cos[id]!;
      const d = inputs[id]!.decision;
      const notes: T[] = [];
      const disc = (d.discount ?? 0) / 100;
      const cod = d.cod ?? 'confirm';
      c.codPolicies += cod[0];
      let o = served[id]!;
      const lostStockout = Math.max(0, want[id]! - o);
      c.stockoutNow = lostStockout > want[id]! * 0.05;
      if (c.stockoutNow) {
        c.stockouts++;
        notes.push(tx(`Sold out: about ${Math.round(lostStockout)} orders went to rivals this block.`, `Hết hàng: khoảng ${Math.round(lostStockout)} đơn đã chạy sang đối thủ trong ca này.`));
      }
      // COD: 60% of buyers prefer COD. With prepaid only, part of them buy anyway, the rest left already (attractiveness).
      const codShare = cod === 'off' ? 0 : 0.6;
      const lostCod = cod === 'confirm' ? o * codShare * 0.03 : 0;
      o -= lostCod;
      const strictBlock = c.fraud === 'strict' ? o * 0.03 : 0;
      o -= strictBlock;
      c.stock -= o;
      let fail = (cod === 'all' ? 0.13 : 0.07) + (round === 4 ? 0.05 : 0) + (c.fraud === 'none' ? 0.03 : c.fraud === 'strict' ? -0.02 : 0);
      fail = clamp(fail, 0.02, 0.3);
      const failed = o * codShare * fail;
      const delivered = o - failed;
      c.stock += failed * 0.9; // failed parcels come back to stock (10% damaged)
      // Capacity & lateness
      const cap = c.fulfil === 'self' ? PD_SELF_CAPACITY : Infinity;
      let lateShare = Math.max(0, (o - cap) / Math.max(1, o));
      if (c.speed === 'sameday') lateShare += 0.06;
      if (round === 4) lateShare += c.fulfil === 'fbs' ? 0.03 : 0.1;
      if (c.fulfil === '3pl') lateShare += 0.02;
      lateShare = clamp(lateShare, 0, 0.8);
      const late = o * lateShare;
      const tickets = o * (0.06 + 0.5 * lateShare) + failed * 0.3;
      const cs = d.cs ?? 0;
      const unanswered = Math.max(0, tickets - cs * PD_CS_CAPACITY);
      c.rating = clamp(c.rating - 1.2 * lateShare - 0.8 * (unanswered / Math.max(1, o)) - 0.3 * fail * codShare + (c.returnsPolicy === 'free30' ? 0.03 : 0) + 0.02, 3, 5);
      if (lateShare > 0.15) notes.push(tx(`${Math.round(lateShare * 100)}% of parcels late: capacity, not unit cost, is the bottleneck at peak.`, `${Math.round(lateShare * 100)}% đơn giao trễ: lúc cao điểm, nút thắt là năng lực xử lý chứ không phải đơn giá.`));
      if (unanswered > 50) notes.push(tx(`${Math.round(unanswered)} customer tickets unanswered – the rating pays for it.`, `${Math.round(unanswered)} phiếu hỗ trợ chưa được trả lời – điểm đánh giá phải trả giá.`));
      if (failed > 100) notes.push(tx(`${Math.round(failed)} COD parcels refused or failed: two-way shipping paid for nothing.`, `${Math.round(failed)} đơn COD bị từ chối hoặc giao thất bại: trả phí vận chuyển hai chiều mà không bán được.`));
      // Money
      const revenue = delivered * PD_PRICE * (1 - disc);
      const cogs = delivered * PD_UNIT_COST;
      const costs = zero();
      costs.discount = delivered * PD_PRICE * disc;
      costs.delivery = o * (FULFIL_COST[c.fulfil] + SPEED_COST[c.speed]) + (c.fulfil === '3pl' ? o * 0.02 * 0.03 : 0);
      costs.failedCod = failed * 0.06;
      costs.cs = cs * PD_CS_COST;
      costs.ads = d.ads ?? 0;
      if (d.expedite && round <= 3) {
        c.incoming += d.expedite;
        c.incomingRound = round + 2;
        c.bought += d.expedite;
        costs.expedite = d.expedite * 0.03;
        if (round === 3) notes.push(tx('Air freight ordered now lands after the sale – it will be leftover stock.', 'Hàng nhập gấp đặt lúc này về sau đợt sale – sẽ thành hàng tồn.'));
      }
      // Returns come back later (realised in round 5).
      const rr = RETURN_RATE[c.returnsPolicy] * (1 + disc);
      c.pendingReturns += delivered * rr;
      c.pendingReturnRevenue += delivered * rr * PD_PRICE * (1 - disc);
      const costSum = PD_COSTS.reduce((a, k) => a + costs[k], 0) - costs.discount;
      const profit = revenue - cogs - costSum;
      for (const k of PD_COSTS) c.totals[k] += costs[k];
      c.cogs += cogs;
      c.revenue += revenue;
      c.orders += delivered;
      c.profitCum += profit;
      c.lastOrders = Math.round(delivered);
      c.lastDiscount = d.discount ?? 0;
      blocks[id] = { demand: Math.round(want[id]!), orders: Math.round(o), lostStockout: Math.round(lostStockout), lostCod: Math.round(lostCod + strictBlock), viral: round === 3 && viral.includes(id), delivered: Math.round(delivered), failedCod: Math.round(failed), late: Math.round(late), tickets: Math.round(tickets), unanswered: Math.round(unanswered) };
      reports[id] = mkReport(c, round, d, inputs[id]!.defaulted, blocks[id]!, revenue, costs, cogs, profit, notes);
    }
    if (round === 3) news.push(tx(`Viral video! Demand ×3 for ${viral.length} shops this block.`, `Video viral! Nhu cầu ×3 cho ${viral.length} cửa hàng trong ca này.`));
    if (round === 4) news.push(tx('Carriers overloaded tonight: late parcels and COD refusals up.', 'Tối nay đơn vị vận chuyển quá tải: giao trễ và từ chối nhận COD tăng.'));
  }
  if (round === 1) {
    for (const id of order) {
      const c = state.cos[id]!;
      reports[id] = mkReport(c, round, inputs[id]!.decision, inputs[id]!.defaulted, null, 0, zero(), 0, 0, [tx(`Bought ${c.stock} units for ${Math.round(c.stock * PD_UNIT_COST)}m. Forecast for your shop: ≈ ${PD_SHOP_FORECAST} orders (±30%).`, `Đã nhập ${c.stock} sản phẩm, ${Math.round(c.stock * PD_UNIT_COST)} triệu. Dự báo cho cửa hàng: ≈ ${PD_SHOP_FORECAST} đơn (±30%).`)]);
    }
  }
  if (round === 5) {
    for (const id of order) {
      const c = state.cos[id]!;
      const d = inputs[id]!.decision;
      const notes: T[] = [];
      if (c.incoming) {
        c.stock += c.incoming;
        c.incoming = 0;
      }
      const costs = zero();
      // Returns: refund, reverse logistics, 10% unsellable.
      const ret = c.pendingReturns;
      costs.returns = ret * 0.035 + ret * 0.1 * PD_UNIT_COST + (d.refund === 'fast' ? ret * 0.005 : 0);
      const refunded = c.pendingReturnRevenue;
      c.stock += ret * 0.9;
      const cogsBack = ret * 0.9 * PD_UNIT_COST;
      if (d.refund === 'slow') c.rating = clamp(c.rating - 0.15, 3, 5);
      if (d.apology) {
        costs.cs += 20;
        c.rating = clamp(c.rating + 0.1, 3, 5);
      }
      // Leftover stock: clearance or write-down.
      const left = Math.max(0, c.stock);
      const clr = d.clearance ?? 0;
      const sold = clr === 50 ? left * 0.75 : clr === 30 ? left * 0.4 : 0;
      const clearRevenue = sold * PD_PRICE * (1 - clr / 100);
      const remaining = left - sold;
      costs.discount += sold * PD_PRICE * (clr / 100);
      costs.deadStock = remaining * PD_UNIT_COST * 0.4;
      c.deadShare = c.bought > 0 ? remaining / c.bought : 0;
      const revenue = clearRevenue - refunded;
      const cogs = sold * PD_UNIT_COST - cogsBack;
      const costSum = costs.returns + costs.cs + costs.deadStock;
      const profit = revenue - cogs - costSum;
      for (const k of PD_COSTS) c.totals[k] += costs[k];
      c.cogs += cogs;
      c.revenue += revenue;
      c.profitCum += profit;
      c.stock = remaining;
      const top = topTwo(c.totals);
      c.diagnosisHits = (d.diagnosis ?? []).filter((k) => top.includes(k)).length;
      notes.push(tx(`Your two biggest cost lines: ${top.map((k) => PD_COST_INFO[k].en).join(' and ')}. You picked ${c.diagnosisHits}/2.`, `Hai khoản chi phí lớn nhất của bạn: ${top.map((k) => PD_COST_INFO[k].vi).join(' và ')}. Bạn chọn đúng ${c.diagnosisHits}/2.`));
      const growth = c.orders / PD_LAST_YEAR.orders - 1;
      notes.push(tx(`Orders ${growth >= 0 ? '+' : ''}${Math.round(growth * 100)}% vs last year; profit ${Math.round(c.profitCum)}m vs ${PD_LAST_YEAR.profit}m last year.`, `Số đơn ${growth >= 0 ? '+' : ''}${Math.round(growth * 100)}% so với năm ngoái; lợi nhuận ${Math.round(c.profitCum)} triệu so với ${PD_LAST_YEAR.profit} triệu năm ngoái.`));
      if (c.deadShare > 0.25) notes.push(tx(`${Math.round(c.deadShare * 100)}% of the stock you bought is still unsold.`, `${Math.round(c.deadShare * 100)}% lượng hàng đã nhập vẫn chưa bán được.`));
      reports[id] = { ...mkReport(c, round, d, inputs[id]!.defaulted, null, revenue, costs, cogs, profit, notes), topCosts: top };
    }
    news.push(tx('The bill is in: returns, failed COD and leftover stock are counted.', 'Hóa đơn đã về: hoàn hàng, COD thất bại và hàng tồn đã được tính.'));
  }
  for (const id of order) values[id] = r1(state.cos[id]!.profitCum);
  return { reports, values, news };
}

function mkReport(c: PdCo, round: number, d: PdDecision, defaulted: boolean, block: PdBlock | null, revenue: number, costs: Record<PdCost, number>, cogs: number, profit: number, notes: T[]): PdReport {
  return {
    round,
    decision: d,
    defaulted,
    block,
    stockLeft: Math.round(c.stock),
    incoming: Math.round(c.incoming),
    revenue: r1(revenue),
    costs: Object.fromEntries(PD_COSTS.map((k) => [k, r1(costs[k])])) as Record<PdCost, number>,
    cogs: r1(cogs),
    profit: r1(profit),
    profitCum: r1(c.profitCum),
    rating: r2(c.rating),
    notes,
  };
}

export function pdPub(state: PdState, order: string[], round: number): PdPub {
  const pick = <V>(f: (c: PdCo) => V) => Object.fromEntries(order.map((id) => [id, f(state.cos[id]!)]));
  return {
    orders: pick((c) => Math.round(c.orders)),
    stockout: pick((c) => c.stockoutNow),
    rating: pick((c) => r2(c.rating)),
    discount: pick((c) => c.lastDiscount),
    viral: round >= 3 ? state.viral.split(',') : [],
  };
}

export function pdScorecard(c: PdCo, finished: boolean) {
  const profit = 50 * clamp((c.profitCum + 200) / 700, 0, 1);
  const rating = 20 * clamp((c.rating - 3.8) / 0.9, 0, 1);
  const diagnosis = finished ? 10 * c.diagnosisHits : 0;
  const ops = (c.stockouts === 0 ? 5 : 0) + (finished ? (c.deadShare < 0.25 ? 5 : 0) : 0);
  return { total: profit + rating + diagnosis + ops, parts: { profit: r1(profit), rating: r1(rating), diagnosis, ops } };
}

// ---------- AI shops ----------
export function pdBot(arch: PdArchetype, level: BotLevel, c: PdCo, round: number, rng: Rng): PdDecision {
  const noisy = level === 'easy' ? 0.35 : level === 'medium' ? 0.15 : 0;
  const pick = <V>(good: V, bad: V) => (rng() < noisy ? bad : good);
  if (round === 1) {
    const base: Record<PdArchetype, PdDecision> = {
      overstock: { stock: 7000, fulfil: '3pl', speed: 'fast', returns: '7day', fraud: 'basic', cod: 'confirm' },
      codall: { stock: 4000, fulfil: 'self', speed: 'sameday', returns: 'free30', fraud: 'none', cod: 'all' },
      understock: { stock: 2000, fulfil: 'fbs', speed: 'fast', returns: '7day', fraud: 'basic', cod: 'confirm' },
      discounter: { stock: 5000, fulfil: '3pl', speed: 'standard', returns: '7day', fraud: 'basic', cod: 'all' },
      balanced: { stock: 3500, fulfil: '3pl', speed: 'fast', returns: '7day', fraud: 'basic', cod: 'confirm' },
      pro: { stock: 4500, fulfil: 'fbs', speed: 'fast', returns: '7day', fraud: 'basic', cod: 'confirm' },
    };
    const d = { ...base[arch] };
    d.stock = Math.round(((d.stock ?? 3500) * (1 + (rng() - 0.5) * noisy * 2)) / 500) * 500;
    d.cod = pick(d.cod!, 'all');
    return cleanPd(d, round);
  }
  if (round <= 4) {
    const exp = (PD_SHOP_FORECAST * [0, 0, 0.32, 0.4, 0.28][round]!) / 0.6;
    const csNeed = Math.ceil((exp * 0.1) / PD_CS_CAPACITY);
    const table: Record<PdArchetype, PdDecision> = {
      overstock: { discount: 20, ads: 300, cs: 6, cod: 'confirm' },
      codall: { discount: 10, ads: 100, cs: 3, cod: 'all' },
      understock: { discount: 10, ads: 100, cs: 6, cod: 'confirm', ...(round === 2 ? { expedite: 1000 } : {}) },
      discounter: { discount: 30, ads: 300, cs: 6, cod: 'all' },
      balanced: { discount: 10, ads: 100, cs: csNeed, cod: 'confirm' },
      pro: { discount: c.stock < 600 ? 0 : 10, ads: c.stock < 800 ? 0 : 100, cs: csNeed + 1, cod: 'confirm', ...(round === 2 && c.stock < 2500 ? { expedite: 750 } : {}) },
    };
    const d = { ...table[arch] };
    d.cs = Math.max(0, Math.round((d.cs ?? 4) * (1 - noisy * rng())));
    return cleanPd(d, round);
  }
  const top = topTwo(c.totals);
  const wrong = shuffle(rng, ['ads', 'cs', 'expedite', 'delivery'] as PdCost[]).slice(0, 2);
  const smart = arch === 'pro' || arch === 'balanced';
  return cleanPd({ clearance: arch === 'overstock' ? 0 : 30, refund: smart ? 'fast' : 'slow', apology: smart && c.rating < 4.4, diagnosis: smart ? (rng() < (arch === 'pro' ? 0.9 : 0.6) - noisy ? top : [top[0]!, wrong[0]!]) : wrong }, round);
}

const opt = <V>(v: unknown, list: readonly V[], d: V): V => (list.includes(v as V) ? (v as V) : d);
function cleanPd(d: PdDecision, round: number): PdDecision {
  if (round === 1)
    return {
      stock: clamp(Math.round((d.stock ?? 0) / 500) * 500, 0, 10000),
      fulfil: opt(d.fulfil, ['self', '3pl', 'fbs'] as const, '3pl'),
      speed: opt(d.speed, ['standard', 'fast', 'sameday'] as const, 'fast'),
      returns: opt(d.returns, ['strict', '7day', 'free30'] as const, '7day'),
      fraud: opt(d.fraud, ['none', 'basic', 'strict'] as const, 'basic'),
      cod: opt(d.cod, ['all', 'confirm', 'off'] as const, 'confirm'),
    };
  if (round <= 4)
    return {
      cod: opt(d.cod, ['all', 'confirm', 'off'] as const, 'confirm'),
      cs: clamp(Math.round(d.cs ?? 0), 0, 40),
      discount: opt(Number(d.discount ?? 0), [0, 10, 20, 30] as const, 0),
      ads: opt(Number(d.ads ?? 0), [0, 100, 300] as const, 0),
      ...(round <= 3 && d.expedite ? { expedite: clamp(Math.round(d.expedite / 250) * 250, 0, 3000) } : {}),
    };
  return {
    clearance: opt(Number(d.clearance ?? 0), [0, 30, 50] as const, 0),
    refund: opt(d.refund, ['fast', 'slow'] as const, 'fast'),
    apology: !!d.apology,
    diagnosis: [...new Set((d.diagnosis ?? []).filter((k) => PD_COSTS.includes(k)))].slice(0, 2),
  };
}

const E = (en: string, vi: string) => ({ en, vi });
export function validatePd(raw: unknown, round: number): PdDecision {
  const bad = (en = 'Invalid plan – please check every field.', vi = 'Kế hoạch không hợp lệ – vui lòng kiểm tra từng mục.') => new GameError('bad_decision', E(en, vi));
  if (!raw || typeof raw !== 'object') throw bad();
  const d = raw as Record<string, unknown>;
  const inList = (k: string, list: readonly unknown[]) => {
    if (!list.includes(d[k])) throw bad();
  };
  if (round === 1) {
    const s = Number(d.stock);
    if (!Number.isFinite(s) || s < 0 || s > 10000) throw bad();
    inList('fulfil', ['self', '3pl', 'fbs']);
    inList('speed', ['standard', 'fast', 'sameday']);
    inList('returns', ['strict', '7day', 'free30']);
    inList('fraud', ['none', 'basic', 'strict']);
    inList('cod', ['all', 'confirm', 'off']);
  } else if (round <= 4) {
    inList('cod', ['all', 'confirm', 'off']);
    inList('discount', [0, 10, 20, 30]);
    inList('ads', [0, 100, 300]);
    const cs = Number(d.cs);
    if (!Number.isFinite(cs) || cs < 0 || cs > 40) throw bad();
    if (d.expedite !== undefined && (!Number.isFinite(Number(d.expedite)) || Number(d.expedite) < 0 || Number(d.expedite) > 3000)) throw bad();
  } else {
    inList('clearance', [0, 30, 50]);
    inList('refund', ['fast', 'slow']);
    if (!Array.isArray(d.diagnosis) || d.diagnosis.length !== 2 || d.diagnosis.some((k) => !PD_COSTS.includes(k as PdCost)) || d.diagnosis[0] === d.diagnosis[1]) throw bad('Pick exactly two different cost lines.', 'Chọn đúng hai khoản chi phí khác nhau.');
  }
  return cleanPd(d as PdDecision, round);
}

export function pdBadges(state: PdState, id: string, order: string[]): string[] {
  const c = state.cos[id]!;
  const out: string[] = [];
  if (c.diagnosisHits === 2) out.push('doctor');
  if (c.stockouts === 0) out.push('nostockout');
  if (c.deadShare < 0.1) out.push('lean');
  if (c.rating >= 4.6) out.push('stars');
  if (!c.codPolicies.includes('a')) out.push('codsmart');
  const best = order.slice().sort((a, b) => state.cos[b]!.profitCum - state.cos[a]!.profitCum)[0];
  if (best === id) out.push('profit');
  return out;
}

export const PEAK_DAY: RsGame<PdDecision, PdState, PdReport, PdView> = {
  id: 'peak-day',
  rounds: PD_ROUNDS,
  label: 'Peak Day Ops 11.11',
  botNames: ['SaleKing', 'FlashMart', 'MegaDeal', 'DealHub', 'ShopNow', 'BigSale'],
  archetypes: ['overstock', 'codall', 'understock', 'discounter', 'balanced', 'pro'],
  defaultSettings: { decideSec: 240, resultsSec: 0, botLevel: 'medium', fillBots: true },
  init: (order, _room, rng) => initPd(order, rng),
  validate: (raw, round) => validatePd(raw, round),
  fallback: (_s, _id, round, last) =>
    cleanPd(
      round === 1 ? { stock: 3500, fulfil: '3pl', speed: 'fast', returns: '7day', fraud: 'basic', cod: 'confirm' } : round <= 4 ? { cod: last?.cod ?? 'confirm', cs: last?.cs ?? 6, discount: last?.discount ?? 10, ads: last?.ads ?? 0 } : { clearance: 30, refund: 'slow', apology: false, diagnosis: [] },
      round,
    ),
  bot: (arch, level, state, id, round, rng) => pdBot(arch as PdArchetype, level, state.cos[id]!, round, rng),
  simulate: (state, order, inputs, round, rng) => {
    const out = simulatePd(state, order, inputs, round, rng);
    return { ...out, pub: pdPub(state, order, round) as unknown as Record<string, unknown> };
  },
  scorecard: (state, id, finished) => pdScorecard(state.cos[id]!, finished),
  cols: (state, id) => {
    const c = state.cos[id]!;
    return { profitCum: r1(c.profitCum), orders: Math.round(c.orders), rating: r2(c.rating), stock: Math.round(c.stock) };
  },
  view: (state, id) => {
    const c = state.cos[id]!;
    return {
      stock: Math.round(c.stock),
      incoming: Math.round(c.incoming),
      rating: r2(c.rating),
      setup: c.bought ? { fulfil: c.fulfil, speed: c.speed, returns: c.returnsPolicy, fraud: c.fraud } : null,
      totals: Object.fromEntries(PD_COSTS.map((k) => [k, r1(c.totals[k])])) as Record<PdCost, number>,
      ordersTotal: Math.round(c.orders),
      revenueTotal: r1(c.revenue),
      pendingReturns: Math.round(c.pendingReturns),
      profitCum: r1(c.profitCum),
    };
  },
  badges: pdBadges,
  pub: (state, order) => pdPub(state, order, 0) as unknown as Record<string, unknown>,
};
