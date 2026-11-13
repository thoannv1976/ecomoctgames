// Game 7 – Ad Auction & Creator Clash: GSP search auction, creators with hidden fake followers,
// retargeting that harvests, livestream discounts that train customers to wait, CRM, holdout tests (server only).
import { GameError } from '../room.js';
import { shuffle, type Rng } from '../rng.js';
import type { RsGame, RsInput } from '../rs/room.js';
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';
import {
  AD_AOV,
  AD_BE_ROAS,
  AD_BUDGET,
  AD_CHANNELS,
  AD_CHANNEL_INFO,
  AD_HOLDOUT_COST,
  AD_LIVE_FEE,
  AD_MARGIN,
  AD_MAX_CREATORS,
  AD_QUALITY_COST,
  AD_ROUNDS,
  type AdArchetype,
  type AdChannel,
  type AdChannelResult,
  type AdCreatorPublic,
  type AdCrm,
  type AdDecision,
  type AdPub,
  type AdReport,
  type AdTier,
  type AdView,
} from './types.js';

interface CreatorDef {
  id: string;
  handle: string;
  tier: AdTier;
  followers: number; // thousand
  fake: number; // share of fake followers
  viewRate: number; // share of real followers who watch a video
  ctr: number;
  cr: number;
  fee: number;
  niche: T;
}
/** Twelve creators; four of them have many fake followers. */
const CREATORS: CreatorDef[] = [
  { id: 'lan', handle: '@lan.review.da', tier: 'micro', followers: 48, fake: 0.05, viewRate: 0.35, ctr: 0.05, cr: 0.06, fee: 40, niche: tx('Honest skin-care reviews', 'Review chăm da thật thà') },
  { id: 'queen', handle: '@beautyqueen.vn', tier: 'macro', followers: 2100, fake: 0.45, viewRate: 0.06, ctr: 0.012, cr: 0.02, fee: 380, niche: tx('Lifestyle celebrity', 'Người nổi tiếng phong cách sống') },
  { id: 'thuha', handle: '@thuha_skincare', tier: 'micro', followers: 85, fake: 0.08, viewRate: 0.28, ctr: 0.045, cr: 0.055, fee: 55, niche: tx('Acne-prone skin routines', 'Quy trình cho da mụn') },
  { id: 'mebim', handle: '@me.bim.sua', tier: 'nano', followers: 8, fake: 0.03, viewRate: 0.5, ctr: 0.06, cr: 0.07, fee: 12, niche: tx('Young mums, gentle products', 'Mẹ bỉm, sản phẩm dịu nhẹ') },
  { id: 'trendy', handle: '@trendy.min', tier: 'mid', followers: 320, fake: 0.55, viewRate: 0.12, ctr: 0.02, cr: 0.02, fee: 130, niche: tx('Trends & giveaways', 'Xu hướng & quà tặng') },
  { id: 'drda', handle: '@dr.da.lieu', tier: 'mid', followers: 260, fake: 0.04, viewRate: 0.16, ctr: 0.035, cr: 0.06, fee: 150, niche: tx('Dermatologist explains ingredients', 'Bác sĩ da liễu giải thích thành phần') },
  { id: 'khoe', handle: '@khoe.dep.247', tier: 'micro', followers: 92, fake: 0.6, viewRate: 0.2, ctr: 0.02, cr: 0.02, fee: 45, niche: tx('Beauty tips daily', 'Mẹo làm đẹp mỗi ngày') },
  { id: 'goc', handle: '@goc.nha.cua.em', tier: 'nano', followers: 6, fake: 0.02, viewRate: 0.45, ctr: 0.05, cr: 0.05, fee: 10, niche: tx('Small-apartment lifestyle', 'Cuộc sống căn hộ nhỏ') },
  { id: 'lam', handle: '@sieu.thi.lam', tier: 'macro', followers: 950, fake: 0.06, viewRate: 0.1, ctr: 0.02, cr: 0.035, fee: 300, niche: tx('Big unboxings and hauls', 'Mở hộp và săn hàng số lượng lớn') },
  { id: 'that', handle: '@review.that.that', tier: 'micro', followers: 60, fake: 0.06, viewRate: 0.3, ctr: 0.05, cr: 0.05, fee: 42, niche: tx('Before/after with no filters', 'Trước/sau không filter') },
  { id: 'unbox', handle: '@hotgirl.unbox', tier: 'mid', followers: 410, fake: 0.45, viewRate: 0.1, ctr: 0.018, cr: 0.02, fee: 140, niche: tx('Unboxing everything', 'Mở hộp mọi thứ') },
  { id: 'tunhien', handle: '@duong.da.tu.nhien', tier: 'micro', followers: 35, fake: 0.04, viewRate: 0.32, ctr: 0.05, cr: 0.06, fee: 30, niche: tx('Natural skin care', 'Dưỡng da tự nhiên') },
];
const CREATOR = Object.fromEntries(CREATORS.map((c) => [c.id, c]));

