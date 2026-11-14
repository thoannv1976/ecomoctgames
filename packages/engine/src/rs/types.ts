// Round-sim framework: the shared public room shape for the multi-round market games (Games 2, 6, 7, 8 …).
// Browser-safe: no hidden model here. Each game adds its own content module (pw/types.ts …).
import type { BotLevel, T } from '../types.js';

export type RsGameId = 'platform-wars' | 'cro-battle' | 'ad-clash' | 'peak-day' | 'wave-rider' | 'shopper-stream' | 'agent-arena';
export const RS_GAME_IDS: RsGameId[] = ['platform-wars', 'cro-battle', 'ad-clash', 'peak-day', 'wave-rider', 'shopper-stream', 'agent-arena'];
export const isRsGameId = (g: unknown): g is RsGameId => typeof g === 'string' && (RS_GAME_IDS as string[]).includes(g);

export interface RsSettings {
  /** Seconds per round; 0 = no limit (the host closes the round). */
  decideSec: number;
  /** Seconds the results stay before the next round opens; 0 = the host moves on. */
  resultsSec: number;
  botLevel: BotLevel;
  fillBots: boolean;
}

export interface RsPlayerPublic {
  id: string;
  name: string;
  bot: boolean;
  level?: BotLevel;
  archetype?: string;
  joinedAt: number;
  lms?: boolean;
}

export interface RsStanding {
  /** Scorecard 0–100 so far (the ranking key). */
  score: number;
  rank: number;
  /** Game-specific columns for the leaderboard. */
  cols: Record<string, number>;
  defaulted?: boolean;
  /** Short status tag, e.g. 'bankrupt'. */
  flag?: string;
}

export interface RsRoomDoc {
  code: string;
  game: RsGameId;
  title: string;
  status: 'lobby' | 'decide' | 'results' | 'finished';
  createdAt: number;
  hostPlays: boolean;
  hostPlayerId: string | null;
  settings: RsSettings;
  players: Record<string, RsPlayerPublic>;
  order: string[];
  round: number;
  rounds: number;
  openedAt: number | null;
  deadline: number | null;
  submitted: Record<string, boolean>;
  standings: Record<string, RsStanding>;
  /** One headline number per company per round (for the chart). */
  history: { round: number; values: Record<string, number> }[];
  /** What happened last round (market news). */
  news: T[];
  /** Game-specific public market data (shares, prices …). */
  pub: Record<string, unknown>;
  revealedAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  version: number;
  lmsStatus?: Record<string, 'sent' | 'error'>;
}

export interface RsScorecard {
  total: number;
  parts: Record<string, number>;
}

export interface RsMe<R = unknown, V = unknown> {
  playerId: string;
  reports: R[];
  pending: unknown | null;
  scorecard: RsScorecard;
  grade: number | null;
  /** Game-specific private view (cash, stock, hidden results revealed at the end …). */
  view: V;
  badges: string[];
}
