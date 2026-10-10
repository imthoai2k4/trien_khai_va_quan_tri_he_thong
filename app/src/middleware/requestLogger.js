'use strict';

/**
 * Middleware ghi log HTTP request có cấu trúc (Task 13).
 *
 * Mỗi request hoàn tất sinh một dòng JSON:
 *   { "timestamp", "level", "service": "movie-app", "type": "http_request",
 *     "method", "path", "status", "duration_ms", "ip" [, "error_type"] }
 *
 * Nguyên tắc:
 * - KHÔNG ghi body, query string, header hay cookie: tránh lộ mật khẩu, token
 *   hoặc dữ liệu thanh toán. Chỉ ghi pathname (đã cắt bỏ phần `?...`).
 * - Bỏ qua `/metrics`: Prometheus cào mỗi 5 giây, ghi log mỗi lần cào sẽ làm
 *   ngập Loki mà không mang thông tin nghiệp vụ (đồng bộ với metricsMiddleware).
 */

const logger = require('../services/logger');

function requestLogger(req, res, next) {
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    logger.httpRequest({
      method: req.method,
      // Cắt query string: tránh rò rỉ tham số nhạy cảm và giữ log ổn định.
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
      // `req.ip` chỉ trả về IP thật của khách khi `trust proxy` được bật
      // (xem app/src/server.js) vì mọi request đều đi qua Nginx.
      ip: req.ip,
    });
  });

  next();
}

module.exports = requestLogger;
