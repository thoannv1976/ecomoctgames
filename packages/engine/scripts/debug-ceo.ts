import { ceoBotDecision } from '../src/ceo/bots.js';
import { initCeo, simulateQuarter, type QuarterInput } from '../src/ceo/sim.js';
import { mulberry32 } from '../src/rng.js';
import type { CeoArchetype } from '../src/ceo/types.js';
const archs: CeoArchetype[] = ['discount', 'ads', 'platform', 'd2c', 'aifirst', 'balanced'];
const rng = mulberry32(42);
const state = initCeo(archs);
archs.forEach((a, i) => (state.players[a]!.crisis = (['cpc', 'pricecut', 'viral', 'chatbot', 'agent', 'ban'] as const)[i]!));
for (let r = 1; r <= 6; r++) {
  const inputs: Record<string, QuarterInput> = {};
  for (const a of archs) inputs[a] = { decision: ceoBotDecision(a, 'medium', state.players[a]!, r, rng), defaulted: false };
  const out = simulateQuarter(state, archs, inputs, r, rng);
  console.log(`-- round ${r}`);
  for (const a of archs) {
    const k = out.reports[a]!.kpis;
    console.log(a.padEnd(9), 'ord', String(k.orders).padStart(5), 'rev', String(k.revenue).padStart(6), 'cogs', String(k.cogs).padStart(5), 'fees', String(k.fees).padStart(5), 'ful', String(k.fulfillment).padStart(5), 'ret', String(k.returns).padStart(4), 'mkt', String(k.marketing).padStart(4), 'hold', String(k.holding).padStart(4), 'P', String(k.profit).padStart(6), 'cash', String(k.cash).padStart(6), 'stockL', k.stockLeft, 'out', k.stockouts, 'rt', k.rating, 'pdr', k.pdr, 'buy', inputs[a]!.decision.stock);
  }
}
