// Balance check for Game 7: AI brands of each archetype, average final scorecard.
import { seededRng, shuffle } from '../src/rng.js';
import { adBot, adScorecard, initAd, simulateAd } from '../src/ad/game.js';
import type { AdArchetype, AdDecision } from '../src/ad/types.js';
import type { BotLevel } from '../src/types.js';
const ARCHS: AdArchetype[] = ['bidder', 'celebrity', 'retarget', 'discounter', 'balanced', 'measurer'];
const level = (process.argv[2] ?? 'medium') as BotLevel;
const N = Number(process.argv[3] ?? 300);
const agg: Record<string, { s: number; profit: number; extra: number; cust: number; disc: number; n: number; wins: number }> = {};
for (let g = 0; g < N; g++) {
  const rng = seededRng(`ad${g}`);
  const archs = shuffle(rng, ARCHS);
  const order = archs.map((_, i) => `p${i}`);
  const st = initAd(order, rng);
  for (let r = 1; r <= 5; r++) {
    const inputs: Record<string, { decision: AdDecision; defaulted: boolean }> = {};
    order.forEach((id, i) => (inputs[id] = { decision: adBot(archs[i]!, level, st, st.cos[id]!, r, rng), defaulted: false }));
    simulateAd(st, order, inputs, r, rng);
  }
  const sc = order.map((id) => adScorecard(st.cos[id]!));
  const best = sc.map((x) => x.total).indexOf(Math.max(...sc.map((x) => x.total)));
  order.forEach((id, i) => {
    const a = (agg[archs[i]!] ??= { s: 0, profit: 0, extra: 0, cust: 0, disc: 0, n: 0, wins: 0 });
    const c = st.cos[id]!;
    a.s += sc[i]!.total; a.profit += c.profitCum; a.extra += c.extraCum; a.cust += c.customers; a.disc += sc[i]!.parts.discipline!; a.n++;
    if (i === best) a.wins++;
  });
}
for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].s - x[1].s))
  console.log(k.padEnd(11), 'score', (a.s / a.n).toFixed(1).padStart(5), 'profit', (a.profit / a.n).toFixed(0).padStart(6), 'extra', (a.extra / a.n).toFixed(0).padStart(6), 'cust', (a.cust / a.n).toFixed(1).padStart(5), 'disc', (a.disc / a.n).toFixed(1), 'wins', ((a.wins / N) * 100).toFixed(0) + '%');
