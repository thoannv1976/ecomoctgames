# ECOM Arena – Kế hoạch đợt 3 (Game 1, 3, 10, 11, 5)

Ngày 14/11/2026. Môn E-commerce 2026, khóa Moodle ECOM-OCT (course 33). Hạ tầng, ngôn ngữ (song ngữ Anh – Việt) và ba chế độ chơi giống đợt 1 ([ke-hoach-dot-1.md](ke-hoach-dot-1.md)) và đợt 2 ([ke-hoach-dot-2.md](ke-hoach-dot-2.md)).

Đợt 3 là năm game còn lại của bản đề xuất 12 game. Sau đợt 3, cả 12 chương đều có một game.

## 1. Thứ tự làm

| # | Game | Chương | Khung | Lý do thứ tự |
|---|---|---|---|---|
| 1 | 🌊 **Wave Rider** – *Đón sóng* | 1 | `rs` | Ngắn nhất (15 phút), chương mở đầu, dùng y nguyên khung nhiều vòng |
| 2 | 🧭 **Shopper Stream** – *Dòng khách hàng* | 3 | `rs` | Phễu và cohort, cùng kiểu "sáu người giành một nhóm khách" như Game 2 |
| 3 | 🤖 **Agent Arena** – *Đấu trường AI agent* | 10 | `rs` | Gần Game 7 (đầu tư từng kênh, rủi ro cài sẵn) |
| 4 | 🛂 **Border Run** – *Vượt biên* | 11 | `rs` | Thêm cơ chế thẻ cám dỗ và xác suất bị phát hiện |
| 5 | 🚀 **Pitch Arena** – *Đấu trường khởi nghiệp* | 5 | **mới** | Vòng đời phòng khác hẳn (thiết kế → kiểm tra khả thi → mô phỏng 12 tháng → gọi vốn chéo). Làm cuối, có thể tách thành đợt riêng |

Bốn game đầu dùng lại khung `packages/engine/src/rs/` của đợt 2: phòng chơi, máy chơi, đồng hồ, bảng xếp hạng, màn chiếu, bảng điều khiển giảng viên và gửi điểm Moodle đã có sẵn; mỗi game chỉ viết mô hình ẩn, máy chơi, thẻ mục tiêu và một mô-đun giao diện.

**Điểm Moodle (giống đợt 2):** 70% thẻ mục tiêu (tuyệt đối, 0–100) + 30% thứ hạng trong phòng, thang 10, lấy lần cao nhất.

## 2. Game 1 · Wave Rider (Chương 1) — ĐÃ XONG

**5 vòng = năm làn sóng của TMĐT Việt Nam** (mục 2.2 của chương): rao vặt và diễn đàn → mua theo nhóm và sàn thế hệ đầu → sàn hiện đại và ví điện tử → nội dung và livestream → dữ liệu, pháp lý và AI.

- Mỗi vòng hiện **sáu lớp hạ tầng** của thời đó (kết nối, thiết bị, niềm tin, thanh toán, giao hàng, dữ liệu) ở mức 0–3. Mức của làn sóng **sau** chỉ hiện một phần: có tin tức báo trước, không có số chính xác.
- Người chơi chia **10 chip vốn** cho sáu mô hình: website riêng, bán trên sàn, bán qua mạng xã hội, livestream, ứng dụng D2C, cửa hàng sẵn sàng cho AI agent.
- Lợi nhuận mỗi mô hình = độ khớp với hạ tầng của thời đó (ẩn) × **độ chia sẻ** (đông người đổ vào thì chia nhau). Đi trước một bước thì thắng; đi sớm hai bước hoặc đi muộn đều lỗ.
- **Câu hỏi chen giữa vòng** theo mục 10.3 và chương 1: phân biệt GMV – doanh thu – lợi nhuận, take rate, tiêu chí "kênh hình thành đơn hàng", ba mức AI-assisted / AI-driven / Agentic, bài toán tỷ lệ hoàn 10% ăn vào lợi nhuận mỗi đơn. Trả lời đúng được thêm 2 chip cho vòng sau.

**Thẻ mục tiêu (0–100):** vốn cuối game 60 + đi đúng nhịp sóng 25 + câu hỏi 15.

**Bài học:** hạ tầng thanh toán và giao hàng quyết định hình dạng thị trường; mỗi làn sóng chỉ cho lợi thế tạm thời; đi quá sớm cũng thua như đi quá muộn.

**Máy chơi:** đoán theo mốt (chạy theo mô hình đang thắng), ôm website, tất tay livestream, cân bằng, đi muộn một nhịp, và "đọc hạ tầng" (kiểu thắng).

