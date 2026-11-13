// Game 6 – CRO Battle: the game-specific parts of the shared round-sim screens.
import { useState } from 'react';
import {
  CRO_ARCHETYPE_INFO,
  CRO_BADGES,
  CRO_BASE_CR,
  CRO_CHANGES,
  CRO_CHANGE_INFO,
  CRO_DEBRIEF,
  CRO_MAX_TESTS,
  CRO_ROUNDS,
  CRO_ROUND_INFO,
  CRO_SCORE_PARTS,
  CRO_SHARES,
  CRO_WEEKS,
  CRO_WEEK_SESSIONS,
  type CroChange,
  type CroDecision,
  type CroPub,
  type CroReport,
  type CroShare,
  type CroTestPlan,
  type CroTestResult,
  type CroView,
  type CroWeeks,
} from '@arena/cro';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { tx, type Lang } from '@arena/types';
import { useLang } from '../lib/i18n';
import { Choice, Kv, colorOf, fmtNum, pctv, type RsWeb } from '../rs/parts';

type Me = RsMe<CroReport, CroView>;
const crv = (v: number, l: Lang) => pctv(v, l, 2);
const liftv = (v: number, l: Lang) => `${v >= 0 ? '+' : ''}${pctv(v, l, 1)}`;

/** Smallest relative lift this test can reliably detect (80% power, 5% two-sided). */
export function mde(share: number, weeks: number) {
  const n = CRO_WEEK_SESSIONS * weeks * (share / 100);
  return (2.8 * Math.sqrt((2 * CRO_BASE_CR * (1 - CRO_BASE_CR)) / n)) / CRO_BASE_CR;
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
          <p>{tr('You run the conversion team of a cosmetics store: 100,000 sessions a week, conversion 1.8%. There are 13 ideas on the backlog – some help, many do nothing, some hurt. Nobody knows which.', 'Bạn phụ trách tối ưu chuyển đổi của một cửa hàng mỹ phẩm: 100.000 lượt truy cập mỗi tuần, chuyển đổi 1,8%. Có 13 ý tưởng trong danh sách – có cái giúp, nhiều cái vô tác dụng, có cái gây hại. Không ai biết trước.')}</p>
          <p>{tr('Each sprint (4 weeks): choose which changes are live, and run up to two A/B tests – traffic share, duration and stopping rule are yours. Sprint 5 has no new tests.', 'Mỗi sprint (4 tuần): chọn thay đổi nào được áp dụng, và chạy tối đa hai thử nghiệm A/B – tự chọn tỷ lệ traffic, thời gian và quy tắc dừng. Sprint 5 không chạy thử nghiệm mới.')}</p>
          <p>{tr('The leaderboard during the game uses the noisy dashboard. The final score uses the TRUE conversion rate (50), extra orders (20) and experiment discipline (30).', 'Bảng xếp hạng trong trận dùng số liệu bảng điều khiển có nhiễu. Điểm cuối dùng tỷ lệ chuyển đổi THẬT (50), đơn tăng thêm (20) và kỷ luật thử nghiệm (30).')}</p>
        </div>
      )}
    </div>
  );
}

function verdict(t: CroTestResult) {
  if (t.p < 0.05) return t.lift > 0 ? tx('Significant win', 'Thắng có ý nghĩa') : tx('Significant loss', 'Thua có ý nghĩa');
  return tx('No clear difference', 'Chưa thấy khác biệt rõ');
}

function TestLine({ t }: { t: CroTestResult }) {
  const { lang, t: tt, tr } = useLang();
  const v = verdict(t);
  return (
    <div className="rounded-xl bg-paper p-2 text-xs ring-1 ring-ink/10">
      <p className="font-semibold">
        {tt(CRO_CHANGE_INFO[t.change].name)} · {t.share}% · {t.weeks} {tr('wk', 'tuần')}
        {t.peek ? ` · ${tr('peeking', 'xem trộm')}` : ''}
        {t.stoppedDay ? ` · ${tr('stopped day', 'dừng ngày')} ${t.stoppedDay}` : ''}
      </p>
      <p className="tabular-nums">
        A {crv(t.crA, lang)} · B {crv(t.crB, lang)} · <b>{liftv(t.lift, lang)}</b> ({tr('95% CI', 'KTC 95%')} {liftv(t.ciLow, lang)} … {liftv(t.ciHigh, lang)}) · p = {fmtNum(t.p, lang, 3)}
      </p>
      <p className={`font-semibold ${t.p < 0.05 ? (t.lift > 0 ? 'text-ok' : 'text-bad') : 'text-ink/60'}`}>{tt(v)}{t.autoShipped ? ` · ${tr('auto-shipped', 'đã tự áp dụng')}` : ''}</p>
    </div>
  );
}

