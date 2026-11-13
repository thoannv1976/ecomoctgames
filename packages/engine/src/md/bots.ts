// Game 4 AI players: four research styles from the plan, each with an Easy/Medium/Hard skill level.
import type { Rng } from '../rng.js';
import type { BotLevel } from '../types.js';
import { decisionFor, type MdCaseFull } from './cases.js';
import { SOURCE_INFO, START_CREDITS, type MdArchetype, type MdSubmission, type SourceId } from './types.js';

/** Seconds after a case opens when a bot of this style tries to book an interview (null = never). */
export function interviewDelaySec(arch: MdArchetype, level: BotLevel): number | null {
  const base = level === 'hard' ? 45 : level === 'medium' ? 90 : 150;
  if (arch === 'careful') return base;
  if (arch === 'all') return Math.round(base * 1.4);
  return null;
}

const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
const SKILL: Record<BotLevel, { sd: number; catch: number; falseFlag: number }> = {
  easy: { sd: 0.3, catch: 0.4, falseFlag: 0.2 },
  medium: { sd: 0.15, catch: 0.65, falseFlag: 0.1 },
  hard: { sd: 0.06, catch: 0.9, falseFlag: 0.03 },
};

const geoMean = (pairs: [number, number][]) => {
  const w = pairs.reduce((s, [, k]) => s + k, 0);
  return Math.exp(pairs.reduce((s, [v, k]) => s + Math.log(Math.max(0.01, v)) * k, 0) / w);
};

export function mdBotPlay(arch: MdArchetype, level: BotLevel, c: MdCaseFull, hasInterview: boolean, rng: Rng): { bought: SourceId[]; sub: MdSubmission; credits: number } {
  const skill = SKILL[level];
  const f = c.findings;
  let bought: SourceId[];
  let estimate: number;
  let flags: number[] = [];
  if (arch === 'ai') {
    bought = ['ai'];
    estimate = f.ai.implied!;
  } else if (arch === 'trends') {
    bought = ['trends'];
    estimate = f.trends.implied!;
  } else if (arch === 'all') {
    bought = hasInterview ? ['interview', 'marketplace', 'report', 'social', 'ai'] : ['marketplace', 'report', 'reviews', 'social', 'trends', 'ai'];
    // Naive: a plain average of every number, without asking where each one came from.
    estimate = bought.reduce((sum, s) => sum + f[s].implied!, 0) / bought.length;
  } else {
    bought = hasInterview ? ['interview', 'marketplace', 'reviews', 'report', 'ai'] : ['marketplace', 'reviews', 'report', 'trends', 'ai'];
    const pairs: [number, number][] = [
      [f.marketplace.implied! / 1.2, 2],
      [f.reviews.implied ?? 0, hasInterview ? 0 : 1],
      [f.report.implied! * (1 + c.growth) ** 2, 2],
    ];
    if (hasInterview) pairs.push([f.interview.implied!, 5]);
    estimate = geoMean(pairs.filter(([v, w]) => v > 0 && w > 0)) * Math.exp(gauss(rng) * skill.sd);
    const wrong = new Set(c.aiErrors.map((e) => e.index));
    flags = c.aiClaims.map((_, i) => i).filter((i) => rng() < (wrong.has(i) ? skill.catch : skill.falseFlag));
  }
  if (arch !== 'careful') estimate *= Math.exp(gauss(rng) * 0.05);
  estimate = Math.round(estimate * 10) / 10;
  const cost = bought.reduce((s, id) => s + SOURCE_INFO[id].cost, 0);
  let decision = decisionFor(estimate, c.pub);
  // Weak analysts hedge with a pilot when they are close to a threshold.
  if (arch === 'careful' && level === 'easy' && rng() < 0.3) decision = 'pilot';
  return { bought, sub: { estimate, decision, flags }, credits: START_CREDITS - cost };
}
