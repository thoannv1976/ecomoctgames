// Public types shared by the API and the browser. This module must stay data-free:
// the browser imports it, so it must never pull in a question bank or a hidden model.

/** Every text players see exists in English and Vietnamese. */
export type Lang = 'en' | 'vi';
export interface T {
  en: string;
  vi: string;
}
export const tx = (en: string, vi: string): T => ({ en, vi });

export type GameId = 'unit-economics' | 'ceo-sim' | 'market-detective' | 'platform-wars' | 'cro-battle';

export interface GameInfo {
  id: GameId;
  chapter: number;
  icon: string;
  name: T;
  short: T;
  minutes: T;
}

export const GAMES: Record<GameId, GameInfo> = {
  'unit-economics': {
    id: 'unit-economics',
    chapter: 9,
    icon: '🧮',
    name: tx('Unit Economics Showdown', 'Thám tử lợi nhuận'),
    short: tx(
      'Speed battle on the metric tree, contribution margin, break-even ROAS, CLV/CAC and Goodhart traps. Fast and right wins.',
      'Đấu nhanh về cây chỉ số, lợi nhuận đóng góp, ROAS hòa vốn, CLV/CAC và bẫy Goodhart. Nhanh và đúng thì thắng.',
    ),
    minutes: tx('12–15 min', '12–15 phút'),
  },
  'ceo-sim': {
    id: 'ceo-sim',
    chapter: 12,
    icon: '🏢',
    name: tx('CEO Simulator', 'Mô phỏng CEO'),
    short: tx(
      'Six e-commerce companies, one market, six quarters: platforms, AI rivals, agentic commerce and a CEO crisis card.',
      'Sáu công ty TMĐT, một thị trường, sáu quý: nền tảng, đối thủ AI, agentic commerce và thẻ khủng hoảng CEO.',
    ),
    minutes: tx('45–60 min', '45–60 phút'),
  },
  'market-detective': {
    id: 'market-detective',
    chapter: 4,
    icon: '🔎',
    name: tx('Market Detective', 'Thám tử thị trường'),
    short: tx(
      'Buy data of uneven quality, triangulate, size the market, catch the AI report’s errors and decide: launch or not?',
      'Mua dữ liệu chất lượng không đều, đối chiếu, ước tính quy mô thị trường, bắt lỗi báo cáo AI và quyết định: tung hay không?',
    ),
    minutes: tx('20–25 min', '20–25 phút'),
  },
  'platform-wars': {
    id: 'platform-wars',
    chapter: 2,
    icon: '🌐',
    name: tx('Platform Wars', 'Chiến tranh nền tảng'),
    short: tx(
      'Run one of six marketplaces in the same city: subsidise the right side, set the take rate, fight counterfeits and leakage – GMV is not profit.',
      'Điều hành một trong sáu sàn cùng thành phố: trợ giá đúng phía, đặt phí sàn, chống hàng giả và rò rỉ giao dịch – GMV không phải lợi nhuận.',
    ),
    minutes: tx('30–35 min', '30–35 phút'),
  },
  'cro-battle': {
    id: 'cro-battle',
    chapter: 6,
    icon: '🧪',
    name: tx('CRO Battle', 'Đấu trường A/B'),
    short: tx(
      'Six identical stores at 1.8% conversion. Run A/B tests, beat peeking, novelty and tiny samples – only the TRUE conversion rate counts, revealed at the end.',
      'Sáu cửa hàng giống hệt nhau, chuyển đổi 1,8%. Chạy A/B test, tránh bẫy xem trộm, hiệu ứng mới lạ và mẫu nhỏ – chỉ tỷ lệ chuyển đổi THẬT mới tính, công bố lúc cuối.',
    ),
    minutes: tx('25 min', '25 phút'),
  },
};

export type BotLevel = 'easy' | 'medium' | 'hard';
export const BOT_LEVEL_LABEL: Record<BotLevel, T> = { easy: tx('Easy', 'Dễ'), medium: tx('Medium', 'Vừa'), hard: tx('Hard', 'Khó') };

