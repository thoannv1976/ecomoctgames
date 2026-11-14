// Game 3 – Shopper Stream (Chapter 3): public types and display content (browser-safe).
// The persona weight vectors (where each persona really drops off) stay hidden on the server
// until a player researches them.
import type { T } from '../types.js';
import { tx } from '../types.js';

/** The six steps of the customer journey. */
export type SsStage = 'discover' | 'search' | 'compare' | 'buy' | 'review' | 'repeat';
export const SS_STAGES: SsStage[] = ['discover', 'search', 'compare', 'buy', 'review', 'repeat'];
/** The stages a new shopper has to pass to place a first order. */
export const SS_FUNNEL: SsStage[] = ['discover', 'search', 'compare', 'buy'];

export type SsPersona = 'student' | 'mom' | 'office' | 'gifter' | 'pro' | 'senior';
export const SS_PERSONAS: SsPersona[] = ['student', 'mom', 'office', 'gifter', 'pro', 'senior'];

export type SsChannel = 'search' | 'discover' | 'agent';
export const SS_CHANNELS: SsChannel[] = ['search', 'discover', 'agent'];

export type SsResearch = 'none' | 'reviews' | 'interview';
export const SS_RESEARCH: SsResearch[] = ['none', 'reviews', 'interview'];

export type SsRecovery = 'ignore' | 'refund' | 'care';
export const SS_RECOVERY: SsRecovery[] = ['ignore', 'refund', 'care'];

export type SsArchetype = 'volume' | 'gifts' | 'checkout' | 'spread' | 'agentfirst' | 'journey';

export const SS_ROUNDS = 5;
/** Improvement points to spend every month. */
export const SS_POINTS = 10;
/** An interview costs one of those points; mining your own reviews is free. */
export const SS_INTERVIEW_COST = 1;
/** Shoppers in the market. */
export const SS_POOL = 120_000;
/** The month the delivery failure happens (the recovery choice comes the month after). */
export const SS_INCIDENT_ROUND = 2;
/** Share of a company's customer base hit by the failure. */
export const SS_INCIDENT_SHARE = 0.22;
/** Repeat-customer value (VND bn) that scores the full 55 points. */
export const SS_CLV_TARGET = 3.2;
/** Repeat-order share that scores the full 25 points. */
export const SS_LOYAL_TARGET = 0.55;

export const SS_STAGE_INFO: Record<SsStage, { icon: string; name: T; question: T; fix: T }> = {
  discover: {
    icon: '👀',
    name: tx('Discover', 'Khám phá'),
    question: tx('“I did not know this existed.”', '“Tôi không biết là có cái này.”'),
    fix: tx('Short video, creator posts, a feed-worthy first frame.', 'Video ngắn, bài của nhà sáng tạo, khung hình đầu đủ hấp dẫn.'),
  },
  search: {
    icon: '🔍',
    name: tx('Search', 'Tìm kiếm'),
    question: tx('“Can I find you when I am already looking?”', '“Khi tôi đang tìm, có thấy bạn không?”'),
    fix: tx('Titles, keywords, category, the right attributes filled in.', 'Tên sản phẩm, từ khóa, danh mục, điền đủ thuộc tính.'),
  },
  compare: {
    icon: '⚖️',
    name: tx('Compare', 'So sánh'),
    question: tx('“Why you and not the other six tabs?”', '“Vì sao chọn bạn chứ không phải sáu tab kia?”'),
    fix: tx('Photos, specs, total price with shipping, return policy, real reviews.', 'Ảnh, thông số, giá cuối gồm phí ship, chính sách đổi trả, đánh giá thật.'),
  },
  buy: {
    icon: '🛒',
    name: tx('Buy', 'Mua'),
    question: tx('“How many taps, and do I have to create an account?”', '“Bao nhiêu lần bấm, có phải tạo tài khoản không?”'),
    fix: tx('Guest checkout, fewer fields, COD, honest delivery date.', 'Mua không cần tài khoản, bớt ô phải điền, COD, ngày giao trung thực.'),
  },
  review: {
    icon: '⭐',
    name: tx('Review', 'Đánh giá'),
    question: tx('“Was it what the page promised?”', '“Có đúng như trang hàng đã hứa không?”'),
    fix: tx('Ask at the right moment, answer every review, photos from buyers.', 'Hỏi đúng lúc, trả lời mọi đánh giá, ảnh thật của người mua.'),
  },
  repeat: {
    icon: '🔁',
    name: tx('Repurchase', 'Mua lại'),
    question: tx('“Is there a reason to come back to you?”', '“Có lý do gì để quay lại với bạn?”'),
    fix: tx('After-sales care, refill reminders, a membership that is worth it.', 'Chăm sóc sau mua, nhắc mua lại, quyền lợi thành viên đáng giá.'),
  },
};

