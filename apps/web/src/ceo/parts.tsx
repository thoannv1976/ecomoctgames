import { useEffect, useRef, useState } from 'react';
import { ARCHETYPE_INFO, CHANNELS, CHANNEL_INFO, type CeoKpis, type CeoMe, type CeoRoomDoc, type CeoScorecard } from '@arena/ceo';
import type { Lang } from '@arena/types';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';

export const asCeo = (room: unknown) => room as CeoRoomDoc;
export const isCeoRoom = (room: unknown) => (room as { game?: string } | null | undefined)?.game === 'ceo-sim';

const grp = (v: number, l: Lang, d = 0) => {
  const s = Math.abs(v).toFixed(d);
  const [i, f] = s.split('.');
  const int = i!.replace(/\B(?=(\d{3})+(?!\d))/g, l === 'en' ? ',' : '.');
  return (v < 0 && Number(s) !== 0 ? '−' : '') + int + (f ? (l === 'en' ? '.' : ',') + f : '');
};
/** Million VND. */
export const mil = (v: number, l: Lang) => (Math.abs(v) >= 1000 ? `${grp(v / 1000, l, 2)} ${l === 'en' ? 'bn' : 'tỷ'}` : `${grp(v, l, 0)} ${l === 'en' ? 'm' : 'tr'}`);
export const num = (v: number, l: Lang) => grp(v, l, 0);
export const pct = (v: number, l: Lang, d = 0) => `${grp(v * 100, l, d)}%`;

export const COLORS = ['#f2a900', '#0e9f6e', '#2a5680', '#d64545', '#8b5cf6', '#0ea5e9'];
export const colorOf = (room: CeoRoomDoc, id: string) => COLORS[Math.max(0, room.order.indexOf(id)) % COLORS.length]!;
export const rankedIds = (room: CeoRoomDoc) => room.order.slice().sort((a, b) => (room.standings[a]?.rank ?? 99) - (room.standings[b]?.rank ?? 99));

