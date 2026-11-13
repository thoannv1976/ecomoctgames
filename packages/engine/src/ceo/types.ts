// Game 12 – CEO Simulator (Chapter 12): public types and display content (browser-safe, no hidden model).
import type { BotLevel, T } from '../types.js';
import { tx } from '../types.js';

export type Channel = 'web' | 'shopee' | 'tiktok';
export type Segment = 'genz' | 'office' | 'mom';
export type PricePos = 'value' | 'mid' | 'premium';
export type SkuRange = 'focused' | 'medium' | 'wide';
export type Service = 'basic' | 'fast' | 'premium';
export type AiChoice = 'A' | 'B' | 'C' | 'D' | 'E';
export type AgentInvest = 'catalog' | 'api' | 'payment' | 'policy';
export type CeoArchetype = 'discount' | 'ads' | 'platform' | 'd2c' | 'aifirst' | 'balanced';
export type CrisisId = 'cpc' | 'pricecut' | 'viral' | 'chatbot' | 'agent' | 'ban' | 'supplier' | 'breach';
export type Kpi = 'revenue' | 'profit' | 'rating' | 'pdr';
export type Trend = 'up' | 'down';

export const CHANNELS: Channel[] = ['web', 'shopee', 'tiktok'];
export const SEGMENTS: Segment[] = ['genz', 'office', 'mom'];
export const PRICE_POS: PricePos[] = ['value', 'mid', 'premium'];
export const SKU_RANGES: SkuRange[] = ['focused', 'medium', 'wide'];
export const SERVICES: Service[] = ['basic', 'fast', 'premium'];
export const AI_CHOICES: AiChoice[] = ['A', 'B', 'C', 'D', 'E'];
export const AGENT_INVESTS: AgentInvest[] = ['catalog', 'api', 'payment', 'policy'];
export const CEO_ARCHETYPES: CeoArchetype[] = ['discount', 'ads', 'platform', 'd2c', 'aifirst', 'balanced'];
export const CRISES: CrisisId[] = ['cpc', 'pricecut', 'viral', 'chatbot', 'agent', 'ban', 'supplier', 'breach'];
export const KPIS: Kpi[] = ['revenue', 'profit', 'rating', 'pdr'];

export const ROUNDS = 6;
/** All money in million VND (triệu đồng). */
export const START_CASH = 1000;
export const AI_BUDGET = 300;
export const BUDGET_STEP = 10;
export const MAX_MARKETING = 600;
export const STOCK_OPTIONS = [2000, 3000, 4000, 5000, 6000, 8000, 10000];

export const CHANNEL_INFO: Record<Channel, { name: T; note: T }> = {
  web: { name: tx('Website (D2C)', 'Website (D2C)'), note: tx('Own customers and data; fee ≈ 3% (payment).', 'Khách và dữ liệu của mình; phí ≈ 3% (thanh toán).') },
  shopee: { name: tx('Shopee', 'Shopee'), note: tx('High purchase intent; fees ≈ 14%.', 'Ý định mua cao; phí ≈ 14%.') },
  tiktok: { name: tx('TikTok Shop', 'TikTok Shop'), note: tx('Discovery commerce; fee 8% + creator commission.', 'Thương mại khám phá; phí 8% + hoa hồng nhà sáng tạo.') },
};

export const SEGMENT_INFO: Record<Segment, { name: T; who: T }> = {
  genz: { name: tx('Gen Z discoverers', 'Gen Z thích khám phá'), who: tx('Find products in TikTok videos; watch price; switch brands easily.', 'Tìm sản phẩm qua video TikTok; để ý giá; dễ đổi thương hiệu.') },
  office: { name: tx('Busy office workers', 'Dân văn phòng bận rộn'), who: tx('Search on Shopee or the web; want fast delivery and a sure choice.', 'Tìm trên Shopee hoặc web; cần giao nhanh và chọn chắc chắn.') },
  mom: { name: tx('Careful young mothers', 'Mẹ trẻ cẩn trọng'), who: tx('Read reviews, trust brands, buy again and again when served well.', 'Đọc đánh giá, tin thương hiệu, mua lại nhiều lần nếu được chăm sóc tốt.') },
};

