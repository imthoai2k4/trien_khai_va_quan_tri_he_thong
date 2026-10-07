# Kế hoạch xây dựng hệ thống đặt vé xem phim

> **Mục tiêu:** Xây dựng website đặt vé xem phim có chức năng quản lý phim, suất chiếu, chọn ghế và thanh toán giả lập; triển khai bằng Docker Compose, MySQL + phpMyAdmin, Nginx reverse proxy, Prometheus + Grafana và Loki + Promtail. Toàn bộ mã nguồn và cấu hình được quản lý trên GitHub.

## 1. Phạm vi hệ thống

### 1.1. Chức năng người dùng

- Xem danh sách và thông tin chi tiết phim.
- Xem lịch chiếu theo phim, ngày, rạp hoặc phòng chiếu.
- Chọn suất chiếu.
- Xem sơ đồ ghế với các trạng thái: trống, đang chọn và đã đặt.
- Đặt một hoặc nhiều ghế.
- Thanh toán giả lập với hai trạng thái thành công hoặc thất bại.
- Nhận thông tin mã đặt vé sau khi thanh toán thành công.

### 1.2. Chức năng quản trị cơ bản

- Quản lý phim.
- Quản lý phòng chiếu, ghế và suất chiếu.
- Xem danh sách đơn đặt vé và trạng thái thanh toán.

### 1.3. Phi chức năng

- Ứng dụng chạy độc lập bằng Docker Compose.
- Dữ liệu được lưu trong MySQL và quản trị qua phpMyAdmin.
- Nginx là điểm truy cập công khai duy nhất cho website.
- Có HTTPS tự ký hoặc tối thiểu các security headers cơ bản.
- Có giám sát ứng dụng, container, web server và database.
- Có thu thập log tập trung, truy vấn được bằng LogQL trên Grafana.
- Không commit mật khẩu, secret hoặc private key thật lên GitHub.

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ đề xuất | Vai trò |
|---|---|---|
| Web application | Node.js + Express | Backend, API và giao diện web |
| Cơ sở dữ liệu | MySQL 8 | Lưu phim, suất chiếu, ghế, đơn vé và thanh toán |
| Quản trị CSDL | phpMyAdmin | Quản lý và kiểm tra dữ liệu MySQL |
| Reverse proxy | Nginx | Chuyển tiếp request, HTTPS và security headers |
| Đóng gói/triển khai | Docker + Docker Compose | Chạy toàn bộ dịch vụ nhất quán |
| Metrics ứng dụng | prom-client | Expose endpoint `/metrics` cho Express |
| Metrics tập trung | Prometheus | Thu thập và lưu metrics |
| Quan sát dashboard | Grafana | Hiển thị dashboard metrics và logs |
| Metrics container | cAdvisor | CPU, RAM, network, filesystem của container |
| Metrics MySQL | mysqld-exporter | Connections, queries, uptime và trạng thái MySQL |
| Logging tập trung | Loki + Promtail | Thu thập, lưu và truy vấn log container |
| Quản lý mã nguồn | GitHub | Repository, lịch sử commit và README |

## 3. Kiến trúc tổng quan

```text
                         ┌──────────────────┐
                         │    Người dùng     │
                         └────────┬─────────┘
                                  │ HTTP/HTTPS
                         ┌────────▼─────────┐
                         │      Nginx       │
                         │ Reverse Proxy    │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │   Express App    │
                         │ Website + API    │
                         └──────┬─────┬─────┘
                                │     │ /metrics
                                │     └──────────────┐
                         ┌──────▼─────┐               │
                         │   MySQL    │               │
                         └────────────┘               │
                                                       │
   Docker containers ──► Promtail ──► Loki ──► Grafana│
   cAdvisor ─────────────────────────► Prometheus ────┤
   MySQL Exporter ───────────────────► Prometheus ────┘
```

## 4. Thiết kế dữ liệu dự kiến

