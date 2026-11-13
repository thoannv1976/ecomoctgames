import { DECISION_INFO, INTERVIEW_SLOTS, type MdRoomDoc } from '@arena/md';
import { MAX_SEATS } from '@arena/types';
import { Qr, joinUrl } from '../components/common';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import { AiErrors, CaseTable, Countdown, DecisionRule, MD_DEBRIEF, MdStandings, SourceBars, bn } from './parts';

/** Projector view for Game 4 (Screen.tsx adds the host buttons via MdControls). */
export function MdScreen({ room, now }: { room: MdRoomDoc; now: number }) {
  const { lang, t, tr } = useLang();
  if (room.status === 'lobby') {
    return (
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <Qr text={joinUrl(room.code)} size={280} />
          <p className="text-lg text-ink/70">{joinUrl(room.code).replace(/^https?:\/\//, '')}</p>
        </div>
        <div className="space-y-4">
          <p className="text-2xl font-semibold text-ink/70">{tr('Market Detective · 3 cases · 100 research credits each', 'Thám tử thị trường · 3 vụ · mỗi vụ 100 điểm nghiên cứu')}</p>
          <p className="text-7xl font-extrabold tracking-[0.3em]">{room.code}</p>
          <p className="text-xl">{tr('Detectives', 'Thám tử')} ({room.order.length}/{MAX_SEATS}){room.settings.fillBots && room.order.length < MAX_SEATS ? tr(' · empty seats played by AI detectives', ' · ghế trống do thám tử máy chơi') : ''}</p>
          <div className="grid grid-cols-2 gap-2">
            {room.order.map((id) => (
              <div key={id} className="pop rounded-xl bg-white px-4 py-3 text-2xl font-semibold ring-1 ring-ink/10">{room.players[id]!.name}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (room.status === 'decide' && room.case) {
    const c = room.case;
    const done = room.order.filter((id) => room.players[id]?.bot || room.submitted[id]).length;
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-3xl font-extrabold">{tr('Case', 'Vụ')} {room.round}/{room.rounds} · {t(c.title)}</span>
          <Countdown deadline={room.deadline} now={now} big />
        </div>
        <div className="card space-y-3 text-2xl leading-relaxed">
          <p className="font-bold">{t(c.question)}</p>
          <p className="text-ink/75">{t(c.context)}</p>
          <DecisionRule c={c} big />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card text-xl">
            <p className="font-bold">🎤 {tr('Customer interviews', 'Phỏng vấn khách hàng')} ({room.interviews.length}/{INTERVIEW_SLOTS})</p>
            <p className="mt-1">{room.interviews.length ? room.interviews.map((id) => room.players[id]?.name).join(' · ') : tr('Still available – who will be first?', 'Vẫn còn – ai nhanh tay nhất?')}</p>
          </div>
          <div className="card text-xl">
            <p className="font-bold">✋ {done}/{room.order.length} {tr('submitted', 'đã nộp')}</p>
            <p className="mt-1 text-lg text-ink/70">
              {room.order.filter((id) => !room.players[id]?.bot).map((id) => `${room.submitted[id] ? '✅' : '⏳'} ${room.players[id]?.name} (${room.bought[id] ?? 0})`).join(' · ')}
            </p>
          </div>
        </div>
      </div>
    );
  }
  const rv = room.reveal;
  return (
    <div className="space-y-5">
      {rv && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="pop rounded-2xl bg-ink px-6 py-5 text-white">
              <p className="text-xl text-white/70">{tr('Case', 'Vụ')} {room.round}/{room.rounds} · {room.case ? t(room.case.title) : ''}</p>
              <p className="text-6xl font-extrabold">{bn(rv.truth, lang)}</p>
              <p className="text-2xl">{tr('Right decision', 'Quyết định đúng')}: <b className="text-amber">{t(DECISION_INFO[rv.decision])}</b></p>
            </div>
            <div className="card"><CaseTable room={room} big /></div>
          </div>
          <div className="card">
            <h2 className="mb-2 text-2xl font-bold">📏 {tr('Which sources were right?', 'Nguồn nào đúng?')}</h2>
            <SourceBars reveal={rv} big />
          </div>
        </div>
      )}
      {rv && (
        <div className="card">
          <h2 className="mb-2 text-2xl font-bold">🤖 {tr('The AI report, checked', 'Kiểm chứng báo cáo AI')}</h2>
          <AiErrors reveal={rv} big />
        </div>
      )}
      <div className="card">
        <h2 className="mb-2 text-2xl font-bold">{room.status === 'finished' ? tr('🏆 Final standings', '🏆 Xếp hạng chung cuộc') : tr('Standings', 'Bảng xếp hạng')}</h2>
        <MdStandings room={room} big />
      </div>
      {room.status === 'finished' && (
        <div className="card text-xl leading-relaxed">
          <h2 className="mb-2 font-bold">{tr('Debrief', 'Tổng kết')}</h2>
          <ol className="list-decimal space-y-1 pl-6">
            {MD_DEBRIEF.map(([en, vi]) => <li key={en}>{tr(en, vi)}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

export function MdControls({ room, hostToken, busy, run }: { room: MdRoomDoc; hostToken: string; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const { tr } = useLang();
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
          <button type="button" className="btn-dark" disabled={busy} onClick={() => window.confirm(tr('Close the case now? Students who have not submitted get 0.', 'Đóng vụ ngay? Ai chưa nộp sẽ được 0 điểm.')) && run(() => api.advance(room.code, { hostToken, expectStatus: 'decide', expectRound: room.round }))}>
            {tr('Close case', 'Đóng vụ')}
          </button>
        </>
      )}
      {room.status === 'results' && (
        <button type="button" className="btn-primary px-8 py-3 text-xl" disabled={busy} onClick={() => run(() => api.advance(room.code, { hostToken, expectStatus: 'results', expectRound: room.round }))}>
          {tr(`Case ${room.round + 1} →`, `Sang vụ ${room.round + 1} →`)}
        </button>
      )}
    </div>
  );
}
