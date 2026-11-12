// Game 9 – Unit Economics Showdown: question templates from Chapter 9 of the E-commerce 2026 textbook.
// Every template draws fresh numbers, so each game (and each room) has different answers.
import type { QuestionTemplate } from '../bank.js';
import { shuffle, type Rng } from '../rng.js';
import type { Lang, T } from '../types.js';
import { between, bi, both, m, n, numericOptions, p, pick, pp, round, row, textOptions, x } from './fmt.js';

const src = (sec: string, en: string, vi: string): T => both(`Textbook Ch. 9, §${sec} – ${en}`, `Giáo trình Chương 9, mục ${sec} – ${vi}`);
const K = 1000;
const M = 1e6;

// ───────── Find the bottleneck (tap a dashboard tile) ─────────

interface Metric {
  key: string;
  name: T;
  base: number;
  fmt: (v: number, l: Lang) => string;
  /** Change that hurts profit: -1 = falling is bad, +1 = rising is bad. */
  bad: -1 | 1;
}

function tile(mt: Metric, now: number, l: Lang): string {
  const ch = mt.base ? (now - mt.base) / mt.base : 0;
  return `${mt.name[l]}\n${mt.fmt(mt.base, l)} → ${mt.fmt(now, l)} (${ch >= 0 ? '+' : ''}${p(ch, l, 0)})`;
}

const bottleneckTree: QuestionTemplate = {
  id: 'bn-tree',
  category: 'bottleneck',
  make: (rng) => {
    const traffic = between(rng, 80, 240, 10) * K;
    const cr = between(rng, 14, 32) / 1000;
    const aov = between(rng, 220, 520, 10) * K;
    const metrics: Metric[] = [
      { key: 'traffic', name: both('Sessions', 'Lượt truy cập'), base: traffic, fmt: (v, l) => n(v, l), bad: -1 },
      { key: 'cr', name: both('Conversion rate', 'Tỷ lệ chuyển đổi'), base: cr, fmt: (v, l) => p(v, l, 2), bad: -1 },
      { key: 'aov', name: both('AOV', 'Giá trị đơn (AOV)'), base: aov, fmt: (v, l) => m(v, l), bad: -1 },
      { key: 'cm', name: both('Contribution margin', 'Biên lợi nhuận đóng góp'), base: between(rng, 16, 28) / 100, fmt: (v, l) => p(v, l, 1), bad: -1 },
      { key: 'ret', name: both('Return rate', 'Tỷ lệ hoàn hàng'), base: between(rng, 4, 9) / 100, fmt: (v, l) => p(v, l, 1), bad: 1 },
      { key: 'fee', name: both('Platform fee rate', 'Tỷ lệ phí sàn'), base: between(rng, 10, 16) / 100, fmt: (v, l) => p(v, l, 1), bad: 1 },
    ];
    const culprit = pick(rng, metrics);
    const shock = culprit.key === 'ret' ? between(rng, 70, 120) / 100 : culprit.key === 'fee' ? between(rng, 35, 55) / 100 : between(rng, 18, 32) / 100;
    const now = new Map<string, number>();
    for (const mt of metrics) {
      const drift = (between(rng, -2, 2) / 100) * (mt.bad === -1 ? 1 : -1); // small noise, never the story
      now.set(mt.key, mt === culprit ? mt.base * (1 + mt.bad * shock) : mt.base * (1 + drift * 0.5));
    }
    const vanity = { name: both('Followers', 'Người theo dõi'), base: between(rng, 20, 60) * K, rise: between(rng, 25, 60) / 100 };
    const tiles = shuffle(rng, [...metrics.map((mt) => ({ mt, vanity: false })), { mt: null, vanity: true }]);
    const segments = tiles.map((t) =>
      t.vanity ? bi((l) => `${vanity.name[l]}\n${n(vanity.base, l)} → ${n(vanity.base * (1 + vanity.rise), l)} (+${p(vanity.rise, l, 0)})`) : bi((l) => tile(t.mt!, now.get(t.mt!.key)!, l)),
    );
    return {
      id: 'bn-tree',
      kind: 'spot',
      category: 'bottleneck',
      prompt: both('Contribution profit fell sharply this month. Tap the metric that explains it.', 'Lợi nhuận đóng góp tháng này giảm mạnh. Chạm vào chỉ số giải thích được điều đó.'),
      context: both('Profit = Sessions × CR × AOV × margin − returns − fees. Look for the driver that moved, not the number that is biggest.', 'Lợi nhuận = Truy cập × CR × AOV × biên − hoàn hàng − phí. Tìm chỉ số đã thay đổi, không phải con số lớn nhất.'),
      segments,
      answer: tiles.findIndex((t) => t.mt === culprit),
      explanation: bi((l) =>
        l === 'en'
          ? `${culprit.name.en} moved ${p(shock, 'en', 0)} the wrong way; every other driver stayed within a few percent. Followers rose, but it is a vanity metric: it is not on the arithmetic chain to profit.`
          : `${culprit.name.vi} thay đổi ${p(shock, 'vi', 0)} theo hướng xấu; các chỉ số khác chỉ dao động vài phần trăm. Người theo dõi tăng nhưng đó là chỉ số cho đẹp: không nằm trên chuỗi tính ra lợi nhuận.`,
      ),
      source: src('7.3', 'The metric tree', 'Cây chỉ số'),
    };
  },
};

const bottleneckFunnel: QuestionTemplate = {
  id: 'bn-funnel',
  category: 'bottleneck',
  make: (rng) => {
    const stages = [
      { name: both('Product view → Add to cart', 'Xem sản phẩm → Thêm giỏ'), bench: between(rng, 8, 12) / 100 },
      { name: both('Cart → Start checkout', 'Giỏ hàng → Bắt đầu thanh toán'), bench: between(rng, 40, 55) / 100 },
      { name: both('Checkout → Pay', 'Thanh toán → Trả tiền'), bench: between(rng, 60, 75) / 100 },
      { name: both('Payment success', 'Thanh toán thành công'), bench: between(rng, 86, 94) / 100 },
      { name: both('Delivered (not refused)', 'Giao thành công (không bị từ chối)'), bench: between(rng, 88, 95) / 100 },
    ];
    const bad = randIdx(rng, stages.length);
    const actual = stages.map((s, i) => (i === bad ? s.bench * (1 - between(rng, 28, 40) / 100) : s.bench * (1 + between(rng, -4, 4) / 100)));
    return {
      id: 'bn-funnel',
      kind: 'spot',
      category: 'bottleneck',
      prompt: both('Orders are below plan. Tap the funnel step that leaks most against its benchmark.', 'Số đơn thấp hơn kế hoạch. Chạm vào bước trong phễu rò rỉ nhiều nhất so với chuẩn của nó.'),
      context: both('Each tile: this month’s step conversion vs the category benchmark.', 'Mỗi ô: tỷ lệ chuyển đổi của bước tháng này so với chuẩn của ngành hàng.'),
      segments: stages.map((s, i) => bi((l) => `${s.name[l]}\n${p(actual[i]!, l, 1)} · ${l === 'en' ? 'benchmark' : 'chuẩn'} ${p(s.bench, l, 0)}`)),
      answer: bad,
      explanation: bi((l) =>
        l === 'en'
          ? `“${stages[bad]!.name.en}” runs about a third below its benchmark; the others are within a few percent. Compare each step with its own benchmark: the step with the lowest absolute rate (usually view → cart) is not automatically the problem.`
          : `Bước “${stages[bad]!.name.vi}” thấp hơn chuẩn khoảng một phần ba; các bước khác chỉ lệch vài phần trăm. Hãy so từng bước với chuẩn của chính nó: bước có tỷ lệ thấp nhất (thường là xem → thêm giỏ) chưa chắc là vấn đề.`,
      ),
      source: src('10.3', 'Locating the bottleneck', 'Bốn bước tìm nút thắt'),
    };
  },
};

const randIdx = (rng: Rng, len: number) => Math.floor(rng() * len);

const bottleneckChannel: QuestionTemplate = {
  id: 'bn-channel',
  category: 'bottleneck',
  make: (rng) => {
    const names = shuffle(rng, [both('Shopee', 'Shopee'), both('TikTok Shop', 'TikTok Shop'), both('Lazada', 'Lazada'), both('Website (D2C)', 'Website (D2C)'), both('Facebook livestream', 'Livestream Facebook')]).slice(0, 4);
    const loser = randIdx(rng, 4);
    const rows = names.map((nm, i) => {
      const rev = between(rng, 300, 1500, 50) * M;
      const cm = i === loser ? -between(rng, 3, 8) / 100 : between(rng, 4, 20) / 100;
      return { nm, rev: i === loser ? Math.max(rev, 1100 * M) : rev, cm };
    });
    return {
      id: 'bn-channel',
      kind: 'spot',
      category: 'bottleneck',
      prompt: both('Which channel destroys profit even though its revenue looks good? Tap it.', 'Kênh nào đang “đốt” lợi nhuận dù doanh thu trông đẹp? Chạm vào kênh đó.'),
      segments: rows.map((r) => bi((l) => `${r.nm[l]}\n${l === 'en' ? 'Revenue' : 'Doanh thu'} ${m(r.rev, l)}\n${l === 'en' ? 'Contribution' : 'Đóng góp'} ${r.cm >= 0 ? '+' : ''}${p(r.cm, l, 0)} = ${m(r.rev * r.cm, l)}`)),
      answer: loser,
      explanation: bi((l) =>
        l === 'en'
          ? `${rows[loser]!.nm.en} has a negative contribution margin: every extra sale loses money after fees, vouchers, shipping and ads. Revenue by channel must always be read with contribution by channel.`
          : `${rows[loser]!.nm.vi} có biên lợi nhuận đóng góp âm: bán thêm đơn nào lỗ đơn đó sau phí, voucher, vận chuyển và quảng cáo. Doanh thu theo kênh luôn phải đọc cùng đóng góp theo kênh.`,
      ),
      source: src('19.1', 'Revenue by channel also needs analysis (Nike)', 'Doanh thu theo kênh cũng cần phân tích (Nike)'),
    };
  },
};

