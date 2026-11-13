import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CATEGORY_LABEL, MAX_SEATS, type Category, type PlayerPublic, type RoomDoc, type T } from '@arena/types';
import { CategoryStats, ErrorNote, Leaderboard, PlayerName, Qr, TimerBar, downloadText, gameName, joinUrl, resultsCsv } from '../components/common';
import { AnswerReview, CategoryChip, QuestionHeader, QuestionPreview } from '../components/QuestionView';
import { api } from '../lib/api';
import { answeredCount, rankPlayers, useAutoAdvance, useNow, useRoom } from '../lib/hooks';
import { LangToggle, errOf, useLang } from '../lib/i18n';
import { getHostedRooms, getSession } from '../lib/storage';
import { CeoScreen } from '../ceo/CeoScreen';
import { asCeo, isCeoRoom, useCeoAutoAdvance } from '../ceo/parts';
import { ROUNDS, type CeoRoomDoc } from '@arena/ceo';
import { MdControls, MdScreen } from '../md/MdScreen';
import { asMd, isMdRoom, useMdAutoAdvance } from '../md/parts';

/** Projector screen for one room. Host controls appear when this browser created the room. */
export function Screen() {
  const { t, tr } = useLang();
  const code = (useParams().code ?? '').toUpperCase();
  const { room, error } = useRoom(code);
  const now = useNow();
  const hostToken = getHostedRooms().find((r) => r.code === code)?.hostToken ?? getSession(code)?.hostToken;
  useAutoAdvance(room, now, hostToken);
  const isCeo = isCeoRoom(room);
  useCeoAutoAdvance(room && isCeo ? asCeo(room) : null, now, hostToken);
  const isMd = isMdRoom(room);
  useMdAutoAdvance(room && isMd ? asMd(room) : null, now, hostToken);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<T | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(errOf(err, { en: 'Error', vi: 'Lỗi' }));
    } finally {
      setBusy(false);
    }
  }

  if (room === undefined) return <div className="flex min-h-screen items-center justify-center bg-ink text-2xl text-white">{tr('Opening room', 'Đang mở phòng')} {code}…</div>;
  if (room === null) return <div className="flex min-h-screen items-center justify-center bg-ink text-2xl text-white">{tr('Room not found', 'Không tìm thấy phòng')} {code}</div>;

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between gap-4 bg-ink px-6 py-3 text-white">
        <span className="text-xl font-extrabold">
          🛒 {t(gameName(room.game))} · <span className="text-amber">{room.title}</span>
        </span>
        <span className="flex items-center gap-4 text-lg">
          {tr('Room code', 'Mã phòng')} <b className="text-2xl tracking-[0.2em] text-amber">{room.code}</b>
          <LangToggle dark />
        </span>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        <ErrorNote err={error ? { en: 'Connection lost, retrying…', vi: 'Mất kết nối, đang thử lại…' } : actionError} />
        {isCeo && <CeoScreen room={asCeo(room)} now={now} />}
        {isCeo && hostToken && <CeoControls room={asCeo(room)} hostToken={hostToken} busy={busy} run={run} />}
        {isMd && <MdScreen room={asMd(room)} now={now} />}
        {isMd && hostToken && <MdControls room={asMd(room)} hostToken={hostToken} busy={busy} run={run} />}
        {!isCeo && !isMd && room.status === 'lobby' && <LobbyScreen room={room} />}
        {!isCeo && !isMd && room.status === 'question' && <QuestionScreen room={room} now={now} />}
        {!isCeo && !isMd && room.status === 'reveal' && <RevealScreen room={room} now={now} />}
        {!isCeo && !isMd && room.status === 'finished' && <FinalScreen room={room} />}
        {!isCeo && !isMd && hostToken && (
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {room.status === 'lobby' && (
              <button type="button" className="btn-primary px-8 py-3 text-xl" disabled={busy || !room.order.length} onClick={() => run(() => api.start(room.code, hostToken))}>
                ▶ {tr('Start', 'Bắt đầu')}
              </button>
            )}
            {room.status === 'reveal' && (
              <button type="button" className="btn-primary px-8 py-3 text-xl" disabled={busy} onClick={() => run(() => api.advance(room.code, { hostToken, expectStatus: 'reveal', expectQIndex: room.qIndex }))}>
                {room.qIndex + 1 >= room.qTotal ? tr('Final results', 'Kết quả chung cuộc') : tr('Next question →', 'Câu tiếp →')}
              </button>
            )}
            {room.status === 'finished' && (
              <button type="button" className="btn-dark" onClick={() => downloadText(`results-${room.code}.csv`, resultsCsv([room]))}>
                ⬇ {tr('Export results', 'Xuất kết quả')}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CeoControls({ room, hostToken, busy, run }: { room: CeoRoomDoc; hostToken: string; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
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
          <button type="button" className="btn-dark" disabled={busy} onClick={() => window.confirm(tr('Close the quarter now? Missing plans reuse last quarter.', 'Chốt quý ngay? Ai chưa nộp sẽ dùng lại lựa chọn quý trước.')) && run(() => api.advance(room.code, { hostToken, expectStatus: 'decide', expectRound: room.round }))}>
            {tr('Close quarter', 'Chốt quý')}
          </button>
        </>
      )}
      {room.status === 'results' && (
        <button type="button" className="btn-primary px-8 py-3 text-xl" disabled={busy} onClick={() => run(() => api.advance(room.code, { hostToken, expectStatus: 'results', expectRound: room.round }))}>
          {room.round + 1 === ROUNDS ? tr('Quarter 6: crisis cards →', 'Quý 6: thẻ khủng hoảng →') : tr(`Quarter ${room.round + 1} →`, `Sang quý ${room.round + 1} →`)}
        </button>
      )}
    </div>
  );
}

function LobbyScreen({ room }: { room: RoomDoc }) {
  const { tr } = useLang();
  return (
    <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-3">
        <Qr text={joinUrl(room.code)} size={280} />
        <p className="text-lg text-ink/70">{joinUrl(room.code).replace(/^https?:\/\//, '')}</p>
      </div>
      <div className="space-y-4">
        <p className="text-2xl font-semibold text-ink/70">{tr('Scan the QR code or open the home page and type the code', 'Quét mã QR hoặc vào trang chủ và nhập mã')}</p>
        <p className="text-7xl font-extrabold tracking-[0.3em]">{room.code}</p>
        <p className="text-xl">
          {tr('Players', 'Người chơi')} ({room.order.length}/{MAX_SEATS}){room.settings.fillBots && room.order.length < MAX_SEATS ? tr(' · empty seats played by AI', ' · ghế trống do máy chơi') : ''}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {room.order.map((id) => (
            <div key={id} className="pop rounded-xl bg-white px-4 py-3 text-2xl font-semibold ring-1 ring-ink/10">
              <PlayerName p={room.players[id]!} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionScreen({ room, now }: { room: RoomDoc; now: number }) {
  const { tr } = useLang();
  const cur = room.current!;
  const count = answeredCount(room, now);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-ink/60">{tr('Question', 'Câu')} {room.qIndex + 1}/{room.qTotal}</span>
        <CategoryChip category={cur.q.category} big />
        <span className="text-2xl font-bold">✋ {count.done}/{count.total}</span>
      </div>
      {now < cur.openedAt ? <div className="rounded-xl bg-ink py-3 text-center text-3xl font-bold text-amber">{tr('Get ready…', 'Chuẩn bị…')} {Math.ceil((cur.openedAt - now) / 1000)}</div> : <TimerBar openedAt={cur.openedAt} deadline={cur.deadline} now={now} big />}
      <div className="card space-y-5">
        <QuestionHeader q={cur.q} big />
        <QuestionPreview q={cur.q} />
      </div>
    </div>
  );
}

function RevealScreen({ room, now }: { room: RoomDoc; now: number }) {
  const { t, tr } = useLang();
  const reveal = room.reveal!;
  const q = room.current!.q;
  const autoLeft = room.settings.autoNextSec > 0 ? Math.max(0, Math.ceil((reveal.revealedAt + room.settings.autoNextSec * 1000 - now) / 1000)) : null;
  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-ink/60">{tr('Answer', 'Đáp án câu')} {room.qIndex + 1}/{room.qTotal}</span>
          <CategoryChip category={q.category} big />
        </div>
        <p className="text-2xl font-bold">{t(q.prompt)}</p>
        <AnswerReview q={q} answerKey={reveal.key} big {...(reveal.distribution ? { distribution: reveal.distribution } : {})} />
        <div className="rounded-xl bg-amber/15 p-4 text-xl leading-relaxed">
          <b>{tr('Why:', 'Vì sao:')}</b> {t(reveal.explanation)}
          <p className="mt-2 text-base text-ink/50">{t(reveal.source)}</p>
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-2xl font-extrabold">{tr('Leaderboard', 'Bảng xếp hạng')}</h2>
        <Leaderboard room={room} reveal={reveal} big />
        {autoLeft !== null && <p className="text-center text-lg text-ink/60">{tr(`Next in ${autoLeft}s`, `Tự chuyển sau ${autoLeft}s`)}</p>}
      </div>
    </div>
  );
}

function FinalScreen({ room }: { room: RoomDoc }) {
  const { t, tr } = useLang();
  const list = rankPlayers(room);
  const podium = [list[1], list[0], list[2]];
  const heights = ['h-32', 'h-44', 'h-24'];
  const humans = list.filter((p) => !p.bot);
  const team = humans.length
    ? {
        ...humans[0]!,
        stats: humans.reduce<PlayerPublic['stats']>((acc, p) => {
          for (const [c, st] of Object.entries(p.stats) as [Category, { n: number; ok: number }][]) {
            const cur = acc[c] ?? { n: 0, ok: 0 };
            acc[c] = { n: cur.n + st.n, ok: cur.ok + st.ok };
          }
          return acc;
        }, {}),
      }
    : null;
  const weakest = team ? (Object.entries(team.stats) as [Category, { n: number; ok: number }][]).filter(([, s]) => s.n > 0).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0] : undefined;
  return (
    <div className="space-y-6">
      <h2 className="text-center text-4xl font-extrabold">🏆 {tr('Final results', 'Kết quả chung cuộc')}</h2>
      <div className="flex items-end justify-center gap-4">
        {podium.map((p, i) =>
          p ? (
            <div key={p.id} className="pop flex w-56 flex-col items-center gap-2">
              <span className="text-center text-2xl font-bold"><PlayerName p={p} /></span>
              <span className="text-xl font-extrabold tabular-nums">{p.score}</span>
              <div className={`flex w-full items-start justify-center rounded-t-2xl pt-3 text-5xl ${heights[i]} ${i === 1 ? 'bg-amber' : 'bg-ink text-white'}`}>{i === 1 ? '1' : i === 0 ? '2' : '3'}</div>
            </div>
          ) : (
            <div key={i} className="w-56" />
          ),
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <Leaderboard room={room} big />
        </div>
        {team && (
          <div className="card">
            <h3 className="mb-1 text-xl font-bold">{tr('The class, by question type', 'Cả phòng theo dạng câu')}</h3>
            <p className="mb-3 text-sm text-ink/60">
              {weakest ? tr(`Debrief tip: revisit “${CATEGORY_LABEL[weakest[0]].en}”.`, `Gợi ý tổng kết: ôn lại “${CATEGORY_LABEL[weakest[0]].vi}”.`) : ''}
            </p>
            <CategoryStats p={team} />
            <p className="mt-3 text-xs text-ink/40">{t({ en: 'Textbook Chapter 9 – E-commerce Analytics & Unit Economics', vi: 'Giáo trình Chương 9 – Phân tích TMĐT và Unit Economics' })}</p>
          </div>
        )}
      </div>
    </div>
  );
}
