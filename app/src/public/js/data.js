/**
 * data.js — Dữ liệu mẫu cục bộ cho Task 3 (giao diện static).
 * TẤT CẢ dữ liệu ở đây là DEMO — không kết nối API, không lưu vào server.
 * Khớp với database/sample-data.sql (Task 2).
 */
'use strict';

const DEMO_DATA = {
  movies: [
    {
      id: 1,
      title: 'Dune: Hành Tinh Cát – Phần Hai',
      description: 'Paul Atreides hợp lực cùng người Fremen để trả thù những kẻ đã hủy diệt gia tộc mình. Trên sa mạc Arrakis, ông trở thành người lãnh đạo của cuộc kháng chiến đối đầu với Hoàng đế và những thế lực tối thượng.',
      duration_minutes: 166,
      poster_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80',
      status: 'now_showing',
      release_date: '2026-03-01',
      genre: 'Khoa học viễn tưởng',
      rating: 8.5,
    },
    {
      id: 2,
      title: 'Lật Mặt 8: Vòng Tay Nắng',
      description: 'Một gia đình đối mặt với biến cố và những bí mật bị chôn giấu nhiều năm. Hành trình tìm lại sự thật và tình thân đầy xúc động.',
      duration_minutes: 130,
      poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&q=80',
      status: 'now_showing',
      release_date: '2026-04-26',
      genre: 'Gia đình / Tâm lý',
      rating: 7.8,
    },
    {
      id: 3,
      title: 'Avatar 3: Lửa và Tro Tàn',
      description: 'Cuộc chiến mới trên Pandora giữa các bộ tộc và những kẻ xâm lược. Jake Sully phải đối mặt với kẻ thù nguy hiểm hơn bao giờ hết trong cuộc bảo vệ gia đình và thế giới đại dương.',
      duration_minutes: 190,
      poster_url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400&q=80',
      status: 'coming_soon',
      release_date: '2026-12-18',
      genre: 'Hành động / Phiêu lưu',
      rating: null,
    },
  ],

  cinemas: [
    { id: 1, name: 'TKPM Cinema Quận 1', address: '123 Nguyễn Huệ, Quận 1', city: 'TP. Hồ Chí Minh' },
    { id: 2, name: 'TKPM Cinema Quận 7', address: '45 Nguyễn Thị Thập, Quận 7', city: 'TP. Hồ Chí Minh' },
  ],

  rooms: [
    { id: 1, cinema_id: 1, name: 'Phòng 1', capacity: 40 },
    { id: 2, cinema_id: 1, name: 'Phòng 2', capacity: 40 },
    { id: 3, cinema_id: 2, name: 'Phòng 1', capacity: 24 },
  ],

  showtimes: [
    { id: 1, movie_id: 1, room_id: 1, start_time: '2026-10-10T19:00:00', price: 90000 },
    { id: 2, movie_id: 2, room_id: 1, start_time: '2026-10-10T21:30:00', price: 90000 },
    { id: 3, movie_id: 1, room_id: 2, start_time: '2026-10-11T18:00:00', price: 80000 },
    { id: 4, movie_id: 2, room_id: 2, start_time: '2026-10-11T20:30:00', price: 80000 },
    { id: 5, movie_id: 1, room_id: 3, start_time: '2026-10-12T20:00:00', price: 120000 },
  ],

  /** Ghế đã đặt trong demo (booking_seats confirmed/pending của showtime đó) */
  bookedSeats: {
    1: [1, 2, 3],  // showtime 1: ghế A1, A2, A3
    2: [],
    3: [],
    4: [],
    5: [],
  },

  /**
   * Tạo danh sách ghế cho một phòng.
   * room_id 1,2: 40 ghế (A-C standard, D-E vip, 8 ghế/hàng)
   * room_id 3  : 24 ghế (A-C standard 6 ghế/hàng, D couple 6 ghế)
   */
  generateSeats(room_id) {
    const seats = [];
    if (room_id === 1 || room_id === 2) {
      const offset = room_id === 1 ? 0 : 40;
      const rows = [
        { row: 'A', type: 'standard', count: 8 },
        { row: 'B', type: 'standard', count: 8 },
        { row: 'C', type: 'standard', count: 8 },
        { row: 'D', type: 'vip',      count: 8 },
        { row: 'E', type: 'vip',      count: 8 },
      ];
      let id = offset + 1;
      for (const r of rows) {
        for (let n = 1; n <= r.count; n++) {
          seats.push({ id, room_id, seat_row: r.row, seat_number: n, seat_type: r.type });
          id++;
        }
      }
    } else if (room_id === 3) {
      const rows = [
        { row: 'A', type: 'standard', count: 6 },
        { row: 'B', type: 'standard', count: 6 },
        { row: 'C', type: 'standard', count: 6 },
        { row: 'D', type: 'couple',   count: 6 },
      ];
      let id = 81;
      for (const r of rows) {
        for (let n = 1; n <= r.count; n++) {
          seats.push({ id, room_id, seat_row: r.row, seat_number: n, seat_type: r.type });
          id++;
        }
      }
    }
    return seats;
  },

  formatPrice(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  },

  formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}g ${m}p`;
  },

  formatDatetime(isoStr) {
    const d = new Date(isoStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const day = days[d.getDay()];
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { day, date, time, full: `${day}, ${date} — ${time}` };
  },

  getMovie(id) { return this.movies.find(m => m.id === id) || null; },
  getShowtime(id) { return this.showtimes.find(s => s.id === id) || null; },
  getRoom(id) { return this.rooms.find(r => r.id === id) || null; },
  getCinema(id) { return this.cinemas.find(c => c.id === id) || null; },
  getShowtimesForMovie(movie_id) { return this.showtimes.filter(s => s.movie_id === movie_id); },
  getBookedSeats(showtime_id) { return this.bookedSeats[showtime_id] || []; },

  generateBookingCode() {
    const d = new Date();
    const ymd = d.toISOString().slice(0,10).replace(/-/g,'');
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    return `BK${ymd}${rand}`;
  },
};
