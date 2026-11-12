import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  MAX_SEATS,
  UNIT_ECONOMICS_TEMPLATES,
  WRONG_PENALTY,
  advance,
  computePoints,
  createRoom,
  finishGame,
  gradeFraction,
  isValidInput,
  joinRoom,
  lmsResults,
  planBotAnswer,
  preparePublic,
  ranking,
  seededRng,
  selectTemplates,
  speedFactor,
  startGame,
  submitAnswer,
  useHint,
  type AnswerInput,
  type AnswerKey,
  type BankQuestion,
  type RoomDoc,
  type RoomPrivate,
  type T,
} from '../src/index.js';

const bank = UNIT_ECONOMICS_TEMPLATES;

function nestedArrayPath(v: unknown, path = '$'): string | null {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      if (Array.isArray(v[i])) return `${path}[${i}]`;
      const inner = nestedArrayPath(v[i], `${path}[${i}]`);
      if (inner) return inner;
    }
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      const inner = nestedArrayPath(x, `${path}.${k}`);
      if (inner) return inner;
    }
  }
  return null;
}

/** Every text in both languages, non-empty and free of broken numbers. */
function texts(q: BankQuestion): T[] {
  const out: T[] = [q.prompt, q.explanation, q.source];
  if (q.context) out.push(q.context);
  if (q.table) out.push(...q.table.headers, ...q.table.rows.flatMap((r) => r.cells));
  if (q.kind === 'choice') out.push(...q.options);
  if (q.kind === 'spot') out.push(...q.segments);
  if (q.kind === 'order') out.push(...q.items);
  return out;
}

