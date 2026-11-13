// Game 4 case bank. Each game draws 3 cases; the true market size is drawn fresh every game
// (one case lands in each decision zone), and every data source is generated from that truth
// with its own RRRSB bias, so the numbers cannot be copied between rooms.
import { shuffle, type Rng } from '../rng.js';
import type { T } from '../types.js';
import { bi, n } from '../unit/fmt.js';
import type { AiErrorType, MdCasePublic, MdDecision, MdFinding, SourceId } from './types.js';

const t = (en: string, vi: string): T => ({ en, vi });

interface CaseDef {
  id: string;
  title: T;
  question: T;
  context: T;
  /** Typical market size (billion VND / month) at the "pilot" level. */
  base: number;
  /** Average order value, thousand VND. */
  aov: number;
  keyword: string;
  /** Search-to-purchase conversion the trends tool assumes. */
  conv: number;
  /** How much search demand under/over-states real buying. */
  trendFactor: number;
  trendNote: T;
  /** Sold-counter inflation (fake orders) or coverage gap (<1). */
  mktFactor: number;
  mktNote: T;
  socialFactor: number;
  /** True yearly growth. */
  growth: number;
  publisher: string;
  reviewRate: number;
  reviewsInsight: T;
  interviewInsight: T;
  category: T;
  ai: { truths: [T, T, T]; fabricated: T; outdated: T; outdatedWhy: T; bias: T };
}

