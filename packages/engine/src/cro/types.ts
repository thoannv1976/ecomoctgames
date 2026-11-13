// Game 6 – CRO Battle (Chapter 6): public types and display content (browser-safe; true effects stay on the server).
import type { T } from '../types.js';
import { tx } from '../types.js';

export type CroChange = 'guest' | 'shipfee' | 'photos' | 'fields' | 'filters' | 'badges' | 'safari' | 'video' | 'carousel' | 'redesign' | 'urgency' | 'popup' | 'colour';
export const CRO_CHANGES: CroChange[] = ['guest', 'shipfee', 'photos', 'fields', 'filters', 'badges', 'safari', 'video', 'carousel', 'redesign', 'urgency', 'popup', 'colour'];
export type CroArchetype = 'hippo' | 'peeker' | 'tiny' | 'disciplined' | 'copycat' | 'cautious';
export type CroShare = 10 | 25 | 50;
export type CroWeeks = 1 | 2 | 4;
export const CRO_SHARES: CroShare[] = [10, 25, 50];
export const CRO_WEEKS: CroWeeks[] = [1, 2, 4];

export const CRO_ROUNDS = 5;
export const CRO_BASE_CR = 0.018;
export const CRO_WEEK_SESSIONS = 100_000;
export const CRO_SPRINT_WEEKS = 4;
export const CRO_MAX_TESTS = 2;
/** Contribution per order, million VND (AOV 400k × 25%). */
export const CRO_MARGIN = 0.1;

export const CRO_CHANGE_INFO: Record<CroChange, { name: T; page: T; idea: T }> = {
  guest: { name: tx('Guest checkout', 'Mua không cần tài khoản'), page: tx('Checkout', 'Thanh toán'), idea: tx('Let people pay without creating an account.', 'Cho khách thanh toán mà không phải tạo tài khoản.') },
  shipfee: { name: tx('Shipping fee shown early', 'Hiện phí giao hàng sớm'), page: tx('Product page + cart', 'Trang sản phẩm + giỏ'), idea: tx('Show the delivery fee and date on the product page, not at the last step.', 'Hiện phí và ngày giao ngay trên trang sản phẩm, không để đến bước cuối.') },
  photos: { name: tx('Reviews with customer photos', 'Đánh giá có ảnh khách hàng'), page: tx('Product page', 'Trang sản phẩm'), idea: tx('Put photo reviews right under the price.', 'Đưa đánh giá có ảnh ngay dưới giá.') },
  fields: { name: tx('Shorter checkout form (11 → 6 fields)', 'Form thanh toán ngắn (11 → 6 ô)'), page: tx('Checkout', 'Thanh toán'), idea: tx('Remove fields nobody needs; autofill the address.', 'Bỏ các ô không cần; tự điền địa chỉ.') },
  filters: { name: tx('Better category filters', 'Bộ lọc danh mục tốt hơn'), page: tx('Category page', 'Trang danh mục'), idea: tx('Filters by skin type, price and size, with result counts.', 'Lọc theo loại da, giá, dung tích, có hiện số kết quả.') },
  badges: { name: tx('Trust badges at payment', 'Huy hiệu tin cậy ở bước trả tiền'), page: tx('Checkout', 'Thanh toán'), idea: tx('Secure-payment and easy-return badges next to the Pay button.', 'Huy hiệu thanh toán an toàn và đổi trả dễ cạnh nút Trả tiền.') },
  safari: { name: tx('Fix: Pay button broken on iPhone Safari', 'Sửa lỗi: nút Trả tiền hỏng trên Safari iPhone'), page: tx('Checkout', 'Thanh toán'), idea: tx('Support tickets say the Pay button does nothing on iPhone Safari (≈ 6% of buyers).', 'Phiếu hỗ trợ báo nút Trả tiền không phản hồi trên Safari iPhone (≈ 6% người mua).') },
  video: { name: tx('Autoplay product video', 'Video sản phẩm tự phát'), page: tx('Product page', 'Trang sản phẩm'), idea: tx('A 30-second video starts playing when the page opens.', 'Video 30 giây tự chạy khi mở trang.') },
  carousel: { name: tx('Homepage carousel (5 banners)', 'Băng chuyền trang chủ (5 banner)'), page: tx('Homepage', 'Trang chủ'), idea: tx('Every department gets a rotating banner.', 'Phòng ban nào cũng có một banner xoay vòng.') },
  redesign: { name: tx('New brand look (full redesign)', 'Thiết kế lại toàn bộ giao diện'), page: tx('Whole site', 'Toàn trang'), idea: tx('The CEO loves the new colours and layout.', 'CEO rất thích màu sắc và bố cục mới.') },
  urgency: { name: tx('“Only 2 left!” countdown', 'Đồng hồ “Chỉ còn 2 sản phẩm!”'), page: tx('Product page', 'Trang sản phẩm'), idea: tx('Show a scarcity timer on every product, whatever the real stock.', 'Hiện đồng hồ khan hiếm trên mọi sản phẩm, bất kể tồn kho thật.') },
  popup: { name: tx('Email pop-up on entry', 'Pop-up xin email khi vào trang'), page: tx('Whole site', 'Toàn trang'), idea: tx('A pop-up asks for the email before showing the page – the CRM team wants leads.', 'Pop-up xin email trước khi xem trang – đội CRM cần danh sách.') },
  colour: { name: tx('Orange Buy button', 'Nút Mua màu cam'), page: tx('Product page', 'Trang sản phẩm'), idea: tx('Change the Buy button from green to orange.', 'Đổi nút Mua từ xanh lá sang cam.') },
};

