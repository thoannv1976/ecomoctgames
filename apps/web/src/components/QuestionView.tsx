import { useEffect, useState } from 'react';
import { CATEGORY_LABEL, type AnswerInput, type AnswerKey, type Category, type HintPayload, type PublicQuestion } from '@arena/types';
import { useLang } from '../lib/i18n';

export const CATEGORY_STYLE: Record<Category, string> = {
  bottleneck: 'bg-rose-100 text-rose-800',
  calc: 'bg-sky-100 text-sky-800',
  lever: 'bg-emerald-100 text-emerald-800',
  goodhart: 'bg-orange-100 text-orange-800',
  pair: 'bg-violet-100 text-violet-800',
  ceo: 'bg-slate-200 text-slate-800',
};
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function CategoryChip({ category, big }: { category: Category; big?: boolean }) {
  const { t } = useLang();
  return <span className={`rounded-full px-3 py-1 font-semibold ${big ? 'text-base' : 'text-xs'} ${CATEGORY_STYLE[category]}`}>{t(CATEGORY_LABEL[category])}</span>;
}

export function QuestionHeader({ q, big }: { q: PublicQuestion; big?: boolean }) {
  const { t } = useLang();
  return (
    <div className="space-y-3">
      <p className={`font-bold leading-snug ${big ? 'text-3xl' : 'text-lg sm:text-xl'}`}>{t(q.prompt)}</p>
      {q.context && <div className={`whitespace-pre-line rounded-xl bg-ink/5 p-3 leading-relaxed ${big ? 'text-2xl' : 'text-[15px]'}`}>{t(q.context)}</div>}
      {q.table && (
        <div className="overflow-x-auto rounded-xl ring-1 ring-ink/10">
          <table className={`w-full border-collapse ${big ? 'text-xl' : 'text-sm'}`}>
            <thead className="bg-ink text-white">
              <tr>
                {q.table.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold">{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.table.rows.map((r, i) => (
                <tr key={i} className="odd:bg-white even:bg-ink/5">
                  {r.cells.map((c, j) => (
                    <td key={j} className={`px-3 py-2 ${j > 0 ? 'text-right tabular-nums' : ''}`}>{t(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface AnswerProps {
  q: PublicQuestion;
  disabled: boolean;
  hint: HintPayload | null;
  onSubmit: (input: AnswerInput) => void;
}

export function AnswerArea(props: AnswerProps) {
  if (props.q.kind === 'choice') return <ChoiceAnswer {...props} />;
  if (props.q.kind === 'spot') return <SpotAnswer {...props} />;
  return <OrderAnswer {...props} />;
}

function ChoiceAnswer({ q, disabled, hint, onSubmit }: AnswerProps) {
  const { t } = useLang();
  const removed = hint?.kind === 'choice' ? hint.removed : [];
  return (
    <div className="grid gap-2.5">
      {(q.options ?? []).map((opt, i) => {
        const gone = removed.includes(i);
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || gone}
            onClick={() => onSubmit({ kind: 'choice', option: i })}
            className={`flex items-start gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-medium ring-1 transition active:scale-[0.99] ${gone ? 'bg-ink/5 text-ink/30 line-through ring-transparent' : 'bg-white ring-ink/15 hover:bg-amber/15 hover:ring-amber'}`}
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">{LETTERS[i]}</span>
            <span>{t(opt)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Dashboard tiles: tap one, then confirm. */
function SpotAnswer({ q, disabled, hint, onSubmit }: AnswerProps) {
  const { t, tr } = useLang();
  const [seg, setSeg] = useState<number | null>(null);
  const candidates = hint?.kind === 'spot' ? hint.candidates : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(q.segments ?? []).map((s, i) => {
          const out = candidates !== null && !candidates.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled || out}
              onClick={() => setSeg(i)}
              className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-left text-sm leading-snug ring-1 transition ${out ? 'bg-ink/5 text-ink/30 ring-transparent' : seg === i ? 'bg-rose-100 ring-2 ring-rose-400' : 'bg-white ring-ink/15 hover:bg-amber/15'}`}
            >
              {t(s)}
            </button>
          );
        })}
      </div>
      <button type="button" className="btn-primary w-full text-lg" disabled={disabled || seg === null} onClick={() => seg !== null && onSubmit({ kind: 'spot', seg })}>
        {seg === null ? tr('Tap a tile', 'Chạm vào một ô') : tr('Submit', 'Gửi câu trả lời')}
      </button>
    </div>
  );
}

function OrderAnswer({ q, disabled, hint, onSubmit }: AnswerProps) {
  const { t, tr } = useLang();
  const items = q.items ?? [];
  const first = hint?.kind === 'order' ? hint.first : null;
  const [seq, setSeq] = useState<number[]>(first !== null ? [first] : []);
  useEffect(() => {
    if (first !== null) setSeq((s) => (s[0] === first ? s : [first, ...s.filter((x) => x !== first)]));
  }, [first]);
  const toggle = (i: number) => {
    if (i === first) return;
    setSeq((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">{tr('Tap the items in order. Tap again to unselect.', 'Chạm lần lượt theo thứ tự đúng. Chạm lại để bỏ chọn.')}</p>
      <div className="grid gap-2">
        {items.map((text, i) => {
          const pos = seq.indexOf(i);
          return (
            <button key={i} type="button" disabled={disabled} onClick={() => toggle(i)} className={`flex items-start gap-3 rounded-xl px-3 py-3 text-left text-[15px] ring-1 transition ${pos >= 0 ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/15'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${pos >= 0 ? 'bg-amber text-ink' : 'bg-ink/10 text-ink/40'}`}>{pos >= 0 ? pos + 1 : '·'}</span>
              <span>{t(text)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" disabled={disabled} onClick={() => setSeq(first !== null ? [first] : [])}>
          {tr('Reset', 'Làm lại')}
        </button>
        <button type="button" className="btn-primary flex-1 text-lg" disabled={disabled || seq.length !== items.length} onClick={() => onSubmit({ kind: 'order', order: seq })}>
          {seq.length === items.length ? tr('Submit order', 'Gửi thứ tự') : tr(`${items.length - seq.length} left`, `Còn ${items.length - seq.length} mục`)}
        </button>
      </div>
    </div>
  );
}

/** Read-only view with the right answer (and optionally the player's own). */
export function AnswerReview({ q, answerKey, mine, distribution, big }: { q: PublicQuestion; answerKey: AnswerKey; mine?: AnswerInput; distribution?: number[]; big?: boolean }) {
  const { t } = useLang();
  const text = big ? 'text-2xl' : 'text-[15px]';
  if (q.kind === 'choice' && answerKey.kind === 'choice') {
    const total = distribution?.reduce((a, b) => a + b, 0) ?? 0;
    return (
      <div className="grid gap-2">
        {(q.options ?? []).map((opt, i) => {
          const right = i === answerKey.option;
          const picked = mine?.kind === 'choice' && mine.option === i;
          const count = distribution?.[i] ?? 0;
          return (
            <div key={i} className={`relative overflow-hidden rounded-xl px-4 py-3 ring-1 ${text} ${right ? 'bg-ok/10 ring-ok' : picked ? 'bg-bad/10 ring-bad' : 'bg-white ring-ink/10'}`}>
              {distribution && total > 0 && <div className={`absolute inset-y-0 left-0 ${right ? 'bg-ok/15' : 'bg-ink/5'}`} style={{ width: `${(count / total) * 100}%` }} />}
              <div className="relative flex items-start gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${right ? 'bg-ok' : picked ? 'bg-bad' : 'bg-ink/40'}`}>{right ? '✓' : picked ? '✗' : LETTERS[i]}</span>
                <span className={`flex-1 ${right ? 'font-semibold' : ''}`}>{t(opt)}</span>
                {distribution && <span className="font-bold text-ink/60">{count}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (q.kind === 'spot' && answerKey.kind === 'spot') {
    return (
      <div className={`grid gap-2 ${big ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {(q.segments ?? []).map((s, i) => {
          const right = i === answerKey.seg;
          const picked = mine?.kind === 'spot' && mine.seg === i;
          return (
            <div key={i} className={`whitespace-pre-line rounded-xl px-3 py-2 leading-snug ring-1 ${big ? 'text-xl' : 'text-sm'} ${right ? 'bg-ok/10 ring-2 ring-ok font-semibold' : picked ? 'bg-bad/10 ring-2 ring-bad' : 'bg-white ring-ink/10'}`}>
              {right ? '✓ ' : picked ? '✗ ' : ''}
              {t(s)}
            </div>
          );
        })}
      </div>
    );
  }
  if (q.kind === 'order' && answerKey.kind === 'order') {
    const items = q.items ?? [];
    return (
      <ol className="grid gap-2">
        {answerKey.order.map((idx, pos) => {
          const ok = mine?.kind === 'order' ? mine.order[pos] === idx : undefined;
          return (
            <li key={pos} className={`flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-ink/10 ${text}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok text-sm font-bold text-white">{pos + 1}</span>
              <span className="flex-1">{t(items[idx])}</span>
              {ok !== undefined && <span className={`font-bold ${ok ? 'text-ok' : 'text-bad'}`}>{ok ? '✓' : '✗'}</span>}
            </li>
          );
        })}
      </ol>
    );
  }
  return null;
}

/** Projector view of the open question. */
export function QuestionPreview({ q }: { q: PublicQuestion }) {
  const { t } = useLang();
  if (q.kind === 'choice')
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {(q.options ?? []).map((o, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-2xl ring-1 ring-ink/10">
            <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-base font-bold text-white">{LETTERS[i]}</span>
            {t(o)}
          </div>
        ))}
      </div>
    );
  if (q.kind === 'spot')
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(q.segments ?? []).map((s, i) => (
          <div key={i} className="whitespace-pre-line rounded-xl bg-white px-4 py-3 text-xl leading-snug ring-1 ring-ink/10">{t(s)}</div>
        ))}
      </div>
    );
  return (
    <ul className="grid gap-2">
      {(q.items ?? []).map((s, i) => (
        <li key={i} className="rounded-xl bg-white px-4 py-3 text-2xl ring-1 ring-ink/10">{t(s)}</li>
      ))}
    </ul>
  );
}