const bottleneckSku: QuestionTemplate = {
  id: 'bn-sku',
  category: 'bottleneck',
  make: (rng) => {
    const names = shuffle(rng, [
      both('Sunscreen 50ml', 'Kem chống nắng 50ml'),
      both('Serum 30ml', 'Serum 30ml'),
      both('Cleanser 150ml', 'Sữa rửa mặt 150ml'),
      both('Lip tint', 'Son tint'),
      both('Toner 200ml', 'Toner 200ml'),
    ]).slice(0, 4);
    const rows = names.map((nm) => ({ nm, units: between(rng, 300, 1500, 50), cm: between(rng, 8, 45) * K }));
    // The best seller loses money once returns are counted.
    const star = randIdx(rng, 4);
    rows[star]!.units = 3000 + between(rng, 0, 1500, 100);
    rows[star]!.cm = -between(rng, 6, 15) * K;
    return {
      id: 'bn-sku',
      kind: 'spot',
      category: 'bottleneck',
      prompt: both('Which product should the team fix first? Tap it.', 'Đội nên sửa sản phẩm nào trước? Chạm vào sản phẩm đó.'),
      context: both('Units sold this month and contribution per unit after returns, fees and ads.', 'Số bán tháng này và đóng góp mỗi sản phẩm sau hoàn hàng, phí và quảng cáo.'),
      segments: rows.map((r) => bi((l) => `${r.nm[l]}\n${n(r.units, l)} ${l === 'en' ? 'units' : 'sp'} · ${r.cm >= 0 ? '+' : ''}${m(r.cm, l)}/${l === 'en' ? 'unit' : 'sp'}\n= ${m(r.units * r.cm, l)}`)),
      answer: star,
      explanation: bi((l) =>
        l === 'en'
          ? `The best seller (${rows[star]!.nm.en}) loses ${m(-rows[star]!.cm, 'en')} on every unit, ${m(-rows[star]!.cm * rows[star]!.units, 'en')} in total. A volume leader can be the biggest profit leak; rank by total contribution, not by units.`
          : `Sản phẩm bán chạy nhất (${rows[star]!.nm.vi}) lỗ ${m(-rows[star]!.cm, 'vi')} mỗi sản phẩm, tổng ${m(-rows[star]!.cm * rows[star]!.units, 'vi')}. Hàng bán chạy có thể là chỗ rò lợi nhuận lớn nhất; hãy xếp theo tổng đóng góp, không theo số bán.`,
      ),
      source: src('13.5', 'Sensitivity analysis', 'Phân tích độ nhạy'),
    };
  },
};

// ───────── Quick maths ─────────

const calcCmOrder: QuestionTemplate = {
  id: 'calc-cm',
  category: 'calc',
  make: (rng) => {
    const price = between(rng, 199, 499, 10) * K;
    const cogs = round(price * (between(rng, 35, 48) / 100), -3);
    const feeRate = between(rng, 12, 18) / 100;
    const fee = round(price * feeRate, -3);
    const ship = between(rng, 10, 25) * K;
    const pack = between(rng, 3, 8) * K;
    const ads = between(rng, 20, 60) * K;
    const ret = between(rng, 5, 15) * K;
    const cm = price - cogs - fee - ship - pack - ads - ret;
    const { options, answer } = numericOptions(rng, cm, [price - cogs, cm + ads, cm + fee], (v, l) => m(v, l));
    const L = (en: string, vi: string) => both(en, vi);
    return {
      id: 'calc-cm',
      kind: 'choice',
      category: 'calc',
      prompt: both('What is the contribution margin per order (after ads)?', 'Lợi nhuận đóng góp mỗi đơn (sau quảng cáo) là bao nhiêu?'),
      table: {
        headers: [L('Line', 'Khoản'), L('Per order', 'Mỗi đơn')],
        rows: [
          row(L('Selling price', 'Giá bán'), bi((l) => m(price, l))),
          row(L('COGS', 'Giá vốn'), bi((l) => m(-cogs, l))),
          row(bi((l) => (l === 'en' ? `Platform fees (${p(feeRate, l, 0)})` : `Phí sàn (${p(feeRate, l, 0)})`)), bi((l) => m(-fee, l))),
          row(L('Shipping subsidy', 'Hỗ trợ vận chuyển'), bi((l) => m(-ship, l))),
          row(L('Packaging', 'Đóng gói'), bi((l) => m(-pack, l))),
          row(L('Ads per order', 'Quảng cáo mỗi đơn'), bi((l) => m(-ads, l))),
          row(L('Returns allowance', 'Dự phòng hoàn hàng'), bi((l) => m(-ret, l))),
        ],
      },
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `Contribution = price − every variable cost of the order = ${m(price, l)} − ${m(cogs + fee + ship + pack + ads + ret, l)} = ${m(cm, l)}. Price − COGS (${m(price - cogs, l)}) is only gross margin.`
          : `Đóng góp = giá − mọi chi phí biến đổi của đơn = ${m(price, l)} − ${m(cogs + fee + ship + pack + ads + ret, l)} = ${m(cm, l)}. Giá − giá vốn (${m(price - cogs, l)}) mới chỉ là lãi gộp.`,
      ),
      source: src('13.3', 'The unit economics worksheet', 'Bảng tính unit economics'),
      timeLimitSec: 45,
    };
  },
};

const calcBreakEvenRoas: QuestionTemplate = {
  id: 'calc-beroas',
  category: 'calc',
  make: (rng) => {
    const mg = pick(rng, [0.1, 0.125, 0.16, 0.2, 0.25, 0.3, 0.4]);
    const be = 1 / mg;
    const { options, answer } = numericOptions(rng, be, [be * 0.5, be * 1.5, 1 + mg * 10], (v, l) => x(v, l, 1));
    return {
      id: 'calc-beroas',
      kind: 'choice',
      category: 'calc',
      prompt: bi((l) =>
        l === 'en'
          ? `Contribution margin before ads is ${p(mg, l, 1)}. What is the break-even ROAS?`
          : `Biên lợi nhuận đóng góp trước quảng cáo là ${p(mg, l, 1)}. ROAS hòa vốn là bao nhiêu?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `Break-even ROAS = 1 / contribution margin = 1 / ${p(mg, l, 1)} = ${x(be, l, 1)}. Any campaign below that loses money, however “good” its ROAS looks.`
          : `ROAS hòa vốn = 1 / biên đóng góp = 1 / ${p(mg, l, 1)} = ${x(be, l, 1)}. Chiến dịch nào thấp hơn mức này là lỗ, dù ROAS trông “đẹp”.`,
      ),
      source: src('15.4', 'Break-even ROAS', 'ROAS hòa vốn'),
    };
  },
};

const calcRoasProfit: QuestionTemplate = {
  id: 'calc-roas',
  category: 'calc',
  make: (rng) => {
    const spend = between(rng, 50, 300, 10) * M;
    const roas = between(rng, 30, 70) / 10;
    const mg = between(rng, 10, 32) / 100;
    const contrib = spend * roas * mg - spend;
    const { options, answer } = numericOptions(rng, contrib, [spend * roas - spend, spend * roas * mg, -contrib], (v, l) => m(v, l));
    return {
      id: 'calc-roas',
      kind: 'choice',
      category: 'calc',
      prompt: bi((l) =>
        l === 'en'
          ? `Ads spend ${m(spend, l)}, ROAS ${x(roas, l, 1)}, contribution margin before ads ${p(mg, l, 0)}. What does the campaign contribute after ads?`
          : `Chi quảng cáo ${m(spend, l)}, ROAS ${x(roas, l, 1)}, biên đóng góp trước quảng cáo ${p(mg, l, 0)}. Chiến dịch đóng góp bao nhiêu sau quảng cáo?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `Revenue ${m(spend * roas, l)} × ${p(mg, l, 0)} = ${m(spend * roas * mg, l)} before ads, minus ${m(spend, l)} ads = ${m(contrib, l)}. ${contrib < 0 ? 'A high ROAS can still lose money.' : 'Profitable, because ROAS is above 1 / margin.'}`
          : `Doanh thu ${m(spend * roas, l)} × ${p(mg, l, 0)} = ${m(spend * roas * mg, l)} trước quảng cáo, trừ ${m(spend, l)} quảng cáo = ${m(contrib, l)}. ${contrib < 0 ? 'ROAS cao vẫn có thể lỗ.' : 'Có lãi, vì ROAS lớn hơn 1 / biên đóng góp.'}`,
      ),
      source: src('15.3', 'ROAS is easily abused', 'ROAS dễ bị lạm dụng'),
      timeLimitSec: 40,
    };
  },
};

