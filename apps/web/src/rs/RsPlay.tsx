// Player screens shared by the round-sim games: lobby → decide → results → … → final.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { BOT_LEVEL_LABEL, MAX_SEATS, type GameId, type T } from '@arena/types';
import { ErrorNote, Qr, joinUrl } from '../components/common';
import { api } from '../lib/api';
import { errOf, useLang } from '../lib/i18n';
import { getLti, setSession, type Session } from '../lib/storage';
import { Countdown, HistoryChart, RsStandings, ScoreBars, rankedIds, useRsMe, type RsWeb } from './parts';
import { rsWebOf } from './registry';

export function RsPlay({ room, session, now }: { room: RsRoomDoc; session: Session; now: number }) {
  const web = rsWebOf(room.game);
  const me = useRsMe(room, session.playerId, session.playerToken);
  if (!web) return null;
  if (room.status === 'lobby') return <Lobby room={room} session={session} web={web} />;
  if (room.status === 'decide') return <Decide key={room.round} room={room} session={session} now={now} me={me} web={web} />;
  if (room.status === 'results') return <Results room={room} session={session} me={me} web={web} now={now} />;
  return <Final room={room} session={session} me={me} web={web} />;
}

function Lobby({ room, session, web }: { room: RsRoomDoc; session: Session; web: RsWeb }) {
  const { t, tr } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);
  const isHost = Boolean(session.hostToken);
  const free = MAX_SEATS - room.order.length;
  return (
    <div className="space-y-4">
      <div className="card text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink/50">{web.tag}</p>
        <p className="text-sm text-ink/60">{room.title}</p>
        <p className="mt-1 text-4xl font-extrabold tracking-[0.25em]">{room.code}</p>
        {isHost && room.hostPlays && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <Qr text={joinUrl(room.code)} size={160} />
          </div>
        )}
      </div>
      <web.Briefing />
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Companies', 'Các công ty')} ({room.order.length}/{MAX_SEATS})</h2>
        <ul className="grid gap-1.5">
          {room.order.map((id) => (
            <li key={id} className={`rounded-xl px-3 py-2 ring-1 ${id === session.playerId ? 'bg-amber/20 ring-amber' : 'ring-ink/10'}`}>{room.players[id]!.name}</li>
          ))}
        </ul>
        {room.settings.fillBots && free > 0 && <p className="mt-2 text-sm text-ink/60">{tr(`On start, ${free} AI company(ies) join (${BOT_LEVEL_LABEL[room.settings.botLevel].en}).`, `Khi bắt đầu, ${free} công ty máy sẽ tham gia (mức ${BOT_LEVEL_LABEL[room.settings.botLevel].vi}).`)}</p>}
      </div>
      {isHost ? (
        <>
          <ErrorNote err={error} />
          <button
            type="button"
            className="btn-primary w-full text-lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.start(room.code, session.hostToken!);
              } catch (err) {
                setError(errOf(err, { en: 'Could not start.', vi: 'Không bắt đầu được.' }));
                setBusy(false);
              }
            }}
          >
            {tr(`Start ${room.rounds} ${web.roundWord.en.toLowerCase()}s`, `Bắt đầu ${room.rounds} ${web.roundWord.vi.toLowerCase()}`)}
          </button>
        </>
      ) : (
        <p className="card text-center font-medium text-ink/70">⏳ {room.hostPlays ? tr('Waiting for the host…', 'Chờ chủ phòng…') : tr('Waiting for the lecturer…', 'Chờ giảng viên…')}</p>
      )}
      <p className="text-center text-xs text-ink/40">{t(web.source)}</p>
    </div>
  );
}

