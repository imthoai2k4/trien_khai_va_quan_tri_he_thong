# Quyết định kiến trúc — Hệ thống đặt vé xem phim

> Tài liệu này ghi lại các quyết định thiết kế và kiến trúc đã chốt.
> Các task phát triển tham chiếu file này thay vì suy luận lại.
> Cập nhật sau mỗi task nếu có quyết định mới.

---

## 1. Kiến trúc mục tiêu

**Chọn: Node.js + Express + MySQL + Docker Compose (hệ thống đầy đủ)**

Lý do: Kế hoạch môn học (`KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md`) yêu cầu:
- Backend xử lý nghiệp vụ (booking, payment, auth)
- MySQL lưu trữ dữ liệu
- Docker Compose triển khai toàn bộ stack
- Monitoring (Prometheus + Grafana) và Logging (Loki + Promtail)

Không thể đáp ứng bằng website static thuần. `PRODUCT.md` ghi nhận stack "Static HTML/CSS" nhưng đây là ghi nhận tạm thời ban đầu — kiến trúc thực tế phải là Node.js + Express + MySQL để đáp ứng yêu cầu nghiệm thu.

### Giải quyết mâu thuẫn PRODUCT.md vs KE_HOACH

| Điểm | PRODUCT.md | KE_HOACH | Quyết định |
|------|-----------|----------|------------|
| Stack | Static HTML/CSS | Node.js + Express + MySQL + Docker | **Node.js + Express + MySQL + Docker** |
| Giao diện | Web | Web | Web — HTML/CSS/JS được Express phục vụ |
| Database | Không đề cập | MySQL 8 | **MySQL 8** |
| Auth | Không rõ | Hash password, role admin | **bcrypt hash, session-based auth** |
| Triển khai | Không rõ | Docker Compose | **Docker Compose** |
| Monitoring | Không rõ | Prometheus + Grafana + cAdvisor + mysqld-exporter | **Đầy đủ theo kế hoạch** |
| Logging | Không rõ | Loki + Promtail | **Đầy đủ theo kế hoạch** |

### Điểm thống nhất giữa hai tài liệu
- Chức năng: xem phim, suất chiếu, chọn ghế, đặt vé, thanh toán giả lập
- Admin: CRUD phim/phòng/ghế/suất, xem booking/payment
- Bảo mật: không commit secret, parameterized queries, hash mật khẩu
- Nginx là điểm truy cập công khai duy nhất

---

## 2. Cấu trúc thư mục mục tiêu

