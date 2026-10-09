'use strict';

const db = require('../services/db');

const showtimeController = {
  // GET /api/showtimes/:id
  async getShowtimeById(req, res, next) {
    try {
      const showtimeId = parseInt(req.params.id, 10);
      if (isNaN(showtimeId)) return res.status(400).json({ error: 'Invalid ID' });

      const [rows] = await db.execute(`
        SELECT st.*, m.title as movie_title, r.name as room_name, c.name as cinema_name
        FROM showtimes st
        JOIN movies m ON st.movie_id = m.id
        JOIN rooms r ON st.room_id = r.id
        JOIN cinemas c ON r.cinema_id = c.id
        WHERE st.id = ?
      `, [showtimeId]);

      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/showtimes/:id/seats
  async getSeatsForShowtime(req, res, next) {
    try {
      const showtimeId = parseInt(req.params.id, 10);
      if (isNaN(showtimeId)) {
        return res.status(400).json({ error: 'Invalid showtime ID' });
      }

      // Lấy thông tin phòng chiếu của suất
      const [stRows] = await db.execute('SELECT room_id FROM showtimes WHERE id = ?', [showtimeId]);
      if (stRows.length === 0) {
        return res.status(404).json({ error: 'Showtime not found' });
      }
      const roomId = stRows[0].room_id;

      // Lấy tất cả ghế của phòng đó
      const [allSeats] = await db.execute(
        'SELECT id, seat_row, seat_number, seat_type FROM seats WHERE room_id = ? AND is_active = 1 ORDER BY seat_row, seat_number',
        [roomId]
      );

      // Lấy danh sách ID ghế đã đặt cho suất chiếu này
      const [bookedRows] = await db.execute(
        'SELECT seat_id FROM booking_seats WHERE showtime_id = ?',
        [showtimeId]
      );
      
      const bookedSeatIds = new Set(bookedRows.map(row => row.seat_id));

      // Map lại danh sách ghế, thêm trường is_booked
      const seatsData = allSeats.map(seat => ({
        ...seat,
        is_booked: bookedSeatIds.has(seat.id)
      }));

      res.json(seatsData);
    } catch (err) {
      next(err);
    }
  }
};

module.exports = showtimeController;
