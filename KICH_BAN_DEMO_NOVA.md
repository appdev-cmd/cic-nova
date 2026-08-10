# Kịch bản Demo phần mềm báo giá — Nova E&C

Mục tiêu: trình diễn đầy đủ 8 nhóm tính năng trong Phụ lục yêu cầu của Nova, theo đúng luồng nghiệp vụ thực tế (từ khai báo dữ liệu gốc → nhập dữ liệu dự án → tính giá → xuất báo giá/đặt hàng → quản trị). Thời lượng gợi ý: **45–60 phút** (có thể rút gọn còn 25–30 phút bằng cách bỏ các phần "mở rộng (tuỳ thời gian)").

## Chuẩn bị trước buổi demo

- [ ] Backend đang chạy (`GET /health` trả `status: ok`), database đã có dữ liệu mẫu (price book "Hệ đơn giá Tiêu chuẩn", indirect cost configs mẫu, vài mã vật tư, vài template cửa CSL-50.01/02/03).
- [ ] Đã có sẵn 2–3 tài khoản demo: 1 `admin`, 1 `editor`, 1 `viewer` (đặt tên rõ ràng, ví dụ `admin_demo`, `editor_demo`, `viewer_demo`) để minh hoạ mục 6.
- [ ] Chuẩn bị sẵn 2–3 file Opera mẫu để nhập trực tiếp trên máy (không gõ tay giữa buổi demo):
  - `opera_input_mau.xls`, `5017.xls` — dùng để demo **nhập Opera cho 1 dự án**.
  - 2–3 file Opera khác nhau (đại diện 2–3 dự án sản xuất cùng lúc) — dùng để demo **tổng hợp đặt hàng nhôm** (mục 7).
- [ ] Mở sẵn file mẫu `BAO GIA-NHOM KINH NOVA EC.xlsx` để đối chiếu khi xuất báo giá — cho Nova thấy phần mềm bám đúng form họ đưa.
- [ ] Tạo sẵn 1 dự án demo rỗng tên **"Golden City — Demo Nova"** để thao tác trực tiếp, tránh phải tạo dự án giữa chừng làm chậm nhịp.
- [ ] Trình duyệt zoom 100%, tắt thông báo hệ thống, chuẩn bị 2 tab: 1 tab app, 1 tab Excel/PDF vừa xuất ra để mở minh hoạ ngay.

---

## Phần 0 — Giới thiệu tổng quan (3 phút)

**Nói:** "Phần mềm gồm 5 khối chính bám sát đúng theo yêu cầu Nova đưa: Quản lý vật tư, Quản lý sản phẩm cửa, Quản lý dự án (nhập Opera + tính giá), Báo giá & đặt hàng, và Quản trị người dùng." Chỉ nhanh qua sidebar 5 module: **Dự án / Sản phẩm cửa / Vật tư / Đặt hàng nhôm / Người dùng**.

---

## Phần 1 — Quản lý mã vật tư (mục 1 phụ lục) — 6 phút

Module: **Vật tư** (`MaterialsModule`)

1. Mở danh sách vật tư — chỉ ra các nhóm: nhôm, gioăng, keo, kính, vật tư phụ, phụ kiện.
2. Tạo/sửa 1 vật tư mẫu → nhập **đơn giá mặc định** → giải thích: đây là giá áp dụng toàn hệ thống khi báo giá nếu không có gì khác. *(đáp ứng 1.a)*
3. Chuyển sang tab **Hệ đơn giá** → chỉ ra "Hệ đơn giá Tiêu chuẩn" đã seed sẵn → tạo thêm 1 hệ đơn giá mới, ví dụ "Hệ đơn giá dự án cao cấp" → sửa giá 1 vật tư trong hệ đơn giá này khác với giá mặc định. *(đáp ứng 1.b — nhiều option hệ đơn giá theo loại dự án)*
4. Vào dự án demo → sửa **đơn giá thủ công cho riêng dự án đó** (không ảnh hưởng dự án khác) → mở lại đúng vật tư đó, bấm **Lịch sử giá** → cho Nova xem ai sửa, lúc nào, giá cũ/giá mới. *(đáp ứng 1.c + kiểm soát thay đổi giá)*

**Điểm nhấn:** thứ tự ưu tiên giá — giá riêng dự án > hệ đơn giá đã chọn > giá mặc định.

---

## Phần 2 — Quản lý sản phẩm cửa (mục 2) — 5 phút

Module: **Sản phẩm cửa** (`DoorsModule`)

1. Mở thư viện mẫu cửa — chỉ mã cửa, mô tả, hệ nhôm, loại kính, công thức cắt profile/phụ kiện (CSL-50.01, CSL-50.02, CSL-50.03…).
2. Dùng ô tìm kiếm + bộ lọc theo **mã cửa** và **loại cửa** (cửa sổ/cửa đi/vách) → thu hẹp danh sách trực tiếp trên màn hình. *(đáp ứng 2.a, 2.b)*
3. (Tuỳ thời gian) Mở 1 mẫu cửa để show công thức tính vật tư theo profile — đây là phần "chất xám" giúp tính chính xác định mức nhôm/phụ kiện cho từng loại cửa.

