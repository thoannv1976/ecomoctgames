// Game 12 – validation and the six AI CEOs.
import { GameError } from '../room.js';
import { randInt, type Rng } from '../rng.js';
import type { BotLevel } from '../types.js';
import { CRISIS_QUALITY, type CoState } from './sim.js';
import {
  AGENT_INVESTS,
  AI_CHOICES,
  BUDGET_STEP,
  CHANNELS,
  CRISIS_CARDS,
  KPIS,
  MAX_MARKETING,
  PRICE_POS,
  SEGMENTS,
  SERVICES,
  SKU_RANGES,
  STOCK_OPTIONS,
  type CeoArchetype,
  type CeoDecision,
  type Channel,
  type CrisisId,
  type Kpi,
  type Trend,
} from './types.js';

const E = (en: string, vi: string) => ({ en, vi });

export function validateCeo(raw: CeoDecision, round: number, crisis: CrisisId | null): CeoDecision {
  if (!PRICE_POS.includes(raw.price) || !SKU_RANGES.includes(raw.skus) || !SEGMENTS.includes(raw.segment) || !SERVICES.includes(raw.service))
    throw new GameError('bad_input', E('Choose price, range, segment and service.', 'Chọn giá, dòng sản phẩm, phân khúc và dịch vụ.'));
  const money = (v: unknown) => {
    const n = Math.round(Number(v) / BUDGET_STEP) * BUDGET_STEP;
    if (!Number.isFinite(n) || n < 0 || n > MAX_MARKETING) throw new GameError('bad_input', E('Invalid budget.', 'Ngân sách không hợp lệ.'));
    return n;
  };
  const ads = money(raw.ads), creators = money(raw.creators), crm = money(raw.crm);
  if (ads + creators + crm > MAX_MARKETING) throw new GameError('over_budget', E(`Marketing is capped at ${MAX_MARKETING} million per quarter.`, `Marketing tối đa ${MAX_MARKETING} triệu mỗi quý.`));
  const mix = {} as Record<Channel, number>;
  let sum = 0;
  for (const c of CHANNELS) {
    const v = Math.round(Number(raw.mix?.[c] ?? 0) / 10) * 10;
    if (!Number.isFinite(v) || v < 0 || v > 100) throw new GameError('bad_input', E('Invalid channel mix.', 'Phân bổ kênh không hợp lệ.'));
    mix[c] = v;
    sum += v;
  }
  if (sum !== 100) throw new GameError('bad_input', E('Channel effort must add up to 100%.', 'Phân bổ kênh phải cộng đủ 100%.'));
  const stock = Number(raw.stock ?? 0);
  if (stock !== 0 && !STOCK_OPTIONS.includes(stock)) throw new GameError('bad_input', E('Choose a stock quantity from the list.', 'Chọn số lượng nhập hàng trong danh sách.'));
  const out: CeoDecision = { price: raw.price, skus: raw.skus, segment: raw.segment, service: raw.service, ads, creators, crm, mix, stock };
  if (round >= 3) out.shopeePromo = Boolean(raw.shopeePromo);
  if (round === 4) {
    if (!raw.ai || !AI_CHOICES.includes(raw.ai)) throw new GameError('bad_input', E('Choose how to use the 300 million AI budget (A–E).', 'Chọn cách dùng 300 triệu cho AI (A–E).'));
    out.ai = raw.ai;
  }
  if (round >= 5) out.agent = Array.from(new Set(raw.agent ?? [])).filter((a) => AGENT_INVESTS.includes(a));
  if (round === 6 && crisis) {
    if (!raw.crisis || !CRISIS_CARDS[crisis].options.some((o) => o.id === raw.crisis)) throw new GameError('bad_input', E('Choose a response to your crisis card.', 'Chọn cách xử lý thẻ khủng hoảng.'));
    out.crisis = raw.crisis;
    const predict: Partial<Record<Kpi, Trend>> = {};
    for (const k of KPIS) {
      const v = raw.predict?.[k];
      if (v !== 'up' && v !== 'down') throw new GameError('bad_input', E('Predict every KPI: up or down.', 'Dự đoán đủ 4 KPI: tăng hay giảm.'));
      predict[k] = v;
    }
    out.predict = predict;
  }
  return out;
}

