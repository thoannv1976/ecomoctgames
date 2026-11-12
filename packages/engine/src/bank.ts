import type { Rng } from './rng.js';
import type { Category, DataTable, T } from './types.js';

/** A generated question (server-only: it carries the answer). Firestore-safe: no arrays of arrays. */
interface BankBase {
  id: string;
  category: Category;
  prompt: T;
  context?: T;
  table?: DataTable;
  /** Shown after the answer: why the right answer is right. */
  explanation: T;
  /** Textbook section the question is based on. */
  source: T;
  timeLimitSec?: number;
}

export interface ChoiceQuestion extends BankBase {
  kind: 'choice';
  options: T[];
  answer: number;
  /** Keep option order (ascending numbers read better). */
  fixedOrder?: boolean;
}

export interface SpotQuestion extends BankBase {
  kind: 'spot';
  /** Dashboard tiles; exactly one is the answer. */
  segments: T[];
  answer: number;
}

export interface OrderQuestion extends BankBase {
  kind: 'order';
  /** Items in the right order (shuffled before they are shown). */
  items: T[];
}

export type BankQuestion = ChoiceQuestion | SpotQuestion | OrderQuestion;

/** A question pattern: every game draws fresh numbers, so answers cannot be copied between rooms. */
export interface QuestionTemplate {
  id: string;
  category: Category;
  make: (rng: Rng) => BankQuestion;
}

export const DEFAULT_TIME_LIMIT: Record<BankQuestion['kind'], number> = { choice: 30, spot: 30, order: 40 };
export const timeLimitOf = (q: BankQuestion): number => q.timeLimitSec ?? DEFAULT_TIME_LIMIT[q.kind];