```text
TKPM/
├── app/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── public/          # Static assets (CSS, JS, images)
│   │   └── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── Dockerfile
├── database/
│   ├── init.sql
│   └── sample-data.sql
├── nginx/
│   ├── nginx.conf
│   └── certs/
│       └── .gitkeep
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml
│   ├── grafana/
│   │   └── provisioning/
│   └── mysql-exporter/
│       └── my.cnf.example
├── logging/
│   ├── loki/
│   │   └── loki-config.yml
│   └── promtail/
│       └── promtail-config.yml
├── docs/
│   └── DECISIONS.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 3. Giao diện

- **Phương pháp:** HTML/CSS/JS tĩnh, được Express phục vụ qua thư mục `public/`
- **Không dùng framework frontend** (React, Vue, v.v.) — giữ đơn giản theo yêu cầu
- **Template engine:** Không dùng — giao diện là file HTML static, gọi API bằng `fetch()`
- **Responsive:** Hỗ trợ màn hình nhỏ, bố cục linh hoạt

---

## 4. Backend & API

- **Runtime:** Node.js (LTS)
- **Framework:** Express.js
- **Database driver:** `mysql2` (hỗ trợ promise, connection pool)
- **Truy vấn:** Parameterized queries — không dùng ORM, giữ SQL rõ ràng
- **Password hashing:** `bcrypt` hoặc `bcryptjs`
- **Session:** `express-session` với store phù hợp (memory cho dev, có thể nâng cấp)
- **Metrics:** `prom-client` cho endpoint `/metrics`
- **Logging:** JSON structured logging (console output, Promtail thu thập)

---

## 5. Xác thực & Phân quyền

- **Cơ chế:** Session-based authentication (không dùng JWT cho đơn giản)
- **Role:** `user` và `admin`
- **Bảo vệ route:** Middleware kiểm tra session + role
- **Tài khoản demo:**
  - Admin: `admin@demo.com` / password trong `.env.example` (hash trong DB)
  - User: `user@demo.com` / password tương tự

---

## 6. Database

- **Engine:** MySQL 8
- **Schema:** 9 bảng theo kế hoạch (`users`, `movies`, `cinemas`, `rooms`, `seats`, `showtimes`, `bookings`, `booking_seats`, `payments`)
- **Ràng buộc quan trọng:**
  - UNIQUE constraint trên `(showtime_id, seat_id)` trong `booking_seats` — lớp bảo vệ cuối cùng
  - Foreign keys với `ON DELETE` phù hợp
  - Booking status: `pending` → `confirmed` / `failed` / `cancelled`
- **Giữ ghế tạm thời:** Không triển khai cơ chế hold/reserve phức tạp — đặt vé là thao tác nguyên tử trong transaction. Ghi nhận đây là giới hạn có chủ đích.
- **Xử lý concurrent booking:** Dựa vào UNIQUE constraint + transaction + xử lý lỗi duplicate entry

---

## 7. HTTPS & Security Headers

- **Quyết định:** Ưu tiên HTTPS tự ký cho demo
- **Nếu HTTPS tự ký:**
  - Cung cấp script/hướng dẫn tạo cert cục bộ
  - Không commit private key (đã có trong `.gitignore`)
  - README cảnh báo trình duyệt sẽ hiển thị warning
- **Security headers (luôn áp dụng):**
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-XSS-Protection: 0`
  - `Content-Security-Policy: default-src 'self'`
  - `Strict-Transport-Security` (chỉ khi HTTPS)

---

## 8. Docker Compose — Cổng và mạng

| Service | Cổng nội bộ | Cổng public (host) | Ghi chú |
|---------|-------------|---------------------|---------|
| nginx | 80, 443 | **80, 443** | Điểm truy cập duy nhất |
| app | 3000 | Không expose | Chỉ truy cập qua nginx |
| mysql | 3306 | Không expose | Chỉ nội bộ |
| phpmyadmin | 80 | **8080** | Chỉ cho demo/dev |
| prometheus | 9090 | **9090** | Chỉ cho demo/dev |
| grafana | 3000 | **3001** | Chỉ cho demo/dev |
| cadvisor | 8080 | Không expose | Prometheus scrape nội bộ |
| mysqld-exporter | 9104 | Không expose | Prometheus scrape nội bộ |
| loki | 3100 | Không expose | Promtail gửi nội bộ |
| promtail | — | Không expose | Đọc log Docker |

> **Lưu ý:** Trong môi trường production thực tế, chỉ nên expose nginx. phpMyAdmin, Prometheus, Grafana được expose ở đây để phục vụ demo và nghiệm thu môn học.

---

## 9. URL truy cập demo

```text
Website:        http://localhost        (hoặc https://localhost nếu HTTPS)
phpMyAdmin:     http://localhost:8080
Prometheus:     http://localhost:9090
Grafana:        http://localhost:3001
```

---

## 10. Phiên bản image dự kiến

| Image | Phiên bản | Ghi chú |
|-------|-----------|---------|
| node | 20-alpine | LTS, nhẹ |
| mysql | 8.0 | Theo yêu cầu |
| phpmyadmin | 5 | Stable |
| nginx | 1.25-alpine | Nhẹ, ổn định |
| prom/prometheus | v2.53.0 | Cố định |
| grafana/grafana | 11.1.0 | Cố định |
| gcr.io/cadvisor/cadvisor | v0.49.1 | Cố định |
| prom/mysqld-exporter | v0.15.1 | Cố định |
| grafana/loki | 3.1.0 | Cố định |
| grafana/promtail | 3.1.0 | Cố định |

