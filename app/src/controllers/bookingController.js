'use strict';

const db = require('../services/db');

// Giả lập user_id cho DEMO (Vì chưa làm tính năng Auth)
const DEMO_USER_ID = 1;

const bookingController = {
  // POST /api/bookings
  async createBooking(req, res, next) {
    let connection;
    try {
      const { showtime_id, seat_ids } = req.body;

      if (!showtime_id || !Array.isArray(seat_ids) || seat_ids.length === 0) {
        return res.status(400).json({ error: 'Missing showtime_id or seat_ids' });
      }

      if (seat_ids.length > 8) {
        return res.status(400).json({ error: 'Cannot book more than 8 seats at once' });
      }

      // 1. Kiểm tra tính hợp lệ của suất chiếu và các ghế
      // Cần lấy giá suất chiếu để tính tổng tiền, và room_id để kiểm tra ghế
      const [stRows] = await db.execute(
        'SELECT id, room_id, price, start_time FROM showtimes WHERE id = ?',
        [showtime_id]
      );
      if (stRows.length === 0) {
        return res.status(404).json({ error: 'Showtime not found' });
      }
      const showtime = stRows[0];

      // Tạm thời bỏ qua kiểm tra ngày ở quá khứ (vì dữ liệu mẫu là cố định),
      // Trong thực tế, nên check showtime.start_time > NOW()

      // 2. Kiểm tra tất cả ghế có thuộc đúng phòng của suất chiếu không
      // Dùng placeholder ? lặp lại
      const placeholders = seat_ids.map(() => '?').join(',');
      const [seats] = await db.execute(
        `SELECT id, room_id FROM seats WHERE id IN (${placeholders})`,
        seat_ids
      );

      if (seats.length !== seat_ids.length) {
        return res.status(400).json({ error: 'Some seats do not exist' });
      }

      for (const seat of seats) {
        if (seat.room_id !== showtime.room_id) {
          return res.status(400).json({ error: `Seat ${seat.id} does not belong to the correct room` });
        }
      }

      const totalAmount = showtime.price * seat_ids.length;

      // ==========================================
      // BẮT ĐẦU TRANSACTION
      // ==========================================
      connection = await db.getConnection();
      await connection.beginTransaction();

      // 3. Tạo record đơn hàng (bookings)
      // Sinh mã vé ngẫu nhiên (ví dụ thực tế cần logic phức tạp hơn để đảm bảo unique)
      const bookingCode = 'BK' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
      
      const [bookingResult] = await connection.execute(
        `INSERT INTO bookings (user_id, showtime_id, booking_code, total_amount, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [DEMO_USER_ID, showtime_id, bookingCode, totalAmount]
      );
      const bookingId = bookingResult.insertId;

      // 4. Giữ ghế (INSERT vào booking_seats)
      // Nếu có bất kỳ ghế nào đã bị đặt (trong đơn khác) -> UNIQUE constraint sẽ văng lỗi 1062
      for (const seatId of seat_ids) {
        try {
          await connection.execute(
            `INSERT INTO booking_seats (booking_id, showtime_id, seat_id, price)
             VALUES (?, ?, ?, ?)`,
            [bookingId, showtime_id, seatId, showtime.price]
          );
        } catch (insertErr) {
          // Lỗi 1062: ER_DUP_ENTRY
          if (insertErr.code === 'ER_DUP_ENTRY') {
            await connection.rollback(); // Hủy toàn bộ thay đổi
            return res.status(409).json({ 
              error: 'Một hoặc nhiều ghế đã bị người khác đặt. Vui lòng chọn lại.' 
            });
          }
          // Các lỗi SQL khác -> ném ra ngoài để rollback chung
          throw insertErr;
        }
      }

      // COMMIT nếu mọi thứ suôn sẻ
      await connection.commit();

      // Trả về kết quả thành công để frontend chuyển hướng sang checkout
      res.status(201).json({
        booking_id: bookingId,
        booking_code: bookingCode,
        total_amount: totalAmount,
        status: 'pending'
      });

    } catch (err) {
      if (connection) {
        await connection.rollback();
      }
      next(err);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
};

module.exports = bookingController;
