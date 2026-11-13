// Game 7 – Ad Auction & Creator Clash: the game-specific parts of the shared round-sim screens.
import { useState } from 'react';
import {
  AD_ARCHETYPE_INFO,
  AD_BADGES,
  AD_BUDGET,
  AD_CHANNELS,
  AD_CHANNEL_INFO,
  AD_CRM_INFO,
  AD_DEBRIEF,
  AD_HOLDOUT_COST,
  AD_LIVE_FEE,
  AD_MAX_CREATORS,
  AD_QUALITY_COST,
  AD_ROUNDS,
  AD_ROUND_INFO,
  AD_SCORE_PARTS,
  AD_TIER_INFO,
  type AdChannel,
  type AdCrm,
  type AdDecision,
  type AdPub,
  type AdReport,
  type AdView,
} from '@arena/ad';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { tx, type Lang } from '@arena/types';
import { useLang } from '../lib/i18n';
import { Choice, Kv, Stepper, colorOf, fmtNum, pctv, type RsWeb } from '../rs/parts';

type Me = RsMe<AdReport, AdView>;
const mv = (v: number, l: Lang, d = 0) => `${fmtNum(v, l, d)} ${l === 'en' ? 'm' : 'tr'}`;
/** Thousands (people / followers / views). */
const kn = (v: number, l: Lang, d = 0) => (l === 'en' ? `${fmtNum(v, l, d)}k` : `${fmtNum(v, l, d)} nghìn`);
const kvnd = (v: number, l: Lang) => `${fmtNum(v, l, 1)}${l === 'en' ? 'k' : ' nghìn'}`;
const START: AdDecision = { bid: 3, searchBudget: 400, quality: 1, creators: [], premium: false, retarget: 200, liveHours: 0, liveDiscount: 0, crm: 'none', holdout: 'none' };

function spend(d: AdDecision, pub: Partial<AdPub>) {
  const fees = d.creators.reduce((a, id) => a + (pub.roster?.find((c) => c.id === id)?.fee ?? 0) * (d.premium ? 1.2 : 1), 0);
  return d.searchBudget + AD_QUALITY_COST[d.quality]! + fees + d.retarget + (d.liveHours / 2) * AD_LIVE_FEE + (d.crm === 'rfm' ? 30 : d.crm === 'blast' ? 10 : 0) + (d.holdout !== 'none' ? AD_HOLDOUT_COST : 0);
}

function Briefing({ compact }: { compact?: boolean }) {
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
          <p>{tr('You are the marketing lead of a serum brand. Six brands compete for 5 months; each has VND 2 bn of marketing per month. AOV 500k, contribution margin 40%.', 'Bạn phụ trách marketing một thương hiệu serum. Sáu thương hiệu cạnh tranh trong 5 tháng, mỗi tháng có 2 tỷ đồng marketing. Giá trị đơn 500 nghìn, biên lợi nhuận đóng góp 40%.')}</p>
          <p>{tr('Channels: a shared search auction (rank = bid × quality score), creators (only one brand can book each), retargeting, livestream and CRM. Every channel reports its own ROAS – and they all claim the same orders.', 'Các kênh: đấu giá tìm kiếm chung (thứ hạng = giá thầu × điểm chất lượng), nhà sáng tạo (mỗi người chỉ một thương hiệu đặt được), quảng cáo nhắm lại, livestream và CRM. Kênh nào cũng tự báo ROAS – và đều nhận cùng những đơn hàng.')}</p>
          <p>{tr('Scorecard: extra contribution profit over doing nothing (50), customers who will come back (20), measurement discipline (30: break-even ROAS, no fake creators, retargeting ≤ 25% of spend, at least one holdout test).', 'Thẻ mục tiêu: lợi nhuận đóng góp tăng thêm so với không làm gì (50), khách sẽ quay lại (20), kỷ luật đo lường (30: ROAS hòa vốn, không thuê creator ảo, nhắm lại ≤ 25% chi tiêu, ít nhất một thử nghiệm đối chứng).')}</p>
        </div>
      )}
    </div>
  );
}

