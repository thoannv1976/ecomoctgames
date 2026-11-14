// Game 11 – Border Run (Chapter 11): public types and display content (browser-safe).
// The landed-cost table, the duty rates and the de minimis timetable are all public – a manager
// is supposed to ask about them. What each market really expects of a seller, how fast someone
// files your trademark there, and the true probability and penalty of every shortcut stay on the server.
import type { T } from '../types.js';
import { tx } from '../types.js';

/** The four destinations. */
export type BrMarket = 'us' | 'eu' | 'jp' | 'sg';
export const BR_MARKETS: BrMarket[] = ['us', 'eu', 'jp', 'sg'];

/** Mode of entry, from the one that needs the least capital to the one that needs the most. */
export type BrMode = 'none' | 'dist' | 'market' | 'own' | 'local';
export const BR_MODES: BrMode[] = ['none', 'dist', 'market', 'own', 'local'];
export const BR_MODE_RANK: Record<BrMode, number> = { none: 0, dist: 1, market: 2, own: 3, local: 4 };
/** Team-quarters to step up INTO each rank: you may climb the ladder, never walk back down it. */
export const BR_MODE_STEP = [0, 1, 2, 2, 2];

/** The trust stack, which fails at its lowest missing layer. */
export type BrLayer = 'identity' | 'product' | 'content' | 'delivery' | 'remedy' | 'data';
export const BR_LAYERS: BrLayer[] = ['identity', 'product', 'content', 'delivery', 'remedy', 'data'];
export const BR_MAX_LEVEL = 3;
/** Team-quarters to reach level 1, 2 and 3 of a layer. */
export const BR_LAYER_COST = [1, 2, 3];
/** Running cost per quarter of holding a layer at level 0–3, VND m. */
export const BR_LAYER_OPEX = [0, 8, 20, 42];

/** Who pays the duty, and up to what point. */
export type BrIncoterm = 'dap' | 'ddp';
export const BR_INCOTERMS: BrIncoterm[] = ['dap', 'ddp'];

/** How a foreign listing is written. */
export type BrLocalise = 'ai' | 'review' | 'approve';
export const BR_LOCALISES: BrLocalise[] = ['ai', 'review', 'approve'];

/** What happens to a cross-border return. */
export type BrReturns = 'refund' | 'collect' | 'reverse' | 'reduce';
export const BR_RETURNS: BrReturns[] = ['refund', 'collect', 'reverse', 'reduce'];

/** The temptation cards: each lifts something now and carries a probability you have not been told. */
export type BrShortcut = 'reviews' | 'countdown' | 'preticked' | 'hidden' | 'undervalue';
export const BR_SHORTCUTS: BrShortcut[] = ['reviews', 'countdown', 'preticked', 'hidden', 'undervalue'];
/** At most this many cards in one quarter. */
export const BR_MAX_SHORTCUTS = 2;

export type BrArchetype = 'duty' | 'shortcut' | 'fortress' | 'spread' | 'handoff' | 'reader';

export const BR_ROUNDS = 5;
/** Team-quarters available each quarter. */
export const BR_POINTS = 9;
/** Team-quarters to file the trademark in one destination. */
export const BR_FILE_COST = 1;
export const BR_LOCALISE_COST: Record<BrLocalise, number> = { ai: 0, review: 1, approve: 2 };
export const BR_RETURNS_COST: Record<BrReturns, number> = { refund: 0, collect: 1, reverse: 1, reduce: 2 };
/** Cumulative profit (VND bn) that scores the full 50 points. */
export const BR_PROFIT_TARGET = 3.2;
/** Cumulative revenue (VND m) in a market above which a squatter starts to notice your brand. */
export const BR_SQUAT_FROM = 600;
/** Strikes on the platform account: at 2 the marketplace seats are frozen, at 3 they are closed. */
export const BR_STRIKE_FREEZE = 2;
export const BR_STRIKE_CLOSE = 3;

/** The chapter's weighted market score. Weights are published so the arithmetic can be checked. */
export type BrDim = 'potential' | 'fit' | 'compliance' | 'competition' | 'logistics' | 'access' | 'margin' | 'brand';
export const BR_DIMS: BrDim[] = ['potential', 'fit', 'compliance', 'competition', 'logistics', 'access', 'margin', 'brand'];
export const BR_WEIGHTS: Record<BrDim, number> = {
  potential: 0.2,
  fit: 0.15,
  compliance: 0.15,
  competition: 0.1,
  logistics: 0.1,
  access: 0.1,
  margin: 0.1,
  brand: 0.1,
};
export const BR_DIM_INFO: Record<BrDim, { name: T; note: T }> = {
  potential: { name: tx('Market potential', 'Tiềm năng thị trường'), note: tx('How much of this category is bought online there.', 'Mức mua online của nhóm hàng này ở đó.') },
  fit: { name: tx('Customer fit', 'Mức phù hợp khách hàng'), note: tx('Does the foreign buyer actually want what you make?', 'Khách nước đó có thật sự muốn thứ bạn làm?') },
  compliance: { name: tx('Compliance (higher = easier)', 'Tuân thủ (cao = dễ hơn)'), note: tx('Certification, labelling, restricted ingredients.', 'Chứng nhận, nhãn mác, thành phần bị hạn chế.') },
  competition: { name: tx('Competition (higher = easier)', 'Cạnh tranh (cao = dễ hơn)'), note: tx('How crowded the shelf already is.', 'Kệ hàng ở đó đã chật đến đâu.') },
  logistics: { name: tx('Logistics', 'Hậu cần'), note: tx('Freight, transit time and clearance.', 'Phí vận chuyển, thời gian và thông quan.') },
  access: { name: tx('Marketplace access', 'Tiếp cận sàn'), note: tx('How easily a Vietnamese seller can get a seat.', 'Người bán Việt vào được sàn dễ đến đâu.') },
  margin: { name: tx('Margin potential', 'Tiềm năng lợi nhuận'), note: tx('What the destination price will bear.', 'Giá ở nước đến chịu được đến đâu.') },
  brand: { name: tx('Brand opportunity', 'Cơ hội thương hiệu'), note: tx('Room to build an own brand rather than supply someone else’s.', 'Chỗ để xây thương hiệu riêng thay vì gia công cho người khác.') },
};

