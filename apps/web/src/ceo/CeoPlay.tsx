import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AGENT_INFO,
  AGENT_INVESTS,
  AI_CHOICES,
  AI_INFO,
  CHANNELS,
  CHANNEL_INFO,
  CRISIS_CARDS,
  KPIS,
  KPI_INFO,
  MAX_MARKETING,
  PRICE_INFO,
  PRICE_POS,
  ROUNDS,
  ROUND_INFO,
  SEGMENTS,
  SEGMENT_INFO,
  SERVICES,
  SERVICE_INFO,
  SKU_INFO,
  SKU_RANGES,
  START_CASH,
  STOCK_OPTIONS,
  type AgentInvest,
  type AiChoice,
  type CeoDecision,
  type CeoMe,
  type CeoRoomDoc,
  type Channel,
  type Kpi,
  type Trend,
} from '@arena/ceo';
import { BOT_LEVEL_LABEL, MAX_SEATS, type T } from '@arena/types';
import { ErrorNote, Qr, joinUrl } from '../components/common';
import { api } from '../lib/api';
import { errOf, useLang } from '../lib/i18n';
import { getLti, setSession, type Session } from '../lib/storage';
import { CeoStandings, ChannelTable, Countdown, DEBRIEF, KpiTable, PnL, ProfitChart, ScorecardBars, mil, num, rankedIds, useCeoMe } from './parts';

export function CeoPlay({ room, session, now }: { room: CeoRoomDoc; session: Session; now: number }) {
  const me = useCeoMe(room, session.playerId, session.playerToken);
  if (room.status === 'lobby') return <CeoLobby room={room} session={session} />;
  if (room.status === 'decide') return <DecideScreen key={room.round} room={room} session={session} now={now} me={me} />;
  if (room.status === 'results') return <ResultsScreen room={room} session={session} me={me} now={now} />;
  return <FinalScreen room={room} session={session} me={me} />;
}

export function CeoBriefing({ compact }: { compact?: boolean }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(!compact);
  return (
    <div className="card">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <h2 className="font-bold">📋 {tr('Your mission', 'Nhiệm vụ của bạn')}</h2>
        <span className="text-sm text-ink/50">{open ? tr('Hide', 'Thu gọn') : tr('Show', 'Xem')}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink/80">
          <p>{tr('You are the CEO of a skin-care e-commerce brand. Six companies share one market for six quarters, each starting with VND 1 billion.', 'Bạn là CEO một thương hiệu mỹ phẩm bán online. Sáu công ty cùng một thị trường trong sáu quý, mỗi công ty bắt đầu với 1 tỷ đồng.')}</p>
          <p>{tr('Each quarter: segment, price, range, service, marketing (ads, creators, CRM), channel mix (website, Shopee, TikTok) and how much stock to buy. Every decision ripples: customers → competitors → market → money.', 'Mỗi quý: phân khúc, giá, dòng sản phẩm, dịch vụ, marketing (quảng cáo, nhà sáng tạo, CRM), phân bổ kênh (website, Shopee, TikTok) và lượng hàng nhập. Mỗi quyết định lan tỏa: khách hàng → đối thủ → thị trường → tiền.')}</p>
          <p>{tr('Q3 platforms tighten, Q4 AI arrives, Q5 AI agents shop for customers, Q6 a CEO crisis card. Ranking = Strategy Dashboard: profit 40%, survival 15%, low platform dependency 15%, agent readiness 10%, crisis 20%.', 'Quý 3 sàn siết luật, quý 4 AI xuất hiện, quý 5 AI agent mua hộ khách, quý 6 thẻ khủng hoảng CEO. Xếp hạng = Bảng điều khiển chiến lược: lợi nhuận 40%, sống sót 15%, ít phụ thuộc sàn 15%, sẵn sàng cho agent 10%, khủng hoảng 20%.')}</p>
        </div>
      )}
    </div>
  );
}

