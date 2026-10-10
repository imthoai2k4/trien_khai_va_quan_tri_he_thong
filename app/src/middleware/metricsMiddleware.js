'use strict';

/**
 * Middleware thu thập HTTP metrics cho Express (Task 11).
 *
 * Đo đạc:
 * - Tổng số request (http_requests_total)
 * - Độ trễ xử lý (http_request_duration_seconds)
 * - Tổng số lỗi 4xx/5xx (http_request_errors_total)
 *
 * Kiểm soát Cardinality:
 * - Dùng route pattern (ví dụ /api/movies/:id) thay vì URL thô chứa query hoặc ID cụ thể.
 * - Chuẩn hóa các tài nguyên tĩnh thành 'static_asset' và trang 404 thành 'not_found'.
 * - Bỏ qua endpoint '/metrics' để việc scrape định kỳ không làm nhiễu dữ liệu.
 */

const {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestErrorsTotal,
} = require('../services/metrics');

/**
 * Lấy route template pattern an toàn từ request Express.
 */
function getRoutePattern(req, res) {
  if (req.route && req.route.path) {
    const base = req.baseUrl || '';
    return `${base}${req.route.path}`;
  }

  // Các trang HTML hoặc static files phục vụ trực tiếp
  const p = req.path || '';
  if (p === '/' || p.endsWith('.html')) {
    return p === '/' ? '/index.html' : p;
  }
  if (p.startsWith('/css/') || p.startsWith('/js/')) {
    return 'static_asset';
  }
  if (p === '/healthz') {
    return '/healthz';
  }

  // Nếu 404 hoặc route không match
  if (res.statusCode === 404) {
    return 'not_found';
  }

  return 'other';
}

function metricsMiddleware(req, res, next) {
  // Không ghi nhận request tới chính endpoint /metrics
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    const method = req.method;
    const statusCode = String(res.statusCode);
    const route = getRoutePattern(req, res);

    // 1. Tổng số requests
    httpRequestsTotal.inc({ method, route, status_code: statusCode });

    // 2. Độ trễ (Histogram)
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationSeconds);

    // 3. Lỗi HTTP (4xx / 5xx)
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? '5xx' : '4xx';
      httpRequestErrorsTotal.inc({ method, route, status_code: statusCode, error_type: errorType });
    }
  });

  next();
}

module.exports = metricsMiddleware;
