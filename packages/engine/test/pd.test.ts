import { describe, expect, it } from 'vitest';
import { PEAK_DAY, advanceRs, createRsRoom, rsLmsResults, rsMe, seededRng, startRs, submitRs, validatePd, type PdDecision, type PdReport, type PdView } from '../src/index.js';

function nestedArrayPath(v: unknown, path = '$'): string | null {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      if (Array.isArray(v[i])) return `${path}[${i}]`;
      const inner = nestedArrayPath(v[i], `${path}[${i}]`);
      if (inner) return inner;
    }
  } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    const inner = nestedArrayPath(x, `${path}.${k}`);
    if (inner) return inner;
  }
  return null;
}

const plan = (round: number, top?: string[]): PdDecision =>
  round === 1
    ? { stock: 4000, fulfil: '3pl', speed: 'fast', returns: '7day', fraud: 'basic', cod: 'confirm' }
    : round <= 4
      ? { cod: 'confirm', cs: 5, discount: 10, ads: 100 }
      : { clearance: 30, refund: 'fast', apology: false, diagnosis: (top ?? ['discount', 'delivery']) as PdDecision['diagnosis'] };

describe('Game 8 – Peak Day Ops', () => {
  it('prepares, runs three sale blocks, settles the bill and grades', () => {
    const def = PEAK_DAY;
    const rng = seededRng('pd-room');
    const { room, priv, player } = createRsRoom(def, { code: 'PEAK1', hostPlays: true, hostName: 'Ha', hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } }, 1, rng);
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    for (let r = 1; r <= 5; r++) {
      const view = rsMe(def, room, priv, pid).view as PdView | null;
      const top = view ? Object.entries(view.totals).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k) : undefined;
      expect(submitRs(def, room, priv, pid, r, plan(r, top), 10 + r)).toBe(true);
      const rep = rsMe(def, room, priv, pid).reports[r - 1] as PdReport;
      if (r >= 2 && r <= 4) expect(rep.block!.orders).toBeGreaterThan(0);
      if (r === 5) expect(rep.topCosts).toHaveLength(2);
      if (r < 5) advanceRs(def, room, priv, 20 + r, { isHost: true });
    }
    expect(room.status).toBe('finished');
    const me = rsMe(def, room, priv, pid);
    expect(me.grade).not.toBeNull();
    expect(rsLmsResults(def, room, priv)[0]!.comment).toMatch(/^Peak Day Ops 11.11 · room PEAK1/);
    expect(nestedArrayPath(room)).toBeNull();
    expect(nestedArrayPath(priv)).toBeNull();
  });

  it('validates each phase', () => {
    expect(validatePd(plan(1), 1).stock).toBe(4000);
    expect(() => validatePd({ ...plan(1), fulfil: 'drone' }, 1)).toThrow();
    expect(() => validatePd({ ...plan(2), discount: 15 }, 2)).toThrow();
    expect(validatePd({ ...plan(3), expedite: 1000 }, 3).expedite).toBe(1000);
    expect(validatePd({ ...plan(4), expedite: 1000 }, 4).expedite).toBeUndefined();
    expect(() => validatePd({ ...plan(5), diagnosis: ['ads'] }, 5)).toThrow();
    expect(() => validatePd({ ...plan(5), diagnosis: ['ads', 'ads'] }, 5)).toThrow();
  });
});
