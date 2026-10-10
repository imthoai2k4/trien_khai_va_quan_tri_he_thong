'use strict';

/**
 * Xử lý lỗi tập trung (Task 4, cập nhật Task 13).
 *
 * - Ghi log lỗi có cấu trúc (type = "system_error") để Promtail đẩy về Loki.
 * - Trả về client thông báo an toàn, KHÔNG kèm stack trace hay chi tiết MySQL.
 */

const logger = require('../services/logger');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  // Lỗi parse JSON body: `err.message` của body-parser chứa trích đoạn body
  // thô do client gửi lên — nếu client gửi sai định dạng một payload đăng nhập
  // thì mật khẩu có thể nằm trong đó. Vì vậy chỉ ghi thông báo chung.
  const isBodyParseError = err.type === 'entity.parse.failed';

  // Chỉ ghi pathname, bỏ query string để không lộ tham số nhạy cảm vào log.
  logger.systemError({
    msg: isBodyParseError ? 'Malformed JSON request body' : err.message,
    path: req.originalUrl.split('?')[0],
    method: req.method,
    error_code: err.code || err.type || (statusCode >= 500 ? 'E_INTERNAL' : 'E_CLIENT'),
    stack: isBodyParseError ? undefined : err.stack,
  });

  // Phản hồi an toàn cho client
  let publicMessage = err.message;
  if (statusCode >= 500) {
    publicMessage = 'Internal Server Error';
  } else if (isBodyParseError) {
    publicMessage = 'Malformed JSON request body';
  }

  const response = { error: publicMessage };

  // Nếu là dev environment, có thể trả thêm chi tiết (tùy chọn)
  if (process.env.NODE_ENV === 'development') {
    response.detail = err.message;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
