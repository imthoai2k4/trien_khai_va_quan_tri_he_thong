'use strict';

/**
 * Structured JSON logger cho ứng dụng đặt vé (Task 13).
 *
 * Mọi log của ứng dụng được ghi ra stdout/stderr dưới dạng MỘT dòng JSON
 * (JSON Lines). Docker ghi lại thành container log, Promtail đọc và gắn nhãn
 * `service="movie-app"` rồi đẩy về Loki — nhờ đó log truy vấn được bằng LogQL.
 *
 * Bốn loại log nghiệp vụ theo yêu cầu Task 13:
 * - `http_request`  : mỗi HTTP request (method, path, status, duration_ms, ip)
 * - `booking_event` : đặt vé thành công/thất bại (booking_id, showtime_id, seat_count, status)
 * - `payment_event` : thanh toán giả lập (payment_id, booking_id, method, amount, status)
 * - `system_error`  : lỗi ngoại lệ / lỗi database trong errorHandler
 * Ngoài ra `system_event` dùng cho các thông báo khởi động (kết nối DB, server listen).
 *
 * ============================ NGUYÊN TẮC BẢO MẬT ============================
 * TUYỆT ĐỐI KHÔNG ghi log: mật khẩu (plain text hoặc hash), token/cookie phiên
 * đăng nhập, secret key, số thẻ hoặc CVV.
 * Hàm `sanitize()` duyệt đệ quy payload và thay thế mọi khoá có tên nhạy cảm
 * bằng "[REDACTED]" — kể cả khi lập trình viên lỡ truyền vào — để quy tắc bảo
 * mật được thi hành ở tầng code chứ không chỉ ở tầng quy ước.
 * ============================================================================
 */

const SERVICE_NAME = 'movie-app';

// Khoá bị coi là nhạy cảm: bị loại bỏ giá trị trước khi ghi log.
const SENSITIVE_KEY_PATTERN =
  /(pass|pwd|secret|token|authorization|cookie|session|jwt|api[-_]?key|cvv|cvc|card|credit|otp|hash|credential)/i;

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 50;

/**
 * Loại bỏ dữ liệu nhạy cảm khỏi payload trước khi ghi log.
 * Không thay đổi payload gốc.
 */
function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return '[TRUNCATED]';
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) return '[TRUNCATED]';
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      clean[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitize(val, depth + 1);
    }
    return clean;
  }
  return value;
}

/**
 * Ghi một dòng log JSON.
 * - `level`: info | warn | error
 * - `payload`: các trường bổ sung; `type` nên được đặt để phân loại log.
 *
 * `timestamp`, `level`, `service` do logger tự sinh và không thể bị payload
 * ghi đè, bảo đảm mọi dòng log đều có đủ bộ trường bắt buộc.
 */
function write(level, payload) {
  const safe = sanitize(payload) || {};
  delete safe.timestamp;
  delete safe.level;
  delete safe.service;

  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    ...safe,
  });

  // Log lỗi/cảnh báo ra stderr, phần còn lại ra stdout — Docker thu cả hai
  // luồng nên Promtail vẫn đọc được đầy đủ.
  if (level === 'error' || level === 'warn') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

/** HTTP request: level tự suy ra từ status (2xx/3xx=info, 4xx=warn, 5xx=error). */
function httpRequest({ method, path, status, duration_ms, ip }) {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  const entry = { type: 'http_request', method, path, status, duration_ms, ip };
  // Trường bổ trợ giúp truy vấn `|= "error"` bắt được cả lỗi phía client.
  if (status >= 400) {
    entry.error_type = status >= 500 ? '5xx' : '4xx';
  }
  write(level, entry);
}

/**
 * Sự kiện đặt vé. `status`: pending (tạo đơn thành công) | confirmed | failed.
 * `reason` chỉ có ở nhánh thất bại (invalid_payload, invalid_seats,
 * showtime_not_found, seat_conflict, payment_failed, db_error...).
 */
function bookingEvent({ booking_id = null, showtime_id = null, seat_count = null, status, reason }) {
  const entry = { type: 'booking_event', booking_id, showtime_id, seat_count, status };
  if (reason) entry.reason = reason;
  write(status === 'failed' ? 'warn' : 'info', entry);
}

/** Sự kiện thanh toán giả lập. `status`: success | failed. */
function paymentEvent({
  payment_id = null,
  booking_id = null,
  method = 'unknown',
  amount = null,
  status,
  reason,
}) {
  const entry = { type: 'payment_event', payment_id, booking_id, method, amount, status };
  if (reason) entry.reason = reason;
  write(status === 'success' ? 'info' : 'warn', entry);
}

/** Lỗi hệ thống / lỗi database — luôn ở level error. */
function systemError({ msg, path, method, error_code, stack }) {
  const entry = { type: 'system_error', msg, path, method };
  if (error_code) entry.error_code = error_code;
  if (stack) entry.stack = stack;
  write('error', entry);
}

/** Thông báo vận hành (khởi động, kết nối DB...). */
function systemEvent({ msg, ...rest }) {
  write('info', { type: 'system_event', msg, ...rest });
}

module.exports = {
  SERVICE_NAME,
  sanitize,
  write,
  info: (payload) => write('info', payload),
  warn: (payload) => write('warn', payload),
  error: (payload) => write('error', payload),
  httpRequest,
  bookingEvent,
  paymentEvent,
  systemError,
  systemEvent,
};