const calcClvCac: QuestionTemplate = {
  id: 'calc-clv',
  category: 'calc',
  make: (rng) => {
    const aov = between(rng, 250, 600, 10) * K;
    const mg = between(rng, 20, 35) / 100;
    const orders = between(rng, 2, 6);
    const years = between(rng, 1, 3);
    const cac = between(rng, 100, 400, 10) * K;
    const clv = aov * mg * orders * years;
    const ratio = clv / cac;
    const { options, answer } = numericOptions(rng, ratio, [(aov * orders * years) / cac, (aov * mg * orders) / cac, ratio * 2], (v, l) => x(v, l, 1));
    return {
      id: 'calc-clv',
      kind: 'choice',
      category: 'calc',
      prompt: both('What is the CLV/CAC ratio (CLV measured on contribution)?', 'Tỷ lệ CLV/CAC là bao nhiêu (CLV tính trên lợi nhuận đóng góp)?'),
      table: {
        headers: [both('Input', 'Dữ liệu'), both('Value', 'Giá trị')],
        rows: [
          row(both('AOV', 'Giá trị đơn (AOV)'), bi((l) => m(aov, l))),
          row(both('Contribution margin', 'Biên đóng góp'), bi((l) => p(mg, l, 0))),
          row(both('Orders per year', 'Số đơn mỗi năm'), bi((l) => n(orders, l))),
          row(both('Customer lifetime', 'Vòng đời khách hàng'), bi((l) => (l === 'en' ? `${years} year${years > 1 ? 's' : ''}` : `${years} năm`))),
          row(both('CAC', 'CAC'), bi((l) => m(cac, l))),
        ],
      },
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `CLV = ${m(aov, l)} × ${p(mg, l, 0)} × ${orders} × ${years} = ${m(clv, l)}; ÷ CAC ${m(cac, l)} = ${x(ratio, l, 1)}. Using revenue instead of contribution inflates CLV; and “3x” is a rule of thumb, not a law.`
          : `CLV = ${m(aov, l)} × ${p(mg, l, 0)} × ${orders} × ${years} = ${m(clv, l)}; ÷ CAC ${m(cac, l)} = ${x(ratio, l, 1)}. Tính CLV theo doanh thu sẽ thổi phồng CLV; còn “3 lần” chỉ là kinh nghiệm, không phải định luật.`,
      ),
      source: src('17.1–17.2', 'CLV and CLV/CAC', 'CLV và CLV/CAC'),
      timeLimitSec: 45,
    };
  },
};

const calcPlatformCost: QuestionTemplate = {
  id: 'calc-epcr',
  category: 'calc',
  make: (rng) => {
    const lines = [
      { name: both('Commission', 'Phí hoa hồng'), v: between(rng, 6, 12) / 100 },
      { name: both('Payment fee', 'Phí thanh toán'), v: between(rng, 2, 3) / 100 },
      { name: both('Service fee (freeship/voucher programme)', 'Phí dịch vụ (freeship/voucher)'), v: between(rng, 3, 6) / 100 },
      { name: both('Affiliate / KOC', 'Tiếp thị liên kết / KOC'), v: between(rng, 3, 8) / 100 },
      { name: both('On-platform ads', 'Quảng cáo trên sàn'), v: between(rng, 5, 10) / 100 },
    ];
    const total = lines.reduce((a, b) => a + b.v, 0);
    const { options, answer } = numericOptions(rng, total, [lines[0]!.v, lines[0]!.v + lines[1]!.v, total - lines[4]!.v], (v, l) => p(v, l, 0));
    return {
      id: 'calc-epcr',
      kind: 'choice',
      category: 'calc',
      prompt: both('What is this shop’s Effective Platform Cost Ratio (share of net sales)?', 'Tỷ lệ chi phí sàn thực tế (Effective Platform Cost Ratio) của shop này là bao nhiêu (trên doanh thu thuần)?'),
      table: { headers: [both('Platform-related cost', 'Chi phí liên quan đến sàn'), both('% of net sales', '% doanh thu thuần')], rows: lines.map((li) => row(li.name, bi((l) => p(li.v, l, 0)))) },
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `Add every platform-related cost: ${lines.map((li) => p(li.v, l, 0)).join(' + ')} = ${p(total, l, 0)}. The headline commission (${p(lines[0]!.v, l, 0)}) is only part of what the channel really costs.`
          : `Cộng mọi chi phí liên quan đến sàn: ${lines.map((li) => p(li.v, l, 0)).join(' + ')} = ${p(total, l, 0)}. Phí hoa hồng (${p(lines[0]!.v, l, 0)}) chỉ là một phần chi phí thật của kênh.`,
      ),
      source: src('14.2', 'Effective Platform Cost Ratio', 'Tỷ lệ chi phí sàn thực tế'),
      timeLimitSec: 40,
    };
  },
};

const calcCacCpo: QuestionTemplate = {
  id: 'calc-cac',
  category: 'calc',
  make: (rng) => {
    const spend = between(rng, 100, 400, 20) * M;
    const newCust = between(rng, 1000, 4000, 100);
    const orders = newCust + between(rng, 300, 1500, 100);
    const cac = spend / newCust;
    const { options, answer } = numericOptions(rng, cac, [spend / orders, spend / (orders - newCust), (spend / newCust) * 0.75], (v, l) => m(round(v, -2), l));
    return {
      id: 'calc-cac',
      kind: 'choice',
      category: 'calc',
      prompt: bi((l) =>
        l === 'en'
          ? `Acquisition ads cost ${m(spend, l)} and produced ${n(orders, l)} orders from ${n(newCust, l)} new customers. What is the CAC?`
          : `Quảng cáo kéo khách tốn ${m(spend, l)}, tạo ${n(orders, l)} đơn từ ${n(newCust, l)} khách mới. CAC là bao nhiêu?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `CAC = spend / new customers = ${m(spend, l)} / ${n(newCust, l)} = ${m(round(cac, -2), l)}. Spend / orders (${m(round(spend / orders, -2), l)}) is CPO, not CAC: returning customers are not “acquired”.`
          : `CAC = chi phí / khách mới = ${m(spend, l)} / ${n(newCust, l)} = ${m(round(cac, -2), l)}. Chi phí / số đơn (${m(round(spend / orders, -2), l)}) là CPO, không phải CAC: khách cũ không phải khách “mới kéo về”.`,
      ),
      source: src('15.2', 'CPA, CPO and CAC', 'CPA, CPO và CAC'),
    };
  },
};

const calcShopee: QuestionTemplate = {
  id: 'calc-shopee',
  category: 'calc',
  make: (rng) => {
    const net = between(rng, 20, 40) * 100 * M;
    const parts = [
      { name: both('COGS', 'Giá vốn'), r: between(rng, 40, 48) / 100 },
      { name: both('Platform / payment / service', 'Phí sàn / thanh toán / dịch vụ'), r: between(rng, 12, 15) / 100 },
      { name: both('Logistics subsidy', 'Hỗ trợ vận chuyển'), r: between(rng, 5, 8) / 100 },
      { name: both('Affiliate / KOC', 'Tiếp thị liên kết / KOC'), r: between(rng, 6, 9) / 100 },
      { name: both('Seller voucher', 'Voucher của shop'), r: between(rng, 5, 7) / 100 },
      { name: both('Ads', 'Quảng cáo'), r: between(rng, 9, 12) / 100 },
    ];
    const cm = 1 - parts.reduce((a, b) => a + b.r, 0);
    const { options, answer } = numericOptions(rng, cm, [1 - parts[0]!.r, cm + parts[5]!.r, cm / 2], (v, l) => p(v, l, 1));
    return {
      id: 'calc-shopee',
      kind: 'choice',
      category: 'calc',
      prompt: bi((l) =>
        l === 'en'
          ? `A cosmetics shop made ${m(net, l)} net sales on Shopee this month. What is its contribution margin?`
          : `Một shop mỹ phẩm có doanh thu thuần ${m(net, l)} trên Shopee tháng này. Biên lợi nhuận đóng góp là bao nhiêu?`,
      ),
      table: {
        headers: [both('Cost line', 'Khoản chi'), both('% of net sales', '% doanh thu thuần'), both('Amount', 'Số tiền')],
        rows: parts.map((pt) => row(pt.name, bi((l) => p(pt.r, l, 0)), bi((l) => m(-net * pt.r, l)))),
      },
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `100% − ${parts.map((pt) => p(pt.r, l, 0)).join(' − ')} = ${p(cm, l, 1)}, i.e. ${m(net * cm, l)}. “Sales of billions” and a single-digit contribution can both be true.`
          : `100% − ${parts.map((pt) => p(pt.r, l, 0)).join(' − ')} = ${p(cm, l, 1)}, tức ${m(net * cm, l)}. “Doanh số hàng tỷ” và biên đóng góp chỉ một con số có thể cùng đúng.`,
      ),
      source: src('14.1', '“Sales of VND 3 billion, but how much profit?”', '“Doanh số 3 tỷ, nhưng lãi bao nhiêu?”'),
      timeLimitSec: 45,
    };
  },
};

const calcPayback: QuestionTemplate = {
  id: 'calc-payback',
  category: 'calc',
  make: (rng) => {
    const cac = between(rng, 120, 360, 20) * K;
    const aov = between(rng, 200, 500, 10) * K;
    const mg = between(rng, 20, 35) / 100;
    const perMonth = between(rng, 3, 10) / 10;
    const monthly = aov * mg * perMonth;
    const months = cac / monthly;
    const { options, answer } = numericOptions(rng, months, [cac / (aov * perMonth), cac / (aov * mg), months * 2], (v, l) => (l === 'en' ? `${n(v, l, 1)} months` : `${n(v, l, 1)} tháng`));
    return {
      id: 'calc-payback',
      kind: 'choice',
      category: 'calc',
      prompt: bi((l) =>
        l === 'en'
          ? `CAC ${m(cac, l)}. A new customer orders ${n(perMonth, l, 1)} times a month, AOV ${m(aov, l)}, contribution margin ${p(mg, l, 0)}. How long until the CAC is paid back?`
          : `CAC ${m(cac, l)}. Khách mới mua ${n(perMonth, l, 1)} lần mỗi tháng, AOV ${m(aov, l)}, biên đóng góp ${p(mg, l, 0)}. Bao lâu thì hoàn vốn CAC?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `Monthly contribution = ${m(aov, l)} × ${p(mg, l, 0)} × ${n(perMonth, l, 1)} = ${m(monthly, l)}; payback = ${m(cac, l)} / ${m(monthly, l)} = ${n(months, l, 1)} months. Use contribution, not revenue.`
          : `Đóng góp mỗi tháng = ${m(aov, l)} × ${p(mg, l, 0)} × ${n(perMonth, l, 1)} = ${m(monthly, l)}; hoàn vốn = ${m(cac, l)} / ${m(monthly, l)} = ${n(months, l, 1)} tháng. Dùng đóng góp, không dùng doanh thu.`,
      ),
      source: src('Table 9.3', 'Payback as a guardrail for new customers', 'Thời gian hoàn vốn là chỉ số chặn cho khách mới'),
      timeLimitSec: 45,
    };
  },
};

