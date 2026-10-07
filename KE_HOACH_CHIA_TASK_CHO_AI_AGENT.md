# Kế hoạch chia task cho AI coding agent

## 1. Cách dùng kế hoạch

Mỗi task bên dưới là một đơn vị giao việc riêng cho coding agent. Chỉ giao một task mỗi lần; cung cấp `PRODUCT.md`, tài liệu kế hoạch gốc và phần task tương ứng. Agent phải đọc trạng thái repository trước khi sửa, giữ thay đổi trong phạm vi task, và báo cáo file đã sửa, quyết định quan trọng, lệnh xác minh đã chạy cùng kết quả. Không tự ý làm task kế tiếp.

Để giảm lượng ngữ cảnh phải nạp lại giữa các task, giữ yêu cầu chung ở tài liệu này và trong prompt mỗi lần chỉ dẫn chiếu phần chung cùng task hiện tại; không dán lại toàn bộ kế hoạch. Giữ tên file, API, schema và quyết định đã thống nhất trong README/tài liệu kỹ thuật để task sau có thể tiếp tục mà không phải suy luận lại. Cụm “cache hit” được hiểu ở đây là chi phí/ngữ cảnh làm việc của AI agent. Không thêm cache vào ứng dụng nếu chưa có yêu cầu sản phẩm.

## 2. Quyết định phạm vi cần chốt

Hai tài liệu đang mâu thuẫn:

- `PRODUCT.md`: stack hiện chọn là static HTML/CSS.
- `KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md`: yêu cầu website có nghiệp vụ thật với Node.js/Express, MySQL, Docker Compose, Nginx, monitoring và logging.

Các chức năng đăng nhập/quản trị, giữ ghế đồng thời, lưu booking/payment, `/metrics` và các milestone Docker không thể được hoàn thành đầy đủ bằng website static thuần. Để đáp ứng kế hoạch môn học, lộ trình dưới đây lấy kiến trúc Node.js + Express + MySQL + Docker làm mục tiêu; giao diện có thể dùng HTML/CSS tĩnh được Express phục vụ. Nếu chủ đích chỉ làm prototype giao diện, dừng sau task 3 và đánh dấu backend/hạ tầng là ngoài phạm vi.

## 3. Nguyên tắc chung cho mọi task

- Không commit `.env`, mật khẩu thật, private key hoặc chứng chỉ riêng; dùng `.env.example` và `.gitignore`.
- Truy vấn SQL phải tham số hóa; mật khẩu phải được hash.
- Một ghế không được bán hai lần trong cùng suất chiếu; ràng buộc dữ liệu phải là lớp bảo vệ cuối cùng.
- Thanh toán thất bại không tạo vé đã xác nhận.
- Chỉ Nginx được public trong cấu hình triển khai; các dịch vụ nội bộ không mở cổng không cần thiết.
- Dùng phiên bản image/dependency cố định thay vì `latest` khi chọn được phiên bản tương thích.
- Mỗi task chỉ sửa phần được giao. Không refactor diện rộng, không thêm thư viện hoặc tính năng ngoài phạm vi nếu chưa nêu lý do.
- Sau mỗi task, cập nhật tài liệu vận hành nếu task làm thay đổi cách chạy hoặc cấu hình.
- Không tự tạo milestone commit nếu người vận hành chưa yêu cầu; ba thông điệp commit bắt buộc được giữ nguyên ở mục 5.

## 4. Các task phát triển

### Task 0 — Kiểm kê repository và chốt kiến trúc

**Mục tiêu:** xác định nền hiện có, ghi lại lựa chọn stack và các giả định để những task sau không phải đọc lại toàn bộ lịch sử.

**Việc cần làm:**

1. Kiểm tra cấu trúc repo, nhánh hiện tại, các file đã có và trạng thái thay đổi chưa commit.
2. Đối chiếu yêu cầu trong hai tài liệu, liệt kê điểm thống nhất/mâu thuẫn.
3. Tạo `docs/DECISIONS.md` (hoặc cập nhật tài liệu quyết định hiện có) với kiến trúc mục tiêu, phạm vi admin, lựa chọn HTTPS/header và URL cổng phục vụ demo.
4. Không sửa mã ứng dụng ở task này.