export function creatorPublic(c: CreatorDef, round: number): AdCreatorPublic {
  // Fake followers: views look ok on paper, but engagement is low or pod-like, comments generic, growth spiky.
  const purge = round >= 3 ? 0.4 : 1;
  const fakeNow = c.fake * purge;
  const avgViews = c.followers * FYP * (c.viewRate * (1 - c.fake) + fakeNow * 0.15);
  const realShare = (c.viewRate * (1 - c.fake)) / (c.viewRate * (1 - c.fake) + fakeNow * 0.15);
  const er = 0.02 + 0.07 * realShare + (c.fake > 0.5 ? 0.04 : 0);
  return {
    id: c.id,
    handle: c.handle,
    tier: c.tier,
    followers: Math.round(c.followers * (round >= 3 ? 1 - c.fake * 0.6 : 1)),
    avgViews: Math.round(avgViews * 10) / 10,
    er: Math.round(er * 1000) / 1000,
    generic: Math.round((0.12 + c.fake * 1.1) * 100) / 100,
    growth: Math.round((0.03 + c.fake * 0.5) * 100) / 100,
    fee: c.fee,
    niche: c.niche,
  };
}

export interface AdCo {
  qualityStock: number;
  awareness: number;
  wait: number;
  customers: number; // thousand
  profitCum: number;
  extraCum: number;
  beRoas: number | null;
  fakesBooked: number;
  holdouts: number;
  retargetShareSum: number;
  rounds: number;
  bestPosition: number;
  avgBid: number;
  incremental: Partial<Record<AdChannel, number>>;
}
export interface AdState {
  cos: Record<string, AdCo>;
  /** Creator ids available each month, comma-joined (Firestore cannot store nested arrays). */
  rosters: string[];
  lastPub: { position: Record<string, number>; cpc: Record<string, number>; bookings: Record<string, string>; spend: Record<string, number> };
}

/** For-you-page reach: a video is seen by far more people than the creator's followers. */
const FYP = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const CONTRIB = AD_AOV * AD_MARGIN; // 0.2m per full-price order
const ORGANIC = 4000;
const BASE_PROFIT = ORGANIC * CONTRIB;

export function initAd(order: string[], rng: Rng): AdState {
  const cos: Record<string, AdCo> = {};
  for (const id of order) cos[id] = { qualityStock: 0, awareness: 0, wait: 0, customers: 4, profitCum: 0, extraCum: 0, beRoas: null, fakesBooked: 0, holdouts: 0, retargetShareSum: 0, rounds: 0, bestPosition: 99, avgBid: 0, incremental: {} };
  // Each month 7 of the 12 creators are available; at least two fakes every month.
  const rosters: string[] = [];
  for (let r = 1; r <= AD_ROUNDS; r++) {
    const fakes = shuffle(rng, CREATORS.filter((c) => c.fake > 0.3)).slice(0, 2);
    const real = shuffle(rng, CREATORS.filter((c) => c.fake <= 0.3)).slice(0, 5);
    rosters.push(shuffle(rng, [...fakes, ...real]).map((c) => c.id).join(','));
  }
  return { cos, rosters, lastPub: { position: {}, cpc: {}, bookings: {}, spend: {} } };
}
const rosterOf = (s: AdState, round: number): string[] => (s.rosters[round - 1] ?? '').split(',').filter(Boolean);

export function spendOf(d: AdDecision) {
  const creatorFees = d.creators.reduce((a, id) => a + (CREATOR[id]?.fee ?? 0) * (d.premium ? 1.2 : 1), 0);
  return d.searchBudget + AD_QUALITY_COST[d.quality]! + creatorFees + d.retarget + (d.liveHours / 2) * AD_LIVE_FEE + (d.crm === 'rfm' ? 30 : d.crm === 'blast' ? 10 : 0) + (d.holdout !== 'none' ? AD_HOLDOUT_COST : 0);
}