// ───────── Which lever pays ─────────

function baseline(rng: Rng) {
  const traffic = between(rng, 60, 200, 10) * K;
  const cr = between(rng, 12, 30) / 1000;
  const aov = between(rng, 220, 480, 10) * K;
  const mg = between(rng, 15, 28) / 100;
  const rr = between(rng, 6, 14) / 100;
  const retCost = between(rng, 40, 90, 5) * K;
  const orders = traffic * cr;
  return { traffic, cr, aov, mg, rr, retCost, orders, contrib: orders * aov * mg };
}

const leverRank: QuestionTemplate = {
  id: 'lever-rank',
  category: 'lever',
  make: (rng) => {
    let b = baseline(rng);
    let levers: { name: T; gain: number }[] = [];
    for (let tries = 0; tries < 40; tries++) {
      b = baseline(rng);
      const tUp = between(rng, 10, 20) / 100;
      const crUp = between(rng, 2, 5) / 1000;
      const aovUp = between(rng, 5, 15) / 100;
      const rrDown = between(rng, 2, 5) / 100;
      levers = [
        { name: bi((l) => (l === 'en' ? `+${p(tUp, l, 0)} sessions` : `+${p(tUp, l, 0)} lượt truy cập`)), gain: b.contrib * tUp },
        { name: bi((l) => (l === 'en' ? `CR +${pp(crUp, l, 1)}` : `CR +${pp(crUp, l, 1)}`)), gain: b.contrib * (crUp / b.cr) },
        { name: bi((l) => (l === 'en' ? `AOV +${p(aovUp, l, 0)}` : `AOV +${p(aovUp, l, 0)}`)), gain: b.contrib * aovUp },
        { name: bi((l) => (l === 'en' ? `Return rate −${pp(rrDown, l, 0)}` : `Tỷ lệ hoàn −${pp(rrDown, l, 0)}`)), gain: b.orders * rrDown * b.retCost },
      ];
      const sorted = levers.map((v) => v.gain).sort((a, c) => c - a);
      if (sorted.every((v, i) => i === 0 || sorted[i - 1]! > v * 1.12)) break;
    }
    const ranked = levers.slice().sort((a, c) => c.gain - a.gain);
    return {
      id: 'lever-rank',
      kind: 'order',
      category: 'lever',
      prompt: both('Rank these improvements by extra monthly contribution, biggest first.', 'Xếp các cải thiện theo lợi nhuận đóng góp tăng thêm mỗi tháng, lớn nhất trước.'),
      table: {
        headers: [both('Baseline', 'Hiện tại'), both('Value', 'Giá trị')],
        rows: [
          row(both('Sessions / month', 'Truy cập / tháng'), bi((l) => n(b.traffic, l))),
          row(both('Conversion rate', 'Tỷ lệ chuyển đổi'), bi((l) => p(b.cr, l, 1))),
          row(both('AOV', 'AOV'), bi((l) => m(b.aov, l))),
          row(both('Contribution margin', 'Biên đóng góp'), bi((l) => p(b.mg, l, 0))),
          row(both('Return rate · cost per return', 'Tỷ lệ hoàn · chi phí mỗi đơn hoàn'), bi((l) => `${p(b.rr, l, 0)} · ${m(b.retCost, l)}`)),
        ],
      },
      items: ranked.map((v) => v.name),
      explanation: bi((l) =>
        (l === 'en' ? 'Monthly gain: ' : 'Lợi nhuận tăng mỗi tháng: ') +
        ranked.map((v) => `${v.name[l]} ≈ ${m(v.gain, l)}`).join(' · ') +
        (l === 'en' ? '. Put every lever into currency before choosing; a relative CR change is worth CR-change ÷ CR.' : '. Quy mọi đòn bẩy ra tiền trước khi chọn; thay đổi CR có giá trị bằng mức tăng ÷ CR hiện tại.'),
      ),
      source: src('10.1–10.2', 'Converting a point into currency', 'Quy một điểm % ra tiền'),
      timeLimitSec: 60,
    };
  },
};

const leverBest: QuestionTemplate = {
  id: 'lever-best',
  category: 'lever',
  make: (rng) => {
    const b = baseline(rng);
    const opts = [
      { name: both('Speed up checkout (CR +0.3 pp), costs 40 million', 'Tăng tốc thanh toán (CR +0,3 điểm %), tốn 40 triệu'), gain: b.contrib * (0.003 / b.cr) - 40 * M },
      { name: both('Buy 30% more traffic at the same CR, costs 30% more ads (ads = 8% of revenue)', 'Mua thêm 30% traffic với CR không đổi, tốn thêm 30% quảng cáo (quảng cáo = 8% doanh thu)'), gain: b.contrib * 0.3 - b.orders * b.aov * 0.08 * 0.3 },
      { name: both('Bundle to lift AOV 8%, costs 25 million', 'Bán combo tăng AOV 8%, tốn 25 triệu'), gain: b.contrib * 0.08 - 25 * M },
      { name: both('Halve returns with better size/shade guides, costs 20 million', 'Giảm một nửa hoàn hàng nhờ hướng dẫn chọn size/màu, tốn 20 triệu'), gain: b.orders * (b.rr / 2) * b.retCost - 20 * M },
    ];
    const bestIdx = opts.reduce((bi2, o, i) => (o.gain > opts[bi2]!.gain ? i : bi2), 0);
    const ordered = [opts[bestIdx]!, ...opts.filter((_, i) => i !== bestIdx)];
    const { options, answer } = textOptions(rng, ordered.map((o) => o.name));
    return {
      id: 'lever-best',
      kind: 'choice',
      category: 'lever',
      prompt: both('You can fund only one project this month. Which adds the most contribution (net of its cost)?', 'Tháng này chỉ làm được một dự án. Dự án nào tăng lợi nhuận đóng góp nhiều nhất (đã trừ chi phí)?'),
      table: {
        headers: [both('Baseline', 'Hiện tại'), both('Value', 'Giá trị')],
        rows: [
          row(both('Orders / month', 'Đơn / tháng'), bi((l) => n(b.orders, l))),
          row(both('Conversion rate', 'Tỷ lệ chuyển đổi'), bi((l) => p(b.cr, l, 1))),
          row(both('AOV', 'AOV'), bi((l) => m(b.aov, l))),
          row(both('Contribution margin', 'Biên đóng góp'), bi((l) => p(b.mg, l, 0))),
          row(both('Return rate · cost per return', 'Tỷ lệ hoàn · chi phí mỗi đơn hoàn'), bi((l) => `${p(b.rr, l, 0)} · ${m(b.retCost, l)}`)),
        ],
      },
      options,
      answer,
      explanation: bi((l) => opts.map((o) => `${o.name[l]}: ${o.gain >= 0 ? '+' : ''}${m(o.gain, l)}`).join(' · ')),
      source: src('13.5', 'Which line is the most powerful lever', 'Đòn bẩy nào mạnh nhất'),
      timeLimitSec: 75,
    };
  },
};

