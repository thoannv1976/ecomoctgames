import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DECISIONS, DECISION_INFO, INTERVIEW_SLOTS, SOURCE_INFO, SOURCES, START_CREDITS, type MdDecision, type MdMe, type MdRoomDoc, type SourceId } from '@arena/md';
import { BOT_LEVEL_LABEL, MAX_SEATS, type T } from '@arena/types';
import { ErrorNote, Qr, joinUrl } from '../components/common';
import { api } from '../lib/api';
import { errOf, useLang } from '../lib/i18n';
import { getLti, setSession, type Session } from '../lib/storage';
import { AiErrors, CaseTable, Countdown, DecisionRule, MD_DEBRIEF, MdStandings, SourceBars, bn, rankedIds, useMdMe } from './parts';

export function MdPlay({ room, session, now }: { room: MdRoomDoc; session: Session; now: number }) {
  const [me, setMe] = useMdMe(room, session.playerId, session.playerToken);
  if (room.status === 'lobby') return <MdLobby room={room} session={session} />;
  if (room.status === 'decide') return <CaseScreen key={room.round} room={room} session={session} now={now} me={me} setMe={setMe} />;
  if (room.status === 'results') return <ResultsScreen room={room} session={session} now={now} />;
  return <FinalScreen room={room} session={session} me={me} />;
}

export function MdBriefing({ compact }: { compact?: boolean }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(!compact);
  return (
    <div className="card">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <h2 className="font-bold">🔎 {tr('How to play', 'Cách chơi')}</h2>
        <span className="text-sm text-ink/50">{open ? tr('Hide', 'Thu gọn') : tr('Show', 'Xem')}</span>
      </button>
      {open && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-ink/80">
          <li>{tr('3 cases. In each, a company asks: how big is this online market per month, and should we launch?', '3 vụ. Mỗi vụ, một doanh nghiệp hỏi: thị trường online này lớn bao nhiêu mỗi tháng, và có nên tung sản phẩm?')}</li>
          <li>{tr(`You have ${START_CREDITS} research credits per case. Buy data sources – each is biased in its own way (Recency, Relevance, Reliability, Sample, Bias).`, `Mỗi vụ bạn có ${START_CREDITS} điểm nghiên cứu để mua nguồn dữ liệu – mỗi nguồn lệch theo một kiểu riêng (Cập nhật, Liên quan, Tin cậy, Mẫu, Thiên lệch).`)}</li>
          <li>{tr(`Customer interviews are the best source, but only ${INTERVIEW_SLOTS} people per room can get them – be quick!`, `Phỏng vấn khách hàng là nguồn tốt nhất nhưng mỗi phòng chỉ ${INTERVIEW_SLOTS} người mua được – nhanh tay!`)}</li>
          <li>{tr('The AI report is cheap but has 1–2 planted errors. Flag the wrong statements: +5 each, −5 for a wrong flag.', 'Báo cáo AI rẻ nhưng có 1–2 lỗi cài sẵn. Đánh dấu nhận định sai: +5 mỗi lỗi, −5 nếu đánh dấu nhầm.')}</li>
          <li>{tr('Points per case: estimate within 10% = 50, right decision = 25, AI flags, credits left up to 15 (only if your estimate is within 50%).', 'Điểm mỗi vụ: ước tính sai dưới 10% = 50, quyết định đúng = 25, điểm bắt lỗi AI, điểm nghiên cứu còn thừa tối đa 15 (chỉ khi ước tính sai dưới 50%).')}</li>
        </ul>
      )}
    </div>
  );
}

