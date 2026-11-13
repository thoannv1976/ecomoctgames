import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BOT_LEVEL_LABEL, MAX_SEATS, type AnswerInput, type HintPayload, type RoomDoc, type T } from '@arena/types';
import { CategoryStats, ErrorNote, Leaderboard, MoodleBanner, PlayerName, Qr, Shell, TimerBar, gameName, joinUrl } from '../components/common';
import { AnswerArea, AnswerReview, CategoryChip, QuestionHeader } from '../components/QuestionView';
import { api } from '../lib/api';
import { answeredCount, humansOf, rankPlayers, useAutoAdvance, useNow, useRoom } from '../lib/hooks';
import { errOf, useLang } from '../lib/i18n';
import { CeoPlay } from '../ceo/CeoPlay';
import { asCeo, isCeoRoom, useCeoAutoAdvance } from '../ceo/parts';
import { MdPlay } from '../md/MdPlay';
import { RsPlay } from '../rs/RsPlay';
import { asRs, isRsRoom, useRsAutoAdvance } from '../rs/parts';
import { asMd, isMdRoom, useMdAutoAdvance } from '../md/parts';
import { clearSession, getHint, getLti, getName, getSession, setHint, setName, setSession, type Session } from '../lib/storage';

export function Play() {
  const { tr } = useLang();
  const code = (useParams().code ?? '').toUpperCase();
  const [session, setSess] = useState<Session | null>(() => getSession(code));
  const { room, error } = useRoom(code);
  const now = useNow();
  useAutoAdvance(room, now, session?.hostToken);
  const isCeo = isCeoRoom(room);
  useCeoAutoAdvance(room && isCeo ? asCeo(room) : null, now, session?.hostToken);
  const isMd = isMdRoom(room);
  useMdAutoAdvance(room && isMd ? asMd(room) : null, now, session?.hostToken);
  const isRs = isRsRoom(room);
  useRsAutoAdvance(room && isRs ? asRs(room) : null, now, session?.hostToken);

  const screenKey = room ? `${room.status}:${room.qIndex}:${(room as unknown as { round?: number }).round ?? ''}` : '';
  useEffect(() => {
    if (screenKey) window.scrollTo({ top: 0 });
  }, [screenKey]);

  useEffect(() => {
    if (room && session?.playerId && !room.players[session.playerId]) {
      clearSession(code);
      setSess(null);
    }
  }, [room, session, code]);

  if (room === undefined) return <Shell><p className="card text-center text-ink/60">{tr('Opening room', 'Đang mở phòng')} {code}…</p></Shell>;
  if (room === null)
    return (
      <Shell>
        <div className="card space-y-3 text-center">
          <p className="text-lg font-bold">{tr('Room not found', 'Không tìm thấy phòng')} {code}</p>
          <p className="text-ink/60">{tr('Check the code on the lecturer’s screen.', 'Kiểm tra lại mã phòng trên màn hình của giảng viên.')}</p>
          <Link to="/" className="btn-dark">{tr('Home', 'Về trang chủ')}</Link>
        </div>
      </Shell>
    );
  if (!session?.playerId || !session.playerToken) return <JoinForm room={room} onJoined={(s) => { setSession(code, s); setSess(s); }} />;
  const me = room.players[session.playerId];
  if (!me) return null;
  if (isRs) {
    const c = asRs(room);
    const st = c.standings[session.playerId];
    return (
      <Shell right={<span className="max-w-[40vw] truncate text-sm text-white/80">{me.name}{st && c.history.length > 0 ? <> · #{st.rank} · <b className="text-amber">{st.score.toFixed(0)}</b></> : null}</span>}>
        <RsPlay room={c} session={session} now={now} />
      </Shell>
    );
  }
  if (isMd) {
    const m = asMd(room);
    const st = m.standings[session.playerId];
    return (
      <Shell right={<span className="max-w-[40vw] truncate text-sm text-white/80">{me.name}{st ? <> · #{st.rank} · <b className="text-amber">{st.total}</b></> : null}</span>}>
        <MdPlay room={m} session={session} now={now} />
      </Shell>
    );
  }
  if (isCeo) {
    const c = asCeo(room);
    const st = c.standings[session.playerId];
    return (
      <Shell right={<span className="max-w-[40vw] truncate text-sm text-white/80">{me.name}{st ? <> · #{st.rank}</> : null}</span>}>
        <CeoPlay room={c} session={session} now={now} />
      </Shell>
    );
  }
  return (
    <Shell right={<span className="max-w-[40vw] truncate text-sm text-white/80">{me.name} · <b className="text-amber">{me.score}</b></span>}>
      <ErrorNote err={error ? { en: 'Lost connection to the room. Retrying…', vi: 'Mất kết nối tới phòng. Đang thử lại…' } : null} />
      {room.status === 'lobby' && <Lobby room={room} session={session} />}
      {room.status === 'question' && <QuestionScreen key={room.qIndex} room={room} session={session} now={now} />}
      {room.status === 'reveal' && <RevealScreen room={room} session={session} now={now} />}
      {room.status === 'finished' && <FinalScreen room={room} session={session} />}
    </Shell>
  );
}

function JoinForm({ room, onJoined }: { room: RoomDoc; onJoined: (s: Session) => void }) {
  const { t, tr } = useLang();
  const lti = getLti();
  const moodle = lti?.role === 'learner' ? lti : null;
  const [name, setNameState] = useState(moodle ? moodle.name : getName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);
  const full = room.order.length >= MAX_SEATS;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setName(name.trim());
      const r = await api.join(room.code, name.trim(), moodle?.session);
      onJoined({ playerId: r.playerId, playerToken: r.playerToken });
    } catch (err) {
      setError(errOf(err, { en: 'Could not join.', vi: 'Không vào được phòng.' }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <MoodleBanner lti={moodle} role="learner" />
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <p className="text-sm text-ink/60">{tr('Room', 'Phòng')} {room.code}</p>
          <h1 className="text-2xl font-extrabold">{room.title}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {t(gameName(room.game))} · {room.order.length}/{MAX_SEATS} {tr('players', 'người')} ·{' '}
            {room.status === 'lobby' ? tr('waiting to start', 'đang chờ bắt đầu') : room.status === 'finished' ? tr('finished', 'đã kết thúc') : isCeoRoom(room) || isMdRoom(room) || isRsRoom(room) ? tr('in play', 'đang chơi') : tr('in play (you can still join)', 'đang chơi (vẫn vào được)')}
          </p>
        </div>
        {room.status === 'finished' || full ? (
          <p className="rounded-xl bg-ink/5 p-3 text-center font-medium">{full ? tr('The room is full.', 'Phòng đã đủ 6 người.') : tr('This room has finished.', 'Phòng đã kết thúc.')}</p>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="pname">{tr('Display name', 'Tên hiển thị')}</label>
              <input id="pname" className="input text-lg" autoFocus maxLength={24} value={name} onChange={(e) => setNameState(e.target.value)} placeholder={tr('Your name', 'Tên của bạn')} />
            </div>
            <ErrorNote err={error} />
            <button className="btn-primary w-full text-lg" disabled={busy || !name.trim()}>{tr('Join room', 'Vào phòng')}</button>
          </>
        )}
      </form>
    </Shell>
  );
}

function Lobby({ room, session }: { room: RoomDoc; session: Session }) {
  const { t, tr } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);
  const isHost = Boolean(session.hostToken);
  const free = MAX_SEATS - room.order.length;
  async function start() {
    setBusy(true);
    setError(null);
    try {
      await api.start(room.code, session.hostToken!);
    } catch (err) {
      setError(errOf(err, { en: 'Could not start.', vi: 'Không bắt đầu được.' }));
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="card text-center">
        <p className="text-sm text-ink/60">{t(gameName(room.game))} · {room.title}</p>
        <p className="mt-1 text-4xl font-extrabold tracking-[0.25em]">{room.code}</p>
        {isHost && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <Qr text={joinUrl(room.code)} size={170} />
            <p className="text-sm text-ink/60">{tr('Friends scan the code or enter it on the home page.', 'Bạn bè quét mã hoặc vào trang chủ, nhập mã phòng.')}</p>
          </div>
        )}
      </div>
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Players', 'Người chơi')} ({room.order.length}/{MAX_SEATS})</h2>
        <ul className="grid gap-1.5">
          {room.order.map((id) => (
            <li key={id} className={`flex items-center justify-between rounded-xl px-3 py-2 ring-1 ${id === session.playerId ? 'bg-amber/20 ring-amber' : 'ring-ink/10'}`}>
              <PlayerName p={room.players[id]!} />
              {isHost && id !== session.playerId && (
                <button type="button" className="text-sm text-bad" onClick={() => void api.kick(room.code, session.hostToken!, id)}>{tr('Remove', 'Xóa')}</button>
              )}
            </li>
          ))}
        </ul>
        {room.settings.fillBots && free > 0 && <p className="mt-2 text-sm text-ink/60">{tr(`On start, ${free} empty seat(s) are played by AI (${BOT_LEVEL_LABEL[room.settings.botLevel].en}).`, `Khi bắt đầu, ${free} ghế trống sẽ do máy chơi (mức ${BOT_LEVEL_LABEL[room.settings.botLevel].vi}).`)}</p>}
      </div>
      {isHost ? (
        <>
          <ErrorNote err={error} />
          <button type="button" className="btn-primary w-full text-lg" disabled={busy} onClick={start}>{tr(`Start (${room.settings.questionCount} questions)`, `Bắt đầu (${room.settings.questionCount} câu)`)}</button>
        </>
      ) : (
        <p className="card text-center font-medium text-ink/70">⏳ {room.hostPlays ? tr('Waiting for the host…', 'Chờ chủ phòng bắt đầu…') : tr('Waiting for the lecturer…', 'Chờ giảng viên bắt đầu…')}</p>
      )}
    </div>
  );
}

function QuestionScreen({ room, session, now }: { room: RoomDoc; session: Session; now: number }) {
  const { tr } = useLang();
  const cur = room.current!;
  const q = cur.q;
  const me = room.players[session.playerId!]!;
  const [sent, setSent] = useState(Boolean(room.answered[session.playerId!]));
  const [error, setError] = useState<T | null>(null);
  const [hint, setHintState] = useState<HintPayload | null>(() => getHint(room.code, room.qIndex));
  const [hintBusy, setHintBusy] = useState(false);
  const [confirmHint, setConfirmHint] = useState(false);
  const answered = sent || Boolean(room.answered[session.playerId!]);
  const waiting = now < cur.openedAt;
  const timeUp = now > cur.deadline;
  const count = answeredCount(room, now);

  async function submit(input: AnswerInput) {
    if (answered) return;
    setSent(true);
    setError(null);
    try {
      await api.answer(room.code, session.playerId!, session.playerToken!, room.qIndex, input);
    } catch (err) {
      const e = errOf(err, { en: 'Could not send.', vi: 'Không gửi được.' });
      if (!/already answered/.test(e.en)) {
        setError(e);
        if (!/Time is up|closed|moved/.test(e.en)) setSent(false);
      }
    }
  }
  async function askHint() {
    if (hintBusy || hint) return;
    if (!confirmHint) return setConfirmHint(true);
    setConfirmHint(false);
    setHintBusy(true);
    try {
      const r = await api.hint(room.code, session.playerId!, session.playerToken!, room.qIndex);
      setHint(room.code, room.qIndex, r.hint);
      setHintState(r.hint);
    } catch (err) {
      setError(errOf(err, { en: 'Verify is not available.', vi: 'Không dùng được Kiểm chứng.' }));
    } finally {
      setHintBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink/60">{tr('Q', 'Câu')} {room.qIndex + 1}/{room.qTotal}</span>
        <CategoryChip category={q.category} />
        {me.streak >= 2 ? <span className="text-sm font-bold text-orange-600">🔥 {me.streak}</span> : <span className="w-8" />}
      </div>
      {waiting ? <div className="rounded-xl bg-ink px-4 py-2 text-center font-bold text-amber">{tr('Get ready…', 'Chuẩn bị…')} {Math.ceil((cur.openedAt - now) / 1000)}</div> : <TimerBar openedAt={cur.openedAt} deadline={cur.deadline} now={now} />}
      <div className="card space-y-4">
        <QuestionHeader q={q} />
        {answered ? (
          <div className="pop rounded-xl bg-ok/10 p-4 text-center">
            <p className="text-lg font-bold text-ok">✓ {tr('Answer sent', 'Đã gửi câu trả lời')}</p>
            <p className="text-sm text-ink/60">{count.done}/{count.total} {tr('answered · waiting for the result…', 'người đã trả lời · chờ đáp án…')}</p>
          </div>
        ) : timeUp ? (
          <p className="rounded-xl bg-ink/5 p-4 text-center font-bold">⏰ {tr('Time is up', 'Hết giờ')}</p>
        ) : (
          <AnswerArea q={q} disabled={waiting} hint={hint} onSubmit={submit} />
        )}
        <ErrorNote err={error} />
      </div>
      {!answered && !timeUp && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-ink/60">{count.done}/{count.total} {tr('answered', 'đã trả lời')}</span>
          {confirmHint ? (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-ink/60">{tr('Worth ½ points', 'Câu này còn ½ điểm')}</span>
              <button type="button" className="btn-dark px-3 py-1.5 text-sm" onClick={askHint}>{tr('Use', 'Dùng')}</button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setConfirmHint(false)}>{tr('Cancel', 'Thôi')}</button>
            </span>
          ) : (
            <button type="button" className="btn-ghost text-sm" disabled={waiting || hintBusy || Boolean(hint) || me.hintsLeft <= 0} onClick={askHint}>
              🔍 {tr('Verify', 'Kiểm chứng')} ({me.hintsLeft})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RevealScreen({ room, session, now }: { room: RoomDoc; session: Session; now: number }) {
  const { t, tr } = useLang();
  const reveal = room.reveal!;
  const q = room.current!.q;
  const mine = reveal.results[session.playerId!];
  const isHost = Boolean(session.hostToken);
  const [busy, setBusy] = useState(false);
  const last = room.qIndex + 1 >= room.qTotal;
  let title = tr('⏰ Time up – no answer', '⏰ Hết giờ – chưa trả lời');
  let tone = 'bg-ink/5';
  if (mine?.answered) {
    if (mine.fraction >= 1) [title, tone] = [tr('🎉 Correct!', '🎉 Chính xác!'), 'bg-ok/15 text-ok'];
    else if (mine.fraction > 0) [title, tone] = [tr('👍 Partly right', '👍 Đúng một phần'), 'bg-amber/25'];
    else [title, tone] = [tr('✗ Not quite', '✗ Chưa đúng'), 'bg-bad/10 text-bad'];
  }
  const autoLeft = room.settings.autoNextSec > 0 ? Math.max(0, Math.ceil((reveal.revealedAt + room.settings.autoNextSec * 1000 - now) / 1000)) : null;
  const rank = rankPlayers(room).findIndex((p) => p.id === session.playerId) + 1;
  async function next() {
    setBusy(true);
    try {
      await api.advance(room.code, { hostToken: session.hostToken!, expectStatus: 'reveal', expectQIndex: room.qIndex });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className={`pop flex items-center justify-between rounded-2xl px-4 py-3 ${tone}`}>
        <span className="text-xl font-extrabold">{title}</span>
        <span className="text-2xl font-extrabold tabular-nums">{mine ? (mine.points > 0 ? `+${mine.points}` : mine.points) : 0}</span>
      </div>
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink/60">{tr('Q', 'Câu')} {room.qIndex + 1}/{room.qTotal}</span>
          <CategoryChip category={q.category} />
        </div>
        <p className="font-bold">{t(q.prompt)}</p>
        <AnswerReview q={q} answerKey={reveal.key} {...(mine?.input ? { mine: mine.input } : {})} {...(reveal.distribution ? { distribution: reveal.distribution } : {})} />
        <div className="rounded-xl bg-amber/15 p-3 text-[15px] leading-relaxed">
          <b>{tr('Why:', 'Vì sao:')}</b> {t(reveal.explanation)}
          {reveal.source.en && <p className="mt-1 text-xs text-ink/50">{t(reveal.source)}</p>}
        </div>
      </div>
      <div className="card">
        <h2 className="mb-2 font-bold">{tr(`Leaderboard · you are #${rank}`, `Bảng xếp hạng · bạn đứng thứ ${rank}`)}</h2>
        <Leaderboard room={room} me={session.playerId!} reveal={reveal} />
      </div>
      {isHost ? (
        <button type="button" className="btn-primary sticky bottom-3 w-full text-lg shadow-lg" disabled={busy} onClick={next}>
          {last ? tr('Final results', 'Xem kết quả chung cuộc') : tr('Next question →', 'Câu tiếp →')} {autoLeft !== null ? `(${autoLeft}s)` : ''}
        </button>
      ) : (
        <p className="text-center text-sm text-ink/60">
          {autoLeft !== null ? tr(`${last ? 'Final results' : 'Next question'} in ${autoLeft}s…`, `${last ? 'Kết quả chung cuộc' : 'Câu tiếp'} sau ${autoLeft}s…`) : room.hostPlays ? tr('Waiting for the host…', 'Chờ chủ phòng chuyển câu…') : tr('Waiting for the lecturer…', 'Chờ giảng viên chuyển câu…')}
        </p>
      )}
    </div>
  );
}

/** A title from how the player played: everyone learns where they are strong. */
function badgeOf(room: RoomDoc, id: string): { en: string; vi: string } | null {
  const p = room.players[id]!;
  const stats = Object.entries(p.stats).filter(([, s]) => s && s.n > 0) as [string, { n: number; ok: number }][];
  if (p.bestStreak >= 5) return { en: '🔥 Streak master', vi: '🔥 Vua chuỗi đúng' };
  const best = stats.sort((a, b) => b[1].ok / b[1].n - a[1].ok / a[1].n || b[1].n - a[1].n)[0];
  if (!best || best[1].ok === 0) return null;
  const names: Record<string, { en: string; vi: string }> = {
    bottleneck: { en: '🎯 Bottleneck hunter', vi: '🎯 Thợ săn nút thắt' },
    calc: { en: '🧮 Human calculator', vi: '🧮 Máy tính sống' },
    lever: { en: '⚖️ Lever strategist', vi: '⚖️ Chiến lược gia đòn bẩy' },
    goodhart: { en: '🛡️ KPI guardian', vi: '🛡️ Người gác KPI' },
    pair: { en: '🔗 Pair reader', vi: '🔗 Người đọc cặp KPI' },
    ceo: { en: '👔 Calm CEO', vi: '👔 CEO bình tĩnh' },
  };
  return names[best[0]] ?? null;
}

function FinalScreen({ room, session }: { room: RoomDoc; session: Session }) {
  const { tr } = useLang();
  const nav = useNavigate();
  const list = rankPlayers(room);
  const me = room.players[session.playerId!]!;
  const rank = list.findIndex((p) => p.id === me.id) + 1;
  const [busy, setBusy] = useState(false);
  const soloHost = Boolean(session.hostToken) && humansOf(room).length === 1;
  const played = Math.max(1, room.qIndex + 1);
  const badge = badgeOf(room, me.id);
  async function again() {
    setBusy(true);
    try {
      const lti = getLti();
      const r = await api.createRoom({ hostPlays: true, hostName: me.name, game: 'unit-economics', settings: room.settings, ...(me.lms && lti?.role === 'learner' ? { ltiSession: lti.session } : {}) });
      setSession(r.code, { playerId: r.playerId!, playerToken: r.playerToken!, hostToken: r.hostToken });
      await api.start(r.code, r.hostToken);
      nav(`/p/${r.code}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="pop card text-center">
        <p className="text-5xl">{rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎯'}</p>
        <p className="mt-2 text-2xl font-extrabold">{tr(`Rank ${rank}/${list.length}`, `Hạng ${rank}/${list.length}`)}</p>
        <p className="text-ink/60">{tr(`${me.score} points · ${me.correct}/${played} right · best streak ${me.bestStreak}`, `${me.score} điểm · đúng ${me.correct}/${played} câu · chuỗi dài nhất ${me.bestStreak}`)}</p>
        {badge && <p className="mt-2 inline-block rounded-full bg-amber/25 px-3 py-1 text-sm font-bold">{tr(badge.en, badge.vi)}</p>}
      </div>
      {me.lms && (
        <div className={`card text-center text-sm font-medium ${room.lmsStatus?.[me.id] === 'error' ? 'text-bad' : 'text-ok'}`}>
          {room.lmsStatus?.[me.id] === 'sent'
            ? tr(`✓ Grade ${Math.round((me.correct / played) * 1000) / 10}/100 sent to the Moodle gradebook (best attempt counts).`, `✓ Đã gửi điểm ${Math.round((me.correct / played) * 1000) / 10}/100 về Sổ điểm Moodle (lấy lần cao nhất).`)
            : room.lmsStatus?.[me.id] === 'error'
              ? tr('The grade could not be sent to Moodle. Tell your lecturer.', 'Chưa gửi được điểm về Moodle. Báo giảng viên để kiểm tra.')
              : tr('Sending your grade to Moodle…', 'Đang gửi điểm về Moodle…')}
        </div>
      )}
      <div className="card">
        <h2 className="mb-3 font-bold">{tr('Your strengths and gaps', 'Điểm mạnh, điểm yếu của bạn')}</h2>
        <CategoryStats p={me} />
      </div>
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Final leaderboard', 'Bảng xếp hạng chung cuộc')}</h2>
        <Leaderboard room={room} me={me.id} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {soloHost && <button type="button" className="btn-primary" disabled={busy} onClick={again}>{tr('Play again (new numbers)', 'Chơi lại (số liệu mới)')}</button>}
        <Link to="/" className="btn-ghost">{tr('Home', 'Về trang chủ')}</Link>
      </div>
    </div>
  );
}
