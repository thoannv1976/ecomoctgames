import type { AnswerInput, GameId, HintPayload, RoomSettings, RoomStatus } from '@arena/types';
import type { CeoDecision, CeoMe, CeoSettings } from '@arena/ceo';

/** Server clock offset (ms) so every device counts down to the same deadline. */
let offset = 0;
let bestRtt = Number.POSITIVE_INFINITY;
export const serverNow = () => Date.now() + offset;

function syncClock(serverTime: unknown, sentAt: number) {
  if (typeof serverTime !== 'number') return;
  const receivedAt = Date.now();
  const rtt = receivedAt - sentAt;
  if (rtt <= bestRtt * 1.5) {
    bestRtt = Math.min(bestRtt, rtt);
    offset = serverTime + rtt / 2 - receivedAt;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public messageVi: string,
  ) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
  const sentAt = Date.now();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : null });
  } catch {
    throw new ApiError(0, 'network', 'Network problem. Try again.', 'Mất kết nối mạng. Thử lại.');
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  syncClock(data.serverNow, sentAt);
  if (!res.ok) throw new ApiError(res.status, String(data.error ?? 'error'), String(data.message ?? 'Something went wrong.'), String(data.messageVi ?? data.message ?? 'Có lỗi xảy ra.'));
  return data as T;
}

export const api = {
  time: () => call<{ serverNow: number }>('GET', '/time'),
  ltiLaunch: (ticket: string) =>
    call<{ session: string; role: 'instructor' | 'learner'; name: string; contextTitle: string | null; graded: boolean; activity: string | null }>('POST', '/lti/launch', { ticket }),
  createRoom: (body: { hostPlays: boolean; hostName?: string; title?: string; game?: GameId; settings?: Partial<RoomSettings> | Partial<CeoSettings>; ltiSession?: string }) =>
    call<{ code: string; hostToken: string; playerId?: string; playerToken?: string }>('POST', '/rooms', body),
  join: (code: string, name: string, ltiSession?: string) => call<{ playerId: string; playerToken: string }>('POST', `/rooms/${code}/join`, { name, ...(ltiSession ? { ltiSession } : {}) }),
  start: (code: string, hostToken: string) => call<{ ok: true }>('POST', `/rooms/${code}/start`, { hostToken }),
  kick: (code: string, hostToken: string, playerId: string) => call<{ ok: true }>('POST', `/rooms/${code}/kick`, { hostToken, playerId }),
  end: (code: string, hostToken: string) => call<{ ok: true }>('POST', `/rooms/${code}/end`, { hostToken }),
  answer: (code: string, playerId: string, playerToken: string, qIndex: number, input: AnswerInput) =>
    call<{ ok: true; closed: boolean }>('POST', `/rooms/${code}/answer`, { playerId, playerToken, qIndex, input }),
  hint: (code: string, playerId: string, playerToken: string, qIndex: number) => call<{ hint: HintPayload }>('POST', `/rooms/${code}/hint`, { playerId, playerToken, qIndex }),
  ceoDecide: (code: string, playerId: string, playerToken: string, round: number, decision: CeoDecision) =>
    call<{ ok: true; closed: boolean }>('POST', `/rooms/${code}/ceo-decide`, { playerId, playerToken, round, decision }),
  ceoMe: (code: string, playerId: string, playerToken: string) => call<CeoMe>('POST', `/rooms/${code}/ceo-me`, { playerId, playerToken }),
  extend: (code: string, hostToken: string) => call<{ ok: true }>('POST', `/rooms/${code}/extend`, { hostToken }),
  advance: (code: string, opts: { hostToken?: string; expectStatus?: RoomStatus | 'decide' | 'results'; expectQIndex?: number; expectRound?: number }) =>
    call<{ changed: boolean }>('POST', `/rooms/${code}/advance`, opts),
};

export function syncTimeOnce() {
  void api.time().catch(() => undefined);
  setTimeout(() => void api.time().catch(() => undefined), 1500);
}