const CASES: CaseDef[] = [
  {
    id: 'sunscreen',
    title: t('Vegan sunscreen on TikTok Shop', 'Kem chống nắng thuần chay trên TikTok Shop'),
    question: t('How big is the online market for vegan sunscreen in Vietnam each month – and should GreenDew launch?', 'Thị trường online kem chống nắng thuần chay ở Việt Nam lớn bao nhiêu mỗi tháng, và GreenDew có nên tung sản phẩm?'),
    context: t('GreenDew, a local skincare start-up, wants to launch a vegan, reef-safe sunscreen at about 280k VND, sold mainly through TikTok Shop creators and Shopee.', 'GreenDew, một start-up mỹ phẩm Việt, muốn tung kem chống nắng thuần chay, thân thiện với rạn san hô, giá khoảng 280 nghìn đồng, bán chủ yếu qua creator trên TikTok Shop và Shopee.'),
    base: 6, aov: 280, keyword: 'kem chống nắng thuần chay', conv: 0.04,
    trendFactor: 0.5,
    trendNote: t('Relevance: most buyers discover this product in TikTok videos and livestreams and buy on impulse – they never google it. Trends strongly under-estimates.', 'Mức liên quan: phần lớn người mua thấy sản phẩm trong video và livestream TikTok rồi mua ngay, không hề tìm trên Google. Trends đánh giá thấp nhiều.'),
    mktFactor: 1.25,
    mktNote: t('Reliability: sold counters include brushed (fake) orders and returns – platform audits find 15–30%. Over-estimate.', 'Độ tin cậy: số "đã bán" gồm cả đơn ảo và đơn hoàn; kiểm tra của sàn thấy 15–30%. Đánh giá cao.'),
    socialFactor: 2.0, growth: 0.35, publisher: 'Asia Beauty Insights', reviewRate: 0.03,
    reviewsInsight: t('white cast, sticky feel, doubts that it is "really vegan"', 'để lại vệt trắng, bết dính, nghi ngờ "có thật thuần chay không"'),
    interviewInsight: t('most found such products through TikTok creators, not Google; the price ceiling is about 300k; they want proof of vegan certification.', 'đa số biết sản phẩm qua creator TikTok, không phải Google; giá trần khoảng 300 nghìn; muốn có chứng nhận thuần chay.'),
    category: t('online sunscreen (all types)', 'kem chống nắng bán online (mọi loại)'),
    ai: {
      truths: [
        t('Most buyers are women aged 18–30 who discover products in short videos and livestreams.', 'Phần lớn người mua là nữ 18–30 tuổi, biết sản phẩm qua video ngắn và livestream.'),
        t('Common complaints in competitor reviews are white cast and a sticky texture.', 'Phàn nàn phổ biến trong đánh giá của đối thủ là vệt trắng và kết cấu bết dính.'),
        t('Demand peaks from March to August, the hot season.', 'Nhu cầu cao nhất từ tháng 3 đến tháng 8, mùa nắng nóng.'),
      ],
      fabricated: t('A 2025 Nielsen Vietnam study shows 74% of Gen Z women will only buy vegan sunscreen.', 'Nghiên cứu Nielsen Việt Nam 2025 cho thấy 74% nữ Gen Z chỉ mua kem chống nắng thuần chay.'),
      outdated: t('The vegan sunscreen segment grew 210% last year.', 'Phân khúc kem chống nắng thuần chay tăng 210% năm ngoái.'),
      outdatedWhy: t('210% was the 2021 launch-year growth from a tiny base.', '210% là mức tăng năm 2021, năm phân khúc mới ra đời, từ nền rất nhỏ.'),
      bias: t('SunVeg is the undisputed leader with 65% market share (source: SunVeg press release).', 'SunVeg dẫn đầu tuyệt đối với 65% thị phần (nguồn: thông cáo báo chí của SunVeg).'),
    },
  },
  {
    id: 'catfood',
    title: t('Cat-food subscription box', 'Hộp thức ăn cho mèo giao định kỳ'),
    question: t('How much do Vietnamese cat owners spend online each month on premium cat food that could move to a subscription – and should MeoBox launch?', 'Mỗi tháng chủ mèo Việt Nam chi bao nhiêu online cho thức ăn mèo cao cấp có thể chuyển sang giao định kỳ, và MeoBox có nên ra mắt?'),
    context: t('MeoBox wants to sell premium cat food as a monthly subscription box (website + Zalo) at about 450k VND per box.', 'MeoBox muốn bán thức ăn mèo cao cấp theo gói giao hằng tháng (website + Zalo), khoảng 450 nghìn đồng mỗi hộp.'),
    base: 4, aov: 450, keyword: 'thức ăn cho mèo cao cấp', conv: 0.03,
    trendFactor: 0.9,
    trendNote: t('Relevance: pet owners do search before buying, so Trends is close here – but it cannot see repeat buyers who reorder from their cart.', 'Mức liên quan: chủ thú cưng có tìm kiếm trước khi mua nên Trends khá sát, nhưng không thấy khách mua lại từ giỏ hàng.'),
    mktFactor: 1.2,
    mktNote: t('Reliability: sold counters include brushed orders and bundle splits. Over-estimate.', 'Độ tin cậy: số "đã bán" gồm đơn ảo và đơn tách combo. Đánh giá cao.'),
    socialFactor: 1.8, growth: 0.28, publisher: 'PetMarket VN', reviewRate: 0.04,
    reviewsInsight: t('late deliveries, torn bags, wanting smaller trial packs', 'giao trễ, bao bị rách, muốn có gói dùng thử nhỏ hơn'),
    interviewInsight: t('owners like auto-delivery but fear being locked in; they want to pause or skip a month easily.', 'chủ mèo thích được giao tự động nhưng sợ bị ràng buộc; muốn dễ dàng tạm dừng hoặc bỏ qua một tháng.'),
    category: t('online pet food (dogs and cats)', 'thức ăn thú cưng online (chó và mèo)'),
    ai: {
      truths: [
        t('Cat ownership is growing fastest among young urban singles in Hà Nội and TP.HCM.', 'Nuôi mèo tăng nhanh nhất ở người trẻ độc thân tại Hà Nội và TP.HCM.'),
        t('Subscribers care most about being able to pause or skip a delivery.', 'Người đăng ký quan tâm nhất đến việc tạm dừng hoặc bỏ qua một lần giao.'),
        t('Today most cat food is bought as one-off orders on Shopee and Lazada.', 'Hiện nay phần lớn thức ăn mèo được mua lẻ từng đơn trên Shopee và Lazada.'),
      ],
      fabricated: t('Vietnam has 48 million pet cats, according to the 2025 national pet census of the Ministry of Agriculture.', 'Việt Nam có 48 triệu con mèo cảnh, theo tổng điều tra thú cưng 2025 của Bộ Nông nghiệp.'),
      outdated: t('Online pet food sales grew 300% last year.', 'Doanh số thức ăn thú cưng online tăng 300% năm ngoái.'),
      outdatedWhy: t('300% was the 2020 lockdown spike.', '300% là đột biến năm 2020 do giãn cách.'),
      bias: t('PetPal already holds 70% of all pet subscriptions (source: PetPal investor deck).', 'PetPal đã nắm 70% số gói đăng ký thú cưng (nguồn: tài liệu gọi vốn của PetPal).'),
    },
  },
  {
    id: 'cup',
    title: t('Menstrual cups on Shopee', 'Cốc nguyệt san trên Shopee'),
    question: t('How big is the online menstrual-cup market each month – and should LunaVie launch?', 'Thị trường cốc nguyệt san online mỗi tháng lớn bao nhiêu, và LunaVie có nên tung sản phẩm?'),
    context: t('LunaVie plans a medical-grade silicone menstrual cup at about 320k VND on Shopee. One cup lasts for years, so repeat purchases are rare.', 'LunaVie định bán cốc nguyệt san silicone y tế giá khoảng 320 nghìn đồng trên Shopee. Một cốc dùng được nhiều năm nên hiếm khi mua lại.'),
    base: 2.5, aov: 320, keyword: 'cốc nguyệt san', conv: 0.05,
    trendFactor: 0.85,
    trendNote: t('Relevance: many searches are curiosity ("is it safe?") rather than buying, but buyers do research first. Roughly right, slightly low.', 'Mức liên quan: nhiều lượt tìm chỉ vì tò mò ("có an toàn không?"), nhưng người mua đều tìm hiểu trước. Gần đúng, hơi thấp.'),
    mktFactor: 1.3,
    mktNote: t('Reliability: cheap unbranded cups are brushed heavily and sold counters include returns. Over-estimate.', 'Độ tin cậy: cốc giá rẻ không thương hiệu bị "buff" đơn nhiều, số đã bán gồm cả đơn hoàn. Đánh giá cao.'),
    socialFactor: 2.6, growth: 0.3, publisher: 'FemCare Asia', reviewRate: 0.05,
    reviewsInsight: t('wrong size, hard to use at first, wanting a size guide', 'chọn sai cỡ, lúc đầu khó dùng, muốn có hướng dẫn chọn cỡ'),
    interviewInsight: t('interest is high, but only about 1 in 5 interested women actually buys within a year – fear and lack of guidance.', 'mức quan tâm cao nhưng chỉ khoảng 1/5 người quan tâm thực sự mua trong một năm, vì e ngại và thiếu hướng dẫn.'),
    category: t('online feminine-hygiene products', 'sản phẩm vệ sinh phụ nữ online'),
    ai: {
      truths: [
        t('One cup lasts several years, so repeat purchases are rare.', 'Một cốc dùng nhiều năm nên hiếm khi mua lại.'),
        t('First-time users need sizing guidance and education content.', 'Người dùng lần đầu cần hướng dẫn chọn cỡ và nội dung giáo dục.'),
        t('Buyers are mainly urban women aged 20–35.', 'Người mua chủ yếu là nữ 20–35 tuổi ở thành thị.'),
      ],
      fabricated: t('The WHO 2024 guideline recommends menstrual cups for every woman over 16.', 'Hướng dẫn năm 2024 của WHO khuyến nghị mọi phụ nữ trên 16 tuổi dùng cốc nguyệt san.'),
      outdated: t('Menstrual cups cost about 650k VND on average.', 'Cốc nguyệt san có giá trung bình khoảng 650 nghìn đồng.'),
      outdatedWhy: t('650k was the 2019 price, before local brands; today’s range is about 200–350k.', '650 nghìn là giá năm 2019, khi chưa có thương hiệu Việt; nay khoảng 200–350 nghìn.'),
      bias: t('Over 90% of users are "very satisfied" (survey of the brand’s own fan group).', 'Hơn 90% người dùng "rất hài lòng" (khảo sát trong nhóm fan của chính thương hiệu).'),
    },
  },
  {
    id: 'coffee',
    title: t('Coffee capsules for offices (B2B)', 'Cà phê viên nén cho văn phòng (B2B)'),
    question: t('How much do offices in Hà Nội and TP.HCM spend each month on capsule or machine coffee bought online or by contract – and should BeanBox launch?', 'Mỗi tháng các văn phòng ở Hà Nội và TP.HCM chi bao nhiêu cho cà phê viên nén/máy pha mua online hoặc theo hợp đồng, và BeanBox có nên ra mắt?'),
    context: t('BeanBox wants to supply coffee capsules plus a free machine to offices on a monthly contract of about 1.8 million VND per office.', 'BeanBox muốn cung cấp cà phê viên nén kèm máy miễn phí cho văn phòng theo hợp đồng tháng, khoảng 1,8 triệu đồng mỗi văn phòng.'),
    base: 5, aov: 1800, keyword: 'cà phê viên nén văn phòng', conv: 0.06,
    trendFactor: 0.4,
    trendNote: t('Relevance: B2B buyers (office managers) ask peers and suppliers instead of googling. Trends heavily under-estimates.', 'Mức liên quan: người mua B2B (quản lý văn phòng) hỏi đồng nghiệp và nhà cung cấp chứ ít tìm trên Google. Trends đánh giá thấp nhiều.'),
    mktFactor: 0.6,
    mktNote: t('Relevance: most office orders run on contracts with VAT invoices, outside marketplaces – sold counters miss them. Under-estimate.', 'Mức liên quan: phần lớn đơn văn phòng chạy theo hợp đồng có hóa đơn VAT, ngoài sàn, nên số đã bán bỏ sót. Đánh giá thấp.'),
    socialFactor: 1.4, growth: 0.18, publisher: 'VN Office Services Report', reviewRate: 0.02,
    reviewsInsight: t('machine breakdowns, slow re-supply, VAT invoice problems', 'máy hỏng, giao bổ sung chậm, khó xuất hóa đơn VAT'),
    interviewInsight: t('office managers decide; they need VAT invoices and monthly contracts, and they switch suppliers mainly over machine service.', 'quản lý văn phòng là người quyết; họ cần hóa đơn VAT, hợp đồng tháng, và đổi nhà cung cấp chủ yếu vì dịch vụ bảo trì máy.'),
    category: t('office supplies bought online', 'văn phòng phẩm mua online'),
    ai: {
      truths: [
        t('Buyers are office or admin managers who need VAT invoices.', 'Người mua là quản lý văn phòng/hành chính, cần hóa đơn VAT.'),
        t('Most orders come through monthly contracts, not marketplaces.', 'Phần lớn đơn đến từ hợp đồng tháng, không phải từ sàn.'),
        t('Machine service is a key reason to switch supplier.', 'Dịch vụ bảo trì máy là lý do chính để đổi nhà cung cấp.'),
      ],
      fabricated: t('Gartner reports that 92% of Vietnamese offices will switch to capsule coffee in 2026.', 'Gartner báo cáo 92% văn phòng Việt Nam sẽ chuyển sang cà phê viên nén trong năm 2026.'),
      outdated: t('Capsule machines cost over 8 million VND each, so few offices can afford them.', 'Máy pha viên nén giá trên 8 triệu đồng mỗi máy nên ít văn phòng mua nổi.'),
      outdatedWhy: t('8 million was the 2018 price; office machines now cost 2–3 million or come free on contract.', '8 triệu là giá năm 2018; nay máy văn phòng khoảng 2–3 triệu hoặc được tặng theo hợp đồng.'),
      bias: t('CafeCaps serves "most multinational offices in Vietnam" (source: CafeCaps website).', 'CafeCaps phục vụ "hầu hết văn phòng đa quốc gia tại Việt Nam" (nguồn: website CafeCaps).'),
    },
  },
  {
    id: 'cooker',
    title: t('Premium smart rice cooker', 'Nồi cơm điện thông minh cao cấp'),
    question: t('How big is the online market for premium (IH, app-connected) rice cookers each month – and should KitchenPro launch?', 'Thị trường online nồi cơm điện cao cấp (cao tần, kết nối app) mỗi tháng lớn bao nhiêu, và KitchenPro có nên tung sản phẩm?'),
    context: t('KitchenPro wants to launch an induction-heating smart rice cooker at about 3.2 million VND on Shopee Mall, Lazada and its own website.', 'KitchenPro muốn tung nồi cơm điện cao tần thông minh giá khoảng 3,2 triệu đồng trên Shopee Mall, Lazada và website riêng.'),
    base: 9, aov: 3200, keyword: 'nồi cơm điện cao tần', conv: 0.02,
    trendFactor: 0.85,
    trendNote: t('Relevance: expensive appliances are researched on Google first, so Trends is fairly close – slightly low because some buyers go straight to Shopee Mall.', 'Mức liên quan: đồ gia dụng đắt tiền thường được tìm hiểu trên Google trước nên Trends khá sát, hơi thấp vì một phần người mua vào thẳng Shopee Mall.'),
    mktFactor: 1.35,
    mktNote: t('Recency and reliability: the last 30 days included the 11.11 mega-sale, and counters include brushed orders. Over-estimate of a normal month.', 'Thời điểm và độ tin cậy: 30 ngày qua có đợt siêu sale 11.11, số đã bán còn gồm đơn ảo. Đánh giá cao so với tháng bình thường.'),
    socialFactor: 1.6, growth: 0.12, publisher: 'HomeTech Vietnam', reviewRate: 0.03,
    reviewsInsight: t('the app is hard to connect and the cooker is bulky, but rice quality is praised', 'app khó kết nối, nồi cồng kềnh, nhưng cơm ngon được khen'),
    interviewInsight: t('people replace a cooker every 5–7 years, wait for mega-sales and compare closely with Japanese brands.', 'người mua thay nồi 5–7 năm một lần, chờ siêu sale và so sánh kỹ với thương hiệu Nhật.'),
    category: t('online small kitchen appliances', 'đồ gia dụng nhà bếp nhỏ bán online'),
    ai: {
      truths: [
        t('Sales spike on mega-sale days (9.9, 11.11, 12.12).', 'Doanh số tăng vọt vào các ngày siêu sale (9.9, 11.11, 12.12).'),
        t('Buyers compare closely with Japanese brands.', 'Người mua so sánh kỹ với các thương hiệu Nhật.'),
        t('The replacement cycle is long – five years or more.', 'Chu kỳ thay mới dài, từ năm năm trở lên.'),
      ],
      fabricated: t('60% of Vietnamese households already own a smart rice cooker (Euromonitor 2025).', '60% hộ gia đình Việt Nam đã có nồi cơm điện thông minh (Euromonitor 2025).'),
      outdated: t('Online channels are only 5% of small-appliance sales in Vietnam.', 'Kênh online chỉ chiếm 5% doanh số đồ gia dụng nhỏ ở Việt Nam.'),
      outdatedWhy: t('5% was the 2017 share; online is now a large part of appliance sales.', '5% là tỷ trọng năm 2017; nay online đã chiếm phần lớn doanh số gia dụng.'),
      bias: t('CookSmart is rated the No. 1 rice cooker by consumers (source: an affiliate blog paid by CookSmart).', 'CookSmart được người tiêu dùng bình chọn số 1 (nguồn: blog affiliate do CookSmart trả tiền).'),
    },
  },
  {
    id: 'stem',
    title: t('STEM toy kits for children', 'Bộ đồ chơi STEM cho trẻ em'),
    question: t('How big is the online market for STEM toy kits (ages 6–12) each month – and should BrightKit launch?', 'Thị trường online bộ đồ chơi STEM (6–12 tuổi) mỗi tháng lớn bao nhiêu, và BrightKit có nên tung sản phẩm?'),
    context: t('BrightKit wants to sell robotics and science kits for children aged 6–12 at about 520k VND, with Vietnamese instructions and video lessons.', 'BrightKit muốn bán bộ robot và khoa học cho trẻ 6–12 tuổi giá khoảng 520 nghìn đồng, có hướng dẫn tiếng Việt và video bài học.'),
    base: 7, aov: 520, keyword: 'đồ chơi STEM cho bé', conv: 0.035,
    trendFactor: 0.75,
    trendNote: t('Relevance: parents search before buying gifts, but many buy straight from Shopee recommendations. Somewhat low.', 'Mức liên quan: phụ huynh có tìm trước khi mua quà nhưng nhiều người mua thẳng từ gợi ý của Shopee. Hơi thấp.'),
    mktFactor: 1.2,
    mktNote: t('Reliability: sold counters include brushed orders and many cheap non-STEM toys tagged "STEM". Over-estimate.', 'Độ tin cậy: số đã bán gồm đơn ảo và nhiều đồ chơi rẻ không phải STEM nhưng gắn nhãn "STEM". Đánh giá cao.'),
    socialFactor: 1.9, growth: 0.22, publisher: 'Kids & Edu Market Review', reviewRate: 0.04,
    reviewsInsight: t('missing parts, instructions only in Chinese, too hard for the stated age', 'thiếu chi tiết, hướng dẫn chỉ có tiếng Trung, quá khó so với độ tuổi ghi trên hộp'),
    interviewInsight: t('parents buy mainly for birthdays, Children’s Day and Tết; they want Vietnamese instructions and visible learning value.', 'phụ huynh mua chủ yếu dịp sinh nhật, 1/6 và Tết; muốn hướng dẫn tiếng Việt và thấy rõ giá trị học tập.'),
    category: t('online toys (all kinds)', 'đồ chơi trẻ em online (mọi loại)'),
    ai: {
      truths: [
        t('Purchases peak before Children’s Day (1 June), back-to-school and Tết.', 'Lượng mua cao nhất trước 1/6, mùa tựu trường và Tết.'),
        t('Parents want instructions in Vietnamese.', 'Phụ huynh muốn hướng dẫn bằng tiếng Việt.'),
        t('Main buyers are parents aged 28–40 in large cities.', 'Người mua chính là phụ huynh 28–40 tuổi ở thành phố lớn.'),
      ],
      fabricated: t('From 2026 the Ministry of Education requires every primary pupil to own a STEM kit.', 'Từ năm 2026 Bộ Giáo dục bắt buộc mọi học sinh tiểu học có một bộ STEM.'),
      outdated: t('About 70% of STEM toys are sold in bookstores such as Fahasa.', 'Khoảng 70% đồ chơi STEM được bán ở nhà sách như Fahasa.'),
      outdatedWhy: t('70% in bookstores was the 2017 picture; online now dominates.', '70% qua nhà sách là tình hình năm 2017; nay online chiếm ưu thế.'),
      bias: t('RoboKid is the best-selling STEM brand (source: a sponsored TikTok review for RoboKid).', 'RoboKid là thương hiệu STEM bán chạy nhất (nguồn: video review TikTok được RoboKid tài trợ).'),
    },
  },
];

