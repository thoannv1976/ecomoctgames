// Game 3 – Shopper Stream: the game-specific parts of the shared round-sim screens.
import { useState } from 'react';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { tx } from '@arena/types';
import {
  SS_ARCHETYPE_INFO,
  SS_BADGES,
  SS_CHANNELS,
  SS_CHANNEL_INFO,
  SS_DEBRIEF,
  SS_FUNNEL,
  SS_INTERVIEW_COST,
  SS_MONTH_INFO,
  SS_PERSONAS,
  SS_PERSONA_INFO,
  SS_POINTS,
  SS_RECOVERY,
  SS_RECOVERY_INFO,
  SS_RESEARCH,
  SS_RESEARCH_INFO,
  SS_ROUNDS,
  SS_SCORE_PARTS,
  SS_STAGES,
  SS_STAGE_INFO,
  type SsChannel,
  type SsDecision,
  type SsPersona,
  type SsPub,
  type SsRecovery,
  type SsReport,
  type SsResearch,
  type SsStage,
  type SsView,
} from '@arena/ss';
import { useLang } from '../lib/i18n';
import { Choice, Kv, Stepper, bnv, colorOf, fmtNum, kv, pctv, type RsWeb } from '../rs/parts';

type Me = RsMe<SsReport, SsView>;
const zeroFix = () => Object.fromEntries(SS_STAGES.map((s) => [s, 0])) as Record<SsStage, number>;
const used = (d: SsDecision) => SS_STAGES.reduce((a, s) => a + (d.fix[s] ?? 0), 0);
const budgetOf = (d: SsDecision) => SS_POINTS - (d.research === 'interview' ? SS_INTERVIEW_COST : 0);
const ptw = (n: number, l: string) => `${n} ${l === 'en' ? (n === 1 ? 'point' : 'points') : 'điểm'}`;

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
              'Six brands sell comparable things to the same 120,000 shoppers. Those shoppers belong to six personas, and each persona walks the same six-step journey: Discover, Search, Compare, Buy, Review, Repurchase.',
              'Sáu thương hiệu bán những món tương tự nhau cho cùng 120.000 khách. Số khách đó thuộc sáu chân dung, và mỗi chân dung đi qua đúng sáu bước hành trình: Khám phá, Tìm kiếm, So sánh, Mua, Đánh giá, Mua lại.',
            )}
          </p>
          <p>
            {tr(
              `Every month you pick a channel to meet them through and spend ${SS_POINTS} improvement points on the journey. Six steps, ten points: you cannot fix everything, so the whole game is deciding what a point is worth where.`,
              `Mỗi tháng bạn chọn một kênh để gặp khách và chi ${SS_POINTS} điểm cải thiện cho hành trình. Sáu bước, mười điểm: không thể sửa hết, nên cả trận chỉ là việc quyết định một điểm bỏ vào đâu thì đáng nhất.`,
            )}
          </p>
          <p>
            {tr(
              'Each persona really drops off at one particular step, and that is hidden. Mining your own reviews is free but only speaks for the persona that already buys from you; an interview costs one point and you choose who to listen to.',
              'Mỗi chân dung thật sự rơi rụng ở một bước cụ thể, và điều đó bị ẩn. Đào dữ liệu đánh giá của mình thì miễn phí nhưng chỉ nói thay cho chân dung đã mua của bạn; phỏng vấn tốn một điểm và bạn được chọn người để nghe.',
            )}
          </p>
          <p>
            {tr(
              'What is counted at the end is the value of the customers who came back. A first order is acquisition, not value – so the gift buyer with the biggest basket is worth almost nothing.',
              'Cái được tính cuối cùng là giá trị của những khách đã quay lại. Đơn đầu tiên là chi phí thu hút khách, không phải giá trị – nên người mua quà có giỏ hàng lớn nhất lại gần như không đáng gì.',
            )}
          </p>
          <p>
            {tr(
              'Scorecard: value of the customers you kept 55, share of orders from returning customers 25, points spent where they were worth most 20. Grade = 70% scorecard + 30% rank.',
              'Thẻ mục tiêu: giá trị khách giữ được 55, tỷ lệ đơn từ khách quay lại 25, điểm bỏ vào đúng chỗ đáng nhất 20. Điểm = 70% thẻ mục tiêu + 30% thứ hạng.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/** The six personas: what everybody knows, plus whatever research has revealed. */
function Personas({ me, big }: { me: Me | null; big?: boolean }) {
  const { lang, t, tr } = useLang();
  const view = me?.view;
  return (
    <div>
      <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🧑‍🤝‍🧑 {tr('The six personas', 'Sáu chân dung khách')}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {SS_PERSONAS.map((p) => {
          const info = SS_PERSONA_INFO[p];
          const known = view?.known?.[p] ?? null;
          const mine = view?.base?.[p] ?? 0;
          return (
            <div key={p} className={`rounded-xl p-2.5 ring-1 ${known ? 'bg-ok/5 ring-ok/40' : 'bg-white ring-ink/10'}`}>
              <p className="text-sm font-bold">
                {info.icon} {t(info.name)}
                {mine > 0 && <span className="ml-1 rounded bg-amber/30 px-1 text-[10px] font-semibold">{fmtNum(mine, lang)} {tr('customers', 'khách')}</span>}
              </p>
              <p className="text-xs text-ink/60">{t(info.who)}</p>
              <p className="mt-1 text-xs text-ink/70">
                {tr('Basket', 'Giỏ hàng')} {fmtNum(info.aov, lang)}k · {tr('repurchase', 'mua lại')} {t(info.loyalty)}
              </p>
              {known ? (
                <div className="mt-1.5 space-y-0.5 border-t border-ok/30 pt-1.5 text-xs">
                  <p className="font-semibold text-ok">
                    {tr('Drops off at', 'Rơi rụng ở bước')}: {SS_STAGE_INFO[known.pain].icon} {t(SS_STAGE_INFO[known.pain].name)}
                  </p>
                  <p>
                    <span className="text-ink/50">Jobs:</span> {t(known.jobs)}
                  </p>
                  <p>
                    <span className="text-ink/50">Pains:</span> {t(known.pains)}
                  </p>
                  <p>
                    <span className="text-ink/50">Gains:</span> {t(known.gains)}
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-xs italic text-ink/40">{tr('You have not listened to this group yet.', 'Bạn chưa nghe nhóm này nói.')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Form({ room, me, d, set, round }: { room: RsRoomDoc; me: Me | null; d: SsDecision; set: (d: SsDecision) => void; round: number }) {
  const { lang, t, tr } = useLang();
  const view = me?.view;
  const pub = room.pub as unknown as Partial<SsPub>;
  const budget = budgetOf(d);
  const left = budget - used(d);
  const incident = view?.incident ?? null;

  return (
    <div className="space-y-3">
      <div className="card">
        <h2 className="mb-2 font-bold">🏷️ {tr('Your shop', 'Cửa hàng của bạn')}</h2>
        <Kv
          rows={[
            [tr('Value of the customers you kept', 'Giá trị khách giữ được'), bnv(view?.clv ?? 0, lang, 2)],
            [tr('Revenue so far', 'Doanh thu đến nay'), bnv(view?.revenue ?? 0, lang, 2)],
            [tr('Orders · from returning customers', 'Số đơn · trong đó khách quay lại'), `${fmtNum(view?.orders ?? 0, lang)} · ${fmtNum(view?.repeatOrders ?? 0, lang)}`],
            [tr('Customer base', 'Tập khách đang có'), fmtNum(SS_PERSONAS.reduce((a, p) => a + (view?.base?.[p] ?? 0), 0), lang)],
            [tr('Real reviews on your pages', 'Đánh giá thật trên trang hàng'), fmtNum(view?.reviews ?? 0, lang, 1)],
            [tr('Satisfaction (affects repurchase)', 'Mức hài lòng (ảnh hưởng mua lại)'), pctv(view?.sat ?? 1, lang), (view?.sat ?? 1) < 1],
          ]}
        />
      </div>

      {incident && (
        <div className="card ring-2 ring-bad/50">
          <h2 className="mb-1 font-bold text-bad">🚨 {tr('Failed deliveries waiting for an answer', 'Những đơn giao lỗi đang chờ bạn trả lời')}</h2>
          <p className="mb-2 text-sm text-ink/70">
            {tr(
              `${fmtNum(incident.customers, lang)} of your customers received the wrong goods, late. What do you do?`,
              `${fmtNum(incident.customers, lang)} khách của bạn nhận sai hàng và nhận muộn. Bạn xử lý thế nào?`,
            )}
          </p>
          <Choice
            cols={1}
            options={SS_RECOVERY}
            value={(d.recovery ?? 'refund') as SsRecovery}
            onChange={(r) => set({ ...d, recovery: r })}
            label={(r) => `${SS_RECOVERY_INFO[r].icon} ${t(SS_RECOVERY_INFO[r].name)}${r === 'refund' ? ` – ${bnv(incident.refund, lang, 2)}` : r === 'care' ? ` – ${bnv(incident.care, lang, 2)}` : ''}`}
            note={(r) => t(SS_RECOVERY_INFO[r].note)}
          />
        </div>
      )}

      <div className="card">
        <h2 className="mb-1 font-bold">📡 {tr('Where do you meet the shoppers this month?', 'Tháng này bạn gặp khách ở đâu?')}</h2>
        <Choice
          cols={1}
          options={SS_CHANNELS}
          value={d.channel}
          onChange={(ch: SsChannel) => set({ ...d, channel: ch })}
          label={(ch) => `${SS_CHANNEL_INFO[ch].icon} ${t(SS_CHANNEL_INFO[ch].name)} · ${tr('starts at', 'bắt đầu ở bước')} ${t(SS_STAGE_INFO[SS_CHANNEL_INFO[ch].entry].name)}`}
          note={(ch) => t(SS_CHANNEL_INFO[ch].note)}
        />
      </div>

      <div className="card">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-bold">🛠️ {tr('Improvement points on the journey', 'Điểm cải thiện trên hành trình')}</h2>
          <span className={`text-sm font-bold tabular-nums ${left < 0 ? 'text-bad' : left === 0 ? 'text-ok' : 'text-ink/60'}`}>
            {tr('left', 'còn')} {ptw(left, lang)}
          </span>
        </div>
        <div className="grid gap-2.5">
          {SS_STAGES.map((s) => {
            const info = SS_STAGE_INFO[s];
            const mkt = pub.funnel?.[s];
            const mine = view?.funnel?.[s];
            return (
              <div key={s} className="rounded-xl bg-white p-2.5 ring-1 ring-ink/10">
                <Stepper
                  label={`${info.icon} ${t(info.name)}`}
                  value={d.fix[s] ?? 0}
                  onChange={(v) => set({ ...d, fix: { ...d.fix, [s]: v } })}
                  max={Math.min(budget, (d.fix[s] ?? 0) + Math.max(0, left))}
                  step={1}
                  show={(v) => String(v)}
                />
                <p className="mt-1 text-xs italic text-ink/60">{t(info.question)}</p>
                <p className="text-xs text-ink/50">{t(info.fix)}</p>
                {(mkt !== undefined || mine !== undefined) && (
                  <p className="mt-1 text-xs text-ink/50">
                    {mine !== undefined && (
                      <>
                        {tr('you', 'bạn')} <b className="text-ink/70">{pctv(mine, lang)}</b>{' '}
                      </>
                    )}
                    {mkt !== undefined && <>· {tr('market', 'thị trường')} {pctv(mkt, lang)}</>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 font-bold">🔎 {tr('Listen to the shoppers', 'Nghe khách nói')}</h2>
        <Choice
          cols={1}
          options={SS_RESEARCH}
          value={d.research}
          onChange={(r: SsResearch) => set({ ...d, research: r, interviewOf: r === 'interview' ? (d.interviewOf ?? 'mom') : null })}
          label={(r) => `${SS_RESEARCH_INFO[r].icon} ${t(SS_RESEARCH_INFO[r].name)}`}
          note={(r) => t(SS_RESEARCH_INFO[r].note)}
        />
        {d.research === 'interview' && (
          <div className="mt-2">
            <p className="mb-1 text-sm font-medium">{tr('Who do you want to interview?', 'Bạn muốn phỏng vấn ai?')}</p>
            <Choice
              cols={2}
              options={SS_PERSONAS}
              value={(d.interviewOf ?? 'mom') as SsPersona}
              onChange={(p: SsPersona) => set({ ...d, interviewOf: p })}
              label={(p) => `${SS_PERSONA_INFO[p].icon} ${t(SS_PERSONA_INFO[p].name)}`}
              note={(p) => (me?.view?.known?.[p] ? tr('already listened to', 'đã nghe nhóm này') : `${fmtNum(SS_PERSONA_INFO[p].aov, lang)}k · ${t(SS_PERSONA_INFO[p].loyalty)}`)}
            />
          </div>
        )}
      </div>

      <div className="card">
        <Personas me={me} />
        <p className="mt-2 text-xs text-ink/50">
          {t(SS_MONTH_INFO[Math.min(round, SS_ROUNDS)]?.text ?? SS_MONTH_INFO[1]!.text)}
        </p>
      </div>
    </div>
  );
}

function Report({ report }: { report: SsReport; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  const r = report;
  const newTotal = SS_PERSONAS.reduce((a, p) => a + r.newBuyers[p], 0);
  const repTotal = SS_PERSONAS.reduce((a, p) => a + r.repeatOrders[p], 0);
  return (
    <div className="space-y-3">
      {r.incident && <p className="rounded-xl bg-bad/10 p-3 text-sm">🚨 {t(r.incident)}</p>}
      <Kv
        rows={[
          [tr('Revenue this month', 'Doanh thu tháng này'), bnv(r.revenue, lang, 2)],
          [tr('Value from returning customers', 'Giá trị từ khách quay lại'), bnv(r.clvGain, lang, 2)],
          ...(r.cost > 0 ? ([[tr('Cost of putting the failure right', 'Chi phí xử lý sự cố'), bnv(r.cost, lang, 2), true]] as Array<[string, string, boolean]>) : []),
          [tr('First orders · repeat orders', 'Đơn đầu tiên · đơn mua lại'), `${fmtNum(newTotal, lang)} · ${fmtNum(repTotal, lang)}`],
        ]}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink/60">
            <tr>
              <th className="py-1 pr-2">{tr('Persona', 'Chân dung')}</th>
              <th className="py-1 pr-2 text-right">{tr('New', 'Khách mới')}</th>
              <th className="py-1 pr-2 text-right">{tr('Came back', 'Quay lại')}</th>
              <th className="py-1 pr-2 text-right">{tr('Basket', 'Giỏ hàng')}</th>
            </tr>
          </thead>
          <tbody>
            {SS_PERSONAS.filter((p) => r.newBuyers[p] + r.repeatOrders[p] > 0).map((p) => (
              <tr key={p} className="border-t border-ink/10">
                <td className="py-1 pr-2">
                  {SS_PERSONA_INFO[p].icon} {t(SS_PERSONA_INFO[p].name)}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">{fmtNum(r.newBuyers[p], lang)}</td>
                <td className="py-1 pr-2 text-right font-semibold tabular-nums">{fmtNum(r.repeatOrders[p], lang)}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-ink/60">{fmtNum(SS_PERSONA_INFO[p].aov, lang)}k</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-ink/5 p-3">
        <p className="text-sm font-semibold">
          🎯 {tr('A point was worth most on', 'Một điểm đáng nhất ở bước')}: {SS_STAGE_INFO[r.best].icon} {t(SS_STAGE_INFO[r.best].name)}
          <span className="font-normal text-ink/60">
            {' '}
            ({tr('then', 'rồi đến')} {t(SS_STAGE_INFO[r.second].name)})
          </span>
        </p>
        <p className="mt-0.5 text-sm text-ink/70">
          {tr('Your ten points bought', 'Mười điểm của bạn mua được')} <b>{pctv(r.insight, lang)}</b> {tr('of what they could have bought this month.', 'so với mức đáng nhất có thể mua trong tháng này.')}
        </p>
      </div>

      {r.reveal && (
        <div className="rounded-xl bg-ok/10 p-3 text-sm">
          <p className="font-semibold">
            {SS_RESEARCH_INFO[r.decision.research].icon} {SS_PERSONA_INFO[r.reveal.persona].icon} {t(SS_PERSONA_INFO[r.reveal.persona].name)} —{' '}
            {tr('drops off at', 'rơi rụng ở bước')} {t(SS_STAGE_INFO[r.reveal.pain].name)}
          </p>
          <p className="mt-1">“{t(r.reveal.pains)}”</p>
          <p className="text-ink/70">{t(r.reveal.gains)}</p>
        </div>
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
  const pub = room.pub as unknown as Partial<SsPub>;
  if (!pub.clv) return null;
  const ids = room.order.slice().sort((a, b) => (pub.clv![b] ?? 0) - (pub.clv![a] ?? 0));
  const max = Math.max(0.01, ...Object.values(pub.clv));
  const funnel = pub.funnel;
  const worst = funnel ? SS_FUNNEL.slice().sort((a, b) => funnel[a]! - funnel[b]!)[0] : null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>💎 {tr('Value of the customers each brand kept', 'Giá trị khách mỗi thương hiệu giữ được')}</h2>
        <div className="grid gap-1.5">
          {ids.map((id) => {
            const v = pub.clv![id] ?? 0;
            const ch = pub.channel?.[id];
            return (
              <div key={id} className={`grid grid-cols-[8rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'} ${id === me ? 'font-bold' : ''}`}>
                <span className="truncate">
                  {ch && <span title={t(SS_CHANNEL_INFO[ch].name)}>{SS_CHANNEL_INFO[ch].icon} </span>}
                  {room.players[id]?.name}
                </span>
                <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(1, (v / max) * 100)}%`, background: colorOf(room, id) }} />
                </div>
                <span className="text-right tabular-nums text-ink/70">
                  {bnv(v, lang, 2)} · {fmtNum(pub.base?.[id] ?? 0, lang)} {tr('cust.', 'khách')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {funnel && (
        <div>
          <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🪜 {tr('The market funnel', 'Phễu của thị trường')}</h2>
          <div className="grid gap-1.5">
            {SS_STAGES.map((s) => (
              <div key={s} className={`grid grid-cols-[9rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'}`}>
                <span className="truncate">
                  {SS_STAGE_INFO[s].icon} {t(SS_STAGE_INFO[s].name)}
                  {worst === s && <span className="ml-1 text-xs text-bad">▼</span>}
                </span>
                <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                  <div className={`h-full rounded-full ${worst === s ? 'bg-bad/60' : 'bg-ink/60'}`} style={{ width: `${(funnel[s] ?? 0) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums text-ink/60">{pctv(funnel[s] ?? 0, lang)}</span>
              </div>
            ))}
          </div>
          <p className={`mt-1 text-ink/50 ${big ? 'text-base' : 'text-xs'}`}>
            {tr('▼ the biggest drop-off in the market – which is not the same thing as the most valuable step to fix.', '▼ chỗ rơi rụng lớn nhất của thị trường – không đồng nghĩa với bước đáng sửa nhất.')}
          </p>
        </div>
      )}

      {pub.pool && (
        <div>
          <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🧑‍🤝‍🧑 {tr('Shoppers who are nobody’s customer yet', 'Khách chưa thuộc về ai')}</h2>
          <div className="grid gap-1.5">
            {SS_PERSONAS.map((p) => (
              <div key={p} className={`grid grid-cols-[11rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'}`}>
                <span className="truncate">
                  {SS_PERSONA_INFO[p].icon} {t(SS_PERSONA_INFO[p].name)}
                </span>
                <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                  <div className="h-full rounded-full bg-amber" style={{ width: `${((pub.pool![p] ?? 0) / 30_000) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums text-ink/60">{kv((pub.pool![p] ?? 0) / 1000, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Reveal({ me }: { me: Me; room: RsRoomDoc }) {
  return <Personas me={me} />;
}

export const SS_WEB: RsWeb<SsDecision, SsReport, SsView> = {
  id: 'shopper-stream',
  tag: 'Game 3 · Shopper Stream',
  roundWord: tx('Month', 'Tháng'),
  rounds: SS_ROUNDS,
  Briefing,
  roundInfo: (r) => SS_MONTH_INFO[r] ?? SS_MONTH_INFO[1]!,
  initial: (me) => {
    const pending = (me?.pending as SsDecision | null) ?? null;
    if (pending) return pending;
    return {
      channel: 'search' as SsChannel,
      fix: zeroFix(),
      research: 'none' as SsResearch,
      interviewOf: null,
      recovery: me?.view?.incident ? ('refund' as SsRecovery) : null,
    };
  },
  check: (d, me) => {
    const budget = budgetOf(d);
    if (used(d) > budget) return tx(`You have ${budget} points to spend.`, `Bạn chỉ có ${budget} điểm để chi.`);
    if (used(d) === 0) return tx('Spend your points – nothing improves by itself.', 'Hãy chi điểm cải thiện – không có gì tự tốt lên.');
    if (d.research === 'interview' && !d.interviewOf) return tx('Choose which persona to interview.', 'Hãy chọn chân dung khách để phỏng vấn.');
    if (me?.view?.incident && !d.recovery) return tx('Decide what to do about the failed deliveries.', 'Hãy quyết định xử lý những đơn giao lỗi.');
    return null;
  },
  Form,
  Report,
  Market,
  Reveal,
  cols: [
    { key: 'clv', label: tx('Kept-customer value', 'Giá trị khách giữ được'), fmt: (v, l) => bnv(v, l, 2) },
    { key: 'base', label: tx('Customers', 'Khách'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'orders', label: tx('Orders', 'Số đơn'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'loyal', label: tx('Repeat share', 'Tỷ lệ mua lại'), fmt: (v, l) => pctv(v, l), bad: (v) => v < 0.25 },
  ],
  chart: { title: tx('Value of the customers kept (VND bn)', 'Giá trị khách giữ được (tỷ đồng)'), fmt: (v, l) => fmtNum(v, l, 1) },
  scoreParts: SS_SCORE_PARTS,
  scoreMax: { clv: 55, loyal: 25, insight: 20 },
  badges: SS_BADGES,
  archetypes: SS_ARCHETYPE_INFO,
  debrief: SS_DEBRIEF,
  scoring: [
    ['5 months, 6 brands, the same 120,000 shoppers in 6 personas. Ten improvement points a month for a journey with six steps.', '5 tháng, 6 thương hiệu, cùng 120.000 khách thuộc 6 chân dung. Mỗi tháng mười điểm cải thiện cho một hành trình sáu bước.'],
    ['The channel you choose decides where the shopper enters the journey – and how sharply demand concentrates on the best-looking shop.', 'Kênh bạn chọn quyết định khách bước vào hành trình từ đâu – và nhu cầu dồn về cửa hàng trông tốt nhất đến mức nào.'],
    ['Each persona really drops off at one hidden step. Review mining is free but biased; an interview costs one point and you choose who to listen to.', 'Mỗi chân dung thật sự rơi rụng ở một bước bị ẩn. Đào đánh giá thì miễn phí nhưng lệch; phỏng vấn tốn một điểm và bạn được chọn người để nghe.'],
    ['A delivery failure hits the brand with the most customers. How it is answered decides more than the failure itself.', 'Một sự cố giao hàng rơi vào thương hiệu có nhiều khách nhất. Cách trả lời quyết định nhiều hơn chính sự cố.'],
    ['Scorecard: value of the customers you kept 55 + share of orders from returning customers 25 + points spent where they were worth most 20.', 'Thẻ mục tiêu: giá trị khách giữ được 55 + tỷ lệ đơn từ khách quay lại 25 + điểm bỏ vào đúng chỗ đáng nhất 20.'],
    ['Moodle grade = 70% scorecard + 30% rank in the room.', 'Điểm Moodle = 70% thẻ mục tiêu + 30% thứ hạng trong phòng.'],
  ],
  source: tx(
    'Textbook Chapter 3: the customer journey and its six steps, personas and the Jobs–Pains–Gains frame, funnel and cohort analysis, customer lifetime value, and the service-recovery paradox',
    'Giáo trình Chương 3: hành trình khách hàng và sáu bước, chân dung khách và khung Jobs – Pains – Gains, phân tích phễu và cohort, giá trị trọn đời của khách, và nghịch lý phục hồi dịch vụ',
  ),
};