/** AOV and unit cost in million VND. */
export const PRICE_INFO: Record<PricePos, { name: T; aov: number; unitCost: number }> = {
  value: { name: tx('Value · AOV 190k · cost 80k', 'Giá rẻ · AOV 190k · giá vốn 80k'), aov: 0.19, unitCost: 0.08 },
  mid: { name: tx('Mid · AOV 270k · cost 100k', 'Tầm trung · AOV 270k · giá vốn 100k'), aov: 0.27, unitCost: 0.1 },
  premium: { name: tx('Premium · AOV 360k · cost 140k', 'Cao cấp · AOV 360k · giá vốn 140k'), aov: 0.36, unitCost: 0.14 },
};

export const SKU_INFO: Record<SkuRange, { name: T; note: T }> = {
  focused: { name: tx('Focused (5 SKUs)', 'Tập trung (5 mã)'), note: tx('Clear message, low returns, less choice.', 'Thông điệp rõ, ít hoàn hàng, ít lựa chọn.') },
  medium: { name: tx('Medium (15 SKUs)', 'Vừa (15 mã)'), note: tx('Balanced.', 'Cân bằng.') },
  wide: { name: tx('Wide (40 SKUs)', 'Rộng (40 mã)'), note: tx('More choice, more returns and complexity (paradox of choice).', 'Nhiều lựa chọn, hoàn hàng và phức tạp hơn (nghịch lý lựa chọn).') },
};

export const SERVICE_INFO: Record<Service, { name: T; cost: number; note: T }> = {
  basic: { name: tx('Basic (3–5 days)', 'Cơ bản (3–5 ngày)'), cost: 0.022, note: tx('22k per order', '22k mỗi đơn') },
  fast: { name: tx('Fast (next day)', 'Nhanh (ngày hôm sau)'), cost: 0.032, note: tx('32k per order', '32k mỗi đơn') },
  premium: { name: tx('Premium (same day + easy returns)', 'Cao cấp (trong ngày + đổi trả dễ)'), cost: 0.045, note: tx('45k per order', '45k mỗi đơn') },
};

export const AI_INFO: Record<AiChoice, { name: T; note: T; cost: number }> = {
  A: { name: tx('A · AI recommendation', 'A · Gợi ý sản phẩm bằng AI'), note: tx('Higher conversion and basket size from next quarter.', 'Tăng chuyển đổi và giá trị giỏ hàng từ quý này.'), cost: 300 },
  B: { name: tx('B · AI customer service', 'B · Chăm sóc khách hàng bằng AI'), note: tx('Faster answers, fewer returns, better rating – needs human escalation.', 'Trả lời nhanh, ít hoàn hàng, điểm đánh giá tốt hơn – cần chuyển người thật khi cần.'), cost: 300 },
  C: { name: tx('C · Demand forecasting', 'C · Dự báo nhu cầu'), note: tx('Fewer stock-outs and less dead stock: stock auto-adjusts to demand.', 'Ít hết hàng và ít tồn đọng: tồn kho tự điều chỉnh theo nhu cầu.'), cost: 300 },
  D: { name: tx('D · More ads instead', 'D · Thêm quảng cáo'), note: tx('300 million more ads this quarter only.', 'Thêm 300 triệu quảng cáo, chỉ trong quý này.'), cost: 300 },
  E: { name: tx('E · No AI investment', 'E · Không đầu tư AI'), note: tx('Keep the cash.', 'Giữ tiền mặt.'), cost: 0 },
};

export const AGENT_INFO: Record<AgentInvest, { name: T; cost: number }> = {
  catalog: { name: tx('Structured product catalogue', 'Danh mục sản phẩm có cấu trúc'), cost: 60 },
  api: { name: tx('Agent API (stock, price, delivery)', 'API cho agent (tồn kho, giá, giao hàng)'), cost: 100 },
  payment: { name: tx('Agent payment integration', 'Tích hợp thanh toán cho agent'), cost: 80 },
  policy: { name: tx('Machine-readable return & warranty policy', 'Chính sách đổi trả, bảo hành máy đọc được'), cost: 30 },
};

export const ARCHETYPE_INFO: Record<CeoArchetype, T> = {
  discount: tx('Discount king', 'Vua phá giá'),
  ads: tx('Ads burner', 'Đốt quảng cáo'),
  platform: tx('Platform loyalist', 'Bám sàn'),
  d2c: tx('D2C builder', 'Xây D2C'),
  aifirst: tx('AI first', 'AI trước tiên'),
  balanced: tx('Balanced', 'Cân bằng'),
};