export interface CroTestPlan {
  change: CroChange;
  share: CroShare;
  weeks: CroWeeks;
  /** Check every day and stop as soon as it looks significant. */
  peek: boolean;
}

export interface CroDecision {
  /** Changes live on the store this sprint (shipped). */
  ship: CroChange[];
  tests: CroTestPlan[];
}

export interface CroTestResult extends CroTestPlan {
  nA: number;
  nB: number;
  crA: number;
  crB: number;
  /** Relative lift of B over A. */
  lift: number;
  ciLow: number;
  ciHigh: number;
  p: number;
  /** Day the test stopped when peeking (else null). */
  stoppedDay: number | null;
  /** Peeking found “significant” and the change went live mid-sprint. */
  autoShipped: boolean;
}

export interface CroReport {
  round: number;
  decision: CroDecision;
  defaulted: boolean;
  tests: CroTestResult[];
  /** Dashboard conversion rate this sprint (noisy, includes novelty). */
  dashCr: number;
  sessions: number;
  orders: number;
  extraOrders: number;
  returnsCost: number;
  fine: number;
  profit: number;
  notes: T[];
}

export interface CroView {
  shipped: CroChange[];
  /** Revealed at the end only. */
  truth?: Record<string, { lift: number; novelty: number }>;
  trueCr?: number;
  dashCr?: number;
}

export interface CroPub {
  dash: Record<string, number>;
  tests: Record<string, number>;
  shipped: Record<string, number>;
  /** Only after the last sprint. */
  trueCr?: Record<string, number>;
}

export const CRO_ARCHETYPE_INFO: Record<CroArchetype, T> = {
  hippo: tx('HiPPO (boss’s opinion)', 'HiPPO (ý sếp)'),
  peeker: tx('Peeker', 'Hay xem trộm kết quả'),
  tiny: tx('Tiny samples', 'Mẫu nhỏ'),
  disciplined: tx('Disciplined tester', 'Thử nghiệm kỷ luật'),
  copycat: tx('Best-practice copier', 'Sao chép “best practice”'),
  cautious: tx('Cautious', 'Thận trọng'),
};

