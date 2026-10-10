# Hệ thống đặt vé xem phim (TKPM)

Website đặt vé xem phim: xem phim, xem suất chiếu, chọn ghế, đặt vé và thanh toán giả lập; kèm trang quản trị cơ bản cho admin. Đây là đồ án môn học, được triển khai độc lập bằng Docker Compose.

> **Trạng thái hiện tại: hoàn thành Task 10 — hardening Nginx & cấu hình vận hành.**
> Hệ thống chạy đầy đủ qua Docker Compose: MySQL, Express (API phim/suất chiếu/đặt vé/thanh toán giả lập/đăng nhập), giao diện tĩnh và Nginx reverse proxy đã được gia cố security headers, giới hạn request/timeout và xử lý lỗi proxy an toàn.
> **Chưa có** HTTPS mặc định (là tùy chọn demo — xem mục 9.2), và **chưa có** monitoring (`/metrics`, Prometheus, Grafana) hay logging tập trung (Loki/Promtail) — thuộc Task 11–13.

---

## 1. Mô tả

Hệ thống cho phép người dùng duyệt phim, chọn suất chiếu, chọn ghế trên sơ đồ phòng chiếu, tạo đơn đặt vé và thực hiện thanh toán giả lập (thành công/thất bại), sau đó nhận mã đặt vé nếu thanh toán thành công. Quản trị viên quản lý phim, rạp/phòng/ghế/suất chiếu và xem danh sách đơn đặt vé cùng trạng thái thanh toán.

Ràng buộc nghiệp vụ quan trọng: **một ghế chỉ được bán một lần trong cùng một suất chiếu**, và **thanh toán thất bại không được xác nhận vé**. Xem `docs/DECISIONS.md` để biết chi tiết kiến trúc đã chốt.

## 2. Stack công nghệ

| Thành phần | Công nghệ | Trạng thái |
|---|---|---|
| Backend | Node.js 20 LTS + Express 4 | Đã khai báo dependency |
| Giao diện | HTML/CSS/JS tĩnh do Express phục vụ (không React/Vue) | Mới có trang giữ chỗ |
| Cơ sở dữ liệu | MySQL 8, driver `mysql2`, SQL tham số hóa (không ORM) | Chưa triển khai |
| Xác thực | `express-session` + `bcryptjs`, role `user`/`admin` | Chưa triển khai |
| Metrics | `prom-client` (`GET /metrics`) | Chưa triển khai |
| Reverse proxy | Nginx (điểm truy cập công khai duy nhất) | Đã triển khai + hardening Task 10 |
| Triển khai | Docker + Docker Compose | Mới có compose khung |
| Quan sát | Prometheus, Grafana, cAdvisor, mysqld-exporter | Chưa triển khai |
| Logging | Loki + Promtail | Chưa triển khai |

## 3. Cấu trúc thư mục

```text
TKPM/
├── app/
│   ├── src/
│   │   ├── controllers/        # (trống) logic xử lý request — task sau
│   │   ├── routes/             # (trống) khai báo route — task sau
│   │   ├── services/           # (trống) truy vấn DB, nghiệp vụ — task sau
│   │   ├── middleware/         # (trống) auth, validate, logging — task sau
│   │   ├── public/             # tài nguyên tĩnh Express phục vụ
│   │   │   └── index.html      # trang giữ chỗ của bộ khung
│   │   └── server.js           # Express server tối thiểu
│   ├── package.json
│   ├── package-lock.json
│   └── Dockerfile
├── database/                   # (trống) init.sql, sample-data.sql — Task 2
├── nginx/
│   └── certs/                  # chứng chỉ tự ký, không commit private key
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   └── mysql-exporter/
├── logging/
│   ├── loki/
│   └── promtail/
├── docs/
│   └── DECISIONS.md            # quyết định kiến trúc đã chốt
├── docker-compose.yml          # khung, hiện chỉ có service `app`
├── .env.example
├── .gitignore
├── README.md
├── PRODUCT.md
├── KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md
└── KE_HOACH_CHIA_TASK_CHO_AI_AGENT.md
```

