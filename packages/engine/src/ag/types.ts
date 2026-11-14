// Game 10 – Agent Arena (Chapter 10): public types and display content (browser-safe).
// How agents weigh a shop, how the planted risks fire and what the measured lift really is
// all stay hidden on the server.
import type { T } from '../types.js';
import { tx } from '../types.js';

/** The eight things a seller can build. Five are read by machines, three are felt by people. */
export type AgCap = 'catalog' | 'stock' | 'price' | 'policy' | 'api' | 'reco' | 'bot' | 'trust';
export const AG_CAPS: AgCap[] = ['catalog', 'stock', 'price', 'policy', 'api', 'reco', 'bot', 'trust'];
/** Agent experience: what an AI agent can read, compare and transact with. */
export const AG_AX: AgCap[] = ['catalog', 'stock', 'price', 'policy', 'api'];
/** Human experience: what a person sees and feels. */
export const AG_UX: AgCap[] = ['reco', 'bot', 'trust'];

export type AgGuard = 'none' | 'caps' | 'caps_log';
export const AG_GUARDS: AgGuard[] = ['none', 'caps', 'caps_log'];
export type AgHandover = 'never' | 'risk' | 'risk_ask';
export const AG_HANDOVERS: AgHandover[] = ['never', 'risk', 'risk_ask'];

export type AgArchetype = 'allin' | 'human' | 'agentearly' | 'cheap' | 'nogov' | 'balanced';

export const AG_ROUNDS = 5;
/** Engineer-quarters available each quarter. */
export const AG_POINTS = 8;
/** What it costs to reach level 1, 2 and 3 of a capability. */
export const AG_LEVEL_COST = [1, 2, 4];
export const AG_MAX_LEVEL = 3;
/** Share of the market's orders placed by an AI agent, quarter by quarter. Public. */
export const AG_AGENT_SHARE = [0.1, 0.18, 0.3, 0.44, 0.58];
/** Orders the whole market could place in a quarter. */
export const AG_ORDERS = 60_000;
/** Average order value, VND m. */
export const AG_AOV = 0.42;
/** Contribution margin on revenue before AI running costs. */
export const AG_MARGIN = 0.22;
/** An agent order needs no persuading and almost no service, so it carries a better margin. */
export const AG_AGENT_MARGIN = 1.35;
/** Running cost per quarter of holding a capability at level 0–3, VND m. */
export const AG_OPEX = [0, 60, 150, 280];
/** Cumulative profit (VND bn) that scores the full 50 points. */
export const AG_PROFIT_TARGET = 2.2;

