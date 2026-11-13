import { describe, expect, it } from 'vitest';
import {
  PLATFORM_WARS,
  advanceRs,
  createRsRoom,
  finishRs,
  joinRs,
  rsGame,
  rsLmsResults,
  rsMe,
  seededRng,
  startRs,
  submitRs,
  validatePw,
  type PwDecision,
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

const plan = (round: number): PwDecision => ({ take: round <= 2 ? 4 : 9, subsidy: round <= 2 ? 5 : 2, toSellers: round <= 2 ? 80 : 40, ads: round >= 3 ? 1 : 0, trust: 1.5, program: 'tiers', ...(round >= 4 ? { ownBrand: false } : {}) });

describe('Game 2 – Platform Wars', () => {
  it('plays six quarters with bots, grades the human and sends an LMS result', () => {
    const def = rsGame('platform-wars');
    const rng = seededRng('pw-room');
    const t0 = 1_000_000;
    const { room, priv, player } = createRsRoom(def, { code: 'PWAR1', hostPlays: true, hostName: 'Lan', hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } }, t0, rng);
    joinRs(room, priv, 'Minh', t0, rng);
    startRs(def, room, priv, t0, rng);
    expect(room.order).toHaveLength(6);
    expect(room.status).toBe('decide');
    const minh = room.order[1]!;
    for (let r = 1; r <= 6; r++) {
      expect(submitRs(def, room, priv, player!.playerId, r, plan(r), t0 + r)).toBe(false);
      if (r === 3) {
        // Minh does not submit: the host closes the quarter and Minh gets last quarter's plan.
        expect(advanceRs(def, room, priv, t0 + r, { isHost: true, expectStatus: 'decide', expectRound: r })).toBe(true);
        expect(room.standings[minh]!.defaulted).toBe(true);
      } else expect(submitRs(def, room, priv, minh, r, plan(r), t0 + r)).toBe(true);
      if (r < 6) {
        expect(room.status).toBe('results');
        advanceRs(def, room, priv, t0 + r, { isHost: true });
      }
    }
    expect(room.status).toBe('finished');
    expect(nestedArrayPath(room)).toBeNull();
    expect(nestedArrayPath(priv)).toBeNull();
    const me = rsMe(def, room, priv, player!.playerId);
    expect(me.reports).toHaveLength(6);
    expect(me.grade).not.toBeNull();
    expect(me.scorecard.total).toBeGreaterThan(0);
    const sent = rsLmsResults(def, room, priv);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.comment).toMatch(/^Platform Wars · room PWAR1 · rank \d\/6/);
    expect(Object.keys(room.pub.share as object)).toHaveLength(6);
  });

  it('rejects bad plans and only keeps own-brand from quarter 4', () => {
    expect(() => validatePw({ ...plan(1), take: 40 }, 1)).toThrow();
    expect(() => validatePw({ ...plan(1), ads: 3 }, 1)).toThrow();
    expect(() => validatePw({ ...plan(1), program: 'free' }, 1)).toThrow();
    expect(validatePw({ ...plan(1), ownBrand: true }, 1).ownBrand).toBeUndefined();
    expect(validatePw({ ...plan(4), ownBrand: true }, 4).ownBrand).toBe(true);
    expect(validatePw({ ...plan(1), subsidy: 2.3, trust: 0.6 }, 1)).toMatchObject({ subsidy: 2.5, trust: 0.5 });
  });

  it('host End plays the remaining quarters', () => {
    const def = PLATFORM_WARS;
    const rng = seededRng('pw-end');
    const { room, priv } = createRsRoom(def, { code: 'PWAR2', hostPlays: false }, 5, rng);
    joinRs(room, priv, 'An', 5, rng);
    startRs(def, room, priv, 5, rng);
    finishRs(def, room, priv, 6);
    expect(room.status).toBe('finished');
    expect(room.history).toHaveLength(6);
  });
});