## 3. Game 3 · Shopper Stream (Chương 3) — ĐÃ XONG

120.000 khách ảo thuộc 6 chân dung đi qua hành trình Khám phá → Tìm kiếm → So sánh → Mua → Đánh giá → Mua lại; sáu thương hiệu cùng giành tập khách này, 5 tháng.

- **10 điểm mỗi tháng** để sửa sáu bước trong hành trình. Lợi ích mỗi bước giảm dần theo số điểm, nên không thể sửa hết và cũng không nên dồn hết vào một bước.
- **Chọn kênh**: tìm kiếm trên sàn (vào từ bước Tìm kiếm), khám phá trên video ngắn (vào từ bước Khám phá, tiếp cận lớn nhất và hành trình dài nhất), hoặc AI agent mua hộ (vào từ bước So sánh, nhỏ nhưng giá trị cao và gần như thắng ăn cả).
- **Chân dung có nỗi đau ẩn**: mỗi chân dung thật sự rơi rụng ở một bước cụ thể (bảng trọng số ẩn ở máy chủ). Đào dữ liệu đánh giá của mình thì miễn phí nhưng chỉ nói thay cho chân dung đã mua của bạn; phỏng vấn tốn 1 trong 10 điểm nhưng bạn chọn người để nghe. Hiểu một chân dung làm mọi cải thiện tác dụng tốt hơn với nhóm đó.
- **Đánh giá có độ trễ**: điểm bỏ vào bước Đánh giá không sinh ra đơn ngay, nó tạo kho đánh giá thật và làm bước So sánh của tháng sau dễ hơn.
- **Sự cố giao hàng** rơi vào thương hiệu có nhiều khách nhất sau tháng 2. Không làm gì thì khách rời đi và còn lại đánh giá một sao; hoàn tiền thì giữ được như cũ; hoàn tiền kèm xin lỗi và chăm sóc tiếp thì khách quay lại trung thành **hơn trước khi có sự cố** (nghịch lý phục hồi dịch vụ).

**Thẻ mục tiêu (0–100):** giá trị khách giữ được 55 + tỷ lệ đơn từ khách quay lại 25 + điểm bỏ vào đúng chỗ đáng nhất 20. Phần thứ ba so kế hoạch của người chơi với mức tốt nhất mà đúng số điểm đó có thể mua được trong tháng, nên nó thưởng cho việc hỏi "một điểm bỏ vào đây đáng bao nhiêu".

**Cân bằng** (`scripts/balance-ss.ts`, mức Vừa, 150 ván): nghiên cứu rồi mới sửa 74 điểm (thắng 97%), chỉ sửa bước mua 49, đặt cược vào agent 39, chia đều 34, chạy theo giỏ hàng lớn 19, sửa chỗ rơi rụng lớn nhất 19.

**Bài học:** chỗ rơi rụng nhiều nhất chưa chắc đáng sửa nhất; doanh thu từ khách mua một lần không tạo ra gì; đào đánh giá của mình chỉ nghe được người đã mua; sự cố được xử lý đúng cách tạo ra khách trung thành hơn.

## 4. Game 10 · Agent Arena (Chương 10) — ĐÃ XONG

Năm quý của 2027–2028. Phần đơn hàng do AI agent đặt thay vì người đặt tăng từ 10% lên 58%; sáu người bán cạnh tranh để được agent chọn và để vẫn giữ được khách là người thật.

- **Tám quý-kỹ-sư mỗi quý** để xây tám năng lực AI, mỗi năng lực ba mức. Năm năng lực do **máy đọc**: thuộc tính chuẩn, tồn kho trực tuyến, tổng chi phí máy đọc được, chính sách có cấu trúc, API đặt hàng kèm định danh và hạn mức. Ba năng lực do **người cảm nhận**: hệ gợi ý, trợ lý AI, bằng chứng đáng tin (đánh giá đã xác thực, tỷ lệ giao đúng hẹn).
- **API đặt hàng là cánh cổng**: chưa có thì agent chỉ đọc được trang của bạn, không mua được — bạn được tham khảo chứ không được giao dịch. Phần khách qua agent dồn rất mạnh về cửa hàng trông tốt nhất, và đơn từ agent có lợi nhuận đóng góp cao hơn vì không cần thuyết phục.
- **Thứ đã xây thì vẫn còn đó — và vẫn tốn chi phí vận hành hằng quý.** Mua hết AI một lượt thì lỗ.
- **Rủi ro cài sẵn, lấy đúng từ chương 10**: máy định giá không có giá trần giá sàn (lỗi cấu hình, và khách so ảnh chụp giá với nhau); trợ lý không bao giờ chuyển người (trả lời sai câu hoàn tiền và bảo hành); hệ gợi ý không có ràng buộc đa dạng (dồn danh mục, đuôi dài chết dần, khách quay lại thấy đúng một cửa hàng); API đặt hàng được cấp quyền trên số tồn cũ một ngày (nhận hàng nghìn đơn cho hàng không có); và bảng điều khiển không có nhóm đối chứng (ghi công cho hệ gợi ý cả phần khách vốn đã mua).
- Mỗi quý người chơi thấy phần agent của quý này và **dự báo quý sau**, nên đọc đường cong là kỹ năng chính.

