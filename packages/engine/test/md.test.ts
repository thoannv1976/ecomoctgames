import { describe, expect, it } from 'vitest';
import {
  INTERVIEW_SLOTS,
  MD_CASE_IDS,
  SOURCES,
  accuracyPts,
  advanceMd,
  buyMd,
  createMdRoom,
  decisionFor,
  drawCases,
  finishMd,
  joinMd,
  mdLmsResults,
  mdMe,
  scoreCase,
  seededRng,
  startMd,
  submitMd,
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

describe('Market Detective cases', () => {
  it('draws three different cases, one per decision zone, with 1–2 AI errors', () => {
    for (let g = 0; g < 200; g++) {
      const cases = drawCases(seededRng(`t:${g}`));
      expect(new Set(cases.map((c) => c.pub.id)).size).toBe(3);
      expect(new Set(cases.map((c) => decisionFor(c.truth, c.pub)))).toEqual(new Set(['no', 'pilot', 'launch']));
      for (const c of cases) {
        expect(c.zone).toBe(decisionFor(c.truth, c.pub));
        expect(c.aiClaims).toHaveLength(4);
        expect(c.aiErrors.length).toBeGreaterThanOrEqual(1);
        expect(c.aiErrors.length).toBeLessThanOrEqual(2);
        for (const s of SOURCES) expect(c.findings[s].text.vi.length + (s === 'ai' ? 1 : 0)).toBeGreaterThan(0);
        expect(c.findings.interview.implied! / c.truth).toBeGreaterThan(0.7);
        expect(c.findings.interview.implied! / c.truth).toBeLessThan(1.4);
      }
    }
    expect(MD_CASE_IDS.length).toBeGreaterThanOrEqual(6);
  });

  it('scores estimate, decision, flags and credits', () => {
    const [c] = drawCases(seededRng('score'), 1);
    expect(accuracyPts(c!.truth, c!.truth)).toBe(50);
    expect(accuracyPts(c!.truth * 1.09, c!.truth)).toBe(50);
    expect(accuracyPts(c!.truth * 2.5, c!.truth)).toBe(0);
    const flags = c!.aiErrors.map((e) => e.index);
    const perfect = scoreCase(c!, { estimate: c!.truth, decision: decisionFor(c!.truth, c!.pub), flags }, ['interview', 'ai'], 65);
    expect(perfect.total).toBe(50 + 25 + flags.length * 5 + 10);
    const wild = scoreCase(c!, { estimate: c!.truth * 3, decision: 'launch', flags: [] }, ['social'], 85);
    expect(wild.creditPts).toBe(0);
    expect(scoreCase(c!, null, [], 100).total).toBe(0);
  });
});

describe('Market Detective room', () => {
  it('plays a full 1 vs 5 AI game with scarce interviews and an LMS grade', () => {
    const rng = seededRng('room');
    const { room, priv, player } = createMdRoom({ code: 'MDTST', hostPlays: true, hostName: 'Lan', settings: { caseSec: 300 }, hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } }, 1000, rng);
    const other = joinMd(room, priv, 'Minh', 1000, rng);
    startMd(room, priv, 2000, rng);
    expect(room.order).toHaveLength(6);
    expect(room.status).toBe('decide');
    expect(nestedArrayPath(room)).toBeNull();
    for (let r = 1; r <= 3; r++) {
      const t0 = room.openedAt!;
      buyMd(room, priv, player!.playerId, r, 'interview', t0 + 1000);
      buyMd(room, priv, player!.playerId, r, 'ai', t0 + 1000);
      // Hard/medium analysts book the second slot after a while; a late human gets nothing.
      expect(() => buyMd(room, priv, other.playerId, r, 'interview', t0 + 200_000)).toThrow();
      expect(room.interviews.length).toBe(INTERVIEW_SLOTS);
      buyMd(room, priv, other.playerId, r, 'trends', t0 + 200_000);
      const me = mdMe(room, priv, player!.playerId);
      expect(me.credits).toBe(65);
      expect(me.findings.map((f) => f.source)).toEqual(['interview', 'ai']);
      expect(me.aiClaims).toHaveLength(4);
      const c = priv.cases[r - 1]!;
      submitMd(room, priv, player!.playerId, r, { estimate: c.findings.interview.implied!, decision: decisionFor(c.findings.interview.implied!, c.pub), flags: c.aiErrors.map((e) => e.index) }, t0 + 210_000);
      expect(room.status).toBe('decide');
      submitMd(room, priv, other.playerId, r, { estimate: c.findings.trends.implied!, decision: 'pilot', flags: [0] }, t0 + 220_000);
      expect(room.reveal?.truth).toBe(c.truth);
      expect(nestedArrayPath(room)).toBeNull();
      if (r < 3) {
        expect(room.status).toBe('results');
        expect(advanceMd(room, priv, t0 + 230_000, { isHost: true })).toBe(true);
      }
    }
    expect(room.status).toBe('finished');
    const me = mdMe(room, priv, player!.playerId);
    expect(me.scores).toHaveLength(3);
    expect(me.grade).toBeGreaterThan(50);
    expect(room.standings[player!.playerId]!.rank).toBeLessThanOrEqual(2);
    const lms = mdLmsResults(room, priv);
    expect(lms).toHaveLength(1);
    expect(lms[0]!.score).toBe(me.grade);
  });

  it('closes on deadline and the host can end early', () => {
    const rng = seededRng('room2');
    const { room, priv } = createMdRoom({ code: 'MDEND', hostPlays: true, hostName: 'Ha', settings: { caseSec: 60, botLevel: 'hard' } }, 0, rng);
    startMd(room, priv, 10, rng);
    expect(advanceMd(room, priv, 30_000, { isHost: false })).toBe(false);
    expect(advanceMd(room, priv, 60_100, { isHost: false })).toBe(true);
    expect(room.status).toBe('results');
    expect(room.standings[room.hostPlayerId!]!.defaulted).toBe(true);
    finishMd(room, priv, 70_000);
    expect(room.status).toBe('finished');
    expect(Object.values(room.standings).filter((s) => s.rank === 1).length).toBeGreaterThan(0);
  });
});
