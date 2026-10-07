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

## Lịch sử cập nhật

| Ngày | Task | Thay đổi |
|------|------|----------|
| 2026-10-07 | Task 0 | Tạo tài liệu quyết định ban đầu |
| 2026-10-07 | Task 0 | Xác nhận ngôn ngữ giao diện tiếng Việt và poster demo dùng ảnh miễn phí |
| 2026-10-07 | Task 1 | Thêm mục 13: bộ khung repository, chốt dependency và phạm vi skeleton |
