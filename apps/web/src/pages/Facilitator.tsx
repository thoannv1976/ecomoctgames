import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BOT_LEVEL_LABEL, CATEGORIES, CATEGORY_LABEL, MAX_SEATS, type BotLevel, type Category, type GameId, type RoomDoc, type T } from '@arena/types';
import { ErrorNote, MoodleBanner, Shell, downloadText, gameName, joinUrl, resultsCsv, statusLabel } from '../components/common';
import { api } from '../lib/api';
import { humansOf, rankPlayers, useAutoAdvance, useNow, useRoom } from '../lib/hooks';
import { errOf, useLang } from '../lib/i18n';
import { getHostedRooms, getLti, setHostedRooms, type HostedRoom } from '../lib/storage';
import { GamePicker, READY } from './Home';
import { asCeo, isCeoRoom, rankedIds as ceoRanked, useCeoAutoAdvance } from '../ceo/parts';
import { ROUNDS } from '@arena/ceo';
import { asMd, isMdRoom, rankedIds as mdRanked, useMdAutoAdvance } from '../md/parts';

export function Facilitator() {
  const { t, tr } = useLang();
  const lti = getLti();
  const [rooms, setRooms] = useState<HostedRoom[]>(getHostedRooms);
  const [game, setGame] = useState<GameId>((lti?.activity && READY.includes(lti.activity as GameId) ? lti.activity : 'unit-economics') as GameId);
  const [snapshots, setSnapshots] = useState<Record<string, RoomDoc>>({});
  const [count, setCount] = useState(6);
  const [prefix, setPrefix] = useState('Team');
  const [questions, setQuestions] = useState(15);
  const [level, setLevel] = useState<BotLevel>('medium');
  const [fillBots, setFillBots] = useState(true);
  const [autoNext, setAutoNext] = useState(12);
  const [decideMin, setDecideMin] = useState(6);
  const [caseMin, setCaseMin] = useState(7);
  const [resultsSec, setResultsSec] = useState(0);
  const [cats, setCats] = useState<Category[]>(CATEGORIES.slice());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);

  useEffect(() => setHostedRooms(rooms), [rooms]);
  const onSnapshot = useCallback((r: RoomDoc) => setSnapshots((s) => (s[r.code]?.version === r.version ? s : { ...s, [r.code]: r })), []);

  async function createRooms(n: number, title?: string) {
    setBusy(true);
    setError(null);
    try {
      const made: HostedRoom[] = [];
      const start = rooms.length + 1;
      for (let i = 0; i < n; i++) {
        const name = title ?? `${prefix.trim() || 'Room'} ${start + i}`;
        const r =
          game === 'ceo-sim'
            ? await api.createRoom({ game, hostPlays: false, title: name, settings: { decideSec: decideMin * 60, resultsSec, botLevel: level, fillBots: title ? false : fillBots } })
            : game === 'market-detective'
              ? await api.createRoom({ game, hostPlays: false, title: name, settings: { caseSec: caseMin * 60, resultsSec, botLevel: level, fillBots: title ? false : fillBots } })
            : await api.createRoom({ game, hostPlays: false, title: name, settings: { questionCount: questions, botLevel: level, fillBots: title ? false : fillBots, autoNextSec: autoNext, categories: cats } });
        made.push({ code: r.code, hostToken: r.hostToken, title: name, createdAt: Date.now() });
      }
      setRooms((old) => [...old, ...made]);
    } catch (err) {
      setError(errOf(err, { en: 'Could not create rooms.', vi: 'Không tạo được phòng.' }));
    } finally {
      setBusy(false);
    }
  }

  const live = rooms.map((r) => snapshots[r.code]).filter((r): r is RoomDoc => Boolean(r));
  const waiting = rooms.filter((r) => {
    const s = snapshots[r.code];
    return s?.status === 'lobby' && humansOf(s).length > 0;
  });
  // Class-wide board: every student in every room, by points.
  const board = live
    .filter((room) => !isCeoRoom(room) && !isMdRoom(room))
    .flatMap((room) => room.order.map((id) => ({ room, p: room.players[id]! })))
    .filter((x) => x.p && !x.p.bot && x.room.status !== 'lobby')
    .sort((a, b) => b.p.score - a.p.score || b.p.correct - a.p.correct);

  async function startAll() {
    setError(null);
    const results = await Promise.allSettled(waiting.map((r) => api.start(r.code, r.hostToken)));
    const failed = results.filter((x) => x.status === 'rejected').length;
    if (failed) setError({ en: `${failed} room(s) could not start.`, vi: `${failed} phòng chưa bắt đầu được.` });
  }

  return (
    <Shell wide right={<Link to="/" className="truncate text-sm text-white/80 hover:text-white">{tr('Student page', 'Trang sinh viên')}</Link>}>
      <MoodleBanner lti={lti?.role === 'instructor' ? lti : null} role="instructor" />
      <h1 className="mb-1 text-2xl font-extrabold">{tr('Lecturer dashboard · ECOM Arena', 'Bảng điều khiển giảng viên · ECOM Arena')}</h1>
      <p className="mb-3 text-ink/60">{tr('Create several 6-seat rooms, project the codes, follow every room at once, run a final and export results.', 'Tạo nhiều phòng 6 người, chiếu mã phòng, theo dõi mọi phòng cùng lúc, tổ chức chung kết và xuất kết quả.')}</p>
      <div className="mb-4">
        <GamePicker game={game} setGame={setGame} />
      </div>

      <section className="card mb-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cnt">{tr('Rooms to create', 'Số phòng tạo thêm')}</label>
            <input id="cnt" type="number" min={1} max={10} className="input" value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <label className="label" htmlFor="pre">{tr('Room name', 'Tên phòng')}</label>
            <input id="pre" className="input" value={prefix} maxLength={30} onChange={(e) => setPrefix(e.target.value)} />
          </div>
          {game === 'market-detective' ? (
            <>
              <div>
                <label className="label" htmlFor="cm">{tr('Minutes per case', 'Số phút mỗi vụ')}</label>
                <select id="cm" className="input" value={caseMin} onChange={(e) => setCaseMin(Number(e.target.value))}>
                  {[5, 6, 7, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="rsm">{tr('Next case', 'Sang vụ mới')}</label>
                <select id="rsm" className="input" value={resultsSec} onChange={(e) => setResultsSec(Number(e.target.value))}>
                  <option value={0}>{tr('Lecturer clicks', 'Giảng viên bấm')}</option>
                  {[60, 90, 120].map((n) => <option key={n} value={n}>{tr(`Auto after ${n}s`, `Tự động sau ${n} giây`)}</option>)}
                </select>
              </div>
            </>
          ) : game === 'ceo-sim' ? (
            <>
              <div>
                <label className="label" htmlFor="dm">{tr('Minutes per quarter', 'Số phút mỗi quý')}</label>
                <select id="dm" className="input" value={decideMin} onChange={(e) => setDecideMin(Number(e.target.value))}>
                  {[4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="rsx">{tr('Next quarter', 'Sang quý mới')}</label>
                <select id="rsx" className="input" value={resultsSec} onChange={(e) => setResultsSec(Number(e.target.value))}>
                  <option value={0}>{tr('Lecturer clicks', 'Giảng viên bấm')}</option>
                  {[60, 90, 120].map((n) => <option key={n} value={n}>{tr(`Auto after ${n}s`, `Tự động sau ${n} giây`)}</option>)}
                </select>
              </div>
            </>
          ) : (<>
          <div>
            <label className="label" htmlFor="qn">{tr('Questions', 'Số câu')}</label>
            <select id="qn" className="input" value={questions} onChange={(e) => setQuestions(Number(e.target.value))}>
              {[10, 12, 15, 20, 25].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="auto">{tr('Next question', 'Chuyển câu')}</label>
            <select id="auto" className="input" value={autoNext} onChange={(e) => setAutoNext(Number(e.target.value))}>
              <option value={0}>{tr('Lecturer clicks', 'Giảng viên bấm')}</option>
              {[8, 12, 15, 20].map((n) => <option key={n} value={n}>{tr(`Auto after ${n}s`, `Tự động sau ${n} giây`)}</option>)}
            </select>
          </div>
          </>)}
        </div>
        <div className="space-y-3">
          <div>
            <span className="label">{tr('AI in empty seats', 'Máy chơi thay ghế trống')}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={fillBots} onChange={(e) => setFillBots(e.target.checked)} /> {tr(`Fill to ${MAX_SEATS} seats`, `Điền đủ ${MAX_SEATS} ghế`)}
              </label>
              {(Object.keys(BOT_LEVEL_LABEL) as BotLevel[]).map((l) => (
                <button key={l} type="button" disabled={!fillBots} onClick={() => setLevel(l)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 disabled:opacity-40 ${level === l ? 'bg-ink text-white ring-ink' : 'ring-ink/15'}`}>
                  {t(BOT_LEVEL_LABEL[l])}
                </button>
              ))}
            </div>
          </div>
          {game === 'unit-economics' && <div>
            <span className="label">{tr('Question types', 'Dạng câu')}</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const on = cats.includes(c);
                return (
                  <button key={c} type="button" onClick={() => setCats((x) => (on ? (x.length > 1 ? x.filter((y) => y !== c) : x) : [...x, c]))} className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${on ? 'bg-ink text-white ring-ink' : 'text-ink/60 ring-ink/15'}`}>
                    {t(CATEGORY_LABEL[c])}
                  </button>
                );
              })}
            </div>
          </div>}
        </div>
        <div className="flex flex-col justify-end gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => createRooms(count)}>{busy ? tr('Creating…', 'Đang tạo…') : tr(`+ Create ${count} room${count > 1 ? 's' : ''}`, `+ Tạo ${count} phòng`)}</button>
          <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => createRooms(1, tr('🏆 Final', '🏆 Chung kết'))}>{tr('+ Final room (no AI)', '+ Phòng chung kết (không máy)')}</button>
        </div>
      </section>

      <ErrorNote err={error} />

      {rooms.length > 0 && (
        <div className="my-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-dark" disabled={!waiting.length} onClick={startAll}>▶ {tr(`Start ${waiting.length} waiting room(s)`, `Bắt đầu ${waiting.length} phòng đang chờ`)}</button>
          <button type="button" className="btn-ghost" disabled={!live.length} onClick={() => downloadText(`ecom-arena-results-${new Date().toISOString().slice(0, 10)}.csv`, resultsCsv(live.filter((r) => !isCeoRoom(r) && !isMdRoom(r))))}>
            ⬇ {tr('Export results (Excel/CSV)', 'Xuất kết quả (Excel/CSV)')}
          </button>
          <button type="button" className="btn-ghost text-bad" onClick={() => window.confirm(tr('Remove all rooms from this list? (Rooms stay for 3 days.)', 'Bỏ tất cả phòng khỏi danh sách này? (Phòng vẫn tồn tại 3 ngày.)')) && setRooms([])}>
            {tr('Clear list', 'Xóa danh sách')}
          </button>
        </div>
      )}

      {board.length > 0 && (
        <section className="card mb-5">
          <h2 className="mb-2 text-lg font-bold">🏅 {tr('Class leaderboard (all rooms)', 'Bảng vàng toàn lớp (mọi phòng)')}</h2>
          <ol className="grid gap-1 sm:grid-cols-2">
            {board.slice(0, 12).map(({ room, p }, i) => (
              <li key={`${room.code}:${p.id}`} className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-1.5 text-sm">
                <span className="truncate">
                  <b>{i + 1}.</b> {p.name} <span className="text-ink/50">· {room.title}</span>
                </span>
                <b className="tabular-nums">{p.score}</b>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-ink/50">{tr('Tip: send the top student of each room to a Final room.', 'Gợi ý: mời người đứng đầu mỗi phòng vào Phòng chung kết.')}</p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <RoomCard key={r.code} hosted={r} onSnapshot={onSnapshot} onRemove={() => setRooms((x) => x.filter((y) => y.code !== r.code))} />
        ))}
      </div>
      {rooms.length === 0 && <p className="card text-center text-ink/60">{tr('No rooms yet. A class of 36: create 6 rooms of 6.', 'Chưa có phòng nào. Lớp 36 người: tạo 6 phòng, mỗi phòng 6 người.')}</p>}
    </Shell>
  );
}

function RoomCard({ hosted, onSnapshot, onRemove }: { hosted: HostedRoom; onSnapshot: (r: RoomDoc) => void; onRemove: () => void }) {
  const { t, tr } = useLang();
  const { room } = useRoom(hosted.code);
  const now = useNow(500);
  useAutoAdvance(room, now, hosted.hostToken);
  const isCeo = isCeoRoom(room);
  useCeoAutoAdvance(room && isCeo ? asCeo(room) : null, now, hosted.hostToken);
  const isMd = isMdRoom(room);
  useMdAutoAdvance(room && isMd ? asMd(room) : null, now, hosted.hostToken);
  const [error, setError] = useState<T | null>(null);
  useEffect(() => {
    if (room) onSnapshot(room);
  }, [room, onSnapshot]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errOf(err, { en: 'Error', vi: 'Lỗi' }));
    }
  }

  if (room === undefined) return <div className="card text-ink/50">{tr('Loading', 'Đang tải')} {hosted.code}…</div>;
  if (room === null)
    return (
      <div className="card flex items-center justify-between text-ink/50">
        <span>{hosted.title} · {hosted.code} ({tr('expired', 'đã hết hạn')})</span>
        <button type="button" className="text-sm" onClick={onRemove}>{tr('Remove', 'Bỏ')}</button>
      </div>
    );
  const humans = humansOf(room).length;
  if (isMd) {
    const c = asMd(room);
    return (
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold">{c.title} <span className="text-xs font-normal text-ink/50">· Market Detective</span></p>
            <p className="text-3xl font-extrabold tracking-[0.2em]">{c.code}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === 'lobby' ? 'bg-amber/25' : c.status === 'finished' ? 'bg-ink/10' : 'bg-ok/15 text-ok'}`}>
            {c.status === 'lobby' ? tr('Waiting', 'Đang chờ') : c.status === 'finished' ? tr('Finished', 'Đã kết thúc') : `${tr('Case', 'Vụ')} ${c.round}/${c.rounds} · ${c.status === 'decide' ? tr('researching', 'nghiên cứu') : tr('results', 'kết quả')}`}
          </span>
        </div>
        <p className="text-sm text-ink/60">👥 {humans} {tr('students', 'sinh viên')} · {c.settings.caseSec ? tr(`${Math.round(c.settings.caseSec / 60)} min/case`, `${Math.round(c.settings.caseSec / 60)} phút/vụ`) : tr('no limit', 'không giới hạn')}</p>
        {c.status === 'lobby' ? (
          <p className="min-h-[3rem] text-sm">{c.order.map((id) => c.players[id]?.name).join(', ') || <span className="text-ink/40">{tr('Nobody yet…', 'Chưa có ai vào…')}</span>}</p>
        ) : (
          <ol className="min-h-[3rem] space-y-0.5 text-sm">
            {mdRanked(c).slice(0, 3).map((id) => (
              <li key={id} className="flex justify-between"><span className="truncate">{c.standings[id]?.rank ?? '–'}. {c.players[id]?.bot ? '🤖 ' : ''}{c.players[id]?.name}</span><b className="tabular-nums">{c.standings[id]?.total ?? 0}</b></li>
            ))}
            {c.status === 'decide' && <li className="text-ink/60">{tr('Submitted', 'Đã nộp')}: {c.order.filter((id) => c.players[id]?.bot || c.submitted[id]).length}/{c.order.length} · 🎤 {c.interviews.length}/2</li>}
          </ol>
        )}
        <ErrorNote err={error} />
        <div className="flex flex-wrap gap-2">
          {c.status === 'lobby' && <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={!humans} onClick={() => run(() => api.start(c.code, hosted.hostToken))}>▶ {tr('Start', 'Bắt đầu')}</button>}
          {c.status === 'decide' && c.deadline !== null && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => run(() => api.extend(c.code, hosted.hostToken))}>{tr('+1 min', '+1 phút')}</button>}
          {c.status === 'decide' && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => window.confirm(tr('Close this case now?', 'Đóng vụ này ngay?')) && run(() => api.advance(c.code, { hostToken: hosted.hostToken, expectStatus: 'decide', expectRound: c.round }))}>{tr('Close case', 'Đóng vụ')}</button>}
          {c.status === 'results' && <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => run(() => api.advance(c.code, { hostToken: hosted.hostToken, expectStatus: 'results', expectRound: c.round }))}>{tr('Next case →', 'Vụ tiếp →')}</button>}
          <a href={`/gv/${c.code}`} target="_blank" rel="noreferrer" className="btn-dark px-3 py-1.5 text-sm">🖥 {tr('Projector', 'Màn hình chiếu')}</a>
          {(c.status === 'decide' || c.status === 'results') && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => window.confirm(tr(`End ${c.title} now?`, `Kết thúc sớm ${c.title}?`)) && run(() => api.end(c.code, hosted.hostToken))}>{tr('End', 'Kết thúc')}</button>}
          <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => void navigator.clipboard?.writeText(joinUrl(c.code))}>📋 Link</button>
          {c.status === 'finished' && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={onRemove}>{tr('Remove from list', 'Bỏ khỏi danh sách')}</button>}
        </div>
      </div>
    );
  }
  if (isCeo) {
    const c = asCeo(room);
    return (
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold">{c.title} <span className="text-xs font-normal text-ink/50">· CEO Simulator</span></p>
            <p className="text-3xl font-extrabold tracking-[0.2em]">{c.code}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === 'lobby' ? 'bg-amber/25' : c.status === 'finished' ? 'bg-ink/10' : 'bg-ok/15 text-ok'}`}>
            {c.status === 'lobby' ? tr('Waiting', 'Đang chờ') : c.status === 'finished' ? tr('Finished', 'Đã kết thúc') : `Q${c.round}/${ROUNDS} · ${c.status === 'decide' ? tr('deciding', 'quyết định') : tr('results', 'kết quả')}`}
          </span>
        </div>
        <p className="text-sm text-ink/60">👥 {humans} {tr('students', 'sinh viên')} · {c.settings.decideSec ? tr(`${Math.round(c.settings.decideSec / 60)} min/quarter`, `${Math.round(c.settings.decideSec / 60)} phút/quý`) : tr('no limit', 'không giới hạn')}</p>
        {c.status === 'lobby' ? (
          <p className="min-h-[3rem] text-sm">{c.order.map((id) => c.players[id]?.name).join(', ') || <span className="text-ink/40">{tr('Nobody yet…', 'Chưa có ai vào…')}</span>}</p>
        ) : (
          <ol className="min-h-[3rem] space-y-0.5 text-sm">
            {ceoRanked(c).slice(0, 3).map((id) => (
              <li key={id} className="flex justify-between"><span className="truncate">{c.standings[id]?.rank}. {c.players[id]?.bot ? '🤖 ' : ''}{c.players[id]?.name}</span><b className="tabular-nums">{c.standings[id]?.dashboard.toFixed(1)}</b></li>
            ))}
            {c.status === 'decide' && <li className="text-ink/60">{tr('Submitted', 'Đã nộp')}: {c.order.filter((id) => c.players[id]?.bot || c.submitted[id]).length}/{c.order.length}</li>}
          </ol>
        )}
        <ErrorNote err={error} />
        <div className="flex flex-wrap gap-2">
          {c.status === 'lobby' && <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={!humans} onClick={() => run(() => api.start(c.code, hosted.hostToken))}>▶ {tr('Start', 'Bắt đầu')}</button>}
          {c.status === 'decide' && c.deadline !== null && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => run(() => api.extend(c.code, hosted.hostToken))}>{tr('+1 min', '+1 phút')}</button>}
          {c.status === 'decide' && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => window.confirm(tr('Close this quarter now?', 'Chốt quý này ngay?')) && run(() => api.advance(c.code, { hostToken: hosted.hostToken, expectStatus: 'decide', expectRound: c.round }))}>{tr('Close quarter', 'Chốt quý')}</button>}
          {c.status === 'results' && <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => run(() => api.advance(c.code, { hostToken: hosted.hostToken, expectStatus: 'results', expectRound: c.round }))}>{tr('Next quarter →', 'Quý tiếp →')}</button>}
          <a href={`/gv/${c.code}`} target="_blank" rel="noreferrer" className="btn-dark px-3 py-1.5 text-sm">🖥 {tr('Projector', 'Màn hình chiếu')}</a>
          {(c.status === 'decide' || c.status === 'results') && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => window.confirm(tr(`End ${c.title} now?`, `Kết thúc sớm ${c.title}?`)) && run(() => api.end(c.code, hosted.hostToken))}>{tr('End', 'Kết thúc')}</button>}
          <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => void navigator.clipboard?.writeText(joinUrl(c.code))}>📋 Link</button>
          {c.status === 'finished' && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={onRemove}>{tr('Remove from list', 'Bỏ khỏi danh sách')}</button>}
        </div>
      </div>
    );
  }
  const top = rankPlayers(room).slice(0, 3);
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{room.title} <span className="text-xs font-normal text-ink/50">· {t(gameName(room.game))}</span></p>
          <p className="text-3xl font-extrabold tracking-[0.2em]">{room.code}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${room.status === 'lobby' ? 'bg-amber/25' : room.status === 'finished' ? 'bg-ink/10' : 'bg-ok/15 text-ok'}`}>{t(statusLabel(room))}</span>
      </div>
      <p className="text-sm text-ink/60">
        👥 {humans} {tr('students', 'sinh viên')}
        {room.status !== 'lobby' ? ` + ${room.order.length - humans} AI` : ''} · {room.settings.questionCount} {tr('questions', 'câu')} ·{' '}
        {room.settings.autoNextSec ? tr(`auto ${room.settings.autoNextSec}s`, `tự chuyển ${room.settings.autoNextSec}s`) : tr('lecturer clicks', 'GV bấm chuyển')}
      </p>
      {room.status === 'lobby' ? (
        <p className="min-h-[3rem] text-sm">{room.order.map((id) => room.players[id]?.name).join(', ') || <span className="text-ink/40">{tr('Nobody yet…', 'Chưa có ai vào…')}</span>}</p>
      ) : (
        <ol className="min-h-[3rem] space-y-0.5 text-sm">
          {top.map((p, i) => (
            <li key={p.id} className="flex justify-between">
              <span className="truncate">{i + 1}. {p.bot ? '🤖 ' : ''}{p.name}</span>
              <b className="tabular-nums">{p.score}</b>
            </li>
          ))}
        </ol>
      )}
      <ErrorNote err={error} />
      <div className="flex flex-wrap gap-2">
        {room.status === 'lobby' && <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={!humans} onClick={() => run(() => api.start(room.code, hosted.hostToken))}>▶ {tr('Start', 'Bắt đầu')}</button>}
        {room.status === 'reveal' && <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => run(() => api.advance(room.code, { hostToken: hosted.hostToken, expectStatus: 'reveal', expectQIndex: room.qIndex }))}>{tr('Next →', 'Câu tiếp →')}</button>}
        <a href={`/gv/${room.code}`} target="_blank" rel="noreferrer" className="btn-dark px-3 py-1.5 text-sm">🖥 {tr('Projector', 'Màn hình chiếu')}</a>
        {(room.status === 'question' || room.status === 'reveal') && (
          <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => window.confirm(tr(`End ${room.title} now?`, `Kết thúc sớm ${room.title}?`)) && run(() => api.end(room.code, hosted.hostToken))}>{tr('End', 'Kết thúc')}</button>
        )}
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" title={joinUrl(room.code)} onClick={() => void navigator.clipboard?.writeText(joinUrl(room.code))}>📋 {tr('Link', 'Link')}</button>
        {room.status === 'finished' && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={onRemove}>{tr('Remove from list', 'Bỏ khỏi danh sách')}</button>}
      </div>
    </div>
  );
}
