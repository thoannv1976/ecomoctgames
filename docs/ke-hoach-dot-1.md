# ECOM Arena – Kế hoạch đợt 1 (Game 9, 12, 4)

Ngày 13/11/2026. Môn E-commerce 2026 (khóa Moodle ECOM-OCT, course 33).

## 1. Hạ tầng

| Thành phần | Giá trị |
|---|---|
| Repo | `thoannv1976/ecomoctgames` (khung lấy từ DIGIMARK Arena) |
| GCP / Firebase | project `ecomoctgames`, vùng asia-southeast1 |
| Web | https://ecomoctgames.web.app (Firebase Hosting) |
| API | Cloud Run `arena-api`, Firestore `(default)` |
| Moodle | UniGame Hub, game id `ecomoctgames`, mỗi game một hoạt động (activity) riêng |

**Ngôn ngữ:** song ngữ Anh – Việt.
- Mỗi người tự chọn ngôn ngữ bằng nút EN/VI trên điện thoại; máy nhớ lựa chọn.
- Màn hình chiếu có nút chuyển riêng.
- Toàn bộ nội dung (câu hỏi, tình huống, thẻ, nhận xét) soạn sẵn ở cả hai thứ tiếng.

**Thứ tự làm:** từng game một. Mỗi game làm trọn các bước sau rồi mới sang game sau:
1. lõi game;
2. mô phỏng cân bằng (với game có máy chơi);
3. giao diện;
4. kiểm thử;
5. đưa lên production;
6. gắn vào Moodle course 33;
7. chơi thử 6 người, kiểm tra điểm về Sổ điểm.

## 2. Ba chế độ chơi (chung cho cả 3 game)

| Chế độ | Ai chơi | Dùng khi |
|---|---|---|
| **Luyện tập** | 1 người, không đối thủ, không giới hạn giờ | Tự học ở nhà; xem giải thích từng bước |
| **Đấu máy** | 1 người với 5 máy (Dễ/Vừa/Khó) | Ôn tập, làm bài về nhà có điểm |
| **Đấu lớp** | 6 sinh viên, mỗi người một công ty | Trên lớp; giảng viên tạo nhiều phòng cùng lúc |

**Để tăng cạnh tranh và động lực:**
- **Bảng xếp hạng toàn lớp:** gộp mọi phòng trên màn hình giảng viên và màn chiếu, không chỉ trong từng phòng.
- **Danh hiệu cuối trận** theo hành vi (game 12 và 4), ví dụ "Thợ săn nút thắt", "CEO bình tĩnh", "Không tin AI mù quáng". Mỗi người thấy mình mạnh ở đâu.
- **Điểm Moodle lấy lần cao nhất**, nên sinh viên được chơi lại ở nhà để nâng điểm.

## 3. Game 9 · Unit Economics Showdown – "Thám tử lợi nhuận" (chương 9)

**Hình thức:** đấu nhanh, khoảng 15 câu, 12–15 phút. Mỗi câu có giờ đếm ngược. Đúng và nhanh được nhiều điểm hơn, đúng liên tiếp được nhân điểm, sai bị trừ điểm (để không bấm bừa). Có 2 lượt "Kiểm chứng": xem gợi ý, câu đó chỉ còn một nửa điểm.

**6 dạng câu:**

| Dạng | Người chơi làm gì |
|---|---|
| Tìm nút thắt | Chạm vào ô chỉ số trên bảng điều khiển đang kéo lợi nhuận xuống (theo cây chỉ số: Traffic → CTR → CR → AOV → biên lợi nhuận) |
| Tính nhanh | Biên lợi nhuận đóng góp/đơn, Break-even ROAS = 1/biên lợi nhuận đóng góp, CLV/CAC, tỷ lệ chi phí sàn thực tế (Effective Platform Cost Ratio); chọn đáp án số |
| Đòn bẩy nào lời hơn | Xếp thứ tự 3–4 đòn bẩy theo lợi nhuận tăng thêm, ví dụ +1 điểm % CR, +10% AOV, −2 điểm % tỷ lệ hoàn hàng |
| Bẫy Goodhart | Chỉ số nào là chỉ số cho đẹp (vanity), chỉ số nào cần kèm chỉ số chặn (guardrail) |
| Đọc cặp KPI | Chọn đúng cặp chỉ số phải đọc cùng nhau |
| Tình huống CEO | "Doanh thu 3 tỷ trên Shopee: lãi bao nhiêu?"; case Chewy và Blue Apron |

**Ngân hàng câu:** khoảng 60 câu, viết từ bảng tính unit economics, 12 KPI và 10 câu hỏi CEO của chương 9. Các con số được tạo ngẫu nhiên theo khuôn, nên mỗi trận số liệu khác nhau và không thể chép đáp án của nhau.

**Máy chơi:** trả lời đúng 60/72/85% tùy mức, thời gian trả lời giống người.

**Điểm Moodle:** tỷ lệ câu đúng (0–100).

**Chế độ đề xuất:** đấu lớp 6 người là chính. Có thêm "Chung kết": người đứng đầu mỗi phòng vào một phòng chung kết, chiếu lên màn hình.

## 4. Game 12 · CEO Simulator (chương 12) – bài tổng hợp cuối môn

**Hình thức:** 6 công ty cùng bán một nhóm hàng (mỹ phẩm, như GlowViet) trên cùng một thị trường. Mỗi công ty có 1 tỷ đồng vốn. Thời lượng 45–60 phút.

**Mỗi vòng là một quý (6 vòng),** người chơi quyết định:
- giá;
- dòng sản phẩm (ít hay nhiều mã);
- ngân sách marketing chia cho quảng cáo, nhà sáng tạo nội dung và CRM;
- kênh: website, Shopee, TikTok Shop;
- phân khúc mục tiêu;
- lượng hàng nhập;
- mức dịch vụ;
- đầu tư AI.

