import type { RsGameId } from '@arena/rs';
import type { GameId } from '@arena/types';
import { CRO_WEB } from '../cro/CroWeb';
import { PW_WEB } from '../pw/PwWeb';
import type { RsWeb } from './parts';

const WEB: Partial<Record<RsGameId, RsWeb>> = {
  'platform-wars': PW_WEB,
  'cro-battle': CRO_WEB,
};

export const rsWebOf = (id: string): RsWeb | undefined => WEB[id as RsGameId];
/** Round-sim games that are ready to play (shown on the home page and the lecturer dashboard). */
export const RS_READY = Object.keys(WEB) as GameId[];