/** Published landed-cost figures for one order, VND m unless noted. */
export interface BrEcon {
  /** Orders the destination could place with Vietnamese sellers in a quarter. */
  pool: number;
  /** Average order value. */
  aov: number;
  /** International freight per parcel; a bulk shipment into local stock costs BR_BULK_FREIGHT of this. */
  freight: number;
  /** Duty rate on the customs value. */
  duty: number;
  /** Flat duty per item regardless of value (the EU's €3 since July 2026). */
  flat: number;
  /** Courier clearance and handling on a low-value parcel, and on a parcel that is assessed for duty. */
  clearLight: number;
  clearFull: number;
  /** Value below which duty is not collected; 0 = no exemption at all. */
  deMinimis: number;
}

export const BR_MARKET_INFO: Record<
  BrMarket,
  { icon: string; name: T; who: T; scores: Record<BrDim, number>; econ: BrEcon; policy: T }
> = {
  us: {
    icon: '🇺🇸',
    name: tx('United States', 'Hoa Kỳ'),
    who: tx('The biggest pool and the best fit for a named-origin Vietnamese product – and the strictest labelling.', 'Lượng khách lớn nhất và phù hợp nhất với hàng Việt có xuất xứ rõ – và quy định nhãn mác ngặt nhất.'),
    scores: { potential: 5, fit: 5, compliance: 2, competition: 2, logistics: 3, access: 5, margin: 4, brand: 5 },
    econ: { pool: 17_000, aov: 1.05, freight: 0.18, duty: 0.12, flat: 0, clearLight: 0.04, clearFull: 0.04, deMinimis: 0 },
    policy: tx('Duty-free de minimis suspended for all countries since August 2025: every parcel is assessed.', 'Đã bỏ miễn thuế hàng giá trị thấp cho mọi nước từ tháng 8/2025: mọi kiện đều bị tính thuế.'),
  },
  eu: {
    icon: '🇪🇺',
    name: tx('European Union', 'Liên minh châu Âu'),
    who: tx('Large and wealthy, with the heaviest duties on content, consumer information and personal data.', 'Lớn và giàu, nhưng nặng nhất về nội dung quảng cáo, thông tin cho người tiêu dùng và dữ liệu cá nhân.'),
    scores: { potential: 4, fit: 3, compliance: 2, competition: 3, logistics: 3, access: 4, margin: 4, brand: 4 },
    econ: { pool: 13_000, aov: 0.95, freight: 0.16, duty: 0.08, flat: 0.085, clearLight: 0.035, clearFull: 0.035, deMinimis: 0 },
    policy: tx('A flat €3 duty on every small parcel since July 2026, on top of the duty rate.', 'Thu thuế khoán 3 euro mỗi kiện nhỏ từ tháng 7/2026, cộng thêm vào thuế suất.'),
  },
  jp: {
    icon: '🇯🇵',
    name: tx('Japan', 'Nhật Bản'),
    who: tx('Quality-sensitive buyers, cheap fast freight, and small parcels still arrive duty-free.', 'Khách coi trọng chất lượng, vận chuyển rẻ và nhanh, kiện nhỏ vẫn vào miễn thuế.'),
    scores: { potential: 3, fit: 4, compliance: 3, competition: 4, logistics: 4, access: 3, margin: 4, brand: 3 },
    econ: { pool: 10_000, aov: 0.9, freight: 0.11, duty: 0.1, flat: 0, clearLight: 0.03, clearFull: 0.09, deMinimis: 1.6 },
    policy: tx('Parcels below the low-value threshold still enter duty-free – a concession, not an economic law.', 'Kiện dưới ngưỡng giá trị thấp vẫn vào miễn thuế – đó là một nhượng bộ chính sách, không phải quy luật kinh tế.'),
  },
  sg: {
    icon: '🇸🇬',
    name: tx('Singapore', 'Singapore'),
    who: tx('Small but easy: light compliance, short freight, low duty. A sensible first step, with a low ceiling.', 'Nhỏ nhưng dễ: tuân thủ nhẹ, vận chuyển ngắn, thuế thấp. Bước đầu hợp lý, nhưng trần thấp.'),
    scores: { potential: 2, fit: 4, compliance: 4, competition: 4, logistics: 5, access: 4, margin: 3, brand: 3 },
    econ: { pool: 4600, aov: 0.85, freight: 0.07, duty: 0.04, flat: 0, clearLight: 0.02, clearFull: 0.06, deMinimis: 1.4 },
    policy: tx('The low-value exemption still applies and no review has been announced.', 'Ngưỡng miễn thuế hàng giá trị thấp vẫn áp dụng và chưa có thông báo xem xét lại.'),
  },
};

/** A bulk shipment into local stock pays this share of the per-parcel freight, per unit. */
export const BR_BULK_FREIGHT = 0.55;
/** Clearance per unit on a bulk shipment: one declaration for the whole container. */
export const BR_BULK_CLEAR = 0.005;