export const SS_PERSONA_INFO: Record<SsPersona, { icon: string; name: T; who: T; aov: number; loyalty: T }> = {
  student: {
    icon: '🎒',
    name: tx('Price hunter', 'Sinh viên săn giá'),
    who: tx('Student, compares every shop, buys whatever has the best voucher today.', 'Sinh viên, so sánh mọi cửa hàng, hôm nay ai có voucher tốt nhất thì mua.'),
    aov: 45,
    loyalty: tx('very low', 'rất thấp'),
  },
  mom: {
    icon: '🧸',
    name: tx('Parent of a small child', 'Mẹ có con nhỏ'),
    who: tx('Buys the same things again and again, reads reviews carefully, hates surprises.', 'Mua lặp lại những món giống nhau, đọc đánh giá rất kỹ, ghét bất ngờ.'),
    aov: 160,
    loyalty: tx('high', 'cao'),
  },
  office: {
    icon: '💼',
    name: tx('Office worker', 'Nhân viên văn phòng'),
    who: tx('Buys from the phone between two meetings; anything slow is abandoned.', 'Mua bằng điện thoại giữa hai cuộc họp; cái gì chậm là bỏ.'),
    aov: 110,
    loyalty: tx('medium', 'trung bình'),
  },
  gifter: {
    icon: '🎁',
    name: tx('Gift buyer', 'Người mua quà'),
    who: tx('Spends a lot, once, for an occasion – and is gone until the next occasion.', 'Chi nhiều, một lần, cho một dịp – rồi biến mất tới dịp sau.'),
    aov: 220,
    loyalty: tx('almost none', 'gần như không'),
  },
  pro: {
    icon: '🏪',
    name: tx('Small-shop buyer', 'Chủ shop nhỏ mua sỉ'),
    who: tx('Buys to resell: large baskets, every month, and reads policies like a contract.', 'Mua để bán lại: giỏ hàng lớn, hằng tháng, và đọc chính sách như đọc hợp đồng.'),
    aov: 520,
    loyalty: tx('very high', 'rất cao'),
  },
  senior: {
    icon: '🫖',
    name: tx('Cautious older buyer', 'Khách lớn tuổi'),
    who: tx('Wants to pay on delivery and to be sure nothing goes wrong. Loyal once convinced.', 'Muốn trả tiền khi nhận hàng và muốn chắc chắn không có gì sai. Đã tin thì rất trung thành.'),
    aov: 130,
    loyalty: tx('high', 'cao'),
  },
};

export const SS_CHANNEL_INFO: Record<SsChannel, { icon: string; name: T; note: T; entry: SsStage }> = {
  search: {
    icon: '🔍',
    name: tx('Marketplace search', 'Tìm kiếm trên sàn'),
    note: tx('The shopper already wants the thing. Fewer steps, but the ranking decides who is seen.', 'Khách đã muốn mua món đó. Ít bước hơn, nhưng thứ hạng quyết định ai được thấy.'),
    entry: 'search',
  },
  discover: {
    icon: '📱',
    name: tx('Short-video discovery', 'Khám phá trên video ngắn'),
    note: tx('Huge reach, no intent yet: the whole journey is in front of you.', 'Tiếp cận rất lớn, nhưng khách chưa có nhu cầu: cả hành trình còn ở phía trước.'),
    entry: 'discover',
  },
  agent: {
    icon: '🤖',
    name: tx('AI shopping agent', 'AI agent mua hộ'),
    note: tx('Small, rich and winner-takes-most: the agent reads your specs and policy and picks one shop.', 'Nhỏ, giá trị cao và gần như thắng ăn cả: agent đọc thông số và chính sách rồi chọn một cửa hàng.'),
    entry: 'compare',
  },
};

export const SS_RESEARCH_INFO: Record<SsResearch, { icon: string; name: T; note: T }> = {
  none: { icon: '—', name: tx('No research', 'Không nghiên cứu'), note: tx('Keep all ten points for the journey.', 'Giữ cả mười điểm cho hành trình.') },
  reviews: {
    icon: '🗂️',
    name: tx('Mine my own reviews', 'Đào dữ liệu đánh giá của mình'),
    note: tx('Free, but it only speaks about the persona that already buys from you.', 'Miễn phí, nhưng chỉ nói về chân dung đã mua của bạn.'),
  },
  interview: {
    icon: '🎤',
    name: tx('Interview a persona (1 point)', 'Phỏng vấn một chân dung (1 điểm)'),
    note: tx('You choose who to listen to – including the people you are losing.', 'Bạn chọn người để nghe – kể cả những người bạn đang mất.'),
  },
};