const leverSensitivity: QuestionTemplate = {
  id: 'lever-sens',
  category: 'lever',
  make: (rng) => {
    const price = between(rng, 250, 450, 10) * K;
    const lines = [
      { name: both('COGS', 'Giá vốn'), v: round(price * (between(rng, 36, 46) / 100), -3) },
      { name: both('Platform fees', 'Phí sàn'), v: round(price * (between(rng, 12, 18) / 100), -3) },
      { name: both('Shipping', 'Vận chuyển'), v: between(rng, 15, 35) * K },
      { name: both('Ads per order', 'Quảng cáo mỗi đơn'), v: between(rng, 25, 70) * K },
    ];
    const cm = price - lines.reduce((a, b) => a + b.v, 0);
    const sorted = lines.slice().sort((a, b) => b.v - a.v);
    const { options, answer } = textOptions(rng, sorted.map((li) => li.name));
    return {
      id: 'lever-sens',
      kind: 'choice',
      category: 'lever',
      prompt: both('Each cost line could rise 10% next quarter. Which rise would hurt contribution per order the most?', 'Quý tới mỗi khoản chi có thể tăng 10%. Khoản nào tăng sẽ làm giảm đóng góp mỗi đơn nhiều nhất?'),
      table: {
        headers: [both('Per order', 'Mỗi đơn'), both('Amount', 'Số tiền')],
        rows: [row(both('Price', 'Giá bán'), bi((l) => m(price, l))), ...lines.map((li) => row(li.name, bi((l) => m(-li.v, l)))), row(both('Contribution', 'Đóng góp'), bi((l) => m(cm, l)))],
      },
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `+10% on ${sorted[0]!.name.en} costs ${m(sorted[0]!.v * 0.1, l)} per order, ${p((sorted[0]!.v * 0.1) / Math.max(cm, 1), l, 0)} of today’s contribution. The biggest line is the most dangerous one.`
          : `+10% ${sorted[0]!.name.vi} làm mất ${m(sorted[0]!.v * 0.1, l)} mỗi đơn, bằng ${p((sorted[0]!.v * 0.1) / Math.max(cm, 1), l, 0)} đóng góp hiện tại. Khoản lớn nhất là khoản nguy hiểm nhất.`,
      ),
      source: src('13.5', 'Sensitivity analysis', 'Phân tích độ nhạy'),
    };
  },
};

