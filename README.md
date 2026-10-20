# Hệ thống đặt vé xem phim (TKPM)

Website đặt vé xem phim: xem phim, xem suất chiếu, chọn ghế, đặt vé và thanh toán giả lập; kèm trang quản trị cơ bản cho admin. Đây là đồ án môn học, được triển khai độc lập bằng Docker Compose.

> **Trạng thái hiện tại: hoàn thành Task 13 — logging tập trung với Loki & Promtail.**
> Hệ thống chạy đầy đủ qua Docker Compose: MySQL, Express (API phim/suất chiếu/đặt vé/thanh toán giả lập/đăng nhập), giao diện tĩnh, Nginx reverse proxy đã gia cố security headers/giới hạn request/xử lý lỗi proxy, **monitoring** (Prometheus + cAdvisor + mysqld-exporter + Grafana dashboard) và **logging tập trung** (Loki + Promtail + JSON structured logging, truy vấn bằng LogQL trên Grafana Explore).
> **Chưa có** HTTPS mặc định (là tùy chọn demo — xem mục 9.5).

---

## 1. Mô tả

Hệ thống cho phép người dùng duyệt phim, chọn suất chiếu, chọn ghế trên sơ đồ phòng chiếu, tạo đơn đặt vé và thực hiện thanh toán giả lập (thành công/thất bại), sau đó nhận mã đặt vé nếu thanh toán thành công. Quản trị viên quản lý phim, rạp/phòng/ghế/suất chiếu và xem danh sách đơn đặt vé cùng trạng thái thanh toán.

Ràng buộc nghiệp vụ quan trọng: **một ghế chỉ được bán một lần trong cùng một suất chiếu**, và **thanh toán thất bại không được xác nhận vé**. Xem `docs/DECISIONS.md` để biết chi tiết kiến trúc đã chốt.

## 2. Stack công nghệ

| Thành phần | Công nghệ | Trạng thái |
|---|---|---|
| Backend | Node.js 20 + Express 4 | API phim, suất chiếu, ghế, booking, thanh toán giả lập và quản trị |
| Giao diện | HTML/CSS/JavaScript tĩnh do Express phục vụ | Luồng người dùng và trang admin |
| Cơ sở dữ liệu | MySQL 8, driver `mysql2`, SQL tham số hóa | Schema và dữ liệu demo trong `database/` |
| Xác thực | JWT (`jsonwebtoken`) + `bcryptjs`, role `user`/`admin` | Đã triển khai (Task 8) |
| Reverse proxy | Nginx | Điểm vào website, security headers và giới hạn request |
| Monitoring | Prometheus, Grafana, cAdvisor, mysqld-exporter | Metrics ứng dụng, container và MySQL |
| Logging | Loki 3.1.0 + Promtail 3.1.0 | Log JSON và truy vấn LogQL trong Grafana |
| Triển khai | Docker Compose | Toàn bộ dịch vụ được khai báo trong `docker-compose.yml` |

## 3. Cấu trúc thư mục