export const SS_RECOVERY_INFO: Record<SsRecovery, { icon: string; name: T; note: T }> = {
  ignore: {
    icon: '🙈',
    name: tx('Do nothing', 'Không làm gì'),
    note: tx('Costs nothing now. Those customers leave and say so in public.', 'Không tốn gì bây giờ. Những khách đó rời đi và nói ra công khai.'),
  },
  refund: {
    icon: '💸',
    name: tx('Refund the order', 'Hoàn tiền đơn hàng'),
    note: tx('Costs one order each. They stay, as they were.', 'Tốn bằng một đơn mỗi người. Họ ở lại, như cũ.'),
  },
  care: {
    icon: '🤝',
    name: tx('Refund, apologise, follow up', 'Hoàn tiền, xin lỗi, chăm sóc tiếp'),
    note: tx('Costs about one and a half orders each – and they come back more loyal than before.', 'Tốn khoảng một đơn rưỡi mỗi người – và họ quay lại trung thành hơn trước.'),
  },
};

export const SS_ARCHETYPE_INFO: Record<SsArchetype, T> = {
  volume: tx('Fixes the biggest drop-off', 'Sửa chỗ rơi rụng lớn nhất'),
  gifts: tx('Chases the big baskets', 'Chạy theo giỏ hàng lớn'),
  checkout: tx('Checkout only', 'Chỉ sửa bước mua'),
  spread: tx('Spreads evenly', 'Chia đều'),
  agentfirst: tx('Agent-first', 'Đặt cược vào agent'),
  journey: tx('Researches, then fixes', 'Nghiên cứu rồi mới sửa'),
};

export const SS_MONTH_INFO: Record<number, { title: T; text: T }> = {
  1: {
    title: tx('Month 1 · A pool of 120,000 shoppers', 'Tháng 1 · Một tập 120.000 khách'),
    text: tx(
      'Six brands sell comparable things to the same six personas. Nobody has customers yet. Ten improvement points a month – and the journey has six steps, so you cannot fix them all.',
      'Sáu thương hiệu bán những món tương tự nhau cho cùng sáu chân dung khách. Chưa ai có khách. Mỗi tháng mười điểm cải thiện – mà hành trình có sáu bước, nên không thể sửa hết.',
    ),
  },
  2: {
    title: tx('Month 2 · The funnel is public now', 'Tháng 2 · Phễu đã hiện ra'),
    text: tx(
      'Everybody can see where the market loses shoppers. The biggest drop-off is the loudest number on the board; it is not automatically the one worth your points.',
      'Ai cũng thấy thị trường mất khách ở đâu. Chỗ rơi rụng lớn nhất là con số to nhất trên bảng; nó không tự động là chỗ đáng bỏ điểm vào.',
    ),
  },
  3: {
    title: tx('Month 3 · Something went wrong', 'Tháng 3 · Có chuyện xảy ra'),
    text: tx(
      'A delivery failure has hit the company with the most customers. How a company answers a failure decides more than whether the failure happened.',
      'Một sự cố giao hàng vừa rơi vào công ty có nhiều khách nhất. Cách công ty trả lời sự cố quyết định nhiều hơn chuyện sự cố có xảy ra hay không.',
    ),
  },
  4: {
    title: tx('Month 4 · Keeping is harder than getting', 'Tháng 4 · Giữ khó hơn lấy'),
    text: tx(
      'The free pool is thinning out. From here, most of the value has to come from the customers you already have.',
      'Tập khách chưa thuộc về ai đang mỏng dần. Từ đây, phần lớn giá trị phải đến từ những khách bạn đã có.',
    ),
  },
  5: {
    title: tx('Month 5 · Last month', 'Tháng 5 · Tháng cuối'),
    text: tx(
      'What is counted at the end is the value of the customers who came back. One-time buyers add revenue to the month and nothing to the score.',
      'Cái được tính cuối cùng là giá trị của những khách đã quay lại. Khách mua một lần làm đẹp doanh thu tháng và không thêm gì vào điểm.',
    ),
  },
};

/** What research reveals about a persona. */
export interface SsInsight {
  persona: SsPersona;
  /** The journey step where this persona really drops off. */
  pain: SsStage;
  jobs: T;
  pains: T;
  gains: T;
}

export interface SsDecision {
  channel: SsChannel;
  /** Improvement points per journey step; must sum to at most 10 (9 with an interview). */
  fix: Record<SsStage, number>;
  research: SsResearch;
  /** Which persona to interview (only for research = 'interview'). */
  interviewOf: SsPersona | null;
  /** Required only in the month after a delivery failure hit you. */
  recovery: SsRecovery | null;
}