// ── the published cost base: every figure a manager is supposed to ask about before setting a price ──
/** Cost of goods as a share of the destination retail price. */
export const BR_COGS = 0.25;
/** What an importer pays you, as a share of the destination retail price. */
export const BR_WHOLESALE = 0.38;
/** Platform and payment fees, as a share of the price. */
export const BR_FEE: Record<BrMode, number> = { none: 0, dist: 0, market: 0.17, own: 0.09, local: 0.2 };
/** The traffic you have to buy, as a share of the price. */
export const BR_MKT: Record<BrMode, number> = { none: 0, dist: 0, market: 0.08, own: 0.17, local: 0.12 };
/** Return rate, and what one return costs as a share of the price. */
export const BR_RET_RATE: Record<BrReturns, number> = { refund: 0.12, collect: 0.09, reverse: 0.09, reduce: 0.055 };
export const BR_RET_LOSS: Record<BrReturns, number> = { refund: 0.75, collect: 0.45, reverse: 0.9, reduce: 0.7 };
/** Share of parcels refused at the door when the courier asks the buyer for duty there. */
export const BR_REFUSE_DAP = 0.18;
export const BR_REFUSE_HIDDEN = 0.04;
/** The sticker price under Delivered At Place, as a share of the all-inclusive price. */
export const BR_DAP_STICKER = 0.93;
export const BR_PRETICKED_AOV = 0.09;
export const BR_UNDERVALUE = 0.45;

/** Every line of the landed cost of one order, VND m. The seventh line is the one people leave out. */
export interface BrLanded {
  price: number;
  cogs: number;
  freight: number;
  fees: number;
  marketing: number;
  duty: number;
  clearance: number;
  returns: number;
  /** Contribution per delivered order. */
  unit: number;
  /** Share of parcels refused at the door, and what one refusal costs. */
  refuseRate: number;
  refuseCost: number;
  dutiable: boolean;
}

/** The same arithmetic the server uses to settle a quarter, so the calculator on screen is the real one. */
export function brLanded(
  m: BrMarket,
  mode: BrMode,
  round: number,
  o: { incoterm: BrIncoterm; returns: BrReturns; preticked?: boolean; undervalue?: boolean; hidden?: boolean },
): BrLanded {
  const e = BR_MARKET_INFO[m].econ;
  const cogs = e.aov * BR_COGS;
  if (mode === 'dist') {
    const price = e.aov * BR_WHOLESALE;
    const freight = e.freight * 0.25;
    return { price, cogs, freight, fees: 0, marketing: 0, duty: 0, clearance: 0, returns: 0, unit: price - cogs - freight, refuseRate: 0, refuseCost: 0, dutiable: false };
  }
  const bulk = mode === 'local';
  const exempt = brExempt(m, round) && !bulk;
  // Stock already inside the destination is delivered domestically: Incoterms no longer reach the buyer.
  const price = e.aov * (!bulk && o.incoterm === 'dap' ? BR_DAP_STICKER : 1) + (o.preticked ? e.aov * BR_PRETICKED_AOV : 0);
  const freight = bulk ? e.freight * BR_BULK_FREIGHT : e.freight;
  const fees = price * BR_FEE[mode];
  const marketing = price * BR_MKT[mode];
  const duty = exempt ? 0 : e.aov * (o.undervalue ? BR_UNDERVALUE : 1) * e.duty + e.flat;
  const clearance = bulk ? BR_BULK_CLEAR : exempt ? e.clearLight : e.clearFull;
  const rate = BR_RET_RATE[o.returns] + (o.hidden ? 0.03 : 0);
  const returns = rate * (price * BR_RET_LOSS[o.returns] + (o.returns === 'reverse' ? e.freight : 0));
  const refuseRate = (!bulk && o.incoterm === 'dap' && !exempt ? BR_REFUSE_DAP : 0) + (o.hidden ? BR_REFUSE_HIDDEN : 0);
  return {
    price,
    cogs,
    freight,
    fees,
    marketing,
    duty,
    clearance,
    returns,
    unit: price - cogs - freight - fees - marketing - duty - clearance - returns,
    refuseRate,
    refuseCost: cogs + freight * 2 + clearance,
    dutiable: !exempt,
  };
}

/** The quarter from which a market's low-value exemption no longer applies. Published in advance. */
export const BR_DEMINIMIS_ENDS: Partial<Record<BrMarket, number>> = { jp: 4 };
/** Does a single parcel into this market still escape duty in this quarter? */
export const brExempt = (m: BrMarket, round: number): boolean => {
  const e = BR_MARKET_INFO[m].econ;
  if (e.deMinimis <= 0) return false;
  const ends = BR_DEMINIMIS_ENDS[m];
  if (ends !== undefined && round >= ends) return false;
  return e.aov < e.deMinimis;
};