export const KPI_INFO: Record<Kpi, T> = {
  revenue: tx('Revenue', 'Doanh thu'),
  profit: tx('Quarter profit', 'Lợi nhuận quý'),
  rating: tx('Customer rating', 'Điểm đánh giá'),
  pdr: tx('Platform dependency (PDR)', 'Mức phụ thuộc sàn (PDR)'),
};

/** The six rounds of Table 12.18. */
export const ROUND_INFO: Record<number, { title: T; text: T }> = {
  1: { title: tx('Market entry', 'Gia nhập thị trường'), text: tx('Each company has VND 1 billion. Choose market, product, price and channels. The goal is to survive, not to maximise revenue.', 'Mỗi công ty có 1 tỷ đồng. Chọn thị trường, sản phẩm, giá, kênh. Mục tiêu là sống sót, không phải tối đa doanh thu.') },
  2: { title: tx('Growth', 'Tăng trưởng'), text: tx('You now have one quarter of data: sales, reviews, CAC and CR. Scale, optimise or change segment?', 'Đã có dữ liệu một quý: doanh số, đánh giá, CAC, CR. Mở rộng, tối ưu hay đổi phân khúc?') },
  3: { title: tx('Platform power', 'Sức mạnh nền tảng'), text: tx('Shopee requires sellers to join a promotion programme (+3% fees, or 30% less visibility). TikTok raises creator commission by 5 points. Website CAC stays high.', 'Shopee yêu cầu tham gia chương trình khuyến mãi (+3% phí, nếu không thì giảm 30% hiển thị). TikTok tăng hoa hồng nhà sáng tạo thêm 5 điểm. CAC của website vẫn cao.') },
  4: { title: tx('AI competitor', 'Đối thủ dùng AI'), text: tx('A rival deploys AI recommendation, dynamic pricing, a chatbot and personalised CRM. You have VND 300 million: choose A, B, C, D or E.', 'Một đối thủ triển khai gợi ý AI, định giá động, chatbot và CRM cá nhân hóa. Bạn có 300 triệu: chọn A, B, C, D hoặc E.') },
  5: { title: tx('Agentic commerce', 'Thương mại do AI agent thực hiện'), text: tx('20% of customer searches now start from AI shopping agents. Invest in being machine-readable today, or wait?', '20% lượt tìm kiếm của khách bắt đầu từ AI agent mua sắm. Đầu tư để agent đọc được cửa hàng của bạn ngay, hay chờ?') },
  6: { title: tx('Crisis', 'Khủng hoảng'), text: tx('Each company draws a CEO Crisis Card. Decide under time pressure and predict which KPIs will move.', 'Mỗi công ty rút một thẻ Khủng hoảng CEO. Quyết định dưới áp lực thời gian và dự đoán KPI nào sẽ thay đổi.') },
};

export interface CrisisOption {
  id: string;
  label: T;
}
export interface CrisisCard {
  id: CrisisId;
  title: T;
  text: T;
  options: CrisisOption[];
}

