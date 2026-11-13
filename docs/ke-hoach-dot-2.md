# ECOM Arena – Kế hoạch đợt 2 (Game 2, 6, 7, 8)

Ngày 13/11/2026. Môn E-commerce 2026, khóa Moodle ECOM-OCT (course 33). Hạ tầng, ngôn ngữ (song ngữ Anh – Việt) và ba chế độ chơi giống đợt 1 ([ke-hoach-dot-1.md](ke-hoach-dot-1.md)).

## 1. Khung chung cho game nhiều vòng

Cả bốn game đợt 2 dùng chung một khung (`packages/engine/src/rs/`):
- **Phòng chơi chung:** cùng một vòng đời phòng (sảnh chờ → ra quyết định → kết quả → … → tổng kết), cùng máy chơi, đồng hồ, bảng xếp hạng, màn chiếu, bảng điều khiển giảng viên, gửi điểm Moodle.
- **Mỗi game chỉ viết phần riêng:**
  - mô hình ẩn trên máy chủ;
  - máy chơi;
  - thẻ mục tiêu;
  - một mô-đun giao diện.
- **Dùng tiếp cho đợt 3:** Game 1, 3, 10, 11 cũng là game nhiều vòng nên sẽ dùng khung này.

**Điểm Moodle:** 70% thẻ mục tiêu (tuyệt đối, 0–100) + 30% thứ hạng trong phòng, thang 10, lấy lần cao nhất.

## 2. Bốn game

| Game | Chương | Vòng | Người chơi quyết định | Thẻ mục tiêu |
|---|---|---|---|---|
| 🌐 **Platform Wars** – *Chiến tranh nền tảng* | 2 | 6 quý | Phí sàn, trợ giá và trợ cho phía nào, quảng cáo trên sàn, chi an toàn – tin cậy, chương trình gắn kết, hàng nhãn riêng (từ quý 4) | Lợi nhuận lũy kế 45, thị phần GMV 25 (giảm giá trị nếu mua bằng lỗ), sức khỏe nền tảng 30 |
| 🧪 **CRO Battle** – *Đấu trường A/B* | 6 | 5 sprint | Áp dụng/gỡ 13 thay đổi; tối đa 2 thử nghiệm A/B mỗi sprint (tỷ lệ traffic, số tuần, dừng cố định hay xem trộm) | Tỷ lệ chuyển đổi THẬT 50, đơn tăng thêm 20, kỷ luật thử nghiệm 30 |
| 📣 **Ad Auction & Creator Clash** – *Đại chiến quảng cáo và nhà sáng tạo* | 7 | 5 tháng | ROAS hòa vốn (tháng 1), giá thầu và ngân sách tìm kiếm, chất lượng trang đích, đặt creator, nhắm lại, livestream, CRM, thử nghiệm đối chứng | Lợi nhuận tăng thêm 50, khách quay lại 20, kỷ luật đo lường 30 |
| 🛍️ **Peak Day Ops 11.11** – *Đại tiệc 11.11* | 8 | 5 vòng | Chuẩn bị (tồn kho, giao vận, cam kết giao, đổi trả, gian lận, COD); 3 ca ngày sale (giảm giá, quảng cáo, nhân viên CSKH, COD, nhập gấp); sau sale (xả hàng, hoàn tiền, chẩn đoán) | Lợi nhuận 50, điểm đánh giá 20, chẩn đoán đúng 2 khoản chi phí lớn nhất 20, kỷ luật tồn kho 10 |

**Điểm cạnh tranh trực tiếp giữa 6 người:**

| Game | Sáu người cạnh tranh ở đâu |
|---|---|
| Game 2 | Cùng giành người mua và người bán của một thành phố |
| Game 6 | Cùng bảng xếp hạng; cuối trận lật tỷ lệ thật |
| Game 7 | Cùng một phiên đấu giá từ khóa; mỗi creator chỉ một thương hiệu đặt được |
| Game 8 | Cùng nhóm khách 11.11; hết hàng thì khách sang đối thủ |

## 3. Máy chơi và cân bằng

Mỗi game có 6 kiểu máy chơi, mô phỏng hàng trăm ván. Chiến lược đúng bài học phải thắng:

| Game | Kiểu thắng (điểm TB, mức Vừa) | Kiểu thua |
|---|---|---|
| 2 | Chiến lược gia nền tảng ≈ 74 | Đốt tiền ≈ 20, Thu phí cao ≈ 22 |
| 6 | Thận trọng ≈ 71, Kỷ luật ≈ 58 | Xem trộm ≈ 34, Mẫu nhỏ ≈ 35, HiPPO ≈ 11 |
| 7 | Đo lường tăng thêm ≈ 55 | Săn người nổi tiếng ≈ 8, Chạy theo ROAS ≈ 13 |
| 8 | Chuyên gia vận hành ≈ 72 | Ôm hàng ≈ 21, COD tất cả ≈ 13 |

Script cân bằng nằm trong `packages/engine/scripts/balance-*.ts`.

## 4. Moodle

- **UniGame Hub:** PR danh mục [thoannv1976/unigamehub#12](https://github.com/thoannv1976/unigamehub/pull/12) thêm 4 hoạt động: `platform-wars`, `cro-battle`, `ad-clash`, `peak-day`. Sau khi merge, chạy `finish-ecomoctgames-batch2.sh` (Git Bash) để triển khai lại Hub.
- **Khóa 33:** mỗi game một hoạt động trong mục Chung. Cài đặt giống đợt 1:
  - chỉ nhóm ECOM-OCT thấy;
  - điểm tối đa 10, lấy lần cao nhất;
  - có mô tả song ngữ.
- **Kiểm thử mỗi game:** sinhvien001 cùng 5 người chơi giả lập chơi một trận, rồi kiểm tra điểm hiện trong Sổ điểm.
