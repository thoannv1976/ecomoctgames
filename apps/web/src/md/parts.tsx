import { useEffect, useRef, useState } from 'react';
import { AI_ERROR_INFO, DECISION_INFO, MD_ARCHETYPE_INFO, SOURCE_INFO, SOURCES, type MdCasePublic, type MdMe, type MdRoomDoc, type MdReveal } from '@arena/md';
import type { Lang } from '@arena/types';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';

export const asMd = (room: unknown) => room as MdRoomDoc;
export const isMdRoom = (room: unknown) => (room as { game?: string } | null | undefined)?.game === 'market-detective';

const grp = (v: number, l: Lang, d = 0) => {
  const s = Math.abs(v).toFixed(d);
  const [i, f] = s.split('.');
  const int = i!.replace(/\B(?=(\d{3})+(?!\d))/g, l === 'en' ? ',' : '.');
  return (v < 0 && Number(s) !== 0 ? '−' : '') + int + (f ? (l === 'en' ? '.' : ',') + f : '');
};
/** Billion VND per month. */
export const bn = (v: number, l: Lang) => `${grp(v, l, 1)} ${l === 'en' ? 'bn/month' : 'tỷ/tháng'}`;
export const n1 = (v: number, l: Lang) => grp(v, l, 1);

export const rankedIds = (room: MdRoomDoc) => room.order.slice().sort((a, b) => (room.standings[a]?.rank ?? 99) - (room.standings[b]?.rank ?? 99));

