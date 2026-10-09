'use strict';

const mysql = require('mysql2/promise');

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
    console.log(JSON.stringify({ level: 'info', msg: 'Database connection established' }));
    conn.release();
  })
  .catch((err) => {
    console.error(JSON.stringify({ level: 'error', msg: 'Database connection failed', error: err.message }));
    // Không throw ở đây để server vẫn lên (health endpoint vẫn sống), nhưng báo lỗi vào log
  });

module.exports = pool;
