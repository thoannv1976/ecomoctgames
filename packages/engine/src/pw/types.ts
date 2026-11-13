// Game 2 – Platform Wars (Chapter 2): public types and display content (browser-safe, no hidden model).
import type { T } from '../types.js';
import { tx } from '../types.js';

export type PwProgram = 'none' | 'vip' | 'tiers';
export type PwAds = 0 | 1 | 2;
export type PwArchetype = 'burn' | 'toll' | 'buyers' | 'balanced' | 'sellers' | 'smart';

export const PW_ROUNDS = 6;
/** Money in billion VND (tỷ đồng). */
export const PW_START_CASH = 30;
export const PW_START_BUYERS = 40; // thousand
export const PW_START_SELLERS = 400;
export const PW_BUYER_POOL = 1000; // thousand buyers in the city
export const PW_SELLER_POOL = 10000;
export const PW_MAX_SUBSIDY = 10;
export const PW_MAX_TRUST = 5;
export const PW_TAKE_MIN = 1;
export const PW_TAKE_MAX = 25;

export interface PwDecision {
  /** Commission on GMV, whole %. */
  take: number;
  /** Subsidy budget this quarter, bn VND, steps of 0.5. */
  subsidy: number;
  /** Share of the subsidy given to sellers (%), steps of 10; the rest goes to buyers as vouchers. */
  toSellers: number;
  /** Retail media: 0 none, 1 light, 2 heavy. */
  ads: PwAds;
  /** Trust & safety (moderation, escrow, anti-counterfeit), bn VND, steps of 0.25. */
  trust: number;
  program: PwProgram;
  /** From quarter 4: sell own-brand goods next to the sellers (referee and player). */
  ownBrand?: boolean;
}

export const PW_ADS_INFO: Record<PwAds, { name: T; rate: number; note: T }> = {
  0: { name: tx('No ads', 'Không quảng cáo'), rate: 0, note: tx('Clean search results.', 'Kết quả tìm kiếm sạch.') },
  1: { name: tx('Light retail media', 'Quảng cáo nhẹ'), rate: 0.02, note: tx('Ad revenue ≈ 2% of GMV; a few sponsored slots.', 'Doanh thu quảng cáo ≈ 2% GMV; vài vị trí tài trợ.') },
  2: { name: tx('Heavy retail media', 'Quảng cáo dày'), rate: 0.045, note: tx('Ad revenue ≈ 4.5% of GMV; first results are all ads.', 'Doanh thu quảng cáo ≈ 4,5% GMV; kết quả đầu toàn quảng cáo.') },
};

export const PW_PROGRAM_INFO: Record<PwProgram, { name: T; note: T }> = {
  none: { name: tx('No programme', 'Không có chương trình'), note: tx('No extra cost.', 'Không tốn thêm.') },
  vip: { name: tx('Buyer membership (VIP)', 'Gói thành viên cho người mua (VIP)'), note: tx('Free shipping for members: costs ≈ 0.8% of GMV, brings a fee, buyers order more and leave less.', 'Miễn phí giao cho thành viên: tốn ≈ 0,8% GMV, có phí thành viên, người mua mua nhiều hơn và ít bỏ đi.') },
  tiers: { name: tx('Seller loyalty tiers', 'Hạng người bán thân thiết'), note: tx('Fee discounts for loyal sellers: costs ≈ 1% of GMV, raises their switching cost.', 'Giảm phí cho người bán gắn bó: tốn ≈ 1% GMV, tăng chi phí chuyển đổi của họ.') },
};

export const PW_ARCHETYPE_INFO: Record<PwArchetype, T> = {
  burn: tx('Cash burner', 'Đốt tiền giành thị phần'),
  toll: tx('Toll keeper', 'Thu phí cao'),
  buyers: tx('Buyers only', 'Chỉ lo người mua'),
  balanced: tx('Balanced', 'Cân bằng'),
  sellers: tx('Sellers first', 'Người bán trước'),
  smart: tx('Platform strategist', 'Chiến lược gia nền tảng'),
};