// ───────── Speed battle (Game 9) ─────────

export type Category = 'bottleneck' | 'calc' | 'lever' | 'goodhart' | 'pair' | 'ceo';
export const CATEGORIES: Category[] = ['bottleneck', 'calc', 'lever', 'goodhart', 'pair', 'ceo'];
export const CATEGORY_LABEL: Record<Category, T> = {
  bottleneck: tx('Find the bottleneck', 'Tìm nút thắt'),
  calc: tx('Quick maths', 'Tính nhanh'),
  lever: tx('Which lever pays', 'Đòn bẩy nào lời'),
  goodhart: tx('Goodhart trap', 'Bẫy Goodhart'),
  pair: tx('Read the KPI pair', 'Đọc cặp KPI'),
  ceo: tx('CEO case', 'Tình huống CEO'),
};

export type QuestionKind = 'choice' | 'spot' | 'order';

/** Firestore cannot store arrays of arrays, so each row is an object. */
export interface DataTable {
  headers: T[];
  rows: { cells: T[] }[];
}

/** A question as the browser sees it: no answer key, options already shuffled. */
export interface PublicQuestion {
  id: string;
  kind: QuestionKind;
  category: Category;
  prompt: T;
  context?: T;
  table?: DataTable;
  timeLimitSec: number;
  /** choice: shuffled options. */
  options?: T[];
  /** spot: dashboard tiles; the player taps one. */
  segments?: T[];
  /** order: shuffled items to rank. */
  items?: T[];
}

export type AnswerInput = { kind: 'choice'; option: number } | { kind: 'spot'; seg: number } | { kind: 'order'; order: number[] };
export type AnswerKey = AnswerInput;
export type HintPayload = { kind: 'choice'; removed: number[] } | { kind: 'spot'; candidates: number[] } | { kind: 'order'; first: number };

export type RoomStatus = 'lobby' | 'question' | 'reveal' | 'finished';

export interface CategoryStat {
  n: number;
  ok: number;
}

export interface PlayerPublic {
  id: string;
  name: string;
  bot: boolean;
  level?: BotLevel;
  score: number;
  correct: number;
  streak: number;
  bestStreak: number;
  hintsLeft: number;
  joinedAt: number;
  stats: Partial<Record<Category, CategoryStat>>;
  /** Opened from Moodle: the final result is sent to the gradebook. */
  lms?: boolean;
}

export interface PlayerResult {
  answered: boolean;
  points: number;
  /** 0..1 share of the answer that was right. */
  fraction: number;
  input?: AnswerInput;
  hint?: boolean;
  elapsedMs?: number;
}

export interface RevealPublic {
  qIndex: number;
  key: AnswerKey;
  explanation: T;
  source: T;
  results: Record<string, PlayerResult>;
  distribution?: number[];
  revealedAt: number;
}

export interface RoomSettings {
  questionCount: number;
  botLevel: BotLevel;
  fillBots: boolean;
  categories: Category[];
  /** Seconds the answer stays on screen before the next question opens by itself; 0 = host presses "next". */
  autoNextSec: number;
}

export interface CurrentQuestion {
  q: PublicQuestion;
  openedAt: number;
  deadline: number;
  botAnswerAt: Record<string, number>;
}

export interface RoomDoc {
  code: string;
  game: 'unit-economics';
  title: string;
  status: RoomStatus;
  createdAt: number;
  hostPlays: boolean;
  hostPlayerId: string | null;
  settings: RoomSettings;
  players: Record<string, PlayerPublic>;
  order: string[];
  qIndex: number;
  qTotal: number;
  current: CurrentQuestion | null;
  answered: Record<string, boolean>;
  reveal: RevealPublic | null;
  startedAt: number | null;
  finishedAt: number | null;
  version: number;
  lmsStatus?: Record<string, 'sent' | 'error'>;
}

export const MAX_SEATS = 6;
export const HINTS_PER_GAME = 2;
