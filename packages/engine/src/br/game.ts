// Game 11 – Border Run: the landed cost of a cross-border order, the trust stack that fails at its
// lowest missing layer, a rented advantage that the state can withdraw, and five temptation cards
// whose real probability is only revealed at the end (server only).
import { GameError } from '../room.js';
import type { Rng } from '../rng.js';
import type { RsGame, RsInput } from '../rs/room.js';
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';
import {
  BR_CARD_INFO,
  BR_DEMINIMIS_ENDS,
  BR_FILE_COST,
  BR_INCOTERMS,
  BR_LAYERS,
  BR_LAYER_COST,
  BR_LAYER_INFO,
  BR_LAYER_OPEX,
  BR_LOCALISES,
  BR_LOCALISE_COST,
  BR_LOCALISE_INFO,
  BR_MARKETS,
  BR_MARKET_INFO,
  BR_MAX_LEVEL,
  BR_MAX_SHORTCUTS,
  BR_MODES,
  BR_MODE_INFO,
  BR_MODE_RANK,
  BR_MODE_STEP,
  BR_POINTS,
  BR_PROFIT_TARGET,
  BR_RETURNS,
  BR_RETURNS_COST,
  BR_RETURNS_INFO,
  BR_ROUNDS,
  BR_SHORTCUTS,
  BR_SQUAT_FROM,
  BR_STRIKE_CLOSE,
  BR_STRIKE_FREEZE,
  BR_UNDERVALUE,
  brExempt,
  brLanded,
  type BrArchetype,
  type BrCardTruth,
  type BrDecision,
  type BrIncident,
  type BrIncoterm,
  type BrLayer,
  type BrLine,
  type BrLocalise,
  type BrMarket,
  type BrMode,
  type BrPub,
  type BrReport,
  type BrReturns,
  type BrShortcut,
  type BrView,
} from './types.js';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** VND m to VND bn. */
const bn = (m: number) => r2(m / 1000);
const vn = (v: number) => String(v).replace('.', ',');
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const zeroLayers = (): Record<BrLayer, number> => ({ identity: 0, product: 0, content: 0, delivery: 0, remedy: 0, data: 0 });
const noModes = (): Record<BrMarket, BrMode> => ({ us: 'none', eu: 'none', jp: 'none', sg: 'none' });
const zeroMarkets = (): Record<BrMarket, number> => ({ us: 0, eu: 0, jp: 0, sg: 0 });
const zeroCards = (): Record<BrShortcut, number> => ({ reviews: 0, countdown: 0, preticked: 0, hidden: 0, undervalue: 0 });

// ───────── hidden model ─────────
/** How much of the brand survives the channel: a distributor keeps the customer. */
const REACH: Record<BrMode, number> = { none: 0, dist: 0.45, market: 1, own: 0.75, local: 1.15 };
/** How sharply the destination concentrates demand on the best-looking seller. */
const EXPO = 2;
/** The local sellers already on that shelf, as an appeal² the Vietnamese sellers compete against. */
const RIVALS = 0.3;
/** A clumsy machine-translated listing, a reviewed one, and a fully approved one. */
const CONTENT_MUL: Record<BrLocalise, number> = { ai: 0.9, review: 1, approve: 1.02 };
/** What each card lifts, and what it adds to the order value. */
const CARD_LIFT: Record<BrShortcut, number> = { reviews: 0.18, countdown: 0.1, preticked: 0, hidden: 0.12, undervalue: 0 };
/** Per-quarter detection probability at a middling volume, before scale and repetition. */
const CARD_P: Record<BrShortcut, number> = { reviews: 0.17, countdown: 0.14, preticked: 0.12, hidden: 0.14, undervalue: 0.11 };
/** Dead stock abroad: what a unit nobody bought costs you per quarter, as a share of its value. */
const DEAD_STOCK = 0.14;

/** What each destination really expects of a seller, layer by layer. Discovered through incidents. */
const BAR: Record<BrMarket, Record<BrLayer, number>> = {
  us: { identity: 1, product: 2, content: 2, delivery: 1, remedy: 2, data: 1 },
  eu: { identity: 1, product: 1, content: 2, delivery: 1, remedy: 2, data: 2 },
  jp: { identity: 2, product: 2, content: 1, delivery: 2, remedy: 1, data: 1 },
  sg: { identity: 1, product: 1, content: 1, delivery: 1, remedy: 1, data: 1 },
};
/** How quickly somebody files your brand name there once your sales are visible. */
const SQUAT: Record<BrMarket, number> = { us: 0.3, eu: 0.22, jp: 0.34, sg: 0.12 };

export interface BrCo {
  build: Record<BrLayer, number>;
  mode: Record<BrMarket, BrMode>;
  filed: BrMarket[];
  squatted: BrMarket[];
  closed: BrMarket[];
  /** Cumulative, VND m. */
  profit: number;
  revenue: number;
  revByMarket: Record<BrMarket, number>;
  /** Duty not paid because the customs value was understated – the basis of a back assessment. */
  dodged: number;
  /** Trust damage still being carried, 0–1. */
  scar: number;
  strikes: number;
  /** Marketplace seats are frozen while this round number is not yet past. */
  frozenUntil: number;
  trustSum: number;
  trustRounds: number;
  licenceSum: number;
  licenceRounds: number;
  cardTaken: Record<BrShortcut, number>;
  cardCaught: Record<BrShortcut, number>;
  cardChance: Record<BrShortcut, number>;
  cardGain: Record<BrShortcut, number>;
  cardPaid: Record<BrShortcut, number>;
  lastOrders: Record<BrMarket, number>;
  ddpRounds: number;
  shortcutsEver: number;
  incidentsEver: number;
  minLayerEver: number;
  /** Moved stock into a destination before that destination's threshold changed. */
  foresight: boolean;
}

export interface BrState {
  cos: Record<string, BrCo>;
  bar: Record<BrMarket, Record<BrLayer, number>>;
  squat: Record<BrMarket, number>;
  crowd: Record<BrMarket, number>;
}

