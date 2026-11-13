// Game 2 – Platform Wars: the game-specific parts of the shared round-sim screens.
import { useState } from 'react';
import {
  PW_ADS_INFO,
  PW_ARCHETYPE_INFO,
  PW_BADGES,
  PW_DEBRIEF,
  PW_MAX_SUBSIDY,
  PW_MAX_TRUST,
  PW_PROGRAM_INFO,
  PW_ROUNDS,
  PW_ROUND_INFO,
  PW_SCORE_PARTS,
  PW_TAKE_MAX,
  PW_TAKE_MIN,
  type PwAds,
  type PwDecision,
  type PwPub,
  type PwProgram,
  type PwReport,
  type PwView,
} from '@arena/pw';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { tx } from '@arena/types';
import { useLang } from '../lib/i18n';
import { Choice, Kv, Stepper, bnv, colorOf, fmtNum, kv, pctv, type RsWeb } from '../rs/parts';

type Me = RsMe<PwReport, PwView>;
const START: PwDecision = { take: 6, subsidy: 3, toSellers: 50, ads: 0, trust: 0.75, program: 'none' };

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
          <p>{tr('You run one of six new marketplaces in the same city for six quarters. Buyers come for selection (sellers); sellers come for buyers – the cross-side network effect.', 'Bạn điều hành một trong sáu sàn mới trong cùng thành phố, trong sáu quý. Người mua đến vì có nhiều lựa chọn (người bán); người bán đến vì có người mua – hiệu ứng mạng chéo.')}</p>
          <p>{tr('Each quarter set: take rate, subsidy budget and which side gets it, retail media, trust & safety spend, and a loyalty programme. From Q4 you may also sell own-brand goods.', 'Mỗi quý chọn: phí sàn, ngân sách trợ giá và trợ cho phía nào, quảng cáo trên sàn, chi an toàn – tin cậy, và chương trình gắn kết. Từ quý 4 có thể bán thêm hàng nhãn riêng.')}</p>
          <p>{tr('Scorecard: cumulative profit 45, GMV share 25 (worth less if bought with losses), platform health 30 (counterfeits, leakage, seller cost). Grade = 70% scorecard + 30% rank.', 'Thẻ mục tiêu: lợi nhuận lũy kế 45, thị phần GMV 25 (giảm giá trị nếu mua bằng lỗ), sức khỏe nền tảng 30 (hàng giả, rò rỉ, chi phí người bán). Điểm = 70% thẻ mục tiêu + 30% thứ hạng.')}</p>
        </div>
      )}
    </div>
  );
}

