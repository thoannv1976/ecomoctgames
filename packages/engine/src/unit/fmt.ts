// Bilingual number formatting for generated questions (English 1,250.5 · Vietnamese 1.250,5).
import { randInt, shuffle, type Rng } from '../rng.js';
import type { Lang, T } from '../types.js';

export type F = (l: Lang) => string;
export const bi = (f: F): T => ({ en: f('en'), vi: f('vi') });
export const both = (en: string, vi: string): T => ({ en, vi });

function group(v: number, l: Lang, d: number): string {
  const s = Math.abs(v).toFixed(d);
  const [i, f] = s.split('.');
  const thousands = l === 'en' ? ',' : '.';
  const dec = l === 'en' ? '.' : ',';
  const int = i!.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return (v < 0 && Number(s) !== 0 ? '−' : '') + int + (f ? dec + f : '');
}

/** Plain number. */
export const n = (v: number, l: Lang, d = 0) => group(v, l, d);
/** Fraction as a percentage: p(0.153) = 15.3%. */
export const p = (v: number, l: Lang, d = 1) => `${group(v * 100, l, d)}%`;
/** Percentage points. */
export const pp = (v: number, l: Lang, d = 1) => `${group(v * 100, l, d)} ${l === 'en' ? 'pp' : 'điểm %'}`;
/** Ratio such as ROAS 4.0x. */
export const x = (v: number, l: Lang, d = 1) => `${group(v, l, d)}x`;
/** Money in VND, scaled to million/billion. */
export function m(v: number, l: Lang): string {
  const a = Math.abs(v);
  if (a >= 1e9) return l === 'en' ? `${group(v / 1e9, l, 2)} billion VND` : `${group(v / 1e9, l, 2)} tỷ đồng`;
  if (a >= 1e6) return l === 'en' ? `${group(v / 1e6, l, a >= 1e8 ? 0 : 1)} million VND` : `${group(v / 1e6, l, a >= 1e8 ? 0 : 1)} triệu đồng`;
  return l === 'en' ? `${group(v, l, 0)} VND` : `${group(v, l, 0)} đ`;
}

export const pick = <V>(rng: Rng, list: readonly V[]): V => list[randInt(rng, list.length)]!;
export const between = (rng: Rng, lo: number, hi: number, step = 1) => lo + step * randInt(rng, Math.floor((hi - lo) / step) + 1);
export const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Numeric choice options: the right value plus distractors, formatted with `fmt`.
 * Distractors that print the same as another option are nudged until all four differ.
 */
export function numericOptions(rng: Rng, right: number, distractors: number[], fmt: (v: number, l: Lang) => string): { options: T[]; answer: number } {
  const values = [right];
  const seen = new Set([fmt(right, 'en')]);
  for (let d of distractors) {
    for (let k = 0; seen.has(fmt(d, 'en')) && k < 20; k++) d = d * (1 + (k % 2 ? -0.13 : 0.11)) + (d === 0 ? 1 : 0);
    if (!seen.has(fmt(d, 'en'))) {
      seen.add(fmt(d, 'en'));
      values.push(d);
    }
    if (values.length === 4) break;
  }
  const order = shuffle(rng, values.map((_, i) => i));
  return { options: order.map((i) => bi((l) => fmt(values[i]!, l))), answer: order.indexOf(0) };
}

/** Text options with the right one first in `list`; returns them shuffled with the answer index. */
export function textOptions(rng: Rng, list: T[]): { options: T[]; answer: number } {
  const order = shuffle(rng, list.map((_, i) => i));
  return { options: order.map((i) => list[i]!), answer: order.indexOf(0) };
}

export const row = (...cells: T[]) => ({ cells });