---

## Phần 3 — Định mức & chi phí gián tiếp (mục 3) — 6 phút

Module: **Vật tư** hoặc trong **Dự án** (tuỳ nơi đặt UI) — bảng "Chi phí gián tiếp"

1. Show danh sách loại chi phí gián tiếp đã cấu hình sẵn, đúng ví dụ Nova đưa ra:
   - Vận chuyển: **Dưới 10km / 11–50km / Trên 50km**
   - Lắp đặt: **Tiêu chuẩn / Cao tầng**
   - Gia công theo m², Dự phòng rủi ro (%)
   *(đáp ứng 3.a — mỗi loại có nhiều option)*
2. Vào dự án demo → chọn option phù hợp cho dự án (ví dụ vận chuyển 11–50km, lắp đặt cao tầng).
3. Mở 1 sản phẩm cửa cụ thể trong dự án → sửa **riêng chi phí lắp đặt/vận chuyển/gia công cho đúng bộ cửa đó** (khác với option chung của dự án) → giải thích đây là do thực tế có bộ cửa đặc thù (ví dụ kính cường lực lớn cần lắp riêng). *(đáp ứng 3.b)*

---

## Phần 4 — Quản lý dự án: nhập Opera → tính giá → cân đối lợi nhuận (mục 4) — 12 phút — **phần trọng tâm demo**

Module: **Dự án** (`ProjectsModule`), dự án "Golden City — Demo Nova"

1. **Nhập Opera:** vào tab Import → chọn file `opera_input_mau.xls` (hoặc `5017.xls`) → bấm xem trước (preview).
   - Chỉ cho Nova thấy màn hình preview báo lỗi theo từng dòng (thiếu ánh xạ, sai đơn vị, số lượng không hợp lệ) **trước khi ghi vào hệ thống** — nhấn mạnh đây là điểm kiểm soát chất lượng dữ liệu.
   - Xác nhận import.
2. **Map mã vật tư:** vào tab vật tư Opera của dự án → với các mã Opera chưa map, chọn vật tư tương ứng trong danh mục hệ thống → giải thích: bước này quyết định **giá vốn sản xuất** thực tế của dự án (khác với giá tạm trên Opera). *(đáp ứng mục 4 phần map vật tư)*
3. Mở **Báo cáo chất lượng dữ liệu** của dự án → cho Nova thấy danh sách mã chưa ánh xạ / thiếu đơn giá / cửa sai kích thước-số lượng, để người quản trị xử lý tập trung.
4. Bấm **Chạy tính toán** → hệ thống tự tổng hợp: giá vật tư (theo đúng thứ tự ưu tiên giá ở Phần 1) + chi phí gián tiếp (lắp đặt/gia công/vận chuyển/dự phòng) đã chọn ở Phần 3. *(đáp ứng "tính toán, tổng hợp chi phí gián tiếp")*
5. **Cân đối lợi nhuận:** vào tab Cân đối lợi nhuận → nhập % lợi nhuận mục tiêu hoặc tổng giá bán mong muốn → hệ thống **chia ngược giá bán về đơn giá/m² cho từng bộ cửa** → cho Nova thấy bảng kết quả đơn giá/m² theo từng loại cửa được tính tự động, có thể chỉnh tay từng dòng nếu cần. *(đáp ứng trọn vẹn mục 4 — điểm khác biệt lớn nhất so với làm Excel thủ công)*

---

## Phần 5 — Báo giá (mục 5) — 8 phút

Vẫn ở dự án demo, sau khi đã tính toán và cân đối lợi nhuận.

1. Bấm **Xuất Báo Giá Excel** → mở file vừa tải, đối chiếu song song với file mẫu gốc `BAO GIA-NHOM KINH NOVA EC.xlsx` của Nova → chỉ ra: đúng layout, đúng sheet `DETAIL` (báo giá) và `CPHoanThien` (tổng hợp chi phí), **các ô vẫn là công thức Excel sống** (bấm vào ô Tổng cộng cho Nova thấy công thức `=SUBTOTAL(...)`, ô đơn giá bình quân `=IFERROR(J.../H...)`, liên kết chéo `=DETAIL!J...`) — không phải giá trị tĩnh copy-paste. *(đáp ứng "có công thức và link với nhau")*
2. Bấm nút **"Xuất 2 File Đính Kèm"** (tính năng mới) → giải thích: theo đúng yêu cầu Phụ lục mục 8, hệ thống xuất **2 file Excel riêng biệt** đóng gói trong 1 zip: `TongHopChiPhi_DuAn_{id}.xlsx` và `BaoGia_DuAn_{id}.xlsx`, sẵn sàng gửi email cho khách hàng mà không lộ chi phí nội bộ. *(đáp ứng mục 8)*
3. Chỉ vào cột mô tả sản phẩm trong sheet DETAIL → giải thích mô tả này được **tự sinh từ dữ liệu CSV Opera đã nhập** (hệ nhôm, loại kính, phụ kiện) chứ không phải gõ tay. *(đáp ứng "thể hiện mô tả sản phẩm theo dự án")*
4. **Phiên bản hoá báo giá** (điểm cộng, tuỳ thời gian): vào tab Phiên bản báo giá → tạo 1 phiên bản mới → chỉ vòng đời trạng thái nháp → đã duyệt → đã gửi → đã chấp nhận, và khả năng so sánh 2 phiên bản để thấy chênh lệch giá khi khách yêu cầu điều chỉnh.

