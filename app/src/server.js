'use strict';

/**
 * Skeleton Express server — Task 1.
 *
 * Phạm vi: chỉ đủ để xác nhận bộ khung chạy được.
 * KHÔNG chứa API nghiệp vụ (phim, suất chiếu, ghế, booking, payment, auth).
 * Các phần đó thuộc Task 4 trở đi.
 */

const path = require('path');
const express = require('express');

require('dotenv').config();

const app = express();

const PORT = Number(process.env.APP_PORT) || 3000;
const HOST = process.env.APP_HOST || '0.0.0.0';

app.disable('x-powered-by');

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

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(
    JSON.stringify({ level: 'error', msg: 'unhandled error', error: err.message })
  );
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({ level: 'info', msg: 'server listening', host: HOST, port: PORT })
  );
});

module.exports = app;
