'use strict';

const db = require('../services/db');

const movieController = {
  // Lấy danh sách tất cả phim
  async getAllMovies(req, res, next) {
    try {
      const status = req.query.status;
      let query = 'SELECT * FROM movies';
      const params = [];

      if (status && ['now_showing', 'coming_soon'].includes(status)) {
        query += ' WHERE status = ?';
        params.push(status);
      }

      query += ' ORDER BY release_date DESC';

      const [rows] = await db.execute(query, params);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },

  // Lấy chi tiết một phim
  async getMovieById(req, res, next) {
    try {
      const movieId = parseInt(req.params.id, 10);
      if (isNaN(movieId)) {
        return res.status(400).json({ error: 'Invalid movie ID' });
      }

      const [rows] = await db.execute('SELECT * FROM movies WHERE id = ?', [movieId]);
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  },

  // Lấy suất chiếu của một phim
  async getShowtimesForMovie(req, res, next) {
    try {
      const movieId = parseInt(req.params.id, 10);
      if (isNaN(movieId)) {
        return res.status(400).json({ error: 'Invalid movie ID' });
      }

      // Lấy các suất chiếu và thông tin rạp, phòng chiếu tương ứng
      const query = `
        SELECT st.id, st.movie_id, st.room_id, st.start_time, st.price,
               r.name AS room_name, r.capacity,
               c.id AS cinema_id, c.name AS cinema_name
        FROM showtimes st
        JOIN rooms r ON st.room_id = r.id
        JOIN cinemas c ON r.cinema_id = c.id
        WHERE st.movie_id = ?
        ORDER BY st.start_time ASC
      `;
      const [rows] = await db.execute(query, [movieId]);
      
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
};

module.exports = movieController;