export const AG_CAP_INFO: Record<AgCap, { icon: string; name: T; who: 'ax' | 'ux'; why: T; levels: [T, T, T] }> = {
  catalog: {
    icon: '📦',
    name: tx('Standardised catalogue', 'Danh mục chuẩn hóa'),
    who: 'ax',
    why: tx('An agent cannot compare what has no standard attributes, codes or units.', 'Agent không so sánh được thứ không có thuộc tính, mã và đơn vị chuẩn.'),
    levels: [
      tx('Titles and free-text descriptions', 'Tên hàng và mô tả tự do'),
      tx('Attributes filled in for the best sellers', 'Điền thuộc tính cho nhóm bán chạy'),
      tx('Whole catalogue standardised, consistent codes and units', 'Chuẩn hóa toàn danh mục, mã và đơn vị thống nhất'),
    ],
  },
  stock: {
    icon: '🏬',
    name: tx('Real-time inventory', 'Tồn kho thời gian thực'),
    who: 'ax',
    why: tx('The agent promises delivery on the customer’s behalf; a wrong promise destroys trust.', 'Agent hứa giao hàng thay cho khách; hứa sai thì mất niềm tin.'),
    levels: [
      tx('Stock figures updated by hand, once a day', 'Số tồn cập nhật tay, mỗi ngày một lần'),
      tx('Live stock for the whole warehouse', 'Tồn kho trực tuyến cho toàn kho'),
      tx('Live availability by warehouse and region', 'Tồn kho trực tuyến theo kho và theo vùng'),
    ],
  },
  price: {
    icon: '🏷️',
    name: tx('Machine-readable price', 'Giá máy đọc được'),
    who: 'ax',
    why: tx('The agent compares the total cost, not the list price – and an automated pricing engine needs limits.', 'Agent so sánh tổng chi phí, không phải giá niêm yết – và máy định giá thì cần giới hạn.'),
    levels: [
      tx('List price on the page, shipping worked out at checkout', 'Giá niêm yết trên trang, phí ship tính lúc thanh toán'),
      tx('Final price including shipping, published in a readable form', 'Giá cuối gồm phí ship, công bố ở dạng máy đọc được'),
      tx('Dynamic pricing by demand, stock and competitor price', 'Định giá động theo nhu cầu, tồn kho và giá đối thủ'),
    ],
  },
  policy: {
    icon: '📜',
    name: tx('Structured policies', 'Chính sách có cấu trúc'),
    who: 'ax',
    why: tx('Returns, warranty and delivery times are constraints in the agent’s selection problem.', 'Đổi trả, bảo hành và thời gian giao là ràng buộc trong bài toán chọn hàng của agent.'),
    levels: [
      tx('Policies written as a page of prose', 'Chính sách viết thành một trang chữ'),
      tx('Returns and warranty as structured fields', 'Đổi trả và bảo hành ở dạng trường dữ liệu'),
      tx('Delivery windows and conditions structured per product', 'Khung thời gian giao và điều kiện có cấu trúc theo từng món'),
    ],
  },
  api: {
    icon: '🔌',
    name: tx('API, identity and authorisation', 'API, định danh và cấp quyền'),
    who: 'ax',
    why: tx('Without connectivity you can only be consulted, never transacted with. Spending limits and logs are the condition for paying safely on someone’s behalf.', 'Không có kết nối thì chỉ được tham khảo, không được giao dịch. Hạn mức và nhật ký là điều kiện để trả tiền an toàn thay người khác.'),
    levels: [
      tx('No feed: an agent can read your page, nothing more', 'Chưa có kết nối: agent chỉ đọc được trang của bạn'),
      tx('Product and price feed for partners', 'Luồng dữ liệu hàng và giá cho đối tác'),
      tx('Ordering API with authentication, spending limits and logs', 'API đặt hàng có định danh, hạn mức chi và nhật ký'),
    ],
  },
  reco: {
    icon: '🎯',
    name: tx('Recommendation system', 'Hệ thống gợi ý'),
    who: 'ux',
    why: tx('Lifts conversion for people – and quietly concentrates the catalogue if nobody constrains it.', 'Tăng chuyển đổi với người thật – và âm thầm dồn danh mục nếu không ai ràng buộc nó.'),
    levels: [
      tx('“People also bought” lists written by hand', 'Danh sách “thường mua cùng” làm bằng tay'),
      tx('Collaborative filtering on behaviour', 'Gợi ý theo hành vi (collaborative filtering)'),
      tx('Real-time personalisation in context', 'Cá nhân hóa theo thời gian thực trong ngữ cảnh'),
    ],
  },
  bot: {
    icon: '💬',
    name: tx('AI assistant', 'Trợ lý AI'),
    who: 'ux',
    why: tx('Answers the easy questions cheaply. On a high-risk question a wrong answer costs more than the staff it saved.', 'Trả lời câu dễ với chi phí thấp. Gặp câu rủi ro cao thì một câu trả lời sai đắt hơn số nhân sự nó tiết kiệm.'),
    levels: [
      tx('A page of frequently asked questions', 'Một trang câu hỏi thường gặp'),
      tx('Assistant answering from your own documents', 'Trợ lý trả lời dựa trên tài liệu của bạn'),
      tx('Assistant that reads orders and acts on them', 'Trợ lý đọc được đơn hàng và xử lý được việc'),
    ],
  },
  trust: {
    icon: '⭐',
    name: tx('Evidence of trust', 'Bằng chứng đáng tin'),
    who: 'ux',
    why: tx('Verified reviews, on-time delivery rate and return rate: people are persuaded by them and agents rank on them.', 'Đánh giá đã xác thực, tỷ lệ giao đúng hẹn, tỷ lệ hoàn: người thì được thuyết phục, còn agent thì xếp hạng dựa vào đó.'),
    levels: [
      tx('Reviews as they come, answered when there is time', 'Đánh giá để tự nhiên, rảnh thì trả lời'),
      tx('Verified reviews, every one answered', 'Đánh giá đã xác thực, trả lời tất cả'),
      tx('On-time delivery and return rate published as data', 'Công bố tỷ lệ giao đúng hẹn và tỷ lệ hoàn dưới dạng dữ liệu'),
    ],
  },
};

