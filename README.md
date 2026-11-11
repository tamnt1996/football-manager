# Đoán Từ

Game đoán từ tiếng Việt mỗi ngày (kiểu Wordle), chạy hoàn toàn trên trình duyệt, dùng GitHub Pages. Không server, không tài khoản.

- Mỗi ngày một từ, 6 lượt đoán, có gợi ý.
- Chơi tự do không giới hạn.
- Thống kê, chuỗi thắng, chia sẻ kết quả bằng ô màu.
- Dữ liệu chỉ lưu trong trình duyệt của người chơi.

## Thêm từ
Sửa `data/words.json`, mỗi mục: `{"w":"gia đình","k":"giadinh","h":"nơi có bố mẹ và các con"}`
(`k` là từ không dấu, không khoảng trắng, 4–8 chữ cái).

## Chạy thử
`python3 -m http.server 8000` rồi mở http://localhost:8000