function Form({ room, me, d, set, round }: { room: RsRoomDoc; me: Me | null; d: PwDecision; set: (d: PwDecision) => void; round: number }) {
  const { lang, t, tr } = useLang();
  const last = me?.reports[me.reports.length - 1];
  const v = me?.view;
  const up = <K extends keyof PwDecision>(k: K, x: PwDecision[K]) => set({ ...d, [k]: x });
  const toS = (d.subsidy * d.toSellers) / 100;
  const sellerCost = d.take / 100 + PW_ADS_INFO[d.ads].rate + 0.02;
  const gmv = last?.kpis.gmv ?? 28;
  const trustHint = Math.round((0.012 * gmv + 0.3) * 4) / 4;
  const cash = v?.cash ?? 30;
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-2 font-bold">🏪 {tr('Your platform now', 'Sàn của bạn hiện tại')}</h2>
        <Kv
          rows={[
            [tr('Buyers', 'Người mua'), kv(v?.buyers ?? 40, lang)],
            [tr('Sellers', 'Người bán'), fmtNum(v?.sellers ?? 400, lang)],
            [tr('Sellers per 1,000 buyers', 'Người bán / 1.000 người mua'), fmtNum((v?.sellers ?? 400) / Math.max(1, v?.buyers ?? 40), lang, 1)],
            [tr('GMV last quarter', 'GMV quý trước'), last ? bnv(last.kpis.gmv, lang) : '–'],
            [tr('Cash', 'Tiền mặt'), bnv(cash, lang), cash < 0],
          ]}
        />
      </div>
      <div className="card space-y-3">
        <h2 className="font-bold">💸 {tr('Take rate (commission on GMV)', 'Phí sàn (hoa hồng trên GMV)')}</h2>
        <div className="flex items-center gap-3">
          <input type="range" min={PW_TAKE_MIN} max={PW_TAKE_MAX} step={1} value={d.take} onChange={(e) => up('take', Number(e.target.value))} className="w-full accent-amber" aria-label={tr('Take rate', 'Phí sàn')} />
          <span className="w-14 text-right text-xl font-extrabold tabular-nums">{d.take}%</span>
        </div>
        <p className={`text-xs ${sellerCost > 0.2 ? 'text-bad' : 'text-ink/60'}`}>
          {tr(`Seller all-in cost ≈ ${Math.round(sellerCost * 100)}% of sales (take + ads + 2% payment).`, `Tổng chi phí của người bán ≈ ${Math.round(sellerCost * 100)}% doanh số (phí sàn + quảng cáo + 2% thanh toán).`)}
        </p>
      </div>
      <div className="card space-y-3">
        <h2 className="font-bold">🎁 {tr('Subsidies (chicken-and-egg)', 'Trợ giá (con gà – quả trứng)')}</h2>
        <Stepper label={tr('Budget this quarter', 'Ngân sách quý này')} value={d.subsidy} onChange={(x) => up('subsidy', x)} max={PW_MAX_SUBSIDY} step={0.5} show={(x) => bnv(x, lang)} />
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-ink/60">
            <span>{tr('Buyers (vouchers)', 'Người mua (voucher)')}</span>
            <span>{tr('Sellers (free listing, ad credit)', 'Người bán (miễn phí đăng, tặng quảng cáo)')}</span>
          </div>
          <input type="range" min={0} max={100} step={10} value={d.toSellers} onChange={(e) => up('toSellers', Number(e.target.value))} className="w-full accent-amber" aria-label={tr('Share to sellers', 'Phần cho người bán')} />
          <p className="text-center text-sm font-semibold tabular-nums">
            {bnv(d.subsidy - toS, lang)} → {tr('buyers', 'người mua')} · {bnv(toS, lang)} → {tr('sellers', 'người bán')}
          </p>
        </div>
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">📣 {tr('Retail media', 'Quảng cáo trên sàn')}</h2>
        <Choice<PwAds> options={[0, 1, 2]} value={d.ads} onChange={(x) => up('ads', x)} label={(k) => t(PW_ADS_INFO[k].name)} note={(k) => t(PW_ADS_INFO[k].note)} />
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">🛡️ {tr('Trust & safety', 'An toàn – tin cậy')}</h2>
        <Stepper label={tr('Moderation, escrow, anti-counterfeit', 'Kiểm duyệt, giữ tiền giao dịch, chống hàng giả')} value={d.trust} onChange={(x) => up('trust', x)} max={PW_MAX_TRUST} step={0.25} show={(x) => bnv(x, lang, 2)} />
        <p className="text-xs text-ink/60">{tr(`Rule of thumb: ≈ 1.2% of GMV + 0.3 bn → about ${fmtNum(trustHint, lang, 2)} bn now. Less means counterfeits grow with your seller count.`, `Kinh nghiệm: ≈ 1,2% GMV + 0,3 tỷ → khoảng ${fmtNum(trustHint, lang, 2)} tỷ lúc này. Ít hơn thì hàng giả tăng theo số người bán.`)}</p>
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">🤝 {tr('Loyalty programme', 'Chương trình gắn kết')}</h2>
        <Choice<PwProgram> options={['none', 'vip', 'tiers']} value={d.program} onChange={(x) => up('program', x)} label={(k) => t(PW_PROGRAM_INFO[k].name)} note={(k) => t(PW_PROGRAM_INFO[k].note)} cols={1} />
      </div>
      {round >= 4 && (
        <div className="card space-y-2">
          <h2 className="font-bold">🏷️ {tr('Own-brand goods', 'Hàng nhãn riêng')}</h2>
          {v?.ownBrand ? (
            <p className="text-sm text-ink/70">{tr('You already sell own-brand goods. Sellers know it – there is no way back.', 'Bạn đã bán hàng nhãn riêng. Người bán đều biết – không quay lại được.')}</p>
          ) : (
            <Choice<'no' | 'yes'> options={['no', 'yes']} value={d.ownBrand ? 'yes' : 'no'} onChange={(x) => up('ownBrand', x === 'yes')} cols={2} label={(k) => (k === 'yes' ? tr('Launch own brand', 'Tung nhãn riêng') : tr('Stay neutral', 'Giữ trung lập'))} note={(k) => (k === 'yes' ? tr('+2.5% of GMV margin; sellers trust you less', '+2,5% GMV biên lợi nhuận; người bán kém tin hơn') : tr('Referee only', 'Chỉ làm trọng tài'))} />
          )}
        </div>
      )}
      {round > 1 && <div className="card"><Market room={room} me={me?.playerId} /></div>}
    </div>
  );
}

