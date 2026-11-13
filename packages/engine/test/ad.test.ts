import { describe, expect, it } from 'vitest';
import { AD_CLASH, advanceRs, createRsRoom, rsLmsResults, rsMe, seededRng, startRs, submitRs, validateAd, type AdDecision, type AdPub, type AdReport, type AdView } from '../src/index.js';

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

const plan = (roster: AdPub['roster'], round: number): AdDecision => ({
  bid: 4, searchBudget: 500, quality: 2,
  creators: roster.filter((c) => c.generic < 0.4).slice(0, 2).map((c) => c.id), premium: false,
  retarget: 100, liveHours: 2, liveDiscount: 0, crm: 'rfm', holdout: round === 2 ? 'retarget' : 'none',
  ...(round === 1 ? { beRoas: 2.5 } : {}),
});

describe('Game 7 – Ad Auction & Creator Clash', () => {
  it('plays five months, reveals fakes at the end and reports to Moodle', () => {
    const def = AD_CLASH;
    const rng = seededRng('ad-room');
    const { room, priv, player } = createRsRoom(def, { code: 'ADCL1', hostPlays: true, hostName: 'Minh', hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } }, 1, rng);
    startRs(def, room, priv, 2, rng);
    expect((room.pub as unknown as AdPub).roster).toHaveLength(7);
    const pid = player!.playerId;
    for (let r = 1; r <= 5; r++) {
      expect(submitRs(def, room, priv, pid, r, plan((room.pub as unknown as AdPub).roster, r), 10 + r)).toBe(true);
      const rep = rsMe(def, room, priv, pid).reports[r - 1] as AdReport;
      expect(rep.orders).toBeGreaterThan(0);
      if (r === 2) expect(rep.holdout?.channel).toBe('retarget');
      if (r < 5) advanceRs(def, room, priv, 20 + r, { isHost: true });
    }
    expect(room.status).toBe('finished');
    const me = rsMe(def, room, priv, pid);
    expect((me.view as AdView).fakes).toBeDefined();
    expect(me.badges).toEqual(expect.arrayContaining(['beroas', 'nofake', 'holdout']));
    expect(rsLmsResults(def, room, priv)[0]!.comment).toMatch(/^Ad Auction & Creator Clash · room ADCL1/);
    expect(nestedArrayPath(room)).toBeNull();
    expect(nestedArrayPath(priv)).toBeNull();
  });

  it('validates budget, roster and the month-1 break-even ROAS', () => {
    const rng = seededRng('ad-val');
    const { room, priv } = createRsRoom(AD_CLASH, { code: 'ADCL2', hostPlays: true, hostName: 'X' }, 1, rng);
    startRs(AD_CLASH, room, priv, 2, rng);
    const st = priv.state as Parameters<typeof validateAd>[2];
    const roster = (room.pub as unknown as AdPub).roster;
    const ok = plan(roster, 1);
    expect(validateAd(ok, 1, st).beRoas).toBe(2.5);
    const { beRoas: _drop, ...noBe } = ok;
    expect(() => validateAd(noBe, 1, st)).toThrow();
    expect(() => validateAd({ ...ok, searchBudget: 1500, retarget: 1000 }, 1, st)).toThrow();
    expect(() => validateAd({ ...ok, creators: ['nobody'] }, 1, st)).toThrow();
  });
});