export function useMdMe(room: MdRoomDoc, playerId?: string, playerToken?: string) {
  const [me, setMe] = useState<MdMe | null>(null);
  const key = `${room.status}:${room.round}`;
  useEffect(() => {
    if (!playerId || !playerToken || room.status === 'lobby') return;
    let alive = true;
    api
      .mdMe(room.code, playerId, playerToken)
      .then((m) => alive && setMe(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key, room.code, playerId, playerToken, room.status]);
  return [me, setMe] as const;
}

/** Closes a case at its deadline, moves on after auto-results, and lets AI analysts book interviews on time. */
export function useMdAutoAdvance(room: MdRoomDoc | null, now: number, hostToken?: string) {
  const sent = useRef('');
  useEffect(() => {
    if (!room) return;
    let due: number | null = null;
    if (room.status === 'decide' && room.deadline !== null) due = room.deadline + 300;
    if (room.status === 'results' && room.revealedAt && room.settings.resultsSec > 0) due = room.revealedAt + room.settings.resultsSec * 1000 + 300;
    // While a case is open the host's screen nudges the server every 15 s so AI interview bookings appear.
    const nudge = room.status === 'decide' && hostToken && room.interviews.length < 2 && room.openedAt ? `${Math.floor((now - room.openedAt) / 15000)}` : null;
    const { code, status, round } = room;
    if (due !== null && now >= due) {
      const tag = `${status}:${round}:${Math.floor((now - due) / 4000)}`;
      if (sent.current === tag) return;
      sent.current = tag;
      setTimeout(() => void api.advance(code, { ...(hostToken ? { hostToken } : {}), expectStatus: status, expectRound: round }).catch(() => undefined), Math.random() * 400);
    } else if (nudge && nudge !== '0') {
      const tag = `n:${round}:${nudge}`;
      if (sent.current === tag) return;
      sent.current = tag;
      void api.advance(code, { expectStatus: 'decide', expectRound: round }).catch(() => undefined);
    }
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

export function DecisionRule({ c, big }: { c: MdCasePublic; big?: boolean }) {
  const { lang, tr } = useLang();
  return (
    <div className={`grid grid-cols-3 gap-1.5 text-center ${big ? 'text-xl' : 'text-xs'}`}>
      <div className="rounded-lg bg-ok/15 px-2 py-1.5"><b>🚀 {tr('Launch', 'Tung')}</b><br />≥ {bn(c.launchAt, lang)}</div>
      <div className="rounded-lg bg-amber/20 px-2 py-1.5"><b>🧪 {tr('Pilot', 'Thử nhỏ')}</b><br />{n1(c.pilotAt, lang)} – {bn(c.launchAt, lang)}</div>
      <div className="rounded-lg bg-bad/10 px-2 py-1.5"><b>✋ {tr('Do not launch', 'Không tung')}</b><br />&lt; {bn(c.pilotAt, lang)}</div>
    </div>
  );
}

export function MdStandings({ room, me, big }: { room: MdRoomDoc; me?: string; big?: boolean }) {
  const { t, tr } = useLang();
  const ids = rankedIds(room);
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${big ? 'text-xl' : 'text-sm'}`}>
        <thead className="text-left text-ink/60">
          <tr>
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">{tr('Detective', 'Thám tử')}</th>
            <th className="py-1 pr-2 text-right">{tr('Last case', 'Vụ vừa rồi')}</th>
            <th className="py-1 pr-2 text-right">{tr('Total', 'Tổng điểm')}</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const p = room.players[id]!;
            const st = room.standings[id];
            return (
              <tr key={id} className={`border-t border-ink/10 ${id === me ? 'bg-amber/15 font-semibold' : ''}`}>
                <td className="py-1 pr-2">{st?.rank ?? '–'}</td>
                <td className="py-1 pr-2">
                  {p.bot ? '🤖 ' : ''}
                  {p.name}
                  {p.bot && p.archetype && <span className="ml-1 text-xs text-ink/50">({t(MD_ARCHETYPE_INFO[p.archetype])})</span>}
                  {st?.defaulted && <span className="ml-1 text-xs text-bad">({tr('no answer', 'chưa nộp')})</span>}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">{st?.last ?? 0}</td>
                <td className="py-1 pr-2 text-right font-bold tabular-nums">{st?.total ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** How far each source was from the truth: the core lesson of every case. */
export function SourceBars({ reveal, big }: { reveal: MdReveal; big?: boolean }) {
  const { t, tr } = useLang();
  const rows = SOURCES.filter((s) => reveal.sourceRatios[s] !== undefined);
  return (
    <div className="space-y-2">
      {rows.map((s) => {
        const r = reveal.sourceRatios[s]!;
        const off = Math.round((r - 1) * 100);
        const good = Math.abs(off) <= 15;
        const w = Math.min(100, (r / 3) * 100);
        return (
          <div key={s}>
            <div className={`flex items-baseline justify-between gap-2 ${big ? 'text-lg' : 'text-sm'}`}>
              <span className="font-semibold">{t(SOURCE_INFO[s].name)}</span>
              <span className={`shrink-0 font-bold tabular-nums ${good ? 'text-ok' : 'text-bad'}`}>{off === 0 ? '±0%' : off > 0 ? `+${off}%` : `${off}%`}</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-ink/10">
              <div className={`h-2.5 rounded-full ${good ? 'bg-ok' : 'bg-bad/70'}`} style={{ width: `${w}%` }} />
              <div className="absolute top-[-3px] h-4 w-0.5 bg-ink" style={{ left: `${100 / 3}%` }} title={tr('Truth', 'Số thật')} />
            </div>
            {reveal.sourceNotes[s] && <p className={`mt-0.5 text-ink/60 ${big ? 'text-base' : 'text-xs'}`}>{t(reveal.sourceNotes[s]!)}</p>}
          </div>
        );
      })}
      <p className="text-xs text-ink/50">{tr('Black line = the true market size.', 'Vạch đen = quy mô thị trường thật.')}</p>
    </div>
  );
}

export function AiErrors({ reveal, flagged, big }: { reveal: MdReveal; flagged?: number[]; big?: boolean }) {
  const { t, tr } = useLang();
  const wrong = new Map(reveal.aiErrors.map((e) => [e.index, e]));
  return (
    <ol className={`space-y-2 ${big ? 'text-lg' : 'text-sm'}`}>
      {reveal.aiClaims.map((c, i) => {
        const err = wrong.get(i);
        const mine = flagged?.includes(i);
        return (
          <li key={i} className={`rounded-xl px-3 py-2 ring-1 ${err ? 'bg-bad/5 ring-bad/30' : 'ring-ok/30'}`}>
            <p>
              <b>{err ? '✗' : '✓'}</b> {t(c)}
              {flagged && <span className={`ml-1 text-xs font-semibold ${mine ? (err ? 'text-ok' : 'text-bad') : err ? 'text-bad' : 'text-ink/40'}`}>{mine ? (err ? tr('· you caught it +5', '· bạn bắt đúng +5') : tr('· wrong flag −5', '· đánh dấu nhầm −5')) : err ? tr('· missed', '· bỏ sót') : ''}</span>}
            </p>
            {err && <p className="mt-0.5 text-ink/70"><b className="text-bad">{t(AI_ERROR_INFO[err.type])}.</b> {t(err.why)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function CaseTable({ room, me, big }: { room: MdRoomDoc; me?: string; big?: boolean }) {
  const { lang, t, tr } = useLang();
  const rv = room.reveal;
  if (!rv) return null;
  const ids = room.order.slice().sort((a, b) => (rv.scores[b]?.total ?? 0) - (rv.scores[a]?.total ?? 0));
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${big ? 'text-lg' : 'text-sm'}`}>
        <thead className="text-left text-ink/60">
          <tr>
            <th className="py-1 pr-2">{tr('Detective', 'Thám tử')}</th>
            <th className="py-1 pr-2 text-right">{tr('Estimate', 'Ước tính')}</th>
            <th className="py-1 pr-2">{tr('Decision', 'Quyết định')}</th>
            <th className="py-1 pr-2 text-right">{tr('Sources', 'Nguồn')}</th>
            <th className="py-1 pr-2 text-right">{tr('Points', 'Điểm')}</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const s = rv.scores[id];
            const p = room.players[id]!;
            return (
              <tr key={id} className={`border-t border-ink/10 ${id === me ? 'bg-amber/15 font-semibold' : ''}`}>
                <td className="py-1 pr-2">{p.bot ? '🤖 ' : ''}{p.name}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{s?.estimate != null ? n1(s.estimate, lang) : '–'}</td>
                <td className={`py-1 pr-2 ${s?.decisionPts === 25 ? 'text-ok' : 'text-bad'}`}>{s?.decision ? t(DECISION_INFO[s.decision]) : '–'}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{s?.sources.length ?? 0}</td>
                <td className="py-1 pr-2 text-right font-bold tabular-nums">{s?.total ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const MD_DEBRIEF: [string, string][] = [
  ['Which source was closest to the truth in each case, and which RRRSB criterion explains why?', 'Trong mỗi vụ, nguồn nào gần số thật nhất, và tiêu chí RRRSB nào giải thích điều đó?'],
  ['Why was averaging every number you bought not good analysis?', 'Vì sao lấy trung bình mọi con số đã mua không phải là phân tích tốt?'],
  ['Which AI error was hardest to spot? How would you verify it in a real project?', 'Lỗi AI nào khó phát hiện nhất? Trong dự án thật bạn sẽ kiểm chứng nó thế nào?'],
  ['The interview slots were scarce. When is primary research worth its higher cost?', 'Suất phỏng vấn rất khan hiếm. Khi nào nghiên cứu sơ cấp đáng với chi phí cao hơn?'],
];
