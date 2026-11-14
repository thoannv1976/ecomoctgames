// Game 1 – Wave Rider (Chapter 1): public types and display content (browser-safe).
// The fit matrix between business models and each wave's infrastructure stays hidden on the server.
import type { T } from '../types.js';
import { tx } from '../types.js';

export type WrModel = 'web' | 'seller' | 'social' | 'live' | 'app' | 'agent';
export const WR_MODELS: WrModel[] = ['web', 'seller', 'social', 'live', 'app', 'agent'];
export type WrLayer = 'connect' | 'device' | 'trust' | 'payment' | 'delivery' | 'data';
export const WR_LAYERS: WrLayer[] = ['connect', 'device', 'trust', 'payment', 'delivery', 'data'];
export type WrArchetype = 'trend' | 'web' | 'live' | 'balanced' | 'late' | 'reader';

export const WR_ROUNDS = 5;
/** Capital chips at the start; one chip ≈ VND 1 bn. */
export const WR_START_CHIPS = 10;
/** Chips added for a correct manager-numbers question. */
export const WR_BONUS_CHIPS = 2;
/** Scorecard points per correct question (5 questions). */
export const WR_QUIZ_POINT = 3;

export const WR_MODEL_INFO: Record<WrModel, { icon: string; name: T; needs: T; note: T }> = {
  web: {
    icon: '🖥️',
    name: tx('Own website', 'Website riêng'),
    needs: tx('Connection only', 'Chỉ cần kết nối'),
    note: tx('An electronic catalogue of your own. Works from the earliest wave, but you must bring your own traffic and your own trust.', 'Một cuốn catalogue điện tử của riêng mình. Chạy được từ làn sóng đầu, nhưng phải tự mang khách và tự tạo niềm tin.'),
  },
  seller: {
    icon: '🏬',
    name: tx('Marketplace seller', 'Bán trên sàn'),
    needs: tx('Trust, payment, delivery', 'Niềm tin, thanh toán, giao hàng'),
    note: tx('The marketplace lends you its ratings, escrow and couriers. Only works once those layers exist.', 'Sàn cho bạn mượn hệ thống đánh giá, bảo vệ giao dịch và đội giao hàng. Chỉ chạy khi các lớp đó đã có.'),
  },
  social: {
    icon: '💬',
    name: tx('Social selling', 'Bán qua mạng xã hội'),
    needs: tx('Devices, connection', 'Thiết bị, kết nối'),
    note: tx('Chat and feed do the selling. Needs people carrying a phone all day, not a bank account.', 'Bán bằng tin nhắn và bảng tin. Cần người dùng cầm điện thoại cả ngày, không cần tài khoản ngân hàng.'),
  },
  live: {
    icon: '📺',
    name: tx('Livestream', 'Livestream'),
    needs: tx('Smartphones, fast payment, fast delivery', 'Điện thoại thông minh, thanh toán nhanh, giao nhanh'),
    note: tx('Content creates demand on the spot – so the order must be payable and deliverable on the spot too.', 'Nội dung tạo nhu cầu ngay tại chỗ – nên đơn hàng cũng phải trả được và giao được ngay.'),
  },
  app: {
    icon: '📱',
    name: tx('D2C app', 'Ứng dụng D2C'),
    needs: tx('Smartphones, payment, data', 'Điện thoại thông minh, thanh toán, dữ liệu'),
    note: tx('You own the customer relationship and the data – expensive to build, and worthless without data to run it.', 'Bạn sở hữu quan hệ khách hàng và dữ liệu – tốn kém để làm, và vô dụng nếu không có dữ liệu để chạy.'),
  },
  agent: {
    icon: '🤖',
    name: tx('Agent-ready store', 'Cửa hàng sẵn sàng cho AI agent'),
    needs: tx('Data, machine-readable trust', 'Dữ liệu, niềm tin máy đọc được'),
    note: tx('Structured catalogue, machine-readable price and policy, an API. The buyer is software.', 'Danh mục có cấu trúc, giá và chính sách máy đọc được, có API. Người mua là một phần mềm.'),
  },
};

export const WR_ARCHETYPE_INFO: Record<WrArchetype, T> = {
  trend: tx('Trend chaser', 'Đoán theo mốt'),
  web: tx('Website loyalist', 'Ôm website'),
  live: tx('All-in on livestream', 'Tất tay livestream'),
  balanced: tx('Spreads evenly', 'Chia đều'),
  late: tx('One wave late', 'Đi muộn một nhịp'),
  reader: tx('Infrastructure reader', 'Đọc hạ tầng'),
};

