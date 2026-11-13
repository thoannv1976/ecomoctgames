// Game 7 – Ad Auction & Creator Clash (Chapter 7): public types and display content (browser-safe).
// Fake-follower shares, true incrementality and the market model stay on the server.
import type { T } from '../types.js';
import { tx } from '../types.js';

export type AdChannel = 'search' | 'creators' | 'retarget' | 'live' | 'crm';
export const AD_CHANNELS: AdChannel[] = ['search', 'creators', 'retarget', 'live', 'crm'];
export type AdCrm = 'none' | 'blast' | 'rfm';
export type AdArchetype = 'bidder' | 'celebrity' | 'retarget' | 'discounter' | 'balanced' | 'measurer';
export type AdTier = 'nano' | 'micro' | 'mid' | 'macro';

export const AD_ROUNDS = 5;
/** Money in million VND. */
export const AD_BUDGET = 2000;
export const AD_AOV = 0.5;
export const AD_MARGIN = 0.4;
export const AD_BE_ROAS = 1 / AD_MARGIN;
export const AD_MAX_CREATORS = 3;
export const AD_HOLDOUT_COST = 40;
export const AD_QUALITY_COST = [0, 50, 120];
export const AD_LIVE_FEE = 40; // per 2 hours

export interface AdCreatorPublic {
  id: string;
  handle: string;
  tier: AdTier;
  /** Thousands. */
  followers: number;
  /** Thousands, average per video. */
  avgViews: number;
  /** (likes + comments) / views. */
  er: number;
  /** Share of comments that look generic ("Nice!!", emoji only). */
  generic: number;
  /** Follower growth last 30 days. */
  growth: number;
  fee: number;
  niche: T;
}

export interface AdDecision {
  /** Search: max CPC in thousand VND (steps of 0.5). */
  bid: number;
  /** Search budget, million VND (steps of 50). */
  searchBudget: number;
  /** Landing page & ad quality investment level this month (0 none, 1 = 50m, 2 = 120m). */
  quality: 0 | 1 | 2;
  creators: string[];
  /** Pay +20% to win a creator another brand also wants. */
  premium: boolean;
  retarget: number;
  liveHours: 0 | 2 | 4;
  liveDiscount: 0 | 10 | 20 | 30;
  crm: AdCrm;
  holdout: AdChannel | 'none';
  /** Month 1 only: your break-even ROAS. */
  beRoas?: number;
}

export interface AdChannelResult {
  spend: number;
  /** What the platform/tool reports (attributed revenue / spend). */
  reportedRoas: number;
  reportedRevenue: number;
  orders: number;
}

export interface AdReport {
  round: number;
  decision: AdDecision;
  defaulted: boolean;
  /** Search auction outcome. */
  position: number | null;
  qs: number;
  cpc: number;
  clicks: number;
  booked: string[];
  lostCreators: string[];
  channels: Record<AdChannel, AdChannelResult>;
  organic: number;
  orders: number;
  revenue: number;
  sumReported: number;
  spend: number;
  discountCost: number;
  blendedRoas: number;
  profit: number;
  newCustomers: number;
  customers: number;
  waitShare: number;
  holdout: { channel: AdChannel; incrementalRoas: number } | null;
  notes: T[];
}

export interface AdView {
  qs: number;
  customers: number;
  waitShare: number;
  beRoas: number | null;
  /** Revealed at the end. */
  fakes?: Record<string, number>;
  incremental?: Partial<Record<AdChannel, number>>;
}

export interface AdPub {
  /** Creators on the market this month (public data). */
  roster: AdCreatorPublic[];
  /** Last month's search auction: position and CPC by brand. */
  position: Record<string, number>;
  cpc: Record<string, number>;
  /** Creator handle → brand that booked it last month. */
  bookings: Record<string, string>;
  spend: Record<string, number>;
}

