# Football Manager

Chạy local: `npm start` → http://localhost:3000 (cần Node ≥ 22.5). Không đặt `ADMIN_TOKEN` thì mọi người đều là admin.

## Deploy miễn phí (Render)
1. Đẩy thư mục này lên một repo GitHub.
2. render.com → New → Blueprint → chọn repo (đọc `render.yaml`) → Apply.
3. Vào service → Environment, xem giá trị `ADMIN_TOKEN` (tự sinh). Đây là mã đăng nhập admin (nút "Admin" trên web).
4. Mở URL `https://<tên>.onrender.com`.

Lưu ý bản free: máy ngủ sau ~15 phút không có truy cập (lần mở đầu chậm ~50 giây) và ổ đĩa không bền vững →
mỗi lần khởi động lại, dữ liệu FPL tự đồng bộ lại, nhưng cầu thủ nhập tay/import sẽ mất.
Đội hình của người dùng lưu trong trình duyệt nên không bị ảnh hưởng.