---

## Phần 6 — Quản lý người dùng (mục 6) — 4 phút

Module: **Người dùng** (`UserManagementModule`) — đăng nhập bằng tài khoản `admin_demo`

1. Show danh sách user, tạo nhanh 1 user mới, gán role.
2. Giải thích 3 cấp quyền: **viewer** (chỉ xem/tính toán/xuất báo giá, không sửa được dữ liệu), **editor** (sửa dữ liệu nghiệp vụ), **admin** (toàn quyền + quản lý user).
3. Đăng xuất, đăng nhập bằng `viewer_demo` → thử vào màn Vật tư → chỉ ra nút sửa/xoá đã bị ẩn/khoá, kể cả khi cố gọi thẳng API cũng bị chặn ở backend (không chỉ ẩn giao diện) — nhấn mạnh tính an toàn dữ liệu.

> Lưu ý nói với Nova: hiện tại đang ở giai đoạn demo nên dùng đúng 3 role cố định này; nếu sau này cần phân quyền chi tiết hơn theo từng cá nhân/từng module, có thể mở rộng thêm ở giai đoạn triển khai chính thức.

---

## Phần 7 — Tổng hợp đặt hàng nhôm (mục 7) — 8 phút

Module: **Đặt hàng nhôm** (`AluminumOrderModule`)

1. Giải thích tình huống thực tế: xưởng sản xuất nhiều dự án cùng lúc, mỗi dự án đã có file Opera tối ưu cắt riêng → cần **gộp lại thành 1 đơn đặt hàng nhôm duy nhất** để mua với số lượng lớn, tránh đặt trùng/thiếu.
2. Upload 2–3 file Opera của các dự án khác nhau (đã chuẩn bị sẵn) → bấm xem trước (preview) → hệ thống hiện tổng số mã, tổng số thanh, tổng khối lượng.
3. Xuất file tổng hợp → mở file, chỉ 2 phần: bảng tổng hợp theo mã + kích thước + số lượng (đúng form đặt hàng), và sheet **"CHI TIẾT NGUỒN"** cho biết số lượng đó đến từ dự án/file nào — rất hữu ích khi cần truy vết hoặc chia hàng về lại từng dự án.

---

## Phần 8 — Báo cáo tổng kết (mục 8) — đã lồng ghép ở Phần 5

Nhắc lại nhanh: 2 file đính kèm bắt buộc (Tổng hợp chi phí / Báo giá) đã demo ở Phần 5 bước 2 — không cần lặp lại, chỉ tóm tắt 1 câu để chốt phần yêu cầu.

---

## Kết thúc — Q&A và bảng đối chiếu (5 phút)

Chốt lại bằng bảng tóm tắt (in giấy hoặc chiếu slide cuối) — đối chiếu 8 mục yêu cầu với tính năng đã demo, để Nova ký nhận từng mục ngay tại buổi họp:

| # | Yêu cầu Phụ lục Nova | Đã demo ở phần |
|---|---|---|
| 1 | Quản lý mã vật tư — đơn giá mặc định / hệ đơn giá / sửa riêng dự án | Phần 1 |
| 2 | Quản lý sản phẩm cửa — thư viện + bộ lọc | Phần 2 |
| 3 | Định mức, chi phí gián tiếp — nhiều option + sửa riêng từng cửa | Phần 3 |
| 4 | Quản lý dự án — nhập Opera, map vật tư, tính chi phí, cân đối lợi nhuận → giá/m² | Phần 4 |
| 5 | Báo giá — xuất theo template Nova, công thức liên kết, mô tả từ Opera | Phần 5 |
| 6 | Quản lý user — tạo, phân quyền, quản lý bởi admin | Phần 6 |
| 7 | Tổng hợp đặt hàng nhôm từ nhiều dự án | Phần 7 |
| 8 | 2 file báo cáo riêng: tổng hợp chi phí & báo giá | Phần 5 (bước 2) |

**Câu hỏi nên chủ động hỏi ngược Nova cuối buổi:**
- Form mẫu báo giá và form đặt hàng nhôm hiện dùng có đúng 100% với mẫu Nova đang dùng nội bộ không, hay cần chỉnh thêm cột/label?
- File Opera thực tế Nova xuất ra có luôn đúng cấu trúc như file mẫu đang dùng demo không?
- Có cần phân quyền chi tiết hơn 3 role (viewer/editor/admin) khi triển khai chính thức không?

---

*Tài liệu này đi kèm [README.md](README.md) và [PROJECT_REVIEW_AND_ROADMAP.md](PROJECT_REVIEW_AND_ROADMAP.md) trong repo.*