export const BR_MODE_INFO: Record<BrMode, { icon: string; name: T; capital: T; note: T; opex: number }> = {
  none: { icon: '⬜', name: tx('Not selling there', 'Chưa bán ở đó'), capital: tx('–', '–'), note: tx('No cost, no customers.', 'Không tốn gì, cũng không có khách.'), opex: 0 },
  dist: {
    icon: '🤝',
    name: tx('Through a distributor', 'Qua nhà phân phối'),
    capital: tx('almost no capital', 'gần như không cần vốn'),
    note: tx('An importer buys from you at wholesale and carries the compliance. You lose the customer and keep the thinnest margin.', 'Nhà nhập khẩu mua buôn của bạn và gánh phần tuân thủ. Bạn mất khách và giữ phần lợi nhuận mỏng nhất.'),
    opex: 8,
  },
  market: {
    icon: '🏬',
    name: tx('On a global marketplace', 'Trên sàn toàn cầu'),
    capital: tx('little capital, fast', 'ít vốn, nhanh'),
    note: tx('The platform rents you traffic, payment, logistics and the trust buyers already have in it. What is rented can be withdrawn.', 'Sàn cho bạn thuê lưu lượng, thanh toán, vận chuyển và niềm tin khách đã có với sàn. Thứ đi thuê thì có thể bị lấy lại.'),
    opex: 40,
  },
  own: {
    icon: '🌐',
    name: tx('Your own website', 'Website của chính bạn'),
    capital: tx('medium capital, slow', 'vốn trung bình, chậm'),
    note: tx('You own the data and the customer, and you carry every layer of compliance yourself. Thick margin only if you can buy traffic cheaply.', 'Bạn sở hữu dữ liệu và khách hàng, và tự gánh mọi lớp tuân thủ. Lợi nhuận dày chỉ khi mua được lưu lượng với giá thấp.'),
    opex: 95,
  },
  local: {
    icon: '📦',
    name: tx('Stock held in the destination', 'Giữ hàng tại nước đến'),
    capital: tx('high capital', 'vốn lớn'),
    note: tx('Goods move ahead in bulk: one declaration, cheap per-unit freight, delivery in two days. Dead stock abroad costs far more than dead stock at home.', 'Hàng đi trước theo lô: một lần khai báo, phí vận chuyển mỗi đơn vị rẻ, giao trong hai ngày. Hàng tồn ở nước ngoài đắt hơn hàng tồn ở nhà rất nhiều.'),
    opex: 190,
  },
};

export const BR_LAYER_INFO: Record<BrLayer, { icon: string; name: T; question: T; why: T; levels: [T, T, T] }> = {
  identity: {
    icon: '🪪',
    name: tx('Seller identity', 'Danh tính người bán'),
    question: tx('Is the seller real?', 'Người bán có thật không?'),
    why: tx('The cheapest layer to fix and the one the whole stack sits on: brilliant reviews cannot help if the buyer doubts you exist.', 'Lớp rẻ nhất để làm và là lớp đỡ cả chồng niềm tin: đánh giá hay đến đâu cũng vô dụng nếu khách còn nghi bạn có tồn tại hay không.'),
    levels: [
      tx('A shop name and an email address', 'Một tên cửa hàng và một địa chỉ email'),
      tx('Real address, registration number, workshop photos', 'Địa chỉ thật, số đăng ký kinh doanh, ảnh xưởng'),
      tx('Platform-verified seller with legal and tax identity on file', 'Người bán đã được sàn xác thực, có hồ sơ pháp lý và mã số thuế'),
    ],
  },
  product: {
    icon: '🧾',
    name: tx('Product compliance', 'Tuân thủ sản phẩm'),
    question: tx('Is it allowed to be sold here, and is it real?', 'Hàng này có được bán ở đây không, và có thật không?'),
    why: tx('Certification, restricted ingredients, safety and labelling. Cheapest to ask first and most expensive to discover late.', 'Chứng nhận, thành phần bị hạn chế, an toàn và nhãn mác. Hỏi trước thì rẻ nhất, phát hiện muộn thì đắt nhất.'),
    levels: [
      tx('The domestic label, translated', 'Nhãn trong nước, dịch sang tiếng nước đó'),
      tx('Destination labelling and the certificates it asks for', 'Nhãn theo nước đến và các chứng nhận nước đó yêu cầu'),
      tx('Full certification file with batch records, producible in a day', 'Hồ sơ chứng nhận đầy đủ kèm hồ sơ lô, xuất được trong một ngày'),
    ],
  },
  content: {
    icon: '📝',
    name: tx('Content and claims', 'Nội dung và lời quảng cáo'),
    question: tx('Is every claim on the page true and evidenced?', 'Mọi lời trên trang có đúng và có bằng chứng không?'),
    why: tx('Localisation is not translation, and an unsupported claim is a legal exposure, not a style problem.', 'Bản địa hóa không phải là dịch, và một lời quảng cáo không có bằng chứng là rủi ro pháp lý, không phải lỗi văn phong.'),
    levels: [
      tx('Listings as written, claims unchecked', 'Bài bán hàng để nguyên, lời quảng cáo chưa kiểm'),
      tx('Claims substantiated and the file kept', 'Mỗi lời quảng cáo có bằng chứng và được lưu hồ sơ'),
      tx('Local review, compliance sign-off and archived versions', 'Người bản địa soát, bộ phận tuân thủ phê duyệt, lưu các bản đã công bố'),
    ],
  },
  delivery: {
    icon: '🚚',
    name: tx('Delivery promise', 'Cam kết giao hàng'),
    question: tx('When does it arrive, and will I be charged more at the door?', 'Khi nào hàng tới, và ra cửa có bị thu thêm không?'),
    why: tx('A date range, tracking and an all-inclusive price. The buyer sees only the last few seconds of a long chain.', 'Khoảng ngày giao, mã theo dõi và giá đã gồm mọi khoản. Khách chỉ thấy vài giây cuối của một chuỗi rất dài.'),
    levels: [
      tx('“Ships within 2–5 weeks”', '“Giao trong 2–5 tuần”'),
      tx('Date range and tracking on every parcel', 'Khoảng ngày giao và mã theo dõi cho từng kiện'),
      tx('Delivery promise with compensation if it is missed', 'Cam kết giao hàng kèm đền bù nếu trễ'),
    ],
  },
  remedy: {
    icon: '↩️',
    name: tx('Returns and remedy', 'Đổi trả và cách xử lý'),
    question: tx('If it is wrong, how do I get my money back?', 'Nếu hàng không đúng, tôi lấy lại tiền bằng cách nào?'),
    why: tx('The most expensive layer and the one a cross-border buyer has fewest remedies on.', 'Lớp đắt nhất, và cũng là lớp mà người mua xuyên biên giới có ít cách đòi quyền nhất.'),
    levels: [
      tx('Email us and we will see', 'Gửi email rồi tính sau'),
      tx('A written window, conditions and refund timing', 'Thời hạn, điều kiện và thời gian hoàn tiền ghi rõ'),
      tx('A local returns address and a named complaints owner', 'Địa chỉ nhận hàng trả tại nước đó và một người chịu trách nhiệm khiếu nại có tên'),
    ],
  },
  data: {
    icon: '🔐',
    name: tx('Personal data', 'Dữ liệu cá nhân'),
    question: tx('What happens to my address and my card?', 'Địa chỉ và thẻ của tôi được dùng làm gì?'),
    why: tx('Every piece of personal data you hold is also an obligation. If the purpose cannot be stated, the collection has failed.', 'Mỗi mẩu dữ liệu cá nhân bạn giữ cũng là một nghĩa vụ. Không nói được mục đích thì việc thu thập đã sai.'),
    levels: [
      tx('Collect everything the form will take', 'Thu mọi thứ mà cái form cho phép'),
      tx('A purpose map, a consent log, no card numbers stored', 'Bản đồ mục đích, nhật ký đồng ý, không lưu số thẻ'),
      tx('Minimised fields, processor contracts, erasure on request', 'Giảm tối thiểu số trường, hợp đồng với bên xử lý, xóa khi khách yêu cầu'),
    ],
  },
};