function CeoLobby({ room, session }: { room: CeoRoomDoc; session: Session }) {
  const { t, tr } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);
  const isHost = Boolean(session.hostToken);
  const free = MAX_SEATS - room.order.length;
  return (
    <div className="space-y-4">
      <div className="card text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink/50">Game 12 · CEO Simulator</p>
        <p className="text-sm text-ink/60">{room.title}</p>
        <p className="mt-1 text-4xl font-extrabold tracking-[0.25em]">{room.code}</p>
        {isHost && room.hostPlays && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <Qr text={joinUrl(room.code)} size={160} />
          </div>
        )}
      </div>
      <CeoBriefing />
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Companies', 'Các công ty')} ({room.order.length}/{MAX_SEATS})</h2>
        <ul className="grid gap-1.5">
          {room.order.map((id) => (
            <li key={id} className={`rounded-xl px-3 py-2 ring-1 ${id === session.playerId ? 'bg-amber/20 ring-amber' : 'ring-ink/10'}`}>{room.players[id]!.name}</li>
          ))}
        </ul>
        {room.settings.fillBots && free > 0 && <p className="mt-2 text-sm text-ink/60">{tr(`On start, ${free} AI CEO(s) join (${BOT_LEVEL_LABEL[room.settings.botLevel].en}).`, `Khi bắt đầu, ${free} CEO máy sẽ tham gia (mức ${BOT_LEVEL_LABEL[room.settings.botLevel].vi}).`)}</p>}
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
            {tr('Start 6 quarters', 'Bắt đầu 6 quý')}
          </button>
        </>
      ) : (
        <p className="card text-center font-medium text-ink/70">⏳ {room.hostPlays ? tr('Waiting for the host…', 'Chờ chủ phòng…') : tr('Waiting for the lecturer…', 'Chờ giảng viên…')}</p>
      )}
      <p className="text-center text-xs text-ink/40">{t({ en: 'Textbook Chapter 12, Tables 12.18–12.19', vi: 'Giáo trình Chương 12, bảng 12.18–12.19' })}</p>
    </div>
  );
}

function Choice<K extends string>({ options, value, onChange, label, note, cols = 3 }: { options: readonly K[]; value: K; onChange: (k: K) => void; label: (k: K) => string; note?: (k: K) => string; cols?: number }) {
  return (
    <div className={`grid gap-1.5 ${cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {options.map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`rounded-xl px-2 py-2 text-left text-xs ring-1 ${value === k ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/10'}`}>
          <span className="block font-semibold">{label(k)}</span>
          {note && <span className={`block ${value === k ? 'text-white/70' : 'text-ink/50'}`}>{note(k)}</span>}
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, value, onChange, max, step = 10, unit }: { label: string; value: number; onChange: (v: number) => void; max: number; step?: number; unit: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className="h-8 w-8 rounded-lg bg-ink/10 font-bold disabled:opacity-30" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - step))}>−</button>
        <span className="w-16 text-center font-extrabold tabular-nums">{value}{unit}</span>
        <button type="button" className="h-8 w-8 rounded-lg bg-ink font-bold text-white disabled:opacity-30" disabled={value + step > max} onClick={() => onChange(value + step)}>+</button>
      </div>
    </div>
  );
}

const START: CeoDecision = { price: 'mid', skus: 'medium', segment: 'office', service: 'fast', ads: 150, creators: 80, crm: 60, mix: { web: 30, shopee: 50, tiktok: 20 }, stock: 4000, shopeePromo: true };