export const PW_ROUND_INFO: Record<number, { title: T; text: T }> = {
  1: {
    title: tx('Launch: chicken and egg', 'Ra mắt: con gà và quả trứng'),
    text: tx(
      'Six new marketplaces open in the same city, each with 40k buyers, 400 sellers and VND 30 bn. Buyers will not come without sellers, sellers will not come without buyers. Which side do you subsidise?',
      'Sáu sàn mới mở trong cùng một thành phố, mỗi sàn có 40 nghìn người mua, 400 người bán và 30 tỷ đồng. Không có người bán thì người mua không đến, không có người mua thì người bán không đến. Bạn trợ giá phía nào?',
    ),
  },
  2: {
    title: tx('Shopping season', 'Mùa mua sắm'),
    text: tx(
      'Year-end season: 20% more buyers shop this quarter. The flywheel turns faster for platforms that already have selection.',
      'Mùa mua sắm cuối năm: số người mua sắm quý này tăng 20%. Bánh đà quay nhanh hơn với sàn đã có nhiều lựa chọn.',
    ),
  },
  3: {
    title: tx('A foreign giant arrives', 'Một sàn ngoại đổ bộ'),
    text: tx(
      'A foreign platform enters with heavy buyer vouchers. Buyers multi-home at almost no cost: who keeps them? Members (VIP) and platforms with real selection lose less.',
      'Một sàn nước ngoài vào thị trường với voucher khủng cho người mua. Người mua dùng nhiều sàn gần như miễn phí: ai giữ được họ? Thành viên VIP và sàn có nhiều lựa chọn thật sẽ mất ít hơn.',
    ),
  },
  4: {
    title: tx('Referee and player', 'Vừa đá bóng vừa thổi còi'),
    text: tx(
      'New option: launch your own-brand goods next to your sellers. Extra margin – but sellers fear you will rank yourself first.',
      'Lựa chọn mới: tung hàng nhãn riêng bán cạnh người bán của mình. Thêm biên lợi nhuận – nhưng người bán sợ bạn ưu tiên hàng của mình.',
    ),
  },
  5: {
    title: tx('Leakage: “chốt đơn qua Zalo”', 'Rò rỉ: “chốt đơn qua Zalo”'),
    text: tx(
      'Sellers and buyers meet on the platform, then close deals in messaging apps to avoid fees. Leakage pressure ×1.6 this quarter: high take rates and weak escrow lose the most.',
      'Người bán và người mua gặp nhau trên sàn rồi chốt đơn qua ứng dụng nhắn tin để né phí. Áp lực rò rỉ ×1,6 trong quý này: phí cao và bảo vệ giao dịch yếu thì mất nhiều nhất.',
    ),
  },
  6: {
    title: tx('Investor day', 'Ngày gặp nhà đầu tư'),
    text: tx(
      'Last quarter. Investors look at three things: cumulative profit, GMV share and platform health (leakage and counterfeits). GMV is not revenue, revenue is not profit.',
      'Quý cuối. Nhà đầu tư nhìn ba thứ: lợi nhuận lũy kế, thị phần GMV và sức khỏe nền tảng (rò rỉ và hàng giả). GMV không phải doanh thu, doanh thu không phải lợi nhuận.',
    ),
  },
};

export interface PwKpis {
  buyers: number;
  hunters: number;
  sellers: number;
  /** Sellers per thousand buyers. */
  selection: number;
  gmv: number;
  leakage: number;
  gmvLost: number;
  counterfeit: number;
  takeRev: number;
  adRev: number;
  programRev: number;
  ownRev: number;
  revenue: number;
  subsidy: number;
  trust: number;
  programCost: number;
  opex: number;
  profit: number;
  cash: number;
  share: number;
  /** All-in cost for a seller as a share of their sales (take + ads + payment). */
  sellerCost: number;
  health: number;
}

export interface PwReport {
  round: number;
  decision: PwDecision;
  defaulted: boolean;
  kpis: PwKpis;
  notes: T[];
}

export interface PwView {
  cash: number;
  buyers: number;
  sellers: number;
  ownBrand: boolean;
}

/** Public market data published after each quarter. */
export interface PwPub {
  share: Record<string, number>;
  buyers: Record<string, number>;
  sellers: Record<string, number>;
  take: Record<string, number>;
}

export const PW_SCORE_PARTS: Record<string, T> = {
  profit: tx('Cumulative profit (45)', 'Lợi nhuận lũy kế (45)'),
  share: tx('GMV share (25; worth less if bought with losses)', 'Thị phần GMV (25; giảm giá trị nếu mua bằng lỗ)'),
  health: tx('Platform health (30)', 'Sức khỏe nền tảng (30)'),
};

export const PW_BADGES: Record<string, T> = {
  flywheel: tx('🌀 Flywheel builder', '🌀 Người quay bánh đà'),
  profit: tx('💰 Profit over GMV', '💰 Lợi nhuận hơn GMV'),
  clean: tx('🛡️ Clean marketplace', '🛡️ Sàn sạch'),
  fair: tx('⚖️ Fair take rate', '⚖️ Phí sàn hợp lý'),
  leader: tx('👑 Market leader', '👑 Dẫn đầu thị phần'),
  survivor: tx('🧯 Never ran out of cash', '🧯 Không bao giờ cạn tiền'),
};

export const PW_DEBRIEF: [string, string][] = [
  ['Subsidise the scarce side, and pay for behaviour, not sign-ups: voucher hunters leave the day the subsidy stops.', 'Trợ giá phía khan hiếm và trả tiền cho hành vi, không phải cho lượt đăng ký: người săn voucher bỏ đi ngay khi hết trợ giá.'],
  ['Cross-side network effects drive growth, but at scale same-side effects turn negative: more sellers without moderation means counterfeits and lost trust.', 'Hiệu ứng mạng chéo tạo tăng trưởng, nhưng khi lớn thì hiệu ứng cùng phía đổi chiều: nhiều người bán mà không kiểm soát thì sinh hàng giả và mất niềm tin.'],
  ['The take rate has a ceiling: above it, deals leak off-platform and sellers multi-home.', 'Phí sàn có trần: vượt trần thì giao dịch rò rỉ ra ngoài và người bán đi đăng nhiều sàn.'],
  ['Retail media raises revenue but is a cross-side negative effect: buyers see ads instead of products.', 'Quảng cáo trên sàn tăng doanh thu nhưng là hiệu ứng chéo tiêu cực: người mua thấy quảng cáo thay vì sản phẩm.'],
  ['Winner-takes-most, not all: buyers multi-home almost for free, so share must be re-earned every quarter.', 'Người thắng chiếm phần lớn chứ không chiếm tất cả: người mua dùng nhiều sàn gần như miễn phí, nên thị phần phải giành lại mỗi quý.'],
  ['GMV is not revenue and revenue is not profit: compare GMV share with cumulative profit on the board.', 'GMV không phải doanh thu, doanh thu không phải lợi nhuận: so thị phần GMV với lợi nhuận lũy kế trên bảng.'],
];