> Phiên bản sẽ được xác nhận khi triển khai thực tế. Ưu tiên cố định thay vì `latest`.

---

## 11. Câu hỏi đã xác nhận

- **Ngôn ngữ giao diện:** Tiếng Việt ✅
- **Poster phim demo:** Dùng ảnh miễn phí từ internet (Unsplash, v.v.) ✅

## 12. Câu hỏi mở (chưa quyết định)

1. **Tên repository GitHub chính thức:** Kế hoạch gợi ý `MSSV-movie-ticket` — cần MSSV thực tế từ người dùng.
2. **Tên brand/thương hiệu:** Hiện tại là `TKPM` (tên thư mục) — chưa rõ đây có phải tên chính thức.
3. **Accessibility target:** Chưa chọn chuẩn WCAG cụ thể nào.
4. **phpMyAdmin trong production:** Kế hoạch cho expose port 8080 để demo — cần xác nhận có giới hạn truy cập không (IP whitelist, basic auth).

---

## 13. Quyết định Task 1 — Bộ khung repository

### 13.1. Dependency của app

| Package | Phiên bản khai báo | Vai trò | Task dùng |
|---------|--------------------|---------|-----------|
| `express` | `^4.21.2` | Web framework | Task 4 |
| `mysql2` | `^3.11.5` | Driver MySQL (promise pool) | Task 4 |
| `express-session` | `^1.18.1` | Session-based auth | Task 8 |
| `bcryptjs` | `^2.4.3` | Hash mật khẩu | Task 8 |
| `prom-client` | `^15.1.3` | `/metrics` cho Prometheus | Task 11 |
| `dotenv` | `^16.4.5` | Nạp `.env` khi chạy cục bộ | Task 1 |

Quyết định kèm theo:

- **Dùng `bcryptjs`, không dùng `bcrypt`.** `bcrypt` cần build native; `bcryptjs` là JS thuần, cài giống nhau trên Windows và trong image Alpine. Mục 4 cho phép chọn một trong hai.
- **Chốt Express 4 (`^4.21.2`), không dùng Express 5.** Express 4 ổn định và khớp tài liệu/hướng dẫn phổ biến; chưa có yêu cầu nào cần tính năng của Express 5.
- **Không dùng `nodemon`.** Dùng `node --watch` có sẵn từ Node 18 để giảm dependency.
- **Dùng CommonJS** (`require`), không dùng ESM — giữ đơn giản, khớp ví dụ Express phổ biến.
- `dotenv` được thêm vì Task 4 yêu cầu cấu hình DB pool qua biến môi trường và cần cách nạp `.env` khi chạy cục bộ ngoài Docker.

### 13.2. Phạm vi bộ khung

- `app/src/server.js` chỉ có `GET /healthz` (kiểm tra tiến trình) và phục vụ file tĩnh từ `app/src/public/`. **Không** có API nghiệp vụ — `/healthz` không phải endpoint nghiệp vụ.
- `app/src/public/index.html` chỉ là trang giữ chỗ của bộ khung, không phải giao diện thật (Task 3).
- `app/Dockerfile` là bản tối thiểu, chạy bằng user non-root `node`. Healthcheck, volume và cấu hình đầy đủ thuộc Task 9.
- `docker-compose.yml` **chỉ có service `app`**. Việc map cổng `APP_PORT` trực tiếp ra host là tạm thời để kiểm tra skeleton; **phải bỏ khi Nginx được thêm ở Task 9**, vì Nginx là điểm truy cập công khai duy nhất (mục 8).
- `database/` chỉ có `.gitkeep`. Không tạo schema hay dữ liệu mẫu (Task 2).
- `nginx/certs/` chỉ có `.gitkeep`; chưa có `nginx.conf` (Task 10).

## 14. Quyết định Task 2 — Schema MySQL

### 14.1. Tên cột và kiểu dữ liệu