export const WR_LAYER_INFO: Record<WrLayer, { icon: string; name: T }> = {
  connect: { icon: '🌐', name: tx('Connection', 'Kết nối') },
  device: { icon: '📱', name: tx('Devices', 'Thiết bị') },
  trust: { icon: '🛡️', name: tx('Trust', 'Niềm tin') },
  payment: { icon: '💳', name: tx('Payment', 'Thanh toán') },
  delivery: { icon: '🚚', name: tx('Delivery', 'Giao hàng') },
  data: { icon: '📊', name: tx('Data & AI', 'Dữ liệu & AI') },
};

export const WR_LEVEL_NAME: Record<number, T> = {
  0: tx('none', 'chưa có'),
  1: tx('early', 'sơ khai'),
  2: tx('working', 'dùng được'),
  3: tx('mature', 'hoàn thiện'),
};

/** The infrastructure of each wave, 0–3 per layer. Public: this is what players read. */
export const WR_INFRA: Record<number, Record<WrLayer, number>> = {
  1: { connect: 1, device: 1, trust: 0, payment: 0, delivery: 0, data: 0 },
  2: { connect: 2, device: 1, trust: 1, payment: 1, delivery: 1, data: 0 },
  3: { connect: 3, device: 2, trust: 2, payment: 2, delivery: 2, data: 1 },
  4: { connect: 3, device: 3, trust: 2, payment: 3, delivery: 3, data: 2 },
  5: { connect: 3, device: 3, trust: 3, payment: 3, delivery: 3, data: 3 },
};

export const WR_WAVE_INFO: Record<number, { title: T; text: T; next?: T }> = {
  1: {
    title: tx('Classifieds and forums', 'Rao vặt và diễn đàn'),
    text: tx(
      'Six founders start with 10 capital chips each. Deals rest on personal trust: the buyer meets the seller and pays in cash. No ratings, no escrow, no courier network – the bottleneck is the risk of fraud.',
      'Sáu nhà sáng lập, mỗi người 10 chip vốn. Giao dịch dựa hoàn toàn vào niềm tin cá nhân: người mua gặp người bán và trả tiền mặt. Chưa có đánh giá, chưa có bảo vệ giao dịch, chưa có mạng giao hàng – nút thắt là rủi ro bị lừa.',
    ),
    next: tx('Word from the market: payment gateways and group-buying sites are raising money. Ratings and refunds are coming.', 'Tin từ thị trường: các cổng thanh toán và trang mua theo nhóm đang gọi được vốn. Đánh giá và hoàn tiền sắp xuất hiện.'),
  },
  2: {
    title: tx('Group buying and the first platforms', 'Mua theo nhóm và sàn thế hệ đầu'),
    text: tx(
      'Deep discounts teach people to buy online. Ratings, refunds and COD appear, but product quality and delivery are still poor. Smartphones are not yet in every pocket.',
      'Giảm giá sâu dạy người ta quen mua hàng trên mạng. Đánh giá, hoàn tiền và COD xuất hiện, nhưng chất lượng hàng và giao hàng còn kém. Điện thoại thông minh chưa ở trong mọi túi áo.',
    ),
    next: tx('Word from the market: cheap smartphones and e-wallets are spreading fast; the marketplaces are opening their courier networks.', 'Tin từ thị trường: điện thoại thông minh giá rẻ và ví điện tử lan rất nhanh; các sàn đang mở mạng giao hàng của mình.'),
  },
  3: {
    title: tx('Modern marketplaces and e-wallets', 'Sàn hiện đại và ví điện tử'),
    text: tx(
      'Payment, ratings, refunds and fast delivery all work. Buying online is a habit. Everybody has a marketplace storefront now – so the storefront is no longer an advantage.',
      'Thanh toán, đánh giá, hoàn tiền và giao nhanh đều chạy tốt. Mua hàng trên mạng đã thành thói quen. Bây giờ ai cũng có gian hàng trên sàn – nên gian hàng không còn là lợi thế.',
    ),
    next: tx('Word from the market: short video is eating people’s evenings, and creators are starting to sell live.', 'Tin từ thị trường: video ngắn đang chiếm hết buổi tối của người ta, và các nhà sáng tạo bắt đầu bán hàng trực tiếp.'),
  },
  4: {
    title: tx('Content and livestream', 'Nội dung và livestream'),
    text: tx(
      'Content creates the demand. A small seller can reach millions without an advertising budget – if the order can be paid and delivered while the excitement lasts.',
      'Nội dung tạo ra nhu cầu. Một người bán nhỏ có thể tiếp cận hàng triệu người mà không cần ngân sách quảng cáo – nếu đơn hàng trả được và giao được khi cảm xúc còn nóng.',
    ),
    next: tx('Word from the market: the e-commerce law takes effect, and the first AI buyer agents are placing real orders.', 'Tin từ thị trường: luật thương mại điện tử có hiệu lực, và những AI agent mua hộ đầu tiên đã đặt đơn thật.'),
  },
  5: {
    title: tx('Data, law and AI', 'Dữ liệu, pháp lý và AI'),
    text: tx(
      'The legal framework is in force and competition has moved from price to experience, data and automation. A growing share of buyers send an AI agent to shop for them. Last wave: capital at the end is what counts.',
      'Khung pháp lý đã có hiệu lực và cạnh tranh chuyển từ giá sang trải nghiệm, dữ liệu và tự động hóa. Ngày càng nhiều người mua cử AI agent đi mua hộ. Làn sóng cuối: vốn cuối game mới là điều được tính.',
    ),
  },
};