export const AG_GUARD_INFO: Record<AgGuard, { icon: string; name: T; note: T; cost: number }> = {
  none: {
    icon: '🚫',
    name: tx('No limits on the pricing engine', 'Không đặt giới hạn cho máy định giá'),
    note: tx('Nothing to stop a configuration error – or a customer discovering they paid more than the next person.', 'Không có gì chặn một lỗi cấu hình – hay chặn việc khách phát hiện mình trả cao hơn người bên cạnh.'),
    cost: 0,
  },
  caps: {
    icon: '🛡️',
    name: tx('Ceiling, floor and a daily limit', 'Giá trần, giá sàn và giới hạn mỗi ngày'),
    note: tx('A price band per product group, at most ±10% a day, an exclusion list and an emergency stop.', 'Khoảng giá cho mỗi nhóm hàng, tối đa ±10% mỗi ngày, danh sách loại trừ và nút dừng khẩn cấp.'),
    cost: 40,
  },
  caps_log: {
    icon: '📋',
    name: tx('Limits plus a reason logged for every change', 'Giới hạn kèm nhật ký lý do cho mọi lần đổi giá'),
    note: tx('Every price change records why and who is responsible – the only way to answer a customer or a regulator.', 'Mỗi lần đổi giá ghi lại lý do và ai chịu trách nhiệm – cách duy nhất để trả lời khách hàng và cơ quan quản lý.'),
    cost: 90,
  },
};

export const AG_HANDOVER_INFO: Record<AgHandover, { icon: string; name: T; note: T; cost: number }> = {
  never: {
    icon: '🤐',
    name: tx('The assistant keeps the conversation', 'Trợ lý giữ khách trong cuộc hội thoại'),
    note: tx('Containment looks excellent. Some of those customers simply gave up.', 'Tỷ lệ tự xử lý trông rất đẹp. Một phần trong đó chỉ là khách bỏ cuộc.'),
    cost: 0,
  },
  risk: {
    icon: '🙋',
    name: tx('Hand over on high-risk topics', 'Chuyển người thật khi gặp chủ đề rủi ro cao'),
    note: tx('Refunds, warranty, legal complaints and health questions go to a person.', 'Hoàn tiền, bảo hành, khiếu nại pháp lý và câu hỏi sức khỏe thì chuyển cho người.'),
    cost: 60,
  },
  risk_ask: {
    icon: '🤝',
    name: tx('Hand over on risk, low confidence, repetition or anger', 'Chuyển người khi rủi ro, khi máy không chắc, khi khách hỏi lại, khi khách giận'),
    note: tx('A customer who asks for a human always gets one. Staff then handle only the hard cases, so their time per case rises.', 'Khách đòi gặp người thì luôn được gặp. Nhân sự chỉ còn lại ca khó, nên thời gian xử lý mỗi ca tăng lên.'),
    cost: 150,
  },
};

export const AG_ARCHETYPE_INFO: Record<AgArchetype, T> = {
  allin: tx('Buys all the AI at once', 'Mua hết AI một lượt'),
  human: tx('People only, no machines', 'Chỉ lo cho người, bỏ máy'),
  agentearly: tx('All-in on agents from quarter 1', 'Tất tay vào agent từ quý 1'),
  cheap: tx('Keeps the money', 'Giữ tiền'),
  nogov: tx('Good systems, no controls', 'Hệ thống tốt, không kiểm soát'),
  balanced: tx('Follows the agent curve, keeps control', 'Đi theo đường cong agent, giữ kiểm soát'),
};

