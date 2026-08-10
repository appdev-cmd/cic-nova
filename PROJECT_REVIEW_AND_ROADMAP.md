# Rà soát và lộ trình hoàn thiện CIC Nova

## Trạng thái hiện tại

Đợt tối ưu ưu tiên cao đã hoàn thành, tập trung vào khả năng vận hành an toàn, phân quyền đúng, sử dụng tốt trên thiết bị nhỏ và kiểm soát thay đổi đơn giá.

### Đã hoàn thành

- Bảo vệ toàn bộ API nghiệp vụ bằng JWT và phân quyền `viewer`, `editor`, `admin` ở backend.
- Loại bỏ khóa JWT, mật khẩu Supabase và cấu hình CORS cố định khỏi mã nguồn.
- Nâng cấp băm mật khẩu; vẫn tương thích tài khoản dùng định dạng băm cũ.
- Chỉ cho phép khởi tạo admin khi hệ thống chưa có người dùng.
- Bổ sung kiểm tra dữ liệu đầu vào, giới hạn dung lượng upload và tên file an toàn.
- Cô lập file tạm khi import/export, tự dọn file sau khi tải và tránh ghi đè giữa nhiều người dùng.
- Không trả chi tiết exception/database ra trình duyệt.
- Bổ sung API client có token dùng thống nhất ở frontend; đăng nhập lỗi theo nguyên tắc fail-closed.
- Ẩn và khóa thao tác sửa dữ liệu đối với `viewer` ở các module chính.
- Bổ sung tìm kiếm và sửa thông tin dự án; xuất báo giá có xác thực.
- Bổ sung lịch sử đơn giá theo giá mặc định, hệ đơn giá và dự án/Opera, gồm người sửa, thời điểm, giá cũ và giá mới.
- Cải thiện responsive cho sidebar, bảng, modal và slide panel; bổ sung focus, focus trap và nhãn truy cập cho nút biểu tượng.
- Bổ sung cấu hình mẫu, hướng dẫn cài đặt và test hồi quy cho xác thực, validation và độ phủ phân quyền API.

## Đợt hoàn thiện mở rộng

### P1 — Hoàn thiện trải nghiệm nghiệp vụ

Trạng thái: đã triển khai feedback thống nhất, cảnh báo thay đổi chưa lưu, skeleton, phân trang dự án và integration-test harness.

1. Thay `alert/confirm` bằng toast và hộp thoại xác nhận thống nhất, có trạng thái loading và lỗi theo từng biểu mẫu.
2. Bổ sung autosave hoặc cảnh báo thay đổi chưa lưu ở màn hình định mức cửa và cân đối lợi nhuận.
3. Chuẩn hóa empty state, skeleton loading, phân trang và bộ lọc cho danh sách lớn.
4. Bổ sung test tích hợp với PostgreSQL cho lịch sử giá, import Opera và xuất báo giá.

### P2 — Quản trị báo giá

Trạng thái: đã triển khai phiên bản bất biến, ghi chú, Excel/PDF lưu kèm, vòng đời trạng thái, so sánh và khôi phục thành bản nháp mới.

1. Tạo phiên bản báo giá bất biến theo lần phát hành.
2. Thêm trạng thái `nháp`, `đã duyệt`, `đã gửi`, `đã chấp nhận`, `đã hủy`.
3. Lưu người duyệt, thời điểm, ghi chú và bản Excel/PDF tương ứng từng phiên bản.
4. Cho phép so sánh hai phiên bản và khôi phục từ phiên bản cũ thành bản nháp mới.

### P2 — Import và chất lượng dữ liệu

Trạng thái: đã triển khai xem trước XLS/XLSX/XML, lỗi theo dòng, chặn import không hợp lệ, kiểm tra ánh xạ/đơn giá/kích thước và báo cáo chất lượng theo dự án.

1. Hoàn thiện nhập Opera cho các biến thể XLS/XLSX/XML thực tế.
2. Thêm màn hình đối chiếu cột, xem trước dữ liệu và báo lỗi theo dòng trước khi ghi database.
3. Bổ sung kiểm tra mã vật tư trùng, thiếu ánh xạ và sai đơn vị tính.
4. Tạo báo cáo dữ liệu chưa hoàn chỉnh để người quản trị xử lý tập trung.

### P3 — Vận hành production

Trạng thái: đã có Docker production, health check, log JSON, cảnh báo request chậm, script backup, CI và kiểm thử responsive tự động ở 390 px. Kiểm thử E2E với database staging và thiết bị/browser thật cần môi trường vận hành tương ứng.

1. Chạy E2E cho ba vai trò trên database staging và bộ file Opera/báo giá thực tế.
2. Thiết lập backup, giám sát lỗi, log có cấu trúc và cảnh báo thời gian phản hồi.
3. Chạy audit WCAG đầy đủ và kiểm thử trên Chrome, Edge, Safari cùng màn hình điện thoại thật.
4. Thiết lập CI bắt buộc lint, build và test trước khi hợp nhất mã.

## Việc xác nhận cần môi trường bên ngoài

- Chạy integration test với `NOVA_RUN_DB_TESTS=1` trên PostgreSQL staging sau khi có backup.
- Chạy E2E bằng tài khoản `viewer`, `editor`, `admin` trên dữ liệu mẫu đã được doanh nghiệp duyệt.
- Xác nhận file Opera XML thực tế của doanh nghiệp nếu cấu trúc khác schema phổ biến đang hỗ trợ.
- Kiểm thử Safari/iOS và Chrome/Edge trên thiết bị thật; vòng kiểm thử hiện tại đã đạt trên in-app Chromium ở desktop và viewport 390×844.

## Điều kiện trước khi triển khai production

- Cấu hình `NOVA_ENV=production`, `NOVA_JWT_SECRET` mạnh và `NOVA_CORS_ORIGINS` đúng domain.
- Rotate mọi mật khẩu/khóa từng xuất hiện trong lịch sử Git.
- Chạy migration và test trên bản sao database trước khi áp dụng cho dữ liệu thật.
- Sao lưu database và file mẫu báo giá trước lần phát hành đầu tiên.
