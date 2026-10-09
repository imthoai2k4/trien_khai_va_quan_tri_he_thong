-- =============================================================================
-- Hệ thống đặt vé xem phim — KHỞI TẠO SCHEMA (Task 2)
-- =============================================================================
-- Database : movie_ticket
-- MySQL    : 8.0+ (bắt buộc, vì có CHECK constraint thực sự được enforce)
-- Engine   : InnoDB (bắt buộc, để có foreign key + transaction)
-- Charset  : utf8mb4 / utf8mb4_unicode_ci (lưu được tiếng Việt và emoji)
--
-- Phạm vi: CHỈ database. Không API, không ORM, không business logic Node.js.
--
-- CÁCH DÙNG
--   mysql -u root -p < database/init.sql
--   mysql -u root -p < database/sample-data.sql      -- (tùy chọn) dữ liệu mẫu
--
-- CẢNH BÁO: script này DROP 9 bảng của movie_ticket trước khi tạo lại.
--           Mọi dữ liệu hiện có trong 9 bảng đó sẽ BỊ XÓA.
--
-- Thứ tự tạo bảng tuân theo chiều phụ thuộc khóa ngoại:
--   users, movies, cinemas                      (không phụ thuộc)
--   rooms        -> cinemas
--   seats        -> rooms
--   showtimes    -> movies, rooms
--   bookings     -> users, showtimes
--   booking_seats-> bookings, seats
--   payments     -> bookings
-- =============================================================================

SET NAMES utf8mb4;
-- Cố định múi giờ cho session import để created_at/updated_at hiển thị theo giờ VN.
-- Chỉ ảnh hưởng session hiện tại, không đổi cấu hình server.
SET time_zone = '+07:00';

CREATE DATABASE IF NOT EXISTS movie_ticket
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE movie_ticket;

-- -----------------------------------------------------------------------------
-- Xóa bảng theo thứ tự NGƯỢC với chiều phụ thuộc khóa ngoại.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS booking_seats;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS showtimes;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS cinemas;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS users;


-- =============================================================================
-- 1. users — người dùng và quản trị viên
-- =============================================================================
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL
                COMMENT 'Duy nhất, không phân biệt hoa/thường (collation *_ci)',
  password_hash VARCHAR(255) NOT NULL
                COMMENT 'bcrypt hash — KHÔNG bao giờ lưu plaintext',
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  is_active     TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1 = đang hoạt động, 0 = bị khóa',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  CONSTRAINT chk_users_name_not_blank  CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_users_email_format    CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_users_is_active_bool  CHECK (is_active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Người dùng và quản trị viên';