export const BR_INCOTERM_INFO: Record<BrIncoterm, { icon: string; name: T; note: T }> = {
  dap: {
    icon: '🧾',
    name: tx('Delivered At Place – the buyer pays duty on arrival', 'Giao tại nơi đến – khách trả thuế khi hàng tới'),
    note: tx('Duty is not in your costs, so the sticker price looks lower and more people click. Then the courier phones and demands payment before release.', 'Thuế không nằm trong chi phí của bạn, nên giá niêm yết trông thấp hơn và nhiều người bấm vào hơn. Rồi chuyển phát gọi điện đòi tiền mới giao hàng.'),
  },
  ddp: {
    icon: '✅',
    name: tx('Delivered Duty Paid – one all-inclusive price', 'Giao đã trả thuế – một giá gồm mọi khoản'),
    note: tx('You bear everything including duty and the customer pays nothing more. An honest higher price usually converts and retains better than a surprise at the door.', 'Bạn gánh hết kể cả thuế và khách không phải trả thêm gì. Một giá cao hơn nhưng trung thực thường chuyển đổi và giữ khách tốt hơn một cú bất ngờ ở cửa.'),
  },
};

export const BR_LOCALISE_INFO: Record<BrLocalise, { icon: string; name: T; note: T; opex: number }> = {
  ai: {
    icon: '🤖',
    name: tx('AI drafts and publishes', 'AI viết và đăng luôn'),
    note: tx('Fast and free. AI generated is not the same as compliant, and a tool that adds “clinically proven” creates legal exposure.', 'Nhanh và không tốn gì. AI viết ra không có nghĩa là đúng luật, và một công cụ tự thêm “đã được chứng minh trên lâm sàng” thì tạo ra rủi ro pháp lý.'),
    opex: 0,
  },
  review: {
    icon: '🧑‍🏫',
    name: tx('AI drafts, a local reviewer edits', 'AI viết, người bản địa soát lại'),
    note: tx('Units, imagery, instructions and expectations get fixed. Most unsupported claims are caught here.', 'Đơn vị đo, hình ảnh, hướng dẫn và kỳ vọng được sửa lại. Phần lớn lời quảng cáo thiếu bằng chứng bị bắt ở bước này.'),
    opex: 25,
  },
  approve: {
    icon: '🧑‍⚖️',
    name: tx('AI draft → local review → compliance check → human approval', 'AI viết → người bản địa soát → kiểm tra tuân thủ → người phê duyệt'),
    note: tx('The full workflow. Slower, and nobody approves their own work.', 'Quy trình đầy đủ. Chậm hơn, và không ai tự phê duyệt việc của chính mình.'),
    opex: 60,
  },
};

export const BR_RETURNS_INFO: Record<BrReturns, { icon: string; name: T; note: T; opex: number }> = {
  refund: {
    icon: '💸',
    name: tx('Refund without recovering the goods', 'Hoàn tiền, không lấy hàng về'),
    note: tx('Cheapest for low-value items. Applied mechanically it invites abuse, and the return rate climbs.', 'Rẻ nhất với hàng giá trị thấp. Làm một cách máy móc thì mời gọi lạm dụng, và tỷ lệ hoàn tăng dần.'),
    opex: 0,
  },
  collect: {
    icon: '🏤',
    name: tx('A collection point in the destination', 'Điểm nhận hàng trả tại nước đến'),
    note: tx('Consolidate returns locally with a partner, then resell, liquidate or donate. It moves the cost rather than removing it.', 'Gom hàng trả tại chỗ cùng một đối tác, rồi bán lại, thanh lý hoặc tặng. Nó dịch chuyển chi phí chứ không bỏ được chi phí.'),
    opex: 30,
  },
  reverse: {
    icon: '✈️',
    name: tx('Ship every return back to Vietnam', 'Chuyển mọi đơn hoàn về Việt Nam'),
    note: tx('Reverse freight often exceeds the item’s value and the goods must clear customs in reverse. Sensible only for high-value goods.', 'Phí vận chuyển ngược thường cao hơn giá trị món hàng và hàng còn phải thông quan theo chiều ngược. Chỉ hợp lý với hàng giá trị cao.'),
    opex: 18,
  },
  reduce: {
    icon: '📐',
    name: tx('Reduce returns at source', 'Giảm hoàn ngay từ đầu'),
    note: tx('Clear descriptions, conversion charts, real photos, video and advice before purchase. Only this one lowers the total cost instead of moving it.', 'Mô tả rõ, bảng quy đổi, ảnh thật, video và tư vấn trước khi mua. Chỉ cách này làm giảm tổng chi phí thay vì chuyển nó sang chỗ khác.'),
    opex: 22,
  },
};