function Decide({ room, session, now, me, web }: { room: RsRoomDoc; session: Session; now: number; me: RsMe | null; web: RsWeb }) {
  const { t, tr } = useLang();
  const pid = session.playerId!;
  const round = room.round;
  const [d, setD] = useState<unknown>(() => web.initial(null, round));
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  useEffect(() => {
    if (loaded || !me) return;
    setD(web.initial(me, round));
    if (me.pending) setSentAt(Date.now());
    setLoaded(true);
  }, [me, loaded, web, round]);
  const info = web.roundInfo(round);
  const problem = web.check(d, me, round);
  const submitted = room.order.filter((id) => room.players[id]?.bot || room.submitted[id]).length;
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.rsDecide(room.code, pid, session.playerToken!, round, JSON.parse(JSON.stringify(d)) as Record<string, unknown>);
      setSentAt(Date.now());
    } catch (err) {
      setError(errOf(err, { en: 'Could not submit.', vi: 'Không nộp được.' }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink/60">{t(web.roundWord)} {round}/{room.rounds}</p>
          <Countdown deadline={room.deadline} now={now} />
        </div>
        <h2 className="mt-1 text-xl font-extrabold">{t(info.title)}</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink/80">{t(info.text)}</p>
      </div>
      {round === 1 && <web.Briefing compact />}
      <web.Form room={room} me={me} d={d} set={(x: unknown) => { setD(x); }} round={round} />
      <div className="card space-y-2">
        <ErrorNote err={error ?? problem} />
        <button type="button" className="btn-primary w-full text-lg" disabled={busy || !!problem} onClick={submit}>
          {sentAt ? tr('Update my plan', 'Cập nhật kế hoạch') : tr('Submit my plan', 'Nộp kế hoạch')}
        </button>
        {sentAt && <p className="text-center text-sm font-medium text-ok">✓ {tr('Submitted – you can still change it until the round closes.', 'Đã nộp – vẫn sửa được đến khi vòng đóng.')}</p>}
        <p className="text-center text-xs text-ink/50">{submitted}/{room.order.length} {tr('companies ready', 'công ty đã sẵn sàng')}</p>
      </div>
    </div>
  );
}

function Results({ room, session, me, web, now }: { room: RsRoomDoc; session: Session; me: RsMe | null; web: RsWeb; now: number }) {
  const { t, tr } = useLang();
  const pid = session.playerId!;
  const report = me?.reports[me.reports.length - 1];
  const isHost = Boolean(session.hostToken);
  const [busy, setBusy] = useState(false);
  const auto = room.settings.resultsSec > 0 && room.revealedAt ? Math.max(0, Math.ceil((room.revealedAt + room.settings.resultsSec * 1000 - now) / 1000)) : null;
  return (
    <div className="space-y-4">
      <div className="card">
        <p className="text-sm font-semibold text-ink/60">{t(web.roundWord)} {room.round}/{room.rounds} · {tr('results', 'kết quả')}</p>
        <h2 className="text-xl font-extrabold">{t(web.roundInfo(room.round).title)}</h2>
        {room.news.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/80">
            {room.news.map((n, i) => <li key={i}>{t(n)}</li>)}
          </ul>
        )}
      </div>
      {report ? <web.Report report={report} room={room} /> : <p className="card text-center text-ink/60">{tr('Loading your results…', 'Đang tải kết quả…')}</p>}
      {web.Market && <div className="card"><web.Market room={room} me={pid} /></div>}
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Standings', 'Bảng xếp hạng')}</h2>
        <RsStandings room={room} web={web} me={pid} />
      </div>
      <div className="card"><HistoryChart room={room} web={web} me={pid} /></div>
      {isHost ? (
        <button type="button" className="btn-primary w-full text-lg" disabled={busy} onClick={async () => { setBusy(true); try { await api.advance(room.code, { hostToken: session.hostToken!, expectStatus: 'results', expectRound: room.round }); } finally { setBusy(false); } }}>
          {tr(`${web.roundWord.en} ${room.round + 1} →`, `Sang ${web.roundWord.vi.toLowerCase()} ${room.round + 1} →`)}
        </button>
      ) : (
        <p className="card text-center text-sm text-ink/60">⏳ {auto !== null ? tr(`Next round in ${auto}s`, `Vòng sau bắt đầu sau ${auto} giây`) : tr('The lecturer opens the next round.', 'Giảng viên sẽ mở vòng tiếp theo.')}</p>
      )}
    </div>
  );
}

