import { UNIT_ECONOMICS_TEMPLATES, seededRng } from '../src/index.js';
const ids = process.argv.slice(2);
for (const t of UNIT_ECONOMICS_TEMPLATES.filter((x) => !ids.length || ids.includes(x.id))) {
  const q = t.make(seededRng('peek-' + t.id));
  for (const l of ['en', 'vi'] as const) {
    console.log(`\n[${t.id} ${l}] ${q.prompt[l]}`);
    if (q.context) console.log('  ctx:', q.context[l]);
    if (q.table) for (const r of q.table.rows) console.log('  |', r.cells.map((c) => c[l]).join(' | '));
    const list = q.kind === 'choice' ? q.options : q.kind === 'spot' ? q.segments : q.items;
    list.forEach((o, i) => console.log(`  ${q.kind !== 'order' && i === (q as any).answer ? '*' : '-'} ${o[l].replace(/\n/g, ' / ')}`));
    console.log('  =>', q.explanation[l]);
  }
}