export function simulateAd(state: AdState, order: string[], inputs: Record<string, RsInput<AdDecision>>, round: number, rng: Rng) {
  const sale = round === 4;
  // ---- 1. Search auction (generalised second price, rank = bid × quality score) ----
  for (const id of order) {
    const c = state.cos[id]!;
    const q = inputs[id]!.decision.quality;
    c.qualityStock = clamp(c.qualityStock * 0.85 + (q === 2 ? 1 : q === 1 ? 0.5 : 0), 0, 2);
  }
  const qsOf = (id: string) => Math.round((5 + 2 * state.cos[id]!.qualityStock) * 10) / 10;
  const bidders = order.filter((id) => inputs[id]!.decision.searchBudget > 0);
  const entries = bidders.map((id) => ({ id, qs: qsOf(id), rank: inputs[id]!.decision.bid * qsOf(id) }));
  if (round >= 2) entries.push({ id: '__pharmacy', qs: 7, rank: 6 * 7 });
  entries.sort((a, b) => b.rank - a.rank || rng() - 0.5);
  const queries = 2_000_000 * (sale ? 1.5 : 1);
  const SLOT_CTR = [0.05, 0.035, 0.025, 0.015];
  const search: Record<string, { pos: number | null; cpc: number; clicks: number; cost: number }> = {};
  entries.forEach((e, k) => {
    if (e.id === '__pharmacy') return;
    const d = inputs[e.id]!.decision;
    if (k >= SLOT_CTR.length) {
      search[e.id] = { pos: null, cpc: 0, clicks: 0, cost: 0 };
      return;
    }
    const next = entries[k + 1];
    const cpc = Math.min(d.bid, Math.max(0.5, (next ? next.rank : 0.5 * e.qs) / e.qs + 0.01));
    const clicks = Math.min(queries * SLOT_CTR[k]!, (d.searchBudget * 1000) / cpc);
    search[e.id] = { pos: k + 1, cpc: r2(cpc), clicks: Math.round(clicks), cost: (clicks * cpc) / 1000 };
  });
  for (const id of order) search[id] ??= { pos: null, cpc: 0, clicks: 0, cost: 0 };

  // ---- 2. Creator bookings (conflicts: premium first, then random) ----
  const roster = rosterOf(state, round);
  const wants: Record<string, string[]> = {};
  for (const id of order) for (const cid of inputs[id]!.decision.creators) if (roster.includes(cid)) (wants[cid] ??= []).push(id);
  const bookedBy: Record<string, string> = {};
  for (const [cid, list] of Object.entries(wants)) {
    const sorted = shuffle(rng, list).sort((a, b) => Number(inputs[b]!.decision.premium) - Number(inputs[a]!.decision.premium));
    bookedBy[cid] = sorted[0]!;
  }

  const reports: Record<string, AdReport> = {};
  const values: Record<string, number> = {};
  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    const notes: T[] = [];
    if (round === 1 && d.beRoas !== undefined) c.beRoas = d.beRoas;
    const s = search[id]!;
    const qs = qsOf(id);
    const crS = 0.04 + 0.003 * qs;
    const searchOrders = s.clicks * crS;
    // Creators
    const booked = d.creators.filter((cid) => bookedBy[cid] === id);
    const lost = d.creators.filter((cid) => roster.includes(cid) && bookedBy[cid] !== id);
    let creatorFees = 0;
    let creatorOrders = 0;
    let creatorClicks = 0;
    let realViews = 0;
    for (const cid of booked) {
      const cr = CREATOR[cid]!;
      const purge = round >= 3 ? 0.6 : 1;
      const views = cr.followers * 1000 * FYP * cr.viewRate * (1 - cr.fake) * (sale ? 1.2 : 1);
      realViews += views;
      const clicks = views * cr.ctr;
      creatorClicks += clicks;
      creatorOrders += clicks * cr.cr * (cr.fake > 0.3 ? purge : 1);
      creatorFees += cr.fee * (d.premium ? 1.2 : 1);
      if (cr.fake > 0.3) {
        c.fakesBooked++;
        notes.push(tx(`${cr.handle}: many followers, few real buyers – ${Math.round(cr.fake * 100)}% of the audience looks fake.`, `${cr.handle}: nhiều follower nhưng ít người mua thật – ${Math.round(cr.fake * 100)}% khán giả có vẻ là ảo.`));
      }
    }
    if (d.searchBudget > 0 && !s.pos) notes.push(tx(`No search ad slot: your ad rank (bid ${d.bid}k × quality ${qs}) was below the top 4. Raise the bid or the quality score.`, `Không có vị trí quảng cáo tìm kiếm: thứ hạng (giá thầu ${String(d.bid).replace('.', ',')} nghìn × điểm chất lượng ${String(qs).replace('.', ',')}) thấp hơn top 4. Tăng giá thầu hoặc điểm chất lượng.`));
    if (lost.length) notes.push(tx(`Another brand booked ${lost.map((x) => CREATOR[x]!.handle).join(', ')} first (fee refunded).`, `Thương hiệu khác đã đặt ${lost.map((x) => CREATOR[x]!.handle).join(', ')} trước (hoàn phí).`));
    // Retargeting: harvests visitors created by the other channels.
    const pool = 0.6 * (s.clicks + creatorClicks + 60_000);
    const reach = Math.min(pool, (d.retarget * 1000) / 3);
    const rtIncremental = reach * 0.015 * (1 - 0.5 * (reach / Math.max(1, pool)));
    const rtReported = reach * 0.06;
    if (d.retarget > 0 && reach >= pool * 0.98) notes.push(tx('Retargeting ran out of people to retarget: the extra budget bought nothing. Feed the top of the funnel first.', 'Quảng cáo nhắm lại hết người để nhắm: ngân sách thêm không mua được gì. Hãy nuôi phễu phía trên trước.'));
    // Livestream
    const viewers = (d.liveHours / 2) * 20_000 * (1 + c.awareness) * (sale ? 2 : 1);
    const disc = d.liveDiscount / 100;
    const liveOrders = d.liveHours ? viewers * (0.02 + 0.1 * disc) : 0;
    const liveDiscountCost = liveOrders * AD_AOV * disc;
    if (d.liveHours && disc > 0) c.wait = clamp(c.wait + disc * 0.5, 0, 0.35);
    else c.wait = c.wait * 0.8;
    // CRM
    const baseRepeat = 0.08;
    const rate = d.crm === 'blast' ? 0.15 : d.crm === 'rfm' ? 0.13 : baseRepeat;
    const repeatOrders = c.customers * 1000 * rate * (1 - 0.5 * c.wait);
    const crmDiscountCost = d.crm === 'blast' ? repeatOrders * AD_AOV * 0.2 : d.crm === 'rfm' ? repeatOrders * 0.3 * AD_AOV * 0.1 : 0;
    if (d.crm === 'blast') c.wait = clamp(c.wait + 0.05, 0, 0.35);
    // Organic, cannibalised by channels that harvest existing intent.
    const organicBase = ORGANIC * (1 + c.awareness) * (1 - c.wait);
    const cannibal = 0.35 * searchOrders + 0.3 * liveOrders + 0.1 * creatorOrders;
    const organic = Math.max(organicBase * 0.3, organicBase - cannibal);
    const eaten = organicBase - organic;
    const orders = organic + searchOrders + creatorOrders + liveOrders + repeatOrders + rtIncremental;
    const revenue = orders * AD_AOV - liveDiscountCost - crmDiscountCost;
    const spend = s.cost + AD_QUALITY_COST[d.quality]! + creatorFees + d.retarget + (d.liveHours / 2) * AD_LIVE_FEE + (d.crm === 'rfm' ? 30 : d.crm === 'blast' ? 10 : 0) + (d.holdout !== 'none' ? AD_HOLDOUT_COST : 0);
    const discountCost = liveDiscountCost + crmDiscountCost;
    const profit = orders * CONTRIB - discountCost - spend;
    // Channel reports: what each tool claims (attributed), and the truth (incremental).
    const eatenBy = (x: number, k: number) => (cannibal > 0 ? (eaten * k * x) / cannibal : 0);
    const channel = (spendC: number, reportedOrders: number, incOrders: number): AdChannelResult & { inc: number } => ({
      spend: r1(spendC),
      reportedRevenue: r1(reportedOrders * AD_AOV),
      reportedRoas: spendC > 0 ? r2((reportedOrders * AD_AOV) / spendC) : 0,
      orders: Math.round(reportedOrders),
      inc: spendC > 0 ? (incOrders * AD_AOV) / spendC : 0,
    });
    const ch: Record<AdChannel, AdChannelResult & { inc: number }> = {
      search: channel(s.cost + AD_QUALITY_COST[d.quality]!, searchOrders * 1.05, searchOrders - eatenBy(searchOrders, 0.35)),
      creators: channel(creatorFees, creatorOrders * 1.7, creatorOrders - eatenBy(creatorOrders, 0.1)),
      retarget: channel(d.retarget, rtReported, rtIncremental),
      live: channel((d.liveHours / 2) * AD_LIVE_FEE + liveDiscountCost, liveOrders * 1.2, liveOrders - eatenBy(liveOrders, 0.3)),
      crm: channel((d.crm === 'rfm' ? 30 : d.crm === 'blast' ? 10 : 0) + crmDiscountCost, repeatOrders * 1.8, repeatOrders - c.customers * 1000 * baseRepeat * (1 - 0.5 * c.wait)),
    };
    let holdout: AdReport['holdout'] = null;
    if (d.holdout !== 'none') {
      const truth = ch[d.holdout].inc;
      const measured = r2(truth * (1 + 0.1 * (rng() * 2 - 1)));
      holdout = { channel: d.holdout, incrementalRoas: measured };
      c.incremental[d.holdout] = measured;
      c.holdouts++;
      notes.push(tx(`Holdout test on ${AD_CHANNEL_INFO[d.holdout].en}: true incremental ROAS ≈ ${measured} (reported ${ch[d.holdout].reportedRoas}).`, `Thử nghiệm đối chứng cho ${AD_CHANNEL_INFO[d.holdout].vi}: ROAS tăng thêm thật ≈ ${String(measured).replace('.', ',')} (báo cáo ${String(ch[d.holdout].reportedRoas).replace('.', ',')}).`));
    }
    // New customers and awareness for next month.
    const newCustomers = (searchOrders + creatorOrders + liveOrders + rtIncremental) * 0.6 / 1000;
    c.customers = c.customers * 0.92 + newCustomers;
    c.awareness = clamp(c.awareness * 0.8 + realViews / 20_000_000, 0, 0.6);
    const totalSpend = Math.max(1, spend);
    c.retargetShareSum += d.retarget / totalSpend;
    c.rounds++;
    if (s.pos) c.bestPosition = Math.min(c.bestPosition, s.pos);
    c.avgBid += d.bid;
    c.profitCum += profit;
    c.extraCum += profit - BASE_PROFIT;
    const sumReported = AD_CHANNELS.reduce((a, k) => a + ch[k].reportedRevenue, 0);
    if (sumReported > revenue * 1.3) notes.push(tx('Add up every channel report and you get far more than real revenue: each tool claims the same orders.', 'Cộng báo cáo các kênh lại sẽ ra con số lớn hơn nhiều so với doanh thu thật: mỗi công cụ đều nhận cùng những đơn hàng.'));
    if (round === 1 && c.beRoas !== null && Math.abs(c.beRoas - AD_BE_ROAS) > 0.25) notes.push(tx(`Break-even ROAS check: with a 40% contribution margin it is 1 ÷ 0.4 = 2.5 (you said ${c.beRoas}).`, `Kiểm tra ROAS hòa vốn: biên lợi nhuận đóng góp 40% thì là 1 ÷ 0,4 = 2,5 (bạn trả lời ${String(c.beRoas).replace('.', ',')}).`));
    if (d.liveHours && disc >= 0.2) notes.push(tx('Deep livestream discounts: customers start waiting for the next live sale – full-price sales fall.', 'Livestream giảm giá sâu: khách bắt đầu chờ phiên sale sau – doanh số giá gốc giảm.'));
    reports[id] = {
      round,
      decision: d,
      defaulted: inputs[id]!.defaulted,
      position: s.pos,
      qs,
      cpc: s.cpc,
      clicks: s.clicks,
      booked: booked.map((x) => CREATOR[x]!.handle),
      lostCreators: lost.map((x) => CREATOR[x]!.handle),
      channels: Object.fromEntries(AD_CHANNELS.map((k) => [k, { spend: ch[k].spend, reportedRoas: ch[k].reportedRoas, reportedRevenue: ch[k].reportedRevenue, orders: ch[k].orders }])) as Record<AdChannel, AdChannelResult>,
      organic: Math.round(organic),
      orders: Math.round(orders),
      revenue: r1(revenue),
      sumReported: r1(sumReported),
      spend: r1(spend),
      discountCost: r1(discountCost),
      blendedRoas: r2(revenue / totalSpend),
      profit: r1(profit),
      newCustomers: r1(newCustomers),
      customers: r1(c.customers),
      waitShare: r2(c.wait),
      holdout,
      notes,
    };
    values[id] = r1(profit);
  }
  state.lastPub = {
    position: Object.fromEntries(order.map((id) => [id, search[id]!.pos ?? 0])),
    cpc: Object.fromEntries(order.map((id) => [id, search[id]!.cpc])),
    bookings: Object.fromEntries(Object.entries(bookedBy).map(([cid, id]) => [CREATOR[cid]!.handle, id])),
    spend: Object.fromEntries(order.map((id) => [id, reports[id]!.spend])),
  };
  const news: T[] = [tx(`Search auction: ${order.filter((id) => search[id]!.pos).length} of 6 brands won an ad slot${round >= 2 ? ' (the pharmacy chain holds one)' : ''}.`, `Đấu giá tìm kiếm: ${order.filter((id) => search[id]!.pos).length}/6 thương hiệu có vị trí quảng cáo${round >= 2 ? ' (chuỗi nhà thuốc chiếm một vị trí)' : ''}.`)];
  return { reports, values, news };
}

