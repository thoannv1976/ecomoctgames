import { describe, expect, it } from 'vitest';
import {
  AGENT_ARENA,
  AG_CAPS,
  AG_POINTS,
  AG_ROUNDS,
  advanceRs,
  agScorecard,
  createRsRoom,
  joinRs,
  rsLmsResults,
  rsMe,
  seededRng,
  startRs,
  submitRs,
  validateAg,
  type AgCap,
  type AgDecision,
  type AgReport,
  type AgState,
  type AgView,
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

const zero = () => Object.fromEntries(AG_CAPS.map((c) => [c, 0])) as Record<AgCap, number>;
const plan = (invest: Partial<Record<AgCap, number>>, extra: Partial<AgDecision> = {}): AgDecision => ({
  invest: { ...zero(), ...invest },
  guard: 'none',
  handover: 'never',
  diversity: false,
  holdout: false,
  ...extra,
});

describe('Game 10 – Agent Arena', () => {
  it('runs five quarters, charges for what is held and grades', () => {
    const def = AGENT_ARENA;
    const rng = seededRng('ag-room');
    const { room, priv, player } = createRsRoom(
      def,
      { code: 'AGENT1', hostPlays: true, hostName: 'Lan', hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } },
      1,
      rng,
    );
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    // Trust and a readable catalogue first, the ordering API as the agent share grows.
    const steps: Array<Partial<Record<AgCap, number>>> = [
      { trust: 1, catalog: 1, reco: 1 },
      { trust: 1, catalog: 2, reco: 1, api: 1 },
      { trust: 1, catalog: 2, reco: 1, api: 2, stock: 2 },
      { trust: 2, catalog: 3, reco: 1, api: 2, stock: 2 },
      { trust: 2, catalog: 3, reco: 1, api: 2, stock: 2, policy: 2 },
    ];
    for (let r = 1; r <= AG_ROUNDS; r++) {
      const view = rsMe(def, room, priv, pid).view as AgView;
      expect(view.points).toBe(AG_POINTS);
      expect(view.agentShareNow).toBeGreaterThan(0);
      expect(submitRs(def, room, priv, pid, r, plan(steps[r - 1]!, { holdout: true, diversity: true }), 10 + r)).toBe(true);
      const rep = rsMe(def, room, priv, pid).reports[r - 1] as AgReport;
      expect(rep.round).toBe(r);
      expect(rep.spent).toBeLessThanOrEqual(AG_POINTS);
      // A control group gives the second number; the dashboard figure is always the larger one.
      expect(rep.liftReal).not.toBeNull();
      expect(rep.liftClaimed).toBeGreaterThanOrEqual(rep.liftReal!);
      // Holding capabilities costs money every quarter.
      if (r > 1) expect(rep.opex).toBeGreaterThan(0);
      if (r < AG_ROUNDS) advanceRs(def, room, priv, 20 + r, { isHost: true });
    }
    expect(room.status).toBe('finished');
    const st = priv.state as AgState;
    const c = st.cos[pid]!;
    expect(c.levels.catalog).toBe(3);
    expect(agScorecard(c).parts.control).toBeGreaterThan(15);
    expect(rsMe(def, room, priv, pid).grade).not.toBeNull();
    expect(rsLmsResults(def, room, priv)[0]!.comment).toMatch(/^Agent Arena · room AGENT1/);
    // The agent's weights never reach the public room document.
    expect(JSON.stringify(room)).not.toContain('"w"');
    expect(nestedArrayPath(room)).toBeNull();
    expect(nestedArrayPath(priv)).toBeNull();
  });

  it('without an ordering API an agent can recommend you but never buy from you', () => {
    const def = AGENT_ARENA;
    const rng = seededRng('ag-api');
    const { room, priv } = createRsRoom(def, { code: 'AGENT2', hostPlays: false }, 1, rng);
    room.settings.fillBots = false;
    const closed = joinRs(room, priv, 'Khong API', 1, rng).playerId;
    const open = joinRs(room, priv, 'Co API', 1, rng).playerId;
    startRs(def, room, priv, 2, rng);
    // Both are equally readable; only one can be transacted with.
    submitRs(def, room, priv, closed, 1, plan({ catalog: 2, stock: 1, trust: 1 }), 10);
    submitRs(def, room, priv, open, 1, plan({ catalog: 2, stock: 1, api: 1, trust: 1 }), 10);
    const a = rsMe(def, room, priv, closed).reports[0] as AgReport;
    const b = rsMe(def, room, priv, open).reports[0] as AgReport;
    expect(a.ordersAgent).toBe(0);
    expect(b.ordersAgent).toBeGreaterThan(0);
    expect(a.notes.some((n) => /tham khảo/.test(n.vi))).toBe(true);
  });

  it('an automated system without its control costs more than the control would have', () => {
    const def = AGENT_ARENA;
    const run = (governed: boolean) => {
      const rng = seededRng('ag-gov');
      const { room, priv, player } = createRsRoom(def, { code: 'AGENT3', hostPlays: true, hostName: 'Mai' }, 1, rng);
      room.settings.fillBots = false;
      startRs(def, room, priv, 2, rng);
      const pid = player!.playerId;
      for (let r = 1; r <= AG_ROUNDS; r++) {
        const d = plan(
          { price: r >= 2 ? 2 : 1, reco: r >= 2 ? 2 : 1, bot: r >= 3 ? 2 : 0, trust: 1, catalog: 1 },
          governed ? { guard: 'caps_log', handover: 'risk_ask', diversity: true, holdout: true } : {},
        );
        submitRs(def, room, priv, pid, r, d, 10 + r);
        if (r < AG_ROUNDS) advanceRs(def, room, priv, 20 + r, { isHost: true });
      }
      const st = priv.state as AgState;
      const reports = rsMe(def, room, priv, pid).reports as AgReport[];
      return {
        risks: reports.reduce((a, x) => a + x.risks.length, 0),
        concentration: st.cos[pid]!.concentration,
        control: agScorecard(st.cos[pid]!).parts.control!,
        score: agScorecard(st.cos[pid]!).total,
      };
    };
    const loose = run(false);
    const tight = run(true);
    expect(tight.risks).toBeLessThan(loose.risks);
    // A recommender with no diversity constraint concentrates the catalogue quarter after quarter.
    expect(loose.concentration).toBeGreaterThan(0.3);
    expect(tight.concentration).toBeLessThan(0.1);
    expect(tight.control).toBeGreaterThan(loose.control);
    expect(tight.score).toBeGreaterThan(loose.score);
  });

  it('validates the investment: no downgrades, no overspending', () => {
    const rng = seededRng('ag-val');
    const { room, priv, player } = createRsRoom(AGENT_ARENA, { code: 'AGENT4', hostPlays: true, hostName: 'Chi' }, 1, rng);
    startRs(AGENT_ARENA, room, priv, 2, rng);
    const pid = player!.playerId;
    const st = priv.state as AgState;
    // Level 1 costs 1 point, level 2 costs 2 more, level 3 costs 4 more: 8 points buys one capability outright.
    expect(validateAg(plan({ catalog: 3, trust: 1 }), 1, st, pid).invest.catalog).toBe(3);
    expect(() => validateAg(plan({ catalog: 3, trust: 2 }), 1, st, pid)).toThrow();
    expect(() => validateAg(plan({ catalog: 4 }), 1, st, pid)).toThrow();
    expect(() => validateAg(plan({ catalog: 1.5 }), 1, st, pid)).toThrow();
    expect(() => validateAg({ invest: 'all', guard: 'none' }, 1, st, pid)).toThrow();
    // Unknown control values fall back to the unguarded default rather than throwing.
    expect(validateAg({ ...plan({ catalog: 1 }), guard: 'magic' }, 1, st, pid).guard).toBe('none');
    st.cos[pid]!.levels.catalog = 2;
    expect(() => validateAg(plan({ catalog: 1 }), 2, st, pid)).toThrow();
    expect(validateAg(plan({ catalog: 2 }), 2, st, pid).invest.catalog).toBe(2);
  });
});
