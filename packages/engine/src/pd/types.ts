// Game 8 – Peak Day Ops "11.11" (Chapter 8): public types and display content (browser-safe).
import type { T } from '../types.js';
import { tx } from '../types.js';

export type PdFulfil = 'self' | '3pl' | 'fbs';
export type PdSpeed = 'standard' | 'fast' | 'sameday';
export type PdReturns = 'strict' | '7day' | 'free30';
export type PdFraud = 'none' | 'basic' | 'strict';
export type PdCod = 'all' | 'confirm' | 'off';
export type PdCost = 'discount' | 'delivery' | 'failedCod' | 'returns' | 'cs' | 'ads' | 'expedite' | 'deadStock';
export type PdArchetype = 'overstock' | 'codall' | 'understock' | 'discounter' | 'balanced' | 'pro';

export const PD_ROUNDS = 5;
export const PD_COSTS: PdCost[] = ['discount', 'delivery', 'failedCod', 'returns', 'cs', 'ads', 'expedite', 'deadStock'];
/** Money in million VND. List price 400k, unit cost 200k. */
export const PD_PRICE = 0.4;
export const PD_UNIT_COST = 0.2;
export const PD_MARKET_FORECAST = 22000;
export const PD_SHOP_FORECAST = 3700;
export const PD_LAST_YEAR = { orders: 2400, revenue: 960, profit: 250 };
export const PD_CS_CAPACITY = 350;
export const PD_CS_COST = 1.5;
export const PD_SELF_CAPACITY = 1500;

export interface PdDecision {
  // Round 1 – preparation
  stock?: number;
  fulfil?: PdFulfil;
  speed?: PdSpeed;
  returns?: PdReturns;
  fraud?: PdFraud;
  // Rounds 1–4
  cod?: PdCod;
  // Rounds 2–4 – the sale day
  cs?: number;
  discount?: 0 | 10 | 20 | 30;
  ads?: 0 | 100 | 300;
  /** Emergency air-freight stock (units). Ordered in block 1 arrives in block 3; in block 2 it arrives after the sale. */
  expedite?: number;
  // Round 5 – aftermath
  clearance?: 0 | 30 | 50;
  refund?: 'fast' | 'slow';
  apology?: boolean;
  /** The two cost lines you think grew the most. */
  diagnosis?: PdCost[];
}

export const PD_FULFIL_INFO: Record<PdFulfil, { name: T; note: T }> = {
  self: { name: tx('Own warehouse', 'Kho tự vận hành'), note: tx('14k per order, but only ~1,500 orders per 8-hour block.', '14 nghìn mỗi đơn, nhưng chỉ ~1.500 đơn mỗi ca 8 giờ.') },
  '3pl': { name: tx('3PL partner', 'Thuê 3PL'), note: tx('17k per order, scales, ~2% picking errors, carriers overload late in the day.', '17 nghìn mỗi đơn, mở rộng được, ~2% lỗi soạn hàng, cuối ngày dễ quá tải.') },
  fbs: { name: tx('Platform warehouse (FBS)', 'Kho của sàn (FBS)'), note: tx('20k per order, fastest badge, buyers trust it.', '20 nghìn mỗi đơn, có huy hiệu giao nhanh, người mua tin.') },
};
export const PD_SPEED_INFO: Record<PdSpeed, { name: T; note: T }> = {
  standard: { name: tx('Standard (3–5 days)', 'Tiêu chuẩn (3–5 ngày)'), note: tx('+0', '+0') },
  fast: { name: tx('Next day', 'Ngày hôm sau'), note: tx('+8k per order', '+8 nghìn mỗi đơn') },
  sameday: { name: tx('Same day', 'Trong ngày'), note: tx('+20k per order; late if the warehouse is overloaded', '+20 nghìn mỗi đơn; trễ nếu kho quá tải') },
};
export const PD_RETURNS_INFO: Record<PdReturns, { name: T; note: T }> = {
  strict: { name: tx('Strict (defects only)', 'Chặt (chỉ hàng lỗi)'), note: tx('Few returns, buyers hesitate.', 'Ít hoàn, người mua ngần ngại.') },
  '7day': { name: tx('7-day returns', 'Đổi trả 7 ngày'), note: tx('The usual standard.', 'Mức thông thường.') },
  free30: { name: tx('Free 30-day returns', 'Đổi trả miễn phí 30 ngày'), note: tx('Buyers love it; returns cost 35k each.', 'Người mua thích; mỗi đơn hoàn tốn 35 nghìn.') },
};
export const PD_FRAUD_INFO: Record<PdFraud, { name: T; note: T }> = {
  none: { name: tx('No checks', 'Không kiểm tra'), note: tx('Fake and prank orders get through.', 'Đơn ảo, đơn phá lọt qua.') },
  basic: { name: tx('Rules (risk score)', 'Quy tắc (điểm rủi ro)'), note: tx('Blocks obvious fakes.', 'Chặn đơn ảo rõ ràng.') },
  strict: { name: tx('Strict', 'Chặt'), note: tx('Fewer fakes, but ~3% of good customers are blocked (false positives).', 'Ít đơn ảo hơn, nhưng ~3% khách thật bị chặn nhầm.') },
};
export const PD_COD_INFO: Record<PdCod, { name: T; note: T }> = {
  all: { name: tx('COD for everyone', 'COD cho tất cả'), note: tx('Most buyers, most failed deliveries.', 'Nhiều người mua nhất, nhiều đơn giao thất bại nhất.') },
  confirm: { name: tx('COD with confirmation call', 'COD có gọi xác nhận'), note: tx('Call/message before dispatch: fewer failed deliveries, a few cancel.', 'Gọi/nhắn trước khi gửi: ít giao thất bại hơn, vài đơn hủy.') },
  off: { name: tx('Prepaid only (wallet voucher)', 'Chỉ trả trước (voucher ví)'), note: tx('No failed COD, but many COD buyers go elsewhere.', 'Không có COD thất bại, nhưng nhiều khách COD đi nơi khác.') },
};
export const PD_COST_INFO: Record<PdCost, T> = {
  discount: tx('Discounts', 'Giảm giá'),
  delivery: tx('Delivery & last mile', 'Giao hàng & chặng cuối'),
  failedCod: tx('Failed COD (two-way shipping)', 'COD thất bại (vận chuyển hai chiều)'),
  returns: tx('Returns & refunds handling', 'Xử lý hoàn hàng'),
  cs: tx('Customer service', 'Chăm sóc khách hàng'),
  ads: tx('Ads push', 'Đẩy quảng cáo'),
  expedite: tx('Air-freight restock', 'Nhập gấp bằng đường hàng không'),
  deadStock: tx('Dead stock write-down', 'Hàng tồn phải giảm giá trị'),
};
export const PD_ARCHETYPE_INFO: Record<PdArchetype, T> = {
  overstock: tx('Over-stocker', 'Ôm hàng'),
  codall: tx('COD for all', 'COD tất cả'),
  understock: tx('Under-stocker', 'Nhập thiếu'),
  discounter: tx('Deep discounter', 'Giảm giá sâu'),
  balanced: tx('Balanced', 'Cân bằng'),
  pro: tx('Ops pro', 'Chuyên gia vận hành'),
};

