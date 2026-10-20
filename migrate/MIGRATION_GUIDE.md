# Hướng dẫn chuyển hệ thống từ Windows (Docker Desktop) sang Ubuntu Server

Tài liệu này hướng dẫn di chuyển **toàn bộ** stack `TKPM Cinema` (10 service,
kèm dữ liệu MySQL + Grafana + Prometheus + Loki) từ máy Windows chạy Docker
Desktop sang một máy Ubuntu chạy Docker Engine. Mục tiêu cuối: hệ thống chạy
nguyên vẹn trên Ubuntu, truy cập qua mạng nội bộ/LAN bằng HTTP (như hiện tại).

> **Tóm tắt nguyên tắc:** cấu hình `docker-compose.yml` và các file config
> gần như **không cần sửa** khi chuyển nền tảng. Điểm khác duy nhất ở tầng host
> là cách cài Docker (Engine thay vì Desktop). Việc còn lại là **backup dữ liệu**
> trên Windows rồi **restore** trên Ubuntu.

---

## 0. Chuẩn bị & so sánh môi trường

| Hạng mục | Windows (hiện tại) | Ubuntu (đích) |
|---|---|---|
| Docker runtime | Docker Desktop (Linux VM bên trong) | Docker Engine (native) |
| Docker Compose | `docker compose` v2 (đi kèm Desktop) | `docker compose` v2 (plugin `docker-compose-plugin`) |
| cAdvisor mount `/`, `/sys`, `/var/lib/docker`… | đo **máy ảo Linux** của Desktop | đo **host Ubuntu thật** (chính xác hơn) |
| Promtail thu log | qua Docker API (`docker.sock`) | qua Docker API (giữ nguyên, tương thích hoàn toàn) |
| Kết quả cấu hình dự án | không sửa | không sửa |

**Cần chuẩn bị trên 2 máy:**
- Máy Windows: Docker Desktop, PowerShell 5+, kết nối mạng.
- Máy Ubuntu: Ubuntu 20.04/22.04/24.04, quyền `sudo`, SSH (khuyến nghị) hoặc truy
  cập trực tiếp, `git`/`curl` để kéo project.

---

## 1. Bước 1 — Backup dữ liệu trên Windows

1. Mở **Docker Desktop**, chờ trạng thái **Engine running**.
2. Mở PowerShell, vào thư mục gốc dự án (nơi chứa `docker-compose.yml`):

   ```powershell
   cd D:\TKPM
   .\migrate\backup-windows.ps1
   ```

3. Script sẽ tự động: khởi động stack → chờ MySQL healthy → **mysqldump**
   database `movie_ticket` → đóng gói (tar.gz) các named volume
   `grafana_data`, `prometheus_data`, `loki_data`, `promtail_positions`.

4. Kết quả nằm trong `migrate\backup\`:

   ```text
   migrate/backup/
   ├── db-dump.sql                    # toàn bộ database movie_ticket
   ├── grafana_data.tar.gz            # trạng thái + dashboard/datasource đã lưu
   ├── prometheus_data.tar.gz         # dữ liệu time-series metrics
   ├── loki_data.tar.gz               # log tập trung (retention 7 ngày)
   └── promtail_positions.tar.gz      # vị trí đã đọc log (tránh đọc lại)
   ```

> **Ghi chú:** `prometheus_data`, `loki_data`, `promtail_positions` là dữ liệu
> giám sát/log có vòng đời ngắn (retention). Nếu muốn cài mới gọn hơn, có thể bỏ
> qua 3 file này — hệ thống vẫn chạy đủ, chỉ mất lịch sử metrics/log cũ.

---

## 2. Bước 2 — Chuyển project sang Ubuntu

Cách A — dùng Git (khuyến nghị):

```bash
# trên Ubuntu, clone repo của bạn (thay <repo-url>)
git clone <repo-url> ~/TKPM
cd ~/TKPM
```

Cách B — copy trực tiếp qua `scp`/`rsync` từ Windows:

```powershell
# trên Windows (chạy từ D:\TKPM)
scp -r .\ user@<IP-UBUNTU>:~/TKPM/
```

> `.env` và các file trong `migrate/backup/` không nằm trong Git (đã bị
> `.gitignore`). Nếu dùng Git, **nhớ copy riêng** chúng:

```bash
# từ Windows: copy .env + thư mục backup sang Ubuntu
scp .\.env user@<IP-UBUNTU>:~/TKPM/.env
scp -r .\migrate\backup\ user@<IP-UBUNTU>:~/TKPM/migrate/backup/
```

---

## 3. Bước 3 — Cài Docker Engine trên Ubuntu

```bash
cd ~/TKPM
sudo bash migrate/setup-ubuntu.sh
```

Script tự nhận diện phiên bản Ubuntu (focal/jammy/noble), thêm Docker APT repo,
cài `docker-ce` + `docker-compose-plugin`, bật dịch vụ và thêm user hiện tại vào
group `docker`.

Sau khi script báo xong, **đăng xuất/đăng nhập lại** (hoặc chạy `newgrp docker`)
để dùng `docker` không cần `sudo`.

Kiểm tra:

```bash
docker --version
docker compose version
```

---

## 4. Bước 4 — Restore dữ liệu & khởi động stack

Đảm bảo thư mục `migrate/backup/` đã có đủ file (xem Bước 2), rồi chạy:

```bash
cd ~/TKPM
# nếu chưa đăng nhập lại sau khi thêm group docker thì dùng sudo
bash migrate/restore-ubuntu.sh
```

Script sẽ: khởi động MySQL → chờ healthy → restore `db-dump.sql` → tạo các
named volume → extract các `*.tar.gz` → `docker compose up -d` toàn bộ stack.

---

## 5. Bước 5 — Kiểm tra toàn diện

```bash
bash migrate/verify.sh            # kiểm tra qua localhost
bash migrate/verify.sh <IP-UBUNTU> # kiểm tra qua mạng LAN
```

Các mục được kiểm tra: healthcheck, API danh sách phim, Prometheus UI, Grafana
UI, phpMyAdmin và số lượng scrape target `UP` của Prometheus.

---

## 6. Danh sách URL truy cập (mạng nội bộ)

Thay `<IP-UBUNTU>` bằng địa chỉ IP thực của máy Ubuntu (xem bằng `ip a` hoặc
`hostname -I`). Các cổng có thể đổi bằng biến `TKPM_*_PORT` trong `.env` nếu máy
đã có dịch vụ khác sử dụng cổng mặc định. Ví dụ VM dùng web `8082`, phpMyAdmin
`8083`, Prometheus `9091` và Grafana `3001`:

```dotenv
TKPM_WEB_PORT=8082
TKPM_HTTPS_PORT=8444
TKPM_PMA_PORT=8083
TKPM_PROMETHEUS_PORT=9091
TKPM_GRAFANA_PORT=3001
```

| Dịch vụ | URL |
|---|---|
| Website (qua Nginx) | `http://<IP-UBUNTU>:8082/` (mặc định: cổng 80) |
| phpMyAdmin | `http://<IP-UBUNTU>:8083/` (mặc định: cổng 8080) |
| Prometheus | `http://<IP-UBUNTU>:9091/` (mặc định: cổng 9090) |
| Grafana | `http://<IP-UBUNTU>:3001/` |
| Grafana dashboard | `http://<IP-UBUNTU>:3001/d/tkpm-cinema-overview` |
| Grafana Explore (log) | `http://<IP-UBUNTU>:3001/explore` |