export const ARCH_DECISION: Record<CeoArchetype, Omit<CeoDecision, 'stock'>> = {
  discount: { price: 'value', skus: 'wide', segment: 'genz', service: 'basic', ads: 220, creators: 80, crm: 0, mix: { web: 0, shopee: 50, tiktok: 50 }, shopeePromo: true },
  ads: { price: 'mid', skus: 'medium', segment: 'office', service: 'fast', ads: 450, creators: 100, crm: 20, mix: { web: 30, shopee: 50, tiktok: 20 }, shopeePromo: true },
  platform: { price: 'mid', skus: 'medium', segment: 'office', service: 'fast', ads: 200, creators: 150, crm: 0, mix: { web: 0, shopee: 60, tiktok: 40 }, shopeePromo: true },
  d2c: { price: 'premium', skus: 'focused', segment: 'mom', service: 'premium', ads: 150, creators: 50, crm: 130, mix: { web: 60, shopee: 30, tiktok: 10 }, shopeePromo: false },
  aifirst: { price: 'mid', skus: 'medium', segment: 'office', service: 'fast', ads: 180, creators: 80, crm: 60, mix: { web: 40, shopee: 40, tiktok: 20 }, shopeePromo: true },
  balanced: { price: 'mid', skus: 'medium', segment: 'mom', service: 'fast', ads: 170, creators: 90, crm: 90, mix: { web: 40, shopee: 40, tiktok: 20 }, shopeePromo: true },
};
const ARCH_AI: Record<CeoArchetype, CeoDecision['ai']> = { discount: 'D', ads: 'D', platform: 'E', d2c: 'B', aifirst: 'A', balanced: 'C' };
const ARCH_AGENT: Record<CeoArchetype, CeoDecision['agent']> = { discount: [], ads: [], platform: [], d2c: ['catalog', 'policy'], aifirst: ['catalog', 'api', 'payment', 'policy'], balanced: ['catalog', 'api'] };

/** The best (hard) or a plausible (medium/easy) crisis response. */
function crisisChoice(c: CrisisId, level: BotLevel, rng: Rng): string {
  const opts = CRISIS_CARDS[c].options.map((o) => o.id);
  const best = opts.slice().sort((a, b) => (CRISIS_QUALITY[c][b] ?? 0) - (CRISIS_QUALITY[c][a] ?? 0))[0]!;
  const p = level === 'hard' ? 0.9 : level === 'medium' ? 0.55 : 0.3;
  return rng() < p ? best : opts[randInt(rng, opts.length)]!;
}

export function ceoBotDecision(arch: CeoArchetype, level: BotLevel, p: CoState, round: number, rng: Rng): CeoDecision {
  const base = ARCH_DECISION[arch];
  const d: CeoDecision = { ...base, mix: { ...base.mix }, stock: 0 };
  // Noise by level.
  if (level !== 'hard') {
    const noise = level === 'easy' ? 0.4 : 0.15;
    for (const k of ['ads', 'creators', 'crm'] as const) d[k] = Math.max(0, Math.round((d[k] * (1 + (rng() * 2 - 1) * noise)) / 10) * 10);
    if (d.ads + d.creators + d.crm > 600) d.ads = 600 - d.creators - d.crm;
  }
  // Stock: cover expected demand (hard bots plan well, easy bots over- or under-buy).
  // True demand last quarter = orders served + orders lost to stock-outs.
  const expected = p.last ? (p.last.orders + p.last.stockouts) * 1.08 : 4500;
  const factor = level === 'hard' ? 1.1 : level === 'medium' ? 0.85 + rng() * 0.4 : 0.6 + rng() * 0.9;
  const need = Math.max(0, expected * factor - p.stock);
  d.stock = need <= 0 ? 0 : STOCK_OPTIONS.reduce((best, o) => (Math.abs(o - need) < Math.abs(best - need) ? o : best), STOCK_OPTIONS[0]!);
  if (round >= 3 && arch === 'd2c') d.shopeePromo = false;
  if (round === 4) d.ai = level === 'easy' && rng() < 0.4 ? (['A', 'B', 'C', 'D', 'E'] as const)[randInt(rng, 5)] : ARCH_AI[arch];
  if (round >= 5) d.agent = round === 5 ? ARCH_AGENT[arch]!.slice() : [];
  if (round === 6 && p.crisis) {
    d.crisis = crisisChoice(p.crisis, level, rng);
    // Predictions: hard bots read the card, others guess.
    const guess = (): 'up' | 'down' => (rng() < 0.5 ? 'up' : 'down');
    d.predict = level === 'hard' ? { revenue: 'down', profit: 'down', rating: 'down', pdr: 'down' } : { revenue: guess(), profit: guess(), rating: guess(), pdr: guess() };
  }
  return d;
}