## 4. Biến môi trường dự kiến

Sao chép `.env.example` thành `.env` rồi chỉnh giá trị. **Không commit `.env`.**

| Biến | Mặc định trong `.env.example` | Dùng cho |
|---|---|---|
| `MYSQL_DATABASE` | `movie_ticket` | Tên database |
| `MYSQL_USER` | `movie_app` | Tài khoản MySQL cho app (không dùng `root`) |
| `MYSQL_PASSWORD` | `change_me` | Mật khẩu tài khoản app |
| `MYSQL_ROOT_PASSWORD` | `change_me_root` | Mật khẩu root MySQL (chỉ dùng nội bộ) |
| `APP_PORT` | `3000` | Cổng Express lắng nghe |
| `NODE_ENV` | `development` | Chế độ chạy |
| `SESSION_SECRET` | `change_me_session_secret` | Ký session |
| `GRAFANA_ADMIN_USER` | `admin` | Tài khoản Grafana |
| `GRAFANA_ADMIN_PASSWORD` | `change_me` | Mật khẩu Grafana |
| `MYSQL_EXPORTER_USER` | `exporter` | Tài khoản cho mysqld-exporter |
| `MYSQL_EXPORTER_PASSWORD` | `change_me_exporter` | Mật khẩu mysqld-exporter |

Tất cả giá trị trên là placeholder, **không phải secret thật**. Đổi trước khi dùng cho bất kỳ môi trường nào khác ngoài demo cục bộ.

## 5. Yêu cầu môi trường

- Git
- Node.js 20 LTS trở lên và npm
- Docker Desktop + Docker Compose (cần cho các task hạ tầng, chưa cần ở Task 1)

## 6. Cài đặt dependency

```bash
cd app
npm install
```

Lệnh này cài dependency theo `package.json` và `package-lock.json`. Dùng `npm ci` khi cần cài lại đúng phiên bản đã khóa trong lockfile.

## 7. Chạy tối thiểu

Chạy trực tiếp bằng Node (không cần Docker):

```bash
cd app
cp ../.env.example ../.env     # Windows: copy ..\.env.example ..\.env
npm start
```

Mặc định server lắng nghe ở `http://localhost:3000`. Có thể đổi bằng biến `APP_PORT`.

Kiểm tra bộ khung:

```bash
curl http://localhost:3000/healthz     # -> {"status":"ok","service":"movie-ticket-app",...}
curl -I  http://localhost:3000/        # -> 200, phục vụ app/src/public/index.html
curl     http://localhost:3000/khong-ton-tai   # -> 404 {"error":"Not Found"}
```

Chế độ tự khởi động lại khi sửa file:

```bash
npm run dev
```

Chạy bằng Docker Compose (khung, chỉ có service `app`):

```bash
docker compose up --build
```

> `app/src/server.js` hiện chỉ có `/healthz` và phục vụ file tĩnh. `/healthz` là endpoint kiểm tra tiến trình, **không phải** API nghiệp vụ.

## 8. Các service sẽ bổ sung ở task sau

| Service | Task | Ghi chú |
|---|---|---|
| `mysql`, `phpmyadmin` | Task 9 | MySQL 8 + quản trị dữ liệu; MySQL không public |
| `nginx` | Task 9 / Task 10 ✅ | Reverse proxy, security headers, giới hạn request, xử lý lỗi proxy; HTTPS tự ký là tùy chọn (mục 9.2) |
| `prometheus`, `prom-client` `/metrics` | Task 11 ✅ | Metrics HTTP request, latency, lỗi 4xx/5xx, booking/payment; Prometheus chạy tại :9090 |
| `grafana`, `cadvisor`, `mysqld-exporter` | Task 12 ✅ | Dashboard container, app, MySQL; Grafana chạy tại :3001, exporter nội bộ |
| `loki`, `promtail` | Task 13 | Log tập trung, truy vấn LogQL |

