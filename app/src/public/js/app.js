/**
 * app.js — Logic điều hướng và state management cho Task 3 (giao diện static).
 * Không gọi API. Tất cả dữ liệu lấy từ DEMO_DATA (data.js).
 */
'use strict';

/* ============================================================
   State toàn ứng dụng — lưu trữ lựa chọn giữa các trang
   ============================================================ */
const APP_STATE = {
  selectedMovieId: null,
  selectedShowtimeId: null,
  selectedSeatIds: [],      // [seat.id, ...]
  selectedPaymentMethod: null,
  bookingResult: null,      // { success, bookingCode, ... }
};

/* Lưu/đọc state qua sessionStorage để điều hướng giữa các trang */
function saveState() {
  sessionStorage.setItem('tkpm_state', JSON.stringify(APP_STATE));
}
function loadState() {
  try {
    const raw = sessionStorage.getItem('tkpm_state');
    if (raw) Object.assign(APP_STATE, JSON.parse(raw));
  } catch (_) {}
}

/* ============================================================
   Utilities
   ============================================================ */
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.insertAdjacentHTML('beforeend', c);
    else if (c) e.appendChild(c);
  }
  return e;
}

function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = el('div', { id: 'toast-container', class: 'toast-container' });
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = el('div', { class: `toast toast--${type}`, role: 'alert' },
    el('span', {}, icons[type] || ''),
    el('span', {}, msg)
  );
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function navigate(url) {
  saveState();
  window.location.href = url;
}

/* ============================================================
   Navbar helper — đánh dấu link hiện tại
   ============================================================ */
function initNavbar() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  $$('.navbar__link').forEach(link => {
    if (link.getAttribute('href') === path) link.classList.add('active');
  });
}

/* ============================================================
   INDEX PAGE — Danh sách phim
   ============================================================ */
async function initIndexPage() {
  const grid = $('#movies-grid');
  if (!grid) return;

  let filter = 'all';

  async function fetchAndRenderMovies() {
    grid.innerHTML = '<div class="text-center" style="grid-column:1/-1;padding:2rem">Đang tải dữ liệu phim...</div>';
    
    try {
      let url = '/api/movies';
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không thể tải dữ liệu từ máy chủ (có thể Database đang offline).');
      const list = await res.json();

      if (list.length === 0) {
        grid.innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:2rem">Không có phim nào.</p>';
        return;
      }

      grid.innerHTML = '';
      for (const movie of list) {
        const isNow = movie.status === 'now_showing';
        const dur = DEMO_DATA.formatDuration(movie.duration_minutes);
      const card = el('article', {
        class: 'card',
        role: 'article',
        id: `movie-card-${movie.id}`,
      },
        el('div', { class: 'card__image-wrapper' },
          el('img', {
            class: 'card__image',
            src: movie.poster_url,
            alt: `Poster phim ${movie.title}`,
            loading: 'lazy',
          }),
          el('div', { class: `card__badge card__badge--${isNow ? 'now' : 'soon'}` },
            isNow ? '🎬 Đang chiếu' : '🕐 Sắp chiếu'
          ),
          el('div', { class: 'card__overlay' },
            isNow
              ? el('button', {
                  class: 'btn btn--primary btn--sm',
                  onclick: () => navigate(`movie.html?id=${movie.id}`),
                  'aria-label': `Đặt vé phim ${movie.title}`,
                }, '🎟️ Đặt vé')
              : el('span', { class: 'badge badge--blue' }, '🔔 Sắp ra mắt')
          ),
        ),
        el('div', { class: 'card__body' },
          el('h3', { class: 'card__title' }, movie.title),
          el('div', { class: 'card__meta' },
            el('span', { class: 'card__meta-item' }, `⏱️ ${dur}`),
            movie.rating
              ? el('span', { class: 'card__meta-item text-gold' }, `⭐ ${movie.rating}`)
              : el('span', { class: 'card__meta-item text-muted' }, '⭐ TBA'),
          ),
          el('div', { style: 'margin-top:.75rem' },
            isNow
              ? el('button', {
                  class: 'btn btn--primary btn--sm btn--full',
                  onclick: () => navigate(`movie.html?id=${movie.id}`),
                  'aria-label': `Mua vé phim ${movie.title}`,
                }, '🎟️ Mua vé')
              : el('button', {
                  class: 'btn btn--secondary btn--sm btn--full',
                  disabled: '',
                  'aria-label': `Phim ${movie.title} chưa ra mắt`,
                }, '🔔 Sắp ra mắt')
          ),
        ),
      );
      card.style.cursor = isNow ? 'pointer' : 'default';
      if (isNow) {
        card.querySelector('.card__image-wrapper').addEventListener('click', () => navigate(`movie.html?id=${movie.id}`));
      }
      grid.appendChild(card);
      }
    } catch (error) {
      grid.innerHTML = `
        <div class="text-center" style="grid-column:1/-1;padding:2rem;color:var(--brand-red)">
          <p>❌ Lỗi: ${error.message}</p>
          <p class="text-sm text-muted" style="margin-top:0.5rem">API Task 4 đã được kết nối nhưng có thể Docker/MySQL chưa chạy.</p>
        </div>
      `;
    }
  }

  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.dataset.filter;
      fetchAndRenderMovies();
    });
  });

  fetchAndRenderMovies();
}