- Dùng `duration_minutes` (thay vì `duration`) để rõ đơn vị, tránh nhầm lẫn với các cột đơn vị khác.
- `price` trong `showtimes` kiểu `DECIMAL(10,2)` — đơn giá theo suất chiếu (không phải theo ghế), cho phép phòng VIP/thường có giá khác nhau về sau.
- `total_amount` trong `bookings` phản ánh tổng thực thu tại thời điểm tạo đơn, không tính lại qua JOIN — tránh sai số khi giá thay đổi.

### 14.2. Cơ chế FK tổ hợp bảo vệ nhất quán dữ liệu

`bookings` có `UNIQUE (id, showtime_id)`, và `booking_seats` tham chiếu bằng FK tổ hợp `(booking_id, showtime_id) → bookings(id, showtime_id)`. Nhờ vậy `booking_seats.showtime_id` không thể lệch với `showtime_id` của đơn — điều kiện để `UNIQUE(showtime_id, seat_id)` thực sự có ý nghĩa.

### 14.3. Quy ước vòng đời ghế

- Ghế chỉ bị giữ khi có dòng trong `booking_seats`.
- Đơn `failed` và `cancelled` phải **xóa** các dòng `booking_seats` tương ứng (Task 4 phụ trách).
- `UNIQUE(showtime_id, seat_id)` là vô điều kiện — không thể giữ ghế của đơn thất bại mà không chặn đặt mới.

### 14.4. Không dùng trigger

Không dùng trigger để enforce quy tắc liên bảng (payment thất bại ≠ booking confirmed). Trigger áp đặt thứ tự thao tác cứng, dễ phá vỡ transaction ở Task 4. Tầng DB bảo đảm tính nhất quán nội tại của từng bảng (CHECK constraints), còn quy tắc liên bảng được enforce trong transaction ở Task 4.

### 14.5. Dữ liệu mẫu

- Mật khẩu demo: bcrypt hash thật (`bcryptjs`). `admin@demo.com` / `Admin@123`, `user@demo.com` và `binh@demo.com` / `User@123`.
- Ngày suất chiếu: `2026-10-10 → 2026-10-12`. Sau thời điểm này dữ liệu là quá khứ; cần cập nhật nếu demo "suất sắp chiếu".
- `sample-data.sql` có thể chạy lại nhiều lần (xóa ID mẫu trước khi chèn lại).

---

## 15. Quyết định Task 3 — Giao diện static

### 15.1. Cấu trúc file

| File | Vai trò |
|------|---------|
| `public/index.html` | Danh sách phim + filter now_showing/coming_soon |
| `public/movie.html` | Chi tiết phim + chọn suất chiếu theo ngày |
| `public/seats.html` | Sơ đồ ghế theo phòng |
| `public/checkout.html` | Xác nhận đơn hàng + chọn phương thức thanh toán |
| `public/result.html` | Kết quả thành công / thất bại + thẻ vé |
| `public/css/style.css` | Design system toàn bộ (tokens, components, utilities) |
| `public/js/data.js` | Dữ liệu mẫu local khớp `sample-data.sql`, helper functions |
| `public/js/app.js` | State management (sessionStorage), router, page logic |

### 15.2. State Management

- Dùng `sessionStorage` để truyền state (selectedMovieId, selectedShowtimeId, selectedSeatIds, bookingResult) giữa các trang HTML riêng biệt.
- Không dùng URL query string cho state nhạy cảm (trừ `movie.html?id=N` để có thể bookmark và share link phim).

### 15.3. Thanh toán giả lập

- Kết quả thanh toán ngẫu nhiên: ~80% thành công, ~20% thất bại — để demo được cả hai trạng thái mà không cần thao tác đặc biệt.
- Khi thất bại: không tạo booking code, thẻ vé hiển thị trạng thái thất bại, ghế không bị giữ (phản ánh đúng quy ước Task 2).
- Không gọi bất kỳ API nào; không lưu dữ liệu vào server.

### 15.4. Accessibility

