// Game 12 balance: AI CEOs play many games. Who wins, who goes broke?
import type { BotLevel } from '../types.js';
import { mulberry32, shuffle, type Rng } from '../rng.js';
import { gradeOf } from '../scoring.js';
import { ceoBotDecision } from './bots.js';
import { ceoRanking, ceoScorecard, initCeo, simulateQuarter, type QuarterInput } from './sim.js';
import { CRISES, ROUNDS, type CeoArchetype, type CeoDecision } from './types.js';
import type { CoState } from './sim.js';

export type CeoStrategy = { archetype: CeoArchetype; level: BotLevel } | { name: string; decide: (p: CoState, round: number, rng: Rng) => CeoDecision };

export interface CeoGameResult {
  rank: Record<string, number>;
  grade: Record<string, number>;
  profit: Record<string, number>;
  broke: Record<string, boolean>;
  pdr: Record<string, number>;
}

export function playCeo(strategies: Record<string, CeoStrategy>, seed: number): CeoGameResult {
  const rng = mulberry32(seed);
  const order = Object.keys(strategies);
  const state = initCeo(order);
  const cards = shuffle(rng, CRISES);
  order.forEach((id, i) => (state.players[id]!.crisis = cards[i % cards.length]!));
  for (let r = 1; r <= ROUNDS; r++) {
    const inputs: Record<string, QuarterInput> = {};
    for (const id of order) {
      const s = strategies[id]!;
      const p = state.players[id]!;
      inputs[id] = { decision: 'decide' in s ? s.decide(p, r, rng) : ceoBotDecision(s.archetype, s.level, p, r, rng), defaulted: false };
    }
    simulateQuarter(state, order, inputs, r, rng);
  }
  const rows = ceoRanking(state, order);
  const res: CeoGameResult = { rank: {}, grade: {}, profit: {}, broke: {}, pdr: {} };
  for (const id of order) {
    const p = state.players[id]!;
    res.rank[id] = rows[id]!.rank;
    res.grade[id] = gradeOf(ceoScorecard(p).total, rows[id]!.rank, order.length);
    res.profit[id] = p.profitCum;
    res.broke[id] = p.everNegative;
    res.pdr[id] = p.last?.pdr ?? 1;
  }
  return res;
}
