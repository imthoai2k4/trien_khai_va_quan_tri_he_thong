'use strict';

/**
 * Express server — Task 4 (Backend API kết nối MySQL).
 *
 * Chứa cấu hình kết nối DB pool, health endpoint, xử lý lỗi cơ bản,
 * và API đọc danh sách/chi tiết phim, suất chiếu.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const PORT = Number(process.env.APP_PORT) || 3000;
const HOST = process.env.APP_HOST || '0.0.0.0';

app.disable('x-powered-by');

// Middleware parse JSON cho các request có body
app.use(express.json());

// Phục vụ giao diện tĩnh. Giao diện thật thuộc Task 3.
app.use(express.static(path.join(__dirname, 'public')));

// Chỉ dùng để kiểm tra tiến trình đã khởi động (không phải API nghiệp vụ).
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    service: 'movie-ticket-app',
    uptime_seconds: Math.round(process.uptime()),
  });
});

// API Routes
app.use('/api', apiRoutes);

// Xử lý 404 cho các route không tồn tại
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Xử lý lỗi tập trung (an toàn, không lộ stack trace)
app.use(errorHandler);

app.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({ level: 'info', msg: 'server listening', host: HOST, port: PORT })
  );
});

module.exports = app;
