// Game 8 – Peak Day Ops "11.11": the game-specific parts of the shared round-sim screens.
import { useState } from 'react';
import {
  PD_ARCHETYPE_INFO,
  PD_BADGES,
  PD_COD_INFO,
  PD_COSTS,
  PD_COST_INFO,
  PD_CS_CAPACITY,
  PD_CS_COST,
  PD_DEBRIEF,
  PD_FRAUD_INFO,
  PD_FULFIL_INFO,
  PD_LAST_YEAR,
  PD_RETURNS_INFO,
  PD_ROUNDS,
  PD_ROUND_INFO,
  PD_SCORE_PARTS,
  PD_SHOP_FORECAST,
  PD_SPEED_INFO,
  PD_UNIT_COST,
  type PdCod,
  type PdCost,
  type PdDecision,
  type PdFraud,
  type PdFulfil,
  type PdPub,
  type PdReport,
  type PdReturns,
  type PdSpeed,
  type PdView,
} from '@arena/pd';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { tx, type Lang } from '@arena/types';
import { useLang } from '../lib/i18n';
import { Choice, Kv, Stepper, colorOf, fmtNum, pctv, type RsWeb } from '../rs/parts';

type Me = RsMe<PdReport, PdView>;
const mv = (v: number, l: Lang, d = 0) => `${fmtNum(v, l, d)} ${l === 'en' ? 'm' : 'tr'}`;

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
          <p>{tr('You run the operations of a beauty shop for 11.11. Six shops share the same shoppers: if you sell out, they buy from a rival; if you are late or do not answer, your rating falls and so do your next sales.', 'Bạn điều hành vận hành của một cửa hàng mỹ phẩm cho ngày 11.11. Sáu cửa hàng chia nhau cùng nhóm người mua: hết hàng thì khách mua của đối thủ; giao trễ hoặc không trả lời thì điểm đánh giá giảm và doanh số sau đó cũng giảm.')}</p>
          <p>{tr('Round 1: prepare (stock, fulfilment, delivery promise, returns, fraud checks, COD). Rounds 2–4: the three 8-hour blocks of the sale day. Round 5: returns and leftover stock come back – and you diagnose your own P&L.', 'Vòng 1: chuẩn bị (tồn kho, giao vận, cam kết giao, đổi trả, kiểm tra gian lận, COD). Vòng 2–4: ba ca 8 giờ của ngày sale. Vòng 5: hàng hoàn và hàng tồn quay về – và bạn tự chẩn đoán lãi lỗ của mình.')}</p>
          <p>{tr('Scorecard: profit of the event 50, rating 20, diagnosis of your two biggest cost lines 20, stock discipline 10.', 'Thẻ mục tiêu: lợi nhuận đợt sale 50, điểm đánh giá 20, chẩn đoán đúng hai khoản chi phí lớn nhất 20, kỷ luật tồn kho 10.')}</p>
        </div>
      )}
    </div>
  );
}

