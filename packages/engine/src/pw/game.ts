// Game 2 – Platform Wars: the hidden two-sided market model, the AI platforms and the scorecard (server only).
import { GameError } from '../room.js';
import type { Rng } from '../rng.js';
import type { RsGame, RsInput } from '../rs/room.js';
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';
import {
  PW_ADS_INFO,
  PW_BUYER_POOL,
  PW_MAX_SUBSIDY,
  PW_MAX_TRUST,
  PW_ROUNDS,
  PW_SELLER_POOL,
  PW_START_BUYERS,
  PW_START_CASH,
  PW_START_SELLERS,
  PW_TAKE_MAX,
  PW_TAKE_MIN,
  type PwAds,
  type PwArchetype,
  type PwDecision,
  type PwKpis,
  type PwPub,
  type PwReport,
  type PwView,
} from './types.js';

export interface PwCo {
  buyers: number;
  hunters: number;
  sellers: number;
  cash: number;
  profitCum: number;
  trustStock: number;
  ownBrand: boolean;
  gmvLast: number;
  share: number;
  healthSum: number;
  counterfeitSum: number;
  leakSum: number;
  takeSum: number;
  rounds: number;
  minCash: number;
  maxBuyers: number;
}
export interface PwState {
  cos: Record<string, PwCo>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Vietnamese decimal comma. */
const vn = (v: number) => String(v).replace('.', ',');

// Model constants (tuned with scripts/balance-pw.ts).
const TAU = 0.5;
const BUYER_OUTSIDE = 3.34;
const SELLER_OUTSIDE = 2.52;
const MH_BUYERS = 2; // a buyer uses about two apps
const MH_SELLERS = 1.5; // multi-homing is costlier for sellers
const SPEND = 1.0; // bn VND per thousand loyal buyers per quarter at full selection
const HUNTER_SPEND = 0.4;
const HUNTERS_PER_BN = 10; // thousand voucher hunters per bn of buyer subsidy

export function pwTrustNeed(gmv: number) {
  return 0.012 * gmv + 0.3;
}
export function pwLeakage(take: number, trustStock: number, round: number) {
  return clamp(Math.max(0, take / 100 - 0.07) * 2.2 * (1 - 0.5 * trustStock) * (round === 5 ? 1.6 : 1), 0, 0.5);
}

export function initPw(order: string[]): PwState {
  const cos: Record<string, PwCo> = {};
  for (const id of order)
    cos[id] = {
      buyers: PW_START_BUYERS,
      hunters: 0,
      sellers: PW_START_SELLERS,
      cash: PW_START_CASH,
      profitCum: 0,
      trustStock: 0.5,
      ownBrand: false,
      gmvLast: 28,
      share: 1 / order.length,
      healthSum: 0,
      counterfeitSum: 0,
      leakSum: 0,
      takeSum: 0,
      rounds: 0,
      minCash: PW_START_CASH,
      maxBuyers: PW_START_BUYERS,
    };
  return { cos };
}

const softmaxShares = (vals: number[], outside: number) => {
  const ex = vals.map((v) => Math.exp(v / TAU));
  const total = ex.reduce((a, b) => a + b, 0) + Math.exp(outside / TAU);
  return ex.map((e) => e / total);
};

export function simulatePw(state: PwState, order: string[], inputs: Record<string, RsInput<PwDecision>>, round: number) {
  const pre: Record<string, { d: PwDecision; subB: number; subS: number; counterfeit: number; notes: T[]; cut: boolean }> = {};
  for (const id of order) {
    const c = state.cos[id]!;
    const d = { ...inputs[id]!.decision };
    const notes: T[] = [];
    let cut = false;
    if (c.cash <= 0 && (d.subsidy > 0 || d.trust > 0.5)) {
      d.subsidy = 0;
      d.trust = Math.min(d.trust, 0.5);
      cut = true;
      notes.push(tx('Out of cash: the bank blocked your subsidies and capped trust & safety at 0.5 bn.', 'Hết tiền mặt: ngân hàng chặn trợ giá và giới hạn chi an toàn – tin cậy ở 0,5 tỷ.'));
    }
    if (round >= 4 && d.ownBrand) c.ownBrand = true;
    c.trustStock = 0.5 * c.trustStock + 0.5 * Math.min(1, d.trust / pwTrustNeed(c.gmvLast));
    const counterfeit = (1 - c.trustStock) * Math.min(1, c.sellers / 2500) * 0.35;
    const subS = (d.subsidy * d.toSellers) / 100;
    pre[id] = { d, subB: d.subsidy - subS, subS, counterfeit, notes, cut };
  }
  // Both sides react to the platforms as they were at the start of the quarter.
  const aB = order.map((id) => {
    const c = state.cos[id]!;
    const { d, subB, counterfeit } = pre[id]!;
    return Math.log(1 + c.sellers / 150) + 0.25 * Math.log(1 + (subB * 50) / Math.max(40, c.buyers)) + (d.program === 'vip' ? 0.35 : 0) - 0.3 * d.ads - 4 * counterfeit + 0.3 * c.trustStock - 3 * Math.max(0, d.take / 100 - 0.1) + (c.ownBrand ? 0.1 : 0);
  });
  const aS = order.map((id) => {
    const c = state.cos[id]!;
    const { d, subS } = pre[id]!;
    const effB = c.buyers + 0.4 * c.hunters;
    const density = c.sellers / Math.max(1, effB);
    return Math.log(1 + effB / 20) - 8 * (d.take / 100) - 0.35 * d.ads + 0.5 * Math.log(1 + (subS * 500) / Math.max(400, c.sellers)) + (d.program === 'tiers' ? 0.3 : 0) + 0.2 * c.trustStock - (c.ownBrand ? 0.5 : 0) - 0.08 * Math.max(0, density - 12);
  });
  const pB = softmaxShares(aB, BUYER_OUTSIDE + (round === 3 ? 0.4 : 0));
  const pS = softmaxShares(aS, SELLER_OUTSIDE);
  const pool = PW_BUYER_POOL * (round === 2 ? 1.2 : 1);
  const gmv: Record<string, number> = {};
  const kp: Record<string, Omit<PwKpis, 'share'>> = {};
  order.forEach((id, k) => {
    const c = state.cos[id]!;
    const { d, subB, counterfeit, notes } = pre[id]!;
    const targetB = Math.min(0.65 * pool, pool * MH_BUYERS * pB[k]!);
    const lamB = targetB < c.buyers ? (d.program === 'vip' ? 0.3 : 0.5) : 0.5;
    const selBefore = c.sellers / Math.max(1, c.buyers);
    const converted = 0.15 * c.hunters * Math.min(1, selBefore / 8);
    c.buyers = Math.max(2, c.buyers + lamB * (targetB - c.buyers) + converted);
    c.hunters = HUNTERS_PER_BN * subB;
    const targetS = Math.min(0.9 * PW_SELLER_POOL, PW_SELLER_POOL * MH_SELLERS * pS[k]!);
    const lamS = targetS < c.sellers && d.program === 'tiers' ? 0.18 : 0.35;
    c.sellers = Math.max(20, c.sellers + lamS * (targetS - c.sellers));
    const sel = c.sellers / (c.sellers + 4 * c.buyers);
    const spend = SPEND * sel * (d.program === 'vip' ? 1.12 : 1) * (round === 2 ? 1.15 : 1) * (1 - 1.5 * counterfeit);
    const gross = c.buyers * spend + c.hunters * HUNTER_SPEND;
    const leakage = pwLeakage(d.take, c.trustStock, round);
    const gmvOn = gross * (1 - leakage);
    const adRate = PW_ADS_INFO[d.ads].rate;
    const takeRev = gmvOn * (d.take / 100);
    const adRev = gmvOn * adRate;
    const programRev = d.program === 'vip' ? 0.02 * (c.buyers / 10) : 0;
    const programCost = d.program === 'vip' ? 0.008 * gmvOn : d.program === 'tiers' ? 0.01 * gmvOn : 0;
    const ownRev = c.ownBrand ? 0.025 * gmvOn : 0;
    const opex = 1.2 + 0.012 * gmvOn;
    const revenue = takeRev + adRev + programRev + ownRev;
    const profit = revenue - d.subsidy - d.trust - programCost - opex;
    c.cash += profit;
    c.profitCum += profit;
    c.gmvLast = gmvOn;
    c.minCash = Math.min(c.minCash, c.cash);
    c.maxBuyers = Math.max(c.maxBuyers, c.buyers);
    const sellerCost = d.take / 100 + adRate + 0.02;
    const health = clamp((1 - 2 * counterfeit) * (1 - 2 * leakage) * (sellerCost > 0.2 ? 0.8 : 1), 0, 1);
    c.healthSum += health;
    c.counterfeitSum += counterfeit;
    c.leakSum += leakage;
    c.takeSum += d.take;
    c.rounds++;
    gmv[id] = gmvOn;
    const selection = c.sellers / Math.max(1, c.buyers);
    if (leakage >= 0.08) notes.push(tx(`Leakage: ${Math.round(leakage * 100)}% of deals closed off-platform – your take rate is above what your escrow and services justify.`, `Rò rỉ: ${Math.round(leakage * 100)}% giao dịch chốt ngoài sàn – phí sàn cao hơn giá trị bảo vệ giao dịch và dịch vụ bạn mang lại.`));
    if (counterfeit >= 0.05) notes.push(tx('Counterfeits are spreading among your many sellers (negative same-side effect). Buyers notice. Raise trust & safety.', 'Hàng giả lan ra trong số đông người bán (hiệu ứng cùng phía tiêu cực). Người mua đã nhận ra. Hãy tăng chi an toàn – tin cậy.'));
    if (subB >= 2 && selection < 6) notes.push(tx('Many voucher hunters, little selection: most of them will not come back without vouchers.', 'Nhiều người săn voucher nhưng ít lựa chọn: phần lớn sẽ không quay lại khi hết voucher.'));
    if (selection < 5) notes.push(tx(`Only ${r1(selection)} sellers per thousand buyers: selection is your bottleneck – the scarce side is sellers.`, `Chỉ ${vn(r1(selection))} người bán trên một nghìn người mua: lựa chọn là nút thắt – phía khan hiếm là người bán.`));
    if (selection > 16) notes.push(tx(`${r1(selection)} sellers per thousand buyers: sellers are fighting a price war for too few buyers – the scarce side is buyers.`, `${vn(r1(selection))} người bán trên một nghìn người mua: người bán đang đua giá vì quá ít người mua – phía khan hiếm là người mua.`));
    if (d.ads === 2) notes.push(tx('Heavy ads: the first results are sponsored – buyers see fewer real products (cross-side negative).', 'Quảng cáo dày: kết quả đầu là quảng cáo – người mua thấy ít sản phẩm thật hơn (hiệu ứng chéo tiêu cực).'));
    kp[id] = {
      buyers: r1(c.buyers),
      hunters: r1(c.hunters),
      sellers: Math.round(c.sellers),
      selection: r1(selection),
      gmv: r1(gross),
      leakage: r3(leakage),
      gmvLost: r1(gross - gmvOn),
      counterfeit: r3(counterfeit),
      takeRev: r2(takeRev),
      adRev: r2(adRev),
      programRev: r2(programRev),
      ownRev: r2(ownRev),
      revenue: r2(revenue),
      subsidy: d.subsidy,
      trust: d.trust,
      programCost: r2(programCost),
      opex: r2(opex),
      profit: r2(profit),
      cash: r2(c.cash),
      sellerCost: r3(sellerCost),
      health: r3(health),
    };
  });
  const totalGmv = Object.values(gmv).reduce((a, b) => a + b, 0) || 1;
  const reports: Record<string, PwReport> = {};
  const values: Record<string, number> = {};
  for (const id of order) {
    const c = state.cos[id]!;
    c.share = gmv[id]! / totalGmv;
    reports[id] = { round, decision: pre[id]!.d, defaulted: inputs[id]!.defaulted, kpis: { ...kp[id]!, share: r3(c.share) }, notes: pre[id]!.notes };
    values[id] = kp[id]!.profit;
  }
  const leader = order.slice().sort((a, b) => gmv[b]! - gmv[a]!)[0]!;
  const lead = state.cos[leader]!;
  const news: T[] = [
    tx(`Market GMV this quarter: ${r1(totalGmv)} bn. Leader holds ${Math.round(lead.share * 100)}% of GMV.`, `GMV toàn thị trường quý này: ${vn(r1(totalGmv))} tỷ. Sàn dẫn đầu chiếm ${Math.round(lead.share * 100)}% GMV.`),
  ];
  const top = order.filter((id) => state.cos[id]!.share >= 0.35);
  if (top.length) news.push(tx('Tipping point in sight: one platform is pulling away – but buyers still multi-home.', 'Sắp tới điểm bùng phát: một sàn đang bứt lên – nhưng người mua vẫn dùng nhiều sàn.'));
  return { reports, values, news };
}

export function pwPub(state: PwState, order: string[], lastTake: Record<string, number>): PwPub {
  const pick = (f: (c: PwCo) => number) => Object.fromEntries(order.map((id) => [id, f(state.cos[id]!)]));
  return { share: pick((c) => r3(c.share)), buyers: pick((c) => r1(c.buyers)), sellers: pick((c) => Math.round(c.sellers)), take: Object.fromEntries(order.map((id) => [id, lastTake[id] ?? 0])) };
}

/** Absolute scorecard, 0–100. */
export function pwScorecard(c: PwCo) {
  const p = c.profitCum;
  const profit = p >= 0 ? 18 + 27 * Math.min(1, p / 40) : 18 * Math.max(0, 1 + p / 30);
  // Investors pay less for GMV share bought with losses.
  const share = 25 * Math.min(1, c.share / 0.4) * clamp(0.6 + p / 25, 0.4, 1);
  const avgHealth = c.rounds ? c.healthSum / c.rounds : 0.9;
  const health = 30 * clamp((avgHealth - 0.5) / 0.45, 0, 1);
  return { total: profit + share + health, parts: { profit: r1(profit), share: r1(share), health: r1(health) } };
}

// ---------- AI platforms ----------
const step = (v: number, s: number) => Math.round(v / s) * s;

export function pwBot(arch: PwArchetype, level: BotLevel, c: PwCo, round: number, rng: Rng): PwDecision {
  const need = pwTrustNeed(c.gmvLast);
  const density = c.sellers / Math.max(1, c.buyers);
  let d: PwDecision;
  switch (arch) {
    case 'burn':
      d = { take: 3, subsidy: Math.min(8, Math.max(0, c.cash * 0.4)), toSellers: 30, ads: 0, trust: 0.5, program: 'vip' };
      break;
    case 'toll':
      d = { take: 16, subsidy: 1, toSellers: 50, ads: 2, trust: 0.5, program: 'none', ownBrand: round >= 4 };
      break;
    case 'buyers':
      d = { take: 8, subsidy: 4, toSellers: 0, ads: 1, trust: 0.75, program: 'vip' };
      break;
    case 'sellers':
      d = { take: round <= 2 ? 2 : 8, subsidy: round <= 2 ? 5 : 2, toSellers: round <= 2 ? 90 : 50, ads: round >= 4 ? 1 : 0, trust: 0.75, program: 'tiers' };
      break;
    case 'smart': {
      const big = c.share > 0.25;
      d = {
        take: round <= 2 ? 5 : big ? (round === 5 ? 8 : 10) : 7,
        subsidy: Math.min(round <= 2 ? 5 : round <= 4 ? 3 : 1.5, Math.max(0, c.cash / 3)),
        toSellers: density < 9 ? 80 : density > 13 ? 20 : 50,
        ads: big && round >= 3 ? 1 : 0,
        trust: need,
        program: round === 3 ? 'vip' : 'tiers',
      };
      break;
    }
    default:
      d = { take: round <= 2 ? 5 : 9, subsidy: round <= 2 ? 4 : 2, toSellers: 60, ads: round >= 3 ? 1 : 0, trust: need, program: 'tiers' };
  }
  const noise = level === 'easy' ? 1 : level === 'medium' ? 0.4 : 0;
  if (noise > 0) {
    d.take += Math.round((rng() - 0.5) * 6 * noise);
    d.subsidy *= 1 + (rng() - 0.5) * noise;
    d.trust *= 1 - 0.5 * noise * rng();
    if (level === 'easy' && rng() < 0.3) d.ads = Math.min(2, d.ads + 1) as PwAds;
  }
  return cleanPw(d, round);
}

function cleanPw(d: PwDecision, round: number): PwDecision {
  const out: PwDecision = {
    take: clamp(Math.round(d.take), PW_TAKE_MIN, PW_TAKE_MAX),
    subsidy: clamp(step(d.subsidy, 0.5), 0, PW_MAX_SUBSIDY),
    toSellers: clamp(step(d.toSellers, 10), 0, 100),
    ads: ([0, 1, 2] as const).includes(d.ads) ? d.ads : 0,
    trust: clamp(step(d.trust, 0.25), 0, PW_MAX_TRUST),
    program: d.program,
  };
  if (round >= 4) out.ownBrand = !!d.ownBrand;
  return out;
}

const E = (en: string, vi: string) => ({ en, vi });

export function validatePw(raw: unknown, round: number): PwDecision {
  const bad = () => new GameError('bad_decision', E('Invalid plan – please check every field.', 'Kế hoạch không hợp lệ – vui lòng kiểm tra từng mục.'));
  if (!raw || typeof raw !== 'object') throw bad();
  const d = raw as Record<string, unknown>;
  const num = (k: string, lo: number, hi: number) => {
    const v = Number(d[k]);
    if (!Number.isFinite(v) || v < lo || v > hi) throw bad();
    return v;
  };
  const ads = Number(d.ads);
  if (![0, 1, 2].includes(ads)) throw bad();
  if (!['none', 'vip', 'tiers'].includes(String(d.program))) throw bad();
  return cleanPw(
    {
      take: num('take', PW_TAKE_MIN, PW_TAKE_MAX),
      subsidy: num('subsidy', 0, PW_MAX_SUBSIDY),
      toSellers: num('toSellers', 0, 100),
      ads: ads as PwAds,
      trust: num('trust', 0, PW_MAX_TRUST),
      program: d.program as PwDecision['program'],
      ownBrand: d.ownBrand === true,
    },
    round,
  );
}

export function pwBadges(state: PwState, id: string, order: string[]): string[] {
  const c = state.cos[id]!;
  const out: string[] = [];
  const n = Math.max(1, c.rounds);
  if (c.maxBuyers >= 200) out.push('flywheel');
  const byProfit = order.slice().sort((a, b) => state.cos[b]!.profitCum - state.cos[a]!.profitCum);
  if (c.profitCum > 0 && byProfit.indexOf(id) < 2) out.push('profit');
  if (c.counterfeitSum / n < 0.03) out.push('clean');
  const avgTake = c.takeSum / n;
  if (avgTake >= 5 && avgTake <= 12 && c.leakSum / n < 0.05) out.push('fair');
  const byShare = order.slice().sort((a, b) => state.cos[b]!.share - state.cos[a]!.share);
  if (byShare[0] === id) out.push('leader');
  if (c.minCash > 0) out.push('survivor');
  return out;
}

export const PLATFORM_WARS: RsGame<PwDecision, PwState, PwReport, PwView> = {
  id: 'platform-wars',
  rounds: PW_ROUNDS,
  label: 'Platform Wars',
  botNames: ['ChoTot+', 'MuaNhanh', 'SanVang', 'Lazy Mall', 'TikiTaka', 'HaNoiHub'],
  archetypes: ['burn', 'toll', 'buyers', 'balanced', 'sellers', 'smart'],
  defaultSettings: { decideSec: 300, resultsSec: 0, botLevel: 'medium', fillBots: true },
  init: (order) => initPw(order),
  validate: (raw, round) => validatePw(raw, round),
  fallback: (_s, _id, round, last) => cleanPw(last ?? { take: 8, subsidy: 1, toSellers: 50, ads: 0, trust: 0.5, program: 'none' }, round),
  bot: (arch, level, state, id, round, rng) => pwBot(arch as PwArchetype, level, state.cos[id]!, round, rng),
  simulate: (state, order, inputs, round) => {
    const out = simulatePw(state, order, inputs, round);
    const takes = Object.fromEntries(order.map((id) => [id, inputs[id]!.decision.take]));
    return { ...out, pub: pwPub(state, order, takes) as unknown as Record<string, unknown> };
  },
  scorecard: (state, id) => pwScorecard(state.cos[id]!),
  cols: (state, id) => {
    const c = state.cos[id]!;
    return { share: r3(c.share), profitCum: r2(c.profitCum), buyers: r1(c.buyers), sellers: Math.round(c.sellers), cash: r2(c.cash) };
  },
  flag: (state, id) => (state.cos[id]!.cash < 0 ? 'bankrupt' : undefined),
  view: (state, id) => {
    const c = state.cos[id]!;
    return { cash: r2(c.cash), buyers: r1(c.buyers), sellers: Math.round(c.sellers), ownBrand: c.ownBrand };
  },
  badges: pwBadges,
  pub: (state, order) => pwPub(state, order, {}) as unknown as Record<string, unknown>,
};
