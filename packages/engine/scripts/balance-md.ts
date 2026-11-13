// Average case score per bot style/level over many games: npx tsx packages/engine/scripts/balance-md.ts
import { drawCases, mdBotPlay, scoreCase, seededRng, MD_ARCHETYPES, type BotLevel } from '../src/index.js';
const levels: BotLevel[] = ['easy', 'medium', 'hard'];
for (const lvl of levels) {
  const row: string[] = [];
  for (const arch of MD_ARCHETYPES) {
    for (const iv of arch === 'careful' || arch === 'all' ? [false, true] : [false]) {
      let sum = 0, acc = 0, dec = 0, n = 0;
      for (let g = 0; g < 400; g++) {
        const rng = seededRng(`bal:${g}`);
        for (const c of drawCases(rng)) {
          const p = mdBotPlay(arch, lvl, c, iv, rng);
          const s = scoreCase(c, p.sub, p.bought, p.credits);
          sum += s.total; acc += s.accuracy; dec += s.decisionPts; n++;
        }
      }
      row.push(`${arch}${iv ? '+iv' : ''}: ${(sum / n).toFixed(1)} (acc ${(acc / n).toFixed(0)}, dec ${(dec / n).toFixed(0)})`);
    }
  }
  console.log(lvl.padEnd(7), row.join(' | '));
}
const rng = seededRng('peek');
const [c] = drawCases(rng, 1);
console.log('\n', c!.pub.title.en, 'truth', c!.truth, c!.zone, 'pilot', c!.pub.pilotAt, 'launch', c!.pub.launchAt);
for (const f of Object.values(c!.findings)) console.log(`- [${f.source}] ${f.implied ?? ''} ${f.text.en}`);
c!.aiClaims.forEach((x, i) => console.log(`  AI ${i}: ${x.en}`));
console.log('  errors', c!.aiErrors.map((e) => `${e.index}:${e.type}`).join(', '));