export function adPub(state: AdState, round: number): AdPub {
  const next = Math.min(AD_ROUNDS, round + 1);
  return { roster: rosterOf(state, next).map((id) => creatorPublic(CREATOR[id]!, next)), ...state.lastPub };
}

function discipline(c: AdCo) {
  let d = 0;
  if (c.beRoas !== null && Math.abs(c.beRoas - AD_BE_ROAS) <= 0.25) d += 10;
  d += Math.max(0, 10 - 5 * c.fakesBooked);
  if (c.rounds && c.retargetShareSum / c.rounds <= 0.25) d += 5;
  if (c.holdouts > 0) d += 5;
  return d;
}

export function adScorecard(c: AdCo) {
  const profit = 50 * clamp(c.extraCum / 2500, 0, 1);
  const customers = 20 * clamp((c.customers - 4) / 16, 0, 1) * (1 - c.wait);
  const disc = discipline(c);
  return { total: profit + customers + disc, parts: { profit: r1(profit), customers: r1(customers), discipline: r1(disc) } };
}

// ---------- AI brands ----------
const step = (v: number, s: number) => Math.round(v / s) * s;

export function adBot(arch: AdArchetype, level: BotLevel, state: AdState, c: AdCo, round: number, rng: Rng): AdDecision {
  const roster = rosterOf(state, round);
  const pub = roster.map((id) => creatorPublic(CREATOR[id]!, round));
  const careful = pub.filter((p) => p.generic < 0.4 && p.growth < 0.15).sort((a, b) => b.avgViews / b.fee - a.avgViews / a.fee);
  const famous = pub.slice().sort((a, b) => b.followers - a.followers);
  let d: AdDecision;
  switch (arch) {
    case 'bidder':
      d = { bid: 10, searchBudget: 1000, quality: 0, creators: [], premium: false, retarget: 300, liveHours: 0, liveDiscount: 0, crm: 'none', holdout: 'none' };
      break;
    case 'celebrity':
      d = { bid: 3, searchBudget: 300, quality: 0, creators: famous.slice(0, 3).map((p) => p.id), premium: true, retarget: 200, liveHours: 2, liveDiscount: 10, crm: 'none', holdout: 'none' };
      break;
    case 'retarget':
      d = { bid: 4, searchBudget: 300, quality: 1, creators: [], premium: false, retarget: 900, liveHours: 0, liveDiscount: 0, crm: 'blast', holdout: 'none' };
      break;
    case 'discounter':
      d = { bid: 4, searchBudget: 400, quality: 0, creators: famous.slice(1, 2).map((p) => p.id), premium: false, retarget: 200, liveHours: 4, liveDiscount: 30, crm: 'blast', holdout: 'none' };
      break;
    case 'balanced':
      d = { bid: 5, searchBudget: 500, quality: 1, creators: careful.slice(0, 2).map((p) => p.id), premium: false, retarget: 200, liveHours: 2, liveDiscount: 10, crm: 'rfm', holdout: round === 2 ? 'retarget' : 'none' };
      break;
    default:
      d = {
        bid: 4,
        searchBudget: 500,
        quality: round <= 2 ? 2 : 1,
        creators: careful.slice(0, 3).map((p) => p.id),
        premium: round === 4,
        retarget: 150,
        liveHours: 2,
        liveDiscount: round === 4 ? 10 : 0,
        crm: 'rfm',
        holdout: round === 2 ? 'retarget' : round === 3 ? 'search' : 'none',
      };
  }
  if (round === 1) d.beRoas = arch === 'measurer' || arch === 'balanced' ? 2.5 : step(1.5 + rng() * 2.5, 0.5);
  const sloppy = level === 'easy' ? 0.5 : level === 'medium' ? 0.2 : 0;
  if (sloppy > 0) {
    if (rng() < sloppy) d.creators = [...new Set([...d.creators.slice(0, 2), famous[0]!.id])];
    if (rng() < sloppy) d.retarget = step(d.retarget * 1.8, 50);
    if (rng() < sloppy && d.beRoas !== undefined) d.beRoas = step(1.5 + rng() * 2.5, 0.5);
    if (rng() < sloppy) d.quality = 0;
  }
  return fitBudget(cleanAd(d, round));
}