export const MD_CASE_IDS = CASES.map((c) => c.id);

const ERROR_WHY: Record<Exclude<AiErrorType, 'outdated'>, T> = {
  fabricated: t('A precise statistic with a famous name but no link – no such study or rule exists. Always open the original source.', 'Con số rất cụ thể gắn với tên tuổi lớn nhưng không có đường dẫn, và nghiên cứu/quy định đó không tồn tại. Luôn mở nguồn gốc.'),
  synthesis: t('"Prefer" is not "buy" and the share is a guess, so the result is 2–3 times too high. Check it against marketplace, reviews and interviews.', '"Thích" không phải "mua", tỷ lệ là đoán, nên kết quả cao gấp 2–3 lần. Đối chiếu với dữ liệu sàn, đánh giá và phỏng vấn.'),
  bias: t('The claim comes from the company itself or someone it pays. Marketplace data shows a fragmented market.', 'Thông tin đến từ chính doanh nghiệp hoặc bên nhận tiền của họ. Dữ liệu sàn cho thấy thị trường còn phân mảnh.'),
};

export interface MdCaseFull {
  pub: MdCasePublic;
  truth: number;
  zone: MdDecision;
  growth: number;
  findings: Record<SourceId, MdFinding>;
  aiClaims: T[];
  aiErrors: { index: number; type: AiErrorType; why: T }[];
  sourceNotes: Record<SourceId, T>;
}

