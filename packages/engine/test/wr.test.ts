import { describe, expect, it } from 'vitest';
import {
  WAVE_RIDER,
  WR_MODELS,
  WR_ROUNDS,
  advanceRs,
  createRsRoom,
  joinRs,
  rsLmsResults,
  rsMe,
  seededRng,
  startRs,
  submitRs,
  validateWr,
  wrScorecard,
  type WrDecision,
  type WrModel,
  type WrReport,
  type WrState,
  type WrView,
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

const zero = () => Object.fromEntries(WR_MODELS.map((m) => [m, 0])) as Record<WrModel, number>;
/** All the chips on one model, plus an answer. */
const plan = (model: WrModel, chips: number, answer: number | null): WrDecision => ({ chips: { ...zero(), [model]: chips }, answer });

describe('Game 1 – Wave Rider', () => {
  it('rides five waves, pays the early mover and grades', () => {
    const def = WAVE_RIDER;
    const rng = seededRng('wr-room');
    const { room, priv, player } = createRsRoom(def, { code: 'WAVE1', hostPlays: true, hostName: 'Lan', hostLms: { hubUserId: 'u1', gradeTarget: 'g1' } }, 1, rng);
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    // The model each wave's infrastructure carries, read off the public table.
    const ride: WrModel[] = ['web', 'seller', 'social', 'live', 'agent'];
    for (let r = 1; r <= WR_ROUNDS; r++) {
      const view = rsMe(def, room, priv, pid).view as WrView;
      expect(view.question).not.toBeNull();
      expect(view.question!.options.length).toBeGreaterThanOrEqual(4);
      const correct = (priv.state as WrState).questions[r - 1]!.correct;
      expect(submitRs(def, room, priv, pid, r, plan(ride[r - 1]!, view.chips, correct), 10 + r)).toBe(true);
      const rep = rsMe(def, room, priv, pid).reports[r - 1] as WrReport;
      expect(rep.round).toBe(r);
      expect(rep.answerRight).toBe(true);
      expect(rep.chipsBefore).toBe(view.chips);
      if (r < WR_ROUNDS) advanceRs(def, room, priv, 20 + r, { isHost: true });
    }
    expect(room.status).toBe('finished');
    expect(rsMe(def, room, priv, pid).grade).not.toBeNull();
    const co = (priv.state as WrState).cos[pid]!;
    // Riding each wave as it arrives grows the capital and fills the quiz part of the scorecard.
    expect(co.capital).toBeGreaterThan(10);
    expect(wrScorecard(co).parts.quiz).toBe(15);
    expect(rsLmsResults(def, room, priv)[0]!.comment).toMatch(/^Wave Rider · room WAVE1/);
    expect(nestedArrayPath(room)).toBeNull();
    expect(nestedArrayPath(priv)).toBeNull();
  });

  it('a model whose infrastructure is missing loses money', () => {
    const def = WAVE_RIDER;
    const rng = seededRng('wr-early');
    const { room, priv, player } = createRsRoom(def, { code: 'WAVE2', hostPlays: true, hostName: 'Binh' }, 1, rng);
    startRs(def, room, priv, 2, rng);
    const pid = player!.playerId;
    // An agent-ready store in wave 1: no data layer, no machine-readable trust.
    submitRs(def, room, priv, pid, 1, plan('agent', 10, null), 10);
    const rep = rsMe(def, room, priv, pid).reports[0] as WrReport;
    expect(rep.models.agent.mult).toBeLessThan(1);
    expect((priv.state as WrState).cos[pid]!.capital).toBeLessThan(10);
    expect(rep.notes.length).toBeGreaterThan(0);
  });

  it('crowding shares the extra return away', () => {
    const def = WAVE_RIDER;
    const rng = seededRng('wr-crowd');
    const { room, priv } = createRsRoom(def, { code: 'WAVE3', hostPlays: false }, 1, rng);
    room.settings.fillBots = false;
    const ids = ['An', 'Binh', 'Chi', 'Dung', 'Em', 'Giang'].map((n) => joinRs(room, priv, n, 1, rng).playerId);
    startRs(def, room, priv, 2, rng);
    // All six founders crowd into the same model: the extra return is shared away.
    for (const id of ids) submitRs(def, room, priv, id, 1, plan('web', 10, null), 10);
    const rep = rsMe(def, room, priv, ids[0]!).reports[0] as WrReport;
    expect(rep.models.web.crowd).toBe(60);
    expect(rep.models.web.mult).toBeLessThan(1.15);
    expect(rep.notes.some((n) => /đổ vào/.test(n.vi))).toBe(true);
  });

  it('validates the chips and the answer', () => {
    const rng = seededRng('wr-val');
    const { room, priv, player } = createRsRoom(WAVE_RIDER, { code: 'WAVE4', hostPlays: true, hostName: 'Chi' }, 1, rng);
    startRs(WAVE_RIDER, room, priv, 2, rng);
    const pid = player!.playerId;
    const st = priv.state as WrState;
    expect(validateWr(plan('web', 10, 0), 1, st, pid).chips.web).toBe(10);
    expect(() => validateWr(plan('web', 11, 0), 1, st, pid)).toThrow();
    expect(() => validateWr(plan('web', 2.5, 0), 1, st, pid)).toThrow();
    expect(() => validateWr({ chips: 'all', answer: 0 }, 1, st, pid)).toThrow();
    expect(validateWr(plan('web', 3, 99), 1, st, pid).answer).toBeNull();
    expect(validateWr(plan('web', 3, null), 1, st, pid).answer).toBeNull();
  });
});