```text
TKPM/
├── app/
│   ├── src/
│   │   ├── controllers/        # xử lý API và nghiệp vụ
│   │   ├── routes/             # API routes
│   │   ├── services/           # database, logging và nghiệp vụ
│   │   ├── middleware/         # auth, validation, logging, lỗi
│   │   ├── public/             # giao diện người dùng và admin
│   │   └── server.js            # khởi tạo Express
│   ├── package.json
│   ├── package-lock.json
│   └── Dockerfile
├── database/                   # schema MySQL và dữ liệu demo
├── nginx/
│   └── certs/                  # chứng chỉ tự ký, không commit private key
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   └── mysql-exporter/
├── logging/                    # Task 13: log tập trung
│   ├── loki/
│   │   └── loki-config.yml     # Loki standalone, schema TSDB v13, retention 7 ngày
│   └── promtail/
│       └── promtail-config.yml # Thu thập log Docker, gắn nhãn `service`, parse JSON
├── migrate/                    # Bộ công cụ chuyển từ Windows sang Ubuntu
│   ├── MIGRATION_GUIDE.md      # hướng dẫn từng bước
│   ├── backup-windows.ps1      # backup dữ liệu trên Windows
│   ├── setup-ubuntu.sh         # cài Docker Engine trên Ubuntu
│   ├── restore-ubuntu.sh       # restore dữ liệu + khởi động stack trên Ubuntu
│   └── verify.sh               # kiểm tra toàn diện sau khi chuyển
├── docs/
│   └── DECISIONS.md            # quyết định kiến trúc đã chốt
├── docker-compose.yml          # 10 service: app, db, nginx, phpmyadmin, prometheus,
│                               # cadvisor, mysqld-exporter, grafana, loki, promtail
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
| `TKPM_WEB_PORT` | `80` | Cổng website qua Nginx |
| `TKPM_HTTPS_PORT` | `443` | Cổng HTTPS nếu bật cấu hình TLS |
| `TKPM_PMA_PORT` | `8080` | Cổng phpMyAdmin |
| `TKPM_PROMETHEUS_PORT` | `9090` | Cổng giao diện Prometheus |
| `TKPM_GRAFANA_PORT` | `3001` | Cổng Grafana |
| `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` | Xem `.env.example` | Tài khoản Grafana |

Các biến cổng và Grafana ở trên được Compose đọc từ `.env`. Cấu hình DB và JWT hiện còn dùng giá trị demo khai báo trong `docker-compose.yml`; cần chuyển chúng sang biến môi trường và thay bằng secret riêng trước khi đưa server ra mạng (xem tiêu chí hardening).

## 5. Yêu cầu môi trường

- Git
- Node.js 20 LTS trở lên và npm (chỉ cần nếu chạy app trực tiếp để phát triển)
- Docker Desktop + Docker Compose trên Windows, hoặc Docker Engine + Compose plugin trên Ubuntu Server
- Node.js 20 + npm chỉ cần nếu chạy app trực tiếp để phát triển
- Để chạy trên Ubuntu VM theo cấu hình dự án, xem [hướng dẫn chuyển và chạy trên Ubuntu](migrate/MIGRATION_GUIDE.md)

## 6. Khởi chạy toàn bộ hệ thống

Từ thư mục gốc repository:

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

Trên Windows PowerShell, dùng `Copy-Item .env.example .env` thay cho lệnh `cp`. Kiểm tra log bằng `docker compose logs -f`; dừng container bằng `docker compose stop`. Các URL và tài khoản demo được ghi trong mục 9.

## 7. Các thành phần chạy trong Compose

Compose khởi chạy 10 dịch vụ: `app`, `db`, `nginx`, `phpmyadmin`, `prometheus`, `cadvisor`, `mysqld-exporter`, `grafana`, `loki` và `promtail`. Website được truy cập qua Nginx; Loki và exporter chỉ nằm trong mạng Docker nội bộ. Cổng host có thể đổi bằng các biến `TKPM_*_PORT` trong `.env`.

## 9. Chạy trên Ubuntu Server (VMware)

### 9.1. Khởi động và dừng dự án

Mở VMware Workstation và bật VM Ubuntu. Stack trên VM được lưu tại `~/TKPM`; Docker Engine và các container được cấu hình tự khởi động. Nếu container chưa chạy sau khi VM bật, đăng nhập Ubuntu và chạy:

```bash
cd ~/TKPM
docker compose up -d
docker compose ps
```

Theo dõi log:

```bash
cd ~/TKPM
docker compose logs -f
```

Dừng các container nhưng vẫn giữ Ubuntu chạy:

```bash
cd ~/TKPM
docker compose stop
```

Chạy lại bằng `docker compose up -d`. Có thể tắt VM từ menu Shutdown của Ubuntu/VMware; sau khi bật lại Docker sẽ tự khởi động các container có chính sách restart. Nếu dịch vụ chưa lên, dùng lệnh `docker compose up -d` ở trên.

### 9.2. Địa chỉ truy cập hiện tại

IP hiện tại của VM là `192.168.213.128`. Mở các đường dẫn sau từ Windows host:

| Dịch vụ | URL hiện tại |
|---|---|
| Trang chủ TKPM Cinema | [http://192.168.213.128:8082/](http://192.168.213.128:8082/) |
| Đăng nhập / Bảng điều khiển Admin | [http://192.168.213.128:8082/admin.html](http://192.168.213.128:8082/admin.html) |
| phpMyAdmin | [http://192.168.213.128:8083/](http://192.168.213.128:8083/) |
| Prometheus | [http://192.168.213.128:9091/](http://192.168.213.128:9091/) |
| Grafana | [http://192.168.213.128:3001/](http://192.168.213.128:3001/) |
| Grafana Explore (log) | [http://192.168.213.128:3001/explore](http://192.168.213.128:3001/explore) |

Đăng nhập ứng dụng mẫu: Admin `admin@demo.com` / `Admin@123`; User `user@demo.com` / `User@123`; User `binh@demo.com` / `User@123`.

IP trên là địa chỉ VM đã kiểm tra; VMware NAT có thể cấp địa chỉ khác sau này. Nếu vậy, chạy `hostname -I` trong Ubuntu và thay `192.168.213.128` trong URL bằng IP mới. Từ Windows cần dùng IP của VM, không dùng `localhost` (vì `localhost` là chính máy đang mở trình duyệt). Các cổng host của VM hiện tại được đặt thành website `8082`, phpMyAdmin `8083`, Prometheus `9091`, Grafana `3001` để tránh xung đột với dịch vụ khác.

Loki và Promtail không có URL truy cập từ host. Loki chỉ mở cổng `3100` trong mạng nội bộ `tkpm_network` (Promtail đẩy log vào, Grafana đọc ra), Promtail không mở cổng nào. Log được xem gián tiếp qua Grafana Explore.

### 9.3. Môi trường phát triển cục bộ

Các hướng dẫn bên dưới mục này mô tả cấu hình phát triển cục bộ trên `localhost`. Chúng không phải địa chỉ của Ubuntu VM. Cổng mặc định trong `.env.example` là `80`, `8080`, `9090`, `3001`; trên VM đã triển khai các cổng được đổi như bảng trên.

### 9.4. Security headers và giới hạn request (Task 10)

Nginx đặt các header sau **trên mọi phản hồi**, kể cả phản hồi lỗi:

```text
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 0
Content-Security-Policy: default-src 'self'; ...
```

- `Strict-Transport-Security` **chỉ** được bật khi phục vụ qua HTTPS (mục 9.5). Không bao giờ bật trên kết nối HTTP.
- CSP giữ `default-src 'self'` và `script-src 'self'`; chỉ mở thêm đúng những nguồn mà giao diện đang dùng: `fonts.googleapis.com` / `fonts.gstatic.com` (Google Fonts trong `app/src/public/css/style.css`) và `images.unsplash.com` (poster phim demo). `style-src` phải cho phép `'unsafe-inline'` vì giao diện hiện dùng thuộc tính `style=` và một khối `<style>` trong `admin.html`.
- Giới hạn và timeout đang áp dụng: `client_max_body_size 1m`, `client_body_timeout 15s`, `client_header_timeout 15s`, `send_timeout 30s`, `proxy_connect_timeout 5s`, `proxy_send_timeout 30s`, `proxy_read_timeout 30s`. Các mức này rộng rãi hơn nhiều so với payload thực tế của API đăng nhập/đặt vé/thanh toán (chỉ vài KB), nên không gây lỗi nghiệp vụ.
- Lỗi upstream `502/503/504` được Nginx chặn và thay bằng thông báo ngắn, giữ nguyên mã trạng thái, không lộ đường dẫn hay chi tiết cấu hình nội bộ.
- `server_tokens off` để header `Server` không lộ phiên bản Nginx.

### 9.5. HTTPS tự ký cho demo

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

### 9.6. Metrics ứng dụng và Prometheus (Task 11)

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

### 9.7. Dashboard giám sát Grafana (Task 12)

- **Địa chỉ truy cập:** `http://localhost:3001`
- **Tài khoản đăng nhập:** Thiết lập trong file `.env` (mặc định: `admin` / cấu hình qua `GRAFANA_ADMIN_PASSWORD`).
- **Dashboard tự động (Provisioned):** Vào menu **Dashboards → TKPM Cinema → TKPM Cinema — Giám Sát Toàn Diện** (hoặc truy cập trực tiếp `http://localhost:3001/d/tkpm-cinema-overview`).
- **Nội dung hiển thị trên Dashboard:**
  1. **Thẻ chỉ số tổng quan (KPI):** Uptime hệ thống, tổng lượt gọi HTTP, tỉ lệ lỗi HTTP (%), P95 Latency, đơn vé chờ thanh toán, thanh toán thành công, trạng thái MySQL (UP/DOWN), số kết nối đang hoạt động.
  2. **Ứng dụng & Nghiệp vụ (Express):** Lưu lượng request theo từng route (RPS), tần suất lỗi 4xx/5xx, thời gian phản hồi theo percentiles (P50/P90/P95/P99), số vé đặt theo trạng thái, số giao dịch theo phương thức và trạng thái.
  3. **Tài nguyên Container (cAdvisor):** Mức dùng CPU (%), RAM (bytes), lưu lượng mạng (RX/TX bytes/sec) của từng container (`tkpm_app`, `tkpm_db`, `tkpm_nginx`, `tkpm_prometheus`, `tkpm_cadvisor`, `tkpm_mysqld_exporter`, `tkpm_grafana`).
  4. **Cơ sở dữ liệu MySQL (mysqld-exporter):** Tần suất truy vấn mỗi giây (QPS), số kết nối khách (threads & max used), băng thông mạng MySQL.

