import { timeLimitOf, type BankQuestion, type QuestionTemplate } from './bank.js';
import { shuffle, type Rng } from './rng.js';
import type { AnswerInput, AnswerKey, Category, HintPayload, PublicQuestion } from './types.js';

/** Turn a generated question into what players see plus the answer key in the shuffled index space. */
export function preparePublic(q: BankQuestion, rng: Rng): { pub: PublicQuestion; key: AnswerKey } {
  const base = {
    id: q.id,
    kind: q.kind,
    category: q.category,
    prompt: q.prompt,
    timeLimitSec: timeLimitOf(q),
    ...(q.context ? { context: q.context } : {}),
    ...(q.table ? { table: q.table } : {}),
  };
  if (q.kind === 'choice') {
    const idx = q.options.map((_, i) => i);
    const perm = q.fixedOrder ? idx : shuffle(rng, idx);
    return { pub: { ...base, options: perm.map((i) => q.options[i]!) }, key: { kind: 'choice', option: perm.indexOf(q.answer) } };
  }
  if (q.kind === 'spot') return { pub: { ...base, segments: q.segments.slice() }, key: { kind: 'spot', seg: q.answer } };
  const idx = q.items.map((_, i) => i);
  let perm = shuffle(rng, idx);
  for (let tries = 0; tries < 10 && perm.every((v, i) => v === i); tries++) perm = shuffle(rng, idx);
  if (perm.every((v, i) => v === i)) perm = [...idx.slice(1), 0];
  return {
    pub: { ...base, items: perm.map((i) => q.items[i]!) },
    // key.order[k] = position (in the shuffled list) of the k-th right item.
    key: { kind: 'order', order: idx.map((k) => perm.indexOf(k)) },
  };
}

export function isValidInput(pub: PublicQuestion, input: AnswerInput): boolean {
  if (input.kind !== pub.kind) return false;
  if (input.kind === 'choice') return Number.isInteger(input.option) && input.option >= 0 && input.option < (pub.options?.length ?? 0);
  if (input.kind === 'spot') return Number.isInteger(input.seg) && input.seg >= 0 && input.seg < (pub.segments?.length ?? 0);
  const n = pub.items?.length ?? 0;
  if (input.order.length !== n) return false;
  return new Set(input.order).size === n && input.order.every((v) => Number.isInteger(v) && v >= 0 && v < n);
}

/** "Verify": choice removes two wrong options, spot narrows to two tiles, order gives the first item. */
export function buildHint(pub: PublicQuestion, key: AnswerKey, rng: Rng): HintPayload {
  if (key.kind === 'choice') {
    const wrong = (pub.options ?? []).map((_, i) => i).filter((i) => i !== key.option);
    const removeCount = Math.min(2, Math.max(0, wrong.length - 1));
    return { kind: 'choice', removed: shuffle(rng, wrong).slice(0, removeCount).sort((a, b) => a - b) };
  }
  if (key.kind === 'spot') {
    const others = (pub.segments ?? []).map((_, i) => i).filter((i) => i !== key.seg);
    return { kind: 'spot', candidates: [key.seg, shuffle(rng, others)[0] ?? key.seg].sort((a, b) => a - b) };
  }
  return { kind: 'order', first: key.order[0]! };
}

/** Pick `count` templates spread across the chosen categories, then mix them. */
export function selectTemplates(bank: readonly QuestionTemplate[], categories: readonly Category[], count: number, rng: Rng): QuestionTemplate[] {
  const cats = shuffle(rng, categories.length ? categories : Array.from(new Set(bank.map((q) => q.category))));
  const pools = new Map<Category, QuestionTemplate[]>();
  for (const c of cats) pools.set(c, shuffle(rng, bank.filter((q) => q.category === c)));
  const picked: QuestionTemplate[] = [];
  let progress = true;
  while (picked.length < count && progress) {
    progress = false;
    for (const c of cats) {
      const next = pools.get(c)?.pop();
      if (next) {
        picked.push(next);
        progress = true;
        if (picked.length >= count) break;
      }
    }
  }
  const mixed = shuffle(rng, picked);
  for (let i = 2; i < mixed.length; i++) {
    const a = mixed[i - 2]!, b = mixed[i - 1]!, c = mixed[i]!;
    if (a.category === b.category && b.category === c.category) {
      const j = mixed.findIndex((q, k) => k > i && q.category !== c.category);
      if (j > 0) [mixed[i], mixed[j]] = [mixed[j]!, mixed[i]!];
    }
  }
  return mixed;
}