export function initBr(order: string[], rng: Rng): BrState {
  const cos: Record<string, BrCo> = {};
  for (const id of order)
    cos[id] = {
      build: zeroLayers(),
      mode: noModes(),
      filed: [],
      squatted: [],
      closed: [],
      profit: 0,
      revenue: 0,
      revByMarket: zeroMarkets(),
      dodged: 0,
      scar: 0,
      strikes: 0,
      frozenUntil: 0,
      trustSum: 0,
      trustRounds: 0,
      licenceSum: 0,
      licenceRounds: 0,
      cardTaken: zeroCards(),
      cardCaught: zeroCards(),
      cardChance: zeroCards(),
      cardGain: zeroCards(),
      cardPaid: zeroCards(),
      lastOrders: zeroMarkets(),
      ddpRounds: 0,
      shortcutsEver: 0,
      incidentsEver: 0,
      minLayerEver: BR_MAX_LEVEL,
      foresight: false,
    };
  const squat = zeroMarkets();
  // Per-room jitter, never enough to change which market is the risky one.
  for (const m of BR_MARKETS) squat[m] = r3(SQUAT[m] * (1 + (rng() - 0.5) * 0.2));
  return { cos, bar: BAR, squat, crowd: zeroMarkets() };
}

/** The trust stack fails at its lowest missing layer, so the minimum carries most of the weight. */
export function trustOf(c: BrCo): { trust: number; min: number; avg: number } {
  const vals = BR_LAYERS.map((l) => c.build[l]);
  const min = Math.min(...vals);
  const avg = mean(vals);
  const raw = 0.6 * (min / BR_MAX_LEVEL) + 0.4 * (avg / BR_MAX_LEVEL);
  return { trust: r3(clamp(raw * (1 - c.scar), 0, 1)), min, avg: r2(avg) };
}

/** Points needed to go from the level you hold to the level you want. */
export function brLayerCost(from: number, to: number): number {
  let sum = 0;
  for (let l = from + 1; l <= to; l++) sum += BR_LAYER_COST[l - 1]!;
  return sum;
}
/** Points needed to climb from one mode of entry to another. */
export function brModeCost(from: BrMode, to: BrMode): number {
  let sum = 0;
  for (let r = BR_MODE_RANK[from] + 1; r <= BR_MODE_RANK[to]; r++) sum += BR_MODE_STEP[r]!;
  return sum;
}
export function brSpend(c: BrCo, d: BrDecision): number {
  let sum = 0;
  for (const l of BR_LAYERS) sum += brLayerCost(c.build[l], d.build[l] ?? c.build[l]);
  for (const m of BR_MARKETS) sum += brModeCost(c.mode[m], d.mode[m] ?? c.mode[m]);
  sum += d.file.length * BR_FILE_COST;
  sum += BR_LOCALISE_COST[d.localise];
  sum += BR_RETURNS_COST[d.returns];
  return sum;
}

const has = (d: BrDecision, card: BrShortcut) => d.shortcuts.includes(card);

/** Appeal in one market: fit × trust × channel × content × sticker price × whatever the cards added. */
function appealOf(c: BrCo, d: BrDecision, m: BrMarket, trust: number, withCards: boolean): number {
  const mode = c.mode[m];
  if (mode === 'none') return 0;
  const info = BR_MARKET_INFO[m];
  const fit = 0.6 + 0.1 * info.scores.fit;
  const lift = withCards ? 1 + d.shortcuts.reduce((a, s) => a + CARD_LIFT[s], 0) : 1;
  const sticker = d.incoterm === 'dap' ? 1.12 : 1;
  return fit * (0.25 + 0.75 * trust) * REACH[mode] * CONTENT_MUL[d.localise] * sticker * lift;
}

/** Every line of the landed cost of one order. Count all seven before calling it profitable. */
function econOf(c: BrCo, d: BrDecision, m: BrMarket, round: number, withCards: boolean) {
  const x = brLanded(m, c.mode[m], round, {
    incoterm: d.incoterm,
    returns: d.returns,
    preticked: withCards && has(d, 'preticked'),
    undervalue: withCards && has(d, 'undervalue'),
    hidden: withCards && has(d, 'hidden'),
  });
  return { ...x, chain: x.freight + x.fees + x.marketing + x.clearance + x.returns };
}