/* ============================================================
   MOVIE PAGE — Chi tiết phim + chọn suất chiếu
   ============================================================ */
async function initMoviePage() {
  const params = new URLSearchParams(window.location.search);
  const movieId = parseInt(params.get('id'));
  if (!movieId) { window.location.href = 'index.html'; return; }

  let movie = null;
  let showtimes = [];

  try {
    const movieRes = await fetch(`/api/movies/${movieId}`);
    if (!movieRes.ok) throw new Error('Không thể tải chi tiết phim.');
    movie = await movieRes.json();

    const stRes = await fetch(`/api/movies/${movieId}/showtimes`);
    if (!stRes.ok) throw new Error('Không thể tải lịch chiếu.');
    showtimes = await stRes.json();
  } catch (err) {
    const titleEl = $('#movie-title');
    if (titleEl) {
      titleEl.innerHTML = `<span style="color:var(--brand-red)">❌ Lỗi: ${err.message} (Có thể Database offline)</span>`;
    }
    const showtimesEl = $('#showtimes-container');
    if (showtimesEl) showtimesEl.innerHTML = '';
    return;
  }

  APP_STATE.selectedMovieId = movieId;
  APP_STATE.selectedShowtimeId = null;
  APP_STATE.selectedSeatIds = [];

  // Meta
  document.title = `${movie.title} — TKPM Cinema`;

  // Poster
  const posterEl = $('#movie-poster');
  if (posterEl) {
    posterEl.src = movie.poster_url;
    posterEl.alt = `Poster phim ${movie.title}`;
  }

  // Info
  const titleEl = $('#movie-title');
  if (titleEl) titleEl.textContent = movie.title;

  const descEl = $('#movie-description');
  if (descEl) descEl.textContent = movie.description;

  // Badges
  const metaEl = $('#movie-meta');
  if (metaEl) {
    metaEl.innerHTML = '';
    metaEl.appendChild(el('span', { class: 'badge badge--gray' }, `⏱️ ${DEMO_DATA.formatDuration(movie.duration_minutes)}`));
    metaEl.appendChild(el('span', { class: 'badge badge--gray' }, `🎭 ${movie.genre}`));
    if (movie.rating) metaEl.appendChild(el('span', { class: 'badge badge--gold' }, `⭐ ${movie.rating}`));
    const statusMap = { now_showing: ['badge--red', '🎬 Đang chiếu'], coming_soon: ['badge--blue', '🕐 Sắp chiếu'] };
    const [cls, label] = statusMap[movie.status] || ['badge--gray', movie.status];
    metaEl.appendChild(el('span', { class: `badge ${cls}` }, label));
  }

  // Showtimes
  const showtimesEl = $('#showtimes-container');
  if (!showtimesEl) return;

  showtimesEl.innerHTML = '';

  if (showtimes.length === 0) {
    showtimesEl.innerHTML = '<p class="text-muted">Phim này chưa có suất chiếu.</p>';
    return;
  }

  // Nhóm theo ngày
  const byDate = {};
  for (const st of showtimes) {
    const dateKey = st.start_time.slice(0, 10);
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(st);
  }

  for (const [date, stList] of Object.entries(byDate)) {
    const d = new Date(date);
    const dayLabel = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const section = el('div', { class: 'mb-6' },
      el('p', { class: 'text-sm font-semibold text-muted mb-4', style: 'margin-bottom:.75rem' }, `📅 ${dayLabel}`),
    );
    const btnRow = el('div', { class: 'showtime-list' });
    for (const st of stList) {
      const fmt = DEMO_DATA.formatDatetime(st.start_time);
      // Backend API returns room_name, cinema_name, capacity in the same object
      const available = st.capacity - (st.booked || 0); // Thêm mockup logic nếu booked chưa có
      
      const btn = el('button', {
        class: 'showtime-btn',
        id: `showtime-btn-${st.id}`,
        'aria-label': `Suất ${fmt.time}, giá ${DEMO_DATA.formatPrice(st.price)}`,
        onclick: () => selectShowtime(st.id),
      },
        el('span', { class: 'showtime-btn__time' }, fmt.time),
        el('span', { class: 'showtime-btn__price' }, DEMO_DATA.formatPrice(st.price)),
        el('span', { class: 'showtime-btn__seats' }, `${available} ghế trống`),
        st.cinema_name ? el('span', { style: 'font-size:.65rem;color:var(--text-muted);margin-top:2px' }, st.cinema_name) : '',
      );
      btnRow.appendChild(btn);
    }
    section.appendChild(btnRow);
    showtimesEl.appendChild(section);
  }

  function selectShowtime(id) {
    APP_STATE.selectedShowtimeId = id;
    $$('.showtime-btn').forEach(b => b.classList.remove('selected'));
    const btn = $(`#showtime-btn-${id}`);
    if (btn) btn.classList.add('selected');
    const bookBtn = $('#book-now-btn');
    if (bookBtn) bookBtn.disabled = false;
    showToast('Đã chọn suất chiếu. Nhấn "Chọn ghế" để tiếp tục.', 'info', 2000);
  }

  const bookBtn = $('#book-now-btn');
  if (bookBtn) {
    bookBtn.disabled = true;
    bookBtn.addEventListener('click', () => {
      if (!APP_STATE.selectedShowtimeId) {
        showToast('Vui lòng chọn suất chiếu!', 'error');
        return;
      }
      navigate('seats.html');
    });
  }
}

