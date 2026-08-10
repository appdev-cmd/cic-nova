# CIC Nova UI patterns

## Tokens

Màu sắc, chữ, border, radius và shadow dùng biến CSS trong `src/index.css`. Thành phần mới không tạo màu thương hiệu riêng; màu semantic được giới hạn ở success, warning và danger.

## Feedback

`FeedbackProvider` là nguồn feedback thống nhất:

- `notify(message, kind?)`: toast tự đóng, tối đa bốn thông báo, dùng `aria-live`; loại thông báo được suy luận nếu không truyền `kind`.
- `confirmAction(message, options?)`: hộp xác nhận bất đồng bộ, focus vào nút hủy, hỗ trợ Escape và đóng khi bấm backdrop.
- Thao tác phá dữ liệu dùng nút danger; thao tác phát hành/xác nhận dùng primary.
- Lỗi biểu mẫu có thể sửa ngay nên hiển thị inline; kết quả thao tác toàn cục dùng toast.

## Loading và empty state

- Danh sách dự án dùng skeleton trong lần tải đầu tiên.
- Nút gửi dữ liệu phải disabled và đổi nhãn khi đang xử lý.
- Bảng trống phải giải thích nguyên nhân và hành động tiếp theo nếu người dùng có quyền sửa.

## Data table

- Bảng được bọc bởi `.table-container` và cho phép cuộn ngang trên màn hình nhỏ.
- Nút chỉ có icon phải có `aria-label`, `title` khi ý nghĩa không hiển nhiên và vùng bấm tối thiểu 40×40 px.
- Danh sách lớn dùng phân trang; bộ lọc đặt trước bảng.

## Accessibility

- Luôn có `:focus-visible` rõ ràng.
- Modal dùng `role="dialog"` hoặc `alertdialog`, `aria-modal` và tiêu đề được liên kết.
- Không dùng màu làm tín hiệu duy nhất; trạng thái luôn có nhãn chữ.
- Tôn trọng `prefers-reduced-motion` cho toast và skeleton.