export function useCeoMe(room: CeoRoomDoc, playerId?: string, playerToken?: string) {
  const [me, setMe] = useState<CeoMe | null>(null);
  const key = `${room.status}:${room.round}:${room.history.length}`;
  useEffect(() => {
    if (!playerId || !playerToken || room.status === 'lobby') return;
    let alive = true;
    api
      .ceoMe(room.code, playerId, playerToken)
      .then((m) => alive && setMe(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key, room.code, playerId, playerToken, room.status]);
  return me;
}

export function useCeoAutoAdvance(room: CeoRoomDoc | null, now: number, hostToken?: string) {
  const sent = useRef('');
  useEffect(() => {
    if (!room) return;
    let due: number | null = null;
    if (room.status === 'decide' && room.deadline !== null) due = room.deadline + 300;
    if (room.status === 'results' && room.revealedAt && room.settings.resultsSec > 0) due = room.revealedAt + room.settings.resultsSec * 1000 + 300;
    if (due === null || now < due) return;
    const tag = `${room.status}:${room.round}:${Math.floor((now - due) / 4000)}`;
    if (sent.current === tag) return;
    sent.current = tag;
    const { code, status, round } = room;
    setTimeout(() => void api.advance(code, { ...(hostToken ? { hostToken } : {}), expectStatus: status, expectRound: round }).catch(() => undefined), Math.random() * 400);
  }, [room, now, hostToken]);
}

export function Countdown({ deadline, now, big }: { deadline: number | null; now: number; big?: boolean }) {
  const { tr } = useLang();
  if (deadline === null) return <span className={`font-semibold text-ink/60 ${big ? 'text-2xl' : 'text-sm'}`}>{tr('No time limit', 'Không giới hạn thời gian')}</span>;
  const left = Math.max(0, deadline - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return <span className={`font-extrabold tabular-nums ${big ? 'text-5xl' : 'text-2xl'} ${left < 30000 ? 'text-bad' : ''}`}>{m}:{String(s).padStart(2, '0')}</span>;
}

export function CeoStandings({ room, me, big }: { room: CeoRoomDoc; me?: string; big?: boolean }) {
  const { lang, t, tr } = useLang();
  const ids = rankedIds(room);
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${big ? 'text-xl' : 'text-sm'}`}>
        <thead className="text-left text-ink/60">
          <tr>
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">{tr('Company', 'Công ty')}</th>
            <th className="py-1 pr-2 text-right">{tr('Dashboard', 'Điểm chiến lược')}</th>
            <th className="py-1 pr-2 text-right">{tr('Profit (cum.)', 'Lợi nhuận lũy kế')}</th>
            <th className="py-1 pr-2 text-right">{tr('Cash', 'Tiền mặt')}</th>
            <th className="py-1 pr-2 text-right">★</th>
            <th className="py-1 text-right">PDR</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const p = room.players[id]!;
            const s = room.standings[id];
            return (
              <tr key={id} className={`border-t border-ink/10 ${id === me ? 'bg-amber/20 font-semibold' : ''}`}>
                <td className="py-1.5 pr-2 font-extrabold">{s?.rank ?? '–'}</td>
                <td className="py-1.5 pr-2">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: colorOf(room, id) }} />
                  {p.bot ? '🤖 ' : ''}
                  {p.name}
                  {p.bot && p.archetype && <span className="ml-1 text-xs text-ink/50">· {t(ARCHETYPE_INFO[p.archetype])}</span>}
                  {p.lms && <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-800">Moodle</span>}
                  {s?.bankrupt && <span className="ml-1 rounded bg-bad/15 px-1 text-[10px] text-bad">{tr('cash < 0', 'âm tiền')}</span>}
                  {s?.defaulted && <span className="ml-1 rounded bg-ink/10 px-1 text-[10px]">{tr('no plan', 'không nộp')}</span>}
                </td>
                <td className="py-1.5 pr-2 text-right font-bold tabular-nums">{s ? s.dashboard.toFixed(1) : '–'}</td>
                <td className={`py-1.5 pr-2 text-right tabular-nums ${s && s.profitCum < 0 ? 'text-bad' : ''}`}>{s ? mil(s.profitCum, lang) : '–'}</td>
                <td className={`py-1.5 pr-2 text-right tabular-nums ${s && s.cash < 0 ? 'text-bad' : ''}`}>{s ? mil(s.cash, lang) : '–'}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{s ? s.rating.toFixed(2) : '–'}</td>
                <td className="py-1.5 text-right tabular-nums">{s ? pct(s.pdr, lang) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Quarterly profit per company (SVG lines). */
export function ProfitChart({ room, me, height = 180 }: { room: CeoRoomDoc; me?: string; height?: number }) {
  const { lang, tr } = useLang();
  const rows = room.history;
  if (!rows.length) return <p className="text-sm text-ink/50">{tr('The profit chart appears after quarter 1.', 'Biểu đồ lợi nhuận xuất hiện sau quý 1.')}</p>;
  const w = 560;
  const h = height;
  const pad = 34;
  const vals = rows.flatMap((r) => Object.values(r.profit));
  const max = Math.max(50, ...vals);
  const min = Math.min(-50, ...vals);
  const xs = (i: number) => pad + (rows.length === 1 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (rows.length - 1));
  const ys = (v: number) => h - pad - ((v - min) / (max - min)) * (h - 2 * pad);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={tr('Quarterly profit', 'Lợi nhuận theo quý')}>
        {[min, 0, max].map((v) => (
          <g key={v}>
            <line x1={pad} x2={w - pad} y1={ys(v)} y2={ys(v)} stroke={v === 0 ? '#0b223960' : '#0b223920'} />
            <text x={2} y={ys(v) + 4} fontSize="10" fill="#0b223980">{mil(v, lang)}</text>
          </g>
        ))}
        {rows.map((r, i) => (
          <text key={r.round} x={xs(i)} y={h - 8} fontSize="11" textAnchor="middle" fill="#0b2239a0">Q{r.round}</text>
        ))}
        {room.order.map((id, k) => {
          const pts = rows.map((r, i) => `${xs(i)},${ys(r.profit[id] ?? 0)}`).join(' ');
          const mine = id === me;
          return <polyline key={id} points={pts} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth={mine ? 4 : 2} opacity={me && !mine ? 0.5 : 1} />;
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {room.order.map((id, k) => (
          <span key={id} className={`flex items-center gap-1 ${id === me ? 'font-bold' : ''}`}>
            <span className="inline-block h-2 w-3 rounded" style={{ background: COLORS[k % COLORS.length] }} />
            {room.players[id]?.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function KpiTable({ now, prev }: { now: CeoKpis; prev?: CeoKpis }) {
  const { lang, tr } = useLang();
  const rows: Array<[string, (k: CeoKpis) => string]> = [
    [tr('Sessions (traffic)', 'Lượt truy cập'), (k) => num(k.traffic, lang)],
    [tr('Conversion rate', 'Tỷ lệ chuyển đổi'), (k) => pct(k.cr, lang, 2)],
    [tr('Orders', 'Số đơn'), (k) => num(k.orders, lang)],
    [tr('AOV', 'Giá trị đơn (AOV)'), (k) => `${num(k.aov * 1000, lang)}k`],
    [tr('Revenue', 'Doanh thu'), (k) => mil(k.revenue, lang)],
    [tr('Quarter profit', 'Lợi nhuận quý'), (k) => mil(k.profit, lang)],
    [tr('Cash', 'Tiền mặt'), (k) => mil(k.cash, lang)],
    [tr('Rating', 'Điểm đánh giá'), (k) => `${k.rating.toFixed(2)}★`],
    [tr('Platform dependency (PDR)', 'Phụ thuộc sàn (PDR)'), (k) => pct(k.pdr, lang)],
    [tr('New customers · CAC', 'Khách mới · CAC'), (k) => `${num(k.newCustomers, lang)} · ${k.cac === null ? '–' : `${num(k.cac, lang)}k`}`],
    [tr('Repeat orders (CRM)', 'Đơn mua lại (CRM)'), (k) => num(k.repeatOrders, lang)],
    [tr('Orders via AI agents', 'Đơn qua AI agent'), (k) => num(k.agentOrders, lang)],
    [tr('Lost to stock-outs', 'Mất do hết hàng'), (k) => num(k.stockouts, lang)],
    [tr('Stock left', 'Hàng tồn'), (k) => num(k.stockLeft, lang)],
  ];
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-ink/60">
        <tr>
          <th className="py-1">KPI</th>
          <th className="py-1 text-right">{tr('This quarter', 'Quý này')}</th>
          {prev && <th className="py-1 text-right">{tr('Last quarter', 'Quý trước')}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, f]) => (
          <tr key={label} className="border-t border-ink/10">
            <td className="py-1.5">{label}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{f(now)}</td>
            {prev && <td className="py-1.5 text-right tabular-nums text-ink/60">{f(prev)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PnL({ k }: { k: CeoKpis }) {
  const { lang, tr } = useLang();
  const lines: Array<[string, number]> = [
    [tr('Revenue', 'Doanh thu'), k.revenue],
    [tr('COGS', 'Giá vốn'), -k.cogs],
    [tr('Platform & payment fees', 'Phí sàn và thanh toán'), -k.fees],
    [tr('Fulfilment', 'Giao vận'), -k.fulfillment],
    [tr('Returns', 'Hoàn hàng'), -k.returns],
    [tr('Marketing', 'Marketing'), -k.marketing],
    [tr('AI & agent investment', 'Đầu tư AI và agent'), -k.ai],
    [tr('Fixed costs', 'Chi phí cố định'), -k.opex],
    [tr('Holding cost', 'Lưu kho'), -k.holding],
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        {lines.map(([l, v]) => (
          <tr key={l} className="border-t border-ink/10">
            <td className="py-1">{l}</td>
            <td className={`py-1 text-right tabular-nums ${v < 0 ? 'text-ink/70' : 'font-semibold'}`}>{mil(v, lang)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-ink/30 font-extrabold">
          <td className="py-1.5">{tr('Profit', 'Lợi nhuận')}</td>
          <td className={`py-1.5 text-right tabular-nums ${k.profit < 0 ? 'text-bad' : 'text-ok'}`}>{mil(k.profit, lang)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function ChannelTable({ k }: { k: CeoKpis }) {
  const { lang, t, tr } = useLang();
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-ink/60">
        <tr>
          <th className="py-1">{tr('Channel', 'Kênh')}</th>
          <th className="py-1 text-right">{tr('Orders', 'Đơn')}</th>
          <th className="py-1 text-right">{tr('Revenue', 'Doanh thu')}</th>
          <th className="py-1 text-right">%</th>
        </tr>
      </thead>
      <tbody>
        {CHANNELS.map((c) => (
          <tr key={c} className="border-t border-ink/10">
            <td className="py-1.5">{t(CHANNEL_INFO[c].name)}</td>
            <td className="py-1.5 text-right tabular-nums">{num(k.byChannel[c].orders, lang)}</td>
            <td className="py-1.5 text-right tabular-nums">{mil(k.byChannel[c].revenue, lang)}</td>
            <td className="py-1.5 text-right tabular-nums">{k.revenue ? pct(k.byChannel[c].revenue / k.revenue, lang) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScorecardBars({ sc }: { sc: CeoScorecard }) {
  const { tr } = useLang();
  const rows: Array<[string, number]> = [
    [tr('Profitable (cumulative profit ≥ 400m)', 'Có lãi (lợi nhuận lũy kế ≥ 400 triệu)'), sc.profit],
    [tr('Never ran out of cash', 'Không bao giờ âm tiền mặt'), sc.cash],
    [tr('Platform dependency ≤ 60%', 'Phụ thuộc sàn ≤ 60%'), sc.pdr],
    [tr('Crisis handled and KPIs predicted', 'Xử lý khủng hoảng và dự đoán KPI'), sc.crisis],
  ];
  return (
    <div className="grid gap-2">
      {rows.map(([label, v]) => (
        <div key={label} className="grid grid-cols-[1fr_5rem_3rem] items-center gap-2 text-sm">
          <span className="font-medium">{label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-ink/10">
            <div className={`h-full rounded-full ${v >= 24.9 ? 'bg-ok' : v >= 12.5 ? 'bg-amber' : 'bg-bad'}`} style={{ width: `${(v / 25) * 100}%` }} />
          </div>
          <span className="text-right tabular-nums text-ink/70">{v.toFixed(0)}/25</span>
        </div>
      ))}
      <p className="text-right text-sm font-bold">{tr('Board scorecard', 'Thẻ mục tiêu')}: {sc.total.toFixed(0)}/100</p>
    </div>
  );
}

export const DEBRIEF: Array<[string, string]> = [
  ['Who chased revenue and who protected contribution? What does the profit chart show?', 'Ai chạy theo doanh thu, ai giữ lợi nhuận đóng góp? Biểu đồ lợi nhuận cho thấy gì?'],
  ['Which companies depended most on Shopee and TikTok? What happened in quarter 3?', 'Công ty nào phụ thuộc Shopee và TikTok nhiều nhất? Quý 3 chuyện gì xảy ra?'],
  ['Which AI choice paid back the 300 million, and why?', 'Lựa chọn AI nào thu hồi được 300 triệu, vì sao?'],
  ['Investing in agent readiness in quarter 5: option value or waste?', 'Đầu tư cho AI agent ở quý 5: giá trị quyền chọn hay lãng phí?'],
  ['Crisis cards: which responses protected trust? Who predicted the KPIs right?', 'Thẻ khủng hoảng: cách xử lý nào giữ được niềm tin? Ai dự đoán KPI đúng?'],
];