/** The eight CEO Crisis Cards of Table 12.19 (effects live in the server model). */
export const CRISIS_CARDS: Record<CrisisId, CrisisCard> = {
  cpc: {
    id: 'cpc',
    title: tx('CPC +50%', 'Giá mỗi lượt nhấp tăng 50%'),
    text: tx('Advertising costs jump 50% this quarter.', 'Chi phí quảng cáo tăng 50% trong quý này.'),
    options: [
      { id: 'shift', label: tx('Cut paid ads, move budget to CRM and creators', 'Cắt quảng cáo trả tiền, chuyển ngân sách sang CRM và nhà sáng tạo') },
      { id: 'price', label: tx('Raise prices to cover the ads', 'Tăng giá để bù chi phí quảng cáo') },
      { id: 'keep', label: tx('Keep ads and accept the lower margin', 'Giữ quảng cáo, chấp nhận biên lợi nhuận thấp hơn') },
    ],
  },
  pricecut: {
    id: 'pricecut',
    title: tx('A rival cuts prices by 20%', 'Đối thủ giảm giá 20%'),
    text: tx('Your closest rival slashes prices. Do not default to “cut ours too”.', 'Đối thủ gần nhất giảm giá mạnh. Đừng mặc định “giảm theo”.'),
    options: [
      { id: 'match', label: tx('Match the 20% cut', 'Giảm giá 20% theo đối thủ') },
      { id: 'value', label: tx('Hold price, add value: bundle, service, loyal-customer offer', 'Giữ giá, tăng giá trị: combo, dịch vụ, ưu đãi khách quen') },
      { id: 'ignore', label: tx('Do nothing', 'Không làm gì') },
    ],
  },
  viral: {
    id: 'viral',
    title: tx('A TikTok video goes viral', 'Video TikTok lan truyền'),
    text: tx('Orders ×5, but stock covers only 2 days. Growth itself can become a crisis.', 'Đơn tăng gấp 5, nhưng hàng chỉ đủ 2 ngày. Tăng trưởng cũng có thể thành khủng hoảng.'),
    options: [
      { id: 'preorder', label: tx('Take pre-orders with a clear date, find a supplier urgently', 'Nhận đặt trước có hẹn ngày rõ ràng, tìm nhà cung cấp gấp') },
      { id: 'all', label: tx('Accept every order and hope stock arrives', 'Nhận hết đơn và hy vọng kịp hàng') },
      { id: 'stop', label: tx('Stop the creator campaign', 'Dừng chiến dịch với nhà sáng tạo') },
    ],
  },
  chatbot: {
    id: 'chatbot',
    title: tx('AI chatbot scandal', 'Chatbot AI gây phốt'),
    text: tx('The chatbot gave wrong skin-care advice; a video spreads and trust falls.', 'Chatbot tư vấn sai về chăm sóc da; video lan truyền, niềm tin giảm.'),
    options: [
      { id: 'govern', label: tx('Pause the bot, apologise, human escalation, fix governance', 'Tạm dừng bot, xin lỗi, chuyển người thật, sửa quy trình quản trị') },
      { id: 'deny', label: tx('Say it was a rare glitch and keep the bot running', 'Nói đây là lỗi hiếm và tiếp tục chạy bot') },
      { id: 'pay', label: tx('Quietly compensate the customers involved', 'Âm thầm bồi thường khách bị ảnh hưởng') },
    ],
  },
  agent: {
    id: 'agent',
    title: tx('An AI agent places 5,000 wrong orders', 'AI agent đặt nhầm 5.000 đơn'),
    text: tx('An agent read “pack of 10” as “quantity 10”. Who is accountable?', 'Agent hiểu “gói 10” thành “số lượng 10”. Ai chịu trách nhiệm?'),
    options: [
      { id: 'model', label: tx('Refund, fix the product data, propose a shared responsibility model', 'Hoàn tiền, sửa dữ liệu sản phẩm, đề xuất mô hình chia trách nhiệm') },
      { id: 'blame', label: tx('Blame the customers’ agents and refuse refunds', 'Đổ lỗi cho agent của khách, từ chối hoàn tiền') },
      { id: 'cancel', label: tx('Cancel the orders silently', 'Âm thầm hủy đơn') },
    ],
  },
  ban: {
    id: 'ban',
    title: tx('Platform ban', 'Bị sàn khóa sản phẩm'),
    text: tx('Your top SKU (≈30% of revenue) is suspended on Shopee.', 'Mã bán chạy nhất (≈30% doanh thu) bị Shopee tạm khóa.'),
    options: [
      { id: 'appeal', label: tx('Appeal, and redirect customers to the website and TikTok', 'Khiếu nại, chuyển khách sang website và TikTok') },
      { id: 'wait', label: tx('Wait for Shopee to decide', 'Chờ Shopee quyết định') },
      { id: 'relist', label: tx('Relist the same product under a new SKU', 'Đăng lại sản phẩm dưới mã mới') },
    ],
  },
  supplier: {
    id: 'supplier',
    title: tx('Supplier +30%', 'Nhà cung cấp tăng giá 30%'),
    text: tx('COGS rises 30%. Not everything can be held constant.', 'Giá vốn tăng 30%. Không thể giữ nguyên mọi thứ.'),
    options: [
      { id: 'reprice', label: tx('Raise price moderately and explain the value', 'Tăng giá vừa phải và giải thích giá trị') },
      { id: 'absorb', label: tx('Absorb the cost to keep prices', 'Gánh chi phí để giữ giá') },
      { id: 'cheaper', label: tx('Switch to a cheaper, lower-quality input', 'Đổi nguyên liệu rẻ hơn, chất lượng thấp hơn') },
    ],
  },
  breach: {
    id: 'breach',
    title: tx('Data breach', 'Lộ dữ liệu khách hàng'),
    text: tx('Customer data is exposed. Not merely an IT issue.', 'Dữ liệu khách hàng bị lộ. Không chỉ là chuyện IT.'),
    options: [
      { id: 'cirl', label: tx('Contain → Inform customers and authorities → Remediate → Learn', 'Khoanh vùng → Thông báo khách và cơ quan → Khắc phục → Rút kinh nghiệm') },
      { id: 'quiet', label: tx('Fix it quietly, tell nobody', 'Âm thầm sửa, không thông báo') },
      { id: 'vendor', label: tx('Announce that the IT vendor is to blame', 'Thông báo lỗi do nhà cung cấp IT') },
    ],
  },
};

