// Game 4 scoring (per case, max 100): estimate 50 · decision 25 · AI fact-check ±5 per flag · credits left 15 (only with an estimate within 50%).
import { decisionFor, type MdCaseFull } from './cases.js';
import { START_CREDITS, type MdCaseScore, type MdSubmission, type SourceId } from './types.js';

export function accuracyPts(estimate: number, truth: number): number {
  if (!(estimate > 0) || !(truth > 0)) return 0;
  const r = Math.abs(Math.log(estimate / truth));
  const full = Math.log(1.1);
  const zero = Math.log(2);
  if (r <= full) return 50;
  if (r >= zero) return 0;
  return Math.round(50 * (1 - (r - full) / (zero - full)));
}

export function decisionPts(decision: MdSubmission['decision'], c: MdCaseFull): number {
  const right = decisionFor(c.truth, c.pub);
  if (decision === right) return 25;
  // A small pilot limits the damage when the truth is either extreme.
  if (decision === 'pilot') return 10;
  return 0;
}

export function scoreCase(c: MdCaseFull, sub: MdSubmission | null, bought: SourceId[], creditsLeft: number): MdCaseScore {
  const base: MdCaseScore = { caseId: c.pub.id, estimate: null, decision: null, accuracy: 0, decisionPts: 0, flagPts: 0, creditPts: 0, total: 0, sources: bought, flags: [] };
  if (!sub) return base;
  const wrong = new Set(c.aiErrors.map((e) => e.index));
  const flagPts = bought.includes('ai') ? sub.flags.reduce((sum, i) => sum + (wrong.has(i) ? 5 : -5), 0) : 0;
  const accuracy = accuracyPts(sub.estimate, c.truth);
  const dec = decisionPts(sub.decision, c);
  // Saving credits only counts when the estimate is within 50% – cheap guessing is not research.
  const close = Math.abs(Math.log(sub.estimate / c.truth)) <= Math.log(1.5);
  const creditPts = close ? Math.round((15 * Math.max(0, creditsLeft)) / START_CREDITS) : 0;
  return { ...base, flags: bought.includes('ai') ? sub.flags : [], estimate: sub.estimate, decision: sub.decision, accuracy, decisionPts: dec, flagPts, creditPts, total: Math.max(0, accuracy + dec + flagPts + creditPts) };
}