export const AG_QUARTER_INFO: Record<number, { title: T; text: T }> = {
  1: {
    title: tx('Q1 2027 · One order in ten is placed by software', 'Quý 1/2027 · Mười đơn thì một đơn do phần mềm đặt'),
    text: tx(
      'Six sellers, one market, eight things you could build and eight engineer-quarters to build them with. Everything you hold costs money to run every quarter, whether it earns anything or not.',
      'Sáu người bán, một thị trường, tám thứ có thể xây và tám quý-kỹ-sư để xây. Mọi thứ bạn giữ đều tốn chi phí vận hành hằng quý, dù nó có kiếm được gì hay không.',
    ),
  },
  2: {
    title: tx('Q2 2027 · Agents are placing one order in five', 'Quý 2/2027 · Agent đặt một trong năm đơn'),
    text: tx(
      'Without an ordering API an agent can read your pages and recommend you, but it cannot buy from you. Being consulted is not the same as being transacted with.',
      'Không có API đặt hàng thì agent đọc được trang của bạn và có thể giới thiệu bạn, nhưng không mua được của bạn. Được tham khảo khác với được giao dịch.',
    ),
  },
  3: {
    title: tx('Q3 2027 · Three orders in ten', 'Quý 3/2027 · Ba trong mười đơn'),
    text: tx(
      'The agent segment is now large enough to pay for the work of being readable. It ranks on data: attributes, total cost, availability, policies and delivery record.',
      'Phần khách qua agent đã đủ lớn để bù cho công sức làm dữ liệu máy đọc được. Agent xếp hạng dựa trên dữ liệu: thuộc tính, tổng chi phí, hàng có sẵn, chính sách và lịch sử giao hàng.',
    ),
  },
  4: {
    title: tx('Q4 2027 · Nearly half the orders', 'Quý 4/2027 · Gần một nửa số đơn'),
    text: tx(
      'Whoever is still unreadable is now invisible for half the market – not because the goods are worse, but because they cannot be compared.',
      'Ai còn chưa máy đọc được thì giờ là vô hình với nửa thị trường – không phải vì hàng kém hơn, mà vì không thể so sánh được.',
    ),
  },
  5: {
    title: tx('Q1 2028 · More than half', 'Quý 1/2028 · Hơn một nửa'),
    text: tx(
      'Last quarter. Everyone has the same AI tools by now, so what is left to compete on is the data, the process, the judgement and how fast you learned.',
      'Quý cuối. Đến giờ ai cũng có đúng những công cụ AI như nhau, nên chỉ còn cạnh tranh bằng dữ liệu, quy trình, khả năng phán đoán và tốc độ học.',
    ),
  },
};

export interface AgDecision {
  /** Target level 0–3 for each capability; never below the level you already hold. */
  invest: Record<AgCap, number>;
  guard: AgGuard;
  handover: AgHandover;
  /** Reserve a minimum share of impressions for new and rarely seen products. */
  diversity: boolean;
  /** Hold 10% of traffic back as a control group so the lift can be measured. */
  holdout: boolean;
}

export interface AgRisk {
  id: string;
  text: T;
  /** Cost in VND bn. */
  cost: number;
}

export interface AgReport {
  round: number;
  decision: AgDecision;
  defaulted: boolean;
  spent: number;
  levels: Record<AgCap, number>;
  agentShare: number;
  /** Your share of the agent orders and of the human orders, 0–1. */
  agentWon: number;
  humanWon: number;
  ordersAgent: number;
  ordersHuman: number;
  /** Agent orders your data could not actually honour. */
  ordersFailed: number;
  revenue: number;
  margin: number;
  opex: number;
  control: number;
  riskCost: number;
  profit: number;
  risks: AgRisk[];
  /** What the dashboard says the recommender lifted, and what a control group would show. */
  liftClaimed: number;
  liftReal: number | null;
  notes: T[];
}

export interface AgView {
  levels: Record<AgCap, number>;
  profit: number;
  revenue: number;
  opexNext: number;
  points: number;
  /** Trust damage still being carried, 0–1. */
  scar: number;
  /** How concentrated the recommender has made the catalogue, 0–1. */
  concentration: number;
  agentShareNow: number;
  agentShareNext: number | null;
  holdoutEver: boolean;
}

