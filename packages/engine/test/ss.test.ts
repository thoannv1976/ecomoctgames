import { describe, expect, it } from 'vitest';
import {
  SHOPPER_STREAM,
  SS_PERSONAS,
  SS_POINTS,
  SS_ROUNDS,
  SS_STAGES,
  advanceRs,
  createRsRoom,
  joinRs,
  rsLmsResults,
  rsMe,
  seededRng,
  ssPainOf,
  ssScorecard,
  startRs,
  submitRs,
  validateSs,
  type SsChannel,
  type SsDecision,
  type SsReport,
  type SsStage,
  type SsState,
  type SsView,
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

const zeroFix = () => Object.fromEntries(SS_STAGES.map((s) => [s, 0])) as Record<SsStage, number>;
const plan = (channel: SsChannel, fix: Partial<Record<SsStage, number>>, extra: Partial<SsDecision> = {}): SsDecision => ({
  channel,
  fix: { ...zeroFix(), ...fix },
  research: 'none',
  interviewOf: null,
  recovery: null,
  ...extra,
});
const baseOf = (st: SsState, id: string) => SS_PERSONAS.reduce((a, p) => a + st.cos[id]!.base[p]!, 0);

describe('Game 3 – Shopper Stream', () => {
  it('runs five months, counts only the customers who came back, and grades', () => {
    const def = SHOPPER_STREAM;
    const rng = seededRng('ss-room');
    const { room, priv, player } = createRsRoom(
      def,
      { code: 'SHOP1', hostPlays: true, hostName: 'Lan', hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } },
      1,
      rng,
    );
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    for (let r = 1; r <= SS_ROUNDS; r++) {
      const me = rsMe(def, room, priv, pid);
      const view = me.view as SsView;
      expect(view.points).toBe(SS_POINTS);
      const d = plan('search', { search: 2, compare: 1, buy: 2, review: 2, repeat: 3 }, view.incident ? { recovery: 'care' } : {});
      expect(submitRs(def, room, priv, pid, r, d, 10 + r)).toBe(true);
      const rep = rsMe(def, room, priv, pid).reports[r - 1] as SsReport;
      expect(rep.round).toBe(r);
      expect(rep.revenue).toBeGreaterThan(0);
      if (r < SS_ROUNDS) advanceRs(def, room, priv, 20 + r, { isHost: true });
    }
    expect(room.status).toBe('finished');
    const st = priv.state as SsState;
    const c = st.cos[pid]!;
    // Paying for Review and Repurchase builds a base that buys again.
    expect(baseOf(st, pid)).toBeGreaterThan(100);
    expect(c.repeatOrders).toBeGreaterThan(0);
    expect(ssScorecard(c).parts.clv).toBeGreaterThan(0);
    expect(rsMe(def, room, priv, pid).grade).not.toBeNull();
    expect(rsLmsResults(def, room, priv)[0]!.comment).toMatch(/^Shopper Stream · room SHOP1/);
    // The hidden persona weights never reach the public room document.
    expect(JSON.stringify(room)).not.toContain('"w"');
    expect(nestedArrayPath(room)).toBeNull();
    expect(nestedArrayPath(priv)).toBeNull();
  });

  it('one-time buyers add revenue and no score', () => {
    const def = SHOPPER_STREAM;
    const rng = seededRng('ss-gift');
    const { room, priv } = createRsRoom(def, { code: 'SHOP2', hostPlays: false }, 1, rng);
    room.settings.fillBots = false;
    const gift = joinRs(room, priv, 'Qua Tang', 1, rng).playerId;
    const keep = joinRs(room, priv, 'Giu Khach', 1, rng).playerId;
    startRs(def, room, priv, 2, rng);
    for (let r = 1; r <= SS_ROUNDS; r++) {
      // One brand lives on discovery and never pays for the steps after the first order.
      submitRs(def, room, priv, gift, r, plan('discover', { discover: 6, compare: 2, buy: 2 }, { recovery: 'ignore' }), 10 + r);
      submitRs(def, room, priv, keep, r, plan('search', { search: 2, buy: 2, review: 3, repeat: 3 }, { recovery: 'care' }), 10 + r);
      if (r < SS_ROUNDS) advanceRs(def, room, priv, 20 + r, { isHost: true });
    }
    const st = priv.state as SsState;
    const g = st.cos[gift]!;
    const k = st.cos[keep]!;
    expect(g.revenue).toBeGreaterThan(0);
    // The discovery brand sells more and keeps less: the score follows the repeat customers.
    expect(k.repeatOrders / k.orders).toBeGreaterThan(g.repeatOrders / g.orders);
    expect(ssScorecard(k).total).toBeGreaterThan(ssScorecard(g).total);
    expect(room.standings[keep]!.rank).toBe(1);
  });

  it('a delivery failure answered with care leaves the customers more loyal', () => {
    const def = SHOPPER_STREAM;
    const outcome = (choice: 'ignore' | 'care') => {
      const rng = seededRng('ss-recover');
      const { room, priv, player } = createRsRoom(def, { code: 'SHOP3', hostPlays: true, hostName: 'Mai' }, 1, rng);
      room.settings.fillBots = false;
      startRs(def, room, priv, 2, rng);
      const pid = player!.playerId;
      let hit = 0;
      for (let r = 1; r <= SS_ROUNDS; r++) {
        const view = rsMe(def, room, priv, pid).view as SsView;
        if (view.incident) hit = view.incident.customers;
        submitRs(def, room, priv, pid, r, plan('search', { search: 2, buy: 3, review: 2, repeat: 3 }, view.incident ? { recovery: choice } : {}), 10 + r);
        if (r < SS_ROUNDS) advanceRs(def, room, priv, 20 + r, { isHost: true });
      }
      const st = priv.state as SsState;
      return { hit, sat: st.cos[pid]!.sat, clv: st.cos[pid]!.clv, base: baseOf(st, pid) };
    };
    const ignored = outcome('ignore');
    const cared = outcome('care');
    // The failure happened to the only company in the room, so it had to be answered.
    expect(cared.hit).toBeGreaterThan(0);
    expect(cared.sat).toBeGreaterThan(ignored.sat);
    expect(cared.base).toBeGreaterThan(ignored.base);
    expect(cared.clv).toBeGreaterThan(ignored.clv);
  });

  it('reveals a persona only through research, and review mining only speaks for your own buyers', () => {
    const def = SHOPPER_STREAM;
    const rng = seededRng('ss-research');
    const { room, priv, player } = createRsRoom(def, { code: 'SHOP4', hostPlays: true, hostName: 'Hoa' }, 1, rng);
    room.settings.fillBots = false;
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    const st = priv.state as SsState;
    expect((rsMe(def, room, priv, pid).view as SsView).known.pro).toBeNull();
    submitRs(def, room, priv, pid, 1, plan('search', { search: 3, buy: 3, repeat: 3 }, { research: 'interview', interviewOf: 'pro' }), 10);
    const rep = rsMe(def, room, priv, pid).reports[0] as SsReport;
    expect(rep.reveal?.persona).toBe('pro');
    expect(rep.reveal?.pain).toBe(ssPainOf(st, 'pro'));
    const known = (rsMe(def, room, priv, pid).view as SsView).known;
    expect(known.pro?.jobs.vi.length).toBeGreaterThan(5);
    expect(known.gifter).toBeNull();
    advanceRs(def, room, priv, 20, { isHost: true });
    // Mining reviews tells you about whoever already buys from you, not about who you are losing.
    submitRs(def, room, priv, pid, 2, plan('search', { search: 3, buy: 3, repeat: 3 }, { research: 'reviews' }), 30);
    const rep2 = rsMe(def, room, priv, pid).reports[1] as SsReport;
    const biggest = SS_PERSONAS.slice().sort((a, b) => st.cos[pid]!.base[b]! - st.cos[pid]!.base[a]!)[0];
    expect(rep2.reveal?.persona).toBe(biggest);
  });

  it('validates the points, the interview and the recovery answer', () => {
    const rng = seededRng('ss-val');
    const { room, priv, player } = createRsRoom(SHOPPER_STREAM, { code: 'SHOP5', hostPlays: true, hostName: 'Chi' }, 1, rng);
    startRs(SHOPPER_STREAM, room, priv, 2, rng);
    const pid = player!.playerId;
    const st = priv.state as SsState;
    expect(validateSs(plan('search', { buy: 10 }), 1, st, pid).fix.buy).toBe(10);
    expect(() => validateSs(plan('search', { buy: 11 }), 1, st, pid)).toThrow();
    expect(() => validateSs(plan('search', { buy: 2.5 }), 1, st, pid)).toThrow();
    expect(() => validateSs(plan('search', { buy: -1 }), 1, st, pid)).toThrow();
    expect(() => validateSs({ channel: 'telepathy', fix: zeroFix(), research: 'none' }, 1, st, pid)).toThrow();
    // An interview costs one of the ten points.
    expect(() => validateSs(plan('search', { buy: 10 }, { research: 'interview', interviewOf: 'mom' }), 1, st, pid)).toThrow();
    expect(validateSs(plan('search', { buy: 9 }, { research: 'interview', interviewOf: 'mom' }), 1, st, pid).interviewOf).toBe('mom');
    expect(() => validateSs(plan('search', { buy: 9 }, { research: 'interview' }), 1, st, pid)).toThrow();
    // No failure pending: a recovery answer is simply dropped.
    expect(validateSs(plan('search', { buy: 5 }, { recovery: 'care' }), 1, st, pid).recovery).toBeNull();
    st.cos[pid]!.pending = { ...Object.fromEntries(SS_PERSONAS.map((p) => [p, 0])), mom: 50 } as Record<(typeof SS_PERSONAS)[number], number>;
    expect(() => validateSs(plan('search', { buy: 5 }), 1, st, pid)).toThrow();
    expect(validateSs(plan('search', { buy: 5 }, { recovery: 'care' }), 1, st, pid).recovery).toBe('care');
  });
});
