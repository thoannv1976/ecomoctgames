import { describe, expect, it } from 'vitest';
import {
  CEO_ARCHETYPES,
  ROUNDS,
  advanceCeo,
  ceoBotDecision,
  ceoLmsResults,
  ceoMe,
  createCeoRoom,
  finishCeo,
  initCeo,
  joinCeo,
  playCeo,
  seededRng,
  simulateQuarter,
  startCeo,
  submitCeo,
  validateCeo,
  type CeoDecision,
} from '../src/index.js';

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

const plan = (round: number, crisis?: string): CeoDecision => ({
  price: 'premium',
  skus: 'focused',
  segment: 'mom',
  service: 'premium',
  ads: 150,
  creators: 50,
  crm: 130,
  mix: { web: 60, shopee: 30, tiktok: 10 },
  stock: 5000,
  shopeePromo: false,
  ...(round === 4 ? { ai: 'B' as const } : {}),
  ...(round === 5 ? { agent: ['catalog', 'policy'] as const } : {}),
  ...(round === 6 && crisis ? { crisis, predict: { revenue: 'down', profit: 'down', rating: 'down', pdr: 'down' } as const } : {}),
}) as CeoDecision;

describe('Game 12 rules', () => {
  it('validates budgets, channel mix and round-specific choices', () => {
    const ok = plan(1);
    expect(validateCeo(ok, 1, null).mix.web).toBe(60);
    expect(() => validateCeo({ ...ok, ads: 500, creators: 200 }, 1, null)).toThrow(/capped/);
    expect(() => validateCeo({ ...ok, mix: { web: 50, shopee: 30, tiktok: 10 } }, 1, null)).toThrow(/100%/);
    expect(() => validateCeo({ ...ok, stock: 1234 }, 1, null)).toThrow(/list/);
    expect(() => validateCeo(ok, 4, null)).toThrow(/A–E/);
    expect(() => validateCeo({ ...ok, crisis: 'shift' }, 6, 'cpc')).toThrow(/Predict/);
    expect(() => validateCeo({ ...ok, crisis: 'nope', predict: { revenue: 'up', profit: 'up', rating: 'up', pdr: 'up' } }, 6, 'cpc')).toThrow(/crisis/);
  });

  it('bot decisions are always valid', () => {
    for (const a of CEO_ARCHETYPES) {
      for (const lv of ['easy', 'medium', 'hard'] as const) {
        const st = initCeo(['x']);
        st.players.x!.crisis = 'viral';
        for (let r = 1; r <= ROUNDS; r++) {
          const d = ceoBotDecision(a, lv, st.players.x!, r, seededRng(`${a}${lv}${r}`));
          expect(() => validateCeo(d, r, 'viral'), `${a} ${lv} r${r}`).not.toThrow();
          simulateQuarter(st, ['x'], { x: { decision: d, defaulted: false } }, r, seededRng(`q${r}`));
        }
      }
    }
  });

  it('agent investments are paid once; CRM moves sales to the website', () => {
    const st = initCeo(['a', 'b']);
    const loyal = { ...plan(1), crm: 200, ads: 100, creators: 50 };
    const none = { ...plan(1), crm: 0, ads: 300, creators: 50 };
    for (let r = 1; r <= 3; r++) simulateQuarter(st, ['a', 'b'], { a: { decision: loyal, defaulted: false }, b: { decision: none, defaulted: false } }, r, seededRng(`c${r}`));
    expect(st.players.a!.loyal).toBeGreaterThan(st.players.b!.loyal * 1.5);
    st.players.a!.stock = 20000;
    const r5 = simulateQuarter(st, ['a', 'b'], { a: { decision: { ...plan(5), agent: ['api'] }, defaulted: false }, b: { decision: plan(1), defaulted: false } }, 5, seededRng('r5'));
    const r6 = simulateQuarter(st, ['a', 'b'], { a: { decision: { ...plan(1), agent: ['api'] }, defaulted: false }, b: { decision: plan(1), defaulted: false } }, 6, seededRng('r6'));
    expect(r5.reports.a!.kpis.ai).toBe(100);
    expect(r6.reports.a!.kpis.ai).toBe(0);
  });
});

