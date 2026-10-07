# Hệ thống đặt vé xem phim (TKPM)

Website đặt vé xem phim: xem phim, xem suất chiếu, chọn ghế, đặt vé và thanh toán giả lập; kèm trang quản trị cơ bản cho admin. Đây là đồ án môn học, được triển khai độc lập bằng Docker Compose.

> **Trạng thái hiện tại: Task 1 — bộ khung repository.**
> Repo mới chỉ có cấu trúc thư mục, manifest dependency và một Express server tối thiểu để xác nhận bộ khung chạy được.
> **Chưa có** schema database, chưa có API nghiệp vụ, chưa có giao diện thật, chưa có Docker Compose đầy đủ, chưa có Nginx/monitoring/logging.

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
| Reverse proxy | Nginx (điểm truy cập công khai duy nhất) | Chưa triển khai |
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
| `nginx` | Task 9 / Task 10 | Reverse proxy, HTTPS tự ký, security headers |
| `prometheus`, `prom-client` `/metrics` | Task 11 | Metrics HTTP request, latency, lỗi 4xx/5xx, booking/payment |
| `grafana`, `cadvisor`, `mysqld-exporter` | Task 12 | Dashboard container, app, MySQL |
| `loki`, `promtail` | Task 13 | Log tập trung, truy vấn LogQL |

Lộ trình đầy đủ và ba commit mốc bắt buộc nằm trong `KE_HOACH_CHIA_TASK_CHO_AI_AGENT.md`.

## 9. URL dự kiến khi hoàn thành

```text
Website:    http://localhost
phpMyAdmin: http://localhost:8080
Prometheus: http://localhost:9090
Grafana:    http://localhost:3001
```

## 10. Lưu ý bảo mật

- `.env`, private key và chứng chỉ riêng **không** được commit — đã có trong `.gitignore`.
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