- Mọi button/input có `aria-label` hoặc label rõ ràng.
- Sơ đồ ghế dùng `role="group"` + `aria-label`; ghế là `button` với `aria-pressed`.
- Dùng `role="note"` cho demo banner, `aria-live="polite"` cho các vùng cập nhật động.
- Navigation keyboard: `:focus-visible` style rõ ràng.

### 15.5. Thiết kế

- Dark mode (nền `#0a0a0f`), palette đỏ-cam-vàng theo chủ đề cinema.
- Font: `Outfit` (display/heading) + `Inter` (body) từ Google Fonts.
- Glassmorphism cho navbar, booking panel.
- Micro-animation: card hover lift, seat scale, result icon pop, ticket slide-up.
- Responsive: 1-cột ở mobile, 2-cột (phim+info, sơ đồ+panel) ở ≥1024px.

## 16. Quyết định Task 4 — Express Backend (API Đọc)

### 16.1. Cấu trúc và Kiến trúc Backend
- Cấu trúc module rõ ràng: `routes` (định tuyến), `controllers` (xử lý logic, lấy dữ liệu), `services` (kết nối cơ sở dữ liệu), `middleware` (xử lý lỗi).
- Dùng `mysql2/promise` với connection pool, cấu hình lấy từ biến môi trường qua `dotenv`.
- Sử dụng Parameterized Queries (`db.execute('... WHERE id = ?', [id])`) cho mọi truy vấn để phòng chống SQL Injection.

### 16.2. Xử lý lỗi (Error Handling)
- Middleware xử lý lỗi tập trung `errorHandler.js`.
- Không trả về `stack trace` hoặc chi tiết lỗi nhạy cảm của MySQL cho client (luôn trả `{"error": "Internal Server Error"}` với lỗi 500), nhưng log chi tiết (bao gồm đường dẫn, method, error msg) ở phía server.

### 16.3. API Đọc dữ liệu
- API được thiết kế dưới dạng RESTful:
  - `GET /api/movies` (Hỗ trợ query `?status=...`)
  - `GET /api/movies/:id`
  - `GET /api/movies/:id/showtimes` (Lấy kèm thông tin rạp và phòng chiếu qua lệnh `JOIN`).
- Dữ liệu trả về dưới dạng JSON thô. Giao diện (Task 5) sẽ chịu trách nhiệm fetch và hiển thị.
- Các route booking, seats, và thanh toán chưa được implement (sẽ thuộc Task 6, 7).

## 17. Quyết định Task 5 — Nối Frontend tĩnh với API Backend

### 17.1. Chuyển đổi Fetch API
- Các trang `index.html` (danh sách phim) và `movie.html` (chi tiết phim) đã được cập nhật logic JS (`app.js`) để ngắt kết nối với `DEMO_DATA` cho phần dữ liệu tĩnh. Thay vào đó, gọi trực tiếp `/api/movies` và `/api/movies/:id`.
- Helper functions từ `DEMO_DATA` (như `formatPrice`, `formatDatetime`, `formatDuration`) vẫn được tái sử dụng để giảm thiểu lặp logic format.

### 17.2. Xử lý trạng thái (Loading & Error State)
- **Loading**: Hiển thị text "Đang tải dữ liệu phim..." ngay khi gọi API.
- **Error**: Do MySQL chưa được khởi động trên môi trường host, API sẽ trả về lỗi `500`. JS ở client bắt lỗi này và render thông báo "Lỗi: Không thể tải dữ liệu từ máy chủ (có thể Database đang offline)" ra giữa màn hình thay vì vỡ layout hoặc báo trắng trang.

### 17.3. Giới hạn phạm vi kết nối
- Các trang luồng thanh toán (`seats.html`, `checkout.html`, `result.html`) tạm thời chưa kết nối API vì các endpoint xử lý giữ chỗ, ghế ngồi (thuộc Task 6) và booking (thuộc Task 7) chưa được xây dựng trên backend. Sẽ được nối tuần tự theo các task tiếp theo.

## 18. Quyết định Task 6 — Trạng thái ghế và tạo booking an toàn (Transaction)