export function simulateBr(state: BrState, order: string[], inputs: Record<string, RsInput<BrDecision>>, round: number, rng: Rng) {
  // Everyone builds and enters first, then each destination is divided.
  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    for (const l of BR_LAYERS) c.build[l] = Math.max(c.build[l], clamp(Math.floor(d.build[l] ?? 0), 0, BR_MAX_LEVEL));
    for (const m of BR_MARKETS) {
      if (c.squatted.includes(m) || c.closed.includes(m)) continue;
      const want = d.mode[m] ?? 'none';
      if (BR_MODE_RANK[want] > BR_MODE_RANK[c.mode[m]]) {
        const ends = BR_DEMINIMIS_ENDS[m];
        if (want === 'local' && ends !== undefined && round < ends) c.foresight = true;
        c.mode[m] = want;
      }
    }
    for (const m of d.file) if (!c.filed.includes(m)) c.filed.push(m);
  }

  const trust: Record<string, number> = {};
  const blocked: Record<string, BrMarket[]> = {};
  const pre: Record<string, BrIncident[]> = {};
  const scarAdd: Record<string, number> = {};

  // ── what stops you selling before a single order is placed ──
  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    trust[id] = trustOf(c).trust;
    blocked[id] = [];
    pre[id] = [];
    scarAdd[id] = 0;
    const present = BR_MARKETS.filter((m) => c.mode[m] !== 'none');
    if (c.frozenUntil >= round)
      for (const m of present)
        if (c.mode[m] === 'market') {
          blocked[id]!.push(m);
          pre[id]!.push({
            id: `frozen-${m}`,
            text: tx(
              `Your marketplace account in ${BR_MARKET_INFO[m].name.en} is under review and the listings are down for the quarter. What is rented can be withdrawn.`,
              `Tài khoản sàn của bạn ở ${BR_MARKET_INFO[m].name.vi} đang bị xem xét và các bài bán bị gỡ cả quý. Thứ đi thuê thì có thể bị lấy lại.`,
            ),
            cost: 0,
          });
        }
    // What a destination expects is discovered the expensive way: the more layers fall short,
    // the more likely somebody asks you for the evidence you do not have.
    for (const m of present) {
      if (blocked[id]!.includes(m) || c.mode[m] === 'dist') continue;
      const worst = BR_LAYERS.slice().sort((a, b) => state.bar[m][b] - c.build[b] - (state.bar[m][a] - c.build[a]))[0]!;
      const worstGap = state.bar[m][worst] - c.build[worst];
      const gap = BR_LAYERS.reduce((a, l) => a + Math.max(0, state.bar[m][l] - c.build[l]), 0);
      if (gap <= 0 || rng() >= clamp(0.12 * gap, 0, 0.65)) continue;
      const layer = BR_LAYER_INFO[worst];
      if (worstGap >= 2) {
        blocked[id]!.push(m);
        scarAdd[id] = (scarAdd[id] ?? 0) + 0.12;
        pre[id]!.push({
          id: `bar-${m}`,
          text: tx(
            `${BR_MARKET_INFO[m].name.en} withdrew your listings this quarter over ${layer.name.en.toLowerCase()}: ${layer.question.en} The answer was not on file.`,
            `${BR_MARKET_INFO[m].name.vi} gỡ bài bán của bạn trong quý này vì ${layer.name.vi.toLowerCase()}: ${layer.question.vi} Câu trả lời không có trong hồ sơ.`,
          ),
          cost: bn(150),
        });
      } else {
        scarAdd[id] = (scarAdd[id] ?? 0) + 0.06;
        pre[id]!.push({
          id: `warn-${m}`,
          text: tx(
            `${BR_MARKET_INFO[m].name.en} asked you to evidence ${layer.name.en.toLowerCase()} within a day. You answered late, and the complaint stayed on your record.`,
            `${BR_MARKET_INFO[m].name.vi} yêu cầu bạn xuất bằng chứng về ${layer.name.vi.toLowerCase()} trong vòng một ngày. Bạn trả lời muộn, và khiếu nại đó nằm lại trong hồ sơ.`,
          ),
          cost: bn(80 + BR_MARKET_INFO[m].econ.pool * 0.004),
        });
      }
    }
    // AI drafts but does not approve. A tool that adds an unsupported claim creates legal exposure at once.
    if (d.localise === 'ai' && c.build.content < 2) {
      const biggest = present.filter((m) => !blocked[id]!.includes(m)).sort((a, b) => BR_MARKET_INFO[b].econ.pool - BR_MARKET_INFO[a].econ.pool)[0];
      if (biggest && rng() < 0.28) {
        blocked[id]!.push(biggest);
        scarAdd[id] = (scarAdd[id] ?? 0) + 0.15;
        pre[id]!.push({
          id: `claim-${biggest}`,
          text: tx(
            `The AI-written listing in ${BR_MARKET_INFO[biggest].name.en} claimed the product was “clinically proven”. Nobody had any evidence for that, and the listing came down. AI generated is not the same as compliant.`,
            `Bài bán hàng do AI viết ở ${BR_MARKET_INFO[biggest].name.vi} ghi sản phẩm “đã được chứng minh trên lâm sàng”. Không ai có bằng chứng nào cho điều đó, và bài bán bị gỡ. AI viết ra không có nghĩa là đúng luật.`,
          ),
          cost: bn(180),
        });
      }
    }
  }

  // ── divide each destination ──
  const appeal: Record<BrMarket, Record<string, number>> = { us: {}, eu: {}, jp: {}, sg: {} };
  const sum: Record<BrMarket, number> = zeroMarkets();
  for (const m of BR_MARKETS)
    for (const id of order) {
      const c = state.cos[id]!;
      const a = blocked[id]!.includes(m) ? 0 : appealOf(c, inputs[id]!.decision, m, trust[id]!, true);
      appeal[m][id] = a;
      sum[m] += Math.pow(a, EXPO);
    }

  /** Orders this seller wins in a market, optionally with the cards switched off. */
  function ordersIn(id: string, m: BrMarket, withCards: boolean): number {
    const c = state.cos[id]!;
    if (c.mode[m] === 'none' || blocked[id]!.includes(m)) return 0;
    const mine = Math.pow(appeal[m][id] ?? 0, EXPO);
    const a = withCards ? mine : Math.pow(appealOf(c, inputs[id]!.decision, m, trust[id]!, false), EXPO);
    const total = sum[m] - mine + a;
    if (total <= 0) return 0;
    const capture = BR_MARKET_INFO[m].econ.pool * (total / (total + RIVALS));
    return (capture * a) / total;
  }

  const reports: Record<string, BrReport> = {};
  const values: Record<string, number> = {};
  const news: T[] = [];

  for (const id of order) {
    const c = state.cos[id]!;
    const d = inputs[id]!.decision;
    const notes: T[] = [];
    const incidents: BrIncident[] = [...pre[id]!];
    const preCost = pre[id]!.reduce((a, x) => a + x.cost, 0) * 1000;
    const caught: BrShortcut[] = [];
    const lines: BrLine[] = [];
    /** What each market sold last quarter – stock was ordered against that. */
    const prevOrders = { ...c.lastOrders };
    let revenue = 0;
    let contribution = 0;
    let dutyPaid = 0;
    let plain = 0;
    let dodged = 0;

    for (const m of BR_MARKETS) {
      if (c.mode[m] === 'none') continue;
      const e = econOf(c, d, m, round, true);
      const won = ordersIn(id, m, true);
      const refused = won * e.refuseRate;
      const sold = won - refused;
      const rev = sold * e.price;
      const contrib = sold * e.unit - refused * e.refuseCost;
      revenue += rev;
      contribution += contrib;
      dutyPaid += sold * e.duty;
      c.revByMarket[m] += rev;
      c.lastOrders[m] = sold;
      if (has(d, 'undervalue') && e.dutiable) dodged += sold * BR_MARKET_INFO[m].econ.aov * (1 - BR_UNDERVALUE) * BR_MARKET_INFO[m].econ.duty;
      // The same quarter with no cards played: the difference is what they really earned.
      const e0 = econOf(c, d, m, round, false);
      const won0 = ordersIn(id, m, false);
      const refused0 = won0 * e0.refuseRate;
      plain += (won0 - refused0) * e0.unit - refused0 * e0.refuseCost;
      lines.push({
        market: m,
        mode: c.mode[m],
        orders: Math.round(sold),
        refused: Math.round(refused),
        revenue: bn(rev),
        duty: bn(sold * e.duty),
        chain: bn(sold * e.chain),
        contribution: bn(contrib),
        dutiable: e.dutiable,
        blocked: blocked[id]!.includes(m),
      });
      if (refused > 10)
        notes.push(
          tx(
            `${Math.round(refused)} parcels in ${BR_MARKET_INFO[m].name.en} were refused at the door: the courier demanded duty from a customer who believed she had already paid. You lost the goods, the freight both ways and the customer.`,
            `${Math.round(refused)} kiện ở ${BR_MARKET_INFO[m].name.vi} bị khách từ chối nhận: chuyển phát đòi thuế từ một người tin rằng mình đã trả tiền rồi. Bạn mất hàng, mất phí vận chuyển cả hai chiều và mất khách.`,
          ),
        );
    }
    c.dodged += dodged;

    // ── running cost of everything you hold ──
    let opex = BR_LAYERS.reduce((a, l) => a + BR_LAYER_OPEX[c.build[l]]!, 0) + BR_LOCALISE_INFO[d.localise].opex + BR_RETURNS_INFO[d.returns].opex;
    for (const m of BR_MARKETS) {
      if (c.mode[m] === 'none') continue;
      opex += BR_MODE_INFO[c.mode[m]].opex;
      if (c.mode[m] === 'local') {
        // You had to order the stock before you knew what would sell.
        const expected = Math.max(BR_MARKET_INFO[m].econ.pool * 0.18, prevOrders[m] * 1.2);
        const dead = Math.max(0, expected - c.lastOrders[m]) * BR_MARKET_INFO[m].econ.aov * DEAD_STOCK;
        opex += dead;
        if (dead > 120)
          notes.push(
            tx(
              `Stock you moved into ${BR_MARKET_INFO[m].name.en} is not turning over. Dead stock abroad costs far more than dead stock at home.`,
              `Hàng bạn đưa sang ${BR_MARKET_INFO[m].name.vi} không quay vòng. Hàng tồn ở nước ngoài đắt hơn hàng tồn ở nhà rất nhiều.`,
            ),
          );
      }
    }

    // ── what the shortcuts earned, and what they cost ──
    const gain = Math.max(0, contribution - plain);
    const share = d.shortcuts.length ? gain / d.shortcuts.length : 0;
    let penalty = 0;
    const scale = clamp(revenue / 1500, 0, 1);
    for (const card of d.shortcuts) {
      c.cardTaken[card] += 1;
      c.cardGain[card] += share;
      const p = clamp(CARD_P[card] * (0.6 + 0.8 * scale) * (1 + 0.35 * (c.cardTaken[card] - 1)), 0, 0.85);
      c.cardChance[card] = r3(Math.max(c.cardChance[card], p));
      if (rng() >= p) continue;
      caught.push(card);
      c.cardCaught[card] += 1;
      c.strikes += 1;
      let cost = 0;
      let text: T;
      if (card === 'reviews') {
        cost = revenue * 0.08 + 140;
        scarAdd[id] = (scarAdd[id] ?? 0) + 0.25;
        text = tx(
          'The marketplace screened your reviews, removed the bought batch and put a notice on the listing. The genuine reviews went with them.',
          'Sàn rà soát đánh giá, gỡ sạch đợt đã mua và dán cảnh báo lên bài bán. Những đánh giá thật cũng bị gỡ theo.',
        );
      } else if (card === 'countdown') {
        cost = 110;
        scarAdd[id] = (scarAdd[id] ?? 0) + 0.12;
        text = tx(
          'A consumer body screenshotted the timer restarting itself. False scarcity is not persuasion, it is false information.',
          'Một tổ chức bảo vệ người tiêu dùng chụp lại cảnh đồng hồ tự chạy lại. Khan hiếm giả không phải là thuyết phục, đó là thông tin sai.',
        );
      } else if (card === 'preticked') {
        cost = 130 + share;
        scarAdd[id] = (scarAdd[id] ?? 0) + 0.1;
        text = tx(
          'Pre-ticked insurance at the last step was ruled an unfair design: you refunded it to everyone who never wanted it.',
          'Bảo hiểm tự đánh dấu sẵn ở bước cuối bị kết luận là thiết kế không công bằng: bạn phải hoàn lại cho tất cả những người chưa bao giờ muốn nó.',
        );
      } else if (card === 'hidden') {
        cost = 160;
        scarAdd[id] = (scarAdd[id] ?? 0) + 0.14;
        text = tx(
          'The total payable must be shown before the order button, every charge included. The hidden fees came back as refusals, chargebacks and a published warning.',
          'Tổng số tiền phải trả, gồm mọi khoản, phải hiện trước nút đặt hàng. Các khoản phí ẩn quay lại dưới dạng khách từ chối nhận, đòi lại tiền qua ngân hàng, và một cảnh báo công khai.',
        );
      } else {
        cost = c.dodged * 2.5 + 120;
        c.dodged = 0;
        scarAdd[id] = (scarAdd[id] ?? 0) + 0.08;
        text = tx(
          'Customs reassessed the declared value – on everything you have shipped, not on this quarter – and added a penalty.',
          'Hải quan xác định lại trị giá khai báo – trên toàn bộ hàng bạn đã gửi, không chỉ quý này – và cộng thêm tiền phạt.',
        );
      }
      c.cardPaid[card] += cost;
      penalty += cost;
      incidents.push({ id: `card-${card}`, text, cost: bn(cost) });
    }
    if (d.shortcuts.length) c.shortcutsEver += d.shortcuts.length;

    // ── a title granted in Vietnam protects you only in Vietnam ──
    for (const m of BR_MARKETS) {
      if (c.mode[m] === 'none' || c.filed.includes(m) || c.squatted.includes(m)) continue;
      if (c.revByMarket[m] < BR_SQUAT_FROM) continue;
      if (rng() >= state.squat[m] * 0.35) continue;
      c.squatted.push(m);
      c.mode[m] = 'none';
      incidents.push({
        id: `squat-${m}`,
        text: tx(
          `Somebody has registered your brand name in ${BR_MARKET_INFO[m].name.en} and is demanding that you withdraw. Your Vietnamese registration gives you no protection there: a title granted in one country protects you only there.`,
          `Có người đã đăng ký tên thương hiệu của bạn ở ${BR_MARKET_INFO[m].name.vi} và yêu cầu bạn rút khỏi thị trường. Đăng ký ở Việt Nam không bảo hộ được ở đó: văn bằng cấp ở nước nào chỉ bảo hộ ở nước ấy.`,
        ),
        cost: 0,
      });
    }

    // ── the platform account ──
    if (c.strikes >= BR_STRIKE_CLOSE) {
      for (const m of BR_MARKETS)
        if (c.mode[m] === 'market' && !c.closed.includes(m)) {
          c.closed.push(m);
          c.mode[m] = 'none';
        }
      if (c.closed.length)
        incidents.push({
          id: 'closed',
          text: tx(
            'Three strikes: your marketplace accounts are closed. In a domestic market one mistake costs a customer; across a border it can cost the right to sell at all.',
            'Ba lần vi phạm: các tài khoản sàn của bạn bị đóng. Ở trong nước, một sai sót mất một khách; ra ngoài biên giới, nó có thể mất luôn quyền được bán.',
          ),
          cost: 0,
        });
    } else if (c.strikes >= BR_STRIKE_FREEZE && c.frozenUntil < round + 1) c.frozenUntil = round + 1;

    const incidentCost = penalty + preCost;
    const profit = contribution - opex - incidentCost;
    c.profit += profit;
    c.revenue += revenue;
    if (incidents.length) c.incidentsEver += incidents.length;
    if (d.incoterm === 'ddp') c.ddpRounds++;

    const tr = trustOf(c);
    c.trustSum += tr.trust;
    c.trustRounds++;
    c.minLayerEver = Math.min(c.minLayerEver, tr.min);

    // ── the licence to keep selling ──
    const present = BR_MARKETS.filter((m) => c.mode[m] !== 'none');
    const items: number[] = [];
    if (present.length) {
      items.push(mean(present.map((m) => (c.filed.includes(m) ? 1 : 0))));
      items.push(mean(present.map((m) => 1 - BR_LAYERS.reduce((a, l) => a + Math.max(0, state.bar[m][l] - c.build[l]), 0) / 6)));
      items.push(d.localise === 'approve' ? 1 : d.localise === 'review' ? 0.7 : 0);
      items.push(d.incoterm === 'ddp' ? 1 : 0.2);
      items.push(d.shortcuts.length === 0 ? 1 : 0);
      items.push(tr.min >= 2 ? 1 : tr.min >= 1 ? 0.5 : 0);
    } else items.push(0.3);
    const licence = clamp(mean(items), 0, 1);
    c.licenceSum += licence;
    c.licenceRounds++;

    if (!present.length)
      notes.push(
        tx('You are not selling anywhere abroad yet. Nothing can go wrong – and nothing can come in either.', 'Bạn chưa bán ở đâu ngoài nước. Chẳng có gì hỏng được – mà cũng chẳng có gì vào được.'),
      );
    if (tr.min === 0 && present.length)
      notes.push(
        tx(
          `Your trust stack has a missing layer: ${BR_LAYERS.filter((l) => c.build[l] === 0).map((l) => BR_LAYER_INFO[l].name.en.toLowerCase()).join(', ')}. The stack fails at its lowest missing layer, whatever the average says.`,
          `Chồng niềm tin của bạn đang thiếu hẳn một lớp: ${BR_LAYERS.filter((l) => c.build[l] === 0).map((l) => BR_LAYER_INFO[l].name.vi.toLowerCase()).join(', ')}. Chồng niềm tin vỡ ở lớp thiếu thấp nhất, bất kể trung bình nói gì.`,
        ),
      );
    if (dutyPaid > 0 && d.incoterm === 'ddp' && contribution > 0)
      notes.push(
        tx(
          `Duty and import charges took VND ${vn(bn(dutyPaid))} bn of your contribution this quarter. Price is not cash received.`,
          `Thuế nhập khẩu và các khoản khi nhập lấy mất ${vn(bn(dutyPaid))} tỷ đồng lợi nhuận đóng góp trong quý. Giá không phải là tiền về.`,
        ),
      );
    if (opex > contribution && round >= 2)
      notes.push(
        tx(
          `Running what you hold costs VND ${vn(bn(opex))} bn a quarter against VND ${vn(bn(contribution))} bn of contribution.`,
          `Chi phí vận hành những gì bạn đang giữ là ${vn(bn(opex))} tỷ đồng mỗi quý, so với ${vn(bn(contribution))} tỷ đồng lợi nhuận đóng góp.`,
        ),
      );
    const rented = BR_MARKETS.filter((m) => c.mode[m] !== 'none' && c.mode[m] !== 'local' && BR_DEMINIMIS_ENDS[m] !== undefined && round < BR_DEMINIMIS_ENDS[m]!);
    if (rented.length && round >= 2)
      notes.push(
        tx(
          `Part of your margin in ${rented.map((m) => BR_MARKET_INFO[m].name.en).join(', ')} is a customs concession, not a capability. A model built on a concession rents its advantage.`,
          `Một phần lợi nhuận của bạn ở ${rented.map((m) => BR_MARKET_INFO[m].name.vi).join(', ')} là một nhượng bộ về thuế, không phải năng lực. Mô hình dựng trên một nhượng bộ là đi thuê lợi thế của mình.`,
        ),
      );

    reports[id] = {
      round,
      decision: d,
      defaulted: inputs[id]!.defaulted,
      spent: brSpend(c, d),
      build: { ...c.build },
      trust: tr.trust,
      trustMin: tr.min,
      trustAvg: tr.avg,
      lines,
      orders: lines.reduce((a, x) => a + x.orders, 0),
      revenue: bn(revenue),
      contribution: bn(contribution),
      opex: bn(opex),
      shortcutGain: bn(gain),
      incidentCost: bn(incidentCost),
      profit: bn(profit),
      incidents,
      caught,
      notes,
    };
    values[id] = bn(c.profit);
  }

  for (const id of order) {
    const c = state.cos[id]!;
    c.scar = r3(clamp((c.scar + (scarAdd[id] ?? 0)) * 0.78, 0, 0.8));
  }
  for (const m of BR_MARKETS) state.crowd[m] = order.filter((id) => state.cos[id]!.mode[m] !== 'none').length;

  // ── public market news ──
  const ending = BR_MARKETS.filter((m) => BR_DEMINIMIS_ENDS[m] === round + 1);
  for (const m of ending)
    news.push(
      tx(
        `${BR_MARKET_INFO[m].name.en} has confirmed that from next quarter its low-value exemption ends: every parcel will be assessed for duty and the clearance charge per parcel rises. A threshold is a policy choice, not an economic law.`,
        `${BR_MARKET_INFO[m].name.vi} đã xác nhận từ quý sau sẽ bỏ ngưỡng miễn thuế hàng giá trị thấp: mọi kiện đều bị tính thuế và phí thông quan mỗi kiện tăng lên. Ngưỡng miễn thuế là một lựa chọn chính sách, không phải quy luật kinh tế.`,
      ),
    );
  const gone = BR_MARKETS.filter((m) => BR_DEMINIMIS_ENDS[m] === round);
  for (const m of gone)
    news.push(
      tx(
        `${BR_MARKET_INFO[m].name.en} now assesses every parcel. Individual air freight has lost to bulk shipping into stock held in the destination.`,
        `${BR_MARKET_INFO[m].name.vi} giờ tính thuế mọi kiện. Gửi lẻ bằng đường không đã thua gửi lô vào kho đặt tại nước đến.`,
      ),
    );
  const busiest = BR_MARKETS.slice().sort((a, b) => state.crowd[b] - state.crowd[a])[0]!;
  if (state.crowd[busiest] >= 3)
    news.push(
      tx(
        `${state.crowd[busiest]} of the six brands are now selling in ${BR_MARKET_INFO[busiest].name.en}. A crowded shelf splits the same pool more ways.`,
        `${state.crowd[busiest]} trong sáu thương hiệu hiện đang bán ở ${BR_MARKET_INFO[busiest].name.vi}. Kệ hàng chật thì cùng một lượng khách bị chia thành nhiều phần hơn.`,
      ),
    );
  return { reports, values, news };
}

