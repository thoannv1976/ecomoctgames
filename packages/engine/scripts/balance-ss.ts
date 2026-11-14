// Balance check for Game 3: many games of AI brands, average scorecard per archetype.
// The brand that researches the personas and pays for Review and Repurchase must win;
// the brand that fixes the market's biggest drop-off every month must not.
import { seededRng, shuffle } from '../src/rng.js';
import { initSs, simulateSs, ssBot, ssScorecard, type SsCo } from '../src/ss/game.js';
import { SS_PERSONAS, SS_ROUNDS, type SsArchetype, type SsDecision } from '../src/ss/types.js';
import type { BotLevel } from '../src/types.js';

const ARCHS: SsArchetype[] = ['volume', 'gifts', 'checkout', 'spread', 'agentfirst', 'journey'];
const level = (process.argv[2] ?? 'medium') as BotLevel;
const N = Number(process.argv[3] ?? 300);
type Agg = { score: number; clv: number; loyal: number; insight: number; base: number; rate: number; n: number; wins: number };
const agg: Record<string, Agg> = {};

for (let g = 0; g < N; g++) {
  const rng = seededRng(`balss${g}`);
  const archs = shuffle(rng, ARCHS);
  const order = archs.map((_, i) => `p${i}`);
  const st = initSs(order, rng);
  for (let r = 1; r <= SS_ROUNDS; r++) {
    const inputs: Record<string, { decision: SsDecision; defaulted: boolean }> = {};
    order.forEach((id, i) => (inputs[id] = { decision: ssBot(archs[i]!, level, st, id, r, rng), defaulted: false }));
    simulateSs(st, order, inputs, r);
  }
  const scores = order.map((id) => ssScorecard(st.cos[id]!).total);
  const best = scores.indexOf(Math.max(...scores));
  order.forEach((id, i) => {
    const c: SsCo = st.cos[id]!;
    const sc = ssScorecard(c);
    const a = (agg[archs[i]!] ??= { score: 0, clv: 0, loyal: 0, insight: 0, base: 0, rate: 0, n: 0, wins: 0 });
    a.score += sc.total;
    a.clv += c.clv;
    a.loyal += sc.parts.loyal!;
    a.insight += sc.parts.insight!;
    a.base += SS_PERSONAS.reduce((x, p) => x + c.base[p]!, 0);
    a.rate += c.orders > 0 ? c.repeatOrders / c.orders : 0;
    a.n++;
    if (i === best) a.wins++;
  });
}

for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].score - x[1].score))
  console.log(
    k.padEnd(11),
    'score',
    (a.score / a.n).toFixed(1).padStart(5),
    'clv(bn)',
    (a.clv / a.n).toFixed(2).padStart(6),
    'loyal',
    (a.loyal / a.n).toFixed(1).padStart(5),
    'insight',
    (a.insight / a.n).toFixed(1).padStart(5),
    'base',
    (a.base / a.n).toFixed(0).padStart(6),
    'repeat%',
    ((a.rate / a.n) * 100).toFixed(0).padStart(3),
    'wins',
    ((a.wins / N) * 100).toFixed(0) + '%',
  );