Tài khoản (giữ nguyên từ môi trường cũ): Grafana `admin` / `admin`;
phpMyAdmin `root` / `root`; tài khoản demo xem trong
`DANH_SACH_LINK_TRUY_CAP.txt`.

---

## 7. Lưu ý sau khi chuyển (firewall & cấu hình host)

Nếu Ubuntu có tường lửa `ufw`, kiểm tra quy tắc hiện có trước. Chỉ khi UFW đang
hoạt động, cho phép các cổng đã cấu hình ở trên cho mạng LAN:

```bash
sudo ufw allow OpenSSH
# Website + tool giám sát (chỉ mở trong mạng nội bộ, không mở ra Internet)
sudo ufw allow 8082/tcp
sudo ufw allow 8083/tcp
sudo ufw allow 9091/tcp
sudo ufw allow 3001/tcp
sudo ufw status
```

> Không cần mở cổng 3000 (app), 3306 (MySQL), 3100 (Loki), 9104 (mysqld-exporter)
> hay 8080 (cAdvisor) ra ngoài — các service này chỉ nằm trên mạng nội bộ
> `tkpm_network` đúng nguyên tắc "chỉ Nginx là điểm truy cập công khai".

**Về `server_name` trong Nginx:** file `nginx/conf.d/default.conf` đang để
`server_name localhost;`. Vì chỉ có một `server` block, Nginx vẫn phục vụ tốt khi
truy cập bằng IP (Nginx dùng block đầu tiên làm server mặc định). Bạn có thể đổi
thành `server_name _;` cho rõ nghĩa nếu muốn, nhưng **không bắt buộc**.

---

## 8. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `docker: permission denied` | chưa đăng nhập lại sau khi thêm group `docker`. Chạy `newgrp docker` hoặc đăng xuất/đăng nhập lại. |
| MySQL không healthy | xem log: `docker compose logs db`. Thường do cổng 3306 bị chiếm hoặc volume cũ lỗi. |
| `db-dump.sql` thiếu | bạn dùng Git mà chưa copy file backup sang (xem Bước 2). Copy lại rồi chạy lại restore. |
| Prometheus targets thiếu cAdvisor | trên Ubuntu, cAdvisor cần Docker hoạt động bình thường và `--pid=host` không bắt buộc; kiểm tra `docker compose logs cadvisor`. |
| Truy cập bằng IP bị "connection refused" | kiểm tra firewall (`ufw`) và IP thật bằng `hostname -I`. |
| Grafana không nạp dashboard | dashboard đã provisioning sẵn; kiểm tra `docker compose logs grafana`. |

---

## 9. Các file hỗ trợ trong `migrate/`

| File | Môi trường chạy | Chức năng |
|---|---|---|
| `backup-windows.ps1` | Windows (PowerShell) | Backup DB + volume → `backup/` |
| `setup-ubuntu.sh` | Ubuntu (sudo) | Cài Docker Engine + compose plugin |
| `restore-ubuntu.sh` | Ubuntu | Restore data + khởi động stack |
| `verify.sh` | Ubuntu | Kiểm tra toàn diện hệ thống |
| `backup/` | — | Chứa kết quả backup (không commit, đã bị `.gitignore`) |