export function brPub(state: BrState, order: string[], round: number): BrPub {
  return {
    profit: Object.fromEntries(order.map((id) => [id, bn(state.cos[id]!.profit)])),
    trust: Object.fromEntries(order.map((id) => [id, trustOf(state.cos[id]!).trust])),
    crowd: { ...state.crowd },
    dutiable: Object.fromEntries(BR_MARKETS.map((m) => [m, !brExempt(m, Math.max(1, round))])) as Record<BrMarket, boolean>,
    round,
  };
}

/** Absolute scorecard, 0–100. Trust drives the conversion rate, so profit is already multiplied by it. */
export function brScorecard(c: BrCo) {
  const profit = 50 * clamp(c.profit / 1000 / BR_PROFIT_TARGET, 0, 1);
  const trust = 30 * (c.trustRounds ? c.trustSum / c.trustRounds : 0);
  const licence = 20 * (c.licenceRounds ? c.licenceSum / c.licenceRounds : 0);
  return { total: profit + trust + licence, parts: { profit: r1(profit), trust: r1(trust), licence: r1(licence) } };
}

// ───────── AI brands ─────────
interface Step {
  enter?: Partial<Record<BrMarket, BrMode>>;
  build?: BrLayer[];
  file?: BrMarket[];
  incoterm?: BrIncoterm;
  localise?: BrLocalise;
  returns?: BrReturns;
  cards?: BrShortcut[];
}