export interface SsReport {
  round: number;
  decision: SsDecision;
  defaulted: boolean;
  /** Your conversion rate at each step this month. */
  funnel: Record<SsStage, number>;
  /** New first-time buyers per persona. */
  newBuyers: Record<SsPersona, number>;
  /** Orders from customers who had bought before. */
  repeatOrders: Record<SsPersona, number>;
  revenue: number;
  /** Value from repeat customers added this month (VND bn) – this is what is scored. */
  clvGain: number;
  cost: number;
  /** The step where one more point would have added the most repeat value. */
  best: SsStage;
  second: SsStage;
  /** Share of your points that went to those two steps, 0–1. */
  insight: number;
  reveal: SsInsight | null;
  incident: T | null;
  notes: T[];
}

export interface SsView {
  /** Value from repeat customers so far (VND bn). */
  clv: number;
  revenue: number;
  orders: number;
  repeatOrders: number;
  base: Record<SsPersona, number>;
  /** Review stock: real reviews make the Compare step easier. */
  reviews: number;
  /** Satisfaction multiplier on repurchase (1 = normal). */
  sat: number;
  known: Record<SsPersona, SsInsight | null>;
  /** Your own conversion at each step last month. */
  funnel: Record<SsStage, number>;
  /** A delivery failure waiting for an answer this month. */
  incident: { customers: number; refund: number; care: number } | null;
  points: number;
}

export interface SsPub {
  clv: Record<string, number>;
  base: Record<string, number>;
  channel: Record<string, SsChannel>;
  /** Market-average conversion at each step last month. */
  funnel: Record<SsStage, number>;
  /** Shoppers who are nobody's customer yet. */
  pool: Record<SsPersona, number>;
}

export const SS_SCORE_PARTS: Record<string, T> = {
  clv: tx('Value of the customers you kept (55)', 'Giá trị khách giữ được (55)'),
  loyal: tx('Share of orders from returning customers (25)', 'Tỷ lệ đơn từ khách quay lại (25)'),
  insight: tx('Points spent where they were worth most (20)', 'Điểm bỏ vào đúng chỗ đáng nhất (20)'),
};

export const SS_BADGES: Record<string, T> = {
  loyalist: tx('🔁 More than half the orders were repeat orders', '🔁 Hơn nửa số đơn là khách mua lại'),
  recoverer: tx('🤝 Turned a failure into loyalty', '🤝 Biến sự cố thành lòng trung thành'),
  listener: tx('🎤 Listened to four personas or more', '🎤 Đã nghe từ bốn chân dung trở lên'),
  sniper: tx('🎯 Spent the points where they paid', '🎯 Bỏ điểm vào đúng chỗ sinh lời'),
  wholesale: tx('🏪 Won the small-shop buyers', '🏪 Giành được nhóm chủ shop nhỏ'),
  leader: tx('👑 Highest kept-customer value', '👑 Giá trị khách giữ được cao nhất'),
};

export const SS_DEBRIEF: [string, string][] = [
  ['The journey is not a straight line and it does not end at checkout: Review and Repurchase are where the value is, and they are the steps nobody has points left for.', 'Hành trình không phải đường thẳng và không kết thúc ở thanh toán: Đánh giá và Mua lại là nơi có giá trị, và cũng là hai bước không còn ai dư điểm để sửa.'],
  ['The biggest drop-off is not automatically the most valuable fix: ask what a point there is worth, not how big the gap looks.', 'Chỗ rơi rụng lớn nhất không tự động là chỗ đáng sửa nhất: hãy hỏi một điểm bỏ vào đó đáng bao nhiêu, đừng hỏi khoảng hở trông to bao nhiêu.'],
  ['Not all friction is bad: the steps that filter out the wrong customers save you the cost of serving them.', 'Không phải ma sát nào cũng xấu: những bước sàng bớt khách không phù hợp giúp bạn tiết kiệm chi phí phục vụ họ.'],
  ['Revenue from one-time buyers flatters the month and builds nothing. The gift buyer has the largest basket and the smallest lifetime value.', 'Doanh thu từ khách mua một lần làm đẹp con số tháng và không tạo ra gì. Người mua quà có giỏ hàng lớn nhất và giá trị trọn đời nhỏ nhất.'],
  ['Mining your own reviews only tells you about people who got far enough to buy – the ones you are losing never leave a review.', 'Đào dữ liệu đánh giá của mình chỉ cho biết về người đã đi đủ xa để mua – những người bạn đang mất thì không để lại đánh giá nào.'],
  ['The service-recovery paradox: a failure answered properly leaves the customer more loyal than if nothing had gone wrong.', 'Nghịch lý phục hồi dịch vụ: một sự cố được xử lý đúng cách để lại khách trung thành hơn cả khi không có sự cố nào.'],
];