export const BR_CARD_INFO: Record<BrShortcut, { icon: string; name: T; offer: T; truth: T }> = {
  reviews: {
    icon: '⭐',
    name: tx('Buy a first batch of reviews', 'Mua một đợt đánh giá đầu tiên'),
    offer: tx('No reviews means no buyers, which means no reviews. A seller offers 200 five-star reviews this week.', 'Không có đánh giá thì không có khách, không có khách thì không có đánh giá. Có người chào 200 đánh giá 5 sao trong tuần này.'),
    truth: tx('Marketplaces screen reviews at scale and the detection improves as your volume grows.', 'Các sàn sàng lọc đánh giá ở quy mô lớn, và càng bán nhiều thì càng dễ bị phát hiện.'),
  },
  countdown: {
    icon: '⏳',
    name: tx('A countdown that restarts itself', 'Đồng hồ đếm ngược tự khởi động lại'),
    offer: tx('“Only 1 left” and a timer on every listing. Scarcity converts.', '“Chỉ còn 1 sản phẩm” và một đồng hồ đếm ngược trên mọi bài bán. Khan hiếm thì bán được hàng.'),
    truth: tx('Scarcity is fine when stock really is low. A timer that restarts is false information, which is where persuasion becomes manipulation.', 'Khan hiếm là bình thường khi hàng thật sự còn ít. Một đồng hồ tự chạy lại là thông tin sai, và đó là chỗ thuyết phục trở thành thao túng.'),
  },
  preticked: {
    icon: '☑️',
    name: tx('Shipping insurance pre-ticked at the last step', 'Bảo hiểm vận chuyển tự đánh dấu ở bước cuối'),
    offer: tx('Add it by default at checkout. Almost nobody unticks it, and the average order value rises.', 'Mặc định thêm vào ở bước thanh toán. Gần như không ai bỏ dấu, và giá trị đơn trung bình tăng.'),
    truth: tx('Cross-selling is fine when the suggestion is unticked by default. The test is whether the opposite choice is just as easy.', 'Bán thêm là bình thường khi gợi ý để trống mặc định. Phép thử là: lựa chọn ngược lại có dễ như thế không.'),
  },
  hidden: {
    icon: '🫥',
    name: tx('Hide the fees until the last screen', 'Ẩn các khoản phí tới màn hình cuối'),
    offer: tx('Show a clean low price and reveal shipping, handling and duty at the end. More people reach checkout.', 'Hiện một giá thấp gọn gàng rồi đến cuối mới hiện phí ship, phí xử lý và thuế. Nhiều người vào tới bước thanh toán hơn.'),
    truth: tx('The total payable including every charge must be shown before the order button. Hidden fees also come back as refusals and returns.', 'Tổng số tiền phải trả, gồm mọi khoản, phải hiện trước nút đặt hàng. Phí ẩn còn quay lại dưới dạng khách từ chối nhận và đơn hoàn.'),
  },
  undervalue: {
    icon: '📉',
    name: tx('Declare a lower customs value', 'Khai giá trị hải quan thấp hơn'),
    offer: tx('Write a smaller number on the declaration and the duty bill falls by more than half.', 'Ghi một con số nhỏ hơn trên tờ khai và hóa đơn thuế giảm hơn một nửa.'),
    truth: tx('The customs value is the basis for duty. A wrong declaration brings back assessment, penalties or seizure – and it is assessed on everything you shipped, not on this quarter.', 'Giá trị hải quan là căn cứ tính thuế. Khai sai thì bị truy thu, bị phạt hoặc bị tịch thu – và truy thu trên toàn bộ hàng bạn đã gửi, không chỉ quý này.'),
  },
};

export const BR_ARCHETYPE_INFO: Record<BrArchetype, T> = {
  duty: tx('Chases the duty-free market', 'Chạy theo thị trường miễn thuế'),
  shortcut: tx('Takes every shortcut on offer', 'Nhận mọi lối tắt được chào'),
  fortress: tx('Over-builds one small market', 'Xây quá kỹ một thị trường nhỏ'),
  spread: tx('Everywhere at once', 'Vào khắp nơi một lúc'),
  handoff: tx('Sells through distributors', 'Bán qua nhà phân phối'),
  reader: tx('Reads the score and the policy', 'Đọc bảng điểm và đọc chính sách'),
};