| Bảng | Mục đích | Trường chính gợi ý |
|---|---|---|
| `users` | Người dùng và quản trị viên | `id`, `name`, `email`, `password_hash`, `role` |
| `movies` | Thông tin phim | `id`, `title`, `description`, `duration`, `poster_url`, `status` |
| `cinemas` | Rạp chiếu | `id`, `name`, `address` |
| `rooms` | Phòng chiếu | `id`, `cinema_id`, `name`, `capacity` |
| `seats` | Ghế trong phòng | `id`, `room_id`, `seat_row`, `seat_number`, `seat_type` |
| `showtimes` | Suất chiếu | `id`, `movie_id`, `room_id`, `start_time`, `price` |
| `bookings` | Đơn đặt vé | `id`, `user_id`, `showtime_id`, `booking_code`, `total_amount`, `status` |
| `booking_seats` | Ghế thuộc đơn đặt | `id`, `booking_id`, `seat_id`, `price` |
| `payments` | Thanh toán giả lập | `id`, `booking_id`, `method`, `amount`, `status`, `paid_at` |

### Quy tắc dữ liệu quan trọng

- Một ghế chỉ được bán một lần trong cùng một suất chiếu.
- Cần tạo unique constraint cho cặp `showtime_id` và `seat_id` ở dữ liệu đặt ghế, hoặc kiểm tra transaction trước khi tạo booking.
- Khi thanh toán thất bại, đơn hàng không được xác nhận là vé thành công.
- Mật khẩu chỉ lưu ở dạng hash; không lưu mật khẩu plaintext.

## 5. Cấu trúc repository

Tên repository đề xuất: `MSSV-movie-ticket`, trong đó thay `MSSV` bằng mã số sinh viên.

```text
MSSV-movie-ticket/
├── app/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── views/ hoặc public/
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
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md
```

## 6. Kế hoạch triển khai

### Giai đoạn 0 — Chuẩn bị

1. Tạo tài khoản GitHub theo quy định môn học, ưu tiên dùng tên hoặc mã số sinh viên.
2. Tạo repository với tên theo mã số sinh viên.
3. Cài đặt Git, Docker Desktop và Docker Compose.
4. Khởi tạo branch `main` và README ban đầu.
5. Tạo file `.env.example`; đưa tất cả biến nhạy cảm vào `.env` và thêm `.env` vào `.gitignore`.

Biến môi trường dự kiến:

```env
MYSQL_DATABASE=movie_ticket
MYSQL_USER=movie_app
MYSQL_PASSWORD=change_me
MYSQL_ROOT_PASSWORD=change_me_root
APP_PORT=3000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change_me
```

### Giai đoạn 1 — Ứng dụng đặt vé, MySQL, phpMyAdmin và Nginx

1. Khởi tạo Express application.
2. Xây dựng các trang/chức năng: danh sách phim, chi tiết phim, suất chiếu, chọn ghế, xác nhận đặt vé và thanh toán giả lập.
3. Tạo schema MySQL cùng dữ liệu mẫu để có thể demo ngay sau khi khởi động.
4. Kết nối Express với MySQL bằng biến môi trường.
5. Viết Dockerfile cho ứng dụng và `docker-compose.yml` cho các dịch vụ:
   - `app`
   - `mysql`
   - `phpmyadmin`
   - `nginx`
6. Cấu hình Nginx reverse proxy từ cổng `80`/`443` đến container `app:3000`.
7. Thiết lập HTTPS bằng chứng chỉ tự ký hoặc cấu hình security headers nếu chưa dùng HTTPS.
8. Chỉ expose Nginx ra ngoài khi triển khai thực tế; không public cổng MySQL.
9. Kiểm tra trọn vẹn luồng: chọn phim → chọn suất → chọn ghế → thanh toán thành công → dữ liệu xuất hiện trên phpMyAdmin.