### 9.8. Log tập trung với Loki & Promtail (Task 13)

**Luồng dữ liệu:** Ứng dụng / Nginx / MySQL ghi log ra `stdout`/`stderr` → Docker giữ container log → **Promtail** thu thập qua Docker API, gắn nhãn rồi đẩy về **Loki** → xem và truy vấn bằng **Grafana Explore**.

**Xem log trên Grafana Explore:**

1. Mở `http://localhost:3001` và đăng nhập (tài khoản cấu hình trong `.env`, mặc định `admin` / `admin`).
2. Vào **Explore** (biểu tượng la bàn ở menu bên trái), hoặc mở trực tiếp `http://localhost:3001/explore`.
3. Ở ô chọn datasource phía trên bên trái, chọn **Loki**.
4. Dán truy vấn LogQL vào ô **Query** rồi bấm **Run query**. Mở một dòng log để xem đầy đủ các trường JSON.

**Nhãn (labels) do Promtail gắn cho từng stream:**

| Nhãn | Giá trị | Ý nghĩa |
|---|---|---|
| `service` | `movie-app`, `nginx`, `mysql`, `prometheus`, `grafana`, `cadvisor`, `mysqld_exporter`, `pma`, `loki`, `promtail` | Dịch vụ phát sinh log — nhãn chính để truy vấn |
| `container` | `tkpm_app`, `tkpm_nginx`, `tkpm_db`, ... | Tên container thật |
| `level` | `info`, `warn`, `error` | Chỉ có ở log JSON của ứng dụng |
| `type` | `http_request`, `booking_event`, `payment_event`, `system_error`, `system_event` | Chỉ có ở log JSON của ứng dụng |