function Report({ report }: { report: PwReport; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  const k = report.kpis;
  return (
    <div className="card space-y-3">
      <h2 className="font-bold">📊 {tr(`Quarter ${report.round}: your platform`, `Quý ${report.round}: sàn của bạn`)}{report.defaulted ? <span className="ml-2 rounded bg-ink/10 px-1.5 text-xs font-normal">{tr('plan not submitted – last plan reused', 'không nộp – dùng lại kế hoạch cũ')}</span> : null}</h2>
      <div className="rounded-xl bg-ink px-3 py-2 text-center text-sm text-white">
        GMV <b className="text-amber">{bnv(k.gmv, lang)}</b> → {tr('revenue', 'doanh thu')} <b className="text-amber">{bnv(k.revenue, lang, 2)}</b> → {tr('profit', 'lợi nhuận')} <b className={k.profit < 0 ? 'text-red-300' : 'text-amber'}>{bnv(k.profit, lang, 2)}</b>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/50">{tr('Market', 'Thị trường')}</p>
          <Kv
            rows={[
              [tr('Loyal buyers', 'Người mua trung thành'), kv(k.buyers, lang)],
              [tr('Voucher hunters', 'Người săn voucher'), kv(k.hunters, lang)],
              [tr('Sellers', 'Người bán'), fmtNum(k.sellers, lang)],
              [tr('Sellers / 1,000 buyers', 'Người bán / 1.000 người mua'), fmtNum(k.selection, lang, 1), k.selection < 5 || k.selection > 16],
              [tr('GMV share', 'Thị phần GMV'), pctv(k.share, lang, 1)],
              [tr('Leakage (deals off-platform)', 'Rò rỉ (chốt ngoài sàn)'), `${pctv(k.leakage, lang, 1)} · ${bnv(k.gmvLost, lang)}`, k.leakage >= 0.08],
              [tr('Counterfeit rate', 'Tỷ lệ hàng giả'), pctv(k.counterfeit, lang, 1), k.counterfeit >= 0.05],
              [tr('Seller all-in cost', 'Tổng chi phí người bán'), pctv(k.sellerCost, lang), k.sellerCost > 0.2],
              [tr('Platform health', 'Sức khỏe nền tảng'), pctv(k.health, lang), k.health < 0.7],
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/50">{tr('Profit & loss', 'Lãi lỗ')}</p>
          <Kv
            rows={[
              [tr('Commission', 'Phí sàn'), bnv(k.takeRev, lang, 2)],
              [tr('Retail media', 'Quảng cáo'), bnv(k.adRev, lang, 2)],
              [tr('Membership fees', 'Phí thành viên'), bnv(k.programRev, lang, 2)],
              [tr('Own-brand margin', 'Lãi hàng nhãn riêng'), bnv(k.ownRev, lang, 2)],
              [tr('− Subsidies', '− Trợ giá'), bnv(-k.subsidy, lang, 2)],
              [tr('− Trust & safety', '− An toàn – tin cậy'), bnv(-k.trust, lang, 2)],
              [tr('− Programme cost', '− Chi phí chương trình'), bnv(-k.programCost, lang, 2)],
              [tr('− Operations', '− Vận hành'), bnv(-k.opex, lang, 2)],
              [tr('Profit', 'Lợi nhuận'), bnv(k.profit, lang, 2), k.profit < 0],
              [tr('Cash', 'Tiền mặt'), bnv(k.cash, lang, 2), k.cash < 0],
            ]}
          />
        </div>
      </div>
      {report.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber/10 p-3 text-sm">
          {report.notes.map((n, i) => <li key={i}>💡 {t(n)}</li>)}
        </ul>
      )}
    </div>
  );
}

function Market({ room, me, big }: { room: RsRoomDoc; me?: string; big?: boolean }) {
  const { lang, tr } = useLang();
  const pub = room.pub as unknown as Partial<PwPub>;
  if (!pub.share) return null;
  const ids = room.order.slice().sort((a, b) => (pub.share![b] ?? 0) - (pub.share![a] ?? 0));
  return (
    <div>
      <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🌐 {tr('GMV share and public take rates', 'Thị phần GMV và phí sàn công khai')}</h2>
      <div className="grid gap-1.5">
        {ids.map((id) => {
          const s = pub.share![id] ?? 0;
          return (
            <div key={id} className={`grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'} ${id === me ? 'font-bold' : ''}`}>
              <span className="truncate">{room.players[id]?.name}</span>
              <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(1, s * 100)}%`, background: colorOf(room, id) }} />
              </div>
              <span className="text-right tabular-nums text-ink/70">
                {pctv(s, lang)}
                {pub.take?.[id] ? ` · ${tr('fee', 'phí')} ${pub.take[id]}%` : ''}
                {` · ${kv(pub.buyers?.[id] ?? 0, lang)} / ${fmtNum(pub.sellers?.[id] ?? 0, lang)}`}
              </span>
            </div>
          );
        })}
      </div>
      <p className={`mt-1 text-ink/50 ${big ? 'text-base' : 'text-xs'}`}>{tr('Right: share · take rate · buyers / sellers', 'Bên phải: thị phần · phí sàn · người mua / người bán')}</p>
    </div>
  );
}

export const PW_WEB: RsWeb<PwDecision, PwReport, PwView> = {
  id: 'platform-wars',
  tag: 'Game 2 · Platform Wars',
  roundWord: tx('Quarter', 'Quý'),
  rounds: PW_ROUNDS,
  Briefing,
  roundInfo: (r) => PW_ROUND_INFO[r] ?? PW_ROUND_INFO[1]!,
  initial: (me, round) => {
    const base = (me?.pending as PwDecision | null) ?? me?.reports[me.reports.length - 1]?.decision ?? START;
    const d: PwDecision = { take: base.take, subsidy: base.subsidy, toSellers: base.toSellers, ads: base.ads, trust: base.trust, program: base.program };
    if (round >= 4) d.ownBrand = Boolean(me?.view?.ownBrand || base.ownBrand);
    return d;
  },
  check: () => null,
  Form,
  Report,
  Market,
  cols: [
    { key: 'share', label: tx('GMV share', 'Thị phần GMV'), fmt: (v, l) => pctv(v, l) },
    { key: 'profitCum', label: tx('Profit (cum.)', 'Lợi nhuận lũy kế'), fmt: (v, l) => bnv(v, l), bad: (v) => v < 0 },
    { key: 'buyers', label: tx('Buyers', 'Người mua'), fmt: (v, l) => kv(v, l) },
    { key: 'sellers', label: tx('Sellers', 'Người bán'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'cash', label: tx('Cash', 'Tiền mặt'), fmt: (v, l) => bnv(v, l), bad: (v) => v < 0 },
  ],
  chart: { title: tx('Quarterly profit (bn VND)', 'Lợi nhuận theo quý (tỷ đồng)'), fmt: (v, l) => bnv(v, l, 0) },
  scoreParts: PW_SCORE_PARTS,
  scoreMax: { profit: 45, share: 25, health: 30 },
  badges: PW_BADGES,
  archetypes: PW_ARCHETYPE_INFO,
  debrief: PW_DEBRIEF,
  scoring: [
    ['6 quarters, 6 marketplaces in one city, VND 30 bn each. Buyers follow sellers and sellers follow buyers.', '6 quý, 6 sàn trong một thành phố, mỗi sàn 30 tỷ đồng. Người mua theo người bán, người bán theo người mua.'],
    ['Scorecard: cumulative profit 45 + GMV share 25 (worth less if bought with losses) + platform health 30.', 'Thẻ mục tiêu: lợi nhuận lũy kế 45 + thị phần GMV 25 (giảm giá trị nếu mua bằng lỗ) + sức khỏe nền tảng 30.'],
    ['Health falls with counterfeits (too little trust & safety), leakage (take rate too high) and a seller cost above 20%.', 'Sức khỏe giảm khi có hàng giả (chi an toàn – tin cậy quá ít), rò rỉ giao dịch (phí sàn quá cao) và chi phí người bán trên 20%.'],
    ['Out of cash: the bank blocks your subsidies.', 'Hết tiền mặt: ngân hàng chặn trợ giá.'],
    ['Moodle grade = 70% scorecard + 30% rank in the room.', 'Điểm Moodle = 70% thẻ mục tiêu + 30% thứ hạng trong phòng.'],
  ],
  source: tx('Textbook Chapter 2, Sections 6, 9–13 (take rate, network effects, chicken-and-egg, multi-homing, governance)', 'Giáo trình Chương 2, mục 6, 9–13 (phí sàn, hiệu ứng mạng, con gà – quả trứng, multi-homing, quản trị nền tảng)'),
};
