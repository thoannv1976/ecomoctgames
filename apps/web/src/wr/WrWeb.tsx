// Game 1 – Wave Rider: the game-specific parts of the shared round-sim screens.
import { useState } from 'react';
import type { RsMe, RsRoomDoc } from '@arena/rs';
import { tx } from '@arena/types';
import {
  WR_ARCHETYPE_INFO,
  WR_BADGES,
  WR_BONUS_CHIPS,
  WR_DEBRIEF,
  WR_INFRA,
  WR_LAYERS,
  WR_LAYER_INFO,
  WR_LEVEL_NAME,
  WR_MODELS,
  WR_MODEL_INFO,
  WR_ROUNDS,
  WR_SCORE_PARTS,
  WR_WAVE_INFO,
  type WrDecision,
  type WrModel,
  type WrPub,
  type WrReport,
  type WrView,
} from '@arena/wr';
import { useLang } from '../lib/i18n';
import { Kv, colorOf, fmtNum, type RsWeb } from '../rs/parts';

type Me = RsMe<WrReport, WrView>;
const zero = () => Object.fromEntries(WR_MODELS.map((m) => [m, 0])) as Record<WrModel, number>;
const chipsUsed = (d: WrDecision) => WR_MODELS.reduce((a, m) => a + (d.chips[m] ?? 0), 0);
const chipw = (n: number, l: string) => `${n} ${l === 'en' ? (n === 1 ? 'chip' : 'chips') : 'chip'}`;

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
          <p>{tr('You are one of six founders living through five waves of Vietnamese e-commerce, from classifieds and cash in hand to AI agents that shop for people.', 'Bạn là một trong sáu nhà sáng lập đi qua năm làn sóng thương mại điện tử Việt Nam, từ thời rao vặt và tiền mặt đến thời AI agent đi mua hộ.')}</p>
          <p>{tr('Each wave you split your capital chips across six business models. What a model earns depends on the infrastructure of that era – and on how many of the six of you pile into it. Chips you do not place stay as cash.', 'Mỗi làn sóng bạn chia chip vốn cho sáu mô hình kinh doanh. Mô hình kiếm được bao nhiêu phụ thuộc vào hạ tầng của thời đó – và vào việc bao nhiêu người trong sáu người cùng đổ vào đó. Chip không đặt thì để làm tiền mặt.')}</p>
          <p>{tr('A model you already ran in an earlier wave gives you a head start when its wave arrives. One wave early pays; two waves early burns the capital.', 'Mô hình bạn đã làm từ làn sóng trước cho bạn lợi thế đi trước khi làn sóng của nó đến. Đi trước một bước thì có lãi; đi trước hai bước thì cháy vốn.')}</p>
          <p>{tr(`Each wave also asks one manager-numbers question: a right answer adds ${WR_BONUS_CHIPS} chips for the next wave and fills part of the scorecard.`, `Mỗi làn sóng còn có một câu hỏi đọc số liệu: trả lời đúng được thêm ${WR_BONUS_CHIPS} chip cho làn sóng sau và được điểm trong thẻ mục tiêu.`)}</p>
          <p>{tr('Scorecard: capital at the end 60, riding the wave early 25, reading the numbers 15. Grade = 70% scorecard + 30% rank.', 'Thẻ mục tiêu: vốn cuối game 60, đón sóng đúng nhịp 25, đọc số liệu 15. Điểm = 70% thẻ mục tiêu + 30% thứ hạng.')}</p>
        </div>
      )}
    </div>
  );
}