**Chuỗi nhân quả** đúng như mục 23.1 của giáo trình: quyết định → phản ứng của khách → phản ứng của đối thủ → kết quả thị trường → kết quả tài chính.
- Số đơn = traffic × tỷ lệ chuyển đổi (CR).
- Lợi nhuận = doanh thu − giá vốn − marketing − phí sàn − giao vận − hoàn hàng − chi phí AI.

**Các vòng theo bảng 12.18:**

| Vòng | Tình huống |
|---|---|
| 1 | Vào thị trường; mục tiêu là sống sót |
| 2 | Tăng trưởng, đã có dữ liệu khách hàng |
| 3 | Sức ép nền tảng: Shopee bắt buộc tham gia khuyến mãi, TikTok tăng hoa hồng nhà sáng tạo |
| 4 | Đối thủ dùng AI; mình có 300 triệu, chọn A/B/C/D/E |
| 5 | 20% khách tìm hàng qua AI agent; đầu tư cho agent ngay hay chờ |
| 6 | Khủng hoảng: mỗi công ty rút ngẫu nhiên 1 trong 8 thẻ CEO Crisis Card |

**Vòng 6:** có 3 phút để chọn cách xử lý và dự đoán 4 KPI tăng hay giảm. Dự đoán đúng được cộng điểm.

**Thắng:** bảng điều khiển chiến lược (Strategy Dashboard), gồm:
- lợi nhuận lũy kế 40%;
- tiền mặt còn lại (sống sót) 15%;
- mức phụ thuộc nền tảng (PDR) thấp 15%;
- mức sẵn sàng cho agentic commerce 10%;
- xử lý khủng hoảng và dự đoán KPI 20%.

**Máy chơi (6 kiểu, mức Dễ/Vừa/Khó):** Phá giá, Đốt quảng cáo, Phụ thuộc sàn, Xây D2C, AI trước tiên, Cân bằng. Sẽ chạy mô phỏng hàng nghìn ván để chắc rằng phá giá và đốt quảng cáo không thắng, và người chơi đúng bài thắng máy mức Vừa đa số ván.

**Điểm Moodle:** 70% thẻ mục tiêu cộng 30% thứ hạng trong phòng. Thẻ mục tiêu gồm 4 phần, mỗi phần 25 điểm: có lãi, không hết tiền, PDR dưới 60%, xử lý khủng hoảng đúng hướng.

**Chế độ đề xuất:** đấu lớp, mỗi sinh viên một công ty. Ở nhà thì đấu 5 máy.

## 5. Game 4 · Market Detective (chương 4)

**Hình thức:** 3 vụ (case), mỗi vụ khoảng 7 phút, tổng khoảng 25 phút. Mỗi vụ là một câu hỏi kinh doanh trong chương, ví dụ "có nên tung kem chống nắng thuần chay trên TikTok Shop không?". Có ngân hàng khoảng 6 vụ; mỗi trận rút 3.

**Mỗi vụ:**
1. Mỗi người có 100 điểm nghiên cứu để mua dữ liệu từ 6–8 nguồn. Các nguồn có chi phí và độ tin cậy khác nhau theo tiêu chí RRRSB của chương: Google Trends, bản đồ từ khóa, đánh giá của đối thủ, bảng giá đối thủ, báo cáo ngành, phỏng vấn khách hàng, và "báo cáo AI" có 1–2 lỗi cài sẵn (theo 4 loại lỗi AI ở mục 19.2).
2. **Nguồn khan hiếm:** chỉ 2 người đầu tiên được mua lượt phỏng vấn khách hàng. Đây là chỗ cạnh tranh trực tiếp giữa 6 người.
3. Ước tính quy mô thị trường theo cả hai cách, top-down và bottom-up (thanh kéo).
4. Đánh dấu câu sai trong báo cáo AI (nếu đã mua báo cáo AI).
5. Quyết định: Tung / Thử nhỏ / Không tung.

**Điểm mỗi vụ:**
- Ước tính sai số dưới 10% được điểm tối đa, điểm giảm dần khi sai nhiều hơn.
- Quyết định đúng (dựa trên con số thật) được điểm.
- Mỗi lỗi AI bắt đúng được cộng, đánh dấu nhầm bị trừ.
- Còn thừa điểm nghiên cứu được cộng thêm, vì nghiên cứu cũng tốn tiền.

**Hết mỗi vụ:** lật con số thật, cho biết nguồn nào đáng tin, vì sao, và ai đối chiếu nhiều nguồn tốt nhất.

**Máy chơi:** "Tin AI mù quáng", "Chỉ xem Google Trends", "Mua hết mọi nguồn", "Nhà phân tích cẩn thận".

**Điểm Moodle:** 70% điểm tuyệt đối của 3 vụ cộng 30% thứ hạng.

## 6. Thứ tự làm và mốc

| Bước | Việc |
|---|---|
| 0 | Hạ tầng ecomoctgames: Firebase, Firestore, Cloud Run, service account, secret, TTL; khung ECOM Arena song ngữ |
| 1 | Game 9: lõi game, ngân hàng câu, giao diện, kiểm thử, production, Hub, Moodle course 33, chơi thử 6 người |
| 2 | Game 12: như trên, thêm mô phỏng cân bằng |
| 3 | Game 4: như trên |

**Phần cần quyền của anh:**
- merge PR thêm ECOM Arena vào danh mục của UniGame Hub, và deploy lại Hub;
- cho phép tenant aiedu2026 dùng ECOM Arena.

Tôi sẽ chuẩn bị sẵn script và hỏi anh trước khi chạy.