function fitBudget(d: AdDecision): AdDecision {
  let guard = 0;
  while (spendOf(d) > AD_BUDGET && guard++ < 40) {
    if (d.retarget > 0) d.retarget = Math.max(0, d.retarget - 100);
    else if (d.searchBudget > 0) d.searchBudget = Math.max(0, d.searchBudget - 100);
    else if (d.creators.length) d.creators = d.creators.slice(0, -1);
    else break;
  }
  return d;
}

function cleanAd(d: AdDecision, round: number): AdDecision {
  const out: AdDecision = {
    bid: clamp(step(d.bid, 0.5), 0.5, 15),
    searchBudget: clamp(step(d.searchBudget, 50), 0, 1500),
    quality: ([0, 1, 2] as const).includes(d.quality) ? d.quality : 0,
    creators: [...new Set(d.creators)].filter((id) => CREATOR[id]).slice(0, AD_MAX_CREATORS),
    premium: !!d.premium,
    retarget: clamp(step(d.retarget, 50), 0, 1500),
    liveHours: ([0, 2, 4] as const).includes(d.liveHours) ? d.liveHours : 0,
    liveDiscount: ([0, 10, 20, 30] as const).includes(d.liveDiscount) ? d.liveDiscount : 0,
    crm: (['none', 'blast', 'rfm'] as AdCrm[]).includes(d.crm) ? d.crm : 'none',
    holdout: d.holdout === 'none' || AD_CHANNELS.includes(d.holdout as AdChannel) ? d.holdout : 'none',
  };
  if (round === 1 && d.beRoas !== undefined) out.beRoas = clamp(Math.round(d.beRoas * 10) / 10, 0.5, 10);
  return out;
}