function DecideScreen({ room, session, now, me }: { room: CeoRoomDoc; session: Session; now: number; me: CeoMe | null }) {
  const { lang, t, tr } = useLang();
  const pid = session.playerId!;
  const round = room.round;
  const last = me?.reports[me.reports.length - 1];
  const [d, setD] = useState<CeoDecision>(START);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  useEffect(() => {
    if (loaded || !me) return;
    const base = me.pending ?? last?.decision;
    if (base) setD({ ...START, ...base, mix: { ...base.mix }, ai: me.pending?.ai, agent: me.pending?.agent ?? [], crisis: me.pending?.crisis, predict: me.pending?.predict ?? {} } as CeoDecision);
    if (me.pending) setSentAt(Date.now());
    setLoaded(true);
  }, [me, last, loaded]);

  const set = <K extends keyof CeoDecision>(k: K, v: CeoDecision[K]) => setD((x) => ({ ...x, [k]: v }));
  const marketing = d.ads + d.creators + d.crm;
  const mixSum = CHANNELS.reduce((a, c) => a + (d.mix[c] ?? 0), 0);
  const crisis = round === ROUNDS ? room.crises[pid] : undefined;
  const card = crisis ? CRISIS_CARDS[crisis] : null;
  const unitCost = PRICE_INFO[d.price].unitCost;
  const newAgent = (d.agent ?? []).filter((a) => !(me?.agentOwned ?? []).includes(a));
  const spend = marketing + d.stock * unitCost + (round === 4 && d.ai && d.ai !== 'E' ? 300 : 0) + newAgent.reduce((a, k) => a + AGENT_INFO[k].cost, 0);
  const preds = KPIS.filter((k) => d.predict?.[k]).length;
  const ready = mixSum === 100 && marketing <= MAX_MARKETING && (round !== 4 || d.ai) && (!card || (d.crisis && preds === 4));
  const submitted = room.order.filter((id) => room.players[id]?.bot || room.submitted[id]).length;
  const timeUp = room.deadline !== null && now > room.deadline;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: CeoDecision = { ...d, ...(round >= 3 ? {} : { shopeePromo: undefined }), ...(round === 4 ? {} : { ai: undefined }), ...(round >= 5 ? {} : { agent: undefined }), ...(card ? {} : { crisis: undefined, predict: undefined }) };
      await api.ceoDecide(room.code, pid, session.playerToken!, round, JSON.parse(JSON.stringify(body)) as CeoDecision);
      setSentAt(Date.now());
    } catch (err) {
      setError(errOf(err, { en: 'Could not submit.', vi: 'Không nộp được.' }));
    } finally {
      setBusy(false);
    }
  }

  const info = ROUND_INFO[round]!;
  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <span className="text-lg font-extrabold">{tr('Quarter', 'Quý')} {round}/{ROUNDS}</span>
        <Countdown deadline={room.deadline} now={now} />
      </div>
      {round === 1 && <CeoBriefing compact />}
      <section className="card space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink/50">{tr('Round', 'Vòng')} {round}</p>
        <h2 className="text-lg font-extrabold">{t(info.title)}</h2>
        <p className="text-[15px] leading-relaxed text-ink/80">{t(info.text)}</p>
        {room.news.map((n, i) => (
          <p key={i} className="text-sm text-ink/70">📰 {t(n)}</p>
        ))}
      </section>
      {me && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white p-2 ring-1 ring-ink/10"><p className="text-ink/50">{tr('Cash', 'Tiền mặt')}</p><p className={`font-extrabold ${me.cash < 0 ? 'text-bad' : ''}`}>{mil(me.cash, lang)}</p></div>
          <div className="rounded-xl bg-white p-2 ring-1 ring-ink/10"><p className="text-ink/50">{tr('Stock', 'Hàng tồn')}</p><p className="font-extrabold">{num(me.stock, lang)}</p></div>
          <div className="rounded-xl bg-white p-2 ring-1 ring-ink/10"><p className="text-ink/50">{tr('Last demand', 'Nhu cầu quý trước')}</p><p className="font-extrabold">{last ? num(last.kpis.orders + last.kpis.stockouts, lang) : '–'}</p></div>
        </div>
      )}

      {card && (
        <section className="card space-y-3 ring-2 ring-bad">
          <p className="text-xs font-semibold uppercase tracking-widest text-bad">🃏 {tr('Your CEO Crisis Card', 'Thẻ khủng hoảng của bạn')}</p>
          <h2 className="text-lg font-extrabold text-bad">{t(card.title)}</h2>
          <p className="text-[15px]">{t(card.text)}</p>
          <div className="grid gap-1.5">
            {card.options.map((o) => (
              <button key={o.id} type="button" onClick={() => set('crisis', o.id)} className={`rounded-xl px-3 py-2 text-left text-sm ring-1 ${d.crisis === o.id ? 'bg-ink text-white ring-ink' : 'ring-ink/15 hover:bg-amber/10'}`}>{t(o.label)}</button>
            ))}
          </div>
          <p className="text-sm font-semibold">{tr('Predict: compared with last quarter, each KPI will go…', 'Dự đoán: so với quý trước, mỗi KPI sẽ…')}</p>
          <div className="grid gap-1.5">
            {KPIS.map((k: Kpi) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span>{t(KPI_INFO[k])}</span>
                <div className="flex gap-1">
                  {(['up', 'down'] as Trend[]).map((v) => (
                    <button key={v} type="button" onClick={() => set('predict', { ...(d.predict ?? {}), [k]: v })} className={`rounded-lg px-3 py-1 text-xs font-bold ring-1 ${d.predict?.[k] === v ? 'bg-ink text-white ring-ink' : 'ring-ink/20'}`}>
                      {v === 'up' ? tr('▲ up', '▲ tăng') : tr('▼ down', '▼ giảm')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {round === 4 && (
        <section className="card space-y-2 ring-2 ring-violet-300">
          <h2 className="font-bold">🤖 {tr('Use the VND 300 million AI budget', 'Dùng 300 triệu cho AI')}</h2>
          <div className="grid gap-1.5">
            {AI_CHOICES.map((a: AiChoice) => (
              <button key={a} type="button" onClick={() => set('ai', a)} className={`rounded-xl px-3 py-2 text-left text-sm ring-1 ${d.ai === a ? 'bg-ink text-white ring-ink' : 'ring-ink/15 hover:bg-amber/10'}`}>
                <b>{t(AI_INFO[a].name)}</b>
                <span className={`block text-xs ${d.ai === a ? 'text-white/70' : 'text-ink/60'}`}>{t(AI_INFO[a].note)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {round >= 5 && (
        <section className="card space-y-2 ring-2 ring-sky-300">
          <h2 className="font-bold">🛰️ {tr('Agent readiness (one-off investments)', 'Sẵn sàng cho AI agent (đầu tư một lần)')}</h2>
          {AGENT_INVESTS.map((a: AgentInvest) => {
            const owned = me?.agentOwned.includes(a);
            const on = owned || (d.agent ?? []).includes(a);
            return (
              <label key={a} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${on ? 'bg-sky-50 ring-sky-300' : 'ring-ink/10'}`}>
                <span>
                  <input type="checkbox" className="mr-2" disabled={owned} checked={on} onChange={(e) => set('agent', e.target.checked ? [...(d.agent ?? []), a] : (d.agent ?? []).filter((x) => x !== a))} />
                  {t(AGENT_INFO[a].name)}
                </span>
                <span className="text-xs text-ink/60">{owned ? tr('owned', 'đã có') : mil(AGENT_INFO[a].cost, lang)}</span>
              </label>
            );
          })}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-bold">1. {tr('Customer and offer', 'Khách hàng và sản phẩm')}</h2>
        <p className="text-xs font-semibold text-ink/60">{tr('Target segment', 'Phân khúc mục tiêu')}</p>
        <Choice options={SEGMENTS} value={d.segment} onChange={(v) => set('segment', v)} label={(k) => t(SEGMENT_INFO[k].name)} note={(k) => t(SEGMENT_INFO[k].who)} />
        <p className="text-xs font-semibold text-ink/60">{tr('Price position', 'Định vị giá')}</p>
        <Choice options={PRICE_POS} value={d.price} onChange={(v) => set('price', v)} label={(k) => t(PRICE_INFO[k].name)} />
        <p className="text-xs font-semibold text-ink/60">{tr('Product range', 'Dòng sản phẩm')}</p>
        <Choice options={SKU_RANGES} value={d.skus} onChange={(v) => set('skus', v)} label={(k) => t(SKU_INFO[k].name)} note={(k) => t(SKU_INFO[k].note)} />
        <p className="text-xs font-semibold text-ink/60">{tr('Service level', 'Mức dịch vụ')}</p>
        <Choice options={SERVICES} value={d.service} onChange={(v) => set('service', v)} label={(k) => t(SERVICE_INFO[k].name)} note={(k) => t(SERVICE_INFO[k].note)} />
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">2. {tr('Marketing (million VND)', 'Marketing (triệu đồng)')}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${marketing > MAX_MARKETING ? 'bg-bad/15 text-bad' : 'bg-amber/25'}`}>{marketing}/{MAX_MARKETING}</span>
        </div>
        <Stepper label={tr('Ads (search, retail media, social)', 'Quảng cáo (tìm kiếm, trên sàn, mạng xã hội)')} value={d.ads} onChange={(v) => set('ads', v)} max={MAX_MARKETING - d.creators - d.crm} unit="" />
        <Stepper label={tr('Creators / KOC (mostly TikTok)', 'Nhà sáng tạo / KOC (chủ yếu TikTok)')} value={d.creators} onChange={(v) => set('creators', v)} max={MAX_MARKETING - d.ads - d.crm} unit="" />
        <Stepper label={tr('CRM & retention (owned)', 'CRM và giữ chân khách (kênh riêng)')} value={d.crm} onChange={(v) => set('crm', v)} max={MAX_MARKETING - d.ads - d.creators} unit="" />
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">3. {tr('Channel effort', 'Phân bổ kênh')}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${mixSum === 100 ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>{mixSum}%</span>
        </div>
        {CHANNELS.map((c: Channel) => (
          <div key={c}>
            <Stepper label={t(CHANNEL_INFO[c].name)} value={d.mix[c] ?? 0} onChange={(v) => set('mix', { ...d.mix, [c]: v })} max={100} unit="%" />
            <p className="text-xs text-ink/50">{t(CHANNEL_INFO[c].note)}</p>
          </div>
        ))}
        {round >= 3 && (
          <label className="flex items-center gap-2 rounded-xl bg-amber/10 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(d.shopeePromo)} onChange={(e) => set('shopeePromo', e.target.checked)} />
            {tr('Join Shopee’s promotion programme (+3% fees; otherwise 30% less visibility)', 'Tham gia khuyến mãi bắt buộc của Shopee (+3% phí; nếu không, giảm 30% hiển thị)')}
          </label>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">4. {tr('Buy stock', 'Nhập hàng')}</h2>
        <p className="text-xs text-ink/60">{tr(`Unit cost ${num(unitCost * 1000, lang)}k. Unsold stock carries over (3% holding cost per quarter); running out loses orders and rating.`, `Giá vốn ${num(unitCost * 1000, lang)}k/sp. Hàng chưa bán chuyển sang quý sau (3% chi phí lưu kho/quý); hết hàng thì mất đơn và điểm đánh giá.`)}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, ...STOCK_OPTIONS].map((s) => (
            <button key={s} type="button" onClick={() => set('stock', s)} className={`rounded-lg px-1 py-2 text-xs font-semibold ring-1 ${d.stock === s ? 'bg-ink text-white ring-ink' : 'ring-ink/15'}`}>
              {num(s, lang)}
              <span className="block font-normal opacity-70">{mil(s * unitCost, lang)}</span>
            </button>
          ))}
        </div>
      </section>

      <ErrorNote err={error} />
      {timeUp ? (
        <p className="card text-center font-bold">⏰ {tr('Time is up – closing the quarter…', 'Hết giờ – đang chốt quý…')}</p>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink/10 bg-white/95 px-4 py-2 backdrop-blur">
          <div className="mx-auto max-w-xl space-y-1">
            <p className="text-center text-xs text-ink/70">
              {tr('Cash out this quarter', 'Chi trong quý')} ≈ {mil(spend, lang)} · {tr('cash now', 'tiền hiện có')} {mil(me?.cash ?? START_CASH, lang)} · {submitted}/{room.order.length} {tr('submitted', 'đã nộp')}
            </p>
            <button type="button" className="btn-primary w-full" disabled={!ready || busy} onClick={submit}>
              {sentAt ? tr('✓ Submitted · update', '✓ Đã nộp · cập nhật') : tr('Submit quarter plan', 'Nộp kế hoạch quý')}
              {!ready ? (mixSum !== 100 ? tr(' (mix ≠ 100%)', ' (kênh ≠ 100%)') : round === 4 && !d.ai ? tr(' (choose AI)', ' (chọn AI)') : card ? tr(' (crisis + 4 predictions)', ' (khủng hoảng + 4 dự đoán)') : '') : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportBlock({ me, room, pid }: { me: CeoMe; room: CeoRoomDoc; pid: string }) {
  const { t, tr } = useLang();
  const rep = me.reports[me.reports.length - 1];
  const prev = me.reports[me.reports.length - 2];
  if (!rep) return null;
  return (
    <>
      {rep.notes.length > 0 && (
        <div className="card space-y-1 text-[15px]">
          {rep.defaulted && <p className="text-orange-700">{tr('No plan submitted: last quarter’s choices were reused.', 'Không nộp kế hoạch: hệ thống dùng lại lựa chọn quý trước.')}</p>}
          {rep.notes.map((n, i) => (
            <p key={i}>⚠ {t(n)}</p>
          ))}
        </div>
      )}
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Dashboard', 'Bảng điều khiển')}</h2>
        <KpiTable now={rep.kpis} {...(prev ? { prev: prev.kpis } : {})} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-bold">{tr('Profit & loss', 'Lãi lỗ quý')}</h2>
          <PnL k={rep.kpis} />
        </div>
        <div className="card">
          <h2 className="mb-2 font-bold">{tr('By channel', 'Theo kênh')}</h2>
          <ChannelTable k={rep.kpis} />
        </div>
      </div>
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Quarterly profit, all companies', 'Lợi nhuận từng quý, mọi công ty')}</h2>
        <ProfitChart room={room} me={pid} />
      </div>
    </>
  );
}

function ResultsScreen({ room, session, me, now }: { room: CeoRoomDoc; session: Session; me: CeoMe | null; now: number }) {
  const { lang, t, tr } = useLang();
  const pid = session.playerId!;
  const st = room.standings[pid];
  const isHost = Boolean(session.hostToken);
  const [busy, setBusy] = useState(false);
  const autoLeft = room.settings.resultsSec > 0 && room.revealedAt ? Math.max(0, Math.ceil((room.revealedAt + room.settings.resultsSec * 1000 - now) / 1000)) : null;
  return (
    <div className="space-y-4">
      <div className="pop rounded-2xl bg-ink px-4 py-3 text-white">
        <p className="text-sm text-white/70">{tr('End of quarter', 'Hết quý')} {room.round}/{ROUNDS}</p>
        <p className="text-2xl font-extrabold">
          {tr('Rank', 'Hạng')} {st?.rank ?? '–'}/{room.order.length} · {tr('profit', 'lợi nhuận')} {st ? mil(st.profitCum, lang) : '–'}
        </p>
      </div>
      {room.news.map((n, i) => (
        <p key={i} className="card text-sm">📰 {t(n)}</p>
      ))}
      {me ? <ReportBlock me={me} room={room} pid={pid} /> : <p className="card text-center text-ink/60">{tr('Loading…', 'Đang tải…')}</p>}
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Standings', 'Bảng xếp hạng')}</h2>
        <CeoStandings room={room} me={pid} />
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
          {tr(`Quarter ${room.round + 1} →`, `Sang quý ${room.round + 1} →`)} {autoLeft !== null ? `(${autoLeft}s)` : ''}
        </button>
      ) : (
        <p className="text-center text-sm text-ink/60">{autoLeft !== null ? tr(`Next quarter in ${autoLeft}s…`, `Quý tiếp mở sau ${autoLeft}s…`) : tr('Waiting for the next quarter…', 'Chờ mở quý tiếp…')}</p>
      )}
    </div>
  );
}

function FinalScreen({ room, session, me }: { room: CeoRoomDoc; session: Session; me: CeoMe | null }) {
  const { lang, t, tr } = useLang();
  const nav = useNavigate();
  const pid = session.playerId!;
  const st = room.standings[pid];
  const player = room.players[pid];
  const [busy, setBusy] = useState(false);
  const soloHost = Boolean(session.hostToken) && room.order.filter((id) => !room.players[id]?.bot).length === 1;
  const winner = rankedIds(room)[0];
  const crisis = me?.crisis ? CRISIS_CARDS[me.crisis] : null;
  async function again() {
    setBusy(true);
    try {
      const lti = getLti();
      const r = await api.createRoom({ game: 'ceo-sim', hostPlays: true, hostName: player?.name ?? 'CEO', settings: room.settings, ...(player?.lms && lti?.role === 'learner' ? { ltiSession: lti.session } : {}) });
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
        <p className="text-ink/60">
          {tr('Dashboard', 'Điểm chiến lược')} {st?.dashboard.toFixed(1)} · {tr('profit', 'lợi nhuận')} {st ? mil(st.profitCum, lang) : '–'} · PDR {st ? `${Math.round(st.pdr * 100)}%` : '–'}
        </p>
        {winner && winner !== pid && <p className="mt-1 text-sm text-ink/60">{tr('Leader', 'Dẫn đầu')}: {room.players[winner]?.name}</p>}
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
          <h2 className="mb-2 font-bold">{tr('Board scorecard', 'Thẻ mục tiêu của hội đồng quản trị')}</h2>
          <ScorecardBars sc={me.scorecard} />
        </div>
      )}
      {crisis && me?.crisisResult && (
        <div className="card space-y-1 text-[15px]">
          <h2 className="font-bold">🃏 {t(crisis.title)}</h2>
          <p>{tr('Response quality', 'Chất lượng xử lý')}: <b>{me.crisisResult.quality}/20</b></p>
          <p>
            {tr('Predictions', 'Dự đoán')}:{' '}
            {KPIS.map((k) => `${t(KPI_INFO[k])} ${me.crisisResult!.predictions[k] ? '✓' : '✗'}`).join(' · ')}
          </p>
        </div>
      )}
      <div className="card">
        <h2 className="mb-2 font-bold">{tr('Final standings', 'Bảng xếp hạng chung cuộc')}</h2>
        <CeoStandings room={room} me={pid} />
        <div className="mt-3">
          <ProfitChart room={room} me={pid} />
        </div>
      </div>
      <div className="card text-[15px] leading-relaxed">
        <h2 className="mb-2 font-bold">{tr('Debrief questions', 'Câu hỏi tổng kết')}</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {DEBRIEF.map(([en, vi]) => (
            <li key={en}>{tr(en, vi)}</li>
          ))}
        </ol>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {soloHost && <button type="button" className="btn-primary" disabled={busy} onClick={again}>{tr('Play again vs AI', 'Chơi lại với máy')}</button>}
        <Link to="/" className="btn-ghost">{tr('Home', 'Về trang chủ')}</Link>
      </div>
    </div>
  );
}