export const PD_ROUND_INFO: Record<number, { title: T; text: T }> = {
  1: {
    title: tx('2 weeks before · Prepare', '2 tuần trước · Chuẩn bị'),
    text: tx(
      'Last year your shop sold 2,400 orders on 11.11 (revenue 960m, profit 250m). Forecast this year: 22,000 orders for six similar shops (±30%), about 3,700 for you. Buy stock (200k a unit), choose fulfilment, delivery promise, returns, fraud checks and COD policy.',
      'Năm ngoái 11.11 cửa hàng bán 2.400 đơn (doanh thu 960 triệu, lãi 250 triệu). Dự báo năm nay: 22.000 đơn cho sáu cửa hàng tương tự (±30%), khoảng 3.700 cho bạn. Nhập hàng (200 nghìn mỗi sản phẩm), chọn cách giao vận, cam kết giao, đổi trả, kiểm tra gian lận và chính sách COD.',
    ),
  },
  2: {
    title: tx('11.11 · 00:00–08:00 Midnight flash', '11.11 · 00:00–08:00 Flash sale nửa đêm'),
    text: tx(
      'The sale opens. Set discount, ads push, customer-service agents and COD. Air freight ordered now arrives for the evening block.',
      'Mở bán. Chọn mức giảm giá, đẩy quảng cáo, số nhân viên chăm sóc khách hàng và COD. Hàng nhập gấp đặt bây giờ sẽ về kịp ca tối.',
    ),
  },
  3: {
    title: tx('11.11 · 08:00–16:00 Viral moment', '11.11 · 08:00–16:00 Khoảnh khắc viral'),
    text: tx(
      'A creator video goes viral for two shops: their demand ×3 this block. Growth itself can become a crisis. Air freight ordered now arrives after the sale.',
      'Video của một nhà sáng tạo lan truyền cho hai cửa hàng: nhu cầu ×3 trong ca này. Tăng trưởng cũng có thể thành khủng hoảng. Hàng nhập gấp đặt bây giờ sẽ về sau đợt sale.',
    ),
  },
  4: {
    title: tx('11.11 · 16:00–24:00 Carrier overload', '11.11 · 16:00–24:00 Đơn vị vận chuyển quá tải'),
    text: tx(
      'Carriers are overloaded: more late deliveries, and COD refusals rise by 5 points tonight. Last block of the sale.',
      'Đơn vị vận chuyển quá tải: giao trễ nhiều hơn, tỷ lệ từ chối nhận COD tăng 5 điểm tối nay. Ca cuối của đợt sale.',
    ),
  },
  5: {
    title: tx('+14 days · The bill arrives', '+14 ngày · Hóa đơn đến'),
    text: tx(
      'Returns and failed COD parcels come back, leftover stock waits in the warehouse. Clear it, handle refunds – and diagnose: which two cost lines hurt your profit most?',
      'Hàng hoàn và đơn COD thất bại quay về, hàng tồn nằm trong kho. Xả hàng, xử lý hoàn tiền – và chẩn đoán: hai khoản chi phí nào làm giảm lợi nhuận nhiều nhất?',
    ),
  },
};

