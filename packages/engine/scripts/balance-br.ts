// Balance check for Game 11: many games of AI brands, average scorecard per archetype.
// The brand that reads the published score and the published policy must win; renting a customs
// concession, taking the shortcuts, over-building one small market and spreading thin must not.
import { seededRng, shuffle } from '../src/rng.js';
import { brBot, brScorecard, initBr, simulateBr, trustOf, type BrCo } from '../src/br/game.js';
import { BR_MARKETS, BR_ROUNDS, type BrArchetype, type BrDecision } from '../src/br/types.js';
import type { BotLevel } from '../src/types.js';

const ARCHS: BrArchetype[] = ['duty', 'shortcut', 'fortress', 'spread', 'handoff', 'reader'];
const level = (process.argv[2] ?? 'medium') as BotLevel;
const N = Number(process.argv[3] ?? 200);
type Agg = { score: number; profit: number; trust: number; licence: number; markets: number; inc: number; strikes: number; n: number; wins: number };
const agg: Record<string, Agg> = {};

for (let g = 0; g < N; g++) {
  const rng = seededRng(`balbr${g}`);
  const archs = shuffle(rng, ARCHS);
  const order = archs.map((_, i) => `p${i}`);
  const st = initBr(order, rng);
  const inc: Record<string, number> = {};
  for (let r = 1; r <= BR_ROUNDS; r++) {
    const inputs: Record<string, { decision: BrDecision; defaulted: boolean }> = {};
    order.forEach((id, i) => (inputs[id] = { decision: brBot(archs[i]!, level, st, id, r, rng), defaulted: false }));
    const out = simulateBr(st, order, inputs, r, rng);
    for (const id of order) inc[id] = (inc[id] ?? 0) + out.reports[id]!.incidents.length;
  }
  const scores = order.map((id) => brScorecard(st.cos[id]!).total);
  const best = scores.indexOf(Math.max(...scores));
  order.forEach((id, i) => {
    const c: BrCo = st.cos[id]!;
    const sc = brScorecard(c);
    const a = (agg[archs[i]!] ??= { score: 0, profit: 0, trust: 0, licence: 0, markets: 0, inc: 0, strikes: 0, n: 0, wins: 0 });
    a.score += sc.total;
    a.profit += c.profit / 1000;
    a.trust += trustOf(c).trust;
    a.licence += sc.parts.licence!;
    a.markets += BR_MARKETS.filter((m) => c.mode[m] !== 'none').length;
    a.inc += inc[id] ?? 0;
    a.strikes += c.strikes;
    a.n++;
    if (i === best) a.wins++;
  });
}

for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].score - x[1].score))
  console.log(
    k.padEnd(9),
    'score',
    (a.score / a.n).toFixed(1).padStart(5),
    'profit(bn)',
    (a.profit / a.n).toFixed(2).padStart(6),
    'trust',
    (a.trust / a.n).toFixed(2),
    'licence',
    (a.licence / a.n).toFixed(1).padStart(4),
    'markets',
    (a.markets / a.n).toFixed(1),
    'incidents',
    (a.inc / a.n).toFixed(1).padStart(4),
    'strikes',
    (a.strikes / a.n).toFixed(1),
    'wins',
    ((a.wins / N) * 100).toFixed(0) + '%',
  );
