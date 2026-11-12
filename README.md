# Hồ Tây Online

Thế giới 2D nhiều người chơi chạy **hoàn toàn trên GitHub Pages**, không cần server riêng: tạo nhân vật, đi ngang trên đường dạo
bên bờ Hồ Tây (hồ ở phía sau, xa xa là Chùa Trấn Quốc và đường chân trời Hà Nội; quán cà phê trứng, bến thuyền vịt, bánh tôm, trà đá, Phủ Tây Hồ),
trò chuyện, và mời nhau chơi **Đoán Từ**, **Cờ tướng**, **Cờ úp**.
Có thêm **Đoán Từ hằng ngày** chơi một mình (`doantu.html`).

## Cách hoạt động
- Kết nối ngang hàng (WebRTC) qua thư viện [Trystero](https://github.com/dmotz/trystero); mọi người vào cùng một "phòng" sẽ tự tìm thấy nhau.
- Phòng chung mặc định là `cong-dong`. Bấm "🔒 Phòng riêng" để tạo phòng có mã riêng, rồi gửi link `?phong=mã` cho bạn bè.
- Nếu không tải được thư viện P2P, game chuyển sang chế độ chỉ chơi giữa các tab trên cùng một máy (để thử).

## Chạy thử trên máy
`python3 -m http.server 8000` rồi mở http://localhost:8000 (cần chạy qua http, không mở file trực tiếp).

## Cờ úp
Tất cả quân (trừ hai tướng) bị úp và xáo trộn trong mỗi bên. Quân úp đi theo vai trò của ô nó đang đứng; đi xong thì lật ra và từ đó đi theo đúng quân thật.
`xiangqi.js` là bộ luật dùng chung (đã kiểm tra bằng perft: 44 / 1920 / 79666 nước ở độ sâu 1–3).

## Hạn chế
- Phù hợp nhóm nhỏ (khoảng 10–20 người một phòng). Một số mạng công ty/4G chặn WebRTC có thể không kết nối được.
- Không có tài khoản: tên lưu trong trình duyệt, không đảm bảo duy nhất (tên trùng sẽ tự thêm ký hiệu).
- Ván đấu không có trọng tài trung tâm nên người rành kỹ thuật có thể gian lận (ví dụ xem được quân úp bằng công cụ lập trình); không có kiểm duyệt chat.
- Cờ chưa có đồng hồ, xin hòa, hay luật chiếu liên tục/lặp thế.