export interface WrDecision {
  /** Chips placed on each model this wave; the rest stays as cash. */
  chips: Record<WrModel, number>;
  /** Index of the chosen answer to this wave's question, or null. */
  answer: number | null;
}

export interface WrQuestion {
  /** Stable id of the template. */
  id: string;
  prompt: T;
  options: T[];
}

export interface WrModelResult {
  /** Chips you put in. */
  chips: number;
  /** What one chip came back as. */
  mult: number;
  /** Chips in this model from all six founders. */
  crowd: number;
  /** Your head start from entering early. */
  earlyBonus: number;
}

export interface WrReport {
  round: number;
  decision: WrDecision;
  defaulted: boolean;
  wave: number;
  models: Record<WrModel, WrModelResult>;
  cash: number;
  chipsBefore: number;
  chipsAfter: number;
  answerRight: boolean | null;
  correct: number | null;
  explain: T | null;
  notes: T[];
}

export interface WrView {
  capital: number;
  chips: number;
  /** Learning curve per model from earlier waves. */
  experience: Record<WrModel, number>;
  right: number;
  question: WrQuestion | null;
}

/** Public data after each wave: everyone can see where the money went. */
export interface WrPub {
  capital: Record<string, number>;
  /** Chips the whole market placed on each model last wave. */
  crowd: Record<WrModel, number>;
  /** The best-returning model last wave. */
  best: WrModel | null;
}

export const WR_SCORE_PARTS: Record<string, T> = {
  capital: tx('Capital at the end (60)', 'Vốn cuối game (60)'),
  timing: tx('Riding the wave early (25)', 'Đón sóng đúng nhịp (25)'),
  quiz: tx('Reading the numbers (15)', 'Đọc số liệu (15)'),
};

export const WR_BADGES: Record<string, T> = {
  surfer: tx('🌊 Caught a wave early', '🌊 Đón sóng sớm'),
  grower: tx('📈 Tripled the capital', '📈 Gấp ba vốn'),
  contrarian: tx('🧭 Went where the crowd was not', '🧭 Đi nơi không ai đi'),
  analyst: tx('🧮 Every question right', '🧮 Đúng tất cả câu hỏi'),
  survivor: tx('🧯 Never lost a wave', '🧯 Không lỗ làn sóng nào'),
  leader: tx('👑 Largest capital', '👑 Vốn lớn nhất'),
};

export const WR_DEBRIEF: [string, string][] = [
  ['Infrastructure decides which business models are possible: payment and delivery shape the market, not ambition.', 'Hạ tầng quyết định mô hình nào khả thi: thanh toán và giao hàng định hình thị trường, không phải tham vọng.'],
  ['No wave erases the previous one – each is layered on top, so the old models keep earning, just less.', 'Không làn sóng nào xóa làn sóng trước – các lớp xếp lên nhau, nên mô hình cũ vẫn kiếm được, chỉ là ít hơn.'],
  ['Each wave gives a temporary advantage to whoever catches it earliest, and that advantage erodes once everybody has the capability.', 'Mỗi làn sóng cho lợi thế tạm thời cho ai đón sớm nhất, và lợi thế đó mất dần khi năng lực đó thành phổ thông.'],
  ['Two steps early is as expensive as one step late: the infrastructure the model needs simply is not there yet.', 'Đi sớm hai bước tốn kém như đi muộn một bước: hạ tầng mà mô hình đó cần đơn giản là chưa có.'],
  ['Crowding eats the return: when all six founders pile into last wave’s winner, they get their money back and little else.', 'Đông người thì hết lãi: khi cả sáu nhà sáng lập đổ vào mô hình thắng của làn sóng trước, họ chỉ lấy lại vốn.'],
  ['By 2026, advantage no longer comes from using AI – everyone can – but from what is hard to copy: your own data, customers, brand and speed of learning.', 'Đến 2026, lợi thế không còn đến từ việc dùng AI – ai cũng dùng được – mà từ những gì khó bắt chước: dữ liệu riêng, khách hàng, thương hiệu và tốc độ học.'],
];
