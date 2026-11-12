# Hồ Tây Online

Thế giới 2D nhiều người chơi chạy **hoàn toàn trên GitHub Pages**, không cần server riêng: tạo nhân vật, dạo quanh Hồ Tây
(Chùa Trấn Quốc, quán cà phê, bến thuyền vịt), trò chuyện, và mời nhau chơi **Đoán Từ đối kháng**.
Có thêm **Đoán Từ hằng ngày** chơi một mình (`doantu.html`).

## Cách hoạt động
- Kết nối ngang hàng (WebRTC) qua thư viện [Trystero](https://github.com/dmotz/trystero); mọi người vào cùng một "phòng" sẽ tự tìm thấy nhau.
- Phòng chung mặc định là `cong-dong`. Bấm "🔒 Phòng riêng" để tạo phòng có mã riêng, rồi gửi link `?phong=mã` cho bạn bè.
- Nếu không tải được thư viện P2P, game chuyển sang chế độ chỉ chơi giữa các tab trên cùng một máy (để thử).

## Chạy thử trên máy
`python3 -m http.server 8000` rồi mở http://localhost:8000 (cần chạy qua http, không mở file trực tiếp).

## Hạn chế
- Phù hợp nhóm nhỏ (khoảng 10–20 người một phòng). Một số mạng công ty/4G chặn WebRTC có thể không kết nối được.
- Không có tài khoản: tên lưu trong trình duyệt, không đảm bảo duy nhất (tên trùng sẽ tự thêm ký hiệu).
- Ván đấu không có trọng tài trung tâm nên người rành kỹ thuật có thể gian lận; không có kiểm duyệt chat.
