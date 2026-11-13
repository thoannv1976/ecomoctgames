import type { RsGameId } from '@arena/rs';
import { PW_WEB } from '../pw/PwWeb';
import type { RsWeb } from './parts';

const WEB: Partial<Record<RsGameId, RsWeb>> = {
  'platform-wars': PW_WEB,
};

export const rsWebOf = (id: string): RsWeb | undefined => WEB[id as RsGameId];