function Form({ room, me, d, set, round }: { room: RsRoomDoc; me: Me | null; d: AdDecision; set: (d: AdDecision) => void; round: number }) {
  const { lang, t, tr } = useLang();
  const pub = room.pub as unknown as Partial<AdPub>;
  const up = <K extends keyof AdDecision>(k: K, v: AdDecision[K]) => set({ ...d, [k]: v });
  const total = spend(d, pub);
  const [beText, setBeText] = useState(d.beRoas !== undefined ? String(d.beRoas) : '');
  const pid = me?.playerId;
  const toggleCreator = (id: string) => up('creators', d.creators.includes(id) ? d.creators.filter((x) => x !== id) : d.creators.length < AD_MAX_CREATORS ? [...d.creators, id] : d.creators);
  return (
    <div className="space-y-4">
      <div className={`card sticky top-0 z-10 ${total > AD_BUDGET ? 'ring-2 ring-bad' : ''}`}>
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{tr('Budget used', 'Ngân sách đã dùng')}</span>
          <span className={`tabular-nums ${total > AD_BUDGET ? 'text-bad' : ''}`}>{mv(total, lang)} / {mv(AD_BUDGET, lang)}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10"><div className={`h-full ${total > AD_BUDGET ? 'bg-bad' : 'bg-amber'}`} style={{ width: `${Math.min(100, (total / AD_BUDGET) * 100)}%` }} /></div>
        <p className="mt-1 text-xs text-ink/50">{tr('Unspent budget is not lost: profit counts, not spend.', 'Không cần tiêu hết: tính lợi nhuận, không tính mức chi.')}</p>
      </div>
      {round === 1 && (
        <div className="card space-y-2">
          <h2 className="font-bold">🎯 {tr('Your break-even ROAS', 'ROAS hòa vốn của bạn')}</h2>
          <p className="text-sm text-ink/70">{tr('AOV 500k, contribution margin 40% before marketing. Below which ROAS does a campaign lose money?', 'Giá trị đơn 500 nghìn, biên lợi nhuận đóng góp 40% trước marketing. ROAS dưới mức nào thì chiến dịch lỗ?')}</p>
          <input
            className="input w-32 text-lg font-bold"
            inputMode="decimal"
            value={beText}
            placeholder="?"
            aria-label={tr('Break-even ROAS', 'ROAS hòa vốn')}
            onChange={(e) => {
              setBeText(e.target.value);
              const v = Number(e.target.value.replace(',', '.'));
              const next = { ...d };
              if (Number.isFinite(v) && v > 0) next.beRoas = v;
              else delete next.beRoas;
              set(next);
            }}
          />
        </div>
      )}
      <div className="card space-y-3">
        <h2 className="font-bold">🔍 {tr('Search ads (shared auction)', 'Quảng cáo tìm kiếm (đấu giá chung)')}</h2>
        <Stepper label={tr('Max CPC', 'Giá thầu tối đa mỗi nhấp')} value={d.bid} onChange={(v) => up('bid', v)} min={0.5} max={15} step={0.5} show={(v) => kvnd(v, lang)} />
        <Stepper label={tr('Monthly search budget', 'Ngân sách tìm kiếm tháng')} value={d.searchBudget} onChange={(v) => up('searchBudget', v)} max={1500} step={50} show={(v) => mv(v, lang)} />
        <p className="text-xs font-semibold text-ink/60">{tr(`Landing page & ad quality (quality score now ${me?.view?.qs ?? 5}/10)`, `Chất lượng trang đích & quảng cáo (điểm chất lượng hiện ${me?.view?.qs ?? 5}/10)`)}</p>
        <Choice<0 | 1 | 2> options={[0, 1, 2]} value={d.quality} onChange={(v) => up('quality', v)} label={(k) => (k === 0 ? tr('No work', 'Không làm') : mv(AD_QUALITY_COST[k]!, lang))} note={(k) => (k === 0 ? tr('Quality fades', 'Chất lượng giảm dần') : k === 1 ? tr('Some fixes', 'Sửa một phần') : tr('Full rebuild', 'Làm lại toàn bộ'))} />
        {pid && pub.position?.[pid] !== undefined && round > 1 && (
          <p className="text-xs text-ink/60">{tr('Last month', 'Tháng trước')}: {pub.position[pid] ? tr(`position ${pub.position[pid]}, CPC ${kvnd(pub.cpc?.[pid] ?? 0, 'en')}`, `vị trí ${pub.position[pid]}, giá mỗi nhấp ${kvnd(pub.cpc?.[pid] ?? 0, 'vi')}`) : tr('no ad slot won', 'không có vị trí quảng cáo')}</p>
        )}
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">🎥 {tr(`Creators this month (book up to ${AD_MAX_CREATORS})`, `Nhà sáng tạo tháng này (đặt tối đa ${AD_MAX_CREATORS})`)}</h2>
        <div className="grid gap-1.5">
          {(pub.roster ?? []).map((c) => {
            const on = d.creators.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggleCreator(c.id)} className={`rounded-xl px-3 py-2 text-left text-xs ring-1 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/10'}`}>
                <span className="flex justify-between gap-2 font-semibold">
                  <span>{on ? '✅ ' : ''}{c.handle} · {t(AD_TIER_INFO[c.tier])}</span>
                  <span>{mv(c.fee, lang)}</span>
                </span>
                <span className={`block ${on ? 'text-white/70' : 'text-ink/50'}`}>{t(c.niche)}</span>
                <span className={`block tabular-nums ${on ? 'text-white/85' : 'text-ink/70'}`}>
                  {tr('followers', 'follower')} {kn(c.followers, lang)} · {tr('avg views', 'xem TB')} {kn(c.avgViews, lang)} · ER {pctv(c.er, lang, 1)} · {tr('generic comments', 'bình luận chung chung')} {pctv(c.generic, lang)} · {tr('30-day growth', 'tăng 30 ngày')} {pctv(c.growth, lang)}
                </span>
              </button>
            );
          })}
        </div>
        <Choice<'no' | 'yes'> options={['no', 'yes']} value={d.premium ? 'yes' : 'no'} onChange={(v) => up('premium', v === 'yes')} cols={2} label={(k) => (k === 'yes' ? tr('Pay +20% to win clashes', 'Trả thêm 20% để giành creator') : tr('Standard fee', 'Phí thường'))} note={(k) => (k === 'yes' ? tr('Wins if another brand wants the same creator', 'Thắng khi thương hiệu khác cũng muốn') : tr('Random if two brands collide', 'Ngẫu nhiên nếu hai bên trùng'))} />
      </div>
      <div className="card space-y-3">
        <h2 className="font-bold">🎯 {tr('Retargeting', 'Quảng cáo nhắm lại')}</h2>
        <Stepper label={tr('Budget', 'Ngân sách')} value={d.retarget} onChange={(v) => up('retarget', v)} max={1500} step={50} show={(v) => mv(v, lang)} />
        <p className="text-xs text-ink/60">{tr('Reaches people who already visited you this month. Its reported ROAS is always high.', 'Tiếp cận người đã ghé cửa hàng trong tháng. ROAS được báo cáo luôn cao.')}</p>
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">📺 {tr('Livestream', 'Livestream')}</h2>
        <Choice<0 | 2 | 4> options={[0, 2, 4]} value={d.liveHours} onChange={(v) => up('liveHours', v)} label={(k) => (k ? tr(`${k} hours`, `${k} giờ`) : tr('None', 'Không'))} note={(k) => (k ? mv((k / 2) * AD_LIVE_FEE, lang) : '')} />
        {d.liveHours > 0 && <Choice<0 | 10 | 20 | 30> options={[0, 10, 20, 30]} value={d.liveDiscount} onChange={(v) => up('liveDiscount', v)} cols={2} label={(k) => (k ? tr(`${k}% off`, `Giảm ${k}%`) : tr('No discount', 'Không giảm giá'))} />}
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">💌 {tr(`Existing customers (${fmtNum(me?.view?.customers ?? 4, lang, 1)}k)`, `Khách cũ (${fmtNum(me?.view?.customers ?? 4, lang, 1)} nghìn)`)}</h2>
        <Choice<AdCrm> options={['none', 'blast', 'rfm']} value={d.crm} onChange={(v) => up('crm', v)} cols={1} label={(k) => t(AD_CRM_INFO[k].name)} note={(k) => t(AD_CRM_INFO[k].note)} />
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">🧪 {tr(`Holdout test (${AD_HOLDOUT_COST}m)`, `Thử nghiệm nhóm đối chứng (${AD_HOLDOUT_COST} triệu)`)}</h2>
        <p className="text-xs text-ink/60">{tr('Switch one channel off for a random 10% of people to measure what it really adds (incremental ROAS).', 'Tắt một kênh với 10% người ngẫu nhiên để đo phần nó thực sự tạo thêm (ROAS tăng thêm).')}</p>
        <Choice<AdChannel | 'none'> options={['none', ...AD_CHANNELS]} value={d.holdout} onChange={(v) => up('holdout', v)} cols={2} label={(k) => (k === 'none' ? tr('No test', 'Không thử') : t(AD_CHANNEL_INFO[k]))} />
      </div>
      {round > 1 && <div className="card"><Market room={room} me={pid} /></div>}
    </div>
  );
}