/* ============================================================
   SEATS PAGE — Sơ đồ ghế
   ============================================================ */
async function initSeatsPage() {
  const showtimeId = APP_STATE.selectedShowtimeId;
  if (!showtimeId) { navigate('index.html'); return; }

  let showtime = null;
  let seats = [];
  const selected = new Set(APP_STATE.selectedSeatIds);

  try {
    const [stRes, seatsRes] = await Promise.all([
      fetch(`/api/showtimes/${showtimeId}`),
      fetch(`/api/showtimes/${showtimeId}/seats`)
    ]);

    if (!stRes.ok || !seatsRes.ok) throw new Error('Không thể tải dữ liệu sơ đồ ghế.');

    showtime = await stRes.json();
    seats = await seatsRes.json();
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  document.title = `Chọn ghế — ${showtime.movie_title || ''} — TKPM Cinema`;

  // Showtime info
  const infoEl = $('#showtime-info');
  const fmt = DEMO_DATA.formatDatetime(showtime.start_time);
  if (infoEl) {
    infoEl.innerHTML = `
      <span class="badge badge--red">🎬 ${showtime.movie_title}</span>
      <span class="badge badge--gray">📅 ${fmt.full}</span>
      <span class="badge badge--gray">🏛️ ${showtime.cinema_name} — ${showtime.room_name}</span>
      <span class="badge badge--gold">💰 ${DEMO_DATA.formatPrice(showtime.price)}/ghế</span>
    `;
  }

  // Build seat grid
  const seatGridEl = $('#seat-grid');
  if (!seatGridEl) return;
  seatGridEl.innerHTML = '';

  const byRow = {};
  for (const s of seats) {
    if (!byRow[s.seat_row]) byRow[s.seat_row] = [];
    byRow[s.seat_row].push(s);
  }

  for (const [row, rowSeats] of Object.entries(byRow)) {
    const rowEl = el('div', { class: 'seat-row' },
      el('span', { class: 'seat-row-label', 'aria-hidden': 'true' }, row)
    );
    for (const seat of rowSeats) {
      const isBooked   = seat.is_booked; // Dữ liệu từ API
      const isSelected = selected.has(seat.id);
      let cls = 'seat';
      if (seat.seat_type === 'vip')    cls += ' seat--vip';
      if (seat.seat_type === 'couple') cls += ' seat--couple';
      if (isBooked)   cls += ' seat--booked';
      if (isSelected) cls += ' seat--selected';
      if (!isBooked && !isSelected) cls += ' seat--available-seat';

      const seatEl = el('button', {
        class: cls,
        'aria-label': `Hàng ${row}, ghế số ${seat.seat_number}${isBooked ? ' (đã đặt)' : ''}`,
        'aria-pressed': isSelected ? 'true' : 'false',
        'data-seat-id': String(seat.id),
        disabled: isBooked ? '' : undefined,
        onclick: isBooked ? undefined : () => toggleSeat(seat),
      }, isBooked ? '' : String(seat.seat_number));

      rowEl.appendChild(seatEl);
    }
    seatGridEl.appendChild(rowEl);
  }

  function toggleSeat(seat) {
    if (selected.has(seat.id)) {
      selected.delete(seat.id);
    } else {
      if (selected.size >= 8) {
        showToast('Tối đa 8 ghế mỗi lần đặt!', 'error');
        return;
      }
      selected.add(seat.id);
    }
    APP_STATE.selectedSeatIds = [...selected];
    updateSeatUI(seat.id, selected.has(seat.id));
    updateSummary();
  }

  function updateSeatUI(seatId, isNow) {
    const btn = $(`[data-seat-id="${seatId}"]`, seatGridEl);
    if (!btn) return;
    
    if (isNow) {
      btn.classList.add('seat--selected');
      btn.classList.remove('seat--available-seat');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('seat--selected');
      btn.classList.add('seat--available-seat');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  function updateSummary() {
    const panel = $('#booking-panel');
    if (!panel) return;
    const count = selected.size;
    const total = count * showtime.price;
    const seatsLabel = seats.filter(s => selected.has(s.id))
      .map(s => `${s.seat_row}${s.seat_number}`)
      .join(', ') || '—';

    const countEl = panel.querySelector('#summary-count');
    const seatsEl = panel.querySelector('#summary-seats');
    const totalEl = panel.querySelector('#summary-total');
    if (countEl) countEl.textContent = count;
    if (seatsEl) seatsEl.textContent = seatsLabel;
    if (totalEl) totalEl.textContent = DEMO_DATA.formatPrice(total);

    const proceedBtn = $('#proceed-btn');
    if (proceedBtn) proceedBtn.disabled = count === 0;
  }

  // Nút "Quay lại chọn suất" (Task 10): CSP `script-src 'self'` không cho phép
  // href với scheme "javascript", nên handler được gắn ở đây thay vì inline.
  const backBtn = $('#back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', (event) => {
      // Chỉ can thiệp khi thực sự có lịch sử điều hướng; nếu không thì để href
      // mặc định (movie.html) hoạt động như fallback.
      if (window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });
  }

  // Proceed button
  const proceedBtn = $('#proceed-btn');
  if (proceedBtn) {
    proceedBtn.disabled = true;
    proceedBtn.addEventListener('click', async () => {
      if (APP_STATE.selectedSeatIds.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 ghế!', 'error');
        return;
      }
      
      proceedBtn.disabled = true;
      proceedBtn.innerHTML = '⏳ Đang giữ chỗ...';

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showtime_id: showtimeId,
            seat_ids: APP_STATE.selectedSeatIds
          })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Lỗi đặt vé, vui lòng thử lại.');
        }

        APP_STATE.bookingResult = {
          booking_id: data.booking_id,
          bookingCode: data.booking_code,
          total: data.total_amount
        };
        saveState();
        navigate('checkout.html');

      } catch (err) {
        showToast(err.message, 'error', 4000);
        proceedBtn.disabled = false;
        proceedBtn.innerHTML = 'Tiếp tục thanh toán &rarr;';
        
        setTimeout(() => { window.location.reload(); }, 1500);
      }
    });
  }

  updateSummary();
}