const PLAN: Record<BrArchetype, Record<number, Step>> = {
  // Reads the published score, fixes identity and product first, files before building the channel,
  // and moves stock ahead the quarter before the threshold changes.
  reader: {
    // Get every layer off zero first: the stack fails at its lowest missing layer.
    1: { enter: { sg: 'market' }, build: BR_LAYERS, localise: 'ai' },
    2: { enter: { us: 'market' }, build: BR_LAYERS, file: ['sg'], localise: 'review' },
    3: { build: ['product', 'content'], file: ['us'], localise: 'review', returns: 'reduce' },
    4: { enter: { us: 'local' }, build: ['remedy'], localise: 'review', returns: 'reduce' },
    5: { build: BR_LAYERS, localise: 'approve', returns: 'reduce' },
  },
  // Chases the market where small parcels still arrive duty-free, and never looks at the policy line.
  duty: {
    1: { enter: { jp: 'market' }, build: ['identity'], localise: 'ai' },
    2: { build: ['product', 'content'], localise: 'ai' },
    3: { build: ['delivery', 'identity'], localise: 'ai' },
    4: { build: ['product', 'remedy'], localise: 'ai' },
    5: { build: ['content', 'data'], localise: 'ai' },
  },
  // Takes whatever is on offer. It works, right up until it does not.
  shortcut: {
    1: { enter: { us: 'market' }, build: ['identity'], localise: 'ai', cards: ['reviews', 'countdown'] },
    2: { build: ['product'], localise: 'ai', cards: ['reviews', 'hidden'] },
    3: { enter: { jp: 'market' }, build: ['content'], localise: 'ai', cards: ['preticked', 'undervalue'] },
    4: { build: ['delivery'], localise: 'ai', cards: ['countdown', 'undervalue'] },
    5: { build: ['remedy'], localise: 'ai', cards: ['reviews', 'preticked'] },
  },
  // Builds every layer to the top in the smallest, easiest market.
  fortress: {
    1: { enter: { sg: 'market' }, build: BR_LAYERS, localise: 'ai' },
    2: { build: BR_LAYERS, file: ['sg'], localise: 'approve', returns: 'reduce' },
    3: { build: BR_LAYERS, localise: 'approve', returns: 'reduce' },
    4: { build: BR_LAYERS, localise: 'approve', returns: 'reduce' },
    5: { build: BR_LAYERS, localise: 'approve', returns: 'reduce' },
  },
  // Everywhere at once, nothing finished anywhere.
  spread: {
    1: { enter: { sg: 'market', jp: 'dist' }, build: ['identity'], localise: 'ai' },
    2: { enter: { us: 'market' }, build: ['product'], localise: 'ai' },
    3: { enter: { eu: 'market' }, build: ['content'], localise: 'review' },
    4: { build: ['delivery', 'remedy'], localise: 'review' },
    5: { build: ['data', 'identity'], localise: 'review' },
  },
  // Lets an importer carry the compliance, and loses the customer with it.
  handoff: {
    1: { enter: { us: 'dist', sg: 'dist' }, build: ['identity', 'product'], localise: 'review' },
    2: { enter: { jp: 'dist', eu: 'dist' }, build: ['product'], localise: 'review' },
    3: { build: ['content', 'delivery'], localise: 'review' },
    4: { build: ['remedy'], localise: 'review' },
    5: { build: ['data'], localise: 'review' },
  },
};

