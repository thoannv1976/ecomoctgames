// Server-side registry of the round-sim games (hidden models included – never import from the browser).
import { GameError } from '../room.js';
import { AD_CLASH } from '../ad/game.js';
import { CRO_BATTLE } from '../cro/game.js';
import { PEAK_DAY } from '../pd/game.js';
import { PLATFORM_WARS } from '../pw/game.js';
import { WAVE_RIDER } from '../wr/game.js';
import type { RsGame } from './room.js';
import type { RsGameId } from './types.js';

export const RS_GAMES: Partial<Record<RsGameId, RsGame>> = {
  'platform-wars': PLATFORM_WARS,
  'cro-battle': CRO_BATTLE,
  'ad-clash': AD_CLASH,
  'peak-day': PEAK_DAY,
  'wave-rider': WAVE_RIDER,
};

export function rsGame(id: string): RsGame {
  const g = RS_GAMES[id as RsGameId];
  if (!g) throw new GameError('no_game', { en: 'This game is not available yet.', vi: 'Game này chưa có.' }, 404);
  return g;
}
export const READY_RS_GAMES = Object.keys(RS_GAMES) as RsGameId[];