const E = (en: string, vi: string) => ({ en, vi });

export function validateAd(raw: unknown, round: number, state: AdState): AdDecision {
  const bad = (en = 'Invalid plan – please check every field.', vi = 'Kế hoạch không hợp lệ – vui lòng kiểm tra từng mục.') => new GameError('bad_decision', E(en, vi));
  if (!raw || typeof raw !== 'object') throw bad();
  const d = raw as Record<string, unknown>;
  const num = (k: string, lo: number, hi: number) => {
    const v = Number(d[k]);
    if (!Number.isFinite(v) || v < lo || v > hi) throw bad();
    return v;
  };
  if (!Array.isArray(d.creators) || d.creators.length > AD_MAX_CREATORS) throw bad();
  const roster = rosterOf(state, round);
  if (d.creators.some((x) => !roster.includes(String(x)))) throw bad('That creator is not available this month.', 'Nhà sáng tạo đó không có trong tháng này.');
  if (!['none', 'blast', 'rfm'].includes(String(d.crm)) || !['none', ...AD_CHANNELS].includes(String(d.holdout))) throw bad();
  if (round === 1 && (d.beRoas === undefined || d.beRoas === null)) throw bad('Enter your break-even ROAS first.', 'Hãy nhập ROAS hòa vốn trước.');
  const out = cleanAd(
    {
      bid: num('bid', 0.5, 15),
      searchBudget: num('searchBudget', 0, 1500),
      quality: num('quality', 0, 2) as 0 | 1 | 2,
      creators: d.creators.map(String),
      premium: d.premium === true,
      retarget: num('retarget', 0, 1500),
      liveHours: num('liveHours', 0, 4) as 0 | 2 | 4,
      liveDiscount: num('liveDiscount', 0, 30) as 0 | 10 | 20 | 30,
      crm: d.crm as AdCrm,
      holdout: d.holdout as AdChannel | 'none',
      ...(round === 1 ? { beRoas: num('beRoas', 0.5, 10) } : {}),
    },
    round,
  );
  if (spendOf(out) > AD_BUDGET + 1e-6) throw bad(`Over budget: the plan costs more than ${AD_BUDGET}m this month.`, `Vượt ngân sách: kế hoạch tốn hơn ${AD_BUDGET} triệu trong tháng.`);
  return out;
}