export interface PdBlock {
  demand: number;
  orders: number;
  lostStockout: number;
  lostCod: number;
  viral: boolean;
  delivered: number;
  failedCod: number;
  late: number;
  tickets: number;
  unanswered: number;
}

export interface PdReport {
  round: number;
  decision: PdDecision;
  defaulted: boolean;
  block: PdBlock | null;
  stockLeft: number;
  incoming: number;
  revenue: number;
  costs: Record<PdCost, number>;
  cogs: number;
  profit: number;
  profitCum: number;
  rating: number;
  /** Round 5: your two biggest cost lines (the answer). */
  topCosts?: PdCost[];
  notes: T[];
}

export interface PdView {
  stock: number;
  incoming: number;
  rating: number;
  setup: { fulfil: PdFulfil; speed: PdSpeed; returns: PdReturns; fraud: PdFraud } | null;
  totals: Record<PdCost, number>;
  ordersTotal: number;
  revenueTotal: number;
  /** Units expected to come back as returns after the sale. */
  pendingReturns: number;
  profitCum: number;
}

export interface PdPub {
  orders: Record<string, number>;
  stockout: Record<string, boolean>;
  rating: Record<string, number>;
  discount: Record<string, number>;
  viral: string[];
}

export const PD_SCORE_PARTS: Record<string, T> = {
  profit: tx('Event profit (50)', 'Lợi nhuận đợt sale (50)'),
  rating: tx('Customer rating (20)', 'Điểm đánh giá (20)'),
  diagnosis: tx('Diagnosis of your own P&L (20)', 'Chẩn đoán lãi lỗ của chính mình (20)'),
  ops: tx('Stock discipline (10)', 'Kỷ luật tồn kho (10)'),
};

export const PD_BADGES: Record<string, T> = {
  doctor: tx('🩺 Diagnosed the P&L', '🩺 Chẩn đoán đúng lãi lỗ'),
  nostockout: tx('📦 Never ran out', '📦 Không hết hàng'),
  lean: tx('🧊 Little dead stock', '🧊 Ít hàng tồn'),
  stars: tx('⭐ 4.6★ or better', '⭐ Từ 4,6★ trở lên'),
  codsmart: tx('📞 COD priced right', '📞 COD có kiểm soát'),
  profit: tx('💰 Most profitable 11.11', '💰 11.11 lãi nhất'),
};

export const PD_DEBRIEF: [string, string][] = [
  ['Sales up, profit down: discounts, failed COD, returns, last-mile and overtime grow faster than revenue at peak. Read the cost lines, not the order count.', 'Doanh số tăng, lợi nhuận giảm: giảm giá, COD thất bại, hoàn hàng, chặng cuối và tăng ca tăng nhanh hơn doanh thu lúc cao điểm. Hãy đọc từng khoản chi phí, không chỉ số đơn.'],
  ['COD is a service with a price: confirmation calls and risk rules cut failed deliveries; turning COD off loses customers who do not yet trust you.', 'COD là một dịch vụ có giá: gọi xác nhận và quy tắc rủi ro giảm giao thất bại; tắt hẳn COD thì mất khách chưa đủ tin.'],
  ['Stock = forecast + safety stock. Too little and the viral moment becomes a stock-out crisis; too much becomes dead stock after the sale.', 'Tồn kho = dự báo + tồn kho an toàn. Quá ít thì khoảnh khắc viral thành khủng hoảng hết hàng; quá nhiều thì thành hàng tồn sau sale.'],
  ['The last mile is the most expensive leg, and capacity matters more than unit cost when volume spikes (own warehouse vs 3PL vs platform).', 'Chặng cuối là chặng đắt nhất, và năng lực xử lý quan trọng hơn đơn giá khi lượng đơn tăng vọt (kho tự vận hành, 3PL hay kho của sàn).'],
  ['Unanswered tickets and late parcels cost rating, and rating costs tomorrow’s sales. Growth itself can be a crisis (Coupang).', 'Phiếu hỗ trợ không được trả lời và giao trễ làm giảm điểm đánh giá, và điểm đánh giá làm mất doanh số ngày mai. Tăng trưởng nóng tự nó cũng là khủng hoảng (Coupang).'],
];
