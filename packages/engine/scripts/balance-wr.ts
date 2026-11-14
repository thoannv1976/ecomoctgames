// Balance check for Game 1: many games of AI founders, average scorecard per archetype.
// The founder who reads the infrastructure and moves one wave early must win.
import { seededRng, shuffle } from '../src/rng.js';
import { initWr, simulateWr, wrBot, wrScorecard } from '../src/wr/game.js';
import { WR_ROUNDS, type WrArchetype, type WrDecision } from '../src/wr/types.js';
import type { BotLevel } from '../src/types.js';

const ARCHS: WrArchetype[] = ['trend', 'web', 'live', 'balanced', 'late', 'reader'];
const level = (process.argv[2] ?? 'medium') as BotLevel;
const N = Number(process.argv[3] ?? 400);
const agg: Record<string, { score: number; capital: number; timing: number; quiz: number; early: number; n: number; wins: number }> = {};
for (let g = 0; g < N; g++) {
  const rng = seededRng(`balwr${g}`);
  const archs = shuffle(rng, ARCHS);
  const order = archs.map((_, i) => `p${i}`);
  const st = initWr(order, rng);
  for (let r = 1; r <= WR_ROUNDS; r++) {
    const inputs: Record<string, { decision: WrDecision; defaulted: boolean }> = {};
    order.forEach((id, i) => (inputs[id] = { decision: wrBot(archs[i]!, level, st, st.cos[id]!, r, rng), defaulted: false }));
    simulateWr(st, order, inputs, r);
  }
  const scores = order.map((id) => wrScorecard(st.cos[id]!).total);
  const best = scores.indexOf(Math.max(...scores));
  order.forEach((id, i) => {
    const a = (agg[archs[i]!] ??= { score: 0, capital: 0, timing: 0, quiz: 0, early: 0, n: 0, wins: 0 });
    const sc = wrScorecard(st.cos[id]!);
    a.score += sc.total;
    a.capital += st.cos[id]!.capital;
    a.timing += sc.parts.timing!;
    a.quiz += sc.parts.quiz!;
    a.early += st.cos[id]!.earlyRounds;
    a.n++;
    if (i === best) a.wins++;
  });
}
for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].score - x[1].score))
  console.log(
    k.padEnd(9),
    'score',
    (a.score / a.n).toFixed(1).padStart(5),
    'capital',
    (a.capital / a.n).toFixed(1).padStart(5),
    'timing',
    (a.timing / a.n).toFixed(1).padStart(5),
    'quiz',
    (a.quiz / a.n).toFixed(1).padStart(4),
    'early',
    (a.early / a.n).toFixed(1),
    'wins',
    ((a.wins / N) * 100).toFixed(0) + '%',
  );
