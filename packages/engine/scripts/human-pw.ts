// A few fixed "student" strategies against 5 AI platforms (medium unless argv[2]).
import { seededRng, shuffle } from '../src/rng.js';
import { initPw, pwBot, pwScorecard, pwTrustNeed, simulatePw, type PwCo } from '../src/pw/game.js';
import type { PwArchetype, PwDecision } from '../src/pw/types.js';
import type { BotLevel } from '../src/types.js';
const level = (process.argv[2] ?? 'medium') as BotLevel;
const S: Record<string, (c: PwCo, r: number) => PwDecision> = {
  steady8: () => ({ take: 8, subsidy: 3, toSellers: 50, ads: 1, trust: 1, program: 'tiers' }),
  sellerFirst: (c, r) => ({ take: r <= 2 ? 4 : 9, subsidy: r <= 2 ? 5 : 2, toSellers: r <= 2 ? 80 : 40, ads: r >= 3 ? 1 : 0, trust: pwTrustNeed(c.gmvLast), program: 'tiers' }),
  greedy12: () => ({ take: 12, subsidy: 2, toSellers: 50, ads: 2, trust: 1, program: 'none' }),
  noSubsidy: () => ({ take: 6, subsidy: 0, toSellers: 50, ads: 0, trust: 0.5, program: 'none' }),
  allIn: () => ({ take: 5, subsidy: 8, toSellers: 50, ads: 0, trust: 2, program: 'vip' }),
};
const ARCHS: PwArchetype[] = ['burn', 'toll', 'buyers', 'balanced', 'sellers', 'smart'];
for (const [name, f] of Object.entries(S)) {
  let score = 0, rank = 0, profit = 0, share = 0; const N = 300;
  for (let g = 0; g < N; g++) {
    const rng = seededRng(`h${g}`);
    const bots = shuffle(rng, ARCHS).slice(0, 5);
    const order = ['me', ...bots.map((_, i) => `b${i}`)];
    const st = initPw(order);
    for (let r = 1; r <= 6; r++) {
      const inputs: Record<string, { decision: PwDecision; defaulted: boolean }> = { me: { decision: f(st.cos.me!, r), defaulted: false } };
      bots.forEach((a, i) => (inputs[`b${i}`] = { decision: pwBot(a, level, st.cos[`b${i}`]!, r, rng), defaulted: false }));
      simulatePw(st, order, inputs, r);
    }
    const sc = order.map((id) => pwScorecard(st.cos[id]!).total);
    score += sc[0]!; rank += 1 + sc.filter((x) => x > sc[0]!).length; profit += st.cos.me!.profitCum; share += st.cos.me!.share;
  }
  console.log(name.padEnd(12), 'score', (score / N).toFixed(1), 'rank', (rank / N).toFixed(2), 'profit', (profit / N).toFixed(1), 'share', ((share / N) * 100).toFixed(1));
}