function Infra({ round, big }: { round: number; big?: boolean }) {
  const { t, tr } = useLang();
  const now = WR_INFRA[round] ?? WR_INFRA[1]!;
  return (
    <div>
      <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🧱 {tr('Infrastructure of this era', 'Hạ tầng của thời này')}</h2>
      <div className="grid gap-1.5">
        {WR_LAYERS.map((layer) => {
          const lv = now[layer];
          return (
            <div key={layer} className={`grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-2 ${big ? 'text-xl' : 'text-sm'}`}>
              <span>
                {WR_LAYER_INFO[layer].icon} {t(WR_LAYER_INFO[layer].name)}
              </span>
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <span key={i} className={`h-2.5 flex-1 rounded-full ${i <= lv ? 'bg-ink' : 'bg-ink/10'}`} />
                ))}
              </div>
              <span className="text-right text-xs text-ink/60">{t(WR_LEVEL_NAME[lv] ?? WR_LEVEL_NAME[0]!)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Form({ room, me, d, set, round }: { room: RsRoomDoc; me: Me | null; d: WrDecision; set: (d: WrDecision) => void; round: number }) {
  const { lang, t, tr } = useLang();
  const v = me?.view;
  const have = v?.chips ?? 10;
  const used = chipsUsed(d);
  const left = have - used;
  const q = v?.question ?? null;
  const put = (m: WrModel, n: number) => set({ ...d, chips: { ...d.chips, [m]: Math.max(0, n) } });
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-2 font-bold">💰 {tr('Your capital', 'Vốn của bạn')}</h2>
        <Kv
          rows={[
            [tr('Capital', 'Vốn'), chipw(have, lang)],
            [tr('Placed this wave', 'Đã đặt làn sóng này'), chipw(used, lang)],
            [tr('Left as cash', 'Còn lại làm tiền mặt'), chipw(Math.max(0, left), lang), left < 0],
          ]}
        />
        <p className="mt-2 text-xs text-ink/60">{tr('One chip ≈ VND 1 bn. Cash is safe, but cash does not ride a wave.', 'Một chip ≈ 1 tỷ đồng. Tiền mặt an toàn, nhưng tiền mặt không đón được sóng.')}</p>
      </div>
      <div className="card">
        <Infra round={round} />
        <p className="mt-2 text-xs text-ink/60">{tr('Match the model to the layers it needs. A layer at “none” means the model cannot work yet.', 'Hãy khớp mô hình với các lớp hạ tầng nó cần. Lớp ở mức “chưa có” nghĩa là mô hình đó chưa chạy được.')}</p>
      </div>
      <div className="card space-y-2">
        <h2 className="font-bold">🎲 {tr('Where do your chips go?', 'Chip của bạn đi đâu?')}</h2>
        {WR_MODELS.map((m) => {
          const n = d.chips[m] ?? 0;
          const exp = v?.experience?.[m] ?? 0;
          return (
            <div key={m} className="rounded-xl bg-white px-3 py-2 ring-1 ring-ink/15">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {WR_MODEL_INFO[m].icon} {t(WR_MODEL_INFO[m].name)}
                    {exp >= 1 && <span className="ml-1 rounded bg-ok/15 px-1 text-[10px] font-semibold text-ok">{tr('head start', 'đi trước')}</span>}
                  </p>
                  <p className="text-xs text-ink/60">
                    {tr('Needs', 'Cần')}: {t(WR_MODEL_INFO[m].needs)} · {t(WR_MODEL_INFO[m].note)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" aria-label="−" className="h-8 w-8 rounded-lg bg-ink/10 font-bold disabled:opacity-30" disabled={n <= 0} onClick={() => put(m, n - 1)}>
                    −
                  </button>
                  <span className="min-w-8 text-center text-lg font-extrabold tabular-nums">{n}</span>
                  <button type="button" aria-label="+" className="h-8 w-8 rounded-lg bg-ink font-bold text-white disabled:opacity-30" disabled={left <= 0} onClick={() => put(m, n + 1)}>
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {used > 0 && (
          <button type="button" className="text-xs font-semibold text-ink/60 underline" onClick={() => set({ ...d, chips: zero() })}>
            {tr('Clear all chips', 'Bỏ hết chip')}
          </button>
        )}
      </div>
      {q && (
        <div className="card space-y-2">
          <h2 className="font-bold">🧮 {tr('Reading the numbers', 'Đọc số liệu')}</h2>
          <p className="text-[15px]">{t(q.prompt)}</p>
          <div className="grid gap-1.5">
            {q.options.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => set({ ...d, answer: d.answer === i ? null : i })}
                className={`rounded-xl px-3 py-2 text-left text-sm ring-1 ${d.answer === i ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/10'}`}
              >
                {t(o)}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink/60">
            {round < WR_ROUNDS
              ? tr(`A right answer adds ${WR_BONUS_CHIPS} chips for the next wave.`, `Trả lời đúng được thêm ${WR_BONUS_CHIPS} chip cho làn sóng sau.`)
              : tr('Last wave: this answer only counts on the scorecard.', 'Làn sóng cuối: câu này chỉ tính vào thẻ mục tiêu.')}
          </p>
        </div>
      )}
      {round > 1 && (
        <div className="card">
          <Market room={room} me={me?.playerId} />
        </div>
      )}
    </div>
  );
}

function Report({ report }: { report: WrReport; room: RsRoomDoc }) {
  const { lang, t, tr } = useLang();
  const placed = WR_MODELS.filter((m) => report.models[m].chips > 0);
  return (
    <div className="card space-y-3">
      <h2 className="font-bold">
        🌊 {tr(`Wave ${report.round}: your capital`, `Làn sóng ${report.round}: vốn của bạn`)}
        {report.defaulted ? <span className="ml-2 rounded bg-ink/10 px-1.5 text-xs font-normal">{tr('no plan – chips stayed in cash', 'không nộp – chip để làm tiền mặt')}</span> : null}
      </h2>
      <div className="rounded-xl bg-ink px-3 py-2 text-center text-sm text-white">
        {chipw(report.chipsBefore, lang)} → <b className={report.chipsAfter < report.chipsBefore ? 'text-red-300' : 'text-amber'}>{chipw(report.chipsAfter, lang)}</b>
        {report.cash > 0 && <span className="text-white/70"> · {tr('cash kept', 'tiền mặt giữ lại')} {fmtNum(report.cash, lang, 1)}</span>}
      </div>
      {placed.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>
                <th className="py-1 pr-2">{tr('Model', 'Mô hình')}</th>
                <th className="py-1 pr-2 text-right">{tr('Chips', 'Chip')}</th>
                <th className="py-1 pr-2 text-right">{tr('One chip came back as', 'Một chip quay về')}</th>
                <th className="py-1 pr-2 text-right">{tr('Market chips here', 'Chip toàn thị trường')}</th>
              </tr>
            </thead>
            <tbody>
              {placed.map((m) => {
                const r = report.models[m];
                return (
                  <tr key={m} className="border-t border-ink/10">
                    <td className="py-1.5 pr-2">
                      {WR_MODEL_INFO[m].icon} {t(WR_MODEL_INFO[m].name)}
                      {r.earlyBonus > 0.005 && <span className="ml-1 text-xs text-ok">+{Math.round(r.earlyBonus * 100)}% {tr('head start', 'đi trước')}</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.chips}</td>
                    <td className={`py-1.5 pr-2 text-right font-semibold tabular-nums ${r.mult < 1 ? 'text-bad' : 'text-ok'}`}>{fmtNum(r.mult, lang, 2)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink/60">{r.crowd}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink/60">{tr('You placed no chips this wave: the capital sat in cash.', 'Làn sóng này bạn không đặt chip nào: vốn nằm yên dưới dạng tiền mặt.')}</p>
      )}
      {report.answerRight !== null && (
        <div className={`rounded-xl p-3 text-sm ${report.answerRight ? 'bg-ok/10' : 'bg-bad/10'}`}>
          <p className="font-semibold">
            {report.answerRight ? tr('Question: right', 'Câu hỏi: đúng') : tr('Question: wrong', 'Câu hỏi: sai')}
            {report.answerRight && report.round < WR_ROUNDS ? ` · +${WR_BONUS_CHIPS} ${tr('chips', 'chip')}` : ''}
          </p>
          {report.explain && <p className="mt-1 text-ink/80">{t(report.explain)}</p>}
        </div>
      )}
      {report.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber/10 p-3 text-sm">
          {report.notes.map((n, i) => (
            <li key={i}>💡 {t(n)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Market({ room, me, big }: { room: RsRoomDoc; me?: string; big?: boolean }) {
  const { lang, t, tr } = useLang();
  const pub = room.pub as unknown as Partial<WrPub>;
  if (!pub.capital) return null;
  const ids = room.order.slice().sort((a, b) => (pub.capital![b] ?? 0) - (pub.capital![a] ?? 0));
  const max = Math.max(1, ...Object.values(pub.capital));
  const crowd = pub.crowd ?? zero();
  const totalChips = WR_MODELS.reduce((a, m) => a + (crowd[m] ?? 0), 0) || 1;
  return (
    <div className="space-y-3">
      <div>
        <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>💰 {tr('Capital of the six founders', 'Vốn của sáu nhà sáng lập')}</h2>
        <div className="grid gap-1.5">
          {ids.map((id) => {
            const c = pub.capital![id] ?? 0;
            return (
              <div key={id} className={`grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'} ${id === me ? 'font-bold' : ''}`}>
                <span className="truncate">{room.players[id]?.name}</span>
                <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(1, (c / max) * 100)}%`, background: colorOf(room, id) }} />
                </div>
                <span className="text-right tabular-nums text-ink/70">{chipw(Math.round(c), lang)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h2 className={`mb-2 font-bold ${big ? 'text-2xl' : ''}`}>🧭 {tr('Where the market put its chips last wave', 'Làn sóng trước thị trường đặt chip ở đâu')}</h2>
        <div className="grid gap-1.5">
          {WR_MODELS.slice()
            .sort((a, b) => (crowd[b] ?? 0) - (crowd[a] ?? 0))
            .map((m) => (
              <div key={m} className={`grid grid-cols-[11rem_1fr_auto] items-center gap-2 ${big ? 'text-xl' : 'text-sm'}`}>
                <span className="truncate">
                  {WR_MODEL_INFO[m].icon} {t(WR_MODEL_INFO[m].name)}
                  {pub.best === m && <span className="ml-1 text-xs text-ok">★</span>}
                </span>
                <div className={`${big ? 'h-5' : 'h-3'} overflow-hidden rounded-full bg-ink/10`}>
                  <div className="h-full rounded-full bg-ink/60" style={{ width: `${((crowd[m] ?? 0) / totalChips) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums text-ink/60">{crowd[m] ?? 0}</span>
              </div>
            ))}
        </div>
        <p className={`mt-1 text-ink/50 ${big ? 'text-base' : 'text-xs'}`}>{tr('★ paid best last wave. The more chips chase a model, the less extra return is left for each.', '★ lãi nhất làn sóng trước. Càng nhiều chip đổ vào một mô hình thì phần lãi thêm chia cho mỗi chip càng ít.')}</p>
      </div>
    </div>
  );
}

export const WR_WEB: RsWeb<WrDecision, WrReport, WrView> = {
  id: 'wave-rider',
  tag: 'Game 1 · Wave Rider',
  roundWord: tx('Wave', 'Sóng'),
  rounds: WR_ROUNDS,
  Briefing,
  roundInfo: (r) => WR_WAVE_INFO[r] ?? WR_WAVE_INFO[1]!,
  initial: (me) => ({ chips: zero(), answer: (me?.pending as WrDecision | null)?.answer ?? null }),
  check: (d, me) => {
    const have = me?.view?.chips ?? 10;
    if (chipsUsed(d) > have) return tx(`You have only ${have} chips.`, `Bạn chỉ có ${have} chip.`);
    if (chipsUsed(d) === 0) return tx('Place at least one chip, or you sit out this wave.', 'Hãy đặt ít nhất một chip, nếu không bạn bỏ qua làn sóng này.');
    if (d.answer === null) return tx('Answer the question – a right answer adds chips.', 'Hãy trả lời câu hỏi – trả lời đúng được thêm chip.');
    return null;
  },
  Form,
  Report,
  Market,
  cols: [
    { key: 'capital', label: tx('Capital', 'Vốn'), fmt: (v, l) => chipw(Math.round(v), l) },
    { key: 'right', label: tx('Questions right', 'Câu đúng'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'early', label: tx('Waves caught early', 'Sóng đón sớm'), fmt: (v, l) => fmtNum(v, l) },
    { key: 'peak', label: tx('Peak capital', 'Vốn cao nhất'), fmt: (v, l) => fmtNum(v, l, 1) },
  ],
  chart: { title: tx('Capital after each wave (chips)', 'Vốn sau mỗi làn sóng (chip)'), fmt: (v, l) => fmtNum(v, l, 0) },
  scoreParts: WR_SCORE_PARTS,
  scoreMax: { capital: 60, timing: 25, quiz: 15 },
  badges: WR_BADGES,
  archetypes: WR_ARCHETYPE_INFO,
  debrief: WR_DEBRIEF,
  scoring: [
    ['5 waves of Vietnamese e-commerce, 6 founders, 10 capital chips each. Chips you do not place stay as cash.', '5 làn sóng TMĐT Việt Nam, 6 nhà sáng lập, mỗi người 10 chip vốn. Chip không đặt thì để làm tiền mặt.'],
    ['What a model earns depends on the infrastructure of that era – and is shared among everyone who piles into it.', 'Mô hình kiếm được bao nhiêu phụ thuộc hạ tầng của thời đó – và bị chia cho tất cả những người cùng đổ vào.'],
    ['A model you ran in an earlier wave gives a head start when its wave arrives; two waves early burns the capital.', 'Mô hình đã làm từ làn sóng trước cho lợi thế khi làn sóng của nó đến; đi trước hai bước thì cháy vốn.'],
    ['One manager-numbers question each wave: a right answer adds 2 chips for the next wave.', 'Mỗi làn sóng một câu hỏi đọc số liệu: trả lời đúng được thêm 2 chip cho làn sóng sau.'],
    ['Scorecard: capital at the end 60 + riding the wave early 25 + reading the numbers 15.', 'Thẻ mục tiêu: vốn cuối game 60 + đón sóng đúng nhịp 25 + đọc số liệu 15.'],
    ['Moodle grade = 70% scorecard + 30% rank in the room.', 'Điểm Moodle = 70% thẻ mục tiêu + 30% thứ hạng trong phòng.'],
  ],
  source: tx(
    'Textbook Chapter 1, Sections 2 (four waves, the waves of Vietnamese e-commerce), 4 (infrastructure layers), 6 (the ordering-process definition), 10.3 (GMV ≠ revenue ≠ profit) and the three levels of AI commerce',
    'Giáo trình Chương 1, mục 2 (bốn làn sóng, các làn sóng TMĐT Việt Nam), 4 (các lớp hạ tầng), 6 (định nghĩa theo quá trình đặt hàng), 10.3 (GMV ≠ doanh thu ≠ lợi nhuận) và ba mức AI commerce',
  ),
};