### 18.1. API Đọc Sơ Đồ Ghế (`GET /api/showtimes/:id/seats`)
- Trả về danh sách toàn bộ ghế thuộc phòng của suất chiếu đó.
- Cross-check với bảng `booking_seats` để gán thêm cờ `is_booked` = `true/false` cho từng ghế.
- Điều này loại bỏ hoàn toàn cơ chế lấy ghế cứng từ `DEMO_DATA.getBookedSeats()`.

### 18.2. API Tạo Booking An Toàn (`POST /api/bookings`)
- Đầu vào: `showtime_id`, `seat_ids` (mảng tối đa 8 ghế).
- **Validation**: Đảm bảo tất cả ID ghế đều có thật, và cùng thuộc về `room_id` của `showtime_id` đó.
- **Transaction**: 
  - Tạo record trong bảng `bookings` (`status = pending`).
  - Loop insert từng ghế vào `booking_seats`.
- **Concurrency (Tranh chấp ghế)**: Nếu có 2 người cùng đặt 1 ghế, nhờ constraint `UNIQUE (showtime_id, seat_id)` trên MySQL, người đến sau sẽ gặp lỗi `ER_DUP_ENTRY` (mã 1062).
  - Node.js catch lỗi này, gọi `connection.rollback()` hủy toàn bộ đơn, và trả về HTTP 409 Conflict với dòng chữ `"Một hoặc nhiều ghế đã bị người khác đặt. Vui lòng chọn lại."`

## 19. Quyết định Task 7 — Thanh toán giả lập và mã vé

### 19.1. API Thanh Toán (`POST /api/payments`)
- Đầu vào: `booking_id`, `method`, `simulate_status`.
- **Idempotency (Thao tác lặp an toàn)**: Dùng `SELECT ... FOR UPDATE` để khóa dòng booking trong Database. Nếu trạng thái không còn là `pending` (đã `confirmed` hoặc `failed`), lập tức trả về lỗi. Chống lại việc gửi đúp request tạo ra nhiều payment success hoặc thanh toán thành công 2 lần.
- **Xử lý thất bại**: Nếu giả lập trả về `failed`, lập tức cập nhật trạng thái booking thành `failed` và thực thi `DELETE FROM booking_seats WHERE booking_id = ?` để giải phóng ghế cho người khác mua.
- **Xử lý thành công**: Nếu `success`, cập nhật booking thành `confirmed` và ghi nhận `paid_at`. Mã vé chỉ có giá trị khi booking `confirmed`.

### 19.2. Nối API vào Giao diện (App.js)
- `initSeatsPage`:
  - Gọi `/api/showtimes/:id/seats` để lấy sơ đồ thật và trạng thái `is_booked` thật, không dùng hàm giả của `data.js`.
  - Nút "Tiếp tục thanh toán" gọi `/api/bookings` để khóa ghế an toàn. Nếu dính lỗi trùng ghế 409, tự động reload lại trang sau 1.5s để cập nhật sơ đồ ghế mới nhất.
- `initCheckoutPage`:
  - Gọi `/api/payments` để giả lập thanh toán (tỉ lệ 80% thành công theo logic cũ).
  - Truyền mã đơn và ID thanh toán sang màn hình kết quả `result.html`.

## 20. Quyết định Task 8 — Đăng nhập và Trang quản trị

### 20.1. Cơ chế xác thực (JWT)
- **Công nghệ**: Sử dụng `jsonwebtoken` để sinh JWT và `bcryptjs` để kiểm tra mật khẩu đã mã hóa trong MySQL.
- Mật khẩu của tài khoản Admin được hash bằng `bcrypt` từ trước khi đưa vào dữ liệu mẫu (chống lưu trơn - plaintext).
- Khi đăng nhập thành công (`POST /api/auth/login`), API trả về Token có thời hạn sử dụng. Client (Trình duyệt) lưu token này vào `sessionStorage` và gửi kèm trong Header `Authorization: Bearer <token>` mỗi khi gọi API quản trị.