export interface CeoDecision {
  price: PricePos;
  skus: SkuRange;
  segment: Segment;
  service: Service;
  /** Million VND, steps of 10. */
  ads: number;
  creators: number;
  crm: number;
  /** Channel effort in %, steps of 10, sums to 100. */
  mix: Record<Channel, number>;
  /** Units to buy this quarter (0 = buy nothing). */
  stock: number;
  /** Round 3: join Shopee's promotion programme. */
  shopeePromo?: boolean;
  /** Round 4 only. */
  ai?: AiChoice;
  /** Round 5 (and 6): agent-readiness investments. */
  agent?: AgentInvest[];
  /** Round 6 only. */
  crisis?: string;
  predict?: Partial<Record<Kpi, Trend>>;
}

export interface CeoKpis {
  traffic: number;
  orders: number;
  cr: number;
  aov: number;
  revenue: number;
  byChannel: Record<Channel, { orders: number; revenue: number }>;
  cogs: number;
  fees: number;
  fulfillment: number;
  returns: number;
  marketing: number;
  ai: number;
  opex: number;
  holding: number;
  profit: number;
  cash: number;
  rating: number;
  pdr: number;
  stockouts: number;
  stockLeft: number;
  newCustomers: number;
  repeatOrders: number;
  cac: number | null;
  agentOrders: number;
}

export interface CeoReport {
  round: number;
  decision: CeoDecision;
  defaulted: boolean;
  kpis: CeoKpis;
  notes: T[];
}

export interface CeoStanding {
  profitCum: number;
  cash: number;
  rating: number;
  pdr: number;
  agentReady: number;
  crisisPts: number;
  dashboard: number;
  rank: number;
  defaulted?: boolean;
  bankrupt?: boolean;
}

export interface CeoSettings {
  decideSec: number;
  resultsSec: number;
  botLevel: BotLevel;
  fillBots: boolean;
}

export interface CeoPlayerPublic {
  id: string;
  name: string;
  bot: boolean;
  level?: BotLevel;
  archetype?: CeoArchetype;
  joinedAt: number;
  lms?: boolean;
}

export interface CeoRoomDoc {
  code: string;
  game: 'ceo-sim';
  title: string;
  status: 'lobby' | 'decide' | 'results' | 'finished';
  createdAt: number;
  hostPlays: boolean;
  hostPlayerId: string | null;
  settings: CeoSettings;
  players: Record<string, CeoPlayerPublic>;
  order: string[];
  round: number;
  rounds: number;
  openedAt: number | null;
  deadline: number | null;
  submitted: Record<string, boolean>;
  standings: Record<string, CeoStanding>;
  /** Crisis card drawn by each company in round 6 (public: the class sees who got what). */
  crises: Record<string, CrisisId>;
  history: { round: number; revenue: Record<string, number>; profit: Record<string, number> }[];
  news: T[];
  revealedAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  version: number;
  lmsStatus?: Record<string, 'sent' | 'error'>;
}

export interface CeoScorecard {
  profit: number;
  cash: number;
  pdr: number;
  crisis: number;
  total: number;
}

export interface CeoMe {
  playerId: string;
  reports: CeoReport[];
  pending: CeoDecision | null;
  scorecard: CeoScorecard;
  grade: number | null;
  /** Units in the warehouse now. */
  stock: number;
  cash: number;
  aiChoice: AiChoice | null;
  agentOwned: AgentInvest[];
  crisis: CrisisId | null;
  /** After the game: what the crisis response was worth and which predictions were right. */
  crisisResult?: { quality: number; predictions: Partial<Record<Kpi, boolean>> };
}