/* ============================================================
   CHECKOUT PAGE — Xác nhận + giả lập thanh toán
   ============================================================ */
async function initCheckoutPage() {
  const { selectedShowtimeId, selectedSeatIds, bookingResult } = APP_STATE;
  if (!selectedShowtimeId || selectedSeatIds.length === 0 || !bookingResult || !bookingResult.booking_id) {
    navigate('seats.html'); return;
  }

  let showtime = null;
  let seats = [];
  try {
    const [stRes, seatsRes] = await Promise.all([
      fetch(`/api/showtimes/${selectedShowtimeId}`),
      fetch(`/api/showtimes/${selectedShowtimeId}/seats`)
    ]);
    if (!stRes.ok || !seatsRes.ok) throw new Error('Không thể tải chi tiết suất chiếu.');
    showtime = await stRes.json();
    seats = await seatsRes.json();
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  const fmt = DEMO_DATA.formatDatetime(showtime.start_time);
  const chosenSeats = seats.filter(s => selectedSeatIds.includes(s.id));
  const total = bookingResult.total;

  document.title = 'Thanh toán — TKPM Cinema';

  // Order info
  const tbody = $('#order-tbody');
  if (tbody && showtime) {
    tbody.innerHTML = '';
    for (const s of chosenSeats) {
      const typeLabel = { standard: 'Thường', vip: 'VIP', couple: 'Couple' }[s.seat_type] || s.seat_type;
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>Ghế ${s.seat_row}${s.seat_number} <span class="badge badge--gray" style="margin-left:4px">${typeLabel}</span></td>
          <td>${showtime.movie_title || ''}</td>
          <td>${fmt.time || ''} — ${fmt.date || ''}</td>
          <td class="text-right font-semibold">${DEMO_DATA.formatPrice(showtime.price)}</td>
        </tr>
      `);
    }
    // Total row
    tbody.insertAdjacentHTML('beforeend', `
      <tr class="total-row">
        <td colspan="3" class="font-bold">Tổng cộng</td>
        <td class="text-right text-brand font-bold">${DEMO_DATA.formatPrice(total)}</td>
      </tr>
    `);
  }

  // Booking summary sidebar
  const sideEl = $('#checkout-summary');
  if (sideEl && showtime) {
    sideEl.innerHTML = `
      <div class="booking-panel__row"><span>Phim</span><span class="font-semibold text-right" style="max-width:55%">${showtime.movie_title}</span></div>
      <div class="booking-panel__row"><span>Suất chiếu</span><span>${fmt.time}</span></div>
      <div class="booking-panel__row"><span>Ngày</span><span>${fmt.date}</span></div>
      <div class="booking-panel__row"><span>Rạp</span><span class="text-right" style="max-width:55%">${showtime.cinema_name}</span></div>
      <div class="booking-panel__row"><span>Phòng</span><span>${showtime.room_name}</span></div>
      <div class="booking-panel__row"><span>Ghế</span><span>${chosenSeats.map(s=>`${s.seat_row}${s.seat_number}`).join(', ')}</span></div>
      <div class="booking-panel__row booking-panel__row--total"><span>Tổng tiền</span><span class="text-brand">${DEMO_DATA.formatPrice(total)}</span></div>
    `;
  }

  // Payment method selection
  let selectedMethod = 'e_wallet';
  APP_STATE.selectedPaymentMethod = selectedMethod;
  const methods = $$('.payment-method');
  methods.forEach(m => {
    const radio = m.querySelector('input[type="radio"]');
    if (radio?.value === selectedMethod) {
      m.classList.add('selected');
      if (radio) radio.checked = true;
    }
    m.addEventListener('click', () => {
      methods.forEach(x => x.classList.remove('selected'));
      m.classList.add('selected');
      selectedMethod = m.dataset.method;
      APP_STATE.selectedPaymentMethod = selectedMethod;
      if (radio) radio.checked = true;
    });
  });

  // Pay button
  const payBtn = $('#pay-btn');
  if (payBtn) {
    payBtn.addEventListener('click', () => simulatePayment(total));
  }

  async function simulatePayment(amount) {
    payBtn.disabled = true;
    payBtn.innerHTML = '⏳ Đang xử lý thanh toán (API)...';

    // 80% success rate mock
    const simulateStatus = (!window._forceFailPayment && Math.random() > 0.2) ? 'success' : 'failed';

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingResult.booking_id,
          method: selectedMethod,
          simulate_status: simulateStatus
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thanh toán lỗi.');

      APP_STATE.bookingResult = {
        success: data.success,
        bookingCode: data.success ? bookingResult.bookingCode : null,
        movieTitle: showtime.movie_title,
        showtime: fmt,
        cinema: showtime.cinema_name,
        room: showtime.room_name,
        seats: chosenSeats.map(s => `${s.seat_row}${s.seat_number}`).join(', '),
        total,
        method: selectedMethod,
      };
      saveState();
      navigate('result.html');

    } catch (err) {
      showToast(err.message, 'error', 4000);
      payBtn.disabled = false;
      payBtn.innerHTML = 'Xác nhận &amp; Thanh toán';
    }
  }
}

/* ============================================================
   RESULT PAGE — Thành công / Thất bại
   ============================================================ */
function initResultPage() {
  const result = APP_STATE.bookingResult;
  if (!result) { navigate('index.html'); return; }

  document.title = result.success ? 'Đặt vé thành công — TKPM Cinema' : 'Thanh toán thất bại — TKPM Cinema';

  const icon = $('#result-icon');
  if (icon) {
    icon.className = `result-icon result-icon--${result.success ? 'success' : 'fail'}`;
    icon.textContent = result.success ? '✅' : '❌';
  }

  const title = $('#result-title');
  if (title) title.textContent = result.success ? 'Đặt vé thành công!' : 'Thanh toán thất bại';

  const desc = $('#result-desc');
  if (desc) {
    desc.textContent = result.success
      ? 'Cảm ơn bạn đã đặt vé. Vui lòng lưu mã đặt vé để sử dụng khi vào rạp.'
      : 'Giao dịch không thành công. Ghế không bị giữ. Vui lòng thử lại.';
  }

  // Update ticket header/badge for fail state
  if (!result.success) {
    const headerBar = $('#ticket-header-bar');
    if (headerBar) headerBar.style.background = 'linear-gradient(135deg,var(--danger),var(--brand-red-dark))';
    const badge = $('#ticket-status-badge');
    if (badge) { badge.textContent = '❌ Thất bại'; badge.className = 'badge badge--red'; }
  }

  const ticketEl = $('#ticket-section');
  if (ticketEl) {
    if (result.success) {
      ticketEl.innerHTML = `
        <div class="ticket-code">
          <div class="ticket-code__label">Mã đặt vé</div>
          <div class="ticket-code__value" id="booking-code">${result.bookingCode}</div>
        </div>
        <div class="ticket-row"><span class="ticket-row__label">Phim</span><span class="ticket-row__value">${result.movieTitle}</span></div>
        <div class="ticket-row"><span class="ticket-row__label">Suất chiếu</span><span class="ticket-row__value">${result.showtime?.full || ''}</span></div>
        <div class="ticket-row"><span class="ticket-row__label">Rạp</span><span class="ticket-row__value">${result.cinema}</span></div>
        <div class="ticket-row"><span class="ticket-row__label">Phòng</span><span class="ticket-row__value">${result.room}</span></div>
        <div class="ticket-row"><span class="ticket-row__label">Ghế</span><span class="ticket-row__value">${result.seats}</span></div>
        <div class="ticket-row"><span class="ticket-row__label">Số tiền</span><span class="ticket-row__value text-brand">${DEMO_DATA.formatPrice(result.total)}</span></div>
      `;
    } else {
      ticketEl.innerHTML = `
        <div style="text-align:center;padding:1.5rem;color:var(--text-muted)">
          <p>Giao dịch thất bại. Không có vé nào được xác nhận.</p>
          <p style="margin-top:.5rem;font-size:.875rem">Các ghế bạn đã chọn hiện <strong style="color:var(--success)">vẫn còn trống</strong> và chưa bị giữ.</p>
        </div>
      `;
    }
  }

  // Action buttons
  const retryBtn = $('#retry-btn');
  if (retryBtn) {
    if (result.success) {
      retryBtn.textContent = '🎬 Đặt vé thêm';
      retryBtn.className = 'btn btn--secondary';
    } else {
      retryBtn.textContent = '🔄 Thử lại';
      retryBtn.className = 'btn btn--primary';
    }
    retryBtn.addEventListener('click', () => {
      if (result.success) {
        APP_STATE.selectedSeatIds = [];
        APP_STATE.bookingResult = null;
        navigate('index.html');
      } else {
        APP_STATE.bookingResult = null;
        navigate('seats.html');
      }
    });
  }

  const homeBtn = $('#home-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      APP_STATE.selectedSeatIds = [];
      APP_STATE.bookingResult = null;
      navigate('index.html');
    });
  }
}

/* ============================================================
   Router — khởi động trang tương ứng
   ============================================================ */
function init() {
  loadState();
  initNavbar();
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page === 'index.html' || page === '' || page === '/') initIndexPage();
  else if (page === 'movie.html')    initMoviePage();
  else if (page === 'seats.html')    initSeatsPage();
  else if (page === 'checkout.html') initCheckoutPage();
  else if (page === 'result.html')   initResultPage();
}

document.addEventListener('DOMContentLoaded', init);