export function adBadges(state: AdState, id: string, order: string[]): string[] {
  const c = state.cos[id]!;
  const out: string[] = [];
  if (c.beRoas !== null && Math.abs(c.beRoas - AD_BE_ROAS) <= 0.25) out.push('beroas');
  if (c.fakesBooked === 0) out.push('nofake');
  if (c.holdouts > 0) out.push('holdout');
  if (c.bestPosition <= 2 && c.rounds && c.avgBid / c.rounds <= 6) out.push('quality');
  if (c.customers >= 20) out.push('crm');
  const best = order.slice().sort((a, b) => state.cos[b]!.profitCum - state.cos[a]!.profitCum)[0];
  if (best === id) out.push('profit');
  return out;
}

export const AD_CLASH: RsGame<AdDecision, AdState, AdReport, AdView> = {
  id: 'ad-clash',
  rounds: AD_ROUNDS,
  label: 'Ad Auction & Creator Clash',
  botNames: ['SerumLab', 'DewGlow', 'VitaSkin', 'PureDrop', 'LumiSerum', 'AquaVie'],
  archetypes: ['bidder', 'celebrity', 'retarget', 'discounter', 'balanced', 'measurer'],
  defaultSettings: { decideSec: 300, resultsSec: 0, botLevel: 'medium', fillBots: true },
  init: (order, _room, rng) => initAd(order, rng),
  validate: (raw, round, state) => validateAd(raw, round, state),
  fallback: (state, _id, round, last) => {
    const base: AdDecision = last ? { ...last, creators: [] } : { bid: 3, searchBudget: 400, quality: 0, creators: [], premium: false, retarget: 200, liveHours: 0, liveDiscount: 0, crm: 'none', holdout: 'none' };
    delete base.beRoas;
    return fitBudget(cleanAd({ ...base, holdout: 'none' }, round));
  },
  bot: (arch, level, state, id, round, rng) => adBot(arch as AdArchetype, level, state, state.cos[id]!, round, rng),
  simulate: (state, order, inputs, round, rng) => {
    const out = simulateAd(state, order, inputs, round, rng);
    return { ...out, pub: adPub(state, round) as unknown as Record<string, unknown> };
  },
  scorecard: (state, id) => adScorecard(state.cos[id]!),
  cols: (state, id) => {
    const c = state.cos[id]!;
    return { profitCum: r1(c.profitCum), customers: r1(c.customers), wait: r2(c.wait) };
  },
  view: (state, id, _round, finished) => {
    const c = state.cos[id]!;
    return {
      qs: Math.round((5 + 2 * c.qualityStock) * 10) / 10,
      customers: r1(c.customers),
      waitShare: r2(c.wait),
      beRoas: c.beRoas,
      ...(finished ? { fakes: Object.fromEntries(CREATORS.map((x) => [x.handle, x.fake])), incremental: c.incremental } : {}),
    };
  },
  badges: adBadges,
  pub: (state) => adPub(state, 0) as unknown as Record<string, unknown>,
};
