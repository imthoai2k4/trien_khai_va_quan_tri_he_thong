'use strict';

const mysql = require('mysql2/promise');
const logger = require('./logger');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Cấu hình múi giờ để đảm bảo tương thích với dữ liệu
  timezone: '+07:00',
});

// Kiểm tra kết nối khi khởi động
pool.getConnection()
  .then((conn) => {
    logger.systemEvent({ msg: 'Database connection established', db_host: process.env.MYSQL_HOST || 'localhost' });
    conn.release();
  })
  .catch((err) => {
    // Lỗi lúc khởi động, không gắn với request nào nên không có path/method.
    logger.systemError({
      msg: 'Database connection failed',
      error_code: err.code || 'DB_CONNECT_ERROR',
      stack: err.stack,
    });
    // Không throw ở đây để server vẫn lên (health endpoint vẫn sống), nhưng báo lỗi vào log
  });

module.exports = pool;