export function brBot(arch: BrArchetype, level: BotLevel, state: BrState, id: string, round: number, rng: Rng): BrDecision {
  const c = state.cos[id]!;
  // An easier rival is a quarter behind and a little short-handed; a harder one is a quarter quicker.
  const step = PLAN[arch][Math.max(1, round - (level === 'easy' ? 1 : 0))] ?? {};
  const mode = { ...c.mode };
  const build = { ...c.build };
  const file: BrMarket[] = [];
  const d: BrDecision = {
    mode,
    build,
    incoterm: step.incoterm ?? (arch === 'duty' || arch === 'shortcut' ? 'dap' : 'ddp'),
    localise: step.localise ?? 'review',
    file,
    returns: step.returns ?? (arch === 'shortcut' || arch === 'duty' ? 'refund' : 'collect'),
    shortcuts: level === 'easy' ? (step.cards ?? []).slice(0, 1) : (step.cards ?? []),
  };
  let left = BR_POINTS + (level === 'hard' ? 1 : level === 'easy' ? -1 : 0) - BR_LOCALISE_COST[d.localise] - BR_RETURNS_COST[d.returns];
  for (const [m, want] of Object.entries(step.enter ?? {}) as [BrMarket, BrMode][]) {
    if (c.squatted.includes(m) || c.closed.includes(m)) continue;
    const cost = brModeCost(c.mode[m], want);
    if (cost > 0 && cost <= left) {
      mode[m] = want;
      left -= cost;
    }
  }
  for (const m of step.file ?? []) {
    if (c.filed.includes(m) || file.includes(m) || mode[m] === 'none') continue;
    if (BR_FILE_COST <= left) {
      file.push(m);
      left -= BR_FILE_COST;
    }
  }
  // A weaker brand gets the order of work a little wrong.
  const order = (step.build ?? []).slice();
  if (level !== 'hard' && order.length > 1)
    for (let i = 0; i < (level === 'easy' ? 2 : 1); i++) {
      const a = Math.floor(rng() * order.length);
      const b = Math.floor(rng() * order.length);
      [order[a], order[b]] = [order[b]!, order[a]!];
    }
  // Raise the lowest layer first: the stack fails at its lowest missing layer.
  for (let guard = 0; guard < BR_LAYERS.length * BR_MAX_LEVEL && left > 0; guard++) {
    const next = order
      .filter((l) => build[l] < BR_MAX_LEVEL && BR_LAYER_COST[build[l]]! <= left)
      .sort((a, b) => build[a] - build[b] || order.indexOf(a) - order.indexOf(b))[0];
    if (!next) break;
    left -= BR_LAYER_COST[build[next]]!;
    build[next] += 1;
  }
  return d;
}