function Final({ room, session, me, web }: { room: RsRoomDoc; session: Session; me: RsMe | null; web: RsWeb }) {
  const { t, tr } = useLang();
  const nav = useNavigate();
  const pid = session.playerId!;
  const st = room.standings[pid];
  const player = room.players[pid];
  const [busy, setBusy] = useState(false);
  const winner = rankedIds(room)[0];
  const last = me?.reports[me.reports.length - 1];
  async function again() {
    setBusy(true);
    try {
      const lti = getLti();
      const r = await api.createRoom({ game: room.game as GameId, hostPlays: true, hostName: player?.name ?? 'CEO', settings: room.settings, ...(player?.lms && lti?.role === 'learner' ? { ltiSession: lti.session } : {}) });
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
        <p className="text-5xl">{st?.rank === 1 ? '🏆' : st?.rank === 2 ? '🥈' : st?.rank === 3 ? '🥉' : '🏢'}</p>
        <p className="mt-2 text-2xl font-extrabold">{tr('Rank', 'Hạng')} {st?.rank ?? '–'}/{room.order.length}</p>
        <p className="text-ink/60">{tr('Scorecard', 'Thẻ mục tiêu')} {st?.score.toFixed(1)}/100{me?.grade != null ? <> · {tr('grade', 'điểm')} {me.grade}/100</> : null}</p>
        {winner && winner !== pid && <p className="mt-1 text-sm text-ink/60">{tr('Winner', 'Thắng cuộc')}: {room.players[winner]?.name}</p>}
      </div>
      {player?.lms && (
        <div className={`card text-center text-sm font-medium ${room.lmsStatus?.[pid] === 'error' ? 'text-bad' : 'text-ok'}`}>
          {room.lmsStatus?.[pid] === 'sent'
            ? tr(`✓ Grade ${me?.grade ?? ''}/100 sent to the Moodle gradebook (70% scorecard + 30% rank; best attempt counts).`, `✓ Đã gửi điểm ${me?.grade ?? ''}/100 về Sổ điểm Moodle (70% thẻ mục tiêu + 30% thứ hạng; lấy lần cao nhất).`)
            : room.lmsStatus?.[pid] === 'error'
              ? tr('The grade could not be sent to Moodle. Tell your lecturer.', 'Chưa gửi được điểm về Moodle. Báo giảng viên.')
              : tr('Sending your grade to Moodle…', 'Đang gửi điểm về Moodle…')}
        </div>
      )}
      {me && (
        <div className="card">
          <h2 className="mb-2 font-bold">{tr('Your scorecard', 'Thẻ mục tiêu của bạn')}</h2>
          <ScoreBars sc={me.scorecard} web={web} />
        </div>
      )}
      {me && me.badges.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-bold">{tr('Badges', 'Danh hiệu')}</h2>
          <div className="flex flex-wrap gap-2">
            {me.badges.map((b) => web.badges[b] && <span key={b} className="pop rounded-full bg-amber/20 px-3 py-1 text-sm font-semibold">{t(web.badges[b]!)}</span>)}
          </div>
        </div>
      )}
      {me && web.Reveal && <web.Reveal me={me} room={room} />}
      {last ? <web.Report report={last} room={room} /> : null}
      {web.Market && <div className="card"><web.Market room={room} me={pid} /></div>}
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Final standings', 'Bảng xếp hạng chung cuộc')}</h2>
        <RsStandings room={room} web={web} me={pid} />
        <div className="mt-3"><HistoryChart room={room} web={web} me={pid} /></div>
      </div>
      <div className="card text-[15px] leading-relaxed">
        <h2 className="mb-2 font-bold">{tr('What to remember', 'Điều cần nhớ')}</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {web.debrief.map(([en, vi]) => <li key={en}>{tr(en, vi)}</li>)}
        </ol>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={again}>{tr('Play again vs AI', 'Chơi lại với máy')}</button>
        <Link to="/" className="btn-ghost text-center">{tr('Home', 'Trang chủ')}</Link>
      </div>
    </div>
  );
}
