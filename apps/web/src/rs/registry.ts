import type { RsGameId } from '@arena/rs';
import type { GameId } from '@arena/types';
import { AD_WEB } from '../ad/AdWeb';
import { CRO_WEB } from '../cro/CroWeb';
import { PD_WEB } from '../pd/PdWeb';
import { PW_WEB } from '../pw/PwWeb';
import { SS_WEB } from '../ss/SsWeb';
import { WR_WEB } from '../wr/WrWeb';
import type { RsWeb } from './parts';

const WEB: Partial<Record<RsGameId, RsWeb>> = {
  'platform-wars': PW_WEB,
  'cro-battle': CRO_WEB,
  'ad-clash': AD_WEB,
  'peak-day': PD_WEB,
  'wave-rider': WR_WEB,
  'shopper-stream': SS_WEB,
};

export const rsWebOf = (id: string): RsWeb | undefined => WEB[id as RsGameId];
/** Round-sim games that are ready to play (shown on the home page and the lecturer dashboard). */
export const RS_READY = Object.keys(WEB) as GameId[];
