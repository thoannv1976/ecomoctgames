import { seededRng } from '../src/rng.js';
import { initPw, pwBot, simulatePw } from '../src/pw/game.js';
import type { PwArchetype, PwDecision } from '../src/pw/types.js';
const archs: PwArchetype[] = ['burn', 'toll', 'buyers', 'balanced', 'sellers', 'smart'];
const order = archs.map((a) => a);
const st = initPw(order);
const rng = seededRng('dbg');
for (let r = 1; r <= 6; r++) {
  const inputs: Record<string, { decision: PwDecision; defaulted: boolean }> = {};
  order.forEach((id, i) => (inputs[id] = { decision: pwBot(archs[i]!, 'hard', st.cos[id]!, r, rng), defaulted: false }));
  const out = simulatePw(st, order, inputs, r);
  console.log('Q' + r);
  for (const id of order) { const k = out.reports[id]!.kpis; const d = out.reports[id]!.decision; console.log(' ', id.padEnd(9), `take ${d.take} sub ${d.subsidy}/${d.toSellers}% tr ${d.trust}`, `B ${k.buyers} H ${k.hunters} S ${k.sellers} sel ${k.selection} gmv ${k.gmv} leak ${k.leakage} cf ${k.counterfeit} rev ${k.revenue} opex ${k.opex} profit ${k.profit} share ${k.share}`); }
}
