// Projector view for the round-sim games (Screen.tsx adds the host buttons via RsControls).
import type { RsRoomDoc } from '@arena/rs';
import { MAX_SEATS } from '@arena/types';
import { Qr, joinUrl } from '../components/common';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import { Countdown, HistoryChart, RsStandings } from './parts';
import { rsWebOf } from './registry';

export function RsScreen({ room, now }: { room: RsRoomDoc; now: number }) {
  const { t, tr } = useLang();
  const web = rsWebOf(room.game);
  if (!web) return null;
  if (room.status === 'lobby') {
    return (
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <Qr text={joinUrl(room.code)} size={280} />
          <p className="text-lg text-ink/70">{joinUrl(room.code).replace(/^https?:\/\//, '')}</p>
        </div>
        <div className="space-y-4">
          <p className="text-2xl font-semibold text-ink/70">{web.tag}</p>
          <p className="text-7xl font-extrabold tracking-[0.3em]">{room.code}</p>
          <p className="text-xl">{tr('Companies', 'Công ty')} ({room.order.length}/{MAX_SEATS}){room.settings.fillBots && room.order.length < MAX_SEATS ? tr(' · empty seats played by AI', ' · ghế trống do máy chơi') : ''}</p>
          <div className="grid grid-cols-2 gap-2">
            {room.order.map((id) => (
              <div key={id} className="pop rounded-xl bg-white px-4 py-3 text-2xl font-semibold ring-1 ring-ink/10">{room.players[id]!.name}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (room.status === 'decide') {
    const info = web.roundInfo(room.round);
    const humans = room.order.filter((id) => !room.players[id]?.bot);
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-3xl font-extrabold">{t(web.roundWord)} {room.round}/{room.rounds} · {t(info.title)}</span>
          <Countdown deadline={room.deadline} now={now} big />
        </div>
        <div className="card text-2xl leading-relaxed">{t(info.text)}</div>
        <div className="card text-xl">
          <p className="font-bold">✋ {humans.filter((id) => room.submitted[id]).length}/{humans.length} {tr('plans submitted', 'kế hoạch đã nộp')}</p>
          <p className="mt-1 text-lg text-ink/70">{humans.map((id) => `${room.submitted[id] ? '✅' : '⏳'} ${room.players[id]?.name}`).join(' · ')}</p>
        </div>
        {room.round > 1 && (
          <div className="grid gap-5 lg:grid-cols-2">
            {web.Market && <div className="card"><web.Market room={room} big /></div>}
            <div className="card"><RsStandings room={room} web={web} big /></div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="card">
        <p className="text-xl text-ink/60">{t(web.roundWord)} {room.round}/{room.rounds} · {t(web.roundInfo(room.round).title)}</p>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-2xl">
          {room.news.map((n, i) => <li key={i}>{t(n)}</li>)}
        </ul>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {web.Market && <div className="card"><web.Market room={room} big /></div>}
        <div className="card"><HistoryChart room={room} web={web} height={240} /></div>
      </div>
      <div className="card">
        <h2 className="mb-2 text-2xl font-bold">{room.status === 'finished' ? tr('🏆 Final standings', '🏆 Xếp hạng chung cuộc') : tr('Standings', 'Bảng xếp hạng')}</h2>
        <RsStandings room={room} web={web} big />
      </div>
      {room.status === 'finished' && (
        <div className="card text-xl leading-relaxed">
          <h2 className="mb-2 font-bold">{tr('Debrief', 'Tổng kết')}</h2>
          <ol className="list-decimal space-y-1 pl-6">
            {web.debrief.map(([en, vi]) => <li key={en}>{tr(en, vi)}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

export function RsControls({ room, hostToken, busy, run }: { room: RsRoomDoc; hostToken: string; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { tr } = useLang();
  const web = rsWebOf(room.game);
  const word = web?.roundWord ?? { en: 'Round', vi: 'Vòng' };
  return (
    <div className="flex flex-wrap justify-center gap-3 pt-2">
      {room.status === 'lobby' && (
        <button type="button" className="btn-primary px-8 py-3 text-xl" disabled={busy || !room.order.length} onClick={() => run(() => api.start(room.code, hostToken))}>
          ▶ {tr('Start', 'Bắt đầu')}
        </button>
      )}
      {room.status === 'decide' && (
        <>
          {room.deadline !== null && <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(() => api.extend(room.code, hostToken))}>{tr('+1 min', '+1 phút')}</button>}
          <button type="button" className="btn-dark" disabled={busy} onClick={() => window.confirm(tr('Close the round now? Missing plans reuse the previous round.', 'Chốt vòng ngay? Ai chưa nộp sẽ dùng lại kế hoạch vòng trước.')) && run(() => api.advance(room.code, { hostToken, expectStatus: 'decide', expectRound: room.round }))}>
            {tr(`Close ${word.en.toLowerCase()}`, `Chốt ${word.vi.toLowerCase()}`)}
          </button>
        </>
      )}
      {room.status === 'results' && (
        <button type="button" className="btn-primary px-8 py-3 text-xl" disabled={busy} onClick={() => run(() => api.advance(room.code, { hostToken, expectStatus: 'results', expectRound: room.round }))}>
          {tr(`${word.en} ${room.round + 1} →`, `Sang ${word.vi.toLowerCase()} ${room.round + 1} →`)}
        </button>
      )}
    </div>
  );
}