// ───────── validation ─────────
const E = (en: string, vi: string) => ({ en, vi });

export function validateBr(raw: unknown, _round: number, state: BrState, playerId: string): BrDecision {
  const bad = () => new GameError('bad_decision', E('Invalid plan – please check the entries.', 'Kế hoạch không hợp lệ – vui lòng kiểm tra lại.'));
  if (!raw || typeof raw !== 'object') throw bad();
  const d = raw as Partial<BrDecision> & { mode?: Record<string, unknown>; build?: Record<string, unknown> };
  if (!d.mode || typeof d.mode !== 'object' || !d.build || typeof d.build !== 'object') throw bad();
  const c = state.cos[playerId]!;

  const build = zeroLayers();
  for (const l of BR_LAYERS) {
    const v = Number(d.build[l] ?? c.build[l]);
    if (!Number.isInteger(v) || v < 0 || v > BR_MAX_LEVEL) throw bad();
    if (v < c.build[l])
      throw new GameError(
        'no_downgrade',
        E(`${BR_LAYER_INFO[l].name.en} is already at level ${c.build[l]}; what is built stays built.`, `${BR_LAYER_INFO[l].name.vi} đã ở mức ${c.build[l]}; thứ đã xây thì vẫn còn đó.`),
      );
    build[l] = v;
  }

  const mode = noModes();
  for (const m of BR_MARKETS) {
    const want = (BR_MODES.includes(d.mode[m] as BrMode) ? d.mode[m] : c.mode[m]) as BrMode;
    if (c.squatted.includes(m) || c.closed.includes(m)) {
      if (BR_MODE_RANK[want] > 0)
        throw new GameError(
          'market_lost',
          E(`You can no longer sell in ${BR_MARKET_INFO[m].name.en}.`, `Bạn không còn bán được ở ${BR_MARKET_INFO[m].name.vi} nữa.`),
        );
      mode[m] = 'none';
      continue;
    }
    if (BR_MODE_RANK[want] < BR_MODE_RANK[c.mode[m]])
      throw new GameError(
        'no_retreat',
        E(
          `You are already selling in ${BR_MARKET_INFO[m].name.en} through ${BR_MODE_INFO[c.mode[m]].name.en.toLowerCase()}; you can climb the ladder but not step back down it.`,
          `Bạn đã bán ở ${BR_MARKET_INFO[m].name.vi} qua hình thức ${BR_MODE_INFO[c.mode[m]].name.vi.toLowerCase()}; bạn leo lên được nhưng không lùi lại được.`,
        ),
      );
    mode[m] = want;
  }

  const seen = new Set<BrMarket>();
  const file: BrMarket[] = [];
  for (const m of Array.isArray(d.file) ? d.file : []) {
    if (!BR_MARKETS.includes(m as BrMarket) || seen.has(m as BrMarket) || c.filed.includes(m as BrMarket)) continue;
    if (mode[m as BrMarket] === 'none') continue;
    seen.add(m as BrMarket);
    file.push(m as BrMarket);
  }

  const cards = new Set<BrShortcut>();
  for (const s of Array.isArray(d.shortcuts) ? d.shortcuts : []) if (BR_SHORTCUTS.includes(s as BrShortcut)) cards.add(s as BrShortcut);
  if (cards.size > BR_MAX_SHORTCUTS)
    throw new GameError(
      'too_many_cards',
      E(`At most ${BR_MAX_SHORTCUTS} of those a quarter.`, `Mỗi quý nhiều nhất ${BR_MAX_SHORTCUTS} thẻ như vậy.`),
    );

  const out: BrDecision = {
    mode,
    build,
    incoterm: BR_INCOTERMS.includes(d.incoterm as BrIncoterm) ? (d.incoterm as BrIncoterm) : 'ddp',
    localise: BR_LOCALISES.includes(d.localise as BrLocalise) ? (d.localise as BrLocalise) : 'ai',
    file,
    returns: BR_RETURNS.includes(d.returns as BrReturns) ? (d.returns as BrReturns) : 'refund',
    shortcuts: [...cards],
  };
  const spend = brSpend(c, out);
  if (spend > BR_POINTS)
    throw new GameError(
      'too_many_points',
      E(`You have ${BR_POINTS} team-quarters, the plan uses ${spend}.`, `Bạn có ${BR_POINTS} quý-nhân-sự, kế hoạch dùng ${spend}.`),
    );
  return out;
}

