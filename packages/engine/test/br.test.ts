import { describe, expect, it } from 'vitest';
import {
  BORDER_RUN,
  BR_LAYERS,
  BR_MARKETS,
  BR_POINTS,
  BR_ROUNDS,
  advanceRs,
  brLanded,
  brScorecard,
  createRsRoom,
  joinRs,
  rsLmsResults,
  rsMe,
  seededRng,
  startRs,
  submitRs,
  trustOf,
  validateBr,
  type BrDecision,
  type BrLayer,
  type BrMarket,
  type BrMode,
  type BrReport,
  type BrState,
  type BrView,
} from '../src/index.js';

function nestedArrayPath(v: unknown, path = '$'): string | null {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      if (Array.isArray(v[i])) return `${path}[${i}]`;
      const inner = nestedArrayPath(v[i], `${path}[${i}]`);
      if (inner) return inner;
    }
  } else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      const inner = nestedArrayPath(x, `${path}.${k}`);
      if (inner) return inner;
    }
  return null;
}

const zero = () => Object.fromEntries(BR_LAYERS.map((l) => [l, 0])) as Record<BrLayer, number>;
const none = () => Object.fromEntries(BR_MARKETS.map((m) => [m, 'none'])) as Record<BrMarket, BrMode>;
const plan = (o: Partial<BrDecision> = {}): BrDecision => ({
  mode: none(),
  build: zero(),
  incoterm: 'ddp',
  localise: 'ai',
  file: [],
  returns: 'refund',
  shortcuts: [],
  ...o,
});