function Form({ me, d, set, round }: { room: RsRoomDoc; me: Me | null; d: PdDecision; set: (d: PdDecision) => void; round: number }) {
  const { lang, t, tr } = useLang();
  const up = <K extends keyof PdDecision>(k: K, v: PdDecision[K]) => set({ ...d, [k]: v });
  const v = me?.view;
  if (round === 1)
    return (
      <div className="space-y-4">
        <div className="card space-y-2">
          <h2 className="font-bold">📦 {tr('Stock to buy', 'Lượng hàng nhập')}</h2>
          <Stepper label={tr('Units (200k each)', 'Sản phẩm (200 nghìn mỗi cái)')} value={d.stock ?? 0} onChange={(x) => up('stock', x)} max={10000} step={500} show={(x) => fmtNum(x, lang)} />
          <p className="text-xs text-ink/60">{tr(`Forecast for you ≈ ${fmtNum(PD_SHOP_FORECAST, 'en')} orders ±30% (last year ${fmtNum(PD_LAST_YEAR.orders, 'en')}). Cost of this stock: ${mv((d.stock ?? 0) * PD_UNIT_COST, 'en')}. Stock = forecast + safety stock.`, `Dự báo cho bạn ≈ ${fmtNum(PD_SHOP_FORECAST, 'vi')} đơn ±30% (năm ngoái ${fmtNum(PD_LAST_YEAR.orders, 'vi')}). Tiền hàng: ${mv((d.stock ?? 0) * PD_UNIT_COST, 'vi')}. Tồn kho = dự báo + tồn kho an toàn.`)}</p>
        </div>
        <div className="card space-y-2">
          <h2 className="font-bold">🚚 {tr('Fulfilment', 'Giao vận')}</h2>
          <Choice<PdFulfil> options={['self', '3pl', 'fbs']} value={d.fulfil ?? '3pl'} onChange={(x) => up('fulfil', x)} cols={1} label={(k) => t(PD_FULFIL_INFO[k].name)} note={(k) => t(PD_FULFIL_INFO[k].note)} />
          <p className="text-xs font-semibold text-ink/60">{tr('Delivery promise', 'Cam kết giao hàng')}</p>
          <Choice<PdSpeed> options={['standard', 'fast', 'sameday']} value={d.speed ?? 'fast'} onChange={(x) => up('speed', x)} label={(k) => t(PD_SPEED_INFO[k].name)} note={(k) => t(PD_SPEED_INFO[k].note)} />
        </div>
        <div className="card space-y-2">
          <h2 className="font-bold">↩️ {tr('Returns policy', 'Chính sách đổi trả')}</h2>
          <Choice<PdReturns> options={['strict', '7day', 'free30']} value={d.returns ?? '7day'} onChange={(x) => up('returns', x)} label={(k) => t(PD_RETURNS_INFO[k].name)} note={(k) => t(PD_RETURNS_INFO[k].note)} />
          <p className="text-xs font-semibold text-ink/60">{tr('Fraud checks', 'Kiểm tra gian lận')}</p>
          <Choice<PdFraud> options={['none', 'basic', 'strict']} value={d.fraud ?? 'basic'} onChange={(x) => up('fraud', x)} label={(k) => t(PD_FRAUD_INFO[k].name)} note={(k) => t(PD_FRAUD_INFO[k].note)} />
        </div>
        <CodCard d={d} up={up} />
      </div>
    );
  if (round <= 4) {
    const expected = (PD_SHOP_FORECAST * [0, 0, 0.32, 0.4, 0.28][round]!);
    return (
      <div className="space-y-4">
        <div className="card">
          <Kv
            rows={[
              [tr('Stock in the warehouse', 'Hàng trong kho'), fmtNum(v?.stock ?? 0, lang), (v?.stock ?? 0) < expected],
              [tr('Air freight on the way', 'Hàng nhập gấp đang về'), fmtNum(v?.incoming ?? 0, lang)],
              [tr('Rating', 'Điểm đánh giá'), `${fmtNum(v?.rating ?? 4.6, lang, 2)}★`, (v?.rating ?? 4.6) < 4.3],
              [tr('Expected demand this block (forecast)', 'Nhu cầu dự kiến ca này (dự báo)'), `≈ ${fmtNum(expected, lang)}`],
            ]}
          />
        </div>
        <div className="card space-y-2">
          <h2 className="font-bold">🏷️ {tr('Discount this block', 'Giảm giá ca này')}</h2>
          <Choice<0 | 10 | 20 | 30> options={[0, 10, 20, 30]} value={d.discount ?? 0} onChange={(x) => up('discount', x)} cols={2} label={(k) => (k ? tr(`${k}% off`, `Giảm ${k}%`) : tr('Full price', 'Giá gốc'))} />
          <p className="text-xs font-semibold text-ink/60">{tr('Ads push', 'Đẩy quảng cáo')}</p>
          <Choice<0 | 100 | 300> options={[0, 100, 300]} value={d.ads ?? 0} onChange={(x) => up('ads', x)} label={(k) => (k ? mv(k, lang) : tr('None', 'Không'))} />
        </div>
        <div className="card space-y-2">
          <h2 className="font-bold">🎧 {tr('Customer-service agents this block', 'Nhân viên chăm sóc khách ca này')}</h2>
          <Stepper label={tr(`Each handles ${PD_CS_CAPACITY} tickets (${PD_CS_COST}m)`, `Mỗi người xử lý ${PD_CS_CAPACITY} phiếu (${fmtNum(PD_CS_COST, 'vi', 1)} triệu)`)} value={d.cs ?? 0} onChange={(x) => up('cs', x)} max={40} step={1} show={(x) => String(x)} />
          <p className="text-xs text-ink/60">{tr('Tickets ≈ 6% of orders, more when parcels are late or COD fails.', 'Phiếu hỗ trợ ≈ 6% số đơn, nhiều hơn khi giao trễ hoặc COD thất bại.')}</p>
        </div>
        <CodCard d={d} up={up} />
        {round <= 3 && (
          <div className="card space-y-2">
            <h2 className="font-bold">✈️ {tr('Air-freight restock (+30k a unit)', 'Nhập gấp bằng đường hàng không (+30 nghìn mỗi sản phẩm)')}</h2>
            <Stepper label={round === 2 ? tr('Arrives for the evening block', 'Về kịp ca tối') : tr('Arrives after the sale!', 'Về sau đợt sale!')} value={d.expedite ?? 0} onChange={(x) => up('expedite', x)} max={3000} step={250} show={(x) => fmtNum(x, lang)} />
          </div>
        )}
      </div>
    );
  }
  const totals = v?.totals;
  const pick = (k: PdCost) => {
    const cur = d.diagnosis ?? [];
    up('diagnosis', cur.includes(k) ? cur.filter((x) => x !== k) : cur.length < 2 ? [...cur, k] : [cur[1]!, k]);
  };
  return (
    <div className="space-y-4">
      <div className="card">
        <Kv
          rows={[
            [tr('Leftover stock', 'Hàng tồn'), fmtNum(v?.stock ?? 0, lang)],
            [tr('Returns on their way back', 'Hàng hoàn đang về'), fmtNum(v?.pendingReturns ?? 0, lang)],
            [tr('Orders delivered', 'Đơn đã giao'), fmtNum(v?.ordersTotal ?? 0, lang)],
            [tr('Profit so far', 'Lợi nhuận đến giờ'), mv(v?.profitCum ?? 0, lang), (v?.profitCum ?? 0) < 0],
          ]}
        />
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">🧹 {tr('Leftover stock', 'Hàng tồn')}</h2>
        <Choice<0 | 30 | 50> options={[0, 30, 50]} value={d.clearance ?? 0} onChange={(x) => up('clearance', x)} label={(k) => (k ? tr(`Clear at ${k}% off`, `Xả giảm ${k}%`) : tr('Keep it', 'Giữ lại'))} note={(k) => (k === 50 ? tr('sells ~75%', 'bán được ~75%') : k === 30 ? tr('sells ~40%', 'bán được ~40%') : tr('written down 40%', 'giảm giá trị 40%'))} />
        <p className="text-xs font-semibold text-ink/60">{tr('Refunds', 'Hoàn tiền')}</p>
        <Choice<'fast' | 'slow'> options={['fast', 'slow']} value={d.refund ?? 'fast'} onChange={(x) => up('refund', x)} cols={2} label={(k) => (k === 'fast' ? tr('Fast (5k each)', 'Nhanh (5 nghìn mỗi đơn)') : tr('Slow (free)', 'Chậm (không tốn)'))} note={(k) => (k === 'slow' ? tr('Rating −0.15', 'Điểm đánh giá −0,15') : '')} />
        <Choice<'no' | 'yes'> options={['no', 'yes']} value={d.apology ? 'yes' : 'no'} onChange={(x) => up('apology', x === 'yes')} cols={2} label={(k) => (k === 'yes' ? tr('Apology voucher (20m)', 'Voucher xin lỗi (20 triệu)') : tr('No apology', 'Không xin lỗi'))} note={(k) => (k === 'yes' ? tr('Rating +0.1', 'Điểm đánh giá +0,1') : '')} />
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">🩺 {tr('Diagnosis: which TWO cost lines hurt your profit most over the whole event?', 'Chẩn đoán: HAI khoản chi phí nào làm giảm lợi nhuận nhiều nhất trong cả đợt?')}</h2>
        <p className="text-xs text-ink/60">{tr('Totals so far (returns and dead stock are still to come):', 'Tổng đến giờ (hoàn hàng và hàng tồn còn chưa tính):')}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PD_COSTS.map((k) => {
            const on = (d.diagnosis ?? []).includes(k);
            return (
              <button key={k} type="button" onClick={() => pick(k)} className={`rounded-xl px-2 py-2 text-left text-xs ring-1 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/10'}`}>
                <span className="block font-semibold">{on ? '✅ ' : ''}{t(PD_COST_INFO[k])}</span>
                <span className={on ? 'text-white/70' : 'text-ink/50'}>{totals ? mv(totals[k], lang) : '–'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CodCard({ d, up }: { d: PdDecision; up: <K extends keyof PdDecision>(k: K, v: PdDecision[K]) => void }) {
  const { t, tr } = useLang();
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">💵 {tr('Cash on delivery', 'Thanh toán khi nhận hàng (COD)')}</h2>
      <Choice<PdCod> options={['all', 'confirm', 'off']} value={d.cod ?? 'confirm'} onChange={(x) => up('cod', x)} cols={1} label={(k) => t(PD_COD_INFO[k].name)} note={(k) => t(PD_COD_INFO[k].note)} />
    </div>
  );
}

function Report({ report }: { report: PdReport; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  const b = report.block;
  return (
    <div className="card space-y-3">
      <h2 className="font-bold">📊 {t(PD_ROUND_INFO[report.round]!.title)}{report.defaulted ? <span className="ml-2 rounded bg-ink/10 px-1.5 text-xs font-normal">{tr('plan not submitted – default used', 'không nộp – dùng mặc định')}</span> : null}</h2>
      {b && (
        <Kv
          rows={[
            [tr('Shoppers who wanted you', 'Khách muốn mua của bạn'), `${fmtNum(b.demand, lang)}${b.viral ? ' 🔥' : ''}`],
            [tr('Orders taken', 'Đơn nhận được'), fmtNum(b.orders, lang)],
            [tr('Lost: sold out', 'Mất vì hết hàng'), fmtNum(b.lostStockout, lang), b.lostStockout > 0],
            [tr('Lost: COD calls / fraud blocks', 'Mất vì gọi xác nhận / chặn gian lận'), fmtNum(b.lostCod, lang)],
            [tr('Delivered', 'Giao thành công'), fmtNum(b.delivered, lang)],
            [tr('Failed COD', 'COD thất bại'), fmtNum(b.failedCod, lang), b.failedCod > 100],
            [tr('Late parcels', 'Đơn giao trễ'), fmtNum(b.late, lang), b.late > b.orders * 0.15],
            [tr('Tickets · unanswered', 'Phiếu hỗ trợ · chưa trả lời'), `${fmtNum(b.tickets, lang)} · ${fmtNum(b.unanswered, lang)}`, b.unanswered > 50],
          ]}
        />
      )}
      {report.round > 1 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/50">{tr('Money this round', 'Tiền vòng này')}</p>
          <Kv
            rows={[
              [tr('Revenue (after discounts and refunds)', 'Doanh thu (sau giảm giá và hoàn tiền)'), mv(report.revenue, lang)],
              [tr('Cost of goods', 'Giá vốn'), mv(-report.cogs, lang)],
              ...PD_COSTS.filter((k) => report.costs[k] !== 0).map((k) => [t(PD_COST_INFO[k]), mv(-report.costs[k], lang), k !== 'discount' && report.costs[k] > 100] as [string, string, boolean]),
              [tr('Profit this round', 'Lợi nhuận vòng này'), mv(report.profit, lang), report.profit < 0],
              [tr('Profit so far', 'Lợi nhuận lũy kế'), mv(report.profitCum, lang), report.profitCum < 0],
            ]}
          />
          <p className="mt-1 text-xs text-ink/50">{tr('Discounts are already deducted from revenue; shown for diagnosis.', 'Giảm giá đã trừ trong doanh thu; hiện ra để chẩn đoán.')}</p>
        </div>
      )}
      <Kv rows={[[tr('Stock left · air freight coming', 'Hàng còn · hàng nhập gấp đang về'), `${fmtNum(report.stockLeft, lang)} · ${fmtNum(report.incoming, lang)}`], [tr('Rating', 'Điểm đánh giá'), `${fmtNum(report.rating, lang, 2)}★`, report.rating < 4.3]]} />
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
  if (!v) return null;
  const sorted = PD_COSTS.slice().sort((a, b) => v.totals[b] - v.totals[a]);
  const growth = v.ordersTotal / PD_LAST_YEAR.orders - 1;
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">🩺 {tr('Operations diagnosis tree', 'Cây chẩn đoán vận hành')}</h2>
      <p className="text-sm">
        {tr('Orders', 'Số đơn')} <b>{growth >= 0 ? '+' : ''}{pctv(growth, lang)}</b> {tr('vs last year', 'so với năm ngoái')} · {tr('profit', 'lợi nhuận')} <b>{mv(v.profitCum, lang)}</b> ({tr('last year', 'năm ngoái')} {mv(PD_LAST_YEAR.profit, lang)})
      </p>
      <div className="grid gap-1 text-sm">
        {sorted.map((k, i) => (
          <div key={k} className={`flex justify-between ${i < 2 ? 'font-bold text-bad' : ''}`}>
            <span>{i + 1}. {t(PD_COST_INFO[k])}</span>
            <span className="tabular-nums">{mv(v.totals[k], lang)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Market({ room, me, big }: { room: RsRoomDoc; me?: string; big?: boolean }) {
  const { lang, tr } = useLang();
  const pub = room.pub as unknown as Partial<PdPub>;
  if (!pub.orders) return null;
  const ids = room.order.slice().sort((a, b) => (pub.orders![b] ?? 0) - (pub.orders![a] ?? 0));
  const max = Math.max(1, ...ids.map((id) => pub.orders![id] ?? 0));
  return (
    <div>
      <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🛒 {tr('Orders delivered so far', 'Đơn đã giao đến giờ')}</h2>
      <div className="grid gap-1.5">
        {ids.map((id) => (
          <div key={id} className={`grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'} ${id === me ? 'font-bold' : ''}`}>
            <span className="truncate">{room.players[id]?.name}{pub.viral?.includes(id) ? ' 🔥' : ''}</span>
            <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
              <div className="h-full rounded-full" style={{ width: `${((pub.orders![id] ?? 0) / max) * 100}%`, background: colorOf(room, id) }} />
            </div>
            <span className="text-right tabular-nums text-ink/70">
              {fmtNum(pub.orders![id] ?? 0, lang)} · {fmtNum(pub.rating?.[id] ?? 0, lang, 2)}★ · −{pub.discount?.[id] ?? 0}%{pub.stockout?.[id] ? ` · ${tr('sold out', 'hết hàng')}` : ''}
            </span>
          </div>
        ))}
      </div>
      <p className={`mt-1 text-ink/50 ${big ? 'text-base' : 'text-xs'}`}>{tr('Orders · rating · discount · 🔥 viral', 'Đơn · đánh giá · giảm giá · 🔥 viral')}</p>
    </div>
  );
}

export const PD_WEB: RsWeb<PdDecision, PdReport, PdView> = {
  id: 'peak-day',
  tag: 'Game 8 · Peak Day Ops 11.11',
  roundWord: tx('Round', 'Vòng'),
  rounds: PD_ROUNDS,
  Briefing,
  roundInfo: (r) => PD_ROUND_INFO[r] ?? PD_ROUND_INFO[1]!,
  initial: (me, round) => {
    const pending = me?.pending as PdDecision | null;
    if (pending) return { ...pending };
    if (round === 1) return { stock: 3500, fulfil: '3pl', speed: 'fast', returns: '7day', fraud: 'basic', cod: 'confirm' };
    if (round <= 4) {
      const last = me?.reports.at(-1)?.decision;
      return { cod: last?.cod ?? 'confirm', cs: last?.cs ?? 5, discount: last?.discount ?? 10, ads: last?.ads ?? 100 };
    }
    return { clearance: 30, refund: 'fast', apology: false, diagnosis: [] };
  },
  check: (d, _me, round) => (round === 5 && (d.diagnosis ?? []).length !== 2 ? tx('Pick exactly two cost lines for your diagnosis.', 'Chọn đúng hai khoản chi phí để chẩn đoán.') : null),
  Form,
  Report,
  Market,
  Reveal,
  cols: [
    { key: 'profitCum', label: tx('Profit (cum.)', 'Lợi nhuận lũy kế'), fmt: (v, l) => mv(v, l), bad: (v) => v < 0 },
    { key: 'orders', label: tx('Orders', 'Đơn'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'rating', label: tx('Rating', 'Đánh giá'), fmt: (v, l) => `${fmtNum(v, l, 2)}★`, bad: (v) => v < 4.3 },
    { key: 'stock', label: tx('Stock', 'Tồn kho'), fmt: (v, l) => fmtNum(v, l) },
  ],
  chart: { title: tx('Cumulative profit of the event (m VND)', 'Lợi nhuận lũy kế của đợt sale (triệu đồng)'), fmt: (v, l) => mv(v, l) },
  scoreParts: PD_SCORE_PARTS,
  scoreMax: { profit: 50, rating: 20, diagnosis: 20, ops: 10 },
  badges: PD_BADGES,
  archetypes: PD_ARCHETYPE_INFO,
  debrief: PD_DEBRIEF,
  scoring: [
    ['5 rounds: prepare, three 8-hour sale blocks, then the bill 14 days later. Six shops share the same 11.11 shoppers.', '5 vòng: chuẩn bị, ba ca 8 giờ của ngày sale, rồi hóa đơn sau 14 ngày. Sáu cửa hàng chia nhau cùng nhóm người mua 11.11.'],
    ['Event profit 50 points (0 at a 200m loss, full at +500m). Last year: 2,400 orders and 250m profit.', 'Lợi nhuận đợt sale 50 điểm (0 khi lỗ 200 triệu, tối đa khi lãi 500 triệu). Năm ngoái: 2.400 đơn, lãi 250 triệu.'],
    ['Rating 20 (late parcels, unanswered tickets and failed COD pull it down).', 'Điểm đánh giá 20 (giao trễ, phiếu hỗ trợ không trả lời và COD thất bại kéo điểm xuống).'],
    ['Diagnosis 20: name the two biggest cost lines of your own event. Stock discipline 10: never sold out, under 25% of stock left over.', 'Chẩn đoán 20: chỉ ra hai khoản chi phí lớn nhất của chính bạn. Kỷ luật tồn kho 10: không hết hàng, hàng tồn dưới 25%.'],
    ['Moodle grade = 70% scorecard + 30% rank in the room.', 'Điểm Moodle = 70% thẻ mục tiêu + 30% thứ hạng trong phòng.'],
  ],
  source: tx('Textbook Chapter 8 (payment portfolio and COD hidden costs, safety stock, fulfilment models, last mile, returns, operations diagnosis, Coupang)', 'Giáo trình Chương 8 (danh mục thanh toán và chi phí ẩn của COD, tồn kho an toàn, mô hình giao vận, chặng cuối, hoàn hàng, chẩn đoán vận hành, Coupang)'),
};