### 20.2. Phân quyền (Role-based Access Control)
- Tạo `authMiddleware.js` với hàm `verifyTokenAndRole()`. Bất kỳ route nào của Admin (`/api/admin/*`) đều phải đi qua Middleware này. Nếu không có token, token hết hạn, hoặc `role` không phải `admin`, API sẽ trả về lỗi `401 Unauthorized` hoặc `403 Forbidden`.

### 20.3. Trang Quản trị tĩnh (`admin.html`)
- Xây dựng giao diện Đăng nhập và Dashboard cơ bản.
- Dashboard tự động hiển thị:
  - Tổng số vé đã đặt thành công.
  - Tổng doanh thu thực tế.
  - 10 Giao dịch gần nhất (kết hợp `JOIN` bảng `users` để hiển thị tên khách hàng).
- Việc thao tác các dữ liệu khác (CRUD Phim, Suất chiếu) sử dụng mô hình RESTful đã dựng trước đó nhưng sẽ được chặn lại thông qua AuthMiddleware (hiện tại Dashboard tập trung vào theo dõi hoạt động kinh doanh).

## 21. Quyết định Task 9 — Docker Compose & Nginx Proxy

### 21.1. Kiến trúc hệ thống Containers
- **Node.js App (`tkpm_app`)**: Build từ `Dockerfile` (Node 20 Alpine). Không mở cổng trực tiếp ra ngoài host.
- **MySQL (`tkpm_db`)**: Dùng `mysql:8.0`. Có ánh xạ thư mục `database/` để tự động chạy file `init.sql` và `sample-data.sql` ngay khi lần đầu tiên dựng volume.
- **Nginx (`tkpm_nginx`)**: Hoạt động như một Reverse Proxy. Nhận yêu cầu từ cổng 80 ở Host, trỏ ngầm vào cổng 3000 của container `app`.
- **phpMyAdmin (`tkpm_pma`)**: Chạy ở cổng `8080` ở host. Chỉ mở cho mục đích demo/phát triển.

### 21.2. Mức độ phụ thuộc & Healthcheck
- Cấu hình Nginx phải đợi App (`depends_on: app`).
- Cấu hình App phải đợi Database sẵn sàng (`depends_on: db: condition: service_healthy`).
- Database có `healthcheck` ping định kỳ để đảm bảo MySQL thực sự có thể phục vụ (sử dụng lệnh `mysqladmin ping`).

## 22. Quyết định Task 10 — Hardening Nginx và cấu hình bảo mật/vận hành

