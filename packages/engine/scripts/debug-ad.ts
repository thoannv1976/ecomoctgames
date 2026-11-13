import { seededRng } from '../src/rng.js';
import { adBot, initAd, simulateAd } from '../src/ad/game.js';
import type { AdArchetype, AdDecision } from '../src/ad/types.js';
const archs: AdArchetype[] = ['bidder', 'celebrity', 'retarget', 'discounter', 'balanced', 'measurer'];
const rng = seededRng('dbg-ad');
const st = initAd(archs, rng);
for (let r = 1; r <= 5; r++) {
  const inputs: Record<string, { decision: AdDecision; defaulted: boolean }> = {};
  archs.forEach((id) => (inputs[id] = { decision: adBot(id, 'hard', st, st.cos[id]!, r, rng), defaulted: false }));
  const out = simulateAd(st, archs, inputs, r, rng);
  console.log('M' + r);
  for (const id of archs) {
    const k = out.reports[id]!;
    const ch = Object.entries(k.channels).filter(([, v]) => v.spend > 0).map(([n, v]) => `${n}:${v.spend}/${v.orders}o/R${v.reportedRoas}`).join(' ');
    console.log(' ', id.padEnd(10), `pos ${k.position} cpc ${k.cpc} clk ${k.clicks} org ${k.organic} ord ${k.orders} rev ${k.revenue} spend ${k.spend} disc ${k.discountCost} profit ${k.profit} blended ${k.blendedRoas} |`, ch, k.holdout ? `HOLD ${k.holdout.channel} ${k.holdout.incrementalRoas}` : '');
  }
}