export const AD_TIER_INFO: Record<AdTier, T> = {
  nano: tx('Nano (<10k)', 'Nano (<10 nghìn)'),
  micro: tx('Micro (10–100k)', 'Micro (10–100 nghìn)'),
  mid: tx('Mid-tier (100–500k)', 'Tầm trung (100–500 nghìn)'),
  macro: tx('Macro (>500k)', 'Macro (>500 nghìn)'),
};

export const AD_CHANNEL_INFO: Record<AdChannel, T> = {
  search: tx('Search ads', 'Quảng cáo tìm kiếm'),
  creators: tx('Creators (KOL/KOC)', 'Nhà sáng tạo (KOL/KOC)'),
  retarget: tx('Retargeting', 'Quảng cáo nhắm lại'),
  live: tx('Livestream', 'Livestream'),
  crm: tx('CRM (existing customers)', 'CRM (khách cũ)'),
};

export const AD_CRM_INFO: Record<AdCrm, { name: T; note: T }> = {
  none: { name: tx('Nothing', 'Không làm gì'), note: tx('Customers come back on their own – some of them.', 'Khách tự quay lại – một phần.') },
  blast: { name: tx('20% code to everyone', 'Mã giảm 20% cho tất cả'), note: tx('Many repeat orders, but every one at 20% off – even from people who would have paid full price.', 'Nhiều đơn mua lại, nhưng đơn nào cũng giảm 20% – kể cả người vốn sẵn sàng trả đủ giá.') },
  rfm: { name: tx('RFM segments (30m setup)', 'Phân nhóm RFM (30 triệu)'), note: tx('Privileges for VIPs, win-back offers only for customers going cold.', 'Đặc quyền cho khách VIP, ưu đãi kéo lại chỉ cho khách đang nguội.') },
};

export const AD_ARCHETYPE_INFO: Record<AdArchetype, T> = {
  bidder: tx('Top-slot bidder', 'Đấu giá giành top'),
  celebrity: tx('Celebrity hunter', 'Săn người nổi tiếng'),
  retarget: tx('ROAS chaser', 'Chạy theo ROAS'),
  discounter: tx('Discount addict', 'Nghiện giảm giá'),
  balanced: tx('Balanced', 'Cân bằng'),
  measurer: tx('Incrementality measurer', 'Đo lường tăng thêm'),
};

export const AD_ROUND_INFO: Record<number, { title: T; text: T }> = {
  1: {
    title: tx('Month 1 · Launch the serum', 'Tháng 1 · Ra mắt serum'),
    text: tx(
      'Six serum brands, VND 2 bn of marketing each per month, AOV 500k, contribution margin 40%. First: what is your break-even ROAS? Then split the budget across search, creators, retargeting, livestream and CRM.',
      'Sáu thương hiệu serum, mỗi tháng 2 tỷ đồng marketing, giá trị đơn 500 nghìn, biên lợi nhuận đóng góp 40%. Trước hết: ROAS hòa vốn của bạn là bao nhiêu? Sau đó chia ngân sách cho tìm kiếm, nhà sáng tạo, nhắm lại, livestream và CRM.',
    ),
  },
  2: {
    title: tx('Month 2 · CPC war', 'Tháng 2 · Chiến tranh giá thầu'),
    text: tx(
      'A big pharmacy chain joins the search auction for “serum”. Remember: the platform ranks bid × quality score, not the highest bid.',
      'Một chuỗi nhà thuốc lớn tham gia đấu giá từ khóa “serum”. Nhớ rằng: sàn xếp hạng theo giá thầu × điểm chất lượng, không phải ai trả cao nhất.',
    ),
  },
  3: {
    title: tx('Month 3 · Follower purge', 'Tháng 3 · Đợt xóa follower ảo'),
    text: tx(
      'The platform deletes bot accounts. Creators with fake followers will deliver even fewer real viewers. Read engagement rate, generic comments and sudden follower growth before you book.',
      'Nền tảng xóa tài khoản ảo. Nhà sáng tạo có follower ảo càng ít người xem thật. Đọc tỷ lệ tương tác, bình luận chung chung và tăng follower đột biến trước khi đặt.',
    ),
  },
  4: {
    title: tx('Month 4 · 11.11', 'Tháng 4 · 11.11'),
    text: tx(
      'Search demand ×1.5 and livestream audiences ×2. Deep discounts sell a lot today – and teach customers to wait for the next sale.',
      'Nhu cầu tìm kiếm ×1,5 và người xem livestream ×2. Giảm giá sâu bán được nhiều hôm nay – và dạy khách chờ đợt sale sau.',
    ),
  },
  5: {
    title: tx('Month 5 · CFO review', 'Tháng 5 · Giám đốc tài chính rà soát'),
    text: tx(
      'The CFO adds up every channel report: the sum is far above real revenue. She only trusts blended ROAS and holdout tests. Last month to earn profit.',
      'Giám đốc tài chính cộng báo cáo của mọi kênh: tổng vượt xa doanh thu thật. Bà chỉ tin ROAS tổng hợp (blended) và thử nghiệm nhóm đối chứng. Tháng cuối để kiếm lợi nhuận.',
    ),
  },
};

