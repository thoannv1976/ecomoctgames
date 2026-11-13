// Balance check for Game 6: AI stores of each archetype, average final scorecard.
import { seededRng, shuffle } from '../src/rng.js';
import { croBot, croScorecard, initCro, simulateCro, trueCr } from '../src/cro/game.js';
import type { CroArchetype, CroDecision } from '../src/cro/types.js';
import type { BotLevel } from '../src/types.js';
const ARCHS: CroArchetype[] = ['hippo', 'peeker', 'tiny', 'disciplined', 'copycat', 'cautious'];
const level = (process.argv[2] ?? 'medium') as BotLevel;
const N = Number(process.argv[3] ?? 300);
const agg: Record<string, { s: number; cr: number; ord: number; disc: number; n: number; wins: number }> = {};
for (let g = 0; g < N; g++) {
  const rng = seededRng(`cro${g}`);
  const archs = shuffle(rng, ARCHS);
  const order = archs.map((_, i) => `p${i}`);
  const st = initCro(order, rng);
  for (let r = 1; r <= 5; r++) {
    const inputs: Record<string, { decision: CroDecision; defaulted: boolean }> = {};
    order.forEach((id, i) => (inputs[id] = { decision: croBot(archs[i]!, level, st, st.cos[id]!, r, rng), defaulted: false }));
    simulateCro(st, order, inputs, r, rng);
  }
  const sc = order.map((id) => croScorecard(st, st.cos[id]!, true));
  const best = sc.map((x) => x.total).indexOf(Math.max(...sc.map((x) => x.total)));
  order.forEach((id, i) => {
    const a = (agg[archs[i]!] ??= { s: 0, cr: 0, ord: 0, disc: 0, n: 0, wins: 0 });
    a.s += sc[i]!.total; a.cr += trueCr(st, st.cos[id]!.shipped); a.ord += st.cos[id]!.extraOrders; a.disc += sc[i]!.parts.discipline!; a.n++;
    if (i === best) a.wins++;
  });
}
for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].s - x[1].s))
  console.log(k.padEnd(12), 'score', (a.s / a.n).toFixed(1).padStart(5), 'trueCR', ((a.cr / a.n) * 100).toFixed(2) + '%', 'extraOrders', (a.ord / a.n).toFixed(0).padStart(6), 'disc', (a.disc / a.n).toFixed(1), 'wins', ((a.wins / N) * 100).toFixed(0) + '%');
