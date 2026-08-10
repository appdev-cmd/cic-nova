# CIC Nova Estimation

Hệ thống quản lý dự án, định mức cửa nhôm kính, giá vật tư, dự toán báo giá và tổng hợp đặt hàng nhôm cho Nova E&C.

## Thành phần

- `frontend/`: React 19, TypeScript và Vite.
- `backend/`: FastAPI, PostgreSQL/Supabase, pandas và openpyxl.
- `supabase-docker/`: hạ tầng Supabase dùng cho môi trường local/self-hosted.

## Chạy backend

1. Tạo virtual environment và cài dependency:

   ```powershell
   python -m venv backend\venv
   backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
   ```

2. Sao chép `backend/.env.example` thành `backend/.env`, sau đó cấu hình database và `NOVA_JWT_SECRET`.

3. Khởi động API:

   ```powershell
   backend\venv\Scripts\python.exe -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8080
   ```

## Chạy frontend

1. Sao chép `frontend/.env.example` thành `frontend/.env` nếu API không dùng địa chỉ mặc định.
2. Cài dependency và chạy:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

## Phân quyền

- `viewer`: xem dữ liệu, tính toán, preview và xuất báo giá/đơn nhôm.
- `editor`: toàn bộ quyền của viewer và được tạo/sửa/xóa dữ liệu nghiệp vụ.
- `admin`: toàn bộ quyền của editor và quản lý tài khoản.

Backend là nguồn quyết định quyền cuối cùng; việc ẩn nút trên frontend chỉ nhằm cải thiện trải nghiệm.

## Chức năng kiểm soát mới

- Phiên bản hóa báo giá bất biến với trạng thái nháp → đã duyệt → đã gửi → đã chấp nhận.
- Lưu và tải lại file Excel theo từng phiên bản; so sánh hai phiên bản mới nhất.
- Xuất riêng 2 file đính kèm theo yêu cầu Phụ lục: File 1 "Tổng hợp chi phí" (`TongHopChiPhi_DuAn_{id}.xlsx`) và File 2 "Báo giá" (`BaoGia_DuAn_{id}.xlsx`), đóng gói trong 1 file zip qua `GET /api/projects/{id}/export-split`.
- Xem trước file Opera `.xls`, `.xlsx`, `.xml` trước khi nhập và chặn dữ liệu sai.
- Báo cáo mã chưa ánh xạ, thiếu đơn giá và cửa có kích thước/số lượng không hợp lệ.
- Lịch sử thay đổi đơn giá theo giá mặc định, hệ đơn giá và dự án.
- Toast, hộp xác nhận thống nhất và cảnh báo khi đóng trang có biểu mẫu chưa lưu.

## Kiểm tra

```powershell
frontend\node_modules\.bin\eslint.cmd frontend
cd frontend; npm run build
cd ..; backend\venv\Scripts\python.exe -m unittest discover -s backend\tests -v
```

Để chạy thêm integration test trên PostgreSQL đã cấu hình:

```powershell
$env:NOVA_RUN_DB_TESTS='1'
backend\venv\Scripts\python.exe -m unittest backend.tests.test_integration_db -v
```

## Triển khai production bằng Docker

1. Tạo `backend/.env` từ file mẫu và đặt `NOVA_ENV=production`.
2. Cấu hình domain thật trong `NOVA_CORS_ORIGINS`.
3. Chạy:

   ```powershell
   docker compose -f docker-compose.production.yml up -d --build
   ```

4. Kiểm tra `GET /health`; response phải có `status: ok`.

Backup PostgreSQL thủ công:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup_database.ps1
```

CI tại `.github/workflows/ci.yml` tự chạy lint, frontend build, backend compile và unit test cho mỗi pull request.

## Lưu ý bảo mật

- Không commit `backend/.env`, `frontend/.env` hoặc thông tin Supabase.
- Mật khẩu/khóa từng xuất hiện trong lịch sử Git phải được rotate tại nhà cung cấp, sau đó mới làm sạch lịch sử.
- Production bắt buộc cấu hình `NOVA_ENV=production`, `NOVA_JWT_SECRET` mạnh và `NOVA_CORS_ORIGINS` đúng domain.
