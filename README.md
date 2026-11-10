# Ngày gia đình đi chơi

Web tĩnh gợi ý địa điểm đi chơi cho gia đình, chạy bằng GitHub Pages. Không cần server hay cài đặt.

## Thêm địa điểm
Sửa `data/places.json`, thêm một đối tượng mới:

```json
{"id":"ten-khong-dau","name":"Tên địa điểm","city":"Hà Nội","area":"Quận","category":"Công viên",
 "setting":"Ngoài trời","ages":["toddler","kids","teen","senior"],"budget":1,
 "duration":"Nửa ngày","desc":"Mô tả ngắn","tip":"Mẹo nhỏ"}
```
- `setting`: `Trong nhà` hoặc `Ngoài trời`; `budget`: 1 (tiết kiệm) đến 3 (thoải mái).
- `ages`: `toddler`, `kids`, `teen`, `senior`.

## Chạy thử trên máy
`python3 -m http.server 8000` rồi mở http://localhost:8000

## Bật GitHub Pages
Repo → Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save.
Link: `https://<tên-github>.github.io/<tên-repo>/`