describe('Game 12 balance', () => {
  it('price wars go broke; an applied D2C strategy usually wins against medium AI CEOs', () => {
    let student = 0;
    let discountWins = 0;
    let broke = 0;
    const N = 80;
    for (let g = 0; g < N; g++) {
      const r = playCeo({ discount: { archetype: 'discount', level: 'medium' }, ads: { archetype: 'ads', level: 'medium' }, platform: { archetype: 'platform', level: 'medium' }, balanced: { archetype: 'balanced', level: 'medium' }, aifirst: { archetype: 'aifirst', level: 'medium' }, student: { archetype: 'd2c', level: 'hard' } }, 500 + g);
      if (r.rank.student === 1) student++;
      if (r.rank.discount === 1) discountWins++;
      if (r.broke.discount) broke++;
    }
    expect(student / N).toBeGreaterThan(0.55);
    expect(discountWins).toBe(0);
    expect(broke / N).toBeGreaterThan(0.8);
  });
});

describe('Game 12 room', () => {
  it('plays 6 quarters with the crisis round; grades go to Moodle', () => {
    const rng = seededRng('ceo-room');
    const { room, priv, player } = createCeoRoom({ code: 'CEO01', hostPlays: true, hostName: 'Lan', settings: { decideSec: 0 }, hostLms: { hubUserId: 'u1', gradeTarget: 'gt' } }, 1000, rng);
    const b = joinCeo(room, priv, 'Minh', 1000, rng);
    startCeo(room, priv, 2000, rng);
    expect(room.order).toHaveLength(6);
    expect(Object.keys(room.crises)).toHaveLength(0);
    const a = player!.playerId;
    let t = 3000;
    for (let r = 1; r <= ROUNDS; r++) {
      expect(room.round).toBe(r);
      const myCrisis = room.crises[a];
      if (r === ROUNDS) expect(myCrisis).toBeTruthy();
      const crisisOpt = (c: string | undefined) => (c ? { cpc: 'shift', pricecut: 'value', viral: 'preorder', chatbot: 'govern', agent: 'model', ban: 'appeal', supplier: 'reprice', breach: 'cirl' }[c] : undefined);
      expect(submitCeo(room, priv, a, r, plan(r, crisisOpt(myCrisis)), t)).toBe(false);
      expect(submitCeo(room, priv, b.playerId, r, plan(r, crisisOpt(room.crises[b.playerId])), t)).toBe(true);
      expect(nestedArrayPath(room)).toBeNull();
      expect(nestedArrayPath(priv)).toBeNull();
      if (r < ROUNDS) {
        expect(room.status).toBe('results');
        t += 1000;
        expect(advanceCeo(room, priv, t, { isHost: true, expectStatus: 'results', expectRound: r })).toBe(true);
      }
    }
    expect(room.status).toBe('finished');
    const me = ceoMe(room, priv, a);
    expect(me.reports).toHaveLength(6);
    expect(me.crisisResult?.quality).toBe(20);
    expect(room.standings[a]!.crisisPts).toBeGreaterThanOrEqual(20);
    const res = ceoLmsResults(room, priv);
    expect(res).toHaveLength(1);
    expect(res[0]!.comment).toContain('CEO Simulator');
  });

  it('timer defaults and early end still finish the game', () => {
    const rng = seededRng('ceo-room2');
    const { room, priv } = createCeoRoom({ code: 'CEO02', hostPlays: false, settings: { decideSec: 120 } }, 1000, rng);
    const p = joinCeo(room, priv, 'An', 1000, rng);
    startCeo(room, priv, 2000, rng);
    expect(advanceCeo(room, priv, room.deadline! + 1, { isHost: false, expectStatus: 'decide', expectRound: 1 })).toBe(true);
    expect(room.standings[p.playerId]!.defaulted).toBe(true);
    finishCeo(room, priv, 9_000_000);
    expect(room.status).toBe('finished');
    expect(room.history).toHaveLength(ROUNDS);
  });
});
