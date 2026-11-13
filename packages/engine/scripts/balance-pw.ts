// Balance check for Game 2: many games of AI platforms, average scorecard per archetype.
import { seededRng, shuffle } from '../src/rng.js';
import { initPw, pwBot, pwScorecard, simulatePw } from '../src/pw/game.js';
import type { PwArchetype, PwDecision } from '../src/pw/types.js';
import type { BotLevel } from '../src/types.js';

const ARCHS: PwArchetype[] = ['burn', 'toll', 'buyers', 'balanced', 'sellers', 'smart'];
const level = (process.argv[2] ?? 'medium') as BotLevel;
const N = Number(process.argv[3] ?? 400);
const agg: Record<string, { score: number; profit: number; share: number; health: number; n: number; wins: number }> = {};
for (let g = 0; g < N; g++) {
  const rng = seededRng(`bal${g}`);
  const archs = shuffle(rng, ARCHS);
  const order = archs.map((_, i) => `p${i}`);
  const st = initPw(order);
  for (let r = 1; r <= 6; r++) {
    const inputs: Record<string, { decision: PwDecision; defaulted: boolean }> = {};
    order.forEach((id, i) => (inputs[id] = { decision: pwBot(archs[i]!, level, st.cos[id]!, r, rng), defaulted: false }));
    simulatePw(st, order, inputs, r);
  }
  const scores = order.map((id) => pwScorecard(st.cos[id]!).total);
  const best = scores.indexOf(Math.max(...scores));
  order.forEach((id, i) => {
    const a = (agg[archs[i]!] ??= { score: 0, profit: 0, share: 0, health: 0, n: 0, wins: 0 });
    const sc = pwScorecard(st.cos[id]!);
    a.score += sc.total; a.profit += st.cos[id]!.profitCum; a.share += st.cos[id]!.share; a.health += sc.parts.health!; a.n++;
    if (i === best) a.wins++;
  });
}
for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].score - x[1].score))
  console.log(k.padEnd(9), 'score', (a.score / a.n).toFixed(1).padStart(5), 'profit', (a.profit / a.n).toFixed(1).padStart(6), 'share', ((a.share / a.n) * 100).toFixed(1).padStart(5) + '%', 'health', (a.health / a.n).toFixed(1).padStart(5), 'wins', ((a.wins / N) * 100).toFixed(0) + '%');