export const AD_SCORE_PARTS: Record<string, T> = {
  profit: tx('Extra contribution profit (50)', 'Lợi nhuận đóng góp tăng thêm (50)'),
  customers: tx('Customers who will come back (20)', 'Khách hàng sẽ quay lại (20)'),
  discipline: tx('Measurement discipline (30)', 'Kỷ luật đo lường (30)'),
};

export const AD_BADGES: Record<string, T> = {
  beroas: tx('🎯 Knew the break-even ROAS', '🎯 Biết ROAS hòa vốn'),
  nofake: tx('🕵️ No fake creators', '🕵️ Không thuê creator ảo'),
  holdout: tx('🧪 Measured incrementality', '🧪 Đo lường tăng thêm'),
  quality: tx('⭐ Won with quality, not bids', '⭐ Thắng nhờ chất lượng, không nhờ giá thầu'),
  crm: tx('💌 Customers come back', '💌 Khách quay lại'),
  profit: tx('💰 Most profitable brand', '💰 Thương hiệu lãi nhất'),
};

export const AD_DEBRIEF: [string, string][] = [
  ['Break-even ROAS = 1 ÷ contribution margin (here 2.5). A campaign below it loses money however good its ROAS looks next to others.', 'ROAS hòa vốn = 1 ÷ biên lợi nhuận đóng góp (ở đây 2,5). Chiến dịch thấp hơn mức này là lỗ, dù ROAS trông đẹp so với kênh khác.'],
  ['Search auctions rank bid × quality score: a better landing page buys a higher position for a lower CPC.', 'Đấu giá tìm kiếm xếp hạng theo giá thầu × điểm chất lượng: trang đích tốt mua được vị trí cao hơn với giá mỗi lượt nhấp thấp hơn.'],
  ['Views ≠ sales. Read engagement rate, generic comments and follower spikes; micro creators usually sell more per million than macro ones.', 'Lượt xem ≠ doanh số. Đọc tỷ lệ tương tác, bình luận chung chung và tăng follower đột biến; creator micro thường bán được nhiều hơn trên mỗi triệu đồng so với macro.'],
  ['Retargeting harvests demand other channels created: its ROAS is high but mostly not incremental, and it dries up when nobody feeds the top of the funnel.', 'Quảng cáo nhắm lại thu hoạch nhu cầu do kênh khác tạo ra: ROAS cao nhưng phần lớn không tăng thêm, và cạn kiệt khi không ai nuôi phễu phía trên.'],
  ['The sum of channel reports exceeds real revenue. Trust blended ROAS and holdout tests (attributed ≠ incremental).', 'Tổng báo cáo các kênh vượt doanh thu thật. Hãy tin ROAS tổng hợp và thử nghiệm nhóm đối chứng (được ghi nhận ≠ tăng thêm).'],
  ['Keeping customers is cheaper than finding new ones – but discounting everyone trains them to wait (SHEIN, livestream).', 'Giữ khách cũ rẻ hơn tìm khách mới – nhưng giảm giá cho tất cả sẽ dạy khách chờ sale (SHEIN, livestream).'],
];