Lộ trình đầy đủ và ba commit mốc bắt buộc nằm trong `KE_HOACH_CHIA_TASK_CHO_AI_AGENT.md`.

## 9. URL truy cập

| Dịch vụ | HTTP | HTTPS (tùy chọn, xem 9.2) |
|---|---|---|
| Website (qua Nginx) | `http://localhost` | `https://localhost` |
| phpMyAdmin | `http://localhost:8080` | — |
| Prometheus | `http://localhost:9090` | — |
| Grafana | `http://localhost:3001` | — |

`Loki / Promtail: thu thập log tập trung` sẽ được bổ sung ở Task 13.

### 9.1. Security headers và giới hạn request (Task 10)

Nginx đặt các header sau **trên mọi phản hồi**, kể cả phản hồi lỗi:

```text
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 0
Content-Security-Policy: default-src 'self'; ...
```

- `Strict-Transport-Security` **chỉ** được bật khi phục vụ qua HTTPS (mục 9.2). Không bao giờ bật trên kết nối HTTP.
- CSP giữ `default-src 'self'` và `script-src 'self'`; chỉ mở thêm đúng những nguồn mà giao diện đang dùng: `fonts.googleapis.com` / `fonts.gstatic.com` (Google Fonts trong `app/src/public/css/style.css`) và `images.unsplash.com` (poster phim demo). `style-src` phải cho phép `'unsafe-inline'` vì giao diện hiện dùng thuộc tính `style=` và một khối `<style>` trong `admin.html`.
- Giới hạn và timeout đang áp dụng: `client_max_body_size 1m`, `client_body_timeout 15s`, `client_header_timeout 15s`, `send_timeout 30s`, `proxy_connect_timeout 5s`, `proxy_send_timeout 30s`, `proxy_read_timeout 30s`. Các mức này rộng rãi hơn nhiều so với payload thực tế của API đăng nhập/đặt vé/thanh toán (chỉ vài KB), nên không gây lỗi nghiệp vụ.
- Lỗi upstream `502/503/504` được Nginx chặn và thay bằng thông báo ngắn, giữ nguyên mã trạng thái, không lộ đường dẫn hay chi tiết cấu hình nội bộ.
- `server_tokens off` để header `Server` không lộ phiên bản Nginx.

### 9.2. HTTPS tự ký cho demo

HTTPS là **tùy chọn**. Trạng thái mặc định của repository chỉ chạy HTTP và Nginx **luôn khởi động được** ngay cả khi chưa có chứng chỉ, vì file cấu hình HTTPS chỉ là bản mẫu `nginx/conf.d/default-ssl.conf.example` (Nginx chỉ nạp file `*.conf`, không nạp file `.example`).

**Bước 1 — Tạo chứng chỉ tự ký cho `localhost`.**

Cách A — dùng Docker, không cần cài OpenSSL trên máy:

```bash
# Bash / Git Bash / macOS / Linux
docker run --rm -v "$PWD/nginx/certs:/certs" alpine/openssl req -x509 -nodes \
  -newkey rsa:2048 -days 365 \
  -keyout /certs/localhost.key -out /certs/localhost.crt \
  -subj "/C=VN/O=TKPM Demo/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

```powershell
# Windows PowerShell
docker run --rm -v "${PWD}/nginx/certs:/certs" alpine/openssl req -x509 -nodes `
  -newkey rsa:2048 -days 365 `
  -keyout /certs/localhost.key -out /certs/localhost.crt `
  -subj "/C=VN/O=TKPM Demo/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Cách B — dùng OpenSSL có sẵn trên máy (cần OpenSSL ≥ 1.1.1 để hỗ trợ `-addext`):

```bash
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout nginx/certs/localhost.key -out nginx/certs/localhost.crt \
  -subj "/C=VN/O=TKPM Demo/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Kết quả: `nginx/certs/localhost.crt` và `nginx/certs/localhost.key`. Thư mục này đã được mount read-only vào container Nginx tại `/etc/nginx/certs`.