**Hoàn thành khi:** tài liệu quyết định phân biệt rõ prototype static và hệ thống đầy đủ; các giả định chưa thể xác định được ghi là câu hỏi mở, không tự bịa.

### Task 1 — Khung repository và hướng dẫn chạy

**Mục tiêu:** tạo bộ khung dự án dễ khởi chạy, chưa triển khai nghiệp vụ.

**Việc cần làm:** tạo cấu trúc `app/`, `database/`, `nginx/`, `monitoring/`, `logging/`, file `.gitignore`, `.env.example`, README ban đầu và package manifest/lockfile phù hợp. Thêm hướng dẫn cài đặt và chạy tối thiểu. Không thêm secret thật.

**Hoàn thành khi:** cấu trúc khớp quyết định tại Task 0; hướng dẫn nêu được dịch vụ dự kiến, biến môi trường và lệnh chạy; không có file secret trong danh sách file mới.

### Task 2 — Schema MySQL và dữ liệu mẫu

**Mục tiêu:** định nghĩa dữ liệu nghiệp vụ trước khi nối API.

**Việc cần làm:** tạo schema cho `users`, `movies`, `cinemas`, `rooms`, `seats`, `showtimes`, `bookings`, `booking_seats`, `payments`; thêm khóa ngoại, index và unique `(showtime_id, seat_id)` ở nơi biểu diễn ghế đã bán. Tạo dữ liệu demo nhỏ, nhất quán và có thể nạp lặp theo cách được tài liệu hóa.

**Hoàn thành khi:** luồng khóa ngoại hợp lệ; không thể tạo hai vé cho cùng ghế/suất; dữ liệu mẫu có phim, rạp, phòng, ghế và suất chiếu đủ để demo. Nêu rõ cách xử lý booking/payment thất bại và vòng đời giữ ghế trong quyết định nếu schema cần trạng thái giữ chỗ.

### Task 3 — Giao diện người dùng static

**Mục tiêu:** xây các trang nhìn thấy được bằng HTML/CSS/JS đơn giản, sử dụng dữ liệu mẫu cục bộ; chưa giả vờ lưu booking vào server.

**Việc cần làm:** trang danh sách/chi tiết phim, lựa chọn suất chiếu, sơ đồ ghế với trạng thái trống/đang chọn/đã đặt, xác nhận và màn hình kết quả thanh toán giả lập. Đảm bảo dùng được bằng bàn phím, nhãn trạng thái dễ hiểu và bố cục dùng được trên màn nhỏ.

**Hoàn thành khi:** điều hướng demo được toàn luồng ở phía giao diện; trạng thái ghế và thành công/thất bại dễ phân biệt; mọi dữ liệu giả được ghi rõ là demo. Không gọi API chưa tồn tại.

### Task 4 — Express app và kết nối MySQL

**Mục tiêu:** khởi tạo backend và khả năng đọc dữ liệu.

**Việc cần làm:** tạo server Express, cấu hình DB pool qua biến môi trường, health endpoint, xử lý lỗi cơ bản và truy vấn tham số hóa. Thêm route đọc danh sách/chi tiết phim và suất chiếu; không làm booking ở task này.

**Hoàn thành khi:** server khởi động theo hướng dẫn, health endpoint phản hồi, các route đọc trả dữ liệu từ MySQL hoặc lỗi có thông báo an toàn; không trả stack trace cho client.

### Task 5 — Nối giao diện với dữ liệu phim/suất chiếu

**Mục tiêu:** thay dữ liệu mẫu giao diện bằng API đọc.

**Việc cần làm:** Express phục vụ frontend; giao diện tải phim, chi tiết và suất chiếu từ các route của Task 4. Hiển thị trạng thái tải, rỗng và lỗi.

**Hoàn thành khi:** dữ liệu hiển thị lấy từ MySQL; không còn phụ thuộc dữ liệu mẫu cho các màn đọc; trải nghiệm lỗi rõ ràng.

### Task 6 — Trạng thái ghế và tạo booking an toàn

