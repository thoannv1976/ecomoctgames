// Game 10 – Agent Arena: the game-specific parts of the shared round-sim screens.
import { useState } from 'react';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { tx } from '@arena/types';
import {
  AG_AGENT_SHARE,
  AG_ARCHETYPE_INFO,
  AG_AX,
  AG_BADGES,
  AG_CAPS,
  AG_CAP_INFO,
  AG_DEBRIEF,
  AG_GUARDS,
  AG_GUARD_INFO,
  AG_HANDOVERS,
  AG_HANDOVER_INFO,
  AG_LEVEL_COST,
  AG_MAX_LEVEL,
  AG_OPEX,
  AG_POINTS,
  AG_QUARTER_INFO,
  AG_ROUNDS,
  AG_SCORE_PARTS,
  AG_UX,
  type AgCap,
  type AgDecision,
  type AgGuard,
  type AgHandover,
  type AgPub,
  type AgReport,
  type AgView,
} from '@arena/ag';
import { useLang } from '../lib/i18n';
import { Choice, Kv, Stepper, bnv, colorOf, fmtNum, pctv, type RsWeb } from '../rs/parts';

type Me = RsMe<AgReport, AgView>;
const zeroCaps = () => Object.fromEntries(AG_CAPS.map((c) => [c, 0])) as Record<AgCap, number>;
const costTo = (from: number, to: number) => {
  let sum = 0;
  for (let l = from + 1; l <= to; l++) sum += AG_LEVEL_COST[l - 1]!;
  return sum;
};
const spentOf = (d: AgDecision, have: Record<AgCap, number>) => AG_CAPS.reduce((a, c) => a + costTo(have[c] ?? 0, d.invest[c] ?? 0), 0);
const eqw = (n: number, l: string) => `${n} ${l === 'en' ? (n === 1 ? 'eng.-quarter' : 'eng.-quarters') : 'quý-kỹ-sư'}`;

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
              'It is 2027 and six sellers share one market. Every quarter a larger share of the orders is placed not by a person but by an AI agent shopping on someone’s behalf – from one order in ten to more than half by the last quarter.',
              'Năm 2027, sáu người bán chia nhau một thị trường. Mỗi quý, phần đơn hàng không do người đặt mà do AI agent mua hộ lại lớn hơn – từ một trong mười đơn lên hơn một nửa ở quý cuối.',
            )}
          </p>
          <p>
            {tr(
              `You have ${AG_POINTS} engineer-quarters each quarter and eight things you could build. Five of them are what a machine reads: standard attributes, live stock, total cost, structured policies and an ordering API. Three are what a person feels: suggestions, an assistant and evidence that you can be trusted.`,
              `Mỗi quý bạn có ${AG_POINTS} quý-kỹ-sư và tám thứ có thể xây. Năm thứ là những gì máy đọc: thuộc tính chuẩn, tồn kho trực tuyến, tổng chi phí, chính sách có cấu trúc và API đặt hàng. Ba thứ là những gì người cảm nhận: gợi ý, trợ lý và bằng chứng rằng bạn đáng tin.`,
            )}
          </p>
          <p>
            {tr(
              'A product with no standard attributes, no live stock and no structured policy does not exist for an agent – not because it is worse, but because it cannot be compared. And without an ordering API an agent can recommend you but never buy from you.',
              'Một sản phẩm không có thuộc tính chuẩn, không có tồn kho trực tuyến và không có chính sách cấu trúc thì không tồn tại với agent – không phải vì nó kém hơn, mà vì không so sánh được. Và không có API đặt hàng thì agent có thể giới thiệu bạn nhưng không bao giờ mua được của bạn.',
            )}
          </p>
          <p>
            {tr(
              'Everything you hold costs money to run every quarter, whether it earns anything or not. And every automated system you switch on needs a human control: a price band for the pricing engine, a handover rule for the assistant, a diversity constraint for the recommender, and a control group so you know what the AI actually earned.',
              'Mọi thứ bạn giữ đều tốn chi phí vận hành hằng quý, dù nó có kiếm được gì hay không. Và mỗi hệ thống tự động bạn bật lên đều cần người kiểm soát: khoảng giá cho máy định giá, luật chuyển người cho trợ lý, ràng buộc đa dạng cho hệ gợi ý, và một nhóm đối chứng để biết AI thật sự kiếm được bao nhiêu.',
            )}
          </p>
          <p>
            {tr(
              'Scorecard: cumulative profit 50, agent orders won 25, every automated system under human control 25. Grade = 70% scorecard + 30% rank.',
              'Thẻ mục tiêu: lợi nhuận cộng dồn 50, giành được đơn từ agent 25, mọi hệ thống tự động đều có người kiểm soát 25. Điểm = 70% thẻ mục tiêu + 30% thứ hạng.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange, label, note }: { on: boolean; onChange: (v: boolean) => void; label: string; note: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`w-full rounded-xl px-3 py-2 text-left text-xs ring-1 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/10'}`}
    >
      <span className="block font-semibold">
        {on ? '☑' : '☐'} {label}
      </span>
      <span className={`block ${on ? 'text-white/70' : 'text-ink/50'}`}>{note}</span>
    </button>
  );
}

function CapGroup({
  caps,
  title,
  d,
  set,
  have,
  left,
}: {
  caps: AgCap[];
  title: string;
  d: AgDecision;
  set: (d: AgDecision) => void;
  have: Record<AgCap, number>;
  left: number;
}) {
  const { lang, t, tr } = useLang();
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-bold text-ink/70">{title}</h3>
      <div className="grid gap-2">
        {caps.map((cap) => {
          const info = AG_CAP_INFO[cap];
          const at = d.invest[cap] ?? have[cap] ?? 0;
          const floor = have[cap] ?? 0;
          // The highest level still affordable with what is left this quarter.
          let max = at;
          while (max < AG_MAX_LEVEL && costTo(floor, max + 1) - costTo(floor, at) <= left) max++;
          return (
            <div key={cap} className="rounded-xl bg-white p-2.5 ring-1 ring-ink/10">
              <Stepper
                label={`${info.icon} ${t(info.name)}`}
                value={at}
                onChange={(v) => set({ ...d, invest: { ...d.invest, [cap]: v } })}
                min={floor}
                max={max}
                step={1}
                show={(v) => `${tr('level', 'mức')} ${v}`}
              />
              <p className="mt-1 text-xs font-medium">{t(info.levels[Math.max(0, at - 1)] ?? info.levels[0])}</p>
              <p className="text-xs text-ink/50">{t(info.why)}</p>
              <p className="mt-0.5 text-xs text-ink/50">
                {at > floor && (
                  <>
                    {tr('costs', 'tốn')} <b className="text-ink/70">{eqw(costTo(floor, at), lang)}</b> ·{' '}
                  </>
                )}
                {tr('running cost', 'chi phí vận hành')} {bnv(AG_OPEX[at]! / 1000, lang, 2)}/{tr('quarter', 'quý')}
                {at < AG_MAX_LEVEL && (
                  <>
                    {' '}
                    · {tr('next level', 'mức sau')} {eqw(AG_LEVEL_COST[at]!, lang)}
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Form({ room, me, d, set, round }: { room: RsRoomDoc; me: Me | null; d: AgDecision; set: (d: AgDecision) => void; round: number }) {
  const { lang, t, tr } = useLang();
  const view = me?.view;
  const pub = room.pub as unknown as Partial<AgPub>;
  const have = view?.levels ?? zeroCaps();
  const left = AG_POINTS - spentOf(d, have);
  const shareNow = view?.agentShareNow ?? AG_AGENT_SHARE[Math.min(AG_ROUNDS, round) - 1]!;
  const shareNext = view?.agentShareNext ?? AG_AGENT_SHARE[Math.min(AG_ROUNDS, round)] ?? null;
  const opexNow = AG_CAPS.reduce((a, c) => a + AG_OPEX[d.invest[c] ?? have[c] ?? 0]!, 0) + AG_GUARD_INFO[d.guard].cost + AG_HANDOVER_INFO[d.handover].cost;

  return (
    <div className="space-y-3">
      <div className="card">
        <h2 className="mb-2 font-bold">🤖 {tr('Who is placing the orders', 'Ai đang đặt đơn hàng')}</h2>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-6 flex-1 overflow-hidden rounded-full ring-1 ring-ink/10">
            <div className="flex items-center justify-center bg-ink text-[11px] font-bold text-white" style={{ width: `${shareNow * 100}%` }}>
              {pctv(shareNow, lang)}
            </div>
            <div className="flex flex-1 items-center justify-center bg-amber/40 text-[11px] font-bold">{pctv(1 - shareNow, lang)}</div>
          </div>
        </div>
        <p className="mt-1 text-xs text-ink/60">
          {tr('Dark = AI agents, light = people.', 'Phần đậm = AI agent, phần nhạt = người thật.')}
          {shareNext !== null && ` ${tr('Next quarter agents are expected to place', 'Quý sau agent dự kiến đặt')} ${pctv(shareNext, lang)}.`}
        </p>
        {pub.unmet !== undefined && pub.unmet > 0 && (
          <p className="mt-1 text-xs text-bad">
            {tr('Last quarter', 'Quý trước')} {fmtNum(pub.unmet, lang)} {tr('agent orders found nobody readable enough in this market.', 'đơn từ agent không tìm được ai trong thị trường này đủ máy đọc được.')}
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 font-bold">🏪 {tr('Your shop', 'Cửa hàng của bạn')}</h2>
        <Kv
          rows={[
            [tr('Cumulative profit', 'Lợi nhuận cộng dồn'), bnv(view?.profit ?? 0, lang, 2), (view?.profit ?? 0) < 0],
            [tr('Revenue so far', 'Doanh thu đến nay'), bnv(view?.revenue ?? 0, lang, 2)],
            [tr('Running cost of this plan', 'Chi phí vận hành của kế hoạch này'), `${bnv(opexNow / 1000, lang, 2)}/${tr('quarter', 'quý')}`, opexNow > 1200],
            ...(view?.scar ? ([[tr('Trust damage still being carried', 'Tổn thương niềm tin còn lại'), pctv(view.scar, lang), true]] as Array<[string, string, boolean]>) : []),
            ...(view?.concentration
              ? ([[tr('Catalogue concentration from the recommender', 'Mức dồn danh mục do hệ gợi ý'), pctv(view.concentration, lang), view.concentration > 0.3]] as Array<[string, string, boolean]>)
              : []),
          ]}
        />
      </div>

      <div className="card">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-bold">🛠️ {tr('What do you build this quarter?', 'Quý này bạn xây gì?')}</h2>
          <span className={`text-sm font-bold tabular-nums ${left < 0 ? 'text-bad' : left === 0 ? 'text-ok' : 'text-ink/60'}`}>
            {tr('left', 'còn')} {eqw(left, lang)}
          </span>
        </div>
        <div className="grid gap-3">
          <CapGroup caps={AG_AX} title={`🔌 ${tr('What a machine reads (agent experience)', 'Những gì máy đọc (trải nghiệm cho agent)')}`} d={d} set={set} have={have} left={left} />
          <CapGroup caps={AG_UX} title={`🙋 ${tr('What a person feels (human experience)', 'Những gì người cảm nhận (trải nghiệm cho người)')}`} d={d} set={set} have={have} left={left} />
        </div>
        <p className="mt-2 text-xs text-ink/50">
          {tr('What is built stays built – and keeps costing money to run every quarter.', 'Thứ đã xây thì vẫn còn đó – và vẫn tốn chi phí vận hành hằng quý.')}
        </p>
      </div>

      <div className="card">
        <h2 className="mb-1 font-bold">🧑‍⚖️ {tr('Human control of the automated systems', 'Người kiểm soát các hệ thống tự động')}</h2>
        <p className="mb-2 text-xs text-ink/60">
          {tr('A control only costs you money if the system it governs is switched on – but it only saves you if it is in place before the incident.', 'Một biện pháp kiểm soát chỉ tốn tiền khi hệ thống nó quản đang bật – nhưng chỉ cứu được bạn nếu đã có sẵn trước khi sự cố xảy ra.')}
        </p>
        <div className="grid gap-2">
          <div>
            <p className="mb-1 text-sm font-medium">
              {AG_CAP_INFO.price.icon} {tr('The pricing engine', 'Máy định giá')} {(d.invest.price ?? 0) < 2 && <span className="text-xs text-ink/40">({tr('nothing automated yet', 'chưa có gì tự động')})</span>}
            </p>
            <Choice
              cols={1}
              options={AG_GUARDS}
              value={d.guard}
              onChange={(g: AgGuard) => set({ ...d, guard: g })}
              label={(g) => `${AG_GUARD_INFO[g].icon} ${t(AG_GUARD_INFO[g].name)}${AG_GUARD_INFO[g].cost ? ` – ${bnv(AG_GUARD_INFO[g].cost / 1000, lang, 2)}/${tr('quarter', 'quý')}` : ''}`}
              note={(g) => t(AG_GUARD_INFO[g].note)}
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">
              {AG_CAP_INFO.bot.icon} {tr('The assistant', 'Trợ lý AI')} {(d.invest.bot ?? 0) < 2 && <span className="text-xs text-ink/40">({tr('nothing automated yet', 'chưa có gì tự động')})</span>}
            </p>
            <Choice
              cols={1}
              options={AG_HANDOVERS}
              value={d.handover}
              onChange={(h: AgHandover) => set({ ...d, handover: h })}
              label={(h) => `${AG_HANDOVER_INFO[h].icon} ${t(AG_HANDOVER_INFO[h].name)}${AG_HANDOVER_INFO[h].cost ? ` – ${bnv(AG_HANDOVER_INFO[h].cost / 1000, lang, 2)}/${tr('quarter', 'quý')}` : ''}`}
              note={(h) => t(AG_HANDOVER_INFO[h].note)}
            />
          </div>
          <Toggle
            on={d.diversity}
            onChange={(v) => set({ ...d, diversity: v })}
            label={`${AG_CAP_INFO.reco.icon} ${tr('Reserve impressions for new and rarely seen products', 'Dành một phần lượt hiển thị cho hàng mới và hàng ít được thấy')}`}
            note={tr('Slightly less conversion this quarter; the long tail stays alive and the shop keeps feeling well stocked.', 'Chuyển đổi quý này thấp hơn một chút; phần đuôi dài còn sống và cửa hàng vẫn có cảm giác nhiều hàng.')}
          />
          <Toggle
            on={d.holdout}
            onChange={(v) => set({ ...d, holdout: v })}
            label={`🧪 ${tr('Hold 10% of traffic back as a control group', 'Giữ lại 10% lưu lượng làm nhóm đối chứng')}`}
            note={tr('You give up a tenth of the real lift and get the only number that tells you what the AI actually earned.', 'Bạn mất một phần mười hiệu quả thật và nhận lại con số duy nhất cho biết AI thật sự kiếm được bao nhiêu.')}
          />
        </div>
      </div>

      <div className="card">
        <p className="text-xs text-ink/60">{t(AG_QUARTER_INFO[Math.min(round, AG_ROUNDS)]?.text ?? AG_QUARTER_INFO[1]!.text)}</p>
      </div>
    </div>
  );
}

function Report({ report }: { report: AgReport; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  const r = report;
  return (
    <div className="space-y-3">
      {r.risks.length > 0 && (
        <ul className="space-y-1.5 rounded-xl bg-bad/10 p-3 text-sm">
          {r.risks.map((x) => (
            <li key={x.id}>
              ⚠️ {t(x.text)} <b className="whitespace-nowrap">−{bnv(x.cost, lang, 2)}</b>
            </li>
          ))}
        </ul>
      )}

      <Kv
        rows={[
          [tr('Orders from agents · from people', 'Đơn từ agent · từ người'), `${fmtNum(r.ordersAgent, lang)} · ${fmtNum(r.ordersHuman, lang)}`],
          ...(r.ordersFailed > 0
            ? ([[tr('Agent orders you could not honour', 'Đơn từ agent không thực hiện được'), fmtNum(r.ordersFailed, lang), true]] as Array<[string, string, boolean]>)
            : []),
          [tr('Share of the agent orders you won', 'Phần đơn từ agent bạn giành được'), pctv(r.agentWon, lang)],
          [tr('Revenue', 'Doanh thu'), bnv(r.revenue, lang, 2)],
          [tr('Contribution margin', 'Lợi nhuận đóng góp'), bnv(r.margin, lang, 2)],
          [tr('Running cost of what you hold', 'Chi phí vận hành những gì bạn giữ'), `−${bnv(r.opex, lang, 2)}`, r.opex > r.margin],
          ...(r.riskCost > 0 ? ([[tr('Cost of the incidents', 'Chi phí sự cố'), `−${bnv(r.riskCost, lang, 2)}`, true]] as Array<[string, string, boolean]>) : []),
          [tr('Profit this quarter', 'Lợi nhuận quý này'), bnv(r.profit, lang, 2), r.profit < 0],
        ]}
      />

      <div className="rounded-xl bg-ink/5 p-3 text-sm">
        <p className="font-semibold">🧪 {tr('What the recommender earned', 'Hệ gợi ý kiếm được bao nhiêu')}</p>
        <p className="mt-0.5">
          {tr('The dashboard says', 'Bảng điều khiển nói')} <b>{bnv(r.liftClaimed, lang, 2)}</b>
          {r.liftReal === null ? (
            <span className="text-ink/60">
              {' '}
              · {tr('with no control group there is no second number to compare it with, and that figure includes what the customer would have bought anyway.', 'không có nhóm đối chứng thì không có con số thứ hai để so, và con số đó bao gồm cả phần khách vốn đã mua.')}
            </span>
          ) : (
            <>
              {' '}
              · {tr('the control group says', 'nhóm đối chứng nói')} <b className="text-ok">{bnv(r.liftReal, lang, 2)}</b>
              <span className="text-ink/60"> · {tr('the gap is what the customer would have bought anyway.', 'phần chênh là những gì khách vốn đã mua.')}</span>
            </>
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60">
            <tr>
              <th className="py-1 pr-2">{tr('What you hold', 'Những gì bạn đang giữ')}</th>
              <th className="py-1 pr-2 text-right">{tr('Level', 'Mức')}</th>
              <th className="py-1 pr-2 text-right">{tr('Running cost', 'Chi phí vận hành')}</th>
            </tr>
          </thead>
          <tbody>
            {AG_CAPS.filter((c) => r.levels[c] > 0).map((c) => (
              <tr key={c} className="border-t border-ink/10">
                <td className="py-1 pr-2">
                  {AG_CAP_INFO[c].icon} {t(AG_CAP_INFO[c].name)}
                  <span className="ml-1 rounded bg-ink/10 px-1 text-[10px]">{AG_CAP_INFO[c].who === 'ax' ? tr('machine', 'máy') : tr('people', 'người')}</span>
                </td>
                <td className="py-1 pr-2 text-right font-semibold tabular-nums">{r.levels[c]}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-ink/60">{bnv(AG_OPEX[r.levels[c]]! / 1000, lang, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm">
        🧑‍⚖️ {tr('Automated systems under control this quarter', 'Hệ thống tự động có người kiểm soát trong quý')}: <b>{pctv(r.control, lang)}</b>
      </p>

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
  const pub = room.pub as unknown as Partial<AgPub>;
  if (!pub.profit) return null;
  const ids = room.order.slice().sort((a, b) => (pub.profit![b] ?? 0) - (pub.profit![a] ?? 0));
  const max = Math.max(0.01, ...Object.values(pub.profit).map((v) => Math.abs(v)));
  return (
    <div className="space-y-3">
      <div>
        <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>💰 {tr('Cumulative profit', 'Lợi nhuận cộng dồn')}</h2>
        <div className="grid gap-1.5">
          {ids.map((id) => {
            const v = pub.profit![id] ?? 0;
            const won = pub.agentWon?.[id] ?? 0;
            return (
              <div key={id} className={`grid grid-cols-[8rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'} ${id === me ? 'font-bold' : ''}`}>
                <span className="truncate">{room.players[id]?.name}</span>
                <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(1, (Math.abs(v) / max) * 100)}%`, background: v < 0 ? '#d64545' : colorOf(room, id) }}
                  />
                </div>
                <span className={`text-right tabular-nums ${v < 0 ? 'text-bad' : 'text-ink/70'}`}>
                  {bnv(v, lang, 2)} · {tr('agent', 'agent')} {pctv(won, lang)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {pub.market && (
        <div>
          <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🏗️ {tr('What the market has built, on average', 'Trung bình thị trường đã xây được gì')}</h2>
          <div className="grid gap-1.5">
            {AG_CAPS.map((c) => (
              <div key={c} className={`grid grid-cols-[12rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'}`}>
                <span className="truncate">
                  {AG_CAP_INFO[c].icon} {t(AG_CAP_INFO[c].name)}
                </span>
                <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                  <div
                    className={`h-full rounded-full ${AG_CAP_INFO[c].who === 'ax' ? 'bg-ink/60' : 'bg-amber'}`}
                    style={{ width: `${((pub.market![c] ?? 0) / AG_MAX_LEVEL) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums text-ink/60">{fmtNum(pub.market![c] ?? 0, lang, 1)}/3</span>
              </div>
            ))}
          </div>
          <p className={`mt-1 text-ink/50 ${big ? 'text-base' : 'text-xs'}`}>
            {tr('Once everyone has the same tools, the tools are not the advantage any more.', 'Khi ai cũng có cùng bộ công cụ thì công cụ không còn là lợi thế.')}
          </p>
        </div>
      )}
    </div>
  );
}

export const AG_WEB: RsWeb<AgDecision, AgReport, AgView> = {
  id: 'agent-arena',
  tag: 'Game 10 · Agent Arena',
  roundWord: tx('Quarter', 'Quý'),
  rounds: AG_ROUNDS,
  Briefing,
  roundInfo: (r) => AG_QUARTER_INFO[r] ?? AG_QUARTER_INFO[1]!,
  initial: (me) => {
    const pending = (me?.pending as AgDecision | null) ?? null;
    if (pending) return pending;
    const last = (me?.reports ?? [])[(me?.reports?.length ?? 0) - 1]?.decision as AgDecision | undefined;
    return {
      invest: { ...(me?.view?.levels ?? zeroCaps()) },
      guard: last?.guard ?? 'none',
      handover: last?.handover ?? 'never',
      diversity: last?.diversity ?? false,
      holdout: last?.holdout ?? false,
    };
  },
  check: (d, me) => {
    const have = me?.view?.levels ?? zeroCaps();
    const spent = spentOf(d, have);
    if (spent > AG_POINTS) return tx(`You have ${AG_POINTS} engineer-quarters.`, `Bạn chỉ có ${AG_POINTS} quý-kỹ-sư.`);
    for (const c of AG_CAPS)
      if ((d.invest[c] ?? 0) < (have[c] ?? 0)) return tx('What is built stays built – you cannot go back a level.', 'Thứ đã xây thì vẫn còn đó – không thể hạ mức.');
    return null;
  },
  Form,
  Report,
  Market,
  cols: [
    { key: 'profit', label: tx('Profit', 'Lợi nhuận'), fmt: (v, l) => bnv(v, l, 2), bad: (v) => v < 0 },
    { key: 'agent', label: tx('Agent orders', 'Đơn từ agent'), fmt: (v, l) => pctv(v, l) },
    { key: 'built', label: tx('Levels built', 'Số mức đã xây'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'opex', label: tx('Running cost', 'Chi phí vận hành'), fmt: (v, l) => bnv(v, l, 2) },
  ],
  chart: { title: tx('Cumulative profit (VND bn)', 'Lợi nhuận cộng dồn (tỷ đồng)'), fmt: (v, l) => fmtNum(v, l, 1) },
  scoreParts: AG_SCORE_PARTS,
  scoreMax: { profit: 50, agent: 25, control: 25 },
  badges: AG_BADGES,
  archetypes: AG_ARCHETYPE_INFO,
  debrief: AG_DEBRIEF,
  scoring: [
    ['5 quarters of 2027–2028, 6 sellers, one market. The share of orders placed by an AI agent rises from 10% to 58%.', '5 quý của 2027–2028, 6 người bán, một thị trường. Phần đơn do AI agent đặt tăng từ 10% lên 58%.'],
    ['Eight engineer-quarters each quarter. Five capabilities are read by machines, three are felt by people, and what is built stays built.', 'Mỗi quý tám quý-kỹ-sư. Năm năng lực do máy đọc, ba năng lực do người cảm nhận, và thứ đã xây thì vẫn còn đó.'],
    ['Without an ordering API an agent can recommend you but never buy from you; an agent order also needs no persuading, so it carries a better margin.', 'Không có API đặt hàng thì agent chỉ giới thiệu được bạn chứ không mua được; đơn từ agent cũng không cần thuyết phục nên có lợi nhuận đóng góp tốt hơn.'],
    ['Everything you hold costs money to run every quarter, whether it earns anything or not.', 'Mọi thứ bạn giữ đều tốn chi phí vận hành hằng quý, dù nó có kiếm được gì hay không.'],
    ['Every automated system needs its human control: a price band, a handover rule, a diversity constraint, and a control group to measure by.', 'Mỗi hệ thống tự động cần người kiểm soát: khoảng giá, luật chuyển người, ràng buộc đa dạng, và nhóm đối chứng để đo.'],
    ['Scorecard: cumulative profit 50 + agent orders won 25 + every automated system under human control 25.', 'Thẻ mục tiêu: lợi nhuận cộng dồn 50 + giành được đơn từ agent 25 + mọi hệ thống tự động đều có người kiểm soát 25.'],
    ['Moodle grade = 70% scorecard + 30% rank in the room.', 'Điểm Moodle = 70% thẻ mục tiêu + 30% thứ hạng trong phòng.'],
  ],
  source: tx(
    'Textbook Chapter 10: the three levels of AI commerce, the Agent Readiness checklist (§15.2), agent architecture and its three failure modes (§16), the four risks of dynamic pricing (§11.2), the three ailments of recommenders (§8.2–8.4), the handover signals (§13.2), measuring incrementality (§19) and why AI capability is not advantage (§21)',
    'Giáo trình Chương 10: ba mức AI commerce, bảng kiểm Agent Readiness (§15.2), kiến trúc agent và ba kiểu lỗi riêng của nó (§16), bốn rủi ro của định giá động (§11.2), ba bệnh của hệ gợi ý (§8.2–8.4), các dấu hiệu phải chuyển người (§13.2), đo hiệu quả tăng thêm (§19) và vì sao năng lực AI không phải lợi thế (§21)',
  ),
};