const gauss = (rng: Rng) => {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
};
const noisy = (rng: Rng, sd: number) => Math.exp(Math.max(-2.5, Math.min(2.5, gauss(rng))) * sd);
const r1 = (v: number) => Math.round(v * 10) / 10;
const bn = (v: number) => bi((l) => `${n(v, l, v < 100 ? 1 : 0)} ${l === 'en' ? 'bn VND/month' : 'tỷ đồng/tháng'}`);
const num = (v: number) => bi((l) => n(v, l));
const pct = (v: number, d = 0) => bi((l) => `${n(v * 100, l, d)}%`);
const join = (...parts: T[]): T => ({ en: parts.map((p) => p.en).join(''), vi: parts.map((p) => p.vi).join('') });
const s = (en: string, vi: string) => t(en, vi);

/** Zone ranges relative to the case base; thresholds are base × 0.8 (pilot) and × 1.4 (launch). */
const ZONE: Record<MdDecision, [number, number]> = { no: [0.45, 0.68], pilot: [0.92, 1.25], launch: [1.6, 2.2] };

export function decisionFor(value: number, c: Pick<MdCasePublic, 'launchAt' | 'pilotAt'>): MdDecision {
  return value >= c.launchAt ? 'launch' : value >= c.pilotAt ? 'pilot' : 'no';
}