export interface AgPub {
  profit: Record<string, number>;
  agentWon: Record<string, number>;
  /** Average capability level across the market, per capability. */
  market: Record<AgCap, number>;
  agentShareNow: number;
  agentShareNext: number | null;
  /** Agent orders nobody in the market was readable enough to win. */
  unmet: number;
}

export const AG_SCORE_PARTS: Record<string, T> = {
  profit: tx('Cumulative profit (50)', 'Lợi nhuận cộng dồn (50)'),
  agent: tx('Agent orders won (25)', 'Giành được đơn từ agent (25)'),
  control: tx('Every automated system under human control (25)', 'Mọi hệ thống tự động đều có người kiểm soát (25)'),
};

export const AG_BADGES: Record<string, T> = {
  readable: tx('🔌 Readable by machines before it paid to be', '🔌 Máy đọc được trước khi điều đó có lãi'),
  governed: tx('🛡️ Never ran an automated system without its control', '🛡️ Không bao giờ chạy hệ thống tự động mà thiếu kiểm soát'),
  measurer: tx('🧪 Measured the lift against a control group', '🧪 Đo hiệu quả bằng nhóm đối chứng'),
  thrifty: tx('💰 Profitable in every quarter', '💰 Có lãi ở mọi quý'),
  broad: tx('🌈 Kept the long tail alive', '🌈 Giữ được phần đuôi dài của danh mục'),
  leader: tx('👑 Highest cumulative profit', '👑 Lợi nhuận cộng dồn cao nhất'),
};

export const AG_DEBRIEF: [string, string][] = [
  ['Optimising for agents does not replace optimising for people: do the overlapping part well – accurate data, clear policies, delivery on time, genuine reviews – because that persuades both.', 'Tối ưu cho agent không thay cho tối ưu cho người: hãy làm tốt phần giao nhau – dữ liệu đúng, chính sách rõ, giao đúng hẹn, đánh giá thật – vì phần đó thuyết phục cả hai.'],
  ['A product without standard attributes, live stock and a structured policy does not exist for an agent – not because it is worse, but because it cannot be compared.', 'Một sản phẩm không có thuộc tính chuẩn, không có tồn kho trực tuyến và không có chính sách cấu trúc thì không tồn tại với agent – không phải vì nó kém hơn, mà vì không so sánh được.'],
  ['Without connectivity you can only be consulted, not transacted with; and the level of autonomy should be inversely proportional to how irreversible the action is.', 'Không có kết nối thì chỉ được tham khảo, không được giao dịch; và mức tự chủ nên ngược với mức độ không thể hoàn tác của hành động.'],
  ['AI capability is not competitive advantage once everyone has the same tools. What is left is data, process, judgement and the speed of learning.', 'Năng lực AI không phải lợi thế cạnh tranh khi ai cũng có cùng bộ công cụ. Còn lại là dữ liệu, quy trình, khả năng phán đoán và tốc độ học.'],
  ['A recommender optimised only for this session concentrates the catalogue: a few SKUs take most of the impressions, the long tail dies and the shop starts to feel poorly stocked.', 'Hệ gợi ý chỉ tối ưu cho lượt truy cập hiện tại sẽ dồn danh mục: vài SKU chiếm phần lớn lượt hiển thị, phần đuôi dài chết dần và cửa hàng bắt đầu có cảm giác ít hàng.'],
  ['A dashboard without a control group reports the lift of what the customer would have bought anyway. Measurement design, not model accuracy, is what tells you whether the AI earned anything.', 'Bảng điều khiển không có nhóm đối chứng sẽ báo cả phần khách vốn đã mua. Cách thiết kế đo lường, không phải độ chính xác của mô hình, mới cho biết AI có kiếm được gì hay không.'],
  ['Automation does not remove accountability: a price engine needs a ceiling and a floor, an assistant needs a handover, and a human must keep meaningful control.', 'Tự động hóa không xóa được trách nhiệm: máy định giá cần giá trần giá sàn, trợ lý cần điểm chuyển người, và con người phải giữ quyền kiểm soát thực chất.'],
];