-- =============================================================================
-- 2. movies — thông tin phim
-- =============================================================================
CREATE TABLE movies (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title            VARCHAR(200) NOT NULL,
  description      TEXT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL COMMENT 'Thời lượng phim, đơn vị: phút',
  poster_url       VARCHAR(500) NULL,
  status           ENUM('coming_soon','now_showing','ended') NOT NULL DEFAULT 'coming_soon',
  release_date     DATE NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movies_status (status),
  KEY idx_movies_title (title),
  CONSTRAINT chk_movies_title_not_blank   CHECK (CHAR_LENGTH(TRIM(title)) > 0),
  CONSTRAINT chk_movies_duration_positive CHECK (duration_minutes > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Thông tin phim';


-- =============================================================================
-- 3. cinemas — rạp chiếu
-- =============================================================================
CREATE TABLE cinemas (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  address    VARCHAR(255) NOT NULL,
  city       VARCHAR(100) NULL,
  phone      VARCHAR(20)  NULL,
  is_active  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cinemas_name_address (name, address),
  KEY idx_cinemas_city (city),
  CONSTRAINT chk_cinemas_name_not_blank    CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_cinemas_address_not_blank CHECK (CHAR_LENGTH(TRIM(address)) > 0),
  CONSTRAINT chk_cinemas_is_active_bool    CHECK (is_active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Rạp chiếu';


-- =============================================================================
-- 4. rooms — phòng chiếu thuộc một rạp
-- =============================================================================
CREATE TABLE rooms (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cinema_id  INT UNSIGNED NOT NULL,
  name       VARCHAR(50) NOT NULL COMMENT 'Ví dụ: Phòng 1, Phòng IMAX',
  capacity   SMALLINT UNSIGNED NOT NULL COMMENT 'Sức chứa theo thiết kế của phòng',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Tên phòng không được trùng trong cùng một rạp.
  UNIQUE KEY uq_rooms_cinema_name (cinema_id, name),
  CONSTRAINT fk_rooms_cinema
    FOREIGN KEY (cinema_id) REFERENCES cinemas (id) ON DELETE CASCADE,
  CONSTRAINT chk_rooms_name_not_blank     CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_rooms_capacity_positive  CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Phòng chiếu';


-- =============================================================================
-- 5. seats — ghế trong phòng
-- =============================================================================
CREATE TABLE seats (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id     INT UNSIGNED NOT NULL,
  seat_row    VARCHAR(3) NOT NULL COMMENT 'Hàng ghế, ví dụ A, B, C',
  seat_number SMALLINT UNSIGNED NOT NULL COMMENT 'Số ghế trong hàng',
  seat_type   ENUM('standard','vip','couple') NOT NULL DEFAULT 'standard',
  is_active   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Một phòng không thể có 2 ghế cùng hàng + cùng số.
  UNIQUE KEY uq_seats_room_row_number (room_id, seat_row, seat_number),
  CONSTRAINT fk_seats_room
    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
  CONSTRAINT chk_seats_row_not_blank     CHECK (CHAR_LENGTH(TRIM(seat_row)) > 0),
  CONSTRAINT chk_seats_number_positive   CHECK (seat_number > 0),
  CONSTRAINT chk_seats_is_active_bool    CHECK (is_active IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ghế trong phòng chiếu';


-- =============================================================================
-- 6. showtimes — suất chiếu
--    Ghi chú: hệ thống KHÔNG dùng cơ chế giữ ghế tạm thời (temporary seat hold).
--    Phòng chiếu được coi là không đổi lịch; chỉ chặn trùng suất ở cùng
--    (room_id, start_time). Việc chồng lấn thời gian giữa các suất khác
--    start_time được kiểm tra ở tầng ứng dụng (Task 4).
-- =============================================================================
CREATE TABLE showtimes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  movie_id   INT UNSIGNED NOT NULL,
  room_id    INT UNSIGNED NOT NULL,
  start_time DATETIME NOT NULL,
  price      DECIMAL(10,2) NOT NULL COMMENT 'Giá vé cơ bản của suất chiếu, đơn vị VND',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Một phòng không thể có 2 suất chiếu bắt đầu cùng thời điểm.
  UNIQUE KEY uq_showtimes_room_start (room_id, start_time),
  KEY idx_showtimes_movie_start (movie_id, start_time),
  CONSTRAINT fk_showtimes_movie
    FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE RESTRICT,
  CONSTRAINT fk_showtimes_room
    FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE RESTRICT,
  CONSTRAINT chk_showtimes_price_non_negative CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Suất chiếu';


-- =============================================================================
-- 7. bookings — đơn đặt vé
--    Trạng thái: pending -> confirmed | failed | cancelled
--    Ghi chú: MySQL KHÔNG cho phép CHECK tham chiếu bảng khác, nên quy tắc
--    "đơn chỉ được confirmed khi có payment success" được enforce trong
--    transaction của tầng ứng dụng (Task 4). Ở tầng DB, constraint
--    chk_bookings_confirmed_amount chỉ bảo đảm đơn confirmed phải có tiền.
-- =============================================================================
CREATE TABLE bookings (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  showtime_id  INT UNSIGNED NOT NULL,
  booking_code VARCHAR(20) NOT NULL COMMENT 'Mã đơn hiển thị cho người dùng, ví dụ BK20261010001',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng tiền của đơn, đơn vị VND',
  status       ENUM('pending','confirmed','failed','cancelled') NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_booking_code (booking_code),
  -- Cặp (id, showtime_id) là đích tham chiếu của booking_seats, để bảo đảm
  -- booking_seats.showtime_id luôn khớp với showtime của đơn.
  UNIQUE KEY uq_bookings_id_showtime (id, showtime_id),
  KEY idx_bookings_user (user_id),
  KEY idx_bookings_showtime_status (showtime_id, status),
  KEY idx_bookings_status (status),
  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_showtime
    FOREIGN KEY (showtime_id) REFERENCES showtimes (id) ON DELETE RESTRICT,
  CONSTRAINT chk_bookings_code_not_blank     CHECK (CHAR_LENGTH(TRIM(booking_code)) > 0),
  CONSTRAINT chk_bookings_total_non_negative CHECK (total_amount >= 0),
  CONSTRAINT chk_bookings_confirmed_amount   CHECK (status <> 'confirmed' OR total_amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Đơn đặt vé';


-- =============================================================================
-- 8. booking_seats — ghế thuộc một đơn đặt
--
--    BẢO VỆ QUAN TRỌNG NHẤT CỦA HỆ THỐNG:
--      UNIQUE KEY uq_booking_seats_showtime_seat (showtime_id, seat_id)
--    -> Một ghế chỉ có thể được bán ĐÚNG MỘT LẦN trong một suất chiếu.
--       Đây là lớp bảo vệ cuối cùng ở tầng DB cho việc đặt trùng ghế khi có
--       nhiều request đồng thời; tầng ứng dụng bắt lỗi duplicate entry
--       (MySQL error 1062) và trả về thông báo "ghế đã được đặt".
--
--    showtime_id được lưu kèm (dư thừa có kiểm soát) vì UNIQUE ở trên cần nó.
--    Cột này KHÔNG thể lệch với bookings.showtime_id: khóa ngoại tổ hợp
--      (booking_id, showtime_id) -> bookings (id, showtime_id)
--    ràng buộc chặt hai cột với nhau.
--
--    Hệ quả thiết kế: khi đơn chuyển sang failed/cancelled, tầng ứng dụng phải
--    XÓA các dòng booking_seats của đơn đó để giải phóng ghế (không có cơ chế
--    giữ ghế tạm thời, cũng không có unique có điều kiện trong MySQL).
-- =============================================================================
CREATE TABLE booking_seats (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id  INT UNSIGNED NOT NULL,
  showtime_id INT UNSIGNED NOT NULL,
  seat_id     INT UNSIGNED NOT NULL,
  price       DECIMAL(10,2) NOT NULL COMMENT 'Giá thực thu của ghế này, đơn vị VND',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_booking_seats_showtime_seat (showtime_id, seat_id),
  KEY idx_booking_seats_booking (booking_id, showtime_id),
  KEY idx_booking_seats_seat (seat_id),
  CONSTRAINT fk_booking_seats_booking
    FOREIGN KEY (booking_id, showtime_id) REFERENCES bookings (id, showtime_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_booking_seats_seat
    FOREIGN KEY (seat_id) REFERENCES seats (id) ON DELETE RESTRICT,
  CONSTRAINT chk_booking_seats_price_non_negative CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ghế thuộc đơn đặt — có UNIQUE(showtime_id, seat_id)';


-- =============================================================================
-- 9. payments — thanh toán giả lập
--    Quy tắc: payment thất bại KHÔNG được tạo ra booking confirmed.
--    Ở tầng DB, các CHECK dưới đây bảo đảm tính nhất quán NỘI TẠI của một
--    payment (success phải có paid_at; failed phải KHÔNG có paid_at).
--    Ràng buộc liên bảng "bookings.status = 'confirmed' => tồn tại payment
--    success" không thể viết bằng CHECK trong MySQL, được enforce trong
--    transaction của tầng ứng dụng (Task 4).
-- =============================================================================
CREATE TABLE payments (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id      INT UNSIGNED NOT NULL,
  method          ENUM('credit_card','bank_transfer','e_wallet','cash') NOT NULL,
  amount          DECIMAL(10,2) NOT NULL COMMENT 'Số tiền của lần thanh toán này, đơn vị VND',
  status          ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  transaction_ref VARCHAR(100) NULL COMMENT 'Mã giao dịch do cổng thanh toán giả lập trả về',
  paid_at         DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- transaction_ref là duy nhất khi có giá trị (MySQL cho phép nhiều NULL).
  UNIQUE KEY uq_payments_transaction_ref (transaction_ref),
  KEY idx_payments_booking (booking_id),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_booking
    FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT chk_payments_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT chk_payments_ref_not_blank      CHECK (transaction_ref IS NULL OR CHAR_LENGTH(TRIM(transaction_ref)) > 0),
  CONSTRAINT chk_payments_success_paid_at    CHECK (status <> 'success' OR paid_at IS NOT NULL),
  CONSTRAINT chk_payments_failed_paid_at     CHECK (status <> 'failed'  OR paid_at IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Thanh toán giả lập';


-- =============================================================================
-- Kết thúc init.sql
-- Bước tiếp theo (tùy chọn): import database/sample-data.sql để có dữ liệu mẫu.
-- =============================================================================