Grafana/Loki tự bổ sung thêm `service_name` (sao chép từ `service`) và `detected_level` (mức log suy ra từ nội dung) — đây là tính năng sẵn có của Loki 3.x, không phải cấu hình của dự án.

**Ba truy vấn LogQL minh chứng (đã chạy và xác nhận trên Grafana Explore):**

| # | Mục đích | Truy vấn LogQL |
|---|----------|----------------|
| 1 | Toàn bộ log của ứng dụng đặt vé | `{service="movie-app"}` |
| 2 | Lọc lỗi hệ thống / HTTP ≥ 400 | `{service="movie-app"} \|= "error"`<br>`{service="movie-app"} \| json \| status >= 400` |
| 3 | Sự kiện nghiệp vụ đặt vé / thanh toán | `{service="movie-app"} \| json \| type="booking_event"`<br>`{service="movie-app"} \| json \| type="payment_event"` |

Một số truy vấn hữu ích khác:

```logql
# Log của Nginx (reverse proxy) và MySQL
{service="nginx"}
{service="mysql"}

# Chỉ log lỗi của ứng dụng (nhờ nhãn `level` do Promtail bóc từ JSON)
{service="movie-app", level="error"}

# Số dòng log mỗi phút theo từng dịch vụ
sum by (service) (count_over_time({service=~".+"}[1m]))

# Đếm số lần đặt vé theo trạng thái trong 1 giờ
sum by (status) (count_over_time({service="movie-app"} | json | type="booking_event" [1h]))

# Các request chậm hơn 500ms (parse JSON tại thời điểm truy vấn)
{service="movie-app"} | json | type="http_request" | duration_ms > 500
```

