// Balance check for Game 8: AI shops of each archetype, average final scorecard.
import { seededRng, shuffle } from '../src/rng.js';
import { initPd, pdBot, pdScorecard, simulatePd } from '../src/pd/game.js';
import type { PdArchetype, PdDecision } from '../src/pd/types.js';
import type { BotLevel } from '../src/types.js';
const ARCHS: PdArchetype[] = ['overstock', 'codall', 'understock', 'discounter', 'balanced', 'pro'];
const level = (process.argv[2] ?? 'medium') as BotLevel;
const N = Number(process.argv[3] ?? 300);
const agg: Record<string, { s: number; profit: number; rating: number; orders: number; dead: number; so: number; n: number; wins: number }> = {};
for (let g = 0; g < N; g++) {
  const rng = seededRng(`pd${g}`);
  const archs = shuffle(rng, ARCHS);
  const order = archs.map((_, i) => `p${i}`);
  const st = initPd(order, rng);
  for (let r = 1; r <= 5; r++) {
    const inputs: Record<string, { decision: PdDecision; defaulted: boolean }> = {};
    order.forEach((id, i) => (inputs[id] = { decision: pdBot(archs[i]!, level, st.cos[id]!, r, rng), defaulted: false }));
    simulatePd(st, order, inputs, r, rng);
  }
  const sc = order.map((id) => pdScorecard(st.cos[id]!, true));
  const best = sc.map((x) => x.total).indexOf(Math.max(...sc.map((x) => x.total)));
  order.forEach((id, i) => {
    const a = (agg[archs[i]!] ??= { s: 0, profit: 0, rating: 0, orders: 0, dead: 0, so: 0, n: 0, wins: 0 });
    const c = st.cos[id]!;
    a.s += sc[i]!.total; a.profit += c.profitCum; a.rating += c.rating; a.orders += c.orders; a.dead += c.deadShare; a.so += c.stockouts; a.n++;
    if (i === best) a.wins++;
  });
}
for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].s - x[1].s))
  console.log(k.padEnd(11), 'score', (a.s / a.n).toFixed(1).padStart(5), 'profit', (a.profit / a.n).toFixed(0).padStart(5), 'rating', (a.rating / a.n).toFixed(2), 'orders', (a.orders / a.n).toFixed(0).padStart(5), 'dead', ((a.dead / a.n) * 100).toFixed(0) + '%', 'stockouts', (a.so / a.n).toFixed(1), 'wins', ((a.wins / N) * 100).toFixed(0) + '%');
