// Game 11 – Border Run: the game-specific parts of the shared round-sim screens.
import { useState } from 'react';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { tx } from '@arena/types';
import {
  BR_ARCHETYPE_INFO,
  BR_BADGES,
  BR_CARD_INFO,
  BR_DEBRIEF,
  BR_DIMS,
  BR_DIM_INFO,
  BR_FILE_COST,
  BR_INCOTERMS,
  BR_INCOTERM_INFO,
  BR_LAYERS,
  BR_LAYER_COST,
  BR_LAYER_INFO,
  BR_LAYER_OPEX,
  BR_LOCALISES,
  BR_LOCALISE_COST,
  BR_LOCALISE_INFO,
  BR_MARKETS,
  BR_MARKET_INFO,
  BR_MAX_LEVEL,
  BR_MAX_SHORTCUTS,
  BR_MODES,
  BR_MODE_INFO,
  BR_MODE_RANK,
  BR_MODE_STEP,
  BR_POINTS,
  BR_QUARTER_INFO,
  BR_RETURNS,
  BR_RETURNS_COST,
  BR_RETURNS_INFO,
  BR_ROUNDS,
  BR_SCORE_PARTS,
  BR_SHORTCUTS,
  BR_WEIGHTS,
  brLanded,
  type BrDecision,
  type BrIncoterm,
  type BrLayer,
  type BrLocalise,
  type BrMarket,
  type BrMode,
  type BrPub,
  type BrReport,
  type BrReturns,
  type BrView,
} from '@arena/br';
import { useLang } from '../lib/i18n';
import { Choice, Kv, Stepper, bnv, colorOf, fmtNum, pctv, type RsWeb } from '../rs/parts';

type Me = RsMe<BrReport, BrView>;
const zeroLayers = () => Object.fromEntries(BR_LAYERS.map((l) => [l, 0])) as Record<BrLayer, number>;
const noModes = () => Object.fromEntries(BR_MARKETS.map((m) => [m, 'none'])) as Record<BrMarket, BrMode>;
const layerCost = (from: number, to: number) => {
  let sum = 0;
  for (let l = from + 1; l <= to; l++) sum += BR_LAYER_COST[l - 1]!;
  return sum;
};
const modeCost = (from: BrMode, to: BrMode) => {
  let sum = 0;
  for (let r = BR_MODE_RANK[from] + 1; r <= BR_MODE_RANK[to]; r++) sum += BR_MODE_STEP[r]!;
  return sum;
};
export const brSpent = (d: BrDecision, have: Record<BrLayer, number>, modes: Record<BrMarket, BrMode>) =>
  BR_LAYERS.reduce((a, l) => a + layerCost(have[l] ?? 0, d.build[l] ?? 0), 0) +
  BR_MARKETS.reduce((a, m) => a + modeCost(modes[m] ?? 'none', d.mode[m] ?? 'none'), 0) +
  d.file.length * BR_FILE_COST +
  BR_LOCALISE_COST[d.localise] +
  BR_RETURNS_COST[d.returns];
/** The chapter's weighted market score. */
export const brScore = (m: BrMarket) => BR_DIMS.reduce((a, k) => a + BR_WEIGHTS[k] * BR_MARKET_INFO[m].scores[k], 0);
const tqw = (n: number, l: string) => `${n} ${l === 'en' ? (n === 1 ? 'team-quarter' : 'team-quarters') : 'quý-nhân-sự'}`;
/** VND m, which is how every landed-cost line is quoted. */
const mv = (v: number, l: string) => `${(Math.round(v * 1000) / 1000).toFixed(3).replace('.', l === 'en' ? '.' : ',')}`;

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
          <p>
            {tr(
              'Six Vietnamese brands take one product abroad across five quarters of 2027. Four destinations are open, the weighted market score is published, and so is every line of the landed cost. Never choose a country only because it is big.',
              'Sáu thương hiệu Việt đưa một sản phẩm ra nước ngoài trong năm quý của năm 2027. Bốn thị trường đang mở, bảng điểm thị trường có trọng số đã công bố, và từng dòng chi phí đến tay khách cũng vậy. Đừng chọn một nước chỉ vì nó lớn.',
            )}
          </p>
          <p>
            {tr(
              `Each quarter you have ${BR_POINTS} team-quarters. You spend them on entering a market and climbing its ladder – distributor, marketplace, own website, stock held in the destination – on the six layers of the trust stack, on filing your trademark, on how the listing is written and on what happens to a return.`,
              `Mỗi quý bạn có ${BR_POINTS} quý-nhân-sự. Bạn dùng chúng để vào một thị trường và leo thang ở đó – nhà phân phối, sàn toàn cầu, website riêng, giữ hàng tại nước đến – để xây sáu lớp của chồng niềm tin, để đăng ký nhãn hiệu, để quyết bài bán hàng được viết thế nào và hàng hoàn được xử lý thế nào.`,
            )}
          </p>
          <p>
            {tr(
              'Trust is a stack and it fails at its lowest missing layer, so the lowest layer carries most of the weight – and trust is what converts a foreign shopper who can check less and has fewer remedies. Price is not cash received: count all seven cost lines before calling an order profitable.',
              'Niềm tin là một chồng lớp và nó vỡ ở lớp thiếu thấp nhất, nên lớp thấp nhất mang phần lớn trọng số – và niềm tin chính là thứ chuyển đổi một người mua ở nước ngoài, người kiểm tra được ít hơn và có ít cách đòi quyền hơn. Giá không phải là tiền về: hãy đếm đủ bảy dòng chi phí trước khi gọi một đơn là có lãi.',
            )}
          </p>
          <p>
            {tr(
              'Every quarter you will also be offered a shortcut that lifts something immediately. Each one carries a probability you have not been told, and that probability rises as your volume grows. At the end of the game every card is revealed: what it earned and what it cost.',
              'Mỗi quý bạn còn được chào một lối tắt giúp tăng ngay một thứ gì đó. Mỗi lối tắt đi kèm một xác suất mà bạn chưa được cho biết, và xác suất đó tăng lên khi bạn bán nhiều hơn. Cuối trận mọi thẻ đều được lật: nó kiếm được gì và nó lấy đi những gì.',
            )}
          </p>
          <p>
            {tr(
              'Scorecard: cumulative profit 50, trust index 30, licence to keep selling 20. Grade = 70% scorecard + 30% rank.',
              'Thẻ mục tiêu: lợi nhuận cộng dồn 50, chỉ số niềm tin 30, giấy phép để tiếp tục bán 20. Điểm = 70% thẻ mục tiêu + 30% thứ hạng.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange, label, note, danger }: { on: boolean; onChange: (v: boolean) => void; label: string; note: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`w-full rounded-xl px-3 py-2 text-left text-xs ring-1 ${on ? (danger ? 'bg-bad text-white ring-bad' : 'bg-ink text-white ring-ink') : 'bg-white ring-ink/15 hover:bg-amber/10'}`}
    >
      <span className="block font-semibold">
        {on ? '☑' : '☐'} {label}
      </span>
      <span className={`block ${on ? 'text-white/75' : 'text-ink/50'}`}>{note}</span>
    </button>
  );
}

