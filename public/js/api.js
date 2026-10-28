/**
 * Cliente de Conexión a la API REST de NIJI Perú
 */
const API = (() => {
  const BASE_URL = '/api';

  function getToken() {
    return localStorage.getItem('niji_token');
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem('niji_token', token);
    } else {
      localStorage.removeItem('niji_token');
    }
  }

  function getCurrentUser() {
    try {
      const u = localStorage.getItem('niji_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem('niji_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('niji_user');
    }
  }

  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Token expirado o inválido
          if (token && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/admin-login')) {
            showToast('Tu sesión ha expirado. Por favor ingresa nuevamente.', 'error');
            logout();
          }
        }
        throw new Error(data.message || 'Error en la petición al servidor.');
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  return {
    getToken,
    setToken,
    getCurrentUser,
    setCurrentUser,

    // Auth
    register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    loginClient: (pseudonym, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ pseudonym, password }) }),
    loginAdmin: (pseudonym, password) => request('/auth/admin-login', { method: 'POST', body: JSON.stringify({ pseudonym, password }) }),
    getMe: () => request('/auth/me', { method: 'GET' }),

    // Ruleta
    getWheelPrizes: () => request('/wheel/prizes', { method: 'GET' }),
    spinWheel: () => request('/wheel/spin', { method: 'POST' }),

    // Tarjeta de Sellos (Cliente)
    getMyCard: () => request('/stamps/my-card', { method: 'GET' }),

    // Promociones
    getActivePromotions: () => request('/promotions/active', { method: 'GET' }),
    getAdminPromotions: () => request('/admin/promotions', { method: 'GET' }),
    createPromotion: (payload) => request('/admin/promotions', { method: 'POST', body: JSON.stringify(payload) }),
    deletePromotion: (id) => request(`/admin/promotions/${id}`, { method: 'DELETE' }),

    // Administración
    getAdminMetrics: () => request('/admin/metrics', { method: 'GET' }),
    searchClients: (q = '') => request(`/admin/clients?q=${encodeURIComponent(q)}`, { method: 'GET' }),
    getClientDetail: (id) => request(`/admin/clients/${id}`, { method: 'GET' }),
    addStamp: (payload) => request('/admin/stamps/add', { method: 'POST', body: JSON.stringify(payload) }),
    resetClientCard: (payload) => request('/admin/stamps/reset', { method: 'POST', body: JSON.stringify(payload) }),
    redeemCoupon: (payload) => request('/admin/coupons/redeem', { method: 'POST', body: JSON.stringify(payload) })
  };
})();

/**
 * Mostrar notificaciones Toast interactivas
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `
    <span class="text-base">${icon}</span>
    <span class="font-medium">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.9)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