export const BR_QUARTER_INFO: Record<number, { title: T; text: T }> = {
  1: {
    title: tx('Q1 2027 · Where, and how', 'Quý 1/2027 · Đi đâu, và đi bằng cách nào'),
    text: tx(
      'Six Vietnamese brands take one product abroad. Never choose a country only because it is big: the weighted score is published, and so is every line of the landed cost. Compliance comes early because it is cheapest to ask first.',
      'Sáu thương hiệu Việt đưa một sản phẩm ra nước ngoài. Đừng chọn một nước chỉ vì nó lớn: bảng điểm có trọng số đã công bố, và từng dòng chi phí đến tay khách cũng vậy. Phần tuân thủ đứng trước vì hỏi trước là rẻ nhất.',
    ),
  },
  2: {
    title: tx('Q2 2027 · The cross-border trust gap', 'Quý 2/2027 · Khoảng cách niềm tin xuyên biên giới'),
    text: tx(
      'Same product, same price, same page – and a lower conversion rate abroad, because the buyer can check less and has fewer remedies. The stack fails at its lowest missing layer, so fix identity and product first: cheap, and the biggest effect on a first purchase.',
      'Cùng sản phẩm, cùng giá, cùng trang – mà chuyển đổi ở nước ngoài vẫn thấp hơn, vì khách kiểm tra được ít hơn và có ít cách đòi quyền hơn. Chồng niềm tin vỡ ở lớp thiếu thấp nhất, nên hãy làm danh tính và sản phẩm trước: rẻ, và tác động mạnh nhất tới lần mua đầu.',
    ),
  },
  3: {
    title: tx('Q3 2027 · A model built on a concession', 'Quý 3/2027 · Một mô hình dựng trên một nhượng bộ'),
    text: tx(
      'Costs and advertising you can adjust. A threshold the state can change within weeks. Read the policy line on every market you are in and ask what external condition your model depends on.',
      'Chi phí và quảng cáo thì bạn điều chỉnh được. Một cái ngưỡng thì nhà nước đổi trong vài tuần. Hãy đọc dòng chính sách của mọi thị trường bạn đang bán và tự hỏi mô hình của mình đang dựa vào điều kiện bên ngoài nào.',
    ),
  },
  4: {
    title: tx('Q4 2027 · The threshold is gone', 'Quý 4/2027 · Ngưỡng miễn thuế đã mất'),
    text: tx(
      'Duty moves from zero to full and the clearance cost per parcel rises, so the model changes and not just the price. Individual air freight now loses to bulk shipping into stock held in the destination.',
      'Thuế từ không lên đủ và chi phí thông quan mỗi kiện tăng lên, nên mô hình đổi chứ không chỉ giá đổi. Gửi lẻ bằng đường không giờ thua gửi lô vào kho đặt tại nước đến.',
    ),
  },
  5: {
    title: tx('Q1 2028 · The licence to keep growing', 'Quý 1/2028 · Giấy phép để tiếp tục lớn'),
    text: tx(
      'Last quarter. At home one mistake costs a customer; across a border the same mistake can cost the right to sell at all. What survives is what you can produce evidence for.',
      'Quý cuối. Ở trong nước, một sai sót mất một khách; ra ngoài biên giới, cũng sai sót đó có thể mất luôn quyền được bán. Thứ còn lại là thứ bạn xuất được bằng chứng.',
    ),
  },
};

export interface BrDecision {
  /** Mode of entry per market. 'none' = not selling there; you may climb the ladder, never step back down. */
  mode: Record<BrMarket, BrMode>;
  /** Target level 0–3 for each trust layer; never below the level you already hold. */
  build: Record<BrLayer, number>;
  incoterm: BrIncoterm;
  localise: BrLocalise;
  /** Markets in which to file the trademark this quarter. */
  file: BrMarket[];
  returns: BrReturns;
  /** Temptation cards taken this quarter, at most BR_MAX_SHORTCUTS. */
  shortcuts: BrShortcut[];
}

export interface BrIncident {
  id: string;
  text: T;
  /** Cost in VND bn. */
  cost: number;
}

/** One market's result for one quarter. */
export interface BrLine {
  market: BrMarket;
  mode: BrMode;
  orders: number;
  /** Parcels the customer refused at the door because duty was demanded there. */
  refused: number;
  revenue: number;
  duty: number;
  /** Freight, fees, marketing, clearance and the cost of returns together. */
  chain: number;
  contribution: number;
  /** Was the parcel assessed for duty this quarter? */
  dutiable: boolean;
  blocked: boolean;
}

export interface BrReport {
  round: number;
  decision: BrDecision;
  defaulted: boolean;
  spent: number;
  build: Record<BrLayer, number>;
  /** 0–1: 60% the lowest layer, 40% the average, less any trust damage. */
  trust: number;
  trustMin: number;
  trustAvg: number;
  lines: BrLine[];
  orders: number;
  revenue: number;
  contribution: number;
  opex: number;
  /** What the shortcuts added to contribution this quarter, before any penalty. */
  shortcutGain: number;
  incidentCost: number;
  profit: number;
  incidents: BrIncident[];
  /** Cards that were caught this quarter. */
  caught: BrShortcut[];
  notes: T[];
}

/** Revealed only when the game is over: what each card really cost. */
export interface BrCardTruth {
  card: BrShortcut;
  taken: number;
  caught: number;
  /** The real per-quarter detection probability at your volume, 0–1. */
  chance: number;
  /** What it earned you, and what it cost you, VND bn. */
  gained: number;
  paid: number;
}

export interface BrView {
  build: Record<BrLayer, number>;
  mode: Record<BrMarket, BrMode>;
  filed: BrMarket[];
  /** Markets where somebody else now owns your brand name. */
  squatted: BrMarket[];
  /** Markets closed by the platform. */
  closed: BrMarket[];
  profit: number;
  revenue: number;
  trust: number;
  trustMin: number;
  scar: number;
  strikes: number;
  frozen: boolean;
  points: number;
  opexNext: number;
  round: number;
  /** Which markets are assessed for duty this quarter, and which are not. */
  dutiable: Record<BrMarket, boolean>;
  /** Published policy changes still ahead. */
  ahead: T[];
  /** Filled in on the final screen. */
  cards: BrCardTruth[];
}

export interface BrPub {
  profit: Record<string, number>;
  trust: Record<string, number>;
  /** How many of the six brands are selling in each market. */
  crowd: Record<BrMarket, number>;
  dutiable: Record<BrMarket, boolean>;
  round: number;
}

export const BR_SCORE_PARTS: Record<string, T> = {
  profit: tx('Cumulative profit (50)', 'Lợi nhuận cộng dồn (50)'),
  trust: tx('Trust index – its lowest layer counts most (30)', 'Chỉ số niềm tin – lớp thấp nhất tính nhiều nhất (30)'),
  licence: tx('Licence to keep selling (20)', 'Giấy phép để tiếp tục bán (20)'),
};