const leverCrPoint: QuestionTemplate = {
  id: 'lever-crpt',
  category: 'lever',
  make: (rng) => {
    const b = baseline(rng);
    const up = pick(rng, [0.002, 0.003, 0.005]);
    const gain = b.traffic * up * b.aov * b.mg;
    const { options, answer } = numericOptions(rng, gain, [b.traffic * up * b.aov, gain * 10, gain / 2], (v, l) => m(v, l));
    return {
      id: 'lever-crpt',
      kind: 'choice',
      category: 'lever',
      prompt: bi((l) =>
        l === 'en'
          ? `${n(b.traffic, l)} sessions a month, AOV ${m(b.aov, l)}, contribution margin ${p(b.mg, l, 0)}. What is CR +${pp(up, l, 1)} worth per month in contribution?`
          : `${n(b.traffic, l)} lượt truy cập mỗi tháng, AOV ${m(b.aov, l)}, biên đóng góp ${p(b.mg, l, 0)}. CR tăng ${pp(up, l, 1)} đáng bao nhiêu lợi nhuận đóng góp mỗi tháng?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `${n(b.traffic, l)} × ${pp(up, l, 1)} = ${n(b.traffic * up, l)} extra orders × ${m(b.aov, l)} × ${p(b.mg, l, 0)} = ${m(gain, l)}. Without the margin you would quote revenue (${m(b.traffic * up * b.aov, l)}), not profit.`
          : `${n(b.traffic, l)} × ${pp(up, l, 1)} = ${n(b.traffic * up, l)} đơn thêm × ${m(b.aov, l)} × ${p(b.mg, l, 0)} = ${m(gain, l)}. Quên nhân biên thì bạn đang nói doanh thu (${m(b.traffic * up * b.aov, l)}), không phải lợi nhuận.`,
      ),
      source: src('10.1', 'Converting one percentage point into currency', 'Quy một điểm % ra tiền'),
      timeLimitSec: 45,
    };
  },
};

// ───────── Goodhart traps ─────────

const GUARDRAILS: Array<{ target: T; risk: T; guard: T }> = [
  { target: both('Conversion rate', 'Tỷ lệ chuyển đổi'), risk: both('deep discounting to force conversion', 'giảm giá sâu để ép chuyển đổi'), guard: both('Contribution margin per order', 'Lợi nhuận đóng góp mỗi đơn') },
  { target: both('Average order value', 'Giá trị đơn trung bình'), risk: both('cross-selling thin-margin items', 'bán kèm hàng biên thấp'), guard: both('Gross margin per order', 'Lãi gộp mỗi đơn') },
  { target: both('Traffic', 'Lượt truy cập'), risk: both('buying cheap, low-quality traffic', 'mua traffic rẻ, kém chất lượng'), guard: both('CR and cost per new customer', 'CR và chi phí mỗi khách mới') },
  { target: both('New customers', 'Số khách mới'), risk: both('heavy promotions attracting bargain hunters', 'khuyến mãi mạnh hút người săn giá'), guard: both('Second-purchase rate and CAC payback', 'Tỷ lệ mua lần hai và thời gian hoàn vốn CAC') },
  { target: both('Delivery speed', 'Tốc độ giao hàng'), risk: both('using the fast, expensive service for every order', 'dùng dịch vụ nhanh, đắt cho mọi đơn'), guard: both('Fulfillment cost per order', 'Chi phí xử lý mỗi đơn') },
  { target: both('Return rate', 'Tỷ lệ hoàn hàng'), risk: both('tightening the returns policy', 'siết chính sách đổi trả'), guard: both('Satisfaction and 60-day repeat rate', 'Mức hài lòng và tỷ lệ mua lại 60 ngày') },
];

const goodhartGuardrail: QuestionTemplate = {
  id: 'gh-guard',
  category: 'goodhart',
  make: (rng) => {
    const idx = randIdx(rng, GUARDRAILS.length);
    const g = GUARDRAILS[idx]!;
    const others = shuffle(rng, GUARDRAILS.filter((_, i) => i !== idx)).slice(0, 3);
    const { options, answer } = textOptions(rng, [g.guard, ...others.map((o) => o.guard)]);
    return {
      id: 'gh-guard',
      kind: 'choice',
      category: 'goodhart',
      prompt: bi((l) => (l === 'en' ? `The team’s bonus target is “${g.target.en}”. Which guardrail metric must go with it?` : `Thưởng của đội gắn với chỉ tiêu “${g.target.vi}”. Phải kèm chỉ số chặn (guardrail) nào?`)),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `The cheap way to hit “${g.target.en}” is ${g.risk.en}. The guardrail “${g.guard.en}” must not fall below an agreed floor. A target without a guardrail invites short-term gaming.`
          : `Cách rẻ nhất để đạt “${g.target.vi}” là ${g.risk.vi}. Chỉ số chặn “${g.guard.vi}” không được giảm dưới mức đã thống nhất. Chỉ tiêu không có chỉ số chặn là mời gọi tối ưu ngắn hạn.`,
      ),
      source: src('5.3, Table 9.3', 'Guardrail metrics', 'Chỉ số chặn'),
    };
  },
};

const VANITY: Array<{ vanity: T; decision: T }> = [
  { vanity: both('GMV including cancelled and returned orders', 'GMV gồm cả đơn hủy và đơn hoàn'), decision: both('Net sales and contribution after all variable costs', 'Doanh thu thuần và đóng góp sau mọi chi phí biến đổi') },
  { vanity: both('Total number of orders', 'Tổng số đơn'), decision: both('Orders with a positive contribution margin', 'Số đơn có lợi nhuận đóng góp dương') },
  { vanity: both('App downloads', 'Lượt tải ứng dụng'), decision: both('Share of users placing a 2nd order within 60 days', 'Tỷ lệ người dùng đặt đơn thứ 2 trong 60 ngày') },
  { vanity: both('Account-level ROAS', 'ROAS toàn tài khoản'), decision: both('Incremental ROAS by campaign group', 'ROAS tăng thêm theo nhóm chiến dịch') },
  { vanity: both('Number of chats with the AI assistant', 'Số cuộc trò chuyện với trợ lý AI'), decision: both('AI-assisted conversion and incremental profit from AI', 'Chuyển đổi có AI hỗ trợ và lợi nhuận tăng thêm nhờ AI') },
];

const goodhartVanity: QuestionTemplate = {
  id: 'gh-vanity',
  category: 'goodhart',
  make: (rng) => {
    const idx = randIdx(rng, VANITY.length);
    const others = shuffle(rng, VANITY.filter((_, i) => i !== idx)).slice(0, 3);
    const { options, answer } = textOptions(rng, [VANITY[idx]!.vanity, ...others.map((o) => o.decision)]);
    return {
      id: 'gh-vanity',
      kind: 'choice',
      category: 'goodhart',
      prompt: both('Which one is a vanity metric that should not sit on the CEO dashboard?', 'Chỉ số nào là chỉ số cho đẹp (vanity), không nên nằm trên bảng điều khiển của CEO?'),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `“${VANITY[idx]!.vanity.en}” does not tell you what to do. Use “${VANITY[idx]!.decision.en}” instead. Quick test: if you cannot finish “If this metric fell 20%, I would…”, it is vanity.`
          : `“${VANITY[idx]!.vanity.vi}” không cho biết phải làm gì. Hãy dùng “${VANITY[idx]!.decision.vi}”. Phép thử nhanh: nếu không hoàn thành được câu “Nếu chỉ số này giảm 20%, tôi sẽ…”, đó là chỉ số cho đẹp.`,
      ),
      source: src('18.1 / 47.1', 'Vanity metrics and decision metrics', 'Chỉ số cho đẹp và chỉ số ra quyết định'),
    };
  },
};

const GAMING: Array<{ scenario: T; kind: 0 | 1 | 2 }> = [
  { scenario: both('The delivery team reports on-time rate using only delivered orders, leaving out cancelled ones.', 'Đội giao hàng báo tỷ lệ đúng hẹn chỉ tính đơn đã giao, bỏ đơn bị hủy.'), kind: 1 },
  { scenario: both('A quarter-end flash sale pulls next month’s orders into this quarter.', 'Flash sale cuối quý kéo đơn của tháng sau về quý này.'), kind: 2 },
  { scenario: both('Marketing hits its CR target by promising same-day delivery, and operations pays for it.', 'Marketing đạt chỉ tiêu CR bằng cách hứa giao trong ngày, còn vận hành phải gánh chi phí.'), kind: 0 },
  { scenario: both('Customer service closes tickets quickly by transferring hard cases to the warehouse.', 'Chăm sóc khách hàng đóng ticket nhanh bằng cách chuyển ca khó sang kho.'), kind: 0 },
  { scenario: both('The returns KPI counts only returns approved by the shop, not requests refused.', 'KPI hoàn hàng chỉ đếm yêu cầu shop chấp nhận, không đếm yêu cầu bị từ chối.'), kind: 1 },
  { scenario: both('Sales offers pre-orders with a big discount so this month’s revenue target is met.', 'Bán hàng mở đặt trước giảm sâu để đạt chỉ tiêu doanh thu tháng này.'), kind: 2 },
];
const GAMING_NAMES: T[] = [both('Cost shifting', 'Đẩy chi phí sang bộ phận khác'), both('Shrinking the denominator', 'Thu nhỏ mẫu số'), both('Borrowing from the future', 'Vay của tương lai')];

const goodhartGaming: QuestionTemplate = {
  id: 'gh-gaming',
  category: 'goodhart',
  make: (rng) => {
    const s = pick(rng, GAMING);
    const list = [GAMING_NAMES[s.kind]!, ...GAMING_NAMES.filter((_, i) => i !== s.kind), both('Not gaming: a real improvement', 'Không phải gian lận: cải thiện thật')];
    const { options, answer } = textOptions(rng, list);
    return {
      id: 'gh-gaming',
      kind: 'choice',
      category: 'goodhart',
      prompt: both('How is this KPI being gamed?', 'Chỉ số này đang bị “làm đẹp” theo cách nào?'),
      context: s.scenario,
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `${GAMING_NAMES[s.kind]!.en}. The three signs: cost shifting (one team looks good, another pays), shrinking the denominator (drop the hard cases), borrowing from the future (this period looks good, the next looks bad).`
          : `${GAMING_NAMES[s.kind]!.vi}. Ba dấu hiệu: đẩy chi phí (đội này đẹp, đội kia trả giá), thu nhỏ mẫu số (bỏ phần khó), vay của tương lai (kỳ này đẹp, kỳ sau xấu).`,
      ),
      source: src('5.2', 'Goodhart’s law in e-commerce', 'Định luật Goodhart trong TMĐT'),
    };
  },
};

const goodhartRatio: QuestionTemplate = {
  id: 'gh-ratio',
  category: 'goodhart',
  make: (rng) => {
    const good = pick(rng, [both('Contribution margin per order', 'Lợi nhuận đóng góp mỗi đơn'), both('Cost per new customer', 'Chi phí mỗi khách mới'), both('Conversion rate', 'Tỷ lệ chuyển đổi')]);
    const bad = shuffle(rng, [both('Revenue year-to-date', 'Doanh thu lũy kế từ đầu năm'), both('Total followers', 'Tổng số người theo dõi'), both('Orders since launch', 'Tổng số đơn từ khi mở shop'), both('Total reviews received', 'Tổng số đánh giá đã nhận')]).slice(0, 3);
    const { options, answer } = textOptions(rng, [good, ...bad]);
    return {
      id: 'gh-ratio',
      kind: 'choice',
      category: 'goodhart',
      prompt: both('Which metric qualifies as a management metric for weekly decisions?', 'Chỉ số nào đủ tiêu chuẩn làm chỉ số quản trị cho quyết định hằng tuần?'),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `“${good.en}” is a ratio/per-unit value with an owner and a lever. Cumulative totals always rise, so they never warn you: a growing shop discovers its problems too late.`
          : `“${good.vi}” là tỷ lệ/giá trị trên đơn vị, có người chịu trách nhiệm và có đòn bẩy. Số lũy kế luôn tăng nên không bao giờ cảnh báo: shop đang lớn thường phát hiện vấn đề quá muộn.`,
      ),
      source: src('5.1', 'Three criteria for a management metric', 'Ba tiêu chí chọn chỉ số quản trị'),
    };
  },
};

const goodhartRoasTarget: QuestionTemplate = {
  id: 'gh-roas',
  category: 'goodhart',
  make: (rng) => {
    const right = both('ROAS rises, but new customers fall to almost zero and growth stalls', 'ROAS tăng, nhưng khách mới gần như về 0 và tăng trưởng chững lại');
    const { options, answer } = textOptions(rng, [
      right,
      both('ROAS rises and profit rises with it, every time', 'ROAS tăng và lợi nhuận luôn tăng theo'),
      both('ROAS falls because retargeting is expensive', 'ROAS giảm vì quảng cáo nhắm lại rất đắt'),
      both('Nothing changes: ROAS cannot be gamed', 'Không có gì thay đổi: ROAS không thể bị làm đẹp'),
    ]);
    return {
      id: 'gh-roas',
      kind: 'choice',
      category: 'goodhart',
      prompt: both('The ads team gets a ROAS target and moves budget into retargeting people who were going to buy anyway. What happens?', 'Đội quảng cáo nhận chỉ tiêu ROAS và dồn ngân sách vào nhắm lại những người đằng nào cũng mua. Điều gì xảy ra?'),
      options,
      answer,
      explanation: both(
        'Retargeting buyers who would buy anyway inflates attributed ROAS while bringing almost no incremental customers. Measure incremental ROAS with a holdout test, and pair ROAS with new-customer volume.',
        'Nhắm lại người đằng nào cũng mua làm ROAS ghi nhận tăng, nhưng gần như không có khách tăng thêm. Hãy đo ROAS tăng thêm bằng nhóm đối chứng (holdout), và đọc ROAS cùng số khách mới.',
      ),
      source: src('5.2', 'Goodhart’s law: setting a ROAS target', 'Goodhart: đặt chỉ tiêu ROAS'),
    };
  },
};

// ───────── KPI pairs ─────────

const PAIRS: Array<[T, T]> = [
  [both('Revenue', 'Doanh thu'), both('Profit', 'Lợi nhuận')],
  [both('CAC', 'CAC'), both('CLV', 'CLV')],
  [both('Traffic', 'Lượt truy cập'), both('Conversion', 'Chuyển đổi')],
  [both('AOV', 'AOV'), both('Margin', 'Biên lợi nhuận')],
  [both('Growth', 'Tăng trưởng'), both('Retention', 'Giữ chân khách')],
];

const pairWhich: QuestionTemplate = {
  id: 'pair-which',
  category: 'pair',
  make: (rng) => {
    const i = randIdx(rng, PAIRS.length);
    const side = rng() < 0.5 ? 0 : 1;
    const shown = PAIRS[i]![side]!;
    const partner = PAIRS[i]![1 - side]!;
    const others = shuffle(rng, PAIRS.filter((_, k) => k !== i).map((pr) => pr[randIdx(rng, 2)]!)).slice(0, 3);
    const { options, answer } = textOptions(rng, [partner, ...others]);
    const up = between(rng, 20, 60);
    return {
      id: 'pair-which',
      kind: 'choice',
      category: 'pair',
      prompt: bi((l) => (l === 'en' ? `“${shown.en} is up ${up}% this quarter!” Which KPI must you read with it before celebrating?` : `“${shown.vi} quý này tăng ${up}%!” Phải đọc kèm KPI nào trước khi ăn mừng?`)),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `${shown.en} ↔ ${partner.en} is one of the five pairs that must always be read together: Revenue↔Profit, CAC↔CLV, Traffic↔Conversion, AOV↔Margin, Growth↔Retention.`
          : `${shown.vi} ↔ ${partner.vi} là một trong năm cặp luôn phải đọc cùng nhau: Doanh thu↔Lợi nhuận, CAC↔CLV, Truy cập↔Chuyển đổi, AOV↔Biên lợi nhuận, Tăng trưởng↔Giữ chân khách.`,
      ),
      source: src('27.5', 'The 5 KPI pairs', '5 cặp KPI'),
    };
  },
};

const pairTrafficCr: QuestionTemplate = {
  id: 'pair-traffic',
  category: 'pair',
  make: (rng) => {
    const tUp = between(rng, 30, 80) / 100;
    const cr0 = between(rng, 20, 32) / 1000;
    const cr1 = cr0 * (1 - between(rng, 25, 45) / 100);
    const ch = (1 + tUp) * (cr1 / cr0) - 1;
    const { options, answer } = numericOptions(rng, ch, [tUp, (1 + tUp) * (cr0 / cr1) - 1, -ch], (v, l) => `${v >= 0 ? '+' : ''}${p(v, l, 0)}`);
    return {
      id: 'pair-traffic',
      kind: 'choice',
      category: 'pair',
      prompt: bi((l) =>
        l === 'en'
          ? `A creator campaign lifted traffic +${p(tUp, l, 0)}, but conversion fell from ${p(cr0, l, 1)} to ${p(cr1, l, 1)}. How did orders change?`
          : `Chiến dịch với nhà sáng tạo nội dung tăng traffic +${p(tUp, l, 0)}, nhưng tỷ lệ chuyển đổi giảm từ ${p(cr0, l, 1)} xuống ${p(cr1, l, 1)}. Số đơn thay đổi thế nào?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `Orders = Traffic × CR: ${n(1 + tUp, l, 2)} × ${n(cr1 / cr0, l, 2)} = ${n(1 + ch, l, 2)} → ${ch >= 0 ? '+' : ''}${p(ch, l, 0)}. Traffic without conversion is the classic one-sided reading.`
          : `Số đơn = Traffic × CR: ${n(1 + tUp, l, 2)} × ${n(cr1 / cr0, l, 2)} = ${n(1 + ch, l, 2)} → ${ch >= 0 ? '+' : ''}${p(ch, l, 0)}. Nhìn traffic mà không nhìn chuyển đổi là kiểu đọc một phía điển hình.`,
      ),
      source: src('6 / 27.5', 'Orders = Traffic × CR', 'Số đơn = Traffic × CR'),
      timeLimitSec: 40,
    };
  },
};

