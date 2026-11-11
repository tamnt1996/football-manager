# Hồ Tây Online

Thế giới 2D nhiều người chơi: tạo nhân vật, dạo quanh Hồ Tây (Chùa Trấn Quốc, quán cà phê, bến thuyền vịt),
trò chuyện, và mời nhau chơi **Đoán Từ đối kháng**. Ngoài ra có **Đoán Từ hằng ngày** chơi một mình (`doantu.html`).

## Chạy trên máy
```
node server.js        # Node >= 20, không cần cài thư viện
```
Mở http://localhost:3000 bằng nhiều tab để thử nhiều người chơi.

## Cấu trúc
- `server.js` — HTTP tĩnh + WebSocket tự viết (đăng ký tên, vị trí, chat, mời chơi, ván đấu).
- `shared.js` — hằng số thế giới, va chạm với mặt hồ, hàm chấm điểm (dùng cho cả server và trình duyệt).
- `world.js`, `world.css`, `index.html` — thế giới và giao diện.
- `doantu.*` — game Đoán Từ hằng ngày. `data/words.json` — kho từ.

## Triển khai (Render, miễn phí)
Render → New → Blueprint → chọn repo này (đọc `render.yaml`). Link dạng `https://<tên>.onrender.com`.
Lưu ý bản free: máy ngủ sau ~15 phút không dùng, và tài khoản (`users.json`) mất khi máy khởi động lại.

## Hạn chế hiện tại
Tên + mã bí mật lưu trong trình duyệt (không có mật khẩu, không có email); chưa có kiểm duyệt chat.