function buildCase(def: CaseDef, zone: MdDecision, rng: Rng): MdCaseFull {
  const [lo, hi] = ZONE[zone];
  const truth = r1(def.base * (lo + (hi - lo) * rng()));
  const pub: MdCasePublic = {
    id: def.id,
    title: def.title,
    question: def.question,
    context: def.context,
    unit: t('billion VND / month', 'tỷ đồng / tháng'),
    pilotAt: r1(def.base * 0.8),
    launchAt: r1(def.base * 1.4),
  };
  const aov = def.aov;
  const aovT = bi((l) => (aov >= 1000 ? `${n(aov / 1000, l, 1)} ${l === 'en' ? 'million' : 'triệu'}` : `${n(aov, l)}${l === 'en' ? 'k' : ' nghìn'}`));
  const orders = (v: number) => (v * 1e6) / aov;
  const g = def.growth;
  const gSeen = Math.max(0.03, g + (rng() - 0.5) * 0.06);

  // Trends: search intent only.
  const trends = r1(truth * def.trendFactor * noisy(rng, 0.18));
  const searches = Math.round(orders(trends) / def.conv / 100) * 100;
  // Marketplace: top-20 listings, scaled by their category share.
  const mkt = r1(truth * def.mktFactor * noisy(rng, 0.1));
  const units = Math.round((orders(mkt) * 0.6) / 10) * 10;
  // Industry report: accurate but two years old.
  const report = r1((truth / (1 + g) ** 2) * noisy(rng, 0.06));
  // Review mining: unbiased, noisy review rate.
  const rev = r1(truth * noisy(rng, 0.22));
  const reviews = Math.round(orders(rev) * def.reviewRate);
  // Social listening: hype.
  const social = r1(truth * def.socialFactor * 1.3 * noisy(rng, 0.25));
  const mentions = Math.round((orders(social) * 2.5) / 100) * 100;
  // Interviews + screener survey: primary data, small but well-targeted.
  const intv = r1(truth * noisy(rng, 0.08));
  const target = Math.round(orders(def.base) / 0.015 / 1000) * 1000;
  const buyRate = orders(intv) / target;

  const findings: Record<SourceId, MdFinding> = {
    trends: {
      source: 'trends',
      implied: trends,
      text: join(
        s('About ', 'Khoảng '), num(searches), s(` searches per month for "${def.keyword}" (`, ` lượt tìm mỗi tháng cho "${def.keyword}" (`),
        bi((l) => `+${n(gSeen * 100, l)}%`), s(' vs last year). The tool assumes ', ' so với năm trước). Công cụ giả định '), pct(def.conv, 1),
        s(' of searchers buy at ~', ' người tìm sẽ mua với giá ~'), aovT, s(' → ≈ ', ' → ≈ '), bn(trends), s('.', '.'),
      ),
    },
    marketplace: {
      source: 'marketplace',
      implied: mkt,
      text: join(
        s('Top 20 listings on Shopee + TikTok Shop show ', '20 gian hàng đầu trên Shopee + TikTok Shop hiển thị '), num(units),
        s(' sold in the last 30 days at ~', ' đã bán trong 30 ngày qua với giá ~'), aovT,
        s('. The top 20 are about 60% of the category → ≈ ', '. Top 20 chiếm khoảng 60% ngành hàng → ≈ '), bn(mkt), s('.', '.'),
      ),
    },
    report: {
      source: 'report',
      implied: report,
      text: join(
        s(`${def.publisher} (published 2024, panel of 3,000 consumers, method disclosed): the segment is worth `, `${def.publisher} (xuất bản 2024, khảo sát 3.000 người tiêu dùng, công bố phương pháp): phân khúc đạt `),
        bn(report), s(', growing about ', ', tăng khoảng '), pct(g), s(' a year.', ' mỗi năm.'),
      ),
    },
    reviews: {
      source: 'reviews',
      implied: rev,
      text: join(
        num(reviews), s(' new reviews in 30 days across the top sellers; usually ', ' đánh giá mới trong 30 ngày ở các gian hàng đầu; thường khoảng '), pct(def.reviewRate),
        s(' of buyers leave a review → ≈ ', ' người mua để lại đánh giá → ≈ '), num(Math.round(orders(rev) / 10) * 10), s(' orders ≈ ', ' đơn ≈ '), bn(rev),
        s('. Top complaints: ', '. Phàn nàn nhiều nhất: '), def.reviewsInsight, s('.', '.'),
      ),
    },
    social: {
      source: 'social',
      implied: social,
      text: join(
        num(mentions), s(' posts and comments per month mention the category (', ' bài viết và bình luận mỗi tháng nhắc đến ngành hàng ('), pct(0.7 + rng() * 0.2),
        s(' positive). The listening tool converts buzz into "purchase intent" ≈ ', ' tích cực). Công cụ quy đổi độ "hot" thành "ý định mua" ≈ '), bn(social), s('.', '.'),
      ),
    },
    interview: {
      source: 'interview',
      implied: intv,
      text: join(
        s('Screener survey of 400 target customers + 12 in-depth interviews: about ', 'Khảo sát sàng lọc 400 khách mục tiêu + 12 phỏng vấn sâu: khoảng '), pct(buyRate, 1),
        s(' of the ', ' trong '), num(target), s(' target customers buy each month at ~', ' khách mục tiêu mua mỗi tháng với giá ~'), aovT, s(' → ≈ ', ' → ≈ '), bn(intv),
        s('. Insight: ', '. Phát hiện: '), def.interviewInsight,
      ),
    },
    ai: { source: 'ai', text: s('', '') },
  };

  // AI report: four claims, one or two of them wrong.
  const headlineWrong = rng() < 0.6;
  type Claim = { text: T; type?: AiErrorType; why?: T };
  const others: Claim[] = [
    { text: def.ai.fabricated, type: 'fabricated', why: ERROR_WHY.fabricated },
    { text: def.ai.outdated, type: 'outdated', why: join(def.ai.outdatedWhy, s(' Check the date of every number.', ' Luôn kiểm tra thời điểm của con số.')) },
    { text: def.ai.bias, type: 'bias', why: ERROR_WHY.bias },
  ];
  const wrongOthers = shuffle(rng, others).slice(0, headlineWrong ? (rng() < 0.4 ? 1 : 0) : rng() < 0.5 ? 2 : 1);
  const trueOthers = shuffle(rng, def.ai.truths).slice(0, 3 - wrongOthers.length).map((text): Claim => ({ text }));
  let aiValue: number;
  let headline: Claim;
  if (headlineWrong) {
    aiValue = r1(truth * (2.1 + rng() * 0.7));
    const categorySize = Math.round(def.base * 8);
    const share = aiValue / categorySize;
    headline = {
      text: join(
        s('The ', 'Thị trường '), def.category, s(' market is about ', ' khoảng '), bn(categorySize), s(' and about ', ', và khoảng '), pct(share),
        s(' of shoppers say they prefer this kind of product, so the market is ≈ ', ' người mua nói họ thích loại sản phẩm này, vậy thị trường ≈ '), bn(aiValue), s('.', '.'),
      ),
      type: 'synthesis',
      why: ERROR_WHY.synthesis,
    };
  } else {
    // "Triangulated" from two biased sources, so even the honest headline inherits their bias.
    aiValue = r1(Math.sqrt(trends * mkt) * noisy(rng, 0.06));
    headline = { text: join(s('Estimated market: ≈ ', 'Ước tính thị trường: ≈ '), bn(aiValue), s(' (triangulated from marketplace and search data).', ' (đối chiếu dữ liệu sàn và tìm kiếm).')) };
  }
  const claims: Claim[] = [headline, ...shuffle(rng, [...wrongOthers, ...trueOthers])];
  findings.ai = { source: 'ai', implied: aiValue, text: s('AI research report (4 statements below – check them):', 'Báo cáo nghiên cứu do AI viết (4 nhận định bên dưới – hãy kiểm tra):') };

  const sourceNotes: Record<SourceId, T> = {
    trends: def.trendNote,
    marketplace: def.mktNote,
    report: join(
      s('Recency: accurate method, but two years old – the market grew ', 'Tính cập nhật: phương pháp tốt nhưng đã cũ hai năm; thị trường đã tăng '), pct(g),
      s(' a year since. Adjusted: report × (1 + growth)² ≈ ', ' mỗi năm. Điều chỉnh: báo cáo × (1 + tăng trưởng)² ≈ '), bn(r1(report * (1 + g) ** 2)), s('.', '.'),
    ),
    reviews: s('Reliability: real buyers and an unbiased method, but the review rate varies (2–6%), so it is noisy.', 'Độ tin cậy: người mua thật, phương pháp không thiên lệch, nhưng tỷ lệ để lại đánh giá dao động (2–6%) nên sai số lớn.'),
    social: s('Bias: enthusiasts and paid KOL posts dominate; buzz is not buying. A large over-estimate.', 'Thiên lệch: người hâm mộ và bài KOL trả tiền chiếm đa số; độ "hot" không phải là mua. Đánh giá cao rất nhiều.'),
    interview: s('Relevance and sample: the right people, asked directly about real purchases. Small but well designed – the most reliable source.', 'Mức liên quan và mẫu: đúng người, hỏi trực tiếp về việc mua thật. Mẫu nhỏ nhưng thiết kế tốt – nguồn đáng tin nhất.'),
    ai: s('AI synthesis: fast and cheap, but it mixes real data with invented, outdated or biased claims. Use it as a lead, never as evidence.', 'AI tổng hợp: nhanh và rẻ nhưng trộn dữ liệu thật với thông tin bịa, lỗi thời hoặc thiên lệch. Chỉ dùng làm gợi ý, không dùng làm bằng chứng.'),
  };

  return {
    pub,
    truth,
    zone,
    growth: g,
    findings,
    aiClaims: claims.map((c) => c.text),
    aiErrors: claims.flatMap((c, index) => (c.type ? [{ index, type: c.type, why: c.why! }] : [])),
    sourceNotes,
  };
}

/** Three different cases, one truth in each decision zone (in random order). */
export function drawCases(rng: Rng, count = 3, only?: string[]): MdCaseFull[] {
  const pool = only?.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
  const picked = shuffle(rng, pool).slice(0, count);
  const zones = shuffle(rng, ['no', 'pilot', 'launch'] as MdDecision[]);
  return picked.map((def, i) => buildCase(def, zones[i % zones.length]!, rng));
}