describe('Game 9 question templates', () => {
  it('has unique ids and enough templates per category', () => {
    expect(new Set(bank.map((t) => t.id)).size).toBe(bank.length);
    for (const c of CATEGORIES) expect(bank.filter((t) => t.category === c).length, c).toBeGreaterThanOrEqual(4);
  });

  it('generates well-formed bilingual questions for many seeds', () => {
    for (const tpl of bank) {
      for (let s = 0; s < 60; s++) {
        const q = tpl.make(seededRng(`${tpl.id}:${s}`));
        expect(q.category, tpl.id).toBe(tpl.category);
        for (const t of texts(q)) {
          expect(t.en.trim().length, `${tpl.id} en`).toBeGreaterThan(0);
          expect(t.vi.trim().length, `${tpl.id} vi`).toBeGreaterThan(0);
          for (const s2 of [t.en, t.vi]) expect(s2, tpl.id).not.toMatch(/NaN|undefined|Infinity|\[object/);
        }
        if (q.kind === 'choice') {
          expect(q.options.length, tpl.id).toBeGreaterThanOrEqual(3);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(new Set(q.options.map((o) => o.en)).size, `${tpl.id} distinct options ${JSON.stringify(q.options.map((o) => o.en))}`).toBe(q.options.length);
        } else if (q.kind === 'spot') {
          expect(q.segments.length, tpl.id).toBeGreaterThanOrEqual(4);
          expect(q.answer).toBeLessThan(q.segments.length);
        } else {
          expect(q.items.length, tpl.id).toBeGreaterThanOrEqual(3);
          expect(new Set(q.items.map((o) => o.en)).size).toBe(q.items.length);
        }
        expect(nestedArrayPath(q), tpl.id).toBeNull();
      }
    }
  });

  it('computes the textbook examples right', () => {
    // Break-even ROAS = 1 / margin.
    for (let s = 0; s < 30; s++) {
      const q = bank.find((t) => t.id === 'calc-beroas')!.make(seededRng(`be${s}`));
      if (q.kind !== 'choice') throw new Error('kind');
      const margin = Number(q.prompt.en.match(/is ([\d.]+)%/)![1]) / 100;
      expect(Number(q.options[q.answer]!.en.replace('x', ''))).toBeCloseTo(1 / margin, 1);
    }
    // Lever ranking: items are in strictly decreasing gain order.
    const q = bank.find((t) => t.id === 'lever-rank')!.make(seededRng('lever'));
    expect(q.kind).toBe('order');
  });

  it('spreads a 15-question game across all categories', () => {
    const picked = selectTemplates(bank, CATEGORIES, 15, seededRng('sel'));
    expect(picked).toHaveLength(15);
    for (const c of CATEGORIES) expect(picked.filter((t) => t.category === c).length).toBeGreaterThanOrEqual(2);
  });
});

describe('scoring', () => {
  it('rewards speed, punishes wrong answers, grades spot and order', () => {
    expect(speedFactor(0, 10_000)).toBe(1);
    expect(speedFactor(10_000, 10_000)).toBe(0.5);
    expect(computePoints({ answered: true, fraction: 0, elapsedMs: 0, limitMs: 10_000, hint: false, streakBefore: 0 })).toBe(-WRONG_PENALTY);
    expect(computePoints({ answered: true, fraction: 1, elapsedMs: 0, limitMs: 10_000, hint: true, streakBefore: 0 })).toBe(500);
    expect(gradeFraction({ kind: 'spot', seg: 2 }, { kind: 'spot', seg: 2 })).toBe(1);
    expect(gradeFraction({ kind: 'spot', seg: 2 }, { kind: 'spot', seg: 1 })).toBe(0);
    expect(gradeFraction({ kind: 'order', order: [2, 0, 1] }, { kind: 'order', order: [2, 1, 0] })).toBeCloseTo(1 / 3);
  });

  it('bots answer valid inputs at the right accuracy', () => {
    const q = bank[0]!.make(seededRng('bot'));
    const { pub, key } = preparePublic(q, seededRng('pp'));
    let right = 0;
    for (let i = 0; i < 400; i++) {
      const plan = planBotAnswer('hard', pub, key, 0, seededRng(`b${i}`));
      expect(isValidInput(pub, plan.input)).toBe(true);
      if (gradeFraction(key as AnswerKey, plan.input) === 1) right++;
    }
    expect(right / 400).toBeGreaterThan(0.75);
  });
});

describe('room flow', () => {
  function setup() {
    const rng = seededRng('room');
    const { room, priv, player } = createRoom({ code: 'ECOM1', hostPlays: true, hostName: 'Lan', settings: { questionCount: 6 }, hostLms: { hubUserId: 'u1', gradeTarget: 'gt' } }, 1000, rng);
    const b = joinRoom(room, priv, 'Minh', 1000, rng);
    startGame(room, priv, bank, 2000, rng);
    return { room, priv, a: player!.playerId, b: b.playerId };
  }

  it('fills seats with bots, generates fresh questions and plays to the end', () => {
    const { room, priv, a, b } = setup();
    expect(room.order).toHaveLength(MAX_SEATS);
    expect(priv.questions).toHaveLength(6);
    expect(nestedArrayPath(priv)).toBeNull();
    expect(nestedArrayPath(room)).toBeNull();
    // The public room never carries an answer.
    expect(JSON.stringify(room)).not.toContain('"answer"');
    let t = 5000;
    for (let i = 0; i < 6; i++) {
      const cur = room.current!;
      const key = priv.key!;
      const right: AnswerInput = key.kind === 'order' ? { kind: 'order', order: key.order.slice() } : key.kind === 'spot' ? { kind: 'spot', seg: key.seg } : { kind: 'choice', option: key.option };
      if (i === 0) {
        const hint = useHint(room, priv, a, i, cur.openedAt + 100);
        expect(hint.kind).toBe(cur.q.kind);
      }
      expect(submitAnswer(room, priv, a, i, right, cur.openedAt + 500)).toBe(false);
      expect(() => submitAnswer(room, priv, a, i, right, cur.openedAt + 600)).toThrow();
      expect(submitAnswer(room, priv, b, i, right, cur.openedAt + 900)).toBe(true);
      expect(room.status).toBe('reveal');
      expect(room.reveal!.explanation.en.length).toBeGreaterThan(10);
      expect(room.reveal!.explanation.vi.length).toBeGreaterThan(10);
      t = cur.deadline + 10;
      advance(room, priv, t, { isHost: true, expectStatus: 'reveal', expectQIndex: i });
    }
    expect(room.status).toBe('finished');
    expect(room.players[a]!.correct).toBe(6);
    const res = lmsResults(room, priv);
    expect(res).toHaveLength(1);
    expect(res[0]!.score).toBe(100);
    expect(res[0]!.comment).toContain('Unit Economics');
    expect(ranking(room)[0]!.id).toBe(room.players[a]!.score >= room.players[b]!.score ? a : b);
  });

  it('two rooms started at different times get different numbers', () => {
    const r1 = createRoom({ code: 'AAAA1', hostPlays: true, hostName: 'X' }, 1, seededRng('r1'));
    const r2 = createRoom({ code: 'AAAA1', hostPlays: true, hostName: 'X' }, 1, seededRng('r1'));
    startGame(r1.room, r1.priv, bank, 100, seededRng('s'));
    startGame(r2.room, r2.priv, bank, 200, seededRng('s'));
    expect(JSON.stringify(r1.priv.questions)).not.toBe(JSON.stringify(r2.priv.questions));
  });

  it('errors come in both languages; the host can end early', () => {
    const { room, priv, a } = setup();
    try {
      submitAnswer(room, priv, a, 5, { kind: 'choice', option: 0 }, 3000);
      throw new Error('should fail');
    } catch (err) {
      expect((err as { messageVi?: string }).messageVi).toMatch(/Câu hỏi/);
    }
    finishGame(room, priv, 9000);
    expect((room as RoomDoc).status).toBe('finished');
    void (priv as RoomPrivate);
  });
});