> **Không bao giờ commit private key.** Toàn bộ nội dung `nginx/certs/` (trừ `.gitkeep`) đã bị `.gitignore` loại trừ.

**Bước 2 — Bật cấu hình HTTPS** (chỉ làm sau khi chứng chỉ đã tồn tại):

```bash
cp nginx/conf.d/default-ssl.conf.example nginx/conf.d/default-ssl.conf
```

```powershell
Copy-Item nginx\conf.d\default-ssl.conf.example nginx\conf.d\default-ssl.conf
```

**Bước 3 — Khởi động lại dịch vụ:**

```bash
docker compose restart nginx      # nếu hệ thống đang chạy
docker compose up -d              # nếu chưa chạy
```

**Bước 4 — Kiểm tra:**

```bash
curl -k -I https://localhost/     # -k vì chứng chỉ tự ký
```

**Tắt HTTPS trở lại:**

```bash
rm nginx/conf.d/default-ssl.conf   # Windows: Remove-Item nginx\conf.d\default-ssl.conf
docker compose restart nginx
```

**Cảnh báo của trình duyệt — đây là hiện tượng bình thường, không phải lỗi cấu hình.**

Vì chứng chỉ tự ký không được một tổ chức phát hành chứng chỉ (CA) công khai xác nhận, trình duyệt sẽ hiển thị cảnh báo như *"Your connection is not private"* / *"Not secure"* / `NET::ERR_CERT_AUTHORITY_INVALID`. Để tiếp tục demo, chọn **Advanced → Proceed to localhost (unsafe)**. Cảnh báo này chỉ nói rằng trình duyệt không xác minh được danh tính máy chủ; với demo cục bộ `localhost` thì kết nối vẫn được mã hóa. **Không dùng chứng chỉ này cho bất kỳ môi trường thật nào.**

Nếu đã bật HTTPS rồi tắt, trình duyệt có thể còn ghi nhớ HSTS và tự chuyển sang `https://localhost`. Xóa ghi nhớ đó tại `chrome://net-internals/#hsts` (mục *Delete domain security policies*) rồi tải lại.

### 9.3. Metrics ứng dụng và Prometheus (Task 11)

- **Endpoint Metrics của App:** `http://localhost/metrics` (phục vụ qua Nginx) hoặc nội bộ `http://app:3000/metrics`.
- **Giao diện quản trị Prometheus:** `http://localhost:9090`
- **Trang kiểm tra Scrape Targets:** `http://localhost:9090/targets` (cả 2 target `movie-app` và `prometheus` đều có trạng thái `UP`).

**Các metrics nghiệp vụ và hạ tầng chính:**
- `http_requests_total`: Tổng số lượt gọi HTTP request phân theo `[method, route, status_code]`.
- `http_request_duration_seconds`: Histogram thời gian phản hồi với các bucket từ 5ms đến 10s.
- `http_request_errors_total`: Đếm lỗi HTTP 4xx và 5xx theo `[method, route, status_code, error_type]`.
- `movie_ticket_bookings_total`: Đếm số lượt tạo đơn vé theo `[status]` (`pending`, `conflict`, `bad_request`, `error`).
- `movie_ticket_payments_total`: Đếm số lượt thanh toán theo `[method, status]` (`status`: `success`, `failed`, `error`).
- Metrics Node.js runtime mặc định: CPU usage (`nodejs_process_cpu_user_seconds_total`), RAM/Heap (`nodejs_process_resident_memory_bytes`, `nodejs_process_heap_bytes`), Event loop lag (`nodejs_eventloop_lag_seconds`), v.v.

**Một số câu truy vấn PromQL hữu ích:**

