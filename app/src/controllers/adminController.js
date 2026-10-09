'use strict';

const db = require('../services/db');

const adminController = {
  // GET /api/admin/dashboard
  async getDashboardStats(req, res, next) {
    try {
      // Ví dụ: Đếm tổng booking, tổng doanh thu
      const [stats] = await db.execute(`
        SELECT 
          COUNT(id) as total_bookings,
          SUM(total_amount) as total_revenue
        FROM bookings
        WHERE status = 'confirmed'
      `);

      const [recentBookings] = await db.execute(`
        SELECT b.booking_code, b.total_amount, b.created_at, u.name as user_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        WHERE b.status = 'confirmed'
        ORDER BY b.created_at DESC
        LIMIT 10
      `);

      res.json({
        stats: stats[0],
        recentBookings
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = adminController;