export function brCards(c: BrCo): BrCardTruth[] {
  return BR_SHORTCUTS.filter((s) => c.cardTaken[s] > 0 || c.cardCaught[s] > 0).map((s) => ({
    card: s,
    taken: c.cardTaken[s],
    caught: c.cardCaught[s],
    chance: c.cardChance[s],
    gained: bn(c.cardGain[s]),
    paid: bn(c.cardPaid[s]),
  }));
}

export function brBadges(state: BrState, id: string, order: string[]): string[] {
  const c = state.cos[id]!;
  const out: string[] = [];
  const present = BR_MARKETS.filter((m) => c.mode[m] !== 'none');
  if (c.shortcutsEver === 0) out.push('honest');
  if (present.length > 0 && present.every((m) => c.filed.includes(m))) out.push('filed');
  if (c.ddpRounds >= BR_ROUNDS) out.push('allin');
  if (c.minLayerEver >= 1) out.push('solid');
  if (c.foresight) out.push('foresight');
  if (!c.squatted.length && !c.closed.length) out.push('clean');
  if (order.slice().sort((a, b) => state.cos[b]!.profit - state.cos[a]!.profit)[0] === id) out.push('leader');
  return out;
}

export const BORDER_RUN: RsGame<BrDecision, BrState, BrReport, BrView> = {
  id: 'border-run',
  rounds: BR_ROUNDS,
  label: 'Border Run',
  // Neutral brand names: the framework hands out names by seat and archetypes at random,
  // so a name must never hint at the strategy behind it.
  botNames: ['NamViet', 'HuongSen', 'DongA', 'TraVinh', 'MyLan', 'PhuQuy'],
  archetypes: ['duty', 'shortcut', 'fortress', 'spread', 'handoff', 'reader'],
  defaultSettings: { decideSec: 300, resultsSec: 0, botLevel: 'medium', fillBots: true },
  init: (order, _room, rng) => initBr(order, rng),
  validate: (raw, round, state, playerId) => validateBr(raw, round, state, playerId),
  // No plan submitted: nothing new is built or entered, and no card is taken.
  fallback: (state, playerId, _round, last) => {
    const prev = last as BrDecision | undefined;
    const c = state.cos[playerId]!;
    return {
      mode: { ...c.mode },
      build: { ...c.build },
      incoterm: prev?.incoterm ?? 'ddp',
      localise: prev?.localise ?? 'ai',
      file: [],
      returns: prev?.returns ?? 'refund',
      shortcuts: [],
    };
  },
  bot: (arch, level, state, id, round, rng) => brBot(arch as BrArchetype, level, state, id, round, rng),
  simulate: (state, order, inputs, round, rng) => {
    const out = simulateBr(state, order, inputs, round, rng);
    return { ...out, pub: brPub(state, order, round) as unknown as Record<string, unknown> };
  },
  scorecard: (state, id) => brScorecard(state.cos[id]!),
  cols: (state, id) => {
    const c = state.cos[id]!;
    return {
      profit: bn(c.profit),
      trust: trustOf(c).trust,
      markets: BR_MARKETS.filter((m) => c.mode[m] !== 'none').length,
      strikes: c.strikes,
    };
  },
  flag: (state, id) => (state.cos[id]!.profit < 0 ? 'bankrupt' : undefined),
  view: (state, id, round, finished) => {
    const c = state.cos[id]!;
    const tr = trustOf(c);
    const ahead: T[] = [];
    for (const m of BR_MARKETS) {
      const ends = BR_DEMINIMIS_ENDS[m];
      if (ends !== undefined && ends > round)
        ahead.push(
          tx(
            `${BR_MARKET_INFO[m].name.en}: the low-value exemption ends in quarter ${ends}.`,
            `${BR_MARKET_INFO[m].name.vi}: ngưỡng miễn thuế hàng giá trị thấp hết hiệu lực từ quý ${ends}.`,
          ),
        );
    }
    return {
      build: { ...c.build },
      mode: { ...c.mode },
      filed: [...c.filed],
      squatted: [...c.squatted],
      closed: [...c.closed],
      profit: bn(c.profit),
      revenue: bn(c.revenue),
      trust: tr.trust,
      trustMin: tr.min,
      scar: r2(c.scar),
      strikes: c.strikes,
      frozen: c.frozenUntil >= round,
      points: BR_POINTS,
      opexNext: bn(
        BR_LAYERS.reduce((a, l) => a + BR_LAYER_OPEX[c.build[l]]!, 0) + BR_MARKETS.reduce((a, m) => a + BR_MODE_INFO[c.mode[m]].opex, 0),
      ),
      round,
      dutiable: Object.fromEntries(BR_MARKETS.map((m) => [m, !brExempt(m, Math.max(1, round))])) as Record<BrMarket, boolean>,
      ahead,
      cards: finished ? brCards(c) : [],
    };
  },
  badges: brBadges,
  pub: (state, order, round) => brPub(state, order, round) as unknown as Record<string, unknown>,
};