export const BR_BADGES: Record<string, T> = {
  honest: tx('🕊️ Never took a shortcut', '🕊️ Không nhận lối tắt nào'),
  filed: tx('®️ Filed the trademark in every market before building the channel', '®️ Đăng ký nhãn hiệu ở mọi thị trường trước khi xây kênh bán'),
  allin: tx('✅ Quoted one all-inclusive price all game', '✅ Suốt trận niêm yết một giá gồm mọi khoản'),
  solid: tx('🧱 No missing layer in the trust stack', '🧱 Chồng niềm tin không thiếu lớp nào'),
  foresight: tx('🔭 Moved the model before the threshold changed', '🔭 Đổi mô hình trước khi ngưỡng miễn thuế đổi'),
  clean: tx('📂 Finished with every market still open', '📂 Kết thúc mà mọi thị trường vẫn còn mở'),
  leader: tx('👑 Highest cumulative profit', '👑 Lợi nhuận cộng dồn cao nhất'),
};

export const BR_DEBRIEF: [string, string][] = [
  [
    'A marketplace lowers the barrier to exporting but not the obligation that comes with it. What is rented – traffic, trust, payment, logistics – can be withdrawn; what is carried – product, compliance, tax, brand and the customer – cannot be delegated.',
    'Sàn hạ thấp rào cản xuất khẩu nhưng không hạ nghĩa vụ đi kèm. Thứ đi thuê – lưu lượng, niềm tin, thanh toán, vận chuyển – có thể bị lấy lại; thứ mình gánh – sản phẩm, tuân thủ, thuế, thương hiệu và khách hàng – thì không giao cho ai được.',
  ],
  [
    'Price is not cash received. Count all seven lines – goods, freight, platform and payment fees, duty, import tax, clearance and returns – before calling an order profitable.',
    'Giá không phải là tiền về. Hãy đếm đủ bảy dòng – giá hàng, vận chuyển, phí sàn và phí thanh toán, thuế nhập khẩu, thuế giá trị gia tăng, thông quan và hàng hoàn – trước khi gọi một đơn là có lãi.',
  ],
  [
    'Under Delivered At Place the duty is not in your spreadsheet, so the plan looks better. Then the courier demands payment at the door, the parcel is refused, and a saving on paper becomes three losses: the goods, the freight and the customer.',
    'Với điều kiện giao tại nơi đến, thuế không nằm trong bảng tính của bạn nên kế hoạch trông đẹp hơn. Rồi chuyển phát đòi tiền ngay ở cửa, khách từ chối nhận, và một khoản tiết kiệm trên giấy thành ba cái mất: mất hàng, mất phí vận chuyển, mất khách.',
  ],
  [
    'A model built on a concession rents its advantage. Costs and advertising you can adjust; a de minimis threshold the state can change within weeks. Ask what external condition your model depends on.',
    'Một mô hình dựng trên một nhượng bộ là đi thuê lợi thế của mình. Chi phí và quảng cáo thì điều chỉnh được; còn ngưỡng miễn thuế hàng giá trị thấp thì nhà nước đổi trong vài tuần. Hãy tự hỏi mô hình của bạn dựa vào điều kiện bên ngoài nào.',
  ],
  [
    'Trust is a stack and it fails at its lowest missing layer, so report the minimum beside the average. A pleasant average can hide a two on returns, and the lowest score shows where to invest first.',
    'Niềm tin là một chồng lớp và nó vỡ ở lớp thiếu thấp nhất, nên hãy báo cả giá trị nhỏ nhất bên cạnh giá trị trung bình. Một mức trung bình dễ chịu có thể che một điểm 2 ở phần đổi trả, và điểm thấp nhất chỉ ra nên đầu tư vào đâu trước.',
  ],
  [
    'Persuasion becomes manipulation when the information is false, when the opposite choice is harder, or when the customer would feel deceived if she knew. All three tests must pass.',
    'Thuyết phục trở thành thao túng khi thông tin là sai, khi lựa chọn ngược lại khó hơn, hoặc khi khách sẽ thấy mình bị lừa nếu biết sự thật. Cả ba phép thử đều phải qua.',
  ],
  [
    'Intellectual property is territorial: a Vietnamese registration gives no protection abroad. The wrong sequence is sell, build the brand, then register. The right one is choose the market, search and file, build the channel, then expand.',
    'Quyền sở hữu trí tuệ có tính lãnh thổ: đăng ký ở Việt Nam không bảo hộ được ở nước ngoài. Trình tự sai là bán, xây thương hiệu, rồi mới đăng ký. Trình tự đúng là chọn thị trường, tra cứu và đăng ký, xây kênh, rồi mở rộng.',
  ],
  [
    'AI drafts but does not approve, and AI generated is not the same as compliant. The workflow is AI draft, local review, compliance check, human approval, publish.',
    'AI viết nhưng không phê duyệt, và AI viết ra không có nghĩa là đúng luật. Quy trình là AI viết, người bản địa soát, kiểm tra tuân thủ, người phê duyệt, rồi mới đăng.',
  ],
  [
    'In a domestic market one mistake costs a customer. In a global market one mistake can cost the right to sell at all – so compliance and trust are not a cost of growth, they are the licence to keep growing.',
    'Ở thị trường trong nước, một sai sót mất một khách. Ở thị trường toàn cầu, một sai sót có thể mất luôn quyền được bán – nên tuân thủ và niềm tin không phải chi phí của tăng trưởng, mà là giấy phép để tiếp tục tăng trưởng.',
  ],
];
