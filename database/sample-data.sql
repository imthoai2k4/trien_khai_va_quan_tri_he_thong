-- =============================================================================
-- Hệ thống đặt vé xem phim — DỮ LIỆU MẪU (Task 2)
-- =============================================================================
-- Chạy SAU database/init.sql:
--   mysql -u root -p < database/init.sql
--   mysql -u root -p < database/sample-data.sql
--
-- Thứ tự INSERT tuân theo đúng chiều phụ thuộc khóa ngoại:
--   users -> movies -> cinemas -> rooms -> seats -> showtimes
--         -> bookings -> booking_seats -> payments
--
-- Đặc điểm dữ liệu mẫu:
--   * 3 người dùng (1 admin + 2 user), mật khẩu demo đã hash bằng bcrypt:
--       admin@demo.com / Admin@123
--       user@demo.com  / User@123
--       binh@demo.com  / User@123
--     (KHÔNG lưu plaintext trong DB; ghi chú này chỉ phục vụ demo.)
--   * 3 phim (1 phim coming_soon CHƯA có suất chiếu -> kiểm tra LEFT JOIN).
--   * 2 rạp, 3 phòng, 104 ghế.
--   * 5 suất chiếu trong tương lai.
--   * 4 đơn đặt vé phủ đủ 4 trạng thái: confirmed, pending, failed, cancelled.
--   * 3 payment phủ đủ 3 trạng thái: success, pending, failed.
--
-- QUY ƯỚC NGHIỆP VỤ THỂ HIỆN TRONG DỮ LIỆU MẪU:
--   Đơn failed / cancelled KHÔNG còn dòng booking_seats nào (ghế đã được giải
--   phóng). Vì UNIQUE(showtime_id, seat_id) là vô điều kiện, nếu giữ ghế của
--   đơn thất bại thì ghế đó bị khóa vĩnh viễn. Xem giải thích ở database/init.sql.
--   -> Payment thất bại của đơn #3 KHÔNG tạo ra booking confirmed.
--
-- Script này xóa các dòng có ID mẫu (1..N) trước khi chèn lại, nên chạy lại
-- được nhiều lần. Nó KHÔNG xóa dữ liệu khác ngoài các ID mẫu đó.
-- =============================================================================

USE movie_ticket;

SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- -----------------------------------------------------------------------------
-- Dọn dữ liệu mẫu cũ (thứ tự ngược chiều phụ thuộc khóa ngoại).
-- -----------------------------------------------------------------------------
DELETE FROM payments      WHERE id IN (1, 2, 3);
DELETE FROM booking_seats WHERE id IN (1, 2, 3);
DELETE FROM bookings      WHERE id IN (1, 2, 3, 4);
DELETE FROM showtimes     WHERE id IN (1, 2, 3, 4, 5);
DELETE FROM seats         WHERE id BETWEEN 1 AND 104;
DELETE FROM rooms         WHERE id IN (1, 2, 3);
DELETE FROM cinemas       WHERE id IN (1, 2);
DELETE FROM movies        WHERE id IN (1, 2, 3);
DELETE FROM users         WHERE id IN (1, 2, 3);


-- =============================================================================
-- 1. users
-- =============================================================================
INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES
  (1, 'Quản trị viên',  'admin@demo.com', '$2a$10$E/t2foMVUIMPAyQFDZSuF.X1FNf87QW/NxHdJ8Op9G3tGSQzUHDxy', 'admin', 1),
  (2, 'Nguyễn Văn An',  'user@demo.com',  '$2a$10$yV.KyzK80FY/UamkbbP4H.SSxrDTdZDBUpbCxWPXjWYI6IiT0UFy.', 'user',  1),
  (3, 'Trần Thị Bình',  'binh@demo.com',  '$2a$10$yV.KyzK80FY/UamkbbP4H.SSxrDTdZDBUpbCxWPXjWYI6IiT0UFy.', 'user',  1);