**Mục tiêu:** triển khai nghiệp vụ chọn ghế với bảo vệ cạnh tranh ở backend/database.

**Việc cần làm:** endpoint đọc sơ đồ ghế và trạng thái theo suất; endpoint tạo booking trong transaction; kiểm tra ghế thuộc đúng phòng/suất, còn bán được và không trùng; xử lý vi phạm unique constraint thành phản hồi có thể hiểu. Tránh tin trạng thái do client gửi.

**Hoàn thành khi:** booking nhiều ghế là nguyên tử; hai yêu cầu đồng thời không thể bán cùng ghế; trạng thái ghế cập nhật chính xác. Ghi rõ nếu sản phẩm không có bước giữ ghế tạm thời.

### Task 7 — Thanh toán giả lập và mã vé

**Mục tiêu:** hoàn thành luồng thanh toán thành công/thất bại.

**Việc cần làm:** endpoint thanh toán giả lập; lưu payment; chỉ xác nhận booking và phát booking code khi thành công; trạng thái thất bại không làm ghế trở thành vé đã bán. Thiết kế thao tác lặp an toàn để gửi lại request không tạo thanh toán/booking thành công trùng.

**Hoàn thành khi:** cả hai kết quả được lưu và phản ánh đúng ở API/UI; mã booking chỉ trả cho giao dịch thành công; quy tắc transaction và tính lặp an toàn được ghi lại.

### Task 8 — Đăng nhập và trang quản trị cơ bản

**Mục tiêu:** hỗ trợ admin quản lý dữ liệu trong phạm vi kế hoạch.

**Việc cần làm:** tạo cơ chế xác thực phù hợp với quyết định kiến trúc; hash mật khẩu; bảo vệ route quản trị theo role; CRUD phim, rạp/phòng/ghế/suất và trang xem booking/payment. Validate input và dùng truy vấn tham số hóa.

**Hoàn thành khi:** người dùng chưa đăng nhập/không phải admin không thể gọi API quản trị; CRUD không phá vỡ quan hệ dữ liệu; mật khẩu không lưu/trả dạng plaintext. Tài khoản demo phải dùng dữ liệu giả được mô tả rõ.

### Task 9 — Docker Compose cho ứng dụng và dữ liệu

**Mục tiêu:** chạy được app, MySQL, phpMyAdmin và Nginx qua Compose.

**Việc cần làm:** Dockerfile app, healthcheck/dependency phù hợp, volume dữ liệu DB, cấu hình Nginx reverse proxy và `.env.example`. Chỉ mở cổng ngoài theo quyết định Task 0; phpMyAdmin phải được giới hạn theo cấu hình demo đã tài liệu hóa.

**Hoàn thành khi:** hướng dẫn Compose tạo được hệ thống sạch; dữ liệu tồn tại qua lần restart theo volume; app chờ DB sẵn sàng; MySQL không public ngoài ý muốn.

### Task 10 — Hardening Nginx và cấu hình vận hành

**Mục tiêu:** bổ sung headers và cấu hình HTTPS/header theo phạm vi đã chốt.

**Việc cần làm:** cấu hình security headers; nếu dùng HTTPS tự ký, chỉ cung cấp quy trình tạo cert cục bộ và không commit private key. Bổ sung giới hạn request/body hợp lý và xử lý lỗi proxy.

**Hoàn thành khi:** README chỉ rõ URL và cảnh báo trình duyệt khi cert tự ký; secret/cert riêng bị loại khỏi Git; header xuất hiện trên phản hồi website.

### Task 11 — Metrics ứng dụng và Prometheus

**Mục tiêu:** thu thập metrics app và hạ tầng theo kế hoạch.

**Việc cần làm:** thêm `prom-client`, `/metrics`, số request/latency/error và counter booking/payment; cấu hình Prometheus scrape app và chính Prometheus. Không đưa dữ liệu cá nhân/nhãn có cardinality cao vào metrics.

**Hoàn thành khi:** Prometheus scrape app thành công; metrics có thể truy vấn; endpoint metrics không làm lộ dữ liệu nhạy cảm.