Security headers đề xuất cho Nginx:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-XSS-Protection "0" always;
add_header Content-Security-Policy "default-src 'self';" always;
```

Nếu dùng HTTPS, bổ sung:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**Commit 1 bắt buộc:**

```text
feat: deploy movie ticket app with mysql and nginx reverse proxy
```

Nội dung commit gồm website, MySQL, phpMyAdmin, Docker Compose, Nginx, hardening cơ bản và README hướng dẫn chạy.

### Giai đoạn 2 — Prometheus và Grafana

1. Cài `prom-client` trong Express và cung cấp endpoint `GET /metrics`.
2. Ghi nhận các metric tối thiểu:
   - Tổng số HTTP request.
   - Thời gian phản hồi HTTP.
   - Tổng số lỗi HTTP 4xx/5xx.
   - Tổng số lượt tạo booking.
   - Tổng số thanh toán thành công/thất bại.
3. Bổ sung container `prometheus` và khai báo scrape targets.
4. Bổ sung `cadvisor` để giám sát mức dùng CPU/RAM/network của các container.
5. Bổ sung `mysqld-exporter` để theo dõi MySQL.
6. Bổ sung `grafana`, thêm Prometheus làm datasource.
7. Tạo hoặc import dashboard cho:
   - Tình trạng và tài nguyên container.
   - Lưu lượng request, latency và error rate của Express/Nginx.
   - Connections, queries, uptime và trạng thái MySQL.
8. Xác minh tất cả targets trong Prometheus có trạng thái `UP`.

Scrape targets tối thiểu:

```yaml
scrape_configs:
  - job_name: movie-app
  - job_name: cadvisor
  - job_name: mysql-exporter
  - job_name: prometheus
