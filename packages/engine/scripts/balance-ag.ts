// Balance check for Game 10: many games of AI sellers, average scorecard per archetype.
// The seller who follows the agent curve and keeps every automated system under control must win;
// buying all the AI at once, or skipping the controls, must not.
import { seededRng, shuffle } from '../src/rng.js';
import { agScorecard, agBot, initAg, simulateAg, type AgCo } from '../src/ag/game.js';
import { AG_CAPS, AG_ROUNDS, type AgArchetype, type AgDecision } from '../src/ag/types.js';
import type { BotLevel } from '../src/types.js';

const ARCHS: AgArchetype[] = ['allin', 'human', 'agentearly', 'cheap', 'nogov', 'balanced'];
const level = (process.argv[2] ?? 'medium') as BotLevel;
const N = Number(process.argv[3] ?? 300);
type Agg = { score: number; profit: number; agent: number; control: number; built: number; risks: number; n: number; wins: number };
const agg: Record<string, Agg> = {};

for (let g = 0; g < N; g++) {
  const rng = seededRng(`balag${g}`);
  const archs = shuffle(rng, ARCHS);
  const order = archs.map((_, i) => `p${i}`);
  const st = initAg(order, rng);
  const risks: Record<string, number> = {};
  for (let r = 1; r <= AG_ROUNDS; r++) {
    const inputs: Record<string, { decision: AgDecision; defaulted: boolean }> = {};
    order.forEach((id, i) => (inputs[id] = { decision: agBot(archs[i]!, level, st, id, r, rng), defaulted: false }));
    const out = simulateAg(st, order, inputs, r, rng);
    for (const id of order) risks[id] = (risks[id] ?? 0) + out.reports[id]!.risks.length;
  }
  const scores = order.map((id) => agScorecard(st.cos[id]!).total);
  const best = scores.indexOf(Math.max(...scores));
  order.forEach((id, i) => {
    const c: AgCo = st.cos[id]!;
    const sc = agScorecard(c);
    const a = (agg[archs[i]!] ??= { score: 0, profit: 0, agent: 0, control: 0, built: 0, risks: 0, n: 0, wins: 0 });
    a.score += sc.total;
    a.profit += c.profit / 1000;
    a.agent += c.agentDen > 0 ? c.agentSum / c.agentDen : 0;
    a.control += sc.parts.control!;
    a.built += AG_CAPS.reduce((x, cap) => x + c.levels[cap], 0);
    a.risks += risks[id] ?? 0;
    a.n++;
    if (i === best) a.wins++;
  });
}

for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].score - x[1].score))
  console.log(
    k.padEnd(11),
    'score',
    (a.score / a.n).toFixed(1).padStart(5),
    'profit(bn)',
    (a.profit / a.n).toFixed(2).padStart(6),
    'agent%',
    ((a.agent / a.n) * 100).toFixed(0).padStart(3),
    'control',
    (a.control / a.n).toFixed(1).padStart(5),
    'built',
    (a.built / a.n).toFixed(1).padStart(4),
    'risks',
    (a.risks / a.n).toFixed(1),
    'wins',
    ((a.wins / N) * 100).toFixed(0) + '%',
  );
