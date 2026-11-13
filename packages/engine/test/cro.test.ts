import { describe, expect, it } from 'vitest';
import { CRO_BATTLE, advanceRs, createRsRoom, initCro, rsLmsResults, rsMe, seededRng, simulateCro, startRs, submitRs, validateCro, type CroDecision, type CroReport, type CroView } from '../src/index.js';

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

describe('Game 6 – CRO Battle', () => {
  it('plays five sprints, hides the truth until the end, grades and reports to Moodle', () => {
    const def = CRO_BATTLE;
    const rng = seededRng('cro-room');
    const { room, priv, player } = createRsRoom(def, { code: 'CROB1', hostPlays: true, hostName: 'Lan', hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } }, 1, rng);
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    let ship: string[] = ['safari'];
    for (let r = 1; r <= 5; r++) {
      const tests = r === 1 ? [{ change: 'guest', share: 50, weeks: 4, peek: false }, { change: 'shipfee', share: 50, weeks: 4, peek: false }] : [];
      expect(submitRs(def, room, priv, pid, r, { ship, tests }, 10 + r)).toBe(true);
      const me = rsMe(def, room, priv, pid);
      const rep = me.reports[r - 1] as CroReport;
      if (r === 1) {
        expect(rep.tests).toHaveLength(2);
        ship = ['safari', ...rep.tests.filter((t) => t.p < 0.05 && t.lift > 0).map((t) => t.change)];
      }
      if (r < 5) {
        expect((me.view as CroView).truth).toBeUndefined();
        expect((room.pub as { trueCr?: unknown }).trueCr).toBeUndefined();
        expect(room.status).toBe('results');
        advanceRs(def, room, priv, 20 + r, { isHost: true });
      }
    }
    expect(room.status).toBe('finished');
    const me = rsMe(def, room, priv, pid);
    expect((me.view as CroView).trueCr).toBeGreaterThan(0.018);
    expect(me.badges).toContain('fixer');
    expect(me.grade).not.toBeNull();
    expect((room.pub as { trueCr?: Record<string, number> }).trueCr?.[pid]).toBeGreaterThan(0);
    expect(rsLmsResults(def, room, priv)[0]!.comment).toMatch(/^CRO Battle · room CROB1/);
    expect(nestedArrayPath(room)).toBeNull();
    expect(nestedArrayPath(priv)).toBeNull();
  });

  it('validates plans', () => {
    const ok: CroDecision = { ship: ['safari'], tests: [{ change: 'guest', share: 50, weeks: 4, peek: false }] };
    expect(validateCro(ok, 1)).toEqual(ok);
    expect(() => validateCro({ ship: [], tests: [ok.tests[0], ok.tests[0]] }, 1)).toThrow();
    expect(() => validateCro({ ship: ['guest'], tests: ok.tests }, 1)).toThrow();
    expect(() => validateCro({ ship: [], tests: [{ change: 'guest', share: 30, weeks: 4 }] }, 1)).toThrow();
    expect(() => validateCro(ok, 5)).toThrow();
    expect(() => validateCro({ ship: ['nope'], tests: [] }, 1)).toThrow();
  });

  it('peeking at a change with no real effect produces far more false winners', () => {
    const rate = (peek: boolean) => {
      let wins = 0;
      for (let g = 0; g < 200; g++) {
        const rng = seededRng(`fp${peek}${g}`);
        const st = initCro(['a'], rng);
        const out = simulateCro(st, ['a'], { a: { decision: { ship: [], tests: [{ change: 'colour', share: 50, weeks: 4, peek }] }, defaulted: false } }, 2, rng);
        const t = out.reports.a!.tests[0]!;
        if (t.p < 0.05 && t.lift > 0) wins++;
      }
      return wins / 200;
    };
    expect(rate(true)).toBeGreaterThan(rate(false) * 2);
  });
});