const pairAovMargin: QuestionTemplate = {
  id: 'pair-aov',
  category: 'pair',
  make: (rng) => {
    const aov0 = between(rng, 250, 450, 10) * K;
    const gm0 = between(rng, 32, 42) / 100;
    const aov1 = aov0 * (1 + between(rng, 12, 25) / 100);
    const gm1 = gm0 - between(rng, 7, 13) / 100;
    const before = aov0 * gm0;
    const after = aov1 * gm1;
    const ch = after - before;
    const { options, answer } = numericOptions(rng, ch, [aov1 - aov0, after, -ch], (v, l) => `${v >= 0 ? '+' : ''}${m(v, l)}`);
    return {
      id: 'pair-aov',
      kind: 'choice',
      category: 'pair',
      prompt: bi((l) =>
        l === 'en'
          ? `Cross-selling lifted AOV from ${m(aov0, l)} to ${m(aov1, l)}, but gross margin fell from ${p(gm0, l, 0)} to ${p(gm1, l, 0)}. How did gross margin per order change?`
          : `Bán kèm làm AOV tăng từ ${m(aov0, l)} lên ${m(aov1, l)}, nhưng biên lãi gộp giảm từ ${p(gm0, l, 0)} xuống ${p(gm1, l, 0)}. Lãi gộp mỗi đơn thay đổi thế nào?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `${m(aov0, l)} × ${p(gm0, l, 0)} = ${m(before, l)} → ${m(aov1, l)} × ${p(gm1, l, 0)} = ${m(after, l)} (${ch >= 0 ? '+' : ''}${m(ch, l)}). AOV must be read with margin.`
          : `${m(aov0, l)} × ${p(gm0, l, 0)} = ${m(before, l)} → ${m(aov1, l)} × ${p(gm1, l, 0)} = ${m(after, l)} (${ch >= 0 ? '+' : ''}${m(ch, l)}). AOV phải đọc cùng biên lợi nhuận.`,
      ),
      source: src('11.1 / 27.5', 'AOV ↔ Margin', 'AOV ↔ Biên lợi nhuận'),
      timeLimitSec: 45,
    };
  },
};

const pairCacClv: QuestionTemplate = {
  id: 'pair-cac',
  category: 'pair',
  make: (rng) => {
    const chans = shuffle(rng, [both('TikTok creators', 'Nhà sáng tạo TikTok'), both('Google Search', 'Google Search'), both('Shopee ads', 'Quảng cáo Shopee')]);
    const rows = chans.map((c) => {
      const cac = between(rng, 60, 260, 10) * K;
      const clv = cac * (between(rng, 8, 45) / 10);
      return { c, cac, clv };
    });
    // Make the cheapest CAC not the best CLV/CAC.
    rows.sort((a, b) => a.cac - b.cac);
    rows[0]!.clv = rows[0]!.cac * (between(rng, 9, 14) / 10);
    rows[2]!.clv = rows[2]!.cac * (between(rng, 38, 50) / 10);
    rows[1]!.clv = rows[1]!.cac * (between(rng, 18, 28) / 10);
    const best = rows.reduce((b, r) => (r.clv / r.cac > b.clv / b.cac ? r : b), rows[0]!);
    const { options, answer } = textOptions(rng, [best.c, ...rows.filter((r) => r !== best).map((r) => r.c), both('All the same: CAC is what matters', 'Như nhau: chỉ cần nhìn CAC')]);
    return {
      id: 'pair-cac',
      kind: 'choice',
      category: 'pair',
      prompt: both('Which acquisition channel deserves more budget?', 'Kênh kéo khách nào xứng đáng được thêm ngân sách?'),
      table: { headers: [both('Channel', 'Kênh'), both('CAC', 'CAC'), both('CLV (contribution)', 'CLV (đóng góp)')], rows: rows.map((r) => row(r.c, bi((l) => m(r.cac, l)), bi((l) => m(r.clv, l)))) },
      options,
      answer,
      explanation: bi((l) => rows.map((r) => `${r.c[l]}: CLV/CAC = ${x(r.clv / r.cac, l, 1)}`).join(' · ') + (l === 'en' ? '. The cheapest CAC brought the least valuable customers.' : '. CAC rẻ nhất lại mang về khách ít giá trị nhất.')),
      source: src('17 / 27.5', 'CAC ↔ CLV', 'CAC ↔ CLV'),
      timeLimitSec: 40,
    };
  },
};

// ───────── CEO cases ─────────

const ceoFeeShock: QuestionTemplate = {
  id: 'ceo-fee',
  category: 'ceo',
  make: (rng) => {
    const net = between(rng, 20, 40) * 100 * M;
    const cm = between(rng, 6, 12) / 100;
    const extra = between(rng, 1, 3) / 100;
    const drop = extra / cm;
    const { options, answer } = numericOptions(rng, drop, [extra, extra * 2, drop / 2], (v, l) => `−${p(v, l, 0)}`);
    return {
      id: 'ceo-fee',
      kind: 'choice',
      category: 'ceo',
      prompt: bi((l) =>
        l === 'en'
          ? `Net sales ${m(net, l)}, contribution margin ${p(cm, l, 0)}. The platform adds new fees worth ${p(extra, l, 0)} of net sales. By how much does contribution fall?`
          : `Doanh thu thuần ${m(net, l)}, biên đóng góp ${p(cm, l, 0)}. Sàn thêm phí mới bằng ${p(extra, l, 0)} doanh thu thuần. Lợi nhuận đóng góp giảm bao nhiêu?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `Contribution ${m(net * cm, l)} − ${m(net * extra, l)} = ${m(net * (cm - extra), l)}: −${p(drop, l, 0)}, while GMV did not change at all. Thin margins amplify every fee change.`
          : `Đóng góp ${m(net * cm, l)} − ${m(net * extra, l)} = ${m(net * (cm - extra), l)}: giảm ${p(drop, l, 0)}, trong khi GMV không đổi. Biên mỏng khuếch đại mọi thay đổi phí.`,
      ),
      source: src('14.1', 'Sensitivity to platform fees', 'Độ nhạy với phí sàn'),
      timeLimitSec: 40,
    };
  },
};