**Log ứng dụng có cấu trúc (JSON Lines) — ví dụ thực tế:**

```json
{"timestamp":"2026-10-10T10:07:46.972Z","level":"warn","service":"movie-app","type":"payment_event","payment_id":11,"booking_id":13,"method":"bank_transfer","amount":"180000.00","status":"failed","reason":"simulated_failure"}
{"timestamp":"2026-10-10T10:07:47.026Z","level":"warn","service":"movie-app","type":"http_request","method":"POST","path":"/api/bookings","status":409,"duration_ms":8.73,"ip":"172.18.0.1","error_type":"4xx"}
{"timestamp":"2026-10-10T10:07:34.036Z","level":"error","service":"movie-app","type":"system_error","msg":"Data truncated for column 'method' at row 1","path":"/api/payments","method":"POST","error_code":"WARN_DATA_TRUNCATED"}
```

Bốn loại log nghiệp vụ: `http_request` (mọi request), `booking_event` (đặt vé thành công/thất bại), `payment_event` (thanh toán), `system_error` (lỗi ngoại lệ/DB). Nhật ký khởi động dùng `system_event`.

**Lưu ý khi đọc log:**

- `{service="mysql"}` chỉ có dữ liệu khi MySQL thực sự ghi sự kiện (khởi động, cảnh báo, lỗi). Lúc hệ thống chạy êm, truy vấn này **rỗng là bình thường**, không phải lỗi cấu hình.
- Endpoint `/metrics` **không** được ghi log: Prometheus cào mỗi 5 giây, ghi log mỗi lần cào sẽ làm ngập Loki mà không mang thông tin nghiệp vụ.
- Log của ứng dụng **không bao giờ** chứa mật khẩu, token/cookie, secret key, số thẻ hay CVV: `app/src/services/logger.js` tự động che (`[REDACTED]`) mọi trường có tên nhạy cảm, và log request chỉ ghi pathname (đã cắt bỏ query string).
- Log cũ hơn **7 ngày** bị Loki tự động xoá (retention), volume lưu log là `loki_data`.

## 10. Lưu ý bảo mật

- `.env`, private key và chứng chỉ riêng **không** được commit — toàn bộ `nginx/certs/` (trừ `.gitkeep`) và `nginx/conf.d/default-ssl.conf` đã bị `.gitignore` loại trừ.
- Chỉ commit **bản mẫu** `nginx/conf.d/default-ssl.conf.example` (không chứa secret); private key do người dùng tự tạo cục bộ.
- HSTS chỉ bật trên server block HTTPS; không bật trên HTTP. HSTS không dùng `includeSubDomains`/`preload` cho môi trường demo.
- Dùng tài khoản MySQL riêng cho ứng dụng, không dùng `root` để kết nối từ app.
- Truy vấn SQL phải tham số hóa; mật khẩu chỉ lưu dạng hash.
- Chỉ Nginx được public khi triển khai thật; MySQL, các exporter và Loki/Promtail chỉ nằm trên mạng nội bộ.
- **Không ghi mật khẩu (plain text hoặc hash), token/cookie phiên, secret key, số thẻ hoặc CVV vào log.** Quy tắc này được thi hành ở tầng code bởi `sanitize()` trong `app/src/services/logger.js`, không chỉ ở quy ước.
- Log request chỉ ghi pathname (đã cắt query string), không ghi body/header — tránh rò rỉ tham số nhạy cảm vào Loki.
- Không trả stack trace hoặc thông tin nhạy cảm cho người dùng cuối.
- Ưu tiên image phiên bản cố định thay vì `latest`.

## 11. Dừng hệ thống

```bash
docker compose down          # dừng container
docker compose down -v       # dừng và xóa volume dữ liệu (mất dữ liệu DB)
```

Khi chạy bằng `npm start` thì dừng bằng `Ctrl+C`.
