import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BOT_LEVEL_LABEL, GAMES, type BotLevel, type GameId, type T } from '@arena/types';
import { ErrorNote, MoodleBanner, Shell } from '../components/common';
import { api } from '../lib/api';
import { errOf, useLang } from '../lib/i18n';
import { getLti, getName, setName, setSession } from '../lib/storage';

/** Games already playable; the others show as "coming soon". */
export const READY: GameId[] = ['unit-economics'];

export function GamePicker({ game, setGame }: { game: GameId; setGame: (g: GameId) => void }) {
  const { t, tr } = useLang();
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(GAMES) as GameId[]).map((id) => {
        const g = GAMES[id];
        const ready = READY.includes(id);
        return (
          <button key={id} type="button" disabled={!ready} onClick={() => setGame(id)} className={`rounded-2xl px-3 py-2.5 text-left ring-1 disabled:opacity-50 ${game === id ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/15 hover:bg-amber/10'}`}>
            <p className="text-sm font-bold">
              {g.icon} {t(g.name)}
            </p>
            <p className={`text-xs ${game === id ? 'text-white/70' : 'text-ink/50'}`}>
              {tr('Chapter', 'Chương')} {g.chapter} · {ready ? t(g.minutes) : tr('coming soon', 'sắp ra mắt')}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function Home() {
  const nav = useNavigate();
  const { t, tr } = useLang();
  const lti = getLti();
  const [code, setCode] = useState('');
  const initialGame = (lti?.activity && READY.includes(lti.activity as GameId) ? lti.activity : 'unit-economics') as GameId;
  const [game, setGame] = useState<GameId>(initialGame);
  const [name, setNameState] = useState(lti?.role === 'learner' ? lti.name : getName());
  const [level, setLevel] = useState<BotLevel>('medium');
  const [count, setCount] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<T | null>(null);
  const info = GAMES[game];

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length >= 4) nav(`/p/${c}`);
  };

  async function create(mode: 'bots' | 'practice' | 'invite') {
    const n = name.trim();
    if (!n) return setError({ en: 'Enter your name first.', vi: 'Nhập tên của bạn trước nhé.' });
    setBusy(true);
    setError(null);
    try {
      setName(n);
      const r = await api.createRoom({
        hostPlays: true,
        hostName: n,
        game,
        settings: { botLevel: level, questionCount: count, fillBots: mode !== 'practice', ...(mode === 'practice' ? { autoNextSec: 0 } : {}) },
        ...(lti?.role === 'learner' ? { ltiSession: lti.session } : {}),
      });
      setSession(r.code, { playerId: r.playerId!, playerToken: r.playerToken!, hostToken: r.hostToken });
      if (mode !== 'invite') await api.start(r.code, r.hostToken);
      nav(`/p/${r.code}`);
    } catch (err) {
      setError(errOf(err, { en: 'Could not create the room.', vi: 'Không tạo được phòng.' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell right={<Link to="/gv" className="truncate text-sm font-medium text-white/80 hover:text-white">{tr('Lecturer →', 'Giảng viên →')}</Link>}>
      <MoodleBanner lti={lti?.role === 'learner' ? lti : null} role="learner" />
      <div className="mb-3">
        <GamePicker game={game} setGame={setGame} />
      </div>
      <section className="mb-5 rounded-2xl bg-ink p-5 text-white">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber">
          {tr('Chapter', 'Chương')} {info.chapter} · {t(info.minutes)}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold">
          {info.icon} {t(info.name)}
        </h1>
        <p className="mt-2 text-white/80">{t(info.short)}</p>
      </section>

      <form onSubmit={join} className="card mb-4">
        <h2 className="mb-3 text-lg font-bold">{tr('Join your class room', 'Vào phòng của lớp')}</h2>
        <div className="flex gap-2">
          <input
            className="input text-center text-2xl font-extrabold uppercase tracking-[0.3em]"
            placeholder={tr('ROOM CODE', 'MÃ PHÒNG')}
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            aria-label={tr('Room code', 'Mã phòng')}
          />
          <button className="btn-dark shrink-0" disabled={code.trim().length < 4}>
            {tr('Join', 'Vào')}
          </button>
        </div>
      </form>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">{tr('Practise or challenge friends', 'Tự luyện hoặc đấu với bạn')}</h2>
        <div>
          <label className="label" htmlFor="name">{tr('Your name', 'Tên của bạn')}</label>
          <input id="name" className="input" maxLength={24} value={name} onChange={(e) => setNameState(e.target.value)} placeholder={tr('e.g. Lan – ECOM OCT', 'Ví dụ: Lan – ECOM OCT')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">{tr('AI opponents', 'Mức máy chơi')}</span>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(BOT_LEVEL_LABEL) as BotLevel[]).map((l) => (
                <button key={l} type="button" onClick={() => setLevel(l)} className={`rounded-lg py-2 text-sm font-semibold ring-1 ${level === l ? 'bg-ink text-white ring-ink' : 'ring-ink/15'}`}>
                  {t(BOT_LEVEL_LABEL[l])}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">{tr('Questions', 'Số câu')}</span>
            <div className="grid grid-cols-3 gap-1">
              {[10, 15, 20].map((n) => (
                <button key={n} type="button" onClick={() => setCount(n)} className={`rounded-lg py-2 text-sm font-semibold ring-1 ${count === n ? 'bg-ink text-white ring-ink' : 'ring-ink/15'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ErrorNote err={error} />
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => create('bots')}>
            🤖 {tr('1 vs 5 AI', 'Đấu 5 máy')}
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => create('practice')}>
            📘 {tr('Practise alone', 'Luyện một mình')}
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => create('invite')}>
            👥 {tr('Invite friends', 'Mời bạn')}
          </button>
        </div>
        <p className="text-xs text-ink/50">
          {tr('Invite friends: share the code with up to 5 people; empty seats are played by AI when you start.', 'Mời bạn: gửi mã cho tối đa 5 người; ghế trống do máy chơi khi bắt đầu.')}
        </p>
      </section>

      <section className="mt-4 card text-sm leading-relaxed text-ink/80">
        <h2 className="mb-2 text-base font-bold text-ink">{tr('Scoring', 'Cách tính điểm')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{tr('Right: up to 1,000 points – faster is better (500 at the buzzer).', 'Đúng: tối đa 1.000 điểm, càng nhanh càng cao (chậm nhất còn 500).')}</li>
          <li>{tr('Streak: +10% per right answer in a row, up to +50%.', 'Đúng liên tiếp: thưởng 10% mỗi câu, tối đa +50%.')}</li>
          <li>{tr('Wrong: −200. No answer: 0. Do not guess blindly!', 'Sai: −200. Không trả lời: 0. Đừng bấm bừa!')}</li>
          <li>{tr('Ranking questions: partial credit for each item in the right place.', 'Câu xếp thứ tự: đúng bao nhiêu vị trí được bấy nhiêu phần.')}</li>
          <li>{tr('🔍 Verify (2 per game): a hint, but the question is worth half.', '🔍 Kiểm chứng (2 lượt/trận): có gợi ý, nhưng câu đó chỉ còn một nửa điểm.')}</li>
          <li>{tr('Moodle grade = share of questions answered fully right.', 'Điểm Moodle = tỷ lệ câu trả lời đúng hoàn toàn.')}</li>
        </ul>
      </section>
    </Shell>
  );
}