```

**Commit 2 bắt buộc:**

```text
feat: add prometheus grafana and database monitoring
```

### Giai đoạn 3 — Loki, Promtail và LogQL

1. Thêm container `loki` để lưu log tập trung.
2. Thêm container `promtail` để đọc log Docker và gửi đến Loki.
3. Gán nhãn log rõ ràng, ví dụ:
   - `service="movie-app"`
   - `service="nginx"`
   - `service="mysql"`
   - `environment="production"` hoặc `environment="development"`
4. Cấu hình Grafana sử dụng Loki datasource.
5. Ghi log dạng JSON hoặc có cấu trúc cho các sự kiện: truy cập API, tạo booking, thanh toán, lỗi database và lỗi server.
6. Kiểm tra log xuất hiện trong Grafana Explore.
7. Lưu ít nhất ba truy vấn LogQL để minh chứng.

Ví dụ LogQL cần có:

```logql
{service="movie-app"}
```

Xem toàn bộ log của ứng dụng.

```logql
{service="movie-app"} |= "booking"
```

Tìm các log liên quan đến đặt vé.

```logql
{service="nginx"} |~ " 4[0-9]{2} | 5[0-9]{2} "
```

Tìm các request lỗi HTTP 4xx và 5xx từ Nginx.

**Commit 3 bắt buộc:**

```text
feat: add centralized logging with loki and promtail
```

## 7. Hardening tối thiểu

- Không commit `.env`, chứng chỉ riêng hoặc file chứa mật khẩu.
- Dùng `.env.example` để mô tả các biến cần thiết.
- Dùng tài khoản MySQL riêng cho ứng dụng, không dùng `root` cho kết nối từ app.
- Đặt mật khẩu đủ mạnh cho MySQL, phpMyAdmin và Grafana.
- Chỉ public Nginx; hạn chế hoặc không expose MySQL, Prometheus, Loki và exporter ra Internet.
- Cấu hình Nginx security headers.
- Hạn chế quyền ghi của container khi khả thi, chạy ứng dụng bằng non-root user.
- Kiểm tra và validate dữ liệu đầu vào, đặc biệt dữ liệu ghế, suất chiếu và thanh toán.
- Dùng parameterized query/ORM để chống SQL Injection.
- Không trả về stack trace hoặc thông tin nhạy cảm cho người dùng cuối.
- Thường xuyên dùng image phiên bản cụ thể thay vì `latest` khi triển khai chính thức.

## 8. Kiểm thử và nghiệm thu

### 8.1. Kiểm thử chức năng

- [ ] Danh sách phim hiển thị dữ liệu từ MySQL.
- [ ] Người dùng xem được suất chiếu của phim.
- [ ] Ghế đã đặt không thể được chọn lại.
- [ ] Thanh toán thành công tạo booking và payment trong database.
- [ ] Thanh toán thất bại không xác nhận vé.
- [ ] phpMyAdmin truy cập được từ cấu hình được cho phép.

### 8.2. Kiểm thử hạ tầng và bảo mật

- [ ] `docker compose up -d --build` khởi động thành công.
- [ ] Website truy cập qua Nginx.
- [ ] Kiểm tra response headers bằng `curl -I` hoặc DevTools.
- [ ] MySQL không được public không cần thiết.
- [ ] `.env` không xuất hiện trong Git history.

### 8.3. Kiểm thử monitoring và logging

- [ ] Prometheus targets có trạng thái `UP`.
- [ ] Grafana xem được metric của app, container và MySQL.
- [ ] Loki nhận được log từ app và Nginx.
- [ ] Thực thi và chụp lại ít nhất 2–3 truy vấn LogQL.

## 9. Minh chứng cần chuẩn bị để nộp/báo cáo

1. Link GitHub repository có README và lịch sử commit rõ ràng.
2. Ảnh giao diện danh sách phim, chọn suất chiếu, sơ đồ ghế và thanh toán thành công.
3. Ảnh phpMyAdmin hiển thị dữ liệu booking/payment.
4. Ảnh hoặc kết quả kiểm tra HTTPS/security headers.
5. Ảnh Docker containers đang chạy.
6. Ảnh Prometheus trang Targets, thể hiện các dịch vụ `UP`.
7. Ảnh Grafana dashboard về container, web application và MySQL.
8. Ảnh Grafana Explore với tối thiểu 2–3 truy vấn LogQL.
9. Ảnh Git history thể hiện đúng ba commit mốc.

## 10. README cần có trong repository

README nên bao gồm:

1. Mô tả bài toán và các chức năng chính.
2. Sơ đồ kiến trúc hệ thống.
3. Danh sách công nghệ sử dụng.
4. Yêu cầu môi trường: Git, Docker Desktop, Docker Compose.
5. Hướng dẫn clone repository.
6. Hướng dẫn tạo file `.env` từ `.env.example`.
7. Hướng dẫn khởi chạy:

```bash
docker compose up -d --build
```

8. Danh sách URL truy cập, ví dụ:

```text
Website:    http://localhost
phpMyAdmin: http://localhost:8080
Prometheus: http://localhost:9090
Grafana:    http://localhost:3001
```

9. Tài khoản demo nếu hệ thống có đăng nhập.
10. Hướng dẫn xem metrics, dashboard và LogQL.
11. Các lưu ý bảo mật và cách dừng hệ thống.

## 11. Tiêu chí hoàn thành

Hệ thống được xem là hoàn thành khi:

- Website đặt vé chạy ổn định bằng Docker Compose.
- MySQL lưu được dữ liệu nghiệp vụ và phpMyAdmin hỗ trợ kiểm tra dữ liệu.
- Nginx reverse proxy hoạt động, có HTTPS tự ký hoặc security headers cơ bản.
- Prometheus thu thập được metrics của app, container và MySQL.
- Grafana hiển thị dashboard metrics và truy vấn được Loki logs.
- Promtail thu thập log từ các container cần thiết.
- Có ít nhất ba truy vấn LogQL minh chứng.
- GitHub có README rõ ràng và ba commit đúng các giai đoạn yêu cầu.