function Report({ report }: { report: AdReport; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  return (
    <div className="card space-y-3">
      <h2 className="font-bold">📊 {tr(`Month ${report.round}: your brand`, `Tháng ${report.round}: thương hiệu của bạn`)}{report.defaulted ? <span className="ml-2 rounded bg-ink/10 px-1.5 text-xs font-normal">{tr('plan not submitted – last plan reused', 'không nộp – dùng lại kế hoạch cũ')}</span> : null}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-ink/60">
            <tr>
              <th className="py-1 pr-2">{tr('Channel', 'Kênh')}</th>
              <th className="py-1 pr-2 text-right">{tr('Spend', 'Chi')}</th>
              <th className="py-1 pr-2 text-right">{tr('Reported revenue', 'Doanh thu báo cáo')}</th>
              <th className="py-1 text-right">{tr('Reported ROAS', 'ROAS báo cáo')}</th>
            </tr>
          </thead>
          <tbody>
            {AD_CHANNELS.filter((k) => report.channels[k].spend > 0 || report.channels[k].orders > 0).map((k) => {
              const c = report.channels[k];
              return (
                <tr key={k} className="border-t border-ink/10">
                  <td className="py-1 pr-2">{t(AD_CHANNEL_INFO[k])}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{mv(c.spend, lang)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{mv(c.reportedRevenue, lang)}</td>
                  <td className="py-1 text-right font-semibold tabular-nums">{c.spend > 0 ? fmtNum(c.reportedRoas, lang, 2) : '–'}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-ink/30 font-semibold">
              <td className="py-1 pr-2">{tr('Sum of reports', 'Tổng các báo cáo')}</td>
              <td />
              <td className="py-1 pr-2 text-right tabular-nums text-bad">{mv(report.sumReported, lang)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <Kv
        rows={[
          [tr('REAL revenue', 'Doanh thu THẬT'), mv(report.revenue, lang)],
          [tr('Total marketing spend', 'Tổng chi marketing'), mv(report.spend, lang)],
          [tr('Blended ROAS (real revenue ÷ spend)', 'ROAS tổng hợp (doanh thu thật ÷ chi)'), fmtNum(report.blendedRoas, lang, 2)],
          [tr('Orders (of which organic)', 'Đơn hàng (trong đó tự nhiên)'), `${fmtNum(report.orders, lang)} (${fmtNum(report.organic, lang)})`],
          [tr('Discounts given', 'Tiền giảm giá'), mv(report.discountCost, lang), report.discountCost > 100],
          [tr('Contribution profit after marketing', 'Lợi nhuận đóng góp sau marketing'), mv(report.profit, lang), report.profit < 800],
          [tr('Search: position · quality score · CPC', 'Tìm kiếm: vị trí · điểm chất lượng · giá mỗi nhấp'), `${report.position ?? '–'} · ${fmtNum(report.qs, lang, 1)} · ${kvnd(report.cpc, lang)}`],
          [tr('Creators booked', 'Creator đã đặt'), report.booked.join(', ') || '–'],
          [tr('Customers · waiting for sales', 'Khách hàng · đang chờ sale'), `${kn(report.customers, lang, 1)} · ${pctv(report.waitShare, lang)}`, report.waitShare > 0.15],
        ]}
      />
      <p className="text-xs text-ink/50">{tr('Doing no marketing at all earns about 800m a month from organic orders.', 'Không làm marketing gì vẫn có khoảng 800 triệu mỗi tháng từ đơn tự nhiên.')}</p>
      {report.holdout && (
        <p className="rounded-xl bg-ok/10 p-2 text-sm">
          🧪 {t(AD_CHANNEL_INFO[report.holdout.channel])}: {tr('incremental ROAS', 'ROAS tăng thêm')} <b>{fmtNum(report.holdout.incrementalRoas, lang, 2)}</b> {tr('vs reported', 'so với báo cáo')} {fmtNum(report.channels[report.holdout.channel].reportedRoas, lang, 2)}
        </p>
      )}
      {report.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber/10 p-3 text-sm">
          {report.notes.map((n, i) => <li key={i}>💡 {t(n)}</li>)}
        </ul>
      )}
    </div>
  );
}

function Reveal({ me }: { me: Me; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  const v = me.view;
  if (!v?.fakes) return null;
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">🔓 {tr('Behind the follower counts', 'Đằng sau số follower')}</h2>
      <div className="grid gap-1 text-sm">
        {Object.entries(v.fakes)
          .sort((a, b) => b[1] - a[1])
          .map(([h, f]) => (
            <div key={h} className="flex justify-between">
              <span>{h}</span>
              <span className={`tabular-nums ${f > 0.3 ? 'font-bold text-bad' : 'text-ink/60'}`}>{pctv(f, lang)} {tr('fake', 'ảo')}</span>
            </div>
          ))}
      </div>
      {v.incremental && Object.keys(v.incremental).length > 0 && (
        <p className="text-sm">
          {tr('Your holdout tests', 'Các thử nghiệm đối chứng của bạn')}: {Object.entries(v.incremental).map(([k, x]) => `${t(AD_CHANNEL_INFO[k as AdChannel])} ${fmtNum(x!, lang, 2)}`).join(' · ')}
        </p>
      )}
      <p className="text-sm">{tr('Your break-even ROAS answer', 'Câu trả lời ROAS hòa vốn của bạn')}: {v.beRoas !== null ? fmtNum(v.beRoas, lang, 1) : '–'} · {tr('right answer', 'đáp án')} 2,5 = 1 ÷ 0,4</p>
    </div>
  );
}

function Market({ room, me, big }: { room: RsRoomDoc; me?: string; big?: boolean }) {
  const { lang, tr } = useLang();
  const pub = room.pub as unknown as Partial<AdPub>;
  if (!pub.position || !Object.keys(pub.position).length) return null;
  const ids = room.order.slice().sort((a, b) => (pub.position![a] || 9) - (pub.position![b] || 9));
  const byBrand: Record<string, string[]> = {};
  for (const [h, id] of Object.entries(pub.bookings ?? {})) (byBrand[id] ??= []).push(h);
  return (
    <div>
      <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🏁 {tr('Last month: search auction and creator bookings', 'Tháng trước: đấu giá tìm kiếm và đặt creator')}</h2>
      <div className="grid gap-1">
        {ids.map((id) => (
          <div key={id} className={`grid grid-cols-[7.5rem_auto_1fr] items-center gap-2 ${big ? 'text-xl' : 'text-sm'} ${id === me ? 'font-bold' : ''}`}>
            <span className="truncate"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: colorOf(room, id) }} />{room.players[id]?.name}</span>
            <span className="tabular-nums text-ink/70">{pub.position![id] ? `#${pub.position![id]} · ${kvnd(pub.cpc?.[id] ?? 0, lang)}` : tr('no slot', 'không có vị trí')}</span>
            <span className="truncate text-ink/60">{(byBrand[id] ?? []).join(', ')} · {mv(pub.spend?.[id] ?? 0, lang)}</span>
          </div>
        ))}
      </div>
      <p className={`mt-1 text-ink/50 ${big ? 'text-base' : 'text-xs'}`}>{tr('Position · CPC paid · creators booked · total spend', 'Vị trí · giá mỗi nhấp đã trả · creator đã đặt · tổng chi')}</p>
    </div>
  );
}

export const AD_WEB: RsWeb<AdDecision, AdReport, AdView> = {
  id: 'ad-clash',
  tag: 'Game 7 · Ad Auction & Creator Clash',
  roundWord: tx('Month', 'Tháng'),
  rounds: AD_ROUNDS,
  Briefing,
  roundInfo: (r) => AD_ROUND_INFO[r] ?? AD_ROUND_INFO[1]!,
  initial: (me, round) => {
    const pending = me?.pending as AdDecision | null;
    const base = pending ?? me?.reports.at(-1)?.decision ?? START;
    const d: AdDecision = { ...base, creators: pending ? base.creators.slice() : [], holdout: pending ? base.holdout : 'none' };
    if (round !== 1) delete d.beRoas;
    return d;
  },
  check: (d, _me, round, room) => {
    if (round === 1 && d.beRoas === undefined) return tx('Enter your break-even ROAS first.', 'Hãy nhập ROAS hòa vốn trước.');
    if (spend(d, room.pub as unknown as Partial<AdPub>) > AD_BUDGET) return tx(`Over budget: at most ${AD_BUDGET}m this month.`, `Vượt ngân sách: tối đa ${AD_BUDGET} triệu trong tháng.`);
    return null;
  },
  Form,
  Report,
  Market,
  Reveal,
  cols: [
    { key: 'profitCum', label: tx('Profit (cum.)', 'Lợi nhuận lũy kế'), fmt: (v, l) => mv(v, l), bad: (v) => v < 0 },
    { key: 'customers', label: tx('Customers', 'Khách hàng'), fmt: (v, l) => kn(v, l, 1) },
    { key: 'wait', label: tx('Waiting for sales', 'Chờ sale'), fmt: (v, l) => pctv(v, l), bad: (v) => v > 0.15 },
  ],
  chart: { title: tx('Monthly contribution profit after marketing (m VND)', 'Lợi nhuận đóng góp sau marketing theo tháng (triệu đồng)'), fmt: (v, l) => mv(v, l) },
  scoreParts: AD_SCORE_PARTS,
  scoreMax: { profit: 50, customers: 20, discipline: 30 },
  badges: AD_BADGES,
  archetypes: AD_ARCHETYPE_INFO,
  debrief: AD_DEBRIEF,
  scoring: [
    ['5 months, VND 2 bn of marketing per month, AOV 500k, contribution margin 40%. Month 1 starts with one question: your break-even ROAS.', '5 tháng, mỗi tháng 2 tỷ đồng marketing, giá trị đơn 500 nghìn, biên lợi nhuận đóng góp 40%. Tháng 1 bắt đầu bằng một câu hỏi: ROAS hòa vốn của bạn.'],
    ['Extra contribution profit over doing nothing (≈ 800m a month): 50 points, full at +2.5 bn over the game.', 'Lợi nhuận đóng góp tăng thêm so với không làm gì (≈ 800 triệu mỗi tháng): 50 điểm, tối đa khi cả trận +2,5 tỷ.'],
    ['Customers who will come back: 20 points, reduced by the share of customers trained to wait for discounts.', 'Khách sẽ quay lại: 20 điểm, bị giảm theo tỷ lệ khách đã quen chờ giảm giá.'],
    ['Measurement discipline 30: right break-even ROAS (10), no fake-follower creators (10), retargeting ≤ 25% of spend (5), at least one holdout test (5).', 'Kỷ luật đo lường 30: đúng ROAS hòa vốn (10), không thuê creator có follower ảo (10), nhắm lại ≤ 25% chi tiêu (5), ít nhất một thử nghiệm đối chứng (5).'],
    ['Moodle grade = 70% scorecard + 30% rank in the room.', 'Điểm Moodle = 70% thẻ mục tiêu + 30% thứ hạng trong phòng.'],
  ],
  source: tx('Textbook Chapter 7 (search auction, break-even ROAS, creator tiers and funnel, retargeting, livestream, RFM, attribution vs incrementality, SHEIN)', 'Giáo trình Chương 7 (đấu giá tìm kiếm, ROAS hòa vốn, phân hạng và phễu creator, nhắm lại, livestream, RFM, ghi nhận và tăng thêm, SHEIN)'),
};