const ceoRoasVerdict: QuestionTemplate = {
  id: 'ceo-roas',
  category: 'ceo',
  make: (rng) => {
    const roas = between(rng, 30, 80) / 10;
    let mg = between(rng, 10, 35) / 100;
    if (Math.abs(roas * mg - 1) < 0.08) mg += 0.05;
    const profitable = roas * mg > 1;
    const right = profitable
      ? both('Profitable: ROAS is above break-even (1 / margin). Scale carefully and check incrementality.', 'Có lãi: ROAS cao hơn mức hòa vốn (1 / biên). Tăng chi thận trọng và kiểm tra phần tăng thêm.')
      : both('Losing money: ROAS is below break-even (1 / margin). Cut or fix it.', 'Đang lỗ: ROAS thấp hơn mức hòa vốn (1 / biên). Cắt hoặc sửa chiến dịch.');
    const wrong = profitable
      ? both('Losing money: any ROAS under 10x loses money.', 'Đang lỗ: ROAS dưới 10x thì luôn lỗ.')
      : both('Profitable: any ROAS above 3x is a great campaign.', 'Có lãi: ROAS trên 3x là chiến dịch tốt.');
    const { options, answer } = textOptions(rng, [right, wrong, both('Cannot tell without the click-through rate', 'Không thể biết nếu thiếu CTR'), both('Only revenue matters for ads', 'Với quảng cáo chỉ cần nhìn doanh thu')]);
    return {
      id: 'ceo-roas',
      kind: 'choice',
      category: 'ceo',
      prompt: bi((l) =>
        l === 'en'
          ? `Marketing celebrates a ROAS of ${x(roas, l, 1)}. Contribution margin before ads is ${p(mg, l, 0)}. Your verdict as CEO?`
          : `Marketing ăn mừng ROAS ${x(roas, l, 1)}. Biên đóng góp trước quảng cáo là ${p(mg, l, 0)}. Kết luận của bạn với vai trò CEO?`,
      ),
      options,
      answer,
      explanation: bi((l) =>
        l === 'en'
          ? `Break-even ROAS = 1 / ${p(mg, l, 0)} = ${x(1 / mg, l, 1)}. Every 1 VND of ads brings ${n(roas * mg, l, 2)} VND of contribution before ads, so the campaign ${profitable ? 'earns' : 'loses'} money.`
          : `ROAS hòa vốn = 1 / ${p(mg, l, 0)} = ${x(1 / mg, l, 1)}. Mỗi 1 đồng quảng cáo mang về ${n(roas * mg, l, 2)} đồng đóng góp trước quảng cáo, nên chiến dịch ${profitable ? 'có lãi' : 'đang lỗ'}.`,
      ),
      source: src('15.3–15.4', 'A 5x ROAS can still lose money', 'ROAS 5x vẫn có thể lỗ'),
    };
  },
};

const ceoFramework: QuestionTemplate = {
  id: 'ceo-frame',
  category: 'ceo',
  make: () => ({
    id: 'ceo-frame',
    kind: 'order',
    category: 'ceo',
    prompt: both('Put the CEO Decision Framework in order.', 'Sắp xếp Khung ra quyết định của CEO theo đúng thứ tự.'),
    items: [
      both('What happened? Which KPI changed', 'Chuyện gì xảy ra? KPI nào thay đổi'),
      both('Where? Channel, product, customer, funnel stage', 'Ở đâu? Kênh, sản phẩm, khách hàng, bước phễu'),
      both('Why? Which driver', 'Vì sao? Yếu tố nào'),
      both('So what? Effect on profit / CLV', 'Ảnh hưởng gì? Tác động lên lợi nhuận / CLV'),
      both('What options do we have', 'Có những phương án nào'),
      both('Decide', 'Quyết định'),
      both('Which KPI will measure the result', 'KPI nào đo kết quả'),
    ],
    explanation: both('DATA → INSIGHT → ECONOMICS → DECISION → KPI: diagnose before you prescribe, and decide how you will measure before you act.', 'DỮ LIỆU → INSIGHT → KINH TẾ → QUYẾT ĐỊNH → KPI: chẩn đoán trước khi kê đơn, và quyết định cách đo trước khi hành động.'),
    source: src('27.3', 'The CEO Decision Framework', 'Khung ra quyết định của CEO'),
    timeLimitSec: 60,
  }),
};

const ceoChewy: QuestionTemplate = {
  id: 'ceo-chewy',
  category: 'ceo',
  make: (rng) => {
    const { options, answer } = textOptions(rng, [
      both('Chewy kept customers ordering again (Autoship), so CLV paid back CAC; Blue Apron bought customers who churned before CAC was recovered', 'Chewy giữ khách mua lại (Autoship) nên CLV bù được CAC; Blue Apron mua khách rồi khách rời đi trước khi hoàn vốn CAC'),
      both('Blue Apron spent too little on marketing', 'Blue Apron chi quá ít cho marketing'),
      both('Chewy had a higher AOV, which is all that matters', 'Chewy có AOV cao hơn, và đó là tất cả'),
      both('Repeat-purchase models always fail', 'Mô hình mua lặp lại luôn thất bại'),
    ]);
    return {
      id: 'ceo-chewy',
      kind: 'choice',
      category: 'ceo',
      prompt: both('Chewy vs Blue Apron: both built on repeat purchase, opposite outcomes. What made the difference?', 'Chewy và Blue Apron: cùng dựa vào mua lặp lại, kết quả trái ngược. Điều gì tạo nên khác biệt?'),
      options,
      answer,
      explanation: both(
        'Growth ↔ Retention and CAC ↔ CLV: subscriptions only work when customers stay long enough for contribution to repay acquisition cost. Read cohorts, not just sign-ups.',
        'Tăng trưởng ↔ Giữ chân và CAC ↔ CLV: mô hình đăng ký chỉ hiệu quả khi khách ở lại đủ lâu để đóng góp bù chi phí kéo khách. Hãy đọc cohort, không chỉ số đăng ký.',
      ),
      source: src('case', 'Chewy contrasted with Blue Apron', 'Chewy đối chiếu Blue Apron'),
    };
  },
};

const ceoCannibal: QuestionTemplate = {
  id: 'ceo-cannibal',
  category: 'ceo',
  make: (rng) => {
    const web = between(rng, 25, 60);
    const shopeeDrop = Math.round(web * (between(rng, 70, 95) / 100));
    const { options, answer } = textOptions(rng, [
      both('Mostly cannibalisation: customers moved channel, the business did not grow much', 'Phần lớn là ăn thịt lẫn nhau: khách đổi kênh, doanh nghiệp không lớn thêm bao nhiêu'),
      both('Incremental growth: the website found new customers', 'Tăng trưởng thật: website tìm được khách mới'),
      both('A data error: channels cannot affect each other', 'Lỗi dữ liệu: các kênh không ảnh hưởng nhau'),
      both('Success: website revenue is all that matters', 'Thành công: chỉ cần doanh thu website tăng'),
    ]);
    return {
      id: 'ceo-cannibal',
      kind: 'choice',
      category: 'ceo',
      prompt: bi((l) =>
        l === 'en'
          ? `A website-only voucher lifted website orders by ${web}%. In the same weeks, Shopee orders from the same customers fell by about ${shopeeDrop}% of that gain. Incremental or cannibalisation?`
          : `Voucher chỉ dùng trên website làm đơn website tăng ${web}%. Cùng thời gian, đơn Shopee của chính những khách đó giảm khoảng ${shopeeDrop}% phần tăng ấy. Tăng thêm thật hay ăn thịt lẫn nhau?`,
      ),
      options,
      answer,
      explanation: both(
        'CEO question 9: is the growth incremental or cannibalisation? Most of the “new” website orders were existing customers switching channel, paid for with a voucher. Use a holdout to measure the incremental part.',
        'Câu hỏi CEO số 9: tăng trưởng là tăng thêm hay ăn thịt lẫn nhau? Phần lớn đơn website “mới” là khách cũ đổi kênh nhờ voucher. Hãy dùng nhóm đối chứng (holdout) để đo phần tăng thêm thật.',
      ),
      source: src('27.6', 'The 10 CEO questions', '10 câu hỏi của CEO'),
    };
  },
};

export const UNIT_ECONOMICS_TEMPLATES: readonly QuestionTemplate[] = [
  bottleneckTree,
  bottleneckFunnel,
  bottleneckChannel,
  bottleneckSku,
  calcCmOrder,
  calcBreakEvenRoas,
  calcRoasProfit,
  calcClvCac,
  calcPlatformCost,
  calcCacCpo,
  calcShopee,
  calcPayback,
  leverRank,
  leverBest,
  leverSensitivity,
  leverCrPoint,
  goodhartGuardrail,
  goodhartVanity,
  goodhartGaming,
  goodhartRatio,
  goodhartRoasTarget,
  pairWhich,
  pairTrafficCr,
  pairAovMargin,
  pairCacClv,
  ceoFeeShock,
  ceoRoasVerdict,
  ceoFramework,
  ceoChewy,
  ceoCannibal,
];
