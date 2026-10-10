'use strict';

const db = require('../services/db');
const { paymentsTotal, normalizeMethod } = require('../services/metrics');
const logger = require('../services/logger');

const paymentController = {
  // POST /api/payments
  async createPayment(req, res, next) {
    let connection;
    try {
      const { booking_id, method, simulate_status } = req.body;

      if (!booking_id || !method || !simulate_status) {
        paymentsTotal.inc({ method: normalizeMethod(method), status: 'error' });
        logger.paymentEvent({
          booking_id: booking_id || null,
          method: normalizeMethod(method),
          status: 'failed',
          reason: 'invalid_payload',
        });
        return res.status(400).json({ error: 'Missing required payment fields' });
      }

      connection = await db.getConnection();
      await connection.beginTransaction();

      // 1. Khóa row booking bằng FOR UPDATE để đảm bảo an toàn đồng thời (Idempotency)
      // Không cho phép 2 request thanh toán cùng lúc cho cùng 1 đơn.
      const [bookingRows] = await connection.execute(
        'SELECT id, showtime_id, total_amount, status FROM bookings WHERE id = ? FOR UPDATE',
        [booking_id]
      );

      if (bookingRows.length === 0) {
        await connection.rollback();
        paymentsTotal.inc({ method: normalizeMethod(method), status: 'error' });
        logger.paymentEvent({
          booking_id,
          method: normalizeMethod(method),
          status: 'failed',
          reason: 'booking_not_found',
        });
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = bookingRows[0];

      // Thao tác lặp an toàn (Idempotent): Nếu đơn đã xử lý xong thì trả về trạng thái hiện tại
      if (booking.status === 'confirmed') {
        await connection.rollback();
        paymentsTotal.inc({ method: normalizeMethod(method), status: 'error' });
        logger.paymentEvent({
          booking_id,
          method: normalizeMethod(method),
          amount: booking.total_amount,
          status: 'failed',
          reason: 'booking_already_confirmed',
        });
        return res.status(400).json({ error: 'Booking already paid and confirmed' });
      }
      if (booking.status === 'failed' || booking.status === 'cancelled') {
        await connection.rollback();
        paymentsTotal.inc({ method: normalizeMethod(method), status: 'error' });
        logger.paymentEvent({
          booking_id,
          method: normalizeMethod(method),
          amount: booking.total_amount,
          status: 'failed',
          reason: `booking_${booking.status}`,
        });
        return res.status(400).json({ error: 'Booking has been failed/cancelled' });
      }

      // Tạo transaction_ref giả lập
      const transactionRef = 'TX' + Date.now().toString() + Math.floor(Math.random() * 1000);
      
      const paidAt = simulate_status === 'success' ? new Date() : null;

      // 2. Insert payment record
      const [paymentResult] = await connection.execute(
        `INSERT INTO payments (booking_id, method, amount, status, transaction_ref, paid_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          booking_id,
          method,
          booking.total_amount,
          simulate_status,
          transactionRef,
          paidAt
        ]
      );
      const paymentId = paymentResult.insertId;

      // Số ghế của đơn — dùng cho log sự kiện đặt vé khi đơn được xác nhận/hủy.
      const [seatCountRows] = await connection.execute(
        'SELECT COUNT(*) AS seat_count FROM booking_seats WHERE booking_id = ?',
        [booking_id]
      );
      const seatCount = seatCountRows[0].seat_count;

      // 3. Xử lý logic thành công / thất bại
      if (simulate_status === 'success') {
        paymentsTotal.inc({ method: normalizeMethod(method), status: 'success' });
        await connection.execute(
          'UPDATE bookings SET status = "confirmed" WHERE id = ?',
          [booking_id]
        );

        logger.paymentEvent({
          payment_id: paymentId,
          booking_id,
          method: normalizeMethod(method),
          amount: booking.total_amount,
          status: 'success',
        });
        logger.bookingEvent({
          booking_id,
          showtime_id: booking.showtime_id,
          seat_count: seatCount,
          status: 'confirmed',
        });
      } else {
        paymentsTotal.inc({ method: normalizeMethod(method), status: 'failed' });
        await connection.execute(
          'UPDATE bookings SET status = "failed" WHERE id = ?',
          [booking_id]
        );
        // QUAN TRỌNG: Giải phóng ghế vì đơn thất bại
        await connection.execute(
          'DELETE FROM booking_seats WHERE booking_id = ?',
          [booking_id]
        );

        logger.paymentEvent({
          payment_id: paymentId,
          booking_id,
          method: normalizeMethod(method),
          amount: booking.total_amount,
          status: 'failed',
          reason: 'simulated_failure',
        });
        logger.bookingEvent({
          booking_id,
          showtime_id: booking.showtime_id,
          seat_count: seatCount,
          status: 'failed',
          reason: 'payment_failed',
        });
      }

      await connection.commit();

      res.status(200).json({
        success: simulate_status === 'success',
        booking_id: booking_id,
        transaction_ref: transactionRef,
        message: simulate_status === 'success' ? 'Thanh toán thành công' : 'Thanh toán thất bại'
      });

    } catch (err) {
      if (connection) {
        await connection.rollback();
      }
      paymentsTotal.inc({ method: normalizeMethod(req.body && req.body.method), status: 'error' });
      logger.paymentEvent({
        booking_id: (req.body && req.body.booking_id) || null,
        method: normalizeMethod(req.body && req.body.method),
        status: 'failed',
        reason: 'db_error',
      });
      // errorHandler sẽ ghi tiếp một dòng system_error kèm chi tiết ngoại lệ.
      next(err);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
};

module.exports = paymentController;