**Thẻ mục tiêu (0–100):** lợi nhuận cộng dồn 50 + giành được đơn từ agent 25 + mọi hệ thống tự động đều có người kiểm soát 25.

**Cân bằng** (`scripts/balance-ag.ts`, mức Vừa, 150 ván): đi theo đường cong agent và giữ kiểm soát 77 điểm (thắng 93%), chỉ lo cho người 52, tất tay vào agent từ quý 1 38, mua hết AI một lượt 35, hệ thống tốt nhưng không kiểm soát 23, giữ tiền không làm gì 15.

**Bài học:** tối ưu cho agent không thay cho tối ưu cho người, hãy làm tốt phần giao nhau; năng lực AI không phải lợi thế khi ai cũng có; mức tự chủ phải ngược với mức độ không thể hoàn tác; và tự động hóa không xóa được trách nhiệm.

## 5. Game 11 · Border Run (Chương 11)

Sáu thương hiệu Việt đưa một sản phẩm ra nước ngoài, 5 vòng.

- Chọn nước theo bảng chấm điểm của chương; Incoterms, mã HS, ngưỡng de minimis; kho FBA hay tự giao FBM; bản địa hóa bằng AI (có lỗi cài sẵn).
- Thẻ cám dỗ: đánh giá giả, dark pattern, bỏ kiểm tra người bán. Tăng doanh số ngay nhưng có xác suất bị sàn phát hiện ở vòng sau; cuối game lật xác suất và mức phạt thật.

**Thắng:** lợi nhuận × chỉ số niềm tin. **Bài học:** ranh giới thuyết phục – thao túng; nhãn hiệu đăng ký ở Việt Nam không có hiệu lực ở nước ngoài.

## 6. Game 5 · Pitch Arena (Chương 5)

Khác khung: một vòng thiết kế (thẻ phân khúc, value proposition, định vị, revenue stack, thang giá, SKU, kênh) → máy chủ chạy kiểm tra khả thi và mô phỏng 12 tháng theo nỗi đau ẩn của từng phân khúc → vòng gọi vốn chéo (mỗi người 1 tỷ ảo, không được đầu tư cho chính mình).

**Thắng:** lợi nhuận mô phỏng 12 tháng + vốn gọi được. **Bài học:** khác biệt phải thật; bẫy khuyến mãi; doanh thu tốt chưa chắc là doanh nghiệp tốt.

Vì vòng đời phòng khác (thiết kế → mô phỏng → gọi vốn, không phải nhiều vòng quyết định), game này cần một kiểu phòng riêng chứ không dùng `rs`. Làm sau cùng.

## 7. Quy trình cho từng game (giống đợt 1 và 2)

1. Lõi game trong `packages/engine/src/<game>/`, mô hình ẩn ở máy chủ.
2. Script cân bằng `packages/engine/scripts/balance-<game>.ts`, mô phỏng hàng trăm ván: chiến lược đúng bài học phải thắng, kiểu sai bài học phải thua.
3. Giao diện: một mô-đun `RsWeb` trong `apps/web/src/<game>/`.
4. Test ở `packages/engine/test/` và `apps/api/test/`.
5. Đưa lên production (`FIREBASE_ACCOUNT=mbahelp2002@gmail.com bash scripts/deploy.sh`).
6. UniGame Hub: thêm hoạt động vào `config/games.json` qua PR, merge, triển khai lại Hub.
7. Khóa 33: một hoạt động LTI trong mục Chung – chỉ nhóm ECOM-OCT thấy, điểm tối đa 10, lấy lần cao nhất, mô tả song ngữ.
8. Chơi thử một trận 6 người có điểm về Sổ điểm (script `players-rs.mts`: tạo phòng, sinh viên vào từ Moodle, AI chơi các ghế còn lại).