### 22.1. Security Headers & Content Security Policy (CSP)
- **Vị trí khai báo:** Toàn bộ security headers được khai báo duy nhất ở cấp `server` với chỉ thị `always` (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 0`). Không đặt trong các block `location` để tránh việc `add_header` trong `location` ghi đè các header kế thừa từ `server` và tránh trùng lặp.
- **CSP (Content-Security-Policy):**
  - Khai báo nghiêm ngặt: `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, `form-action 'self'`.
  - Nới lỏng tối thiểu cho tài nguyên thực tế: `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com`.
  - Khắc phục tương thích CSP: Loại bỏ `href="javascript:history.back()"` trong `seats.html`, thay bằng ID `#back-btn` và gắn event listener trong `app.js` để tuyệt đối không dùng inline script / javascript scheme, bảo đảm an toàn với CSP `script-src 'self'`.
- **HSTS (Strict-Transport-Security):** Chỉ kích hoạt trên block server HTTPS (`default-ssl.conf.example`) với `max-age=31536000`. Tuyệt đối không bật trên server block HTTP để tránh khóa domain hoặc lỗi truy cập cục bộ. Không dùng `includeSubDomains` hoặc `preload` cho môi trường demo.

### 22.2. Quản lý chứng chỉ và HTTPS tự ký
- **Tùy chọn HTTPS:** Trạng thái mặc định của repo luôn phục vụ HTTP (cổng 80) để đảm bảo khởi động không lỗi. Cấu hình HTTPS được cung cấp dưới dạng file mẫu `nginx/conf.d/default-ssl.conf.example` (Nginx chỉ nạp `*.conf`, không nạp `.example`).
- **An toàn chứng chỉ:**
  - Mount thư mục `./nginx/certs:/etc/nginx/certs:ro` dạng read-only trong `docker-compose.yml` và mở sẵn cổng `443:443`.
  - Cấu hình `.gitignore` loại trừ toàn bộ `nginx/certs/*` (ngoại trừ `.gitkeep`) và loại trừ `nginx/conf.d/default-ssl.conf` để ngăn chặn rò rỉ private key hoặc chứng chỉ nội bộ vào git.

### 22.3. Giới hạn tài nguyên và Timeout
- Cấu hình các giới hạn an toàn ở context http/server:
  - `client_max_body_size 1m`: Đủ cho các API JSON của hệ thống nhưng ngăn chặn tấn công DoS tải file lớn.
  - `client_body_timeout 15s`, `client_header_timeout 15s`, `send_timeout 30s`.
  - `large_client_header_buffers 4 16k`.
  - `proxy_connect_timeout 5s`, `proxy_send_timeout 30s`, `proxy_read_timeout 30s`.
- Không khai báo lại `keepalive_timeout` trong `default.conf` do đã được định nghĩa ở file cấu hình gốc `/etc/nginx/nginx.conf` của image alpine (tránh lỗi duplicate directive).

### 22.4. Xử lý lỗi Upstream Proxy và Che giấu thông tin
- **`server_tokens off;`**: Ẩn phiên bản Nginx khỏi header `Server` và các trang mã lỗi mặc định.
- **Xử lý lỗi 502/503/504:** Kích hoạt `proxy_intercept_errors on;` cùng với các named location (`@upstream_502`, `@upstream_503`, `@upstream_504`). Các trang lỗi trả về thông báo văn bản ngắn gọn, giữ nguyên HTTP status code, không để lộ đường dẫn tệp tin, tên container hay chi tiết kiến trúc nội bộ khi container `app` gặp sự cố.

---

## Lịch sử cập nhật

| Ngày | Task | Thay đổi |
|------|------|----------|
| 2026-10-07 | Task 0 | Tạo tài liệu quyết định ban đầu |
| 2026-10-07 | Task 0 | Xác nhận ngôn ngữ giao diện tiếng Việt và poster demo dùng ảnh miễn phí |
| 2026-10-07 | Task 1 | Thêm mục 13: bộ khung repository, chốt dependency và phạm vi skeleton |
| 2026-10-09 | Task 2 | Thêm mục 14: schema 9 bảng, cơ chế FK tổ hợp, quy ước giải phóng ghế, không trigger |
| 2026-10-09 | Task 3 | Thêm mục 15: giao diện static 5 trang, design system, state management, thanh toán giả lập |
| 2026-10-09 | Task 4 | Thêm mục 16: cấu trúc backend Express, connection pool MySQL, API phim/suất chiếu, xử lý lỗi an toàn |
| 2026-10-09 | Task 5 | Thêm mục 17: Cập nhật giao diện gọi API /movies, xử lý trạng thái loading/error an toàn |
| 2026-10-09 | Task 6 | Thêm mục 18: Viết API Booking sử dụng Transaction, khóa ghế an toàn chống đặt trùng |
| 2026-10-09 | Task 7 | Thêm mục 19: API Thanh toán giả lập, thao tác lặp an toàn, nối luồng UI hoàn chỉnh |
| 2026-10-09 | Task 8 | Thêm mục 20: JWT Authentication, phân quyền Admin và Dashboard quản trị cơ bản |
| 2026-10-09 | Task 9 | Thêm mục 21: Kiến trúc Docker Compose, Reverse Proxy Nginx và Database Healthcheck |
| 2026-10-10 | Task 10 | Thêm mục 22: Hardening Nginx, security headers, CSP, giới hạn request, xử lý lỗi upstream và HTTPS demo |