### Task 12 — Exporter và Grafana dashboard

**Mục tiêu:** theo dõi container, MySQL và app trên dashboard.

**Việc cần làm:** thêm cAdvisor, mysqld-exporter, Grafana datasource provisioning và dashboard thiết yếu; cố định phiên bản image; exporter chỉ nằm trên mạng nội bộ.

**Hoàn thành khi:** các target cần thiết hiển thị UP; dashboard có request/latency/error, tài nguyên container và sức khỏe MySQL; thông tin đăng nhập lấy từ environment.

### Task 13 — Loki, Promtail và truy vấn LogQL

**Mục tiêu:** tập trung log và có truy vấn minh chứng.

**Việc cần làm:** thêm Loki/Promtail, nhãn service rõ ràng, log ứng dụng có cấu trúc cho request/booking/payment/database error; cấu hình Loki datasource; tài liệu hóa ít nhất ba truy vấn LogQL.

**Hoàn thành khi:** log app và Nginx xuất hiện trong Grafana Explore; truy vấn theo service, booking và lỗi HTTP hoạt động; không ghi password/token hoặc dữ liệu thanh toán nhạy cảm.

### Task 14 — Tài liệu demo và bàn giao milestone

**Mục tiêu:** hoàn thiện hướng dẫn nghiệm thu và danh sách bằng chứng.

**Việc cần làm:** hoàn thiện README: kiến trúc, yêu cầu, cấu hình `.env`, chạy/dừng, URL, tài khoản demo giả, xem metrics/logs và troubleshooting. Thêm checklist ảnh minh chứng UI, database, Docker, Prometheus, Grafana, LogQL và Git history.

**Hoàn thành khi:** người khác có thể làm theo README trên máy sạch; checklist bao phủ các tiêu chí nghiệm thu trong kế hoạch gốc.

## 5. Milestone commit bắt buộc

Tạo commit riêng sau khi các task tương ứng đã hoàn thành và được rà soát:

1. Sau Task 10: `feat: deploy movie ticket app with mysql and nginx reverse proxy`
2. Sau Task 12: `feat: add prometheus grafana and database monitoring`
3. Sau Task 13: `feat: add centralized logging with loki and promtail`

Không gộp các milestone này thành một commit. Task 14 có thể tạo tài liệu bàn giao sau commit logging nếu cần.

## 6. Prompt khung giao từng task

```text
Đọc PRODUCT.md, KE_HOACH_HE_THONG_DAT_VE_XEM_PHIM.md và mục Task N trong
KE_HOACH_CHIA_TASK_CHO_AI_AGENT.md. Tuân thủ quyết định trong docs/DECISIONS.md
nếu file đã tồn tại. Chỉ thực hiện Task N; trước khi sửa hãy kiểm tra trạng thái
repo và thay đổi hiện có. Giữ thay đổi trong phạm vi task, không làm task kế tiếp,
không thêm tính năng ngoài yêu cầu. Không commit secret. Cập nhật tài liệu nếu
cách chạy/cấu hình thay đổi. Khi xong, báo cáo file thay đổi, quyết định cần lưu,
cách xác minh và kết quả; nêu rõ phần chưa làm hoặc giả định còn mở.
```

## 7. Checklist nghiệm thu tổng thể

- [ ] Luồng phim → suất → ghế → booking → thanh toán chạy đủ.
- [ ] Ghế đã bán không thể đặt lần hai; thất bại thanh toán không xác nhận vé.
- [ ] Admin được bảo vệ; mật khẩu hash; SQL tham số hóa.
- [ ] Compose chạy app, MySQL, phpMyAdmin, Nginx và dịch vụ quan sát.
- [ ] Chỉ điểm truy cập đã định được expose; secrets không nằm trong Git.
- [ ] Headers/HTTPS theo phạm vi được chọn.
- [ ] Prometheus targets UP; Grafana có metric app/container/MySQL.
- [ ] Loki nhận log app/Nginx; có ít nhất ba LogQL query.
- [ ] README và bằng chứng demo đáp ứng mục nghiệm thu của kế hoạch gốc.
