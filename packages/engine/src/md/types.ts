// Game 4 – Market Detective (Chapter 4): public types (browser-safe; the true numbers stay on the server).
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';

export type SourceId = 'trends' | 'marketplace' | 'report' | 'reviews' | 'social' | 'interview' | 'ai';
export type MdDecision = 'launch' | 'pilot' | 'no';
export type MdArchetype = 'ai' | 'trends' | 'all' | 'careful';
/** The four AI-research error types of Chapter 4 (Table 4.20). */
export type AiErrorType = 'fabricated' | 'outdated' | 'synthesis' | 'bias';

export const SOURCES: SourceId[] = ['trends', 'marketplace', 'report', 'reviews', 'social', 'interview', 'ai'];
export const DECISIONS: MdDecision[] = ['launch', 'pilot', 'no'];
export const MD_ARCHETYPES: MdArchetype[] = ['ai', 'trends', 'all', 'careful'];
export const START_CREDITS = 100;
export const INTERVIEW_SLOTS = 2;
export const CASES_PER_GAME = 3;

export const SOURCE_INFO: Record<SourceId, { name: T; cost: number; kind: T }> = {
  trends: { name: tx('Google Trends + keyword volume', 'Google Trends + lượng tìm kiếm'), cost: 10, kind: tx('Secondary · public data', 'Thứ cấp · dữ liệu công khai') },
  marketplace: { name: tx('Competitor sales on Shopee/TikTok (sold counters)', 'Doanh số đối thủ trên Shopee/TikTok (số đã bán)'), cost: 20, kind: tx('Secondary · platform data', 'Thứ cấp · dữ liệu nền tảng') },
  report: { name: tx('Industry report', 'Báo cáo ngành'), cost: 20, kind: tx('Secondary · third party', 'Thứ cấp · bên thứ ba') },
  reviews: { name: tx('Review mining (competitor reviews)', 'Đào dữ liệu đánh giá của đối thủ'), cost: 10, kind: tx('Secondary · voice of customer', 'Thứ cấp · tiếng nói khách hàng') },
  social: { name: tx('Social listening', 'Lắng nghe mạng xã hội'), cost: 15, kind: tx('Secondary · social data', 'Thứ cấp · dữ liệu mạng xã hội') },
  interview: { name: tx('Customer interviews (only 2 slots per room)', 'Phỏng vấn khách hàng (mỗi phòng chỉ 2 suất)'), cost: 30, kind: tx('Primary · zero-party', 'Sơ cấp · dữ liệu khách tự cung cấp') },
  ai: { name: tx('AI market-research report', 'Báo cáo nghiên cứu thị trường do AI viết'), cost: 5, kind: tx('AI synthesis – verify before use', 'AI tổng hợp – phải kiểm chứng') },
};

export const DECISION_INFO: Record<MdDecision, T> = {
  launch: tx('Launch', 'Tung sản phẩm'),
  pilot: tx('Small pilot first', 'Thử nhỏ trước'),
  no: tx('Do not launch', 'Không tung'),
};

export const AI_ERROR_INFO: Record<AiErrorType, T> = {
  fabricated: tx('Fabricated fact', 'Bịa đặt dữ kiện'),
  outdated: tx('Outdated data', 'Dữ liệu lỗi thời'),
  synthesis: tx('Plausible-sounding synthesis', 'Tổng hợp nghe hợp lý nhưng sai'),
  bias: tx('Source bias', 'Thiên lệch nguồn'),
};

export const MD_ARCHETYPE_INFO: Record<MdArchetype, T> = {
  ai: tx('Trusts AI blindly', 'Tin AI mù quáng'),
  trends: tx('Only Google Trends', 'Chỉ xem Google Trends'),
  all: tx('Buys every source', 'Mua hết mọi nguồn'),
  careful: tx('Careful analyst', 'Nhà phân tích cẩn thận'),
};

export interface MdCasePublic {
  id: string;
  title: T;
  question: T;
  context: T;
  /** e.g. "billion VND per month" */
  unit: T;
  /** Decision rule shown to everyone: launch at ≥ launchAt, pilot at ≥ pilotAt. */
  launchAt: number;
  pilotAt: number;
}

export interface MdFinding {
  source: SourceId;
  text: T;
  /** Market size this source implies, in the case unit (absent for qualitative sources). */
  implied?: number;
}

export interface MdSubmission {
  estimate: number;
  decision: MdDecision;
  /** Indexes of AI claims flagged as wrong. */
  flags: number[];
}

export interface MdCaseScore {
  caseId: string;
  estimate: number | null;
  decision: MdDecision | null;
  accuracy: number;
  decisionPts: number;
  flagPts: number;
  creditPts: number;
  total: number;
  sources: SourceId[];
  /** AI statements this player flagged as wrong. */
  flags: number[];
}

export interface MdReveal {
  caseId: string;
  truth: number;
  decision: MdDecision;
  /** How far each source was from the truth (implied / truth). */
  sourceRatios: Partial<Record<SourceId, number>>;
  sourceNotes: Partial<Record<SourceId, T>>;
  aiClaims: T[];
  aiErrors: { index: number; type: AiErrorType; why: T }[];
  scores: Record<string, MdCaseScore>;
}

export interface MdSettings {
  caseSec: number;
  resultsSec: number;
  botLevel: BotLevel;
  fillBots: boolean;
}

export interface MdPlayerPublic {
  id: string;
  name: string;
  bot: boolean;
  level?: BotLevel;
  archetype?: MdArchetype;
  joinedAt: number;
  lms?: boolean;
}

export interface MdStanding {
  total: number;
  /** Total of the last finished case. */
  last: number;
  rank: number;
  defaulted?: boolean;
}

export interface MdRoomDoc {
  code: string;
  game: 'market-detective';
  title: string;
  status: 'lobby' | 'decide' | 'results' | 'finished';
  createdAt: number;
  hostPlays: boolean;
  hostPlayerId: string | null;
  settings: MdSettings;
  players: Record<string, MdPlayerPublic>;
  order: string[];
  round: number;
  rounds: number;
  openedAt: number | null;
  deadline: number | null;
  submitted: Record<string, boolean>;
  case: MdCasePublic | null;
  /** Players who took an interview slot this case (scarce resource, public). */
  interviews: string[];
  /** How many sources each player has bought this case (public, no detail). */
  bought: Record<string, number>;
  reveal: MdReveal | null;
  standings: Record<string, MdStanding>;
  revealedAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  version: number;
  lmsStatus?: Record<string, 'sent' | 'error'>;
}

export interface MdMe {
  playerId: string;
  credits: number;
  findings: MdFinding[];
  /** AI report statements (when bought), to be checked. */
  aiClaims: T[];
  pending: MdSubmission | null;
  scores: MdCaseScore[];
  grade: number | null;
  badges: T[];
}