describe('Game 11 – Border Run', () => {
  it('runs five quarters, charges for what is held and grades', () => {
    const def = BORDER_RUN;
    const rng = seededRng('br-room');
    const { room, priv, player } = createRsRoom(
      def,
      { code: 'BORDR1', hostPlays: true, hostName: 'Lan', hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } },
      1,
      rng,
    );
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    // Singapore first, then the United States; every layer off zero before anything is deepened.
    const steps: Array<Partial<BrDecision>> = [
      { mode: { ...none(), sg: 'market' }, build: { identity: 1, product: 1, content: 1, delivery: 1, remedy: 1, data: 0 } },
      { mode: { ...none(), sg: 'market', us: 'market' }, build: { identity: 1, product: 1, content: 1, delivery: 1, remedy: 1, data: 1 }, file: ['sg'], localise: 'review' },
      { mode: { ...none(), sg: 'market', us: 'market' }, build: { identity: 1, product: 2, content: 2, delivery: 1, remedy: 1, data: 1 }, file: ['us'], localise: 'review' },
      { mode: { ...none(), sg: 'market', us: 'local' }, build: { identity: 1, product: 2, content: 2, delivery: 1, remedy: 1, data: 1 }, localise: 'review', returns: 'reduce' },
      { mode: { ...none(), sg: 'market', us: 'local' }, build: { identity: 2, product: 2, content: 2, delivery: 2, remedy: 1, data: 1 }, localise: 'approve', returns: 'reduce' },
    ];
    for (let r = 1; r <= BR_ROUNDS; r++) {
      const view = rsMe(def, room, priv, pid).view as BrView;
      expect(view.points).toBe(BR_POINTS);
      expect(submitRs(def, room, priv, pid, r, plan(steps[r - 1]!), 10 + r)).toBe(true);
      const rep = rsMe(def, room, priv, pid).reports[r - 1] as BrReport;
      expect(rep.round).toBe(r);
      expect(rep.spent).toBeLessThanOrEqual(BR_POINTS);
      expect(rep.lines.length).toBeGreaterThan(0);
      // Holding a market and a trust stack costs money every quarter.
      expect(rep.opex).toBeGreaterThan(0);
      if (r < BR_ROUNDS) advanceRs(def, room, priv, 20 + r, { isHost: true });
    }
    expect(room.status).toBe('finished');
    const st = priv.state as BrState;
    const c = st.cos[pid]!;
    expect(c.mode.us).toBe('local');
    expect(c.filed).toContain('sg');
    expect(trustOf(c).min).toBeGreaterThanOrEqual(1);
    expect(brScorecard(c).parts.licence).toBeGreaterThan(10);
    expect(rsMe(def, room, priv, pid).grade).not.toBeNull();
    expect(rsLmsResults(def, room, priv)[0]!.comment).toMatch(/^Border Run · room BORDR1/);
    // What the destination really expects, and how fast a squatter moves, never reach the public room.
    expect(JSON.stringify(room)).not.toContain('"bar"');
    expect(JSON.stringify(room)).not.toContain('"squat"');
    expect(nestedArrayPath(room)).toBeNull();
    expect(nestedArrayPath(priv)).toBeNull();
  });

  it('a threshold is a policy choice: the same parcel is duty-free in quarter 1 and assessed in quarter 4', () => {
    const before = brLanded('jp', 'market', 1, { incoterm: 'ddp', returns: 'reduce' });
    const after = brLanded('jp', 'market', 4, { incoterm: 'ddp', returns: 'reduce' });
    expect(before.dutiable).toBe(false);
    expect(before.duty).toBe(0);
    expect(after.dutiable).toBe(true);
    expect(after.duty).toBeGreaterThan(0);
    // The clearance charge per parcel rises too, so the model changes and not just the price.
    expect(after.clearance).toBeGreaterThan(before.clearance);
    expect(after.unit).toBeLessThan(before.unit * 0.6);
    // Moving the stock ahead in bulk is the response: one declaration and cheap per-unit freight.
    const bulk = brLanded('jp', 'local', 4, { incoterm: 'ddp', returns: 'reduce' });
    expect(bulk.unit).toBeGreaterThan(after.unit);
    // The United States has been assessing every parcel since before the game started.
    expect(brLanded('us', 'market', 1, { incoterm: 'ddp', returns: 'reduce' }).dutiable).toBe(true);
  });

  it('under Delivered At Place the duty leaves your spreadsheet and arrives at the customer’s door', () => {
    const ddp = brLanded('us', 'market', 1, { incoterm: 'ddp', returns: 'reduce' });
    const dap = brLanded('us', 'market', 1, { incoterm: 'dap', returns: 'reduce' });
    // The sticker price looks lower and the duty is still there.
    expect(dap.price).toBeLessThan(ddp.price);
    expect(dap.refuseRate).toBeGreaterThan(0);
    expect(ddp.refuseRate).toBe(0);
    // One refusal costs the goods and the freight both ways.
    expect(dap.refuseCost).toBeGreaterThan(dap.freight * 2);
    // Only the fourth returns option lowers the total cost instead of moving it.
    const reduce = brLanded('us', 'market', 1, { incoterm: 'ddp', returns: 'reduce' });
    const refund = brLanded('us', 'market', 1, { incoterm: 'ddp', returns: 'refund' });
    const reverse = brLanded('us', 'market', 1, { incoterm: 'ddp', returns: 'reverse' });
    expect(reduce.returns).toBeLessThan(refund.returns);
    expect(reverse.returns).toBeGreaterThan(refund.returns);
  });

  it('the trust stack fails at its lowest missing layer, and trust is what converts abroad', () => {
    const def = BORDER_RUN;
    const run = (build: Record<BrLayer, number>) => {
      const rng = seededRng('br-trust');
      const { room, priv, player } = createRsRoom(def, { code: 'BORDR2', hostPlays: true, hostName: 'Mai' }, 1, rng);
      room.settings.fillBots = false;
      startRs(def, room, priv, 2, rng);
      const pid = player!.playerId;
      submitRs(def, room, priv, pid, 1, plan({ mode: { ...none(), sg: 'market' }, build }), 10);
      const rep = rsMe(def, room, priv, pid).reports[0] as BrReport;
      return { trust: rep.trust, orders: rep.lines[0]!.orders };
    };
    // Six team-quarters either way: two layers taken to level 2, or every layer taken to level 1.
    const hole = run({ identity: 2, product: 2, content: 0, delivery: 0, remedy: 0, data: 0 });
    const even = run({ identity: 1, product: 1, content: 1, delivery: 1, remedy: 1, data: 1 });
    expect(even.trust).toBeGreaterThan(hole.trust);
    expect(even.orders).toBeGreaterThan(hole.orders);
  });

  it('a trademark is territorial: sell without filing and the brand can be taken', () => {
    const def = BORDER_RUN;
    const rng = seededRng('br-squat');
    const { room, priv, player } = createRsRoom(def, { code: 'BORDR3', hostPlays: true, hostName: 'Chi' }, 1, rng);
    room.settings.fillBots = false;
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    const st = priv.state as BrState;
    const c = st.cos[pid]!;
    // Somebody is already watching the biggest market, and the sales there are visible.
    st.squat.us = 3;
    c.revByMarket.us = 5000;
    for (let r = 1; r <= 3 && !c.squatted.length; r++) {
      submitRs(def, room, priv, pid, r, plan({ mode: { ...none(), us: 'market' }, build: { identity: 1, product: 1, content: 1, delivery: 1, remedy: 1, data: 1 } }), 10 + r);
      if (r < 3) advanceRs(def, room, priv, 20 + r, { isHost: true });
    }
    expect(c.squatted).toContain('us');
    expect(c.mode.us).toBe('none');
    // And you cannot simply walk back in.
    expect(() => validateBr(plan({ mode: { ...none(), us: 'market' } }), 4, st, pid)).toThrow();
  });

  it('validates the plan: no downgrades, no retreat down the ladder, no overspending', () => {
    const rng = seededRng('br-val');
    const { room, priv, player } = createRsRoom(BORDER_RUN, { code: 'BORDR4', hostPlays: true, hostName: 'Ha' }, 1, rng);
    startRs(BORDER_RUN, room, priv, 2, rng);
    const pid = player!.playerId;
    const st = priv.state as BrState;
    // A marketplace seat costs 3 of the 9 team-quarters; six layers at level 1 cost 6.
    expect(validateBr(plan({ mode: { ...none(), sg: 'market' }, build: { identity: 1, product: 1, content: 1, delivery: 1, remedy: 1, data: 1 } }), 1, st, pid).mode.sg).toBe('market');
    expect(() => validateBr(plan({ mode: { ...none(), sg: 'market', us: 'market' }, build: { identity: 1, product: 1, content: 1, delivery: 1, remedy: 1, data: 1 } }), 1, st, pid)).toThrow();
    expect(() => validateBr(plan({ build: { ...zero(), identity: 4 } }), 1, st, pid)).toThrow();
    expect(() => validateBr(plan({ build: { ...zero(), identity: 1.5 } }), 1, st, pid)).toThrow();
    expect(() => validateBr({ build: 'all' }, 1, st, pid)).toThrow();
    // At most two cards a quarter, and an unknown choice falls back to the safe default.
    expect(() => validateBr(plan({ mode: { ...none(), sg: 'market' }, shortcuts: ['reviews', 'countdown', 'hidden'] }), 1, st, pid)).toThrow();
    expect(validateBr({ ...plan({ mode: { ...none(), sg: 'market' } }), incoterm: 'magic' }, 1, st, pid).incoterm).toBe('ddp');
    // Filing only counts in a market you are actually in.
    expect(validateBr(plan({ mode: { ...none(), sg: 'market' }, file: ['us', 'sg'] }), 1, st, pid).file).toEqual(['sg']);
    // What is built stays built, and the ladder of entry only goes up.
    const c = st.cos[pid]!;
    c.build.identity = 2;
    c.mode.sg = 'own';
    expect(() => validateBr(plan({ mode: { ...none(), sg: 'own' }, build: { ...zero(), identity: 1 } }), 2, st, pid)).toThrow();
    expect(() => validateBr(plan({ mode: { ...none(), sg: 'market' }, build: { ...zero(), identity: 2 } }), 2, st, pid)).toThrow();
    expect(validateBr(plan({ mode: { ...none(), sg: 'local' }, build: { ...zero(), identity: 2 } }), 2, st, pid).mode.sg).toBe('local');
  });

  it('a facilitator room fills with AI brands and a missing plan enters nothing', () => {
    const def = BORDER_RUN;
    const rng = seededRng('br-host');
    const { room, priv } = createRsRoom(def, { code: 'BORDR5', hostPlays: false }, 1, rng);
    const a = joinRs(room, priv, 'An', 1, rng).playerId;
    startRs(def, room, priv, 2, rng);
    expect(room.order).toHaveLength(6);
    advanceRs(def, room, priv, 3, { isHost: true, expectStatus: 'decide', expectRound: 1 });
    const st = priv.state as BrState;
    expect(room.standings[a]!.defaulted).toBe(true);
    expect(room.standings[a]!.cols.markets).toBe(0);
    // The AI brands did go abroad, and how crowded each destination is stays public.
    expect(Object.values(room.standings).some((s) => (s.cols.markets ?? 0) > 0)).toBe(true);
    const pub = room.pub as { crowd?: Record<string, number>; dutiable?: Record<string, boolean> };
    expect(Object.values(pub.crowd ?? {}).reduce((x, y) => x + y, 0)).toBeGreaterThan(0);
    expect(pub.dutiable?.us).toBe(true);
    expect(pub.dutiable?.sg).toBe(false);
    expect(Object.values(st.cos).some((c) => BR_MARKETS.some((m) => c.mode[m] !== 'none'))).toBe(true);
  });
});