-- =============================================================================
-- 2. movies
-- =============================================================================
INSERT INTO movies (id, title, description, duration_minutes, poster_url, status, release_date) VALUES
  (1, 'Dune: Hành Tinh Cát – Phần Hai',
      'Paul Atreides hợp lực cùng người Fremen để trả thù những kẻ đã hủy diệt gia tộc mình.',
      166, 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400', 'now_showing', '2026-03-01'),
  (2, 'Lật Mặt 8: Vòng Tay Nắng',
      'Một gia đình đối mặt với biến cố và những bí mật bị chôn giấu nhiều năm.',
      130, 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400', 'now_showing', '2026-04-26'),
  (3, 'Avatar 3: Lửa và Tro Tàn',
      'Cuộc chiến mới trên Pandora giữa các bộ tộc và những kẻ xâm lược.',
      190, 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400', 'coming_soon', '2026-12-18');


-- =============================================================================
-- 3. cinemas
-- =============================================================================
INSERT INTO cinemas (id, name, address, city, phone, is_active) VALUES
  (1, 'TKPM Cinema Quận 1', '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1', 'TP. Hồ Chí Minh', '028 3822 1234', 1),
  (2, 'TKPM Cinema Quận 7', '45 Nguyễn Thị Thập, Phường Bình Thuận, Quận 7', 'TP. Hồ Chí Minh', '028 3775 5678', 1);


-- =============================================================================
-- 4. rooms  (rạp 1: 2 phòng 40 ghế | rạp 2: 1 phòng 24 ghế)
-- =============================================================================
INSERT INTO rooms (id, cinema_id, name, capacity) VALUES
  (1, 1, 'Phòng 1', 40),
  (2, 1, 'Phòng 2', 40),
  (3, 2, 'Phòng 1', 24);


-- =============================================================================
-- 5. seats  (104 ghế, ID 1..104, khớp đúng capacity của từng phòng)
--    Phòng 1 (rạp 1) — ID 1..40  : hàng A,B,C standard; hàng D,E vip
--    Phòng 2 (rạp 1) — ID 41..80 : hàng A,B,C standard; hàng D,E vip
--    Phòng 1 (rạp 2) — ID 81..104: hàng A,B,C standard; hàng D couple
-- =============================================================================
INSERT INTO seats (id, room_id, seat_row, seat_number, seat_type) VALUES
  -- --- Phòng 1 (rạp 1) ---
  (1,1,'A',1,'standard'),(2,1,'A',2,'standard'),(3,1,'A',3,'standard'),(4,1,'A',4,'standard'),
  (5,1,'A',5,'standard'),(6,1,'A',6,'standard'),(7,1,'A',7,'standard'),(8,1,'A',8,'standard'),
  (9,1,'B',1,'standard'),(10,1,'B',2,'standard'),(11,1,'B',3,'standard'),(12,1,'B',4,'standard'),
  (13,1,'B',5,'standard'),(14,1,'B',6,'standard'),(15,1,'B',7,'standard'),(16,1,'B',8,'standard'),
  (17,1,'C',1,'standard'),(18,1,'C',2,'standard'),(19,1,'C',3,'standard'),(20,1,'C',4,'standard'),
  (21,1,'C',5,'standard'),(22,1,'C',6,'standard'),(23,1,'C',7,'standard'),(24,1,'C',8,'standard'),
  (25,1,'D',1,'vip'),(26,1,'D',2,'vip'),(27,1,'D',3,'vip'),(28,1,'D',4,'vip'),
  (29,1,'D',5,'vip'),(30,1,'D',6,'vip'),(31,1,'D',7,'vip'),(32,1,'D',8,'vip'),
  (33,1,'E',1,'vip'),(34,1,'E',2,'vip'),(35,1,'E',3,'vip'),(36,1,'E',4,'vip'),
  (37,1,'E',5,'vip'),(38,1,'E',6,'vip'),(39,1,'E',7,'vip'),(40,1,'E',8,'vip'),
  -- --- Phòng 2 (rạp 1) ---
  (41,2,'A',1,'standard'),(42,2,'A',2,'standard'),(43,2,'A',3,'standard'),(44,2,'A',4,'standard'),
  (45,2,'A',5,'standard'),(46,2,'A',6,'standard'),(47,2,'A',7,'standard'),(48,2,'A',8,'standard'),
  (49,2,'B',1,'standard'),(50,2,'B',2,'standard'),(51,2,'B',3,'standard'),(52,2,'B',4,'standard'),
  (53,2,'B',5,'standard'),(54,2,'B',6,'standard'),(55,2,'B',7,'standard'),(56,2,'B',8,'standard'),
  (57,2,'C',1,'standard'),(58,2,'C',2,'standard'),(59,2,'C',3,'standard'),(60,2,'C',4,'standard'),
  (61,2,'C',5,'standard'),(62,2,'C',6,'standard'),(63,2,'C',7,'standard'),(64,2,'C',8,'standard'),
  (65,2,'D',1,'vip'),(66,2,'D',2,'vip'),(67,2,'D',3,'vip'),(68,2,'D',4,'vip'),
  (69,2,'D',5,'vip'),(70,2,'D',6,'vip'),(71,2,'D',7,'vip'),(72,2,'D',8,'vip'),
  (73,2,'E',1,'vip'),(74,2,'E',2,'vip'),(75,2,'E',3,'vip'),(76,2,'E',4,'vip'),
  (77,2,'E',5,'vip'),(78,2,'E',6,'vip'),(79,2,'E',7,'vip'),(80,2,'E',8,'vip'),
  -- --- Phòng 1 (rạp 2) ---
  (81,3,'A',1,'standard'),(82,3,'A',2,'standard'),(83,3,'A',3,'standard'),
  (84,3,'A',4,'standard'),(85,3,'A',5,'standard'),(86,3,'A',6,'standard'),
  (87,3,'B',1,'standard'),(88,3,'B',2,'standard'),(89,3,'B',3,'standard'),
  (90,3,'B',4,'standard'),(91,3,'B',5,'standard'),(92,3,'B',6,'standard'),
  (93,3,'C',1,'standard'),(94,3,'C',2,'standard'),(95,3,'C',3,'standard'),
  (96,3,'C',4,'standard'),(97,3,'C',5,'standard'),(98,3,'C',6,'standard'),
  (99,3,'D',1,'couple'),(100,3,'D',2,'couple'),(101,3,'D',3,'couple'),
  (102,3,'D',4,'couple'),(103,3,'D',5,'couple'),(104,3,'D',6,'couple');


-- =============================================================================
-- 6. showtimes
--    Phim #3 (coming_soon) cố ý KHÔNG có suất chiếu.
-- =============================================================================
INSERT INTO showtimes (id, movie_id, room_id, start_time, price) VALUES
  (1, 1, 1, '2026-10-10 19:00:00',  90000.00),
  (2, 2, 1, '2026-10-10 21:30:00',  90000.00),
  (3, 1, 2, '2026-10-11 18:00:00',  80000.00),
  (4, 2, 2, '2026-10-11 20:30:00',  80000.00),
  (5, 1, 3, '2026-10-12 20:00:00', 120000.00);


-- =============================================================================
-- 7. bookings  (phủ đủ 4 trạng thái)
--    #1 confirmed — 2 ghế suất 1 — total = 2 x 90000 = 180000
--    #2 pending   — 1 ghế suất 1 — total = 1 x 90000 =  90000
--    #3 failed    — payment thất bại, KHÔNG xác nhận đơn, ghế đã giải phóng
--    #4 cancelled — người dùng tự hủy, chưa từng phát sinh payment
-- =============================================================================
INSERT INTO bookings (id, user_id, showtime_id, booking_code, total_amount, status) VALUES
  (1, 2, 1, 'BK20261010001', 180000.00, 'confirmed'),
  (2, 3, 1, 'BK20261010002',  90000.00, 'pending'),
  (3, 2, 3, 'BK20261011003',      0.00, 'failed'),
  (4, 3, 5, 'BK20261012004',      0.00, 'cancelled');


-- =============================================================================
-- 8. booking_seats
--    Chỉ các đơn còn hiệu lực (confirmed / pending) mới giữ ghế.
--    Đơn #3 (failed) và #4 (cancelled) không có dòng nào.
-- =============================================================================
INSERT INTO booking_seats (id, booking_id, showtime_id, seat_id, price) VALUES
  (1, 1, 1, 1, 90000.00),   -- đơn #1 - ghế A1
  (2, 1, 1, 2, 90000.00),   -- đơn #1 - ghế A2
  (3, 2, 1, 3, 90000.00);   -- đơn #2 - ghế A3


-- =============================================================================
-- 9. payments
--    #1 success — tương ứng đơn #1 confirmed
--    #2 pending — tương ứng đơn #2 pending
--    #3 failed  — tương ứng đơn #3 failed (KHÔNG có booking confirmed)
--    Đơn #4 cancelled không phát sinh payment.
-- =============================================================================
INSERT INTO payments (id, booking_id, method, amount, status, transaction_ref, paid_at) VALUES
  (1, 1, 'e_wallet',      180000.00, 'success', 'TXN-20261010-0001', '2026-10-10 18:45:12'),
  (2, 2, 'credit_card',    90000.00, 'pending', NULL,                NULL),
  (3, 3, 'bank_transfer',  80000.00, 'failed',  'TXN-20261011-0003', NULL);


-- =============================================================================
-- KIỂM TRA NHANH SAU KHI IMPORT (chạy tay, không tự động)
-- =============================================================================
-- Số dòng từng bảng — kỳ vọng: 3,3,2,3,104,5,4,3,3
--   SELECT 'users' t, COUNT(*) n FROM users
--   UNION ALL SELECT 'movies',      COUNT(*) FROM movies
--   UNION ALL SELECT 'cinemas',     COUNT(*) FROM cinemas
--   UNION ALL SELECT 'rooms',       COUNT(*) FROM rooms
--   UNION ALL SELECT 'seats',       COUNT(*) FROM seats
--   UNION ALL SELECT 'showtimes',   COUNT(*) FROM showtimes
--   UNION ALL SELECT 'bookings',    COUNT(*) FROM bookings
--   UNION ALL SELECT 'booking_seats', COUNT(*) FROM booking_seats
--   UNION ALL SELECT 'payments',    COUNT(*) FROM payments;
--
-- Tổng tiền đơn phải khớp tổng tiền ghế — kỳ vọng không có dòng lệch:
--   SELECT b.id, b.total_amount, COALESCE(SUM(bs.price), 0) AS seat_total
--   FROM bookings b LEFT JOIN booking_seats bs ON bs.booking_id = b.id
--   GROUP BY b.id, b.total_amount
--   HAVING b.total_amount <> COALESCE(SUM(bs.price), 0);
--
-- Không có đơn confirmed nào thiếu payment success — kỳ vọng 0 dòng:
--   SELECT b.id FROM bookings b
--   WHERE b.status = 'confirmed'
--     AND NOT EXISTS (SELECT 1 FROM payments p
--                     WHERE p.booking_id = b.id AND p.status = 'success');
--
-- Không có payment failed nào gắn với đơn confirmed — kỳ vọng 0 dòng:
--   SELECT p.id FROM payments p
--   JOIN bookings b ON b.id = p.booking_id
--   WHERE p.status = 'failed' AND b.status = 'confirmed';
--
-- Sức chứa phòng phải khớp số ghế thực tế — kỳ vọng 0 dòng:
--   SELECT r.id, r.capacity, COUNT(s.id) AS seat_count
--   FROM rooms r LEFT JOIN seats s ON s.room_id = r.id
--   GROUP BY r.id, r.capacity HAVING r.capacity <> COUNT(s.id);
--
-- UNIQUE(showtime_id, seat_id) thực sự chặn đặt trùng ghế.
-- Câu lệnh dưới đây CỐ Ý trùng ghế A1 của suất 1 và PHẢI thất bại với
-- lỗi 1062 "Duplicate entry '1-1' for key 'booking_seats.uq_booking_seats_showtime_seat'".
-- Bỏ comment để kiểm chứng:
--   INSERT INTO booking_seats (booking_id, showtime_id, seat_id, price)
--   VALUES (2, 1, 1, 90000.00);
--
-- Các CHECK constraint phải chặn dữ liệu sai — mỗi câu dưới đây PHẢI lỗi 3819:
--   UPDATE bookings SET status = 'confirmed' WHERE id = 3;  -- confirmed mà total = 0
--   UPDATE payments SET status = 'success' WHERE id = 3;    -- success mà paid_at NULL
--   INSERT INTO seats (room_id, seat_row, seat_number) VALUES (1, 'A', 1); -- trùng ghế
-- =============================================================================