function Form({ me, d, set, round }: { room: RsRoomDoc; me: Me | null; d: CroDecision; set: (d: CroDecision) => void; round: number }) {
  const { lang, t, tr } = useLang();
  const history = (me?.reports ?? []).flatMap((r) => r.tests);
  const lastOf = (ch: CroChange) => history.filter((x) => x.change === ch).at(-1);
  const toggle = (ch: CroChange) => set({ ...d, ship: d.ship.includes(ch) ? d.ship.filter((x) => x !== ch) : [...d.ship, ch], tests: d.tests.filter((x) => x.change !== ch) });
  const setTest = (i: number, tp: CroTestPlan | null) => {
    const tests = d.tests.slice();
    if (tp) tests[i] = tp;
    else tests.splice(i, 1);
    set({ ...d, tests });
  };
  const free = CRO_CHANGES.filter((ch) => !d.ship.includes(ch));
  const last = me?.reports.at(-1);
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-2 font-bold">🏪 {tr('Your store now', 'Cửa hàng của bạn hiện tại')}</h2>
        <Kv
          rows={[
            [tr('Dashboard conversion last sprint', 'Chuyển đổi trên bảng điều khiển sprint trước'), last ? crv(last.dashCr, lang) : crv(CRO_BASE_CR, lang)],
            [tr('Changes live', 'Thay đổi đang áp dụng'), String(d.ship.length)],
            [tr('Tests run so far', 'Số thử nghiệm đã chạy'), String(history.length)],
          ]}
        />
      </div>
      {round < CRO_ROUNDS && (
        <div className="card space-y-3">
          <h2 className="font-bold">🧪 {tr(`A/B tests this sprint (up to ${CRO_MAX_TESTS})`, `Thử nghiệm A/B sprint này (tối đa ${CRO_MAX_TESTS})`)}</h2>
          {d.tests.map((tp, i) => {
            const m = mde(tp.share, tp.weeks);
            return (
              <div key={i} className="space-y-2 rounded-xl p-2 ring-1 ring-ink/15">
                <div className="flex items-center gap-2">
                  <select className="input flex-1" value={tp.change} onChange={(e) => setTest(i, { ...tp, change: e.target.value as CroChange })} aria-label={tr('Change to test', 'Thay đổi cần thử')}>
                    {free.filter((ch) => ch === tp.change || !d.tests.some((x) => x.change === ch)).map((ch) => <option key={ch} value={ch}>{t(CRO_CHANGE_INFO[ch].name)}</option>)}
                  </select>
                  <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setTest(i, null)}>{tr('Remove', 'Bỏ')}</button>
                </div>
                <p className="text-xs text-ink/60">{t(CRO_CHANGE_INFO[tp.change].idea)}</p>
                <p className="text-xs font-semibold text-ink/60">{tr('Traffic to version B', 'Traffic cho phiên bản B')}</p>
                <Choice<CroShare> options={CRO_SHARES} value={tp.share} onChange={(x) => setTest(i, { ...tp, share: x })} label={(k) => `${k}%`} />
                <p className="text-xs font-semibold text-ink/60">{tr('Duration', 'Thời gian')}</p>
                <Choice<CroWeeks> options={CRO_WEEKS} value={tp.weeks} onChange={(x) => setTest(i, { ...tp, weeks: x })} label={(k) => tr(`${k} week${k > 1 ? 's' : ''}`, `${k} tuần`)} />
                <p className="text-xs font-semibold text-ink/60">{tr('Stopping rule', 'Quy tắc dừng')}</p>
                <Choice<'fixed' | 'peek'>
                  options={['fixed', 'peek']}
                  value={tp.peek ? 'peek' : 'fixed'}
                  onChange={(x) => setTest(i, { ...tp, peek: x === 'peek' })}
                  cols={2}
                  label={(k) => (k === 'fixed' ? tr('Fixed: read at the end', 'Cố định: đọc lúc kết thúc') : tr('Check daily, stop when significant', 'Xem hằng ngày, dừng khi có ý nghĩa'))}
                  note={(k) => (k === 'fixed' ? tr('As planned', 'Theo kế hoạch') : tr('Winner goes live at once', 'Thắng là áp dụng ngay'))}
                />
                <p className={`text-xs ${m > 0.08 ? 'text-bad' : 'text-ink/60'}`}>{tr(`Smallest effect this test can reliably detect ≈ ${liftv(m, 'en')}`, `Hiệu ứng nhỏ nhất thử nghiệm này phát hiện được ≈ ${liftv(m, 'vi')}`)}</p>
              </div>
            );
          })}
          {d.tests.length < CRO_MAX_TESTS && free.some((ch) => !d.tests.some((x) => x.change === ch)) && (
            <button type="button" className="btn-ghost w-full" onClick={() => setTest(d.tests.length, { change: free.find((ch) => !d.tests.some((x) => x.change === ch))!, share: 50, weeks: 2, peek: false })}>
              + {tr('Add a test', 'Thêm thử nghiệm')}
            </button>
          )}
        </div>
      )}
      <div className="card space-y-2">
        <h2 className="font-bold">🚀 {tr('Live on the store this sprint', 'Áp dụng trên cửa hàng sprint này')}</h2>
        <p className="text-xs text-ink/60">{tr('Tap to switch a change on or off (roll back). A change under test cannot be live.', 'Chạm để bật hoặc tắt một thay đổi (quay lại bản cũ). Thay đổi đang thử nghiệm thì không áp dụng được.')}</p>
        <div className="grid gap-1.5">
          {CRO_CHANGES.map((ch) => {
            const on = d.ship.includes(ch);
            const tl = lastOf(ch);
            return (
              <button key={ch} type="button" onClick={() => toggle(ch)} className={`rounded-xl px-3 py-2 text-left text-xs ring-1 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/10'}`}>
                <span className="flex justify-between gap-2">
                  <span className="font-semibold">{on ? '✅ ' : ''}{t(CRO_CHANGE_INFO[ch].name)}</span>
                  <span className={on ? 'text-white/70' : 'text-ink/50'}>{t(CRO_CHANGE_INFO[ch].page)}</span>
                </span>
                {tl ? (
                  <span className={`block tabular-nums ${on ? 'text-white/80' : 'text-ink/60'}`}>
                    {tr('Last test', 'Thử gần nhất')}: {liftv(tl.lift, lang)} · p = {fmtNum(tl.p, lang, 3)} · {tl.share}%/{tl.weeks}{tr('wk', 't')}{tl.peek ? ` · ${tr('peeked', 'xem trộm')}` : ''}
                  </span>
                ) : (
                  <span className={`block ${on ? 'text-white/70' : 'text-ink/50'}`}>{t(CRO_CHANGE_INFO[ch].idea)}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Report({ report }: { report: CroReport; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  return (
    <div className="card space-y-3">
      <h2 className="font-bold">📊 {tr(`Sprint ${report.round}: your store`, `Sprint ${report.round}: cửa hàng của bạn`)}{report.defaulted ? <span className="ml-2 rounded bg-ink/10 px-1.5 text-xs font-normal">{tr('plan not submitted – nothing changed', 'không nộp – giữ nguyên')}</span> : null}</h2>
      <Kv
        rows={[
          [tr('Dashboard conversion (noisy)', 'Chuyển đổi trên bảng điều khiển (có nhiễu)'), crv(report.dashCr, lang)],
          [tr('Orders this sprint', 'Đơn hàng sprint này'), fmtNum(report.orders, lang)],
          [tr('Extra orders vs 1.8%', 'Đơn tăng thêm so với 1,8%'), fmtNum(report.extraOrders, lang), report.extraOrders < 0],
          [tr('Extra returns cost', 'Chi phí hoàn hàng tăng thêm'), `${fmtNum(report.returnsCost, lang, 1)} ${tr('m', 'tr')}`, report.returnsCost > 10],
          ...(report.fine ? ([[tr('Fine', 'Tiền phạt'), `${fmtNum(report.fine, lang)} ${tr('m', 'tr')}`, true]] as Array<[string, string, boolean]>) : []),
          [tr('Extra contribution', 'Lợi nhuận đóng góp tăng thêm'), `${fmtNum(report.profit, lang, 1)} ${tr('m', 'tr')}`, report.profit < 0],
        ]}
      />
      {report.tests.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/50">{tr('Test results', 'Kết quả thử nghiệm')}</p>
          {report.tests.map((x) => <TestLine key={x.change} t={x} />)}
        </div>
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
  if (!v?.truth) return null;
  const tested = new Set(me.reports.flatMap((r) => r.tests.map((x) => x.change)));
  return (
    <div className="card space-y-2">
      <h2 className="font-bold">🔓 {tr('The truth behind every idea', 'Sự thật đằng sau từng ý tưởng')}</h2>
      <p className="text-sm">
        {tr('Your TRUE conversion rate', 'Tỷ lệ chuyển đổi THẬT của bạn')}: <b>{crv(v.trueCr ?? 0, lang)}</b> · {tr('last dashboard', 'bảng điều khiển cuối')}: {crv(v.dashCr ?? 0, lang)}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-ink/60">
            <tr>
              <th className="py-1 pr-2">{tr('Idea', 'Ý tưởng')}</th>
              <th className="py-1 pr-2 text-right">{tr('True effect', 'Hiệu ứng thật')}</th>
              <th className="py-1 pr-2 text-right">{tr('Novelty', 'Mới lạ')}</th>
              <th className="py-1 text-right">{tr('You', 'Bạn')}</th>
            </tr>
          </thead>
          <tbody>
            {CRO_CHANGES.slice()
              .sort((a, b) => v.truth![b]!.lift - v.truth![a]!.lift)
              .map((ch) => {
                const e = v.truth![ch]!;
                const live = v.shipped.includes(ch);
                return (
                  <tr key={ch} className="border-t border-ink/10">
                    <td className="py-1 pr-2">{t(CRO_CHANGE_INFO[ch].name)}</td>
                    <td className={`py-1 pr-2 text-right font-semibold tabular-nums ${e.lift > 0 ? 'text-ok' : e.lift < 0 ? 'text-bad' : ''}`}>{liftv(e.lift, lang)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums text-ink/60">{e.novelty ? liftv(e.novelty, lang) : '–'}</td>
                    <td className="py-1 text-right">{live ? (e.lift > 0 && ch !== 'urgency' ? '✅' : '❌') : ''}{tested.has(ch) ? ' 🧪' : ''}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink/50">{tr('✅ live and really helps · ❌ live but useless, harmful or a dark pattern · 🧪 you tested it', '✅ đang áp dụng và giúp thật · ❌ đang áp dụng nhưng vô ích, có hại hoặc là dark pattern · 🧪 bạn đã thử nghiệm')}</p>
    </div>
  );
}

function Market({ room, me, big }: { room: RsRoomDoc; me?: string; big?: boolean }) {
  const { lang, tr } = useLang();
  const pub = room.pub as unknown as Partial<CroPub>;
  if (!pub.dash) return null;
  const truth = pub.trueCr;
  const val = (id: string) => (truth ? truth[id] : pub.dash![id]) ?? CRO_BASE_CR;
  const ids = room.order.slice().sort((a, b) => val(b) - val(a));
  const max = Math.max(0.025, ...ids.map(val));
  return (
    <div>
      <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>{truth ? `🔓 ${tr('TRUE conversion rate (dashboard in grey)', 'Tỷ lệ chuyển đổi THẬT (bảng điều khiển màu xám)')}` : `📈 ${tr('Dashboard conversion (noisy)', 'Chuyển đổi trên bảng điều khiển (có nhiễu)')}`}</h2>
      <div className="grid gap-1.5">
        {ids.map((id) => (
          <div key={id} className={`grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'} ${id === me ? 'font-bold' : ''}`}>
            <span className="truncate">{room.players[id]?.name}</span>
            <div className={`relative ${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
              {truth && <div className="absolute inset-y-0 left-0 rounded-full bg-ink/25" style={{ width: `${((pub.dash![id] ?? 0) / max) * 100}%` }} />}
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(val(id) / max) * 100}%`, background: colorOf(room, id), opacity: truth ? 0.85 : 1 }} />
            </div>
            <span className="text-right tabular-nums text-ink/70">
              {crv(val(id), lang)} · 🧪{pub.tests?.[id] ?? 0} · 🚀{pub.shipped?.[id] ?? 0}
            </span>
          </div>
        ))}
      </div>
      <p className={`mt-1 text-ink/50 ${big ? 'text-base' : 'text-xs'}`}>{tr('🧪 tests run · 🚀 changes live', '🧪 số thử nghiệm · 🚀 thay đổi đang áp dụng')}</p>
    </div>
  );
}

export const CRO_WEB: RsWeb<CroDecision, CroReport, CroView> = {
  id: 'cro-battle',
  tag: 'Game 6 · CRO Battle',
  roundWord: tx('Sprint', 'Sprint'),
  rounds: CRO_ROUNDS,
  Briefing,
  roundInfo: (r) => CRO_ROUND_INFO[r] ?? CRO_ROUND_INFO[1]!,
  initial: (me, round) => {
    const pending = me?.pending as CroDecision | null;
    if (pending) return { ship: pending.ship.slice(), tests: round < CRO_ROUNDS ? pending.tests.map((x) => ({ ...x })) : [] };
    return { ship: (me?.view?.shipped ?? []).slice(), tests: [] };
  },
  check: (d) => {
    if (d.tests.some((x) => d.ship.includes(x.change))) return tx('A change that is live cannot be tested.', 'Thay đổi đang áp dụng thì không thử nghiệm được.');
    if (new Set(d.tests.map((x) => x.change)).size !== d.tests.length) return tx('Two tests on the same change.', 'Hai thử nghiệm trùng một thay đổi.');
    return null;
  },
  Form,
  Report,
  Market,
  Reveal,
  cols: [
    { key: 'cr', label: tx('Conversion*', 'Chuyển đổi*'), fmt: (v, l) => crv(v, l) },
    { key: 'extraOrders', label: tx('Extra orders', 'Đơn tăng thêm'), fmt: (v, l) => fmtNum(v, l), bad: (v) => v < 0 },
    { key: 'tests', label: tx('Tests', 'Thử nghiệm'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'shipped', label: tx('Live', 'Áp dụng'), fmt: (v, l) => fmtNum(v, l) },
  ],
  chart: { title: tx('Dashboard conversion per sprint (%) – noisy', 'Chuyển đổi trên bảng điều khiển theo sprint (%) – có nhiễu'), fmt: (v, l) => `${fmtNum(v, l, 2)}%`, zero: false },
  scoreParts: CRO_SCORE_PARTS,
  scoreMax: { cr: 50, orders: 20, discipline: 30 },
  badges: CRO_BADGES,
  archetypes: CRO_ARCHETYPE_INFO,
  debrief: CRO_DEBRIEF,
  scoring: [
    ['5 sprints of 4 weeks, 100,000 sessions a week, start at 1.8% conversion. Up to two A/B tests per sprint (none in sprint 5).', '5 sprint, mỗi sprint 4 tuần, 100.000 lượt truy cập mỗi tuần, xuất phát 1,8%. Tối đa hai thử nghiệm A/B mỗi sprint (sprint 5 không có).'],
    ['Final scorecard: TRUE conversion rate 50 (full at +40%), extra orders 20, experiment discipline 30.', 'Thẻ mục tiêu cuối: tỷ lệ chuyển đổi THẬT 50 (tối đa khi +40%), đơn tăng thêm 20, kỷ luật thử nghiệm 30.'],
    ['Discipline loses points for live changes that do not really help, dark patterns, peeking, testing an obvious bug, or never fixing it.', 'Kỷ luật bị trừ khi áp dụng thay đổi không giúp thật, dùng dark pattern, xem trộm, thử nghiệm một lỗi hiển nhiên hoặc không sửa lỗi đó.'],
    ['During the game the board shows the noisy dashboard (discipline counted as 15 for everyone). The truth is revealed after sprint 5.', 'Trong trận, bảng xếp hạng dùng số liệu bảng điều khiển có nhiễu (kỷ luật tạm tính 15 cho mọi người). Sự thật được công bố sau sprint 5.'],
    ['Moodle grade = 70% scorecard + 30% rank in the room.', 'Điểm Moodle = 70% thẻ mục tiêu + 30% thứ hạng trong phòng.'],
  ],
  source: tx('Textbook Chapter 6, Section 20 (A/B testing, sample size, peeking, when not to test) and the Booking.com case', 'Giáo trình Chương 6, mục 20 (A/B test, cỡ mẫu, xem trộm, khi nào không nên thử) và case Booking.com'),
};