function MdLobby({ room, session }: { room: MdRoomDoc; session: Session }) {
  const { tr } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);
  const isHost = Boolean(session.hostToken);
  const free = MAX_SEATS - room.order.length;
  return (
    <div className="space-y-4">
      <div className="card text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink/50">Game 4 · Market Detective</p>
        <p className="text-sm text-ink/60">{room.title}</p>
        <p className="mt-1 text-4xl font-extrabold tracking-[0.25em]">{room.code}</p>
        {isHost && room.hostPlays && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <Qr text={joinUrl(room.code)} size={160} />
          </div>
        )}
      </div>
      <MdBriefing />
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Detectives', 'Các thám tử')} ({room.order.length}/{MAX_SEATS})</h2>
        <ul className="grid gap-1.5">
          {room.order.map((id) => (
            <li key={id} className={`rounded-xl px-3 py-2 ring-1 ${id === session.playerId ? 'bg-amber/20 ring-amber' : 'ring-ink/10'}`}>{room.players[id]!.name}</li>
          ))}
        </ul>
        {room.settings.fillBots && free > 0 && <p className="mt-2 text-sm text-ink/60">{tr(`On start, ${free} AI detective(s) join (${BOT_LEVEL_LABEL[room.settings.botLevel].en}).`, `Khi bắt đầu, ${free} thám tử máy sẽ tham gia (mức ${BOT_LEVEL_LABEL[room.settings.botLevel].vi}).`)}</p>}
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
            {tr('Start 3 cases', 'Bắt đầu 3 vụ')}
          </button>
        </>
      ) : (
        <p className="card text-center font-medium text-ink/70">⏳ {room.hostPlays ? tr('Waiting for the host…', 'Chờ chủ phòng…') : tr('Waiting for the lecturer…', 'Chờ giảng viên…')}</p>
      )}
      <p className="text-center text-xs text-ink/40">{tr('Textbook Chapter 4: RRRSB source check, Table 4.20 AI research errors', 'Giáo trình Chương 4: tiêu chí RRRSB, bảng 4.20 lỗi khi nghiên cứu bằng AI')}</p>
    </div>
  );
}

