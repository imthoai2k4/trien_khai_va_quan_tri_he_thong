'use strict';

/**
 * Xử lý lỗi tập trung (Task 4)
 * Tránh trả stack trace về cho client để đảm bảo an toàn.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  
  // Log lỗi chi tiết vào server
  console.error(JSON.stringify({
    level: 'error',
    msg: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  }));

  // Phản hồi an toàn cho client
  const response = {
    error: statusCode === 500 ? 'Internal Server Error' : err.message
  };

  // Nếu là dev environment, có thể trả thêm chi tiết (tùy chọn)
  if (process.env.NODE_ENV === 'development') {
    response.detail = err.message;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