```promql
# Tần suất request mỗi giây (RPS) trên toàn hệ thống
sum(rate(http_requests_total[1m]))

# Tần suất request theo từng route (đã chuẩn hóa template, không lộ ID)
sum by (route) (rate(http_requests_total[1m]))

# Tỉ lệ lỗi 4xx/5xx trên toàn hệ thống
sum(rate(http_request_errors_total[1m]))

# Thời gian phản hồi phân vị 95 (P95 latency)
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

# Tổng số đơn đặt vé đang chờ thanh toán
movie_ticket_bookings_total{status="pending"}

# Tỉ lệ thanh toán thành công vs thất bại
sum by (status) (movie_ticket_payments_total)
```

### 9.4. Dashboard giám sát Grafana (Task 12)

- **Địa chỉ truy cập:** `http://localhost:3001`
- **Tài khoản đăng nhập:** Thiết lập trong file `.env` (mặc định: `admin` / cấu hình qua `GRAFANA_ADMIN_PASSWORD`).
- **Dashboard tự động (Provisioned):** Vào menu **Dashboards → TKPM Cinema → TKPM Cinema — Giám Sát Toàn Diện** (hoặc truy cập trực tiếp `http://localhost:3001/d/tkpm-cinema-overview`).
- **Nội dung hiển thị trên Dashboard:**
  1. **Thẻ chỉ số tổng quan (KPI):** Uptime hệ thống, tổng lượt gọi HTTP, tỉ lệ lỗi HTTP (%), P95 Latency, đơn vé chờ thanh toán, thanh toán thành công, trạng thái MySQL (UP/DOWN), số kết nối đang hoạt động.
  2. **Ứng dụng & Nghiệp vụ (Express):** Lưu lượng request theo từng route (RPS), tần suất lỗi 4xx/5xx, thời gian phản hồi theo percentiles (P50/P90/P95/P99), số vé đặt theo trạng thái, số giao dịch theo phương thức và trạng thái.
  3. **Tài nguyên Container (cAdvisor):** Mức dùng CPU (%), RAM (bytes), lưu lượng mạng (RX/TX bytes/sec) của từng container (`tkpm_app`, `tkpm_db`, `tkpm_nginx`, `tkpm_prometheus`, `tkpm_cadvisor`, `tkpm_mysqld_exporter`, `tkpm_grafana`).
  4. **Cơ sở dữ liệu MySQL (mysqld-exporter):** Tần suất truy vấn mỗi giây (QPS), số kết nối khách (threads & max used), băng thông mạng MySQL.

## 10. Lưu ý bảo mật

- `.env`, private key và chứng chỉ riêng **không** được commit — toàn bộ `nginx/certs/` (trừ `.gitkeep`) và `nginx/conf.d/default-ssl.conf` đã bị `.gitignore` loại trừ.
- Chỉ commit **bản mẫu** `nginx/conf.d/default-ssl.conf.example` (không chứa secret); private key do người dùng tự tạo cục bộ.
- HSTS chỉ bật trên server block HTTPS; không bật trên HTTP. HSTS không dùng `includeSubDomains`/`preload` cho môi trường demo.
- Dùng tài khoản MySQL riêng cho ứng dụng, không dùng `root` để kết nối từ app.
- Truy vấn SQL phải tham số hóa; mật khẩu chỉ lưu dạng hash.
- Chỉ Nginx được public khi triển khai thật; MySQL và các exporter chỉ nằm trên mạng nội bộ.
- Không trả stack trace hoặc thông tin nhạy cảm cho người dùng cuối.
- Ưu tiên image phiên bản cố định thay vì `latest`.

## 11. Dừng hệ thống

```bash
docker compose down          # dừng container
docker compose down -v       # dừng và xóa volume dữ liệu (mất dữ liệu DB)
```

Khi chạy bằng `npm start` thì dừng bằng `Ctrl+C`.