export const CRO_ROUND_INFO: Record<number, { title: T; text: T }> = {
  1: {
    title: tx('Sprint 1 · Baseline 1.8%', 'Sprint 1 · Xuất phát 1,8%'),
    text: tx(
      'Six identical cosmetics stores: 100,000 sessions a week, conversion rate 1.8%. Each 4-week sprint you may run up to two A/B tests and decide which changes are live. Only the TRUE conversion rate at the end counts – the dashboard is noisy.',
      'Sáu cửa hàng mỹ phẩm giống hệt nhau: 100.000 lượt truy cập mỗi tuần, tỷ lệ chuyển đổi 1,8%. Mỗi sprint 4 tuần được chạy tối đa hai thử nghiệm A/B và quyết định thay đổi nào được áp dụng. Chỉ tỷ lệ chuyển đổi THẬT lúc cuối mới tính – bảng điều khiển có nhiễu.',
    ),
  },
  2: {
    title: tx('Sprint 2 · The HiPPO speaks', 'Sprint 2 · Sếp lên tiếng'),
    text: tx(
      'The CEO saw a competitor’s new design and wants yours shipped this week. Ship it, test it, or push back with data?',
      'CEO thấy giao diện mới của đối thủ và muốn áp dụng ngay tuần này. Áp dụng, thử nghiệm, hay phản biện bằng dữ liệu?',
    ),
  },
  3: {
    title: tx('Sprint 3 · Payday traffic', 'Sprint 3 · Tuần nhận lương'),
    text: tx(
      'Traffic mix changes with payday. Tests shorter than a full week cycle can mislead.',
      'Cơ cấu khách thay đổi theo kỳ lương. Thử nghiệm ngắn hơn một chu kỳ tuần dễ cho kết quả sai.',
    ),
  },
  4: {
    title: tx('Sprint 4 · 11.11 mega sale', 'Sprint 4 · Siêu sale 11.11'),
    text: tx(
      'A big promotion brings unusual shoppers. Tests run this sprint are distorted: bigger swings that do not last. Many teams pause testing in peak sales.',
      'Đợt khuyến mãi lớn kéo đến khách khác thường. Thử nghiệm chạy trong sprint này bị méo: dao động lớn hơn và không bền. Nhiều đội tạm dừng thử nghiệm mùa cao điểm.',
    ),
  },
  5: {
    title: tx('Sprint 5 · Final call', 'Sprint 5 · Chốt cuối'),
    text: tx(
      'No new tests. Decide what stays live. A consumer-protection review checks every store for dark patterns. After this sprint the true conversion rates are revealed.',
      'Không thử nghiệm mới. Quyết định thay đổi nào giữ lại. Cơ quan bảo vệ người tiêu dùng rà soát mẫu giao diện lừa (dark pattern) ở mọi cửa hàng. Sau sprint này tỷ lệ chuyển đổi thật được công bố.',
    ),
  },
};

export const CRO_SCORE_PARTS: Record<string, T> = {
  cr: tx('True conversion rate at the end (50)', 'Tỷ lệ chuyển đổi thật lúc cuối (50)'),
  orders: tx('Extra orders over the game (20)', 'Đơn hàng tăng thêm cả trận (20)'),
  discipline: tx('Experiment discipline (30)', 'Kỷ luật thử nghiệm (30)'),
};

export const CRO_BADGES: Record<string, T> = {
  scientist: tx('🔬 Real winners only', '🔬 Chỉ áp dụng cái thắng thật'),
  noPeek: tx('🙈 Never peeked', '🙈 Không xem trộm'),
  fixer: tx('🛠️ Fixed the obvious bug without testing', '🛠️ Sửa lỗi hiển nhiên không cần thử'),
  ethical: tx('⚖️ No dark patterns', '⚖️ Không dùng dark pattern'),
  top: tx('🚀 Highest true conversion', '🚀 Chuyển đổi thật cao nhất'),
  power: tx('📏 Well-powered tests', '📏 Thử nghiệm đủ cỡ mẫu'),
};

export const CRO_DEBRIEF: [string, string][] = [
  ['Fix the sample size and duration before the test starts. Peeking and stopping at the first “significant” day produces false winners.', 'Chốt cỡ mẫu và thời gian trước khi chạy. Xem trộm và dừng ngay ngày đầu tiên “có ý nghĩa” sẽ sinh ra người thắng giả.'],
  ['Small samples cannot detect small effects (minimum detectable effect): a 2% lift needs far more traffic than a 9% lift.', 'Mẫu nhỏ không phát hiện được hiệu ứng nhỏ (hiệu ứng tối thiểu phát hiện được): tăng 2% cần nhiều traffic hơn hẳn tăng 9%.'],
  ['Novelty effects fade: one- or two-week tests flatter videos and redesigns. Run whole weekly cycles and avoid testing during big promotions.', 'Hiệu ứng mới lạ phai dần: thử 1–2 tuần làm video và giao diện mới trông tốt hơn thật. Chạy đủ chu kỳ tuần và tránh thử trong đợt khuyến mãi lớn.'],
  ['Do not test the obvious: a broken Pay button is fixed, not A/B-tested.', 'Đừng thử điều hiển nhiên: nút Trả tiền hỏng thì sửa, không A/B test.'],
  ['Most ideas do not win – that is the value of testing (Booking.com). Shipping on opinion (HiPPO) or copying “best practices” blindly costs real conversions.', 'Phần lớn ý tưởng không thắng – đó chính là giá trị của thử nghiệm (Booking.com). Áp dụng theo ý sếp (HiPPO) hoặc chép “best practice” mù quáng làm mất chuyển đổi thật.'],
  ['Some things must not be tested at all: fake scarcity lifts clicks but brings returns and legal risk.', 'Có những thứ không được thử: khan hiếm giả tăng lượt mua nhưng kéo theo hoàn hàng và rủi ro pháp lý.'],
];
