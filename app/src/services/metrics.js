'use strict';

/**
 * Quản lý Prometheus Metrics cho hệ thống đặt vé xem phim (Task 11).
 *
 * Định nghĩa registry, thu thập default metrics của Node.js,
 * và các custom business/operational metrics:
 * - http_requests_total: Tổng số HTTP requests (method, route, status_code)
 * - http_request_duration_seconds: Histogram thời gian phản hồi (latency)
 * - http_request_errors_total: Tổng số lỗi 4xx/5xx (method, route, status_code, error_type)
 * - movie_ticket_bookings_total: Tổng số lượt tạo booking (status: pending/conflict/bad_request/error)
 * - movie_ticket_payments_total: Tổng số lượt thanh toán (method, status: success/failed/error)
 *
 * Nguyên tắc bảo mật & cardinality:
 * - KHÔNG đưa PII (email, user_id, booking_code, amount, token, IP) vào labels.
 * - Route được chuẩn hóa thành template pattern (ví dụ /api/movies/:id) thay vì URL thô.
 */

const client = require('prom-client');

// Sử dụng Registry riêng để kiểm soát hoàn toàn các metrics xuất ra
const register = new client.Registry();

// Bật thu thập metrics mặc định của Node.js (CPU, Memory, Event loop, Heap, GC,...)
client.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
});

// 1. HTTP Requests Counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// 2. HTTP Request Duration Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// 3. HTTP Request Errors Counter (4xx và 5xx)
const httpRequestErrorsTotal = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP error responses (4xx and 5xx)',
  labelNames: ['method', 'route', 'status_code', 'error_type'],
  registers: [register],
});

// 4. Booking Business Counter
const bookingsTotal = new client.Counter({
  name: 'movie_ticket_bookings_total',
  help: 'Total number of bookings created by status',
  labelNames: ['status'],
  registers: [register],
});

// 5. Payment Business Counter
const paymentsTotal = new client.Counter({
  name: 'movie_ticket_payments_total',
  help: 'Total number of payments processed by method and status',
  labelNames: ['method', 'status'],
  registers: [register],
});

// Danh sách phương thức thanh toán hợp lệ nhằm giới hạn cardinality của label
const VALID_PAYMENT_METHODS = [
  'credit_card',
  'bank_transfer',
  'e_wallet',
  'cash',
  'momo',
  'vnpay',
  'zalopay',
];

function normalizeMethod(method) {
  if (!method || typeof method !== 'string') return 'unknown';
  const lower = method.toLowerCase().trim();
  return VALID_PAYMENT_METHODS.includes(lower) ? lower : 'other';
}

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestErrorsTotal,
  bookingsTotal,
  paymentsTotal,
  normalizeMethod,
};