function CaseScreen({ room, session, now, me, setMe }: { room: MdRoomDoc; session: Session; now: number; me: MdMe | null; setMe: (m: MdMe) => void }) {
  const { lang, t, tr } = useLang();
  const c = room.case!;
  const pid = session.playerId!;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<T | null>(null);
  const [estimate, setEstimate] = useState('');
  const [decision, setDecision] = useState<MdDecision | null>(null);
  const [flags, setFlags] = useState<number[]>([]);
  const submitted = Boolean(room.submitted[pid]);
  const bought = new Set(me?.findings.map((f) => f.source) ?? []);

  useEffect(() => {
    if (me?.pending) {
      setEstimate(String(me.pending.estimate).replace('.', lang === 'vi' ? ',' : '.'));
      setDecision(me.pending.decision);
      setFlags(me.pending.flags);
    }
    // only when the saved answer first arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.pending?.estimate]);

  const value = Number(estimate.replace(/\s/g, '').replace(',', '.'));
  const valid = value > 0 && value < 10000;

  async function buy(s: SourceId) {
    setBusy(s);
    setError(null);
    try {
      setMe(await api.mdBuy(room.code, pid, session.playerToken!, room.round, s));
    } catch (err) {
      setError(errOf(err, { en: 'Could not buy this source.', vi: 'Không mua được nguồn này.' }));
    } finally {
      setBusy(null);
    }
  }
  async function submit() {
    if (!valid || !decision) return;
    setBusy('submit');
    setError(null);
    try {
      await api.mdSubmit(room.code, pid, session.playerToken!, room.round, { estimate: value, decision, flags });
    } catch (err) {
      setError(errOf(err, { en: 'Could not submit.', vi: 'Không nộp được.' }));
    } finally {
      setBusy(null);
    }
  }

  const credits = me?.credits ?? START_CREDITS;
  const slotsLeft = INTERVIEW_SLOTS - room.interviews.length;
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 bg-paper/95 px-4 py-2 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/50">{tr('Case', 'Vụ')} {room.round}/{room.rounds}</p>
          <p className="text-lg font-extrabold">💳 {credits} <span className="text-sm font-medium text-ink/60">{tr('credits', 'điểm NC')}</span></p>
        </div>
        <Countdown deadline={room.deadline} now={now} />
      </div>

      <div className="card space-y-2">
        <h1 className="text-xl font-extrabold">🔎 {t(c.title)}</h1>
        <p className="font-semibold">{t(c.question)}</p>
        <p className="text-[15px] text-ink/75">{t(c.context)}</p>
        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-ink/50">{tr('Decision rule from the CFO', 'Quy tắc quyết định của Giám đốc tài chính')}</p>
        <DecisionRule c={c} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">🗂 {tr('Data sources', 'Nguồn dữ liệu')}</h2>
        {SOURCES.map((s) => {
          const info = SOURCE_INFO[s];
          const f = me?.findings.find((x) => x.source === s);
          const isInterview = s === 'interview';
          const blocked = isInterview && !bought.has(s) && slotsLeft <= 0;
          return (
            <div key={s} className={`rounded-xl p-3 ring-1 ${f ? 'bg-white ring-ink/20' : 'ring-ink/10'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t(info.name)}</p>
                  <p className="text-xs text-ink/50">
                    {t(info.kind)}
                    {isInterview && ` · ${tr(`${Math.max(0, slotsLeft)}/${INTERVIEW_SLOTS} slots left`, `còn ${Math.max(0, slotsLeft)}/${INTERVIEW_SLOTS} suất`)}`}
                    {isInterview && room.interviews.length > 0 && ` · ${room.interviews.map((id) => room.players[id]?.name).join(', ')}`}
                  </p>
                </div>
                {!f && (
                  <button type="button" className="btn-dark shrink-0 px-3 py-1.5 text-sm" disabled={Boolean(busy) || credits < info.cost || blocked || !me} onClick={() => buy(s)}>
                    {busy === s ? '…' : blocked ? tr('Taken', 'Hết suất') : `${tr('Buy', 'Mua')} · ${info.cost}`}
                  </button>
                )}
              </div>
              {f && <p className="mt-2 text-[15px] leading-relaxed">{t(f.text)}</p>}
              {f && s === 'ai' && me && (
                <ol className="mt-2 space-y-1.5">
                  {me.aiClaims.map((claim, i) => {
                    const on = flags.includes(i);
                    return (
                      <li key={i}>
                        <label className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[15px] ring-1 ${on ? 'bg-bad/10 ring-bad/40' : 'ring-ink/10'}`}>
                          <input type="checkbox" className="mt-1" checked={on} onChange={() => setFlags((x) => (on ? x.filter((y) => y !== i) : [...x, i]))} />
                          <span>
                            <b>{i + 1}.</b> {t(claim)}
                            {on && <span className="ml-1 text-xs font-semibold text-bad">{tr('· flagged as wrong', '· đánh dấu sai')}</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                  <li className="text-xs text-ink/50">{tr('Tick the statements you think are wrong (fabricated, outdated, plausible-sounding or biased).', 'Tích vào nhận định bạn cho là sai (bịa đặt, lỗi thời, nghe hợp lý nhưng sai, hoặc thiên lệch nguồn).')}</li>
                </ol>
              )}
            </div>
          );
        })}
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">🧮 {tr('Your analysis', 'Phân tích của bạn')}</h2>
        {me && me.findings.some((f) => f.implied !== undefined) && (
          <ul className="space-y-0.5 text-sm text-ink/70">
            {me.findings.filter((f) => f.implied !== undefined).map((f) => (
              <li key={f.source} className="flex justify-between gap-2"><span className="truncate">{t(SOURCE_INFO[f.source].name)}</span><b className="shrink-0 tabular-nums">{bn(f.implied!, lang)}</b></li>
            ))}
            <li className="pt-1 text-xs text-ink/50">{tr('Raw numbers – adjust each one for its bias before you decide.', 'Số thô – hãy hiệu chỉnh theo độ lệch của từng nguồn trước khi kết luận.')}</li>
          </ul>
        )}
        <div>
          <label className="label" htmlFor="est">{tr('Market size estimate', 'Ước tính quy mô thị trường')} ({t(c.unit)})</label>
          <input id="est" className="input text-2xl font-extrabold" inputMode="decimal" placeholder={lang === 'vi' ? 'ví dụ 6,5' : 'e.g. 6.5'} value={estimate} onChange={(e) => setEstimate(e.target.value.replace(/[^0-9.,]/g, ''))} />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DECISIONS.map((d) => (
            <button key={d} type="button" onClick={() => setDecision(d)} className={`rounded-xl px-2 py-2.5 text-sm font-bold ring-1 ${decision === d ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/10'}`}>
              {d === 'launch' ? '🚀' : d === 'pilot' ? '🧪' : '✋'} {t(DECISION_INFO[d])}
            </button>
          ))}
        </div>
        <ErrorNote err={error} />
        <button type="button" className="btn-primary w-full text-lg" disabled={!valid || !decision || busy === 'submit'} onClick={submit}>
          {submitted ? tr('Update my answer', 'Cập nhật câu trả lời') : tr('Submit', 'Nộp kết quả')}
        </button>
        {submitted && <p className="text-center text-sm font-medium text-ok">✓ {tr('Submitted – you can still change it until the case closes.', 'Đã nộp – vẫn sửa được đến khi vụ đóng.')}</p>}
      </div>

      <div className="card">
        <h2 className="mb-2 font-bold">👀 {tr('The room', 'Cả phòng')}</h2>
        <ul className="grid grid-cols-2 gap-1.5 text-sm">
          {room.order.map((id) => (
            <li key={id} className={`truncate rounded-lg px-2 py-1 ring-1 ${id === pid ? 'ring-amber' : 'ring-ink/10'}`}>
              {room.players[id]!.bot ? '🤖' : room.submitted[id] ? '✅' : '⏳'} {room.players[id]!.name}
              {!room.players[id]!.bot && <span className="text-ink/50"> · {room.bought[id] ?? 0} {tr('src', 'nguồn')}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ScoreLine({ label, v, max }: { label: string; v: number; max?: number }) {
  return (
    <div className="flex justify-between text-[15px]">
      <span>{label}</span>
      <b className={`tabular-nums ${v < 0 ? 'text-bad' : ''}`}>{v > 0 ? `+${v}` : v}{max !== undefined ? <span className="font-normal text-ink/40">/{max}</span> : null}</b>
    </div>
  );
}

function MyCaseScore({ room, pid }: { room: MdRoomDoc; pid: string }) {
  const { lang, t, tr } = useLang();
  const rv = room.reveal!;
  const s = rv.scores[pid];
  return (
    <div className="card space-y-1">
      <h2 className="mb-1 font-bold">{tr('Your case score', 'Điểm vụ này của bạn')}: {s?.total ?? 0}</h2>
      <p className="text-sm text-ink/60">
        {tr('Your estimate', 'Ước tính của bạn')}: <b>{s?.estimate != null ? bn(s.estimate, lang) : '–'}</b> · {tr('decision', 'quyết định')}: <b>{s?.decision ? t(DECISION_INFO[s.decision]) : '–'}</b>
      </p>
      <ScoreLine label={tr('Estimate accuracy', 'Độ chính xác ước tính')} v={s?.accuracy ?? 0} max={50} />
      <ScoreLine label={tr('Decision', 'Quyết định')} v={s?.decisionPts ?? 0} max={25} />
      <ScoreLine label={tr('AI fact-check', 'Bắt lỗi AI')} v={s?.flagPts ?? 0} />
      <ScoreLine label={tr('Credits left', 'Điểm NC còn thừa')} v={s?.creditPts ?? 0} max={15} />
    </div>
  );
}

function RevealBlocks({ room, pid }: { room: MdRoomDoc; pid: string }) {
  const { lang, t, tr } = useLang();
  const rv = room.reveal!;
  const mine = rv.scores[pid];
  return (
    <>
      <div className="pop rounded-2xl bg-ink px-4 py-3 text-white">
        <p className="text-sm text-white/70">{tr('Case', 'Vụ')} {room.round}/{room.rounds} · {tr('the truth', 'sự thật')}</p>
        <p className="text-3xl font-extrabold">{bn(rv.truth, lang)}</p>
        <p className="text-white/80">{tr('Right decision', 'Quyết định đúng')}: <b className="text-amber">{t(DECISION_INFO[rv.decision])}</b></p>
      </div>
      <MyCaseScore room={room} pid={pid} />
      <div className="card">
        <h2 className="mb-2 font-bold">📏 {tr('How far each source was from the truth', 'Mỗi nguồn lệch bao nhiêu so với số thật')}</h2>
        <SourceBars reveal={rv} />
      </div>
      <div className="card">
        <h2 className="mb-2 font-bold">🤖 {tr('The AI report, checked', 'Kiểm chứng báo cáo AI')}</h2>
        <AiErrors reveal={rv} {...(mine?.sources.includes('ai') ? { flagged: mine.flags ?? [] } : {})} />
      </div>
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('This case', 'Vụ này')}</h2>
        <CaseTable room={room} me={pid} />
      </div>
    </>
  );
}

function ResultsScreen({ room, session, now }: { room: MdRoomDoc; session: Session; now: number }) {
  const { tr } = useLang();
  const pid = session.playerId!;
  const isHost = Boolean(session.hostToken);
  const [busy, setBusy] = useState(false);
  const autoLeft = room.settings.resultsSec > 0 && room.revealedAt ? Math.max(0, Math.ceil((room.revealedAt + room.settings.resultsSec * 1000 - now) / 1000)) : null;
  return (
    <div className="space-y-4">
      <RevealBlocks room={room} pid={pid} />
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Standings', 'Bảng xếp hạng')}</h2>
        <MdStandings room={room} me={pid} />
      </div>
      {isHost ? (
        <button
          type="button"
          className="btn-primary sticky bottom-3 w-full text-lg shadow-lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.advance(room.code, { hostToken: session.hostToken!, expectStatus: 'results', expectRound: room.round });
            } finally {
              setBusy(false);
            }
          }}
        >
          {tr(`Case ${room.round + 1} →`, `Sang vụ ${room.round + 1} →`)} {autoLeft !== null ? `(${autoLeft}s)` : ''}
        </button>
      ) : (
        <p className="text-center text-sm text-ink/60">{autoLeft !== null ? tr(`Next case in ${autoLeft}s…`, `Vụ tiếp mở sau ${autoLeft}s…`) : tr('Waiting for the next case…', 'Chờ mở vụ tiếp…')}</p>
      )}
    </div>
  );
}

function FinalScreen({ room, session, me }: { room: MdRoomDoc; session: Session; me: MdMe | null }) {
  const { t, tr } = useLang();
  const nav = useNavigate();
  const pid = session.playerId!;
  const st = room.standings[pid];
  const player = room.players[pid];
  const [busy, setBusy] = useState(false);
  const [showLast, setShowLast] = useState(false);
  const soloHost = Boolean(session.hostToken) && room.order.filter((id) => !room.players[id]?.bot).length === 1;
  const winner = rankedIds(room)[0];
  async function again() {
    setBusy(true);
    try {
      const lti = getLti();
      const r = await api.createRoom({ game: 'market-detective', hostPlays: true, hostName: player?.name ?? 'Detective', settings: room.settings, ...(player?.lms && lti?.role === 'learner' ? { ltiSession: lti.session } : {}) });
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
        <p className="text-5xl">{st?.rank === 1 ? '🏆' : st?.rank === 2 ? '🥈' : st?.rank === 3 ? '🥉' : '🔎'}</p>
        <p className="mt-2 text-2xl font-extrabold">{tr('Rank', 'Hạng')} {st?.rank ?? '–'}/{room.order.length}</p>
        <p className="text-ink/60">{tr('Points', 'Điểm')} {st?.total ?? 0}/{room.rounds * 100}</p>
        {winner && winner !== pid && <p className="mt-1 text-sm text-ink/60">{tr('Top detective', 'Thám tử giỏi nhất')}: {room.players[winner]?.name}</p>}
      </div>
      {player?.lms && (
        <div className={`card text-center text-sm font-medium ${room.lmsStatus?.[pid] === 'error' ? 'text-bad' : 'text-ok'}`}>
          {room.lmsStatus?.[pid] === 'sent'
            ? tr(`✓ Grade ${me?.grade ?? ''}/100 sent to the Moodle gradebook (70% average case score + 30% rank; best attempt counts).`, `✓ Đã gửi điểm ${me?.grade ?? ''}/100 về Sổ điểm Moodle (70% điểm trung bình các vụ + 30% thứ hạng; lấy lần cao nhất).`)
            : room.lmsStatus?.[pid] === 'error'
              ? tr('The grade could not be sent to Moodle. Tell your lecturer.', 'Chưa gửi được điểm về Moodle. Báo giảng viên.')
              : tr('Sending your grade to Moodle…', 'Đang gửi điểm về Moodle…')}
        </div>
      )}
      {me && me.badges.length > 0 && (
        <div className="card flex flex-wrap gap-2">
          {me.badges.map((b) => <span key={b.en} className="rounded-full bg-amber/20 px-3 py-1 text-sm font-semibold">{t(b)}</span>)}
        </div>
      )}
      {me && (
        <div className="card">
          <h2 className="mb-2 font-bold">{tr('Your three cases', 'Ba vụ của bạn')}</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>
                <th className="py-1">#</th>
                <th className="py-1 text-right">{tr('Estimate', 'Ước tính')}</th>
                <th className="py-1 text-right">{tr('Decision', 'Quyết định')}</th>
                <th className="py-1 text-right">AI</th>
                <th className="py-1 text-right">{tr('Credits', 'Điểm NC')}</th>
                <th className="py-1 text-right">{tr('Total', 'Tổng')}</th>
              </tr>
            </thead>
            <tbody>
              {me.scores.map((s, i) => (
                <tr key={s.caseId} className="border-t border-ink/10 tabular-nums">
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1 text-right">{s.accuracy}</td>
                  <td className="py-1 text-right">{s.decisionPts}</td>
                  <td className="py-1 text-right">{s.flagPts}</td>
                  <td className="py-1 text-right">{s.creditPts}</td>
                  <td className="py-1 text-right font-bold">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Final standings', 'Bảng xếp hạng chung cuộc')}</h2>
        <MdStandings room={room} me={pid} />
      </div>
      {room.reveal && (
        <button type="button" className="btn-ghost w-full" onClick={() => setShowLast(!showLast)}>
          {showLast ? tr('Hide the last case', 'Ẩn vụ cuối') : tr('Show the answer to the last case', 'Xem đáp án vụ cuối')}
        </button>
      )}
      {showLast && room.reveal && <RevealBlocks room={room} pid={pid} />}
      <div className="card text-[15px] leading-relaxed">
        <h2 className="mb-2 font-bold">{tr('Debrief questions', 'Câu hỏi tổng kết')}</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {MD_DEBRIEF.map(([en, vi]) => <li key={en}>{tr(en, vi)}</li>)}
        </ol>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {soloHost && <button type="button" className="btn-primary" disabled={busy} onClick={again}>{tr('Play again vs AI', 'Chơi lại với máy')}</button>}
        <Link to="/" className="btn-ghost">{tr('Home', 'Về trang chủ')}</Link>
      </div>
    </div>
  );
}
