import { CRISIS_CARDS, ROUNDS, ROUND_INFO, type CeoRoomDoc } from '@arena/ceo';
import { MAX_SEATS } from '@arena/types';
import { Qr, joinUrl } from '../components/common';
import { useLang } from '../lib/i18n';
import { CeoStandings, Countdown, DEBRIEF, ProfitChart, colorOf, mil, rankedIds } from './parts';

/** Projector view for Game 12 (Screen.tsx adds the host buttons). */
export function CeoScreen({ room, now }: { room: CeoRoomDoc; now: number }) {
  const { lang, t, tr } = useLang();
  if (room.status === 'lobby') {
    return (
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <Qr text={joinUrl(room.code)} size={280} />
          <p className="text-lg text-ink/70">{joinUrl(room.code).replace(/^https?:\/\//, '')}</p>
        </div>
        <div className="space-y-4">
          <p className="text-2xl font-semibold text-ink/70">{tr('CEO Simulator · 6 quarters · VND 1 billion each', 'Mô phỏng CEO · 6 quý · mỗi công ty 1 tỷ')}</p>
          <p className="text-7xl font-extrabold tracking-[0.3em]">{room.code}</p>
          <p className="text-xl">{tr('Companies', 'Công ty')} ({room.order.length}/{MAX_SEATS}){room.settings.fillBots && room.order.length < MAX_SEATS ? tr(' · empty seats run by AI CEOs', ' · ghế trống do CEO máy điều hành') : ''}</p>
          <div className="grid grid-cols-2 gap-2">
            {room.order.map((id) => (
              <div key={id} className="pop rounded-xl bg-white px-4 py-3 text-2xl font-semibold ring-1 ring-ink/10">{room.players[id]!.name}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const info = ROUND_INFO[room.round]!;
  if (room.status === 'decide') {
    const done = room.order.filter((id) => room.players[id]?.bot || room.submitted[id]).length;
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-3xl font-extrabold">{tr('Quarter', 'Quý')} {room.round}/{ROUNDS} · {t(info.title)}</span>
          <Countdown deadline={room.deadline} now={now} big />
        </div>
        <div className="card text-2xl leading-relaxed">{t(info.text)}</div>
        {room.round === ROUNDS && (
          <div className="grid gap-3 md:grid-cols-3">
            {room.order.map((id) => {
              const c = room.crises[id];
              return c ? (
                <div key={id} className="card space-y-1 ring-2 ring-bad/40">
                  <p className="font-bold" style={{ color: colorOf(room, id) }}>{room.players[id]?.name}</p>
                  <p className="text-xl font-extrabold text-bad">🃏 {t(CRISIS_CARDS[c].title)}</p>
                  <p className="text-ink/70">{t(CRISIS_CARDS[c].text)}</p>
                </div>
              ) : null;
            })}
          </div>
        )}
        <p className="text-center text-3xl font-bold">✋ {done}/{room.order.length} {tr('companies decided', 'công ty đã quyết định')}</p>
        {room.history.length > 0 && (
          <div className="card">
            <ProfitChart room={room} height={220} />
          </div>
        )}
      </div>
    );
  }
  if (room.status === 'results') {
    return (
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="card space-y-3">
          <p className="text-2xl font-extrabold">{tr('Quarterly profit', 'Lợi nhuận từng quý')} · Q{room.round}</p>
          <ProfitChart room={room} height={300} />
          {room.news.map((n, i) => (
            <p key={i} className="text-lg">📰 {t(n)}</p>
          ))}
        </div>
        <div className="card">
          <p className="mb-2 text-2xl font-extrabold">{tr('Standings', 'Bảng xếp hạng')}</p>
          <CeoStandings room={room} big />
        </div>
      </div>
    );
  }
  const ids = rankedIds(room);
  const podium = [ids[1], ids[0], ids[2]];
  const heights = ['h-32', 'h-44', 'h-24'];
  return (
    <div className="space-y-6">
      <h2 className="text-center text-4xl font-extrabold">🏆 {tr('CEO Simulator – final results', 'Mô phỏng CEO – kết quả chung cuộc')}</h2>
      <div className="flex items-end justify-center gap-4">
        {podium.map((id, i) =>
          id ? (
            <div key={id} className="pop flex w-60 flex-col items-center gap-1">
              <span className="text-center text-2xl font-bold">{room.players[id]!.bot ? '🤖 ' : ''}{room.players[id]!.name}</span>
              <span className="text-lg tabular-nums">{room.standings[id]?.dashboard.toFixed(1)} · {mil(room.standings[id]?.profitCum ?? 0, lang)}</span>
              <div className={`flex w-full items-start justify-center rounded-t-2xl pt-3 text-5xl ${heights[i]} ${i === 1 ? 'bg-amber' : 'bg-ink text-white'}`}>{i === 1 ? '1' : i === 0 ? '2' : '3'}</div>
            </div>
          ) : (
            <div key={i} className="w-60" />
          ),
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-4">
          <CeoStandings room={room} big />
          <ProfitChart room={room} height={220} />
        </div>
        <div className="card space-y-3 text-xl leading-relaxed">
          <p className="text-2xl font-extrabold">{tr('Debrief', 'Câu hỏi tổng kết')}</p>
          <ol className="list-decimal space-y-2 pl-6">
            {DEBRIEF.map(([en, vi]) => (
              <li key={en}>{tr(en, vi)}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
