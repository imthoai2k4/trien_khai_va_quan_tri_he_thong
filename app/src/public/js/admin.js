'use strict';

const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');

function formatPrice(num) {
  return new Intl.NumberFormat('vi-VN').format(num || 0);
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('vi-VN');
}

// Kiểm tra token khi load trang
const token = sessionStorage.getItem('admin_token');
if (token) {
  showDashboard();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn = document.getElementById('login-submit-btn');

  btn.disabled = true;
  btn.textContent = 'Đang xử lý...';
  loginError.textContent = '';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi đăng nhập');

    if (data.user.role !== 'admin') {
      throw new Error('Tài khoản không có quyền Admin');
    }

    sessionStorage.setItem('admin_token', data.token);
    showDashboard();
  } catch (err) {
    loginError.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đăng nhập';
  }
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('admin_token');
  loginSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  logoutBtn.classList.add('hidden');
});

async function showDashboard() {
  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');

  await fetchDashboardStats();
}

async function fetchDashboardStats() {
  const token = sessionStorage.getItem('admin_token');
  if (!token) return;

  try {
    const res = await fetch('/api/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('admin_token');
      alert('Phiên đăng nhập hết hạn hoặc không có quyền.');
      window.location.reload();
      return;
    }

    const data = await res.json();
    
    document.getElementById('stat-bookings').textContent = formatPrice(data.stats.total_bookings);
    document.getElementById('stat-revenue').textContent = formatPrice(data.stats.total_revenue);

    const tbody = document.getElementById('recent-bookings-tbody');
    tbody.innerHTML = '';

    if (data.recentBookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Chưa có giao dịch nào.</td></tr>';
      return;
    }

    data.recentBookings.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge badge--gray">${b.booking_code}</span></td>
        <td>${b.user_name}</td>
        <td>${formatDate(b.created_at)}</td>
        <td class="text-right text-brand font-semibold">${formatPrice(b.total_amount)}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}
