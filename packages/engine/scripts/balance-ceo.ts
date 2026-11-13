// npx tsx packages/engine/scripts/balance-ceo.ts [games] [level]
import { playCeo, type CeoStrategy } from '../src/ceo/balance.js';
import type { BotLevel } from '../src/types.js';
import { ceoBotDecision } from '../src/ceo/bots.js';
import type { CeoDecision } from '../src/ceo/types.js';

/** A student who applies the chapter: owned channel + CRM, platform as a channel not a home, AI where it pays, agent-ready, calm in crisis. */
const smart: CeoStrategy = {
  name: 'smart',
  decide: (p, round, rng) => {
    const d: CeoDecision = { ...ceoBotDecision('balanced', 'hard', p, round, rng), price: 'mid', segment: 'office', service: 'fast', ads: 160, creators: 80, crm: 110, mix: { web: 40, shopee: 40, tiktok: 20 } };
    if (round === 4) d.ai = 'A';
    if (round === 5) d.agent = ['catalog', 'api', 'policy'];
    return d;
  },
};

const N = Number(process.argv[2] ?? 400);
const level = (process.argv[3] ?? 'medium') as BotLevel;
function run(label: string, lineup: Record<string, CeoStrategy>) {
  const ids = Object.keys(lineup);
  const acc: Record<string, { win: number; rank: number; grade: number; profit: number; broke: number; pdr: number }> = {};
  for (const id of ids) acc[id] = { win: 0, rank: 0, grade: 0, profit: 0, broke: 0, pdr: 0 };
  for (let g = 0; g < N; g++) {
    const rot = g % ids.length;
    const seated: Record<string, CeoStrategy> = {};
    for (let i = 0; i < ids.length; i++) seated[ids[(i + rot) % ids.length]!] = lineup[ids[(i + rot) % ids.length]!]!;
    const r = playCeo(seated, 9000 + g);
    for (const id of ids) {
      const a = acc[id]!;
      if (r.rank[id] === 1) a.win++;
      a.rank += r.rank[id]! / N;
      a.grade += r.grade[id]! / N;
      a.profit += r.profit[id]! / N;
      a.pdr += r.pdr[id]! / N;
      if (r.broke[id]) a.broke++;
    }
  }
  console.log(`\n== ${label} (${N} games)`);
  console.log('who'.padEnd(12), 'win%'.padStart(6), 'rank'.padStart(6), 'grade'.padStart(7), 'profit'.padStart(8), 'broke%'.padStart(7), 'pdr'.padStart(6));
  for (const id of ids) {
    const a = acc[id]!;
    console.log(id.padEnd(12), ((a.win / N) * 100).toFixed(1).padStart(6), a.rank.toFixed(2).padStart(6), a.grade.toFixed(1).padStart(7), a.profit.toFixed(0).padStart(8), ((a.broke / N) * 100).toFixed(0).padStart(7), a.pdr.toFixed(2).padStart(6));
  }
}
const bot = (archetype: any, lv: BotLevel = level): CeoStrategy => ({ archetype, level: lv });
run(`6 archetypes (${level})`, { discount: bot('discount'), ads: bot('ads'), platform: bot('platform'), d2c: bot('d2c'), aifirst: bot('aifirst'), balanced: bot('balanced') });
run(`5 archetypes (${level}) + student (balanced hard)`, { discount: bot('discount'), ads: bot('ads'), platform: bot('platform'), d2c: bot('d2c'), aifirst: bot('aifirst'), student: bot('balanced', 'hard') });
run(`smart student vs ${level}`, { discount: bot('discount'), ads: bot('ads'), platform: bot('platform'), d2c: bot('d2c'), aifirst: bot('aifirst'), smart });
run(`student (d2c hard) vs ${level}`, { discount: bot('discount'), ads: bot('ads'), platform: bot('platform'), balanced: bot('balanced'), aifirst: bot('aifirst'), student: bot('d2c', 'hard') });