/** The chapter's market score and landed-cost table, side by side. */
function MarketCard({
  m,
  d,
  set,
  have,
  left,
  round,
  dutiable,
  crowd,
  lost,
}: {
  m: BrMarket;
  d: BrDecision;
  set: (d: BrDecision) => void;
  have: BrMode;
  left: number;
  round: number;
  dutiable: boolean;
  crowd?: number;
  lost?: string;
}) {
  const { lang, t, tr } = useLang();
  const info = BR_MARKET_INFO[m];
  const at = d.mode[m] ?? have;
  const options = BR_MODES.filter((x) => BR_MODE_RANK[x] >= BR_MODE_RANK[have] && (x === at || modeCost(have, x) <= left + modeCost(have, at)));
  const x = brLanded(m, at === 'none' ? 'market' : at, round, {
    incoterm: d.incoterm,
    returns: d.returns,
    preticked: d.shortcuts.includes('preticked'),
    undervalue: d.shortcuts.includes('undervalue'),
    hidden: d.shortcuts.includes('hidden'),
  });
  const rows: Array<[string, string, boolean?]> = [
    [tr('Price the customer pays', 'Giá khách trả'), mv(x.price, lang)],
    [`1. ${tr('Cost of goods', 'Giá hàng')}`, `−${mv(x.cogs, lang)}`],
    [`2. ${tr('International freight', 'Vận chuyển quốc tế')}`, `−${mv(x.freight, lang)}`],
    [`3. ${tr('Platform and payment fees', 'Phí sàn và phí thanh toán')}`, `−${mv(x.fees, lang)}`],
    [`4. ${tr('Marketing', 'Marketing')}`, `−${mv(x.marketing, lang)}`],
    [`5. ${tr('Import duty and taxes', 'Thuế nhập khẩu và thuế')}`, `−${mv(x.duty, lang)}`, x.dutiable && x.duty > 0],
    [`6. ${tr('Clearance and handling', 'Thông quan và xử lý')}`, `−${mv(x.clearance, lang)}`],
    [`7. ${tr('Expected cost of returns', 'Chi phí hàng hoàn dự kiến')}`, `−${mv(x.returns, lang)}`],
    [tr('Contribution per order', 'Lợi nhuận đóng góp mỗi đơn'), `${mv(x.unit, lang)} · ${pctv(x.unit / (x.price || 1), lang)}`, x.unit <= 0],
  ];
  return (
    <div className={`rounded-xl p-3 ring-1 ${at !== 'none' ? 'bg-amber/10 ring-amber' : 'bg-white ring-ink/10'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-bold">
          {info.icon} {t(info.name)}
        </h3>
        <span className="text-xs text-ink/60">
          {tr('score', 'điểm')} <b className="text-ink">{fmtNum(brScore(m), lang, 2)}</b>/5
          {crowd !== undefined && crowd > 0 && ` · ${crowd}/6 ${tr('brands here', 'thương hiệu ở đây')}`}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink/60">{t(info.who)}</p>
      <p className={`mt-1 rounded-lg px-2 py-1 text-xs ${dutiable ? 'bg-bad/10' : 'bg-ok/10'}`}>
        {dutiable ? '🧾' : '🎁'} {t(info.policy)}
      </p>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs font-semibold text-ink/70">
          📊 {tr('How that score is made up', 'Điểm đó được tính từ đâu')}
        </summary>
        <table className="mt-1 w-full text-xs">
          <tbody>
            {BR_DIMS.map((k) => (
              <tr key={k} className="border-t border-ink/10">
                <td className="py-0.5 pr-1">{t(BR_DIM_INFO[k].name)}</td>
                <td className="py-0.5 pr-1 text-right tabular-nums text-ink/50">{pctv(BR_WEIGHTS[k], lang)}</td>
                <td className="py-0.5 text-right font-semibold tabular-nums">{info.scores[k]}/5</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {lost ? (
        <p className="mt-2 rounded-lg bg-bad/10 px-2 py-1 text-xs font-semibold text-bad">{lost}</p>
      ) : (
        <div className="mt-2">
          <Choice
            cols={1}
            options={options}
            value={at}
            onChange={(k: BrMode) => set({ ...d, mode: { ...d.mode, [m]: k }, file: d.file.filter((f) => f !== m || k !== 'none') })}
            label={(k) =>
              `${BR_MODE_INFO[k].icon} ${t(BR_MODE_INFO[k].name)}${modeCost(have, k) > 0 ? ` – ${tqw(modeCost(have, k), lang)}` : ''}${
                BR_MODE_INFO[k].opex ? ` · ${bnv(BR_MODE_INFO[k].opex / 1000, lang, 2)}/${tr('quarter', 'quý')}` : ''
              }`
            }
            note={(k) => t(BR_MODE_INFO[k].note)}
          />
        </div>
      )}
      {at !== 'none' && !lost && (
        <>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-ink/70">
              🧮 {tr('Landed cost of one order (VND m)', 'Chi phí đến tay khách của một đơn (triệu đồng)')}
            </summary>
            <div className="mt-1">
              <Kv rows={rows} />
              {x.refuseRate > 0 && (
                <p className="mt-1 text-xs text-bad">
                  {pctv(x.refuseRate, lang)}{' '}
                  {tr(
                    'of parcels will be refused at the door, and each one costs you the goods and the freight both ways.',
                    'số kiện sẽ bị khách từ chối nhận ngay ở cửa, mỗi kiện như vậy làm bạn mất hàng và mất phí vận chuyển cả hai chiều.',
                  )}
                </p>
              )}
            </div>
          </details>
          <Toggle
            on={d.file.includes(m)}
            onChange={(v) => set({ ...d, file: v ? [...d.file, m] : d.file.filter((f) => f !== m) })}
            label={`®️ ${tr('File the trademark here', 'Đăng ký nhãn hiệu ở đây')} – ${tqw(BR_FILE_COST, lang)}`}
            note={tr(
              'A title granted in Vietnam protects you only in Vietnam. Search and file before you build the channel.',
              'Văn bằng cấp ở Việt Nam chỉ bảo hộ ở Việt Nam. Tra cứu và đăng ký trước khi xây kênh bán.',
            )}
          />
        </>
      )}
    </div>
  );
}

function Form({ room, me, d, set, round }: { room: RsRoomDoc; me: Me | null; d: BrDecision; set: (d: BrDecision) => void; round: number }) {
  const { lang, t, tr } = useLang();
  const view = me?.view;
  const pub = room.pub as unknown as Partial<BrPub>;
  const have = view?.build ?? zeroLayers();
  const modes = view?.mode ?? noModes();
  const left = BR_POINTS - brSpent(d, have, modes);
  const levels = BR_LAYERS.map((l) => d.build[l] ?? 0);
  const min = Math.min(...levels);
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  const dutiable = view?.dutiable ?? (Object.fromEntries(BR_MARKETS.map((m) => [m, true])) as Record<BrMarket, boolean>);
  const [showCards, setShowCards] = useState(false);

  return (
    <div className="space-y-3">
      <div className="card">
        <h2 className="mb-1 font-bold">🏷️ {tr('Your brand', 'Thương hiệu của bạn')}</h2>
        <Kv
          rows={[
            [tr('Cumulative profit', 'Lợi nhuận cộng dồn'), bnv(view?.profit ?? 0, lang, 2), (view?.profit ?? 0) < 0],
            [tr('Revenue so far', 'Doanh thu đến nay'), bnv(view?.revenue ?? 0, lang, 2)],
            [
              tr('Trust index · lowest layer', 'Chỉ số niềm tin · lớp thấp nhất'),
              `${pctv(view?.trust ?? 0, lang)} · ${tr('level', 'mức')} ${view?.trustMin ?? 0}/3`,
              (view?.trustMin ?? 0) === 0,
            ],
            [tr('Running cost of what you hold', 'Chi phí vận hành những gì bạn giữ'), `${bnv(view?.opexNext ?? 0, lang, 2)}/${tr('quarter', 'quý')}`],
            ...(view?.scar ? ([[tr('Trust damage still being carried', 'Tổn thương niềm tin còn lại'), pctv(view.scar, lang), true]] as Array<[string, string, boolean]>) : []),
            ...(view?.strikes ? ([[tr('Strikes on your platform account', 'Số lần vi phạm trên tài khoản sàn'), `${view.strikes}/3`, true]] as Array<[string, string, boolean]>) : []),
          ]}
        />
        {view?.frozen && (
          <p className="mt-1 rounded-lg bg-bad/10 px-2 py-1 text-xs text-bad">
            {tr('Your marketplace listings are down this quarter while the account is reviewed.', 'Bài bán trên sàn của bạn bị gỡ trong quý này trong khi tài khoản đang bị xem xét.')}
          </p>
        )}
        {(view?.ahead ?? []).map((a, i) => (
          <p key={i} className="mt-1 rounded-lg bg-amber/15 px-2 py-1 text-xs">
            📅 {t(a)}
          </p>
        ))}
      </div>

      <div className="card">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-bold">🌍 {tr('Where do you sell, and how?', 'Bạn bán ở đâu, và bằng cách nào?')}</h2>
          <span className={`text-sm font-bold tabular-nums ${left < 0 ? 'text-bad' : left === 0 ? 'text-ok' : 'text-ink/60'}`}>
            {tr('left', 'còn')} {tqw(left, lang)}
          </span>
        </div>
        <p className="mb-2 text-xs text-ink/60">
          {tr(
            'The weighted score is the chapter’s: market potential 20%, customer fit and compliance 15% each, competition, logistics and marketplace access 10% each, margin and brand opportunity 10% each. You are marked on whether your assumptions are reasonable, not on which market wins.',
            'Bảng điểm có trọng số lấy từ giáo trình: tiềm năng thị trường 20%, mức phù hợp khách hàng và tuân thủ mỗi mục 15%, cạnh tranh, hậu cần và tiếp cận sàn mỗi mục 10%, lợi nhuận và cơ hội thương hiệu mỗi mục 10%. Bạn được đánh giá ở chỗ giả định của bạn có hợp lý không, không phải ở chỗ nước nào thắng.',
          )}
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {BR_MARKETS.map((m) => (
            <MarketCard
              key={m}
              m={m}
              d={d}
              set={set}
              have={modes[m] ?? 'none'}
              left={left}
              round={round}
              dutiable={dutiable[m] ?? true}
              crowd={pub.crowd?.[m]}
              lost={
                view?.squatted?.includes(m)
                  ? tr('Somebody else owns your brand name here.', 'Người khác đang sở hữu tên thương hiệu của bạn ở đây.')
                  : view?.closed?.includes(m)
                    ? tr('Your account here is closed.', 'Tài khoản của bạn ở đây đã bị đóng.')
                    : undefined
              }
            />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-bold">🧱 {tr('The trust stack', 'Chồng niềm tin')}</h2>
          <span className="text-sm tabular-nums text-ink/60">
            {tr('lowest', 'thấp nhất')} <b className={min === 0 ? 'text-bad' : 'text-ink'}>{min}</b> · {tr('average', 'trung bình')} {fmtNum(avg, lang, 1)}
          </span>
        </div>
        <p className="mb-2 text-xs text-ink/60">
          {tr(
            'It fails at its lowest missing layer: brilliant reviews cannot help if the buyer doubts you exist. Report the minimum beside the average, because a pleasant average can hide a nothing on returns.',
            'Nó vỡ ở lớp thiếu thấp nhất: đánh giá hay đến đâu cũng vô dụng nếu khách còn nghi bạn có tồn tại hay không. Hãy xem giá trị nhỏ nhất bên cạnh giá trị trung bình, vì một mức trung bình dễ chịu có thể che một con số không ở phần đổi trả.',
          )}
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {BR_LAYERS.map((l) => {
            const info = BR_LAYER_INFO[l];
            const at = d.build[l] ?? have[l] ?? 0;
            const floor = have[l] ?? 0;
            let max = at;
            while (max < BR_MAX_LEVEL && layerCost(floor, max + 1) - layerCost(floor, at) <= left) max++;
            return (
              <div key={l} className={`rounded-xl p-2.5 ring-1 ${at === 0 ? 'bg-bad/5 ring-bad/30' : 'bg-white ring-ink/10'}`}>
                <Stepper
                  label={`${info.icon} ${t(info.name)}`}
                  value={at}
                  onChange={(v) => set({ ...d, build: { ...d.build, [l]: v } })}
                  min={floor}
                  max={max}
                  step={1}
                  show={(v) => `${tr('level', 'mức')} ${v}`}
                />
                <p className="mt-1 text-xs font-medium">{at === 0 ? t(info.levels[0]) : t(info.levels[at - 1] ?? info.levels[0])}</p>
                <p className="text-xs italic text-ink/50">“{t(info.question)}”</p>
                <p className="mt-0.5 text-xs text-ink/50">
                  {at > floor && (
                    <>
                      {tr('costs', 'tốn')} <b className="text-ink/70">{tqw(layerCost(floor, at), lang)}</b> ·{' '}
                    </>
                  )}
                  {tr('running cost', 'chi phí vận hành')} {bnv(BR_LAYER_OPEX[at]! / 1000, lang, 2)}/{tr('quarter', 'quý')}
                  {at < BR_MAX_LEVEL && (
                    <>
                      {' '}
                      · {tr('next level', 'mức sau')} {tqw(BR_LAYER_COST[at]!, lang)}
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 font-bold">📦 {tr('How you sell and how you put things right', 'Bạn bán ra sao và sửa sai ra sao')}</h2>
        <div className="grid gap-3">
          <div>
            <p className="mb-1 text-sm font-medium">{tr('Who pays the duty, and up to what point?', 'Ai trả thuế, và đến khâu nào?')}</p>
            <Choice
              cols={1}
              options={BR_INCOTERMS}
              value={d.incoterm}
              onChange={(k: BrIncoterm) => set({ ...d, incoterm: k })}
              label={(k) => `${BR_INCOTERM_INFO[k].icon} ${t(BR_INCOTERM_INFO[k].name)}`}
              note={(k) => t(BR_INCOTERM_INFO[k].note)}
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{tr('How is the foreign listing written?', 'Bài bán hàng ở nước ngoài được viết thế nào?')}</p>
            <Choice
              cols={1}
              options={BR_LOCALISES}
              value={d.localise}
              onChange={(k: BrLocalise) => set({ ...d, localise: k })}
              label={(k) =>
                `${BR_LOCALISE_INFO[k].icon} ${t(BR_LOCALISE_INFO[k].name)}${BR_LOCALISE_COST[k] ? ` – ${tqw(BR_LOCALISE_COST[k], lang)}` : ''}${
                  BR_LOCALISE_INFO[k].opex ? ` · ${bnv(BR_LOCALISE_INFO[k].opex / 1000, lang, 2)}/${tr('quarter', 'quý')}` : ''
                }`
              }
              note={(k) => t(BR_LOCALISE_INFO[k].note)}
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{tr('What happens to a cross-border return?', 'Hàng hoàn xuyên biên giới được xử lý thế nào?')}</p>
            <Choice
              cols={1}
              options={BR_RETURNS}
              value={d.returns}
              onChange={(k: BrReturns) => set({ ...d, returns: k })}
              label={(k) =>
                `${BR_RETURNS_INFO[k].icon} ${t(BR_RETURNS_INFO[k].name)}${BR_RETURNS_COST[k] ? ` – ${tqw(BR_RETURNS_COST[k], lang)}` : ''}${
                  BR_RETURNS_INFO[k].opex ? ` · ${bnv(BR_RETURNS_INFO[k].opex / 1000, lang, 2)}/${tr('quarter', 'quý')}` : ''
                }`
              }
              note={(k) => t(BR_RETURNS_INFO[k].note)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <button type="button" className="flex w-full items-baseline justify-between text-left" onClick={() => setShowCards(!showCards)}>
          <h2 className="font-bold">
            😈 {tr('On the table this quarter', 'Được chào trong quý này')}
            {d.shortcuts.length > 0 && <span className="ml-1 rounded bg-bad/15 px-1 text-xs text-bad">{d.shortcuts.length}</span>}
          </h2>
          <span className="text-sm text-ink/50">{showCards ? tr('Hide', 'Thu gọn') : tr('Show', 'Xem')}</span>
        </button>
        <p className="mt-0.5 text-xs text-ink/60">
          {tr(
            `At most ${BR_MAX_SHORTCUTS} a quarter, and they cost no team-quarters. Three tests must all pass: is it true, is the opposite choice as easy, and would the customer feel deceived if she knew?`,
            `Mỗi quý nhiều nhất ${BR_MAX_SHORTCUTS} thẻ, và chúng không tốn quý-nhân-sự nào. Cả ba phép thử đều phải qua: thông tin có đúng không, lựa chọn ngược lại có dễ như thế không, và khách có thấy mình bị lừa nếu biết sự thật không?`,
          )}
        </p>
        {showCards && (
          <div className="mt-2 grid gap-2">
            {BR_SHORTCUTS.map((s) => {
              const on = d.shortcuts.includes(s);
              return (
                <Toggle
                  key={s}
                  danger
                  on={on}
                  onChange={(v) =>
                    set({ ...d, shortcuts: v ? [...d.shortcuts, s].slice(-BR_MAX_SHORTCUTS) : d.shortcuts.filter((x) => x !== s) })
                  }
                  label={`${BR_CARD_INFO[s].icon} ${t(BR_CARD_INFO[s].name)}`}
                  note={t(BR_CARD_INFO[s].offer)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <p className="text-xs text-ink/60">{t(BR_QUARTER_INFO[Math.min(round, BR_ROUNDS)]?.text ?? BR_QUARTER_INFO[1]!.text)}</p>
      </div>
    </div>
  );
}

function Report({ report }: { report: BrReport; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  const r = report;
  return (
    <div className="space-y-3">
      {r.incidents.length > 0 && (
        <ul className="space-y-1.5 rounded-xl bg-bad/10 p-3 text-sm">
          {r.incidents.map((x) => (
            <li key={x.id}>
              ⚠️ {t(x.text)}
              {x.cost > 0 && <b className="whitespace-nowrap"> −{bnv(x.cost, lang, 2)}</b>}
            </li>
          ))}
        </ul>
      )}

      {r.lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>
                <th className="py-1 pr-2">{tr('Market', 'Thị trường')}</th>
                <th className="py-1 pr-2 text-right">{tr('Orders', 'Đơn')}</th>
                <th className="py-1 pr-2 text-right">{tr('Revenue', 'Doanh thu')}</th>
                <th className="py-1 pr-2 text-right">{tr('Duty', 'Thuế')}</th>
                <th className="py-1 pr-2 text-right">{tr('Chain', 'Chuỗi')}</th>
                <th className="py-1 pr-2 text-right">{tr('Contribution', 'Đóng góp')}</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((x) => (
                <tr key={x.market} className="border-t border-ink/10">
                  <td className="py-1 pr-2">
                    {BR_MARKET_INFO[x.market].icon} {t(BR_MARKET_INFO[x.market].name)}
                    <span className="ml-1 rounded bg-ink/10 px-1 text-[10px]">{t(BR_MODE_INFO[x.mode].name)}</span>
                    {x.blocked && <span className="ml-1 rounded bg-bad/15 px-1 text-[10px] text-bad">{tr('listings down', 'bị gỡ bài')}</span>}
                    {!x.dutiable && !x.blocked && <span className="ml-1 rounded bg-ok/15 px-1 text-[10px] text-ok">{tr('duty-free', 'miễn thuế')}</span>}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {fmtNum(x.orders, lang)}
                    {x.refused > 0 && <span className="text-bad"> (−{fmtNum(x.refused, lang)})</span>}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">{bnv(x.revenue, lang, 2)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums text-ink/60">−{bnv(x.duty, lang, 2)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums text-ink/60">−{bnv(x.chain, lang, 2)}</td>
                  <td className={`py-1 pr-2 text-right font-semibold tabular-nums ${x.contribution < 0 ? 'text-bad' : ''}`}>{bnv(x.contribution, lang, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-ink/50">
            {tr(
              '“Chain” is freight, platform and payment fees, marketing, clearance and the expected cost of returns together.',
              '“Chuỗi” gồm vận chuyển, phí sàn và phí thanh toán, marketing, thông quan và chi phí hàng hoàn dự kiến.',
            )}
          </p>
        </div>
      )}

      <Kv
        rows={[
          [tr('Contribution from all markets', 'Lợi nhuận đóng góp từ mọi thị trường'), bnv(r.contribution, lang, 2), r.contribution < 0],
          [tr('Running cost of what you hold', 'Chi phí vận hành những gì bạn giữ'), `−${bnv(r.opex, lang, 2)}`, r.opex > r.contribution],
          ...(r.incidentCost > 0 ? ([[tr('Cost of the incidents', 'Chi phí sự cố'), `−${bnv(r.incidentCost, lang, 2)}`, true]] as Array<[string, string, boolean]>) : []),
          [tr('Profit this quarter', 'Lợi nhuận quý này'), bnv(r.profit, lang, 2), r.profit < 0],
          [
            tr('Trust index · lowest layer · average', 'Chỉ số niềm tin · lớp thấp nhất · trung bình'),
            `${pctv(r.trust, lang)} · ${r.trustMin}/3 · ${fmtNum(r.trustAvg, lang, 1)}/3`,
            r.trustMin === 0,
          ],
          ...(r.decision.shortcuts.length > 0
            ? ([[tr('What the shortcuts added', 'Phần các lối tắt cộng thêm'), bnv(r.shortcutGain, lang, 2)]] as Array<[string, string]>)
            : []),
        ]}
      />

      {r.caught.length > 0 && (
        <p className="rounded-xl bg-bad/10 p-3 text-sm">
          {tr('Caught this quarter', 'Bị phát hiện trong quý')}: <b>{r.caught.map((s) => t(BR_CARD_INFO[s].name)).join(' · ')}</b>
        </p>
      )}

      {r.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber/10 p-3 text-sm">
          {r.notes.map((n, i) => (
            <li key={i}>💡 {t(n)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Market({ room, me, big }: { room: RsRoomDoc; me?: string; big?: boolean }) {
  const { lang, t, tr } = useLang();
  const pub = room.pub as unknown as Partial<BrPub>;
  if (!pub.profit) return null;
  const ids = room.order.slice().sort((a, b) => (pub.profit![b] ?? 0) - (pub.profit![a] ?? 0));
  const max = Math.max(0.01, ...Object.values(pub.profit).map((v) => Math.abs(v)));
  return (
    <div className="space-y-3">
      <div>
        <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>💰 {tr('Cumulative profit and trust', 'Lợi nhuận cộng dồn và niềm tin')}</h2>
        <div className="grid gap-1.5">
          {ids.map((id) => {
            const v = pub.profit![id] ?? 0;
            return (
              <div key={id} className={`grid grid-cols-[8rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'} ${id === me ? 'font-bold' : ''}`}>
                <span className="truncate">{room.players[id]?.name}</span>
                <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(1, (Math.abs(v) / max) * 100)}%`, background: v < 0 ? '#d64545' : colorOf(room, id) }} />
                </div>
                <span className={`text-right tabular-nums ${v < 0 ? 'text-bad' : 'text-ink/70'}`}>
                  {bnv(v, lang, 2)} · {tr('trust', 'niềm tin')} {pctv(pub.trust?.[id] ?? 0, lang)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🌍 {tr('The four destinations', 'Bốn thị trường')}</h2>
        <div className="overflow-x-auto">
          <table className={`w-full ${big ? 'text-xl' : 'text-sm'}`}>
            <thead className="text-left text-ink/60">
              <tr>
                <th className="py-1 pr-2">{tr('Market', 'Thị trường')}</th>
                <th className="py-1 pr-2 text-right">{tr('Score', 'Điểm')}</th>
                <th className="py-1 pr-2 text-right">{tr('Brands here', 'Thương hiệu ở đây')}</th>
                <th className="py-1 pr-2">{tr('Small parcels', 'Kiện nhỏ')}</th>
              </tr>
            </thead>
            <tbody>
              {BR_MARKETS.map((m) => (
                <tr key={m} className="border-t border-ink/10">
                  <td className="py-1 pr-2">
                    {BR_MARKET_INFO[m].icon} {t(BR_MARKET_INFO[m].name)}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">{fmtNum(brScore(m), lang, 2)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{pub.crowd?.[m] ?? 0}/6</td>
                  <td className={`py-1 pr-2 ${pub.dutiable?.[m] ? 'text-bad' : 'text-ok'}`}>
                    {pub.dutiable?.[m] ? tr('duty on every parcel', 'thuế trên mọi kiện') : tr('still duty-free', 'vẫn miễn thuế')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`mt-1 text-ink/50 ${big ? 'text-base' : 'text-xs'}`}>
          {tr('Ask what external condition your model depends on.', 'Hãy tự hỏi mô hình của bạn đang dựa vào điều kiện bên ngoài nào.')}
        </p>
      </div>
    </div>
  );
}

/** The final screen: what every card you took really cost. */
function Reveal({ me }: { me: Me; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  const cards = me.view?.cards ?? [];
  return (
    <div className="card">
      <h2 className="mb-1 font-bold">😈 {tr('The shortcuts, revealed', 'Lật các lối tắt')}</h2>
      {cards.length === 0 ? (
        <p className="text-sm text-ink/70">
          {tr(
            'You took none of them. The three tests were there all along: is it true, is the opposite choice as easy, and would the customer feel deceived if she knew?',
            'Bạn không nhận thẻ nào. Ba phép thử vẫn luôn ở đó: thông tin có đúng không, lựa chọn ngược lại có dễ như thế không, và khách có thấy mình bị lừa nếu biết sự thật không?',
          )}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-ink/60">
            {tr(
              'The probability you were never shown – and it rose with your volume, because several of these grow more likely as a business scales.',
              'Xác suất mà bạn chưa từng được cho biết – và nó tăng theo lượng hàng bạn bán, vì nhiều thứ trong số này càng dễ xảy ra khi doanh nghiệp càng lớn.',
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink/60">
                <tr>
                  <th className="py-1 pr-2">{tr('Card', 'Thẻ')}</th>
                  <th className="py-1 pr-2 text-right">{tr('Taken', 'Số lần nhận')}</th>
                  <th className="py-1 pr-2 text-right">{tr('Caught', 'Bị phát hiện')}</th>
                  <th className="py-1 pr-2 text-right">{tr('Real chance', 'Xác suất thật')}</th>
                  <th className="py-1 pr-2 text-right">{tr('Earned', 'Kiếm được')}</th>
                  <th className="py-1 pr-2 text-right">{tr('Paid', 'Phải trả')}</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((x) => (
                  <tr key={x.card} className="border-t border-ink/10">
                    <td className="py-1 pr-2">
                      {BR_CARD_INFO[x.card].icon} {t(BR_CARD_INFO[x.card].name)}
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">{x.taken}</td>
                    <td className={`py-1 pr-2 text-right tabular-nums ${x.caught ? 'text-bad font-semibold' : ''}`}>{x.caught}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{pctv(x.chance, lang)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums text-ok">{bnv(x.gained, lang, 2)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums text-bad">{bnv(x.paid, lang, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-1 rounded-xl bg-ink/5 p-3 text-sm">
            {cards.map((x) => (
              <li key={x.card}>🔎 {t(BR_CARD_INFO[x.card].truth)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export const BR_WEB: RsWeb<BrDecision, BrReport, BrView> = {
  id: 'border-run',
  tag: 'Game 11 · Border Run',
  roundWord: tx('Quarter', 'Quý'),
  rounds: BR_ROUNDS,
  Briefing,
  roundInfo: (r) => BR_QUARTER_INFO[r] ?? BR_QUARTER_INFO[1]!,
  initial: (me) => {
    const pending = (me?.pending as BrDecision | null) ?? null;
    if (pending) return pending;
    const last = (me?.reports ?? [])[(me?.reports?.length ?? 0) - 1]?.decision as BrDecision | undefined;
    return {
      mode: { ...(me?.view?.mode ?? noModes()) },
      build: { ...(me?.view?.build ?? zeroLayers()) },
      incoterm: last?.incoterm ?? 'ddp',
      localise: last?.localise ?? 'ai',
      file: [],
      returns: last?.returns ?? 'refund',
      shortcuts: [],
    };
  },
  check: (d, me) => {
    const have = me?.view?.build ?? zeroLayers();
    const modes = me?.view?.mode ?? noModes();
    if (brSpent(d, have, modes) > BR_POINTS) return tx(`You have ${BR_POINTS} team-quarters.`, `Bạn chỉ có ${BR_POINTS} quý-nhân-sự.`);
    for (const l of BR_LAYERS)
      if ((d.build[l] ?? 0) < (have[l] ?? 0)) return tx('What is built stays built – you cannot go back a level.', 'Thứ đã xây thì vẫn còn đó – không thể hạ mức.');
    for (const m of BR_MARKETS)
      if (BR_MODE_RANK[d.mode[m] ?? 'none'] < BR_MODE_RANK[modes[m] ?? 'none'])
        return tx('You can climb the ladder of entry but not step back down it.', 'Bạn leo lên thang hình thức vào thị trường được, nhưng không lùi lại được.');
    if (d.shortcuts.length > BR_MAX_SHORTCUTS) return tx(`At most ${BR_MAX_SHORTCUTS} of those a quarter.`, `Mỗi quý nhiều nhất ${BR_MAX_SHORTCUTS} thẻ như vậy.`);
    if (BR_MARKETS.every((m) => (d.mode[m] ?? 'none') === 'none'))
      return tx('You are not selling anywhere yet – choose at least one destination.', 'Bạn chưa bán ở đâu – hãy chọn ít nhất một thị trường.');
    return null;
  },
  Form,
  Report,
  Market,
  Reveal,
  cols: [
    { key: 'profit', label: tx('Profit', 'Lợi nhuận'), fmt: (v, l) => bnv(v, l, 2), bad: (v) => v < 0 },
    { key: 'trust', label: tx('Trust', 'Niềm tin'), fmt: (v, l) => pctv(v, l) },
    { key: 'markets', label: tx('Markets', 'Thị trường'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'strikes', label: tx('Strikes', 'Vi phạm'), fmt: (v, l) => fmtNum(v, l), bad: (v) => v > 0 },
  ],
  chart: { title: tx('Cumulative profit (VND bn)', 'Lợi nhuận cộng dồn (tỷ đồng)'), fmt: (v, l) => fmtNum(v, l, 1) },
  scoreParts: BR_SCORE_PARTS,
  scoreMax: { profit: 50, trust: 30, licence: 20 },
  badges: BR_BADGES,
  archetypes: BR_ARCHETYPE_INFO,
  debrief: BR_DEBRIEF,
  scoring: [
    ['5 quarters of 2027, 6 Vietnamese brands, four destinations. The weighted market score and every line of the landed cost are published.', '5 quý của năm 2027, 6 thương hiệu Việt, bốn thị trường. Bảng điểm thị trường có trọng số và từng dòng chi phí đến tay khách đều được công bố.'],
    ['Nine team-quarters each quarter: enter a market and climb its ladder, build the trust stack, file your trademark, write the listing, handle the returns.', 'Mỗi quý chín quý-nhân-sự: vào thị trường và leo thang ở đó, xây chồng niềm tin, đăng ký nhãn hiệu, viết bài bán hàng, xử lý hàng hoàn.'],
    ['Trust is a stack and it fails at its lowest missing layer – and trust is what converts a buyer who can check less and has fewer remedies.', 'Niềm tin là một chồng lớp và nó vỡ ở lớp thiếu thấp nhất – và niềm tin chính là thứ chuyển đổi người mua kiểm tra được ít hơn và có ít cách đòi quyền hơn.'],
    ['Price is not cash received: goods, freight, fees, duty, taxes, clearance and returns. Under Delivered At Place the duty is not in your costs – until the courier asks the customer at the door.', 'Giá không phải là tiền về: giá hàng, vận chuyển, phí, thuế nhập khẩu, thuế, thông quan và hàng hoàn. Với điều kiện giao tại nơi đến, thuế không nằm trong chi phí của bạn – cho đến khi chuyển phát đòi khách ngay ở cửa.'],
    ['A de minimis threshold is a policy choice, not an economic law. Read the policy line on every market and ask what external condition your model depends on.', 'Ngưỡng miễn thuế hàng giá trị thấp là một lựa chọn chính sách, không phải quy luật kinh tế. Hãy đọc dòng chính sách của từng thị trường và tự hỏi mô hình của bạn dựa vào điều kiện bên ngoài nào.'],
    ['A trademark is territorial: register at home, sell abroad, and you may find your brand already belongs to somebody there.', 'Nhãn hiệu có tính lãnh thổ: đăng ký ở nhà rồi bán ra nước ngoài, bạn có thể thấy thương hiệu của mình đã thuộc về người khác ở đó.'],
    ['Each quarter you are offered shortcuts that lift something now and carry a probability you have not been told. Every card is revealed at the end.', 'Mỗi quý bạn được chào những lối tắt giúp tăng ngay một thứ gì đó và đi kèm một xác suất bạn chưa được cho biết. Cuối trận mọi thẻ đều được lật.'],
    ['Scorecard: cumulative profit 50 + trust index 30 + licence to keep selling 20.', 'Thẻ mục tiêu: lợi nhuận cộng dồn 50 + chỉ số niềm tin 30 + giấy phép để tiếp tục bán 20.'],
    ['Moodle grade = 70% scorecard + 30% rank in the room.', 'Điểm Moodle = 70% thẻ mục tiêu + 30% thứ hạng trong phòng.'],
  ],
  source: tx(
    'Textbook Chapter 11: the eight C readiness check and the weighted market score (§2–3), localisation versus translation and the five modes of entry (§4–5), landed cost and FX buffers (§6–7), Incoterms, HS codes and the de minimis threshold (§8–9), cross-border returns (§10), the seven compliance layers and the three lines of defence (§11–12), the trust stack and the trust gap (§14–15), persuasion versus manipulation (§16), fake reviews, counterfeits and territorial IP (§17–18), and the Temu case on a rented advantage (§24)',
    'Giáo trình Chương 11: bảng kiểm tám chữ C và bảng điểm thị trường có trọng số (§2–3), bản địa hóa khác với dịch và năm hình thức vào thị trường (§4–5), chi phí đến tay khách và đệm tỷ giá (§6–7), Incoterms, mã HS và ngưỡng miễn thuế hàng giá trị thấp (§8–9), hàng hoàn xuyên biên giới (§10), bảy lớp tuân thủ và ba tuyến phòng vệ (§11–12), chồng niềm tin và khoảng cách niềm tin (§14–15), thuyết phục khác thao túng (§16), đánh giá giả, hàng giả và tính lãnh thổ của quyền sở hữu trí tuệ (§17–18), và case Temu về một lợi thế đi thuê (§24)',
  ),
};
