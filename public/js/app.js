/**
 * NIJI Perú Loyalty App - Router y Lógica de Vistas (SPA / PWA)
 * Identidad Pastel Claro Oficial: niji Gu
 */

let currentView = '';
let activeRoulette = null;
let currentClientDetail = null;

document.addEventListener('DOMContentLoaded', () => {
  setupViewModeToggle();
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
});

function setupViewModeToggle() {
  const toggleBtn = document.getElementById('toggle-frame-btn');
  const icon = document.getElementById('frame-btn-icon');
  const text = document.getElementById('frame-btn-text');

  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('mobile-frame-active');
    const isFrame = document.body.classList.contains('mobile-frame-active');
    icon.textContent = isFrame ? '📱' : '💻';
    text.textContent = isFrame ? 'Modo Móvil' : 'Pantalla Completa';
  });
}

function navigateTo(hash) {
  window.location.hash = hash;
}

function openLoyaltyApp() {
  const user = API.getCurrentUser();
  if (!user) {
    navigateTo('#login');
  } else if (user.role === 'admin') {
    navigateTo('#admin-dashboard');
  } else if (user.has_spun_wheel === 0) {
    navigateTo('#ruleta');
  } else {
    navigateTo('#tarjeta');
  }
}

function goToHome() {
  navigateTo('#inicio');
}

function logout() {
  API.setToken(null);
  API.setCurrentUser(null);
  updateNavbar();
  showToast('Has cerrado sesión correctamente.', 'info');
  navigateTo('#inicio');
}

function updateNavbar() {
  const user = API.getCurrentUser();
  const navUser = document.getElementById('nav-user-info');
  const navUsername = document.getElementById('nav-username');
  const roleBadge = document.getElementById('role-badge');
  const loyaltyBtn = document.getElementById('header-loyalty-btn');
  const loyaltyIcon = document.getElementById('header-loyalty-icon');
  const loyaltyText = document.getElementById('header-loyalty-text');

  const isLanding = (!currentView || currentView === '#' || currentView === '#inicio');

  if (user) {
    if (navUser) navUser.classList.remove('hidden');
    if (navUsername) navUsername.textContent = `@${user.pseudonym}`;

    if (roleBadge) {
      if (user.role === 'admin') {
        roleBadge.textContent = 'CAJERO / ADMIN';
        roleBadge.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 border border-teal-200';
      } else {
        roleBadge.textContent = 'MIEMBRO VIP';
        roleBadge.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200';
      }
    }
  } else {
    if (navUser) navUser.classList.add('hidden');
    if (roleBadge) {
      roleBadge.textContent = 'INVITADO';
      roleBadge.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200';
    }
  }

  if (loyaltyBtn && loyaltyIcon && loyaltyText) {
    if (isLanding) {
      loyaltyIcon.textContent = user ? (user.role === 'admin' ? '🛡️' : '⭐') : '🎁';
      loyaltyText.textContent = user ? (user.role === 'admin' ? 'Panel Tienda' : 'Mi Tarjeta') : 'Club de Fidelización';
      loyaltyBtn.onclick = openLoyaltyApp;
      loyaltyBtn.className = 'bg-gradient-to-r from-[#ff4d5a] via-[#ff7e29] to-[#f59e0b] text-white px-3.5 py-1.5 rounded-full text-xs font-black shadow-sm hover:shadow-md hover:brightness-105 transition flex items-center gap-1.5 cursor-pointer';
    } else {
      loyaltyIcon.textContent = '🏠';
      loyaltyText.textContent = 'Ver Menú / Tienda';
      loyaltyBtn.onclick = () => navigateTo('#inicio');
      loyaltyBtn.className = 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-black transition flex items-center gap-1.5 cursor-pointer';
    }
  }
}

function setViewportMode(isLanding) {
  const mainViewport = document.getElementById('main-viewport');
  const subheader = document.getElementById('mobile-app-subheader');
  const frameBtn = document.getElementById('toggle-frame-btn');
  const appView = document.getElementById('app-view');

  // Adaptación fluida real a cualquier pantalla (móvil, tablet o PC) sin marco artificial
  document.body.classList.remove('mobile-frame-active');
  if (mainViewport) {
    mainViewport.className = 'landing-viewport';
  }
  if (frameBtn) frameBtn.classList.add('hidden');
  if (subheader) subheader.classList.add('hidden');

  if (isLanding) {
    if (appView) appView.className = 'flex-1 flex flex-col';
  } else {
    if (appView) appView.className = 'p-3 sm:p-6 flex-1 flex flex-col justify-start';
  }
}

async function handleRoute() {
  const hash = window.location.hash || '#inicio';
  currentView = hash;
  const isLanding = (hash === '#inicio' || hash === '#' || hash === '');
  setViewportMode(isLanding);
  updateNavbar();

  const user = API.getCurrentUser();
  const appView = document.getElementById('app-view');

  if (hash.startsWith('#admin-') && (!user || user.role !== 'admin') && hash !== '#admin-login') {
    showToast('Debes iniciar sesión como administrador/cajero.', 'error');
    navigateTo('#admin-login');
    return;
  }

  if ((hash === '#tarjeta' || hash === '#ruleta') && (!user || user.role !== 'client')) {
    showToast('Inicia sesión con tu cuenta de cliente para acceder.', 'info');
    navigateTo('#login');
    return;
  }

  if (isLanding) {
    await renderLandingPageView(appView);
  } else if (hash === '#login') {
    renderClientLoginView(appView);
  } else if (hash === '#registro') {
    renderRegisterView(appView);
  } else if (hash === '#ruleta') {
    renderRouletteView(appView);
  } else if (hash === '#tarjeta') {
    await renderStampCardView(appView);
  } else if (hash === '#admin-login') {
    renderAdminLoginView(appView);
  } else if (hash === '#admin-dashboard') {
    await renderAdminDashboardView(appView);
  } else if (hash.startsWith('#admin-cliente/')) {
    const clientId = hash.split('/')[1];
    await renderClientDetailAdminView(appView, clientId);
  } else {
    await renderLandingPageView(appView);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCategoryEmoji(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('cuchare')) return '🍨';
  if (c.includes('raspa')) return '🍧';
  if (c.includes('postre') || c.includes('mochi')) return '🍡';
  if (c.includes('bebida') || c.includes('jugo')) return '🧋';
  return '🍬';
}

function compressImageFile(file, maxSize = 640, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

let landingState = {
  storeInfo: null,
  products: [],
  promotions: [],
  selectedCategory: 'Todos'
};

/* ==========================================================================
   VISTA 0: LANDING PAGE COMERCIAL NIJI PERÚ (CATÁLOGO, PRECIOS, WSP Y MAPA)
   ========================================================================== */
function buildWhatsAppUrl(waValue, textMsg = '') {
  const val = String(waValue || 'https://wa.me/message/5WW2JMTOWA47J1').trim();
  if (/^https?:\/\//i.test(val)) {
    return val;
  }
  const digits = val.replace(/\D/g, '') || '51999999999';
  return textMsg ? `https://wa.me/${digits}?text=${encodeURIComponent(textMsg)}` : `https://wa.me/${digits}`;
}

async function renderLandingPageView(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-24 text-slate-400">
      <div class="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-3"></div>
      <p class="text-xs font-bold">Cargando carta y promociones de NIJI Perú...</p>
    </div>
  `;

  try {
    const data = await API.getLandingData();
    landingState.storeInfo = data.storeInfo || {};
    landingState.products = data.products || [];
    landingState.promotions = data.promotions || [];
    landingState.selectedCategory = 'Todos';

    const info = landingState.storeInfo;
    const products = landingState.products;
    const promos = landingState.promotions;

    const waRaw = info.whatsapp_number || 'https://wa.me/message/5WW2JMTOWA47J1';
    const waBaseUrl = buildWhatsAppUrl(waRaw, info.whatsapp_message || '¡Hola NIJI Perú! Quisiera hacer un pedido.');
    const mapsQuery = encodeURIComponent(info.maps_query || info.address || 'Niji Perú, Piura 20009');
    const mapsEmbedUrl = `https://maps.google.com/maps?q=${mapsQuery}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    const mapsExternalUrl = (info.maps_url && info.maps_url.trim()) ? info.maps_url.trim() : `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

    // Obtener categorías únicas
    const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category || 'Otros')))];

    const promosSectionHTML = promos.length > 0 ? `
      <section class="px-4 sm:px-6 py-4">
        <div class="bg-gradient-to-r from-orange-50 via-rose-50 to-amber-50 border border-orange-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📢</span>
              <div>
                <h2 class="text-lg sm:text-xl font-black text-slate-900">Promociones Vigentes</h2>
                <p class="text-xs text-slate-500 font-medium">¡Aprovecha estas ofertas por tiempo limitado en tienda!</p>
              </div>
            </div>
            <span class="text-xs font-black text-orange-700 bg-white px-3 py-1 rounded-full border border-orange-200 shadow-2xs">
              ${promos.length} activa${promos.length > 1 ? 's' : ''}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${promos.map(p => `
              <div class="bg-white/95 p-4 rounded-2xl border border-orange-100 shadow-2xs space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${p.tag === 'FLASH' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}">
                    ${escapeHtml(p.tag || 'PROMO')}
                  </span>
                  <span class="text-[11px] font-bold text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                    ${escapeHtml(p.timeRemainingText)}
                  </span>
                </div>
                <h3 class="text-sm sm:text-base font-black text-slate-900">${escapeHtml(p.title)}</h3>
                <p class="text-xs text-slate-600 font-medium leading-relaxed">${escapeHtml(p.message)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    ` : '';

    container.innerHTML = `
      <div class="space-y-8 pb-20">

        <!-- 1. HERO SECTION -->
        <section class="px-4 sm:px-6 pt-6 sm:pt-8">
          <div class="bg-gradient-to-br from-orange-50 via-white to-teal-50 border border-orange-200/70 rounded-3xl p-6 sm:p-10 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div class="md:col-span-7 space-y-4 text-center md:text-left">
              <span class="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-orange-700 bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                <span>🍧</span>
                <span>Cuchareables, Raspadillas &amp; Más</span>
              </span>

              <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                ${escapeHtml(info.hero_title || '¡Endulza tu día con el auténtico sabor kawaii!')}
              </h1>

              <p class="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-xl mx-auto md:mx-0">
                ${escapeHtml(info.hero_subtitle || 'Descubre nuestros cuchareables artesanales, raspadillas refrescantes y postres únicos.')}
              </p>

              <div class="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <button onclick="document.getElementById('menu-catalogo')?.scrollIntoView({ behavior: 'smooth' })" class="btn-primary px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-2 cursor-pointer">
                  <span>🍨</span>
                  <span>Ver Carta y Precios</span>
                </button>

                <a href="${waBaseUrl}" target="_blank" rel="noopener noreferrer" class="bg-[#25D366] hover:bg-[#1ebe5d] text-white px-6 py-3 rounded-2xl text-sm font-black shadow-md hover:shadow-lg transition flex items-center gap-2">
                  <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.375c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.438 1.344-2 1.422-.516.078-1.188.109-1.922-.125-.453-.141-1.031-.344-1.766-.656-3.094-1.328-5.109-4.469-5.266-4.672-.156-.203-1.266-1.688-1.266-3.219s.797-2.281 1.078-2.594c.281-.313.609-.391.813-.391s.406 0 .578.016c.188.016.438-.078.688.516.25.609.859 2.094.938 2.25s.125.344.016.547c-.109.203-.156.328-.313.516-.156.188-.328.422-.469.563-.156.156-.313.328-.141.641.172.313.781 1.281 1.672 2.078 1.156 1.031 2.125 1.344 2.438 1.5s.484.125.672-.078c.188-.203.781-.906.984-1.219s.422-.266.703-.156c.281.109 1.797.844 2.109 1s.516.234.594.359c.078.125.078.734-.172 1.438z"/></svg>
                  <span>Pedir por WhatsApp</span>
                </a>
              </div>
            </div>

            <div class="md:col-span-5 flex justify-center">
              <div class="relative w-56 h-56 sm:w-64 sm:h-64 rounded-3xl bg-white border-4 border-orange-200 shadow-xl p-3 flex items-center justify-center overflow-hidden">
                <img src="${escapeHtml(info.hero_image_url || '/img/niji-logo.png')}" alt="${escapeHtml(info.store_name || 'NIJI Perú')}" class="w-full h-full object-contain rounded-2xl logo-sticker" />
              </div>
            </div>
          </div>
        </section>

        <!-- 2. PROMOCIONES ACTIVAS -->
        ${promosSectionHTML}

        <!-- 3. CATÁLOGO DE PRODUCTOS COMESTIBLES -->
        <section id="menu-catalogo" class="px-4 sm:px-6 space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span class="text-xs font-black uppercase tracking-wider text-teal-700 bg-teal-100 px-2.5 py-0.5 rounded-full border border-teal-200">
                Nuestra Carta
              </span>
              <h2 class="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Productos Comestibles</h2>
              <p class="text-xs sm:text-sm text-slate-500 font-medium">Elige tus favoritos y haz tu pedido directo por WhatsApp.</p>
            </div>

            <!-- Filtros de Categoría -->
            <div id="landing-category-filters" class="flex items-center gap-2 overflow-x-auto pb-1">
              ${categories.map(cat => `
                <button onclick="filterLandingCategory('${escapeHtml(cat)}')" data-cat="${escapeHtml(cat)}" class="landing-cat-btn px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${cat === 'Todos' ? 'bg-orange-500 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-300'}">
                  ${cat === 'Todos' ? '✨ Todos' : `${getCategoryEmoji(cat)} ${escapeHtml(cat)}`}
                </button>
              `).join('')}
            </div>
          </div>

          <div id="landing-products-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            ${renderLandingProductCards(products, waRaw)}
          </div>
        </section>

        <!-- 4. INVITACIÓN OPCIONAL AL CLUB DE FIDELIZACIÓN -->
        <section class="px-4 sm:px-6">
          <div class="bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-5 shadow-xs">
            <div class="flex items-center gap-4 text-center md:text-left flex-col sm:flex-row">
              <div class="w-14 h-14 rounded-2xl bg-white border border-orange-200 shadow-xs flex items-center justify-center text-3xl shrink-0">
                🎁
              </div>
              <div>
                <h3 class="text-lg sm:text-xl font-black text-slate-900">¿Ya eres parte del Club de Fidelización NIJI?</h3>
                <p class="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                  Regístrate gratis para girar la ruleta de bienvenida y acumular <strong>1 sello por cada S/ 5</strong> de consumo. ¡5 sellos = premio gratis!
                </p>
              </div>
            </div>
            <button onclick="openLoyaltyApp()" class="btn-primary px-6 py-3 rounded-2xl text-sm font-black whitespace-nowrap shrink-0 cursor-pointer">
              ⭐ Ir al Club de Fidelización
            </button>
          </div>
        </section>

        <!-- 5. UBICACIÓN, MAPA Y CONTACTO -->
        <section id="ubicacion-contacto" class="px-4 sm:px-6">
          <div class="glass-panel rounded-3xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            <div class="md:col-span-5 flex flex-col justify-between space-y-5">
              <div class="space-y-4">
                <div>
                  <span class="text-xs font-black uppercase tracking-wider text-orange-700 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
                    Encuéntranos
                  </span>
                  <h2 class="text-2xl font-black text-slate-900 mt-1.5">Visítanos o Contáctanos</h2>
                </div>

                <div class="space-y-3 text-sm">
                  <div class="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span class="text-xl">📍</span>
                    <div>
                      <span class="text-[11px] font-bold text-slate-400 uppercase block">Dirección</span>
                      <span class="font-bold text-slate-800">${escapeHtml(info.address || 'Lima, Perú')}</span>
                    </div>
                  </div>

                  <div class="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span class="text-xl">🕒</span>
                    <div>
                      <span class="text-[11px] font-bold text-slate-400 uppercase block">Horario de Atención</span>
                      <span class="font-bold text-slate-800">${escapeHtml(info.schedule || 'Lun - Dom: 12:00 PM - 9:00 PM')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row md:flex-col gap-2.5">
                <a href="${waBaseUrl}" target="_blank" rel="noopener noreferrer" class="bg-[#25D366] hover:bg-[#1ebe5d] text-white py-3 px-4 rounded-2xl text-sm font-black text-center shadow-sm transition flex items-center justify-center gap-2">
                  <span>💬</span>
                  <span>Escríbenos por WhatsApp</span>
                </a>
                <a href="${mapsExternalUrl}" target="_blank" rel="noopener noreferrer" class="bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 px-4 rounded-2xl text-xs font-black text-center transition flex items-center justify-center gap-2">
                  <span>🗺️</span>
                  <span>Abrir en Google Maps</span>
                </a>
              </div>
            </div>

            <div class="md:col-span-7 min-h-[280px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
              <iframe
                title="Mapa de Ubicación NIJI Perú"
                src="${mapsEmbedUrl}"
                class="w-full h-full min-h-[280px] border-0"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade">
              </iframe>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="text-center text-xs text-slate-400 font-medium pt-2 pb-4">
          © ${new Date().getFullYear()} ${escapeHtml(info.store_name || 'NIJI Perú')} — Todos los derechos reservados.
        </footer>

        <!-- Botón Flotante de WhatsApp -->
        <a href="${waBaseUrl}" target="_blank" rel="noopener noreferrer" title="Contáctanos por WhatsApp" class="fixed bottom-5 right-5 z-40 bg-[#25D366] hover:bg-[#1ebe5d] text-white w-14 h-14 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition flex items-center justify-center">
          <svg class="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.375c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.438 1.344-2 1.422-.516.078-1.188.109-1.922-.125-.453-.141-1.031-.344-1.766-.656-3.094-1.328-5.109-4.469-5.266-4.672-.156-.203-1.266-1.688-1.266-3.219s.797-2.281 1.078-2.594c.281-.313.609-.391.813-.391s.406 0 .578.016c.188.016.438-.078.688.516.25.609.859 2.094.938 2.25s.125.344.016.547c-.109.203-.156.328-.313.516-.156.188-.328.422-.469.563-.156.156-.313.328-.141.641.172.313.781 1.281 1.672 2.078 1.156 1.031 2.125 1.344 2.438 1.5s.484.125.672-.078c.188-.203.781-.906.984-1.219s.422-.266.703-.156c.281.109 1.797.844 2.109 1s.516.234.594.359c.078.125.078.734-.172 1.438z"/></svg>
        </a>

      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="text-center py-20 px-4 space-y-3">
        <p class="text-sm text-rose-500 font-bold">${escapeHtml(err.message || 'No se pudo cargar la página.')}</p>
        <button onclick="handleRoute()" class="btn-primary px-5 py-2.5 rounded-2xl text-xs font-black">Reintentar</button>
      </div>
    `;
  }
}

function renderLandingProductCards(products, waRaw) {
  if (!products || products.length === 0) {
    return `
      <div class="col-span-full text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
        Pronto publicaremos nuevos productos deliciosos en esta categoría.
      </div>
    `;
  }

  return products.map(p => {
    const priceFormatted = `S/ ${Number(p.price || 0).toFixed(2)}`;
    const waLink = buildWhatsAppUrl(waRaw, `¡Hola NIJI Perú! Me gustaría pedir: ${p.name} (${priceFormatted}).`);
    const hasImg = Boolean(p.image_url && p.image_url.trim() !== '');

    return `
      <article class="glass-panel rounded-3xl overflow-hidden flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition duration-200 border border-slate-100">
        <div>
          <div class="h-48 bg-gradient-to-br from-orange-50 via-rose-50 to-teal-50 relative overflow-hidden flex items-center justify-center">
            ${hasImg ? `
              <img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover" />
            ` : `
              <span class="text-6xl select-none">${getCategoryEmoji(p.category)}</span>
            `}
            <span class="absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-slate-800 border border-slate-200/80 shadow-2xs">
              ${escapeHtml(p.category || 'Especial')}
            </span>
            <span class="absolute bottom-3 right-3 text-sm font-black px-3 py-1 rounded-full bg-orange-500 text-white shadow-md">
              ${priceFormatted}
            </span>
          </div>

          <div class="p-4 space-y-1.5">
            <h3 class="text-base font-black text-slate-900 leading-snug">${escapeHtml(p.name)}</h3>
            <p class="text-xs text-slate-600 font-medium leading-relaxed line-clamp-3">
              ${escapeHtml(p.description || 'Preparado artesanalmente con ingredientes seleccionados.')}
            </p>
          </div>
        </div>

        <div class="px-4 pb-4 pt-1">
          <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 rounded-2xl bg-emerald-50 hover:bg-[#25D366] text-emerald-700 hover:text-white border border-emerald-200 hover:border-[#25D366] text-xs font-black transition flex items-center justify-center gap-1.5">
            <span>💬</span>
            <span>Pedir por WhatsApp</span>
          </a>
        </div>
      </article>
    `;
  }).join('');
}

function filterLandingCategory(category) {
  landingState.selectedCategory = category;

  document.querySelectorAll('.landing-cat-btn').forEach(btn => {
    const isSelected = btn.getAttribute('data-cat') === category;
    btn.className = isSelected
      ? 'landing-cat-btn px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer bg-orange-500 text-white shadow-xs'
      : 'landing-cat-btn px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer bg-white text-slate-600 border border-slate-200 hover:border-orange-300';
  });

  const grid = document.getElementById('landing-products-grid');
  if (!grid) return;

  const waRaw = landingState.storeInfo?.whatsapp_number || 'https://wa.me/message/5WW2JMTOWA47J1';
  const filtered = category === 'Todos'
    ? landingState.products
    : landingState.products.filter(p => (p.category || 'Otros') === category);

  grid.innerHTML = renderLandingProductCards(filtered, waRaw);
}

/* ==========================================================================
   VISTA 1: LOGIN CLIENTE (TEMA CLARO PASTEL)
   ========================================================================== */
function renderClientLoginView(container) {
  container.innerHTML = `
    <div class="space-y-5 max-w-md mx-auto w-full my-auto py-4">
      <div class="text-center space-y-1">
        <div class="flex justify-center mb-1">
          <img src="/img/niji-logo.png" alt="Mascota NIJI" class="w-28 h-28 object-contain logo-sticker drop-shadow-md" />
        </div>
        <h2 class="text-2xl font-black text-slate-900 tracking-tight">¡Hola de nuevo!</h2>
        <p class="text-xs text-slate-500 font-medium">Ingresa con tu pseudónimo y contraseña para ver tus sellos.</p>
      </div>

      <form id="login-form" class="space-y-3.5 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Pseudónimo del Cliente</label>
          <div class="relative">
            <span class="absolute left-3.5 top-2.5 text-orange-500 font-black">@</span>
            <input type="text" id="login-pseudonym" required placeholder="ej. sakura_lima" class="glass-input w-full pl-8 pr-4 py-2.5 rounded-2xl text-sm" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Contraseña</label>
          <input type="password" id="login-password" required placeholder="••••••••" class="glass-input w-full px-4 py-2.5 rounded-2xl text-sm" />
        </div>

        <button type="submit" id="btn-login-submit" class="btn-primary w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 mt-2">
          <span>Iniciar Sesión en NIJI</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      </form>

      <div class="text-center pt-2 space-y-1.5">
        <p class="text-xs text-slate-600">
          ¿No tienes una cuenta? 
          <a href="#registro" class="text-orange-600 font-black hover:underline">Regístrate aquí</a>
        </p>

      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login-submit');
    const pseudonym = document.getElementById('login-pseudonym').value.trim();
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Verificando...';

    try {
      const res = await API.loginClient(pseudonym, password);
      API.setToken(res.token);
      API.setCurrentUser(res.user);
      showToast(res.message, 'success');

      if (res.must_spin_wheel) {
        navigateTo('#ruleta');
      } else {
        navigateTo('#tarjeta');
      }
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<span>Iniciar Sesión en NIJI</span>';
    }
  });
}

/* ==========================================================================
   VISTA 2: REGISTRO DE CLIENTE GAMIFICADO
   ========================================================================== */
function renderRegisterView(container) {
  container.innerHTML = `
    <div class="space-y-4 max-w-md mx-auto w-full py-2">
      <div class="text-center space-y-1">
        <div class="flex justify-center mb-0.5">
          <img src="/img/niji-logo.png" alt="Mascota NIJI" class="w-20 h-20 object-contain logo-sticker drop-shadow-sm" />
        </div>
        <h2 class="text-2xl font-black text-slate-900">Únete a NIJI Club</h2>
        <p class="text-xs text-slate-600 font-medium">¡Regístrate hoy y recibe un <strong>giro gratis en la Ruleta Spin-to-Win</strong>!</p>
      </div>

      <form id="register-form" class="space-y-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Pseudónimo <span class="text-orange-500">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3.5 top-2.5 text-orange-500 font-black">@</span>
            <input type="text" id="reg-pseudonym" required placeholder="ej. niji_fan2026" class="glass-input w-full pl-8 pr-4 py-2 rounded-2xl text-sm" />
          </div>
          <p class="text-[10px] text-slate-400 mt-0.5 font-medium">Tu nombre público para acumular sellos.</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Correo Electrónico <span class="text-orange-500">*</span>
          </label>
          <input type="email" id="reg-email" required placeholder="tucorreo@ejemplo.com" class="glass-input w-full px-4 py-2 rounded-2xl text-sm" />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Fecha de Nacimiento <span class="text-orange-500">*</span>
          </label>
          <input type="date" id="reg-birthdate" required class="glass-input w-full px-4 py-2 rounded-2xl text-sm text-slate-800" />
          <p class="text-[10px] text-amber-600 mt-0.5 font-semibold">🎂 Te daremos un beneficio y saludo sorpresa en tu cumpleaños.</p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Contraseña <span class="text-orange-500">*</span>
            </label>
            <input type="password" id="reg-password" required placeholder="Mín. 6 letras" class="glass-input w-full px-3 py-2 rounded-2xl text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Confirmar <span class="text-orange-500">*</span>
            </label>
            <input type="password" id="reg-confirm-password" required placeholder="Repetir" class="glass-input w-full px-3 py-2 rounded-2xl text-sm" />
          </div>
        </div>

        <!-- Checkbox Opt-in de Promociones & Cumpleaños -->
        <div class="p-3 rounded-2xl bg-orange-50/80 border border-orange-200/90 mt-1">
          <label class="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" id="reg-promotions" checked class="mt-0.5 w-4 h-4 text-orange-600 rounded border-orange-300 focus:ring-orange-400 cursor-pointer accent-orange-500" />
            <span class="text-xs text-slate-700 leading-snug font-medium">
              Deseo recibir información de promociones de la empresa y regalos por mi cumpleaños.
            </span>
          </label>
        </div>

        <button type="submit" id="btn-register-submit" class="btn-primary w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 mt-2">
          <span>Crear Cuenta & Girar Ruleta</span>
          <span class="text-lg">🎯</span>
        </button>
      </form>

      <div class="text-center pt-1">
        <p class="text-xs text-slate-600">
          ¿Ya tienes cuenta? 
          <a href="#login" class="text-orange-600 font-black hover:underline">Inicia sesión</a>
        </p>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-register-submit');
    const pseudonym = document.getElementById('reg-pseudonym').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const birthdate = document.getElementById('reg-birthdate').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const acceptsPromotions = document.getElementById('reg-promotions').checked;

    if (password !== confirmPassword) {
      showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Registrando...';

    try {
      const res = await API.register({ 
        pseudonym, 
        email, 
        birthdate, 
        password, 
        confirmPassword,
        accepts_promotions: acceptsPromotions
      });
      API.setToken(res.token);
      API.setCurrentUser(res.user);
      showToast('¡Registro exitoso! ¡Bienvenido a NIJI Perú!', 'success');
      navigateTo('#ruleta');
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<span>Crear Cuenta & Girar Ruleta</span> <span>🎯</span>';
    }
  });
}

/* ==========================================================================
   VISTA 3: RULETA "SPIN-TO-WIN"
   ========================================================================== */
async function renderRouletteView(container) {
  const user = API.getCurrentUser();

  container.innerHTML = `
    <div class="flex flex-col items-center justify-between text-center max-w-md mx-auto w-full py-2 space-y-3">
      <div class="space-y-1">
        <span class="text-[11px] font-black uppercase tracking-widest text-orange-700 bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
          🎁 Regalo de Bienvenida NIJI
        </span>
        <h2 class="text-2xl font-black text-slate-900 mt-1">Ruleta Spin-to-Win</h2>
        <p class="text-xs text-slate-600 font-medium">
          ¡Hola <strong>@${user ? user.pseudonym : 'amigo'}</strong>! Tienes <strong>1 giro único</strong> garantizado de regalo.
        </p>
      </div>

      <!-- Contenedor de Ruleta y Aguja Responsiva -->
      <div class="roulette-container my-1">
        <div class="roulette-pointer">
          <svg viewBox="0 0 34 42" class="w-full h-full filter drop-shadow">
            <polygon points="17,40 4,4 30,4" fill="#ff7e29" stroke="#ffffff" stroke-width="2.5"/>
            <circle cx="17" cy="12" r="5" fill="#f59e0b"/>
          </svg>
        </div>
        <canvas id="roulette-canvas" class="rounded-full shadow-lg cursor-pointer"></canvas>
      </div>

      <!-- Botón de Giro -->
      <div class="w-full space-y-2">
        <button id="btn-spin-wheel" class="btn-primary w-full py-3.5 rounded-2xl text-base font-black tracking-wide flex items-center justify-center gap-2.5 pulse-glow shadow-xl">
          <span class="text-xl">✨</span>
          <span>¡GIRAR RULETA AHORA!</span>
          <span class="text-xl">✨</span>
        </button>

        <p class="text-[10px] text-slate-400 font-medium">
          * Válido al unirse al Club NIJI Perú.
        </p>
      </div>
    </div>

    <!-- Modal de Premio Ganado (Fondo Claro Pastel) -->
    <div id="prize-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50">
      <div class="bg-white p-6 rounded-3xl max-w-xs w-full text-center border-2 border-orange-300 shadow-2xl space-y-4">
        <img src="/img/niji-logo.png" alt="NIJI Ganador" class="w-24 h-24 mx-auto object-contain logo-sticker" />
        <div>
          <span id="modal-status-pill" class="text-xs text-orange-600 font-black uppercase tracking-wider">¡RESULTADO DEL GIRO!</span>
          <h3 id="modal-prize-title" class="text-xl font-black text-slate-900 mt-1">Premio</h3>
          <p id="modal-prize-desc" class="text-xs text-slate-600 mt-1 font-medium leading-relaxed">Descripción del premio</p>
        </div>
        <div id="modal-stamp-badge" class="hidden p-2.5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold">
          ⭐ ¡Se añadió automáticamente 1 sello a tu tarjeta virtual!
        </div>
        <button id="modal-action-btn" class="btn-primary w-full py-3 rounded-2xl text-sm font-black">
          Ver mi Tarjeta de Sellos →
        </button>
      </div>
    </div>
  `;

  try {
    const res = await API.getWheelPrizes();
    const canvas = document.getElementById('roulette-canvas');
    if (!canvas) return;

    activeRoulette = new RouletteWheel('roulette-canvas', {
      prizes: res.prizes
    });

    const spinBtn = document.getElementById('btn-spin-wheel');

    if (user && user.has_spun_wheel === 1) {
      spinBtn.disabled = true;
      spinBtn.innerHTML = '<span>Ya reclamaste tu premio</span>';
      showToast(`Ya reclamaste tu premio: "${user.welcome_prize}". Redirigiendo a tu tarjeta...`, 'info');
      setTimeout(() => navigateTo('#tarjeta'), 2000);
      return;
    }

    spinBtn.addEventListener('click', async () => {
      spinBtn.disabled = true;
      spinBtn.innerHTML = '<span class="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Girando ruleta...';

      try {
        const spinResult = await API.spinWheel();

        activeRoulette.spinTo(spinResult.prizeIndex, (awardedPrize) => {
          const isNone = awardedPrize.type === 'none';
          const isStamp = awardedPrize.type === 'stamp';

          if (isNone) {
            SoundEffects.playTick();
          } else {
            SoundEffects.playVictory();
            Confetti.launch(80);
          }

          const updatedUser = {
            ...user,
            has_spun_wheel: spinResult.hasSpunWheel,
            welcome_prize: awardedPrize.title,
            stamps: spinResult.updatedStamps
          };
          API.setCurrentUser(updatedUser);

          const statusPill = document.getElementById('modal-status-pill');
          const prizeTitle = document.getElementById('modal-prize-title');
          const prizeDesc = document.getElementById('modal-prize-desc');
          const stampBadge = document.getElementById('modal-stamp-badge');
          const actionBtn = document.getElementById('modal-action-btn');

          if (isNone) {
            statusPill.textContent = '🍍 RESULTADO';
            prizeTitle.textContent = '¡Te tocó Piña!';
            prizeDesc.textContent = 'Mala suerte esta vez, no obtuviste premio en la ruleta. ¡Pero tu tarjeta ya está lista para acumular sellos por tus consumos!';
            stampBadge.classList.add('hidden');
            actionBtn.textContent = 'Ir a mi Tarjeta de Sellos →';
            actionBtn.onclick = () => navigateTo('#tarjeta');
          } else if (isStamp) {
            statusPill.textContent = '⭐ ¡PREMIO GANADO!';
            prizeTitle.textContent = awardedPrize.title;
            prizeDesc.textContent = awardedPrize.description || '¡Inicias tu tarjeta con 1 sello acumulado!';
            stampBadge.classList.remove('hidden');
            stampBadge.textContent = '⭐ ¡Se acreditó automáticamente 1 sello en tu tarjeta!';
            actionBtn.textContent = 'Ver mi Tarjeta con el Sello →';
            actionBtn.onclick = () => navigateTo('#tarjeta');
          } else {
            statusPill.textContent = '🎁 ¡PREMIO GANADO!';
            prizeTitle.textContent = awardedPrize.title;
            prizeDesc.textContent = awardedPrize.description;
            stampBadge.classList.remove('hidden');
            stampBadge.textContent = `🎁 Reclama en caja: ${awardedPrize.title}`;
            actionBtn.textContent = 'Ver mi Tarjeta de Sellos →';
            actionBtn.onclick = () => navigateTo('#tarjeta');
          }

          document.getElementById('prize-modal').classList.remove('hidden');
        });

      } catch (err) {
        showToast(err.message, 'error');
        spinBtn.disabled = false;
        spinBtn.innerHTML = '<span>¡GIRAR RULETA AHORA!</span>';
      }
    });

  } catch (err) {
    showToast('Error cargando los premios de la ruleta.', 'error');
  }
}

/* ==========================================================================
   ICONOS SVG KAWAII REDONDEADOS Y AMIGABLES PARA SELLOS
   (Corazón para sellos 1 a 4, Estrella redondeada para meta final 5)
   ========================================================================== */
function getKawaiiHeartIcon(isStamped, num = 1, isMini = false) {
  const size = isMini ? 'w-5 h-5' : 'w-7 h-7';
  if (isStamped) {
    return `
      <svg viewBox="0 0 32 32" class="${size} filter drop-shadow-sm select-none" fill="#ffffff" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">
        <path d="M16 27.2c-.8 0-1.5-.4-2.1-1C9.2 21.6 4 17.2 4 11.8 4 7.5 7.4 4 11.6 4c2.4 0 4.2 1.1 5.4 2.5 1.2-1.4 3-2.5 5.4-2.5 4.2 0 7.6 3.5 7.6 7.8 0 5.4-5.2 9.8-9.9 14.4-.6.6-1.3 1-2.1 1z" />
        <ellipse cx="11.5" cy="10" rx="1.8" ry="1.1" transform="rotate(-30 11.5 10)" fill="rgba(255,255,255,0.7)" />
      </svg>
    `;
  }
  return `
    <div class="relative flex items-center justify-center select-none">
      <svg viewBox="0 0 32 32" class="${size} opacity-40" fill="none" stroke="#94a3b8" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3 3">
        <path d="M16 27.2c-.8 0-1.5-.4-2.1-1C9.2 21.6 4 17.2 4 11.8 4 7.5 7.4 4 11.6 4c2.4 0 4.2 1.1 5.4 2.5 1.2-1.4 3-2.5 5.4-2.5 4.2 0 7.6 3.5 7.6 7.8 0 5.4-5.2 9.8-9.9 14.4-.6.6-1.3 1-2.1 1z" />
      </svg>
      <span class="absolute font-black ${isMini ? 'text-[9px]' : 'text-xs'} text-slate-400">${num}</span>
    </div>
  `;
}

function getKawaiiStarIcon(isStamped, isMini = false) {
  const size = isMini ? 'w-5 h-5' : 'w-7 h-7';
  if (isStamped) {
    return `
      <svg viewBox="0 0 32 32" class="${size} filter drop-shadow-md select-none" fill="#ffffff" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
        <path d="M16 3.8l2.9 6.2c.4.8 1.1 1.3 2 1.4l6.6.9c1.6.2 2.2 2.1 1 3.2l-5 4.6c-.6.6-.9 1.4-.7 2.3l1.3 6.5c.3 1.6-1.4 2.8-2.8 2l-5.8-3.3c-.8-.4-1.7-.4-2.5 0l-5.8 3.3c-1.4.8-3.1-.4-2.8-2l1.3-6.5c.2-.9-.1-1.7-.7-2.3l-5-4.6c-1.2-1.1-.6-3 1-3.2l6.6-.9c.9-.1 1.6-.6 2-1.4L16 3.8z" />
        <circle cx="13" cy="12" r="1.4" fill="rgba(255,255,255,0.75)" />
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 32 32" class="${size} select-none" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3 2">
      <path d="M16 3.8l2.9 6.2c.4.8 1.1 1.3 2 1.4l6.6.9c1.6.2 2.2 2.1 1 3.2l-5 4.6c-.6.6-.9 1.4-.7 2.3l1.3 6.5c.3 1.6-1.4 2.8-2.8 2l-5.8-3.3c-.8-.4-1.7-.4-2.5 0l-5.8 3.3c-1.4.8-3.1-.4-2.8-2l1.3-6.5c.2-.9-.1-1.7-.7-2.3l-5-4.6c-1.2-1.1-.6-3 1-3.2l6.6-.9c.9-.1 1.6-.6 2-1.4L16 3.8z" />
    </svg>
  `;
}

/* ==========================================================================
   VISTA 4: TARJETA DE SELLOS DIGITAL (TEMA CLARO PASTEL)
   ========================================================================== */
async function renderStampCardView(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  `;

  try {
    const data = await API.getMyCard();
    const { card, user, activeCoupon, history } = data;
    const stamps = card.stamps;
    const isCompleted = card.isCompleted;

    API.setCurrentUser({ ...API.getCurrentUser(), stamps });

    // Consultar promociones activas y vigentes
    let promotionsHTML = '';
    try {
      const promoData = await API.getActivePromotions();
      const promos = promoData.promotions || [];

      if (promos.length > 0) {
        promotionsHTML = `
          <div class="space-y-2.5">
            <div class="flex items-center justify-between px-1">
              <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span>📢</span>
                <span>Promociones del Día</span>
              </span>
              <span class="text-[10px] text-orange-600 font-bold bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                ${promos.length} activa${promos.length > 1 ? 's' : ''}
              </span>
            </div>

            <div class="space-y-2">
              ${promos.map(p => `
                <div class="p-3.5 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-teal-50 border border-orange-200/80 shadow-xs space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${p.tag === 'FLASH' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}">
                      ${p.tag || 'PROMO'}
                    </span>
                    <span class="text-[10px] font-bold text-orange-700 bg-white/80 px-2 py-0.5 rounded-full border border-orange-200">
                      ${p.timeRemainingText}
                    </span>
                  </div>
                  <h4 class="text-sm font-black text-slate-900 leading-tight">${p.title}</h4>
                  <p class="text-xs text-slate-600 font-medium leading-relaxed">${p.message}</p>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    } catch (promoErr) {
      console.warn('Error cargando promociones:', promoErr);
    }

    // Saludo especial de cumpleaños
    let birthdayBannerHTML = '';
    if (user.birthdayInfo.isBirthdayToday) {
      birthdayBannerHTML = `
        <div class="p-3.5 rounded-3xl bg-gradient-to-r from-orange-100 via-rose-50 to-teal-50 border-2 border-orange-300 text-xs flex items-center gap-3 shadow-xs">
          <span class="text-3xl">🎂</span>
          <div>
            <h4 class="font-black text-orange-900 text-sm">¡FELIZ CUMPLEAÑOS, @${user.pseudonym}!</h4>
            <p class="text-slate-700 text-[11px] mt-0.5 font-medium">${user.birthdayInfo.greetingMessage}</p>
          </div>
        </div>
      `;
    } else if (user.birthdayInfo.isBirthdayMonth) {
      birthdayBannerHTML = `
        <div class="p-3 rounded-2xl bg-teal-50 border border-teal-200 text-xs flex items-center gap-3 shadow-xs">
          <span class="text-2xl">🎉</span>
          <div>
            <h4 class="font-bold text-teal-800">¡Mes de tu Cumpleaños!</h4>
            <p class="text-slate-600 text-[11px] mt-0.5 font-medium">${user.birthdayInfo.greetingMessage}</p>
          </div>
        </div>
      `;
    }

    // Casilleros de los 5 sellos (Sellos 1-4: Corazón redondeado kawaii, Sello 5: Estrella redondeada)
    let stampSlotsHTML = '';
    for (let i = 1; i <= 5; i++) {
      const isStamped = i <= stamps;
      const isGoal = i === 5;

      if (isGoal) {
        // El 5to sello (Meta Final): Estrella redondeada amigable
        stampSlotsHTML += `
          <div class="flex flex-col items-center gap-1.5">
            <div class="stamp-slot slot-goal ${isStamped ? 'stamped' : 'empty'} relative">
              ${getKawaiiStarIcon(isStamped, false)}
            </div>
            <span class="text-[10px] font-black ${isStamped ? 'text-amber-600' : 'text-amber-700/80'} flex items-center gap-1">
              <span>⭐</span> Meta
            </span>
          </div>
        `;
      } else {
        // Primeros 4 sellos regulares: Corazones redondeados y amigables
        stampSlotsHTML += `
          <div class="flex flex-col items-center gap-1.5">
            <div class="stamp-slot ${isStamped ? 'stamped' : 'empty'}">
              ${getKawaiiHeartIcon(isStamped, i, false)}
            </div>
            <span class="text-[10px] font-bold ${isStamped ? 'text-rose-600' : 'text-slate-400'}">
              Sello ${i}
            </span>
          </div>
        `;
      }
    }

    // Sección de Cupón Digital cuando se completan los 5 sellos
    let rewardSectionHTML = '';
    if (isCompleted && activeCoupon) {
      rewardSectionHTML = `
        <div class="digital-coupon p-5 rounded-3xl border-2 border-orange-400 space-y-3 mt-4">
          <div class="flex items-center justify-between">
            <span class="text-[10px] uppercase tracking-wider font-black text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
              Cupón Digital Activo
            </span>
            <span class="text-[11px] text-teal-700 font-bold">Válido en Caja</span>
          </div>

          <div class="text-center py-1">
            <h3 class="text-base font-black text-slate-900">${activeCoupon.title}</h3>
            <p class="text-xs text-slate-600 mt-1 font-medium">${activeCoupon.description}</p>
          </div>

          <!-- Código y Código de Barras Visual -->
          <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center space-y-2">
            <div class="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">Código de Recompensa:</div>
            <div class="text-2xl font-mono font-black text-orange-600 tracking-wider">${activeCoupon.code}</div>
            
            <div class="w-full flex justify-center py-1 opacity-90">
              <svg class="h-9 w-48" viewBox="0 0 100 24">
                <rect x="2" y="0" width="3" height="24" fill="#0f172a"/>
                <rect x="7" y="0" width="1" height="24" fill="#0f172a"/>
                <rect x="10" y="0" width="4" height="24" fill="#0f172a"/>
                <rect x="16" y="0" width="2" height="24" fill="#0f172a"/>
                <rect x="20" y="0" width="5" height="24" fill="#0f172a"/>
                <rect x="27" y="0" width="1" height="24" fill="#0f172a"/>
                <rect x="30" y="0" width="3" height="24" fill="#0f172a"/>
                <rect x="35" y="0" width="6" height="24" fill="#0f172a"/>
                <rect x="43" y="0" width="2" height="24" fill="#0f172a"/>
                <rect x="47" y="0" width="4" height="24" fill="#0f172a"/>
                <rect x="53" y="0" width="1" height="24" fill="#0f172a"/>
                <rect x="56" y="0" width="5" height="24" fill="#0f172a"/>
                <rect x="63" y="0" width="3" height="24" fill="#0f172a"/>
                <rect x="68" y="0" width="2" height="24" fill="#0f172a"/>
                <rect x="72" y="0" width="4" height="24" fill="#0f172a"/>
                <rect x="78" y="0" width="1" height="24" fill="#0f172a"/>
                <rect x="81" y="0" width="6" height="24" fill="#0f172a"/>
                <rect x="89" y="0" width="2" height="24" fill="#0f172a"/>
                <rect x="93" y="0" width="4" height="24" fill="#0f172a"/>
              </svg>
            </div>
          </div>

          <div class="p-2.5 rounded-2xl bg-orange-50 border border-orange-200 text-[11px] text-orange-900 text-center font-medium">
            📍 <strong>Presenta este cupón al cajero</strong> para canjear tu recompensa.
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="space-y-4 max-w-xl mx-auto w-full py-2">
        
        <!-- Saludo e Identidad -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <img src="/img/niji-logo.png" alt="NIJI" class="w-11 h-11 object-contain drop-shadow-sm" />
            <div>
              <h2 class="text-xl font-black text-slate-900 leading-tight">¡Hola, @${user.pseudonym}!</h2>
              <p class="text-xs text-orange-600 font-bold">Cliente VIP NIJI Club</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs font-mono font-black text-orange-700 bg-orange-100 px-3 py-1 rounded-full border border-orange-200 shadow-xs">
              ${stamps}/5 Sellos
            </span>
          </div>
        </div>

        ${birthdayBannerHTML}

        <!-- Promociones y Avisos Programados desde el Panel de Tienda -->
        ${promotionsHTML}

        <!-- Tarjeta Virtual de 5 Casilleros -->
        <div class="stamp-card-vip p-5 rounded-3xl ${isCompleted ? 'card-locked' : ''}">
          <div class="flex items-center justify-between pb-3 border-b border-orange-200/60">
            <div class="flex items-center gap-1.5">
              <span class="brand-logo-title text-base font-black">
                <span class="text-[#ff4d5a]">N</span><span class="text-[#ff7e29]">I</span><span class="text-[#f59e0b]">J</span><span class="text-[#0d9488]">I</span>
              </span>
              <span class="text-xs font-black text-slate-800 tracking-wider ml-1">VIP CARD</span>
            </div>
            <span class="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white text-orange-700 border border-orange-200 shadow-2xs">
              ${isCompleted ? '⭐ COMPLETA' : 'EN PROCESO'}
            </span>
          </div>

          <!-- Casilleros de los 5 Sellos -->
          <div class="py-5 flex items-center justify-between gap-1">
            ${stampSlotsHTML}
          </div>

          <!-- Barra de Progreso -->
          <div class="space-y-1.5 pt-2 border-t border-orange-200/60">
            <div class="flex justify-between text-[11px] text-slate-600 font-bold">
              <span>Progreso de Recompensa</span>
              <span class="font-black text-orange-600">${(stamps / 5) * 100}%</span>
            </div>
            <div class="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-300/60">
              <div class="bg-gradient-to-r from-rose-500 via-orange-500 to-teal-500 h-full rounded-full transition-all duration-700" style="width: ${(stamps / 5) * 100}%"></div>
            </div>
          </div>
        </div>

        <!-- REGLA DE NEGOCIO VISIBLE REQUERIDA -->
        <div class="glass-panel p-3.5 rounded-3xl border-l-4 border-l-orange-500 space-y-1 shadow-sm">
          <div class="flex items-center gap-2 text-orange-600 font-black text-xs">
            <span>📌</span>
            <span>Regla de Beneficio</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed font-medium">
            ${card.businessRule}
          </p>
        </div>

        ${rewardSectionHTML}

        <!-- Historial de Sellos -->
        <div class="glass-panel p-4 rounded-3xl space-y-3 shadow-sm">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black text-slate-800 uppercase tracking-wider">Historial de Sellos</h4>
            <span class="text-[10px] text-slate-500 font-semibold">${history.length} movimientos</span>
          </div>

          ${history.length === 0 ? `
            <p class="text-xs text-slate-500 text-center py-3 font-medium">Aún no registras compras con sello. ¡Haz tu primera compra desde S/ 5!</p>
          ` : `
            <div class="space-y-2 max-h-40 overflow-y-auto pr-1">
              ${history.map(item => `
                <div class="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <div class="flex items-center gap-2">
                    <span class="text-orange-600 font-bold">+${item.stamps_added} sello</span>
                    <span class="text-slate-500 text-[11px] font-medium">(${item.stamps_before} → ${item.stamps_after})</span>
                  </div>
                  <span class="text-[10px] text-slate-400 font-medium">${item.created_at}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>
    `;

    if (isCompleted) {
      Confetti.launch(50);
    }

  } catch (err) {
    container.innerHTML = `
      <div class="text-center py-12 space-y-3">
        <p class="text-sm text-rose-500 font-bold">${err.message}</p>
        <button onclick="handleRoute()" class="btn-primary px-4 py-2 rounded-2xl text-xs">Reintentar</button>
      </div>
    `;
  }
}

/* ==========================================================================
   VISTA 5: LOGIN DE ADMINISTRADOR / CAJERO
   ========================================================================== */
function renderAdminLoginView(container) {
  container.innerHTML = `
    <div class="space-y-5 max-w-md mx-auto w-full my-auto py-4">
      <div class="text-center space-y-1">
        <div class="flex justify-center mb-1">
          <img src="/img/niji-logo.png" alt="Mascota NIJI" class="w-24 h-24 object-contain logo-sticker drop-shadow-md" />
        </div>
        <h2 class="text-2xl font-black text-slate-900">Portal de Personal</h2>
        <p class="text-xs text-slate-600 font-medium">Acceso exclusivo y seguro para cajeros de NIJI Perú.</p>
      </div>

      <form id="admin-login-form" class="space-y-3.5 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Usuario de Personal</label>
          <input type="text" id="admin-pseudonym" required placeholder="admin_cajero" class="glass-input w-full px-4 py-2.5 rounded-2xl text-sm" />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Contraseña de Seguridad</label>
          <input type="password" id="admin-password" required placeholder="••••••••" class="glass-input w-full px-4 py-2.5 rounded-2xl text-sm" />
        </div>

        <button type="submit" id="btn-admin-submit" class="btn-admin w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-2">
          <span>Ingresar al Panel de Tienda</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
        </button>
      </form>

      <div class="text-center pt-2">
        <a href="#login" class="text-xs text-slate-500 hover:text-slate-800 font-semibold">← Volver al Portal de Clientes</a>
      </div>
    </div>
  `;

  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-admin-submit');
    const pseudonym = document.getElementById('admin-pseudonym').value.trim();
    const password = document.getElementById('admin-password').value;

    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Validando...';

    try {
      const res = await API.loginAdmin(pseudonym, password);
      API.setToken(res.token);
      API.setCurrentUser(res.user);
      showToast(res.message, 'success');
      navigateTo('#admin-dashboard');
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<span>Ingresar al Panel de Tienda</span>';
    }
  });
}

/* ==========================================================================
   VISTA 6: PANEL DE ADMINISTRACIÓN (MÓDULO 3)
   ========================================================================== */
async function renderAdminDashboardView(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  `;

  let m = { totalClients: 0, cardsCompleted: 0, todayStamps: 0 };
  try {
    const metricsData = await API.getAdminMetrics();
    if (metricsData && metricsData.metrics) {
      m = metricsData.metrics;
    }
  } catch (metricsErr) {
    console.warn('Advertencia al consultar métricas:', metricsErr);
  }

  container.innerHTML = `
    <div class="space-y-4 max-w-4xl mx-auto w-full py-2">
      
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="/img/niji-logo.png" alt="NIJI" class="w-10 h-10 object-contain drop-shadow-sm" />
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full border border-teal-200">
              Caja / Administración
            </span>
            <h2 class="text-xl font-black text-slate-900 mt-0.5">Control de Tienda</h2>
          </div>
        </div>
        <button onclick="handleRoute()" class="p-2 rounded-2xl bg-slate-100 text-slate-600 hover:text-slate-900" title="Refrescar">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      <!-- Tarjetas de Métricas -->
      <div class="grid grid-cols-4 gap-1.5 sm:gap-2">
        <div class="glass-panel p-2.5 rounded-2xl text-center">
          <span class="text-[9px] text-slate-500 block font-bold">Clientes</span>
          <span id="metric-total-clients" class="text-base font-black text-slate-900">${m.totalClients}</span>
        </div>
        <div class="glass-panel p-2.5 rounded-2xl text-center cursor-pointer hover:border-amber-300 transition" onclick="setClientsFilter('birthday_today')" title="Ver cumpleañeros de hoy">
          <span class="text-[9px] text-amber-700 block font-bold">🎂 Cumple</span>
          <span id="metric-birthday-today" class="text-base font-black text-amber-600">${m.birthdaysToday || 0}</span>
        </div>
        <div class="glass-panel p-2.5 rounded-2xl text-center">
          <span class="text-[9px] text-orange-600 block font-bold">Tarjetas 5/5</span>
          <span id="metric-cards-completed" class="text-base font-black text-orange-600">${m.cardsCompleted}</span>
        </div>
        <div class="glass-panel p-2.5 rounded-2xl text-center">
          <span class="text-[9px] text-teal-700 block font-bold">Sellos Hoy</span>
          <span id="metric-today-stamps" class="text-base font-black text-teal-700">${m.todayStamps}</span>
        </div>
      </div>

      <!-- SELECTOR DE PESTAÑAS (CLIENTES, PROMOCIONES, PRODUCTOS, TIENDA) -->
      <div class="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
        <button id="admin-tab-clients-btn" onclick="switchAdminTab('clients')" class="py-2 rounded-xl text-[11px] font-black transition bg-white text-slate-900 shadow-xs flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer">
          <span>👥</span>
          <span>Clientes</span>
        </button>
        <button id="admin-tab-promos-btn" onclick="switchAdminTab('promos')" class="py-2 rounded-xl text-[11px] font-bold transition text-slate-600 hover:text-slate-900 flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer">
          <span>📢</span>
          <span>Promos</span>
        </button>
        <button id="admin-tab-products-btn" onclick="switchAdminTab('products')" class="py-2 rounded-xl text-[11px] font-bold transition text-slate-600 hover:text-slate-900 flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer">
          <span>🍨</span>
          <span>Productos</span>
        </button>
        <button id="admin-tab-store-btn" onclick="switchAdminTab('store')" class="py-2 rounded-xl text-[11px] font-bold transition text-slate-600 hover:text-slate-900 flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer">
          <span>🏪</span>
          <span>Tienda</span>
        </button>
      </div>

      <!-- PESTAÑA 1: GESTIÓN DE CLIENTES Y SELLOS -->
      <div id="admin-section-clients" class="glass-panel p-4 rounded-3xl space-y-3">
        <div class="flex items-center justify-between pb-0.5">
          <div>
            <label class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>👥</span>
              <span>Directorio de Clientes</span>
            </label>
            <p class="text-[10px] text-slate-400 font-medium">Buscador y asignación en caja</p>
          </div>

          <!-- Botón de Exportar CSV para Email Marketing y Base de Datos -->
          <button id="btn-export-csv" onclick="downloadClientsCSV()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 transition shadow-xs cursor-pointer" title="Descargar base de datos completa compatible con Excel">
            <span>📥</span>
            <span>Exportar CSV</span>
          </button>
        </div>

        <!-- Buscador -->
        <div class="relative">
          <span class="absolute left-3.5 top-2.5 text-orange-500 font-black text-xs">@</span>
          <input type="text" id="admin-search-input" placeholder="Buscar por pseudónimo o correo..." class="glass-input w-full pl-8 pr-4 py-2 rounded-2xl text-xs" />
        </div>

        <!-- Filtros Rápidos de Cumpleaños & Segmentación -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-bold">
          <button id="filter-btn-all" onclick="setClientsFilter('all')" class="px-2.5 py-1 rounded-xl bg-orange-500 text-white shadow-2xs transition">
            Todos
          </button>
          <button id="filter-btn-today" onclick="setClientsFilter('birthday_today')" class="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 hover:text-amber-800 hover:bg-amber-50 transition flex items-center gap-1">
            <span>🎂</span>
            <span>Cumple Hoy</span>
          </button>
          <button id="filter-btn-month" onclick="setClientsFilter('birthday_month')" class="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 hover:text-teal-800 hover:bg-teal-50 transition flex items-center gap-1">
            <span>🎈</span>
            <span>Cumple en el Mes</span>
          </button>
        </div>

        <div id="clients-list-container" class="space-y-2 max-h-72 overflow-y-auto pr-1">
          <div class="text-center py-4 text-xs text-slate-400 font-medium">Cargando lista de clientes...</div>
        </div>
      </div>

      <!-- PESTAÑA 2: CREACIÓN Y PROGRAMACIÓN DE PROMOCIONES -->
      <div id="admin-section-promos" class="hidden space-y-4">
        
        <!-- Formulario para publicar promoción con tiempo programado -->
        <div class="glass-panel p-4 rounded-3xl space-y-3">
          <div class="flex items-center justify-between pb-1 border-b border-slate-100">
            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>✍️</span>
              <span>Nueva Promoción Programada</span>
            </span>
            <span class="text-[10px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded-full">
              Visible en Panel Cliente
            </span>
          </div>

          <form id="create-promo-form" class="space-y-3">
            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Título del Anuncio</label>
              <input type="text" id="promo-title" required placeholder="ej. ¡Viernes de Doble Sello!" class="glass-input w-full px-3 py-2 rounded-xl text-xs" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Mensaje de la Promoción</label>
              <textarea id="promo-message" required rows="2" placeholder="ej. Por consumos mayores a S/ 20 recibe un postre mochi gratis hoy." class="glass-input w-full px-3 py-2 rounded-xl text-xs"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">Tipo de Etiqueta</label>
                <select id="promo-tag" class="glass-input w-full px-2 py-2 rounded-xl text-xs font-bold text-slate-700">
                  <option value="PROMO">🏷️ PROMO</option>
                  <option value="FLASH">⚡ FLASH</option>
                  <option value="REGALO">🎁 REGALO</option>
                  <option value="AVISO">📢 AVISO</option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">Tiempo de Vigencia</label>
                <select id="promo-duration" class="glass-input w-full px-2 py-2 rounded-xl text-xs font-bold text-slate-700">
                  <option value="2">⏳ 2 Horas</option>
                  <option value="6">⏳ 6 Horas</option>
                  <option value="12">⏳ 12 Horas</option>
                  <option value="24" selected>⏳ 24 Horas (1 Día)</option>
                  <option value="72">⏳ 3 Días</option>
                  <option value="168">⏳ 7 Días (1 Semana)</option>
                </select>
              </div>
            </div>

            <button type="submit" id="btn-submit-promo" class="btn-primary w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm">
              <span>Publicar en Panel de Clientes</span>
              <span>🚀</span>
            </button>
          </form>
        </div>

        <!-- Lista de Promociones Vigentes e Historial -->
        <div class="glass-panel p-4 rounded-3xl space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black text-slate-800">Promociones en Tienda</span>
            <button onclick="loadAdminPromotions()" class="text-[10px] text-orange-600 font-bold hover:underline">Refrescar</button>
          </div>

          <div id="admin-promos-list-container" class="space-y-2 max-h-60 overflow-y-auto pr-1">
            <div class="text-center py-4 text-xs text-slate-400">Cargando promociones...</div>
          </div>
        </div>

      </div>

      <!-- PESTAÑA 3: GESTIÓN DE PRODUCTOS COMESTIBLES -->
      <div id="admin-section-products" class="hidden">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div class="md:col-span-5 glass-panel p-4 rounded-3xl space-y-3">
          <div class="flex items-center justify-between pb-1 border-b border-slate-100">
            <span id="product-form-title" class="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>🍨</span>
              <span>Agregar Nuevo Producto</span>
            </span>
            <button type="button" id="btn-cancel-edit-prod" onclick="resetProductForm()" class="hidden text-[10px] font-bold text-rose-600 hover:underline">
              Cancelar edición
            </button>
          </div>

          <form id="admin-product-form" class="space-y-2.5">
            <input type="hidden" id="prod-edit-id" value="" />

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Nombre del Producto</label>
              <input type="text" id="prod-name" required placeholder="ej. Cuchareable Choco-Lúcuma" class="glass-input w-full px-3 py-2 rounded-xl text-xs" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">Categoría</label>
                <select id="prod-category" class="glass-input w-full px-2 py-2 rounded-xl text-xs font-bold text-slate-700">
                  <option value="Cuchareables">🍨 Cuchareables</option>
                  <option value="Raspadillas">🍧 Raspadillas</option>
                  <option value="Postres">🍡 Postres</option>
                  <option value="Bebidas">🧋 Bebidas</option>
                  <option value="Otros">🍬 Otros</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">Precio (S/)</label>
                <input type="number" step="0.10" min="0" id="prod-price" required placeholder="12.00" class="glass-input w-full px-3 py-2 rounded-xl text-xs font-bold" />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Descripción breve</label>
              <textarea id="prod-description" rows="2" placeholder="Ingredientes, sabores, porción..." class="glass-input w-full px-3 py-2 rounded-xl text-xs"></textarea>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label class="block text-[11px] font-bold text-slate-700">Imagen del Producto (Subir foto o pegar URL)</label>
              <div class="flex items-center gap-2">
                <input type="file" id="prod-image-file" accept="image/*" class="text-[10px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200 cursor-pointer w-full" />
              </div>
              <input type="text" id="prod-image-url" placeholder="O pega aquí una URL de imagen (https://...)" class="glass-input w-full px-3 py-1.5 rounded-xl text-[11px]" />
              <div id="prod-image-preview-wrap" class="hidden flex items-center gap-2 pt-1">
                <img id="prod-image-preview" src="" alt="Vista previa" class="w-12 h-12 rounded-xl object-cover border border-orange-200" />
                <button type="button" onclick="clearProductImage()" class="text-[10px] text-rose-600 font-bold hover:underline">Quitar imagen</button>
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input type="checkbox" id="prod-visible" checked class="w-4 h-4 accent-orange-500 rounded" />
              <span class="text-xs font-bold text-slate-700">Exhibir en la página principal</span>
            </label>

            <button type="submit" id="btn-submit-product" class="btn-primary w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer">
              <span>💾 Guardar Producto</span>
            </button>
          </form>
        </div>

          <!-- Lista de Productos del Catálogo -->
          <div class="md:col-span-7 glass-panel p-4 rounded-3xl space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-slate-800">Catálogo Actual (Edita fotos, precios y visibilidad)</span>
              <button onclick="loadAdminProducts()" class="text-[10px] text-orange-600 font-bold hover:underline">Refrescar</button>
            </div>
            <div id="admin-products-list" class="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              <div class="text-center py-4 text-xs text-slate-400">Cargando productos...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- PESTAÑA 4: INFORMACIÓN BÁSICA DE TIENDA, WHATSAPP Y MAPA -->
      <div id="admin-section-store" class="hidden space-y-4">
        <div class="glass-panel p-4 rounded-3xl space-y-3">
          <div class="flex items-center justify-between pb-1 border-b border-slate-100">
            <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>🏪</span>
              <span>Información de la Página Principal</span>
            </span>
            <span class="text-[10px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded-full">Landing Page</span>
          </div>

          <form id="admin-store-info-form" class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Nombre de la Tienda</label>
              <input type="text" id="store-name" required class="glass-input w-full px-3 py-2 rounded-xl text-xs font-bold" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Título Principal (Hero)</label>
              <input type="text" id="store-hero-title" required class="glass-input w-full px-3 py-2 rounded-xl text-xs" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Subtítulo / Descripción</label>
              <textarea id="store-hero-subtitle" rows="2" class="glass-input w-full px-3 py-2 rounded-xl text-xs"></textarea>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label class="block text-[11px] font-bold text-slate-700">Imagen Principal / Banner (Subir foto o URL)</label>
              <input type="file" id="store-hero-file" accept="image/*" class="text-[10px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-teal-100 file:text-teal-800 hover:file:bg-teal-200 cursor-pointer w-full" />
              <input type="text" id="store-hero-image" placeholder="/img/niji-logo.png o https://..." class="glass-input w-full px-3 py-1.5 rounded-xl text-[11px]" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp (Link wa.me o Número con 51)</label>
                <input type="text" id="store-whatsapp" required placeholder="https://wa.me/message/..." class="glass-input w-full px-3 py-2 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">Horario de Atención</label>
                <input type="text" id="store-schedule" placeholder="Lun-Dom 12pm-9pm" class="glass-input w-full px-3 py-2 rounded-xl text-xs" />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Mensaje predeterminado de WhatsApp</label>
              <input type="text" id="store-whatsapp-msg" class="glass-input w-full px-3 py-2 rounded-xl text-xs" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Dirección visible en la web</label>
              <input type="text" id="store-address" required placeholder="Piura 20009, Perú — NIJI Perú" class="glass-input w-full px-3 py-2 rounded-xl text-xs" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Ubicación exacta para el Mapa embebido</label>
              <input type="text" id="store-maps-query" placeholder="Niji Perú, Piura 20009" class="glass-input w-full px-3 py-2 rounded-xl text-xs" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">Enlace directo de Google Maps (Botón Abrir Mapa)</label>
              <input type="text" id="store-maps-url" placeholder="https://maps.app.goo.gl/..." class="glass-input w-full px-3 py-2 rounded-xl text-xs font-mono" />
            </div>

            <button type="submit" id="btn-submit-store-info" class="btn-teal w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer">
              <span>💾 Guardar Información de Tienda</span>
            </button>
          </form>
        </div>
      </div>

    </div>
  `;

  loadAdminClients('', 'all');

  let searchTimeout;
  const searchInput = document.getElementById('admin-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadAdminClients(e.target.value, currentAdminClientsFilter);
      }, 250);
    });
  }
}

let currentAdminClientsFilter = 'all';

function setClientsFilter(filterType) {
  currentAdminClientsFilter = filterType;

  const btnAll = document.getElementById('filter-btn-all');
  const btnToday = document.getElementById('filter-btn-today');
  const btnMonth = document.getElementById('filter-btn-month');

  if (btnAll) {
    btnAll.className = filterType === 'all'
      ? 'px-2.5 py-1 rounded-xl bg-orange-500 text-white shadow-2xs transition'
      : 'px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
  }
  if (btnToday) {
    btnToday.className = filterType === 'birthday_today'
      ? 'px-2.5 py-1 rounded-xl bg-amber-500 text-white shadow-2xs transition flex items-center gap-1 font-bold'
      : 'px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 hover:text-amber-800 hover:bg-amber-50 transition flex items-center gap-1';
  }
  if (btnMonth) {
    btnMonth.className = filterType === 'birthday_month'
      ? 'px-2.5 py-1 rounded-xl bg-teal-600 text-white shadow-2xs transition flex items-center gap-1 font-bold'
      : 'px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 hover:text-teal-800 hover:bg-teal-50 transition flex items-center gap-1';
  }

  const searchVal = document.getElementById('admin-search-input')?.value || '';
  loadAdminClients(searchVal, filterType);
}

async function downloadClientsCSV() {
  const btn = document.getElementById('btn-export-csv');
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Exportando...`;
  }
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/clients/export', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al exportar base de datos');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_niji_directorio_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showToast('¡Directorio descargado en CSV / Excel!', 'success');
  } catch (e) {
    showToast(e.message || 'No se pudo exportar la base de datos.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
}

async function refreshAdminMetrics() {
  try {
    const metricsData = await API.getAdminMetrics();
    if (metricsData && metricsData.metrics) {
      const m = metricsData.metrics;
      const elClients = document.getElementById('metric-total-clients');
      const elCompleted = document.getElementById('metric-cards-completed');
      const elToday = document.getElementById('metric-today-stamps');
      const elBirthdays = document.getElementById('metric-birthday-today');
      if (elClients) elClients.textContent = m.totalClients;
      if (elCompleted) elCompleted.textContent = m.cardsCompleted;
      if (elToday) elToday.textContent = m.todayStamps;
      if (elBirthdays) elBirthdays.textContent = m.birthdaysToday || 0;
    }
  } catch (e) {}
}

async function loadAdminClients(query = '', filter = currentAdminClientsFilter) {
  const container = document.getElementById('clients-list-container');
  if (!container) return;

  try {
    const res = await API.searchClients(query, filter);
    const clients = res.clients || [];

    if (clients.length === 0) {
      let emptyMsg = `No se encontraron clientes con "${query}".`;
      if (filter === 'birthday_today') {
        emptyMsg = '🎂 No hay clientes que cumplan años el día de hoy.';
      } else if (filter === 'birthday_month') {
        emptyMsg = '🎈 No hay clientes registrados que cumplan años este mes.';
      }
      container.innerHTML = `
        <div class="text-center py-6 text-xs text-slate-500 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          ${emptyMsg}
        </div>
      `;
      return;
    }

    container.innerHTML = clients.map(c => {
      const safeId = String(c.id || c.pseudonym).replace(/'/g, "\\'");
      const safePseudo = String(c.pseudonym).replace(/'/g, "\\'");
      const hasOptIn = (c.accepts_promotions !== 0 && c.accepts_promotions !== false);

      return `
      <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition flex items-center justify-between gap-2 shadow-2xs">
        <div class="space-y-0.5 cursor-pointer flex-1" onclick="navigateTo('#admin-cliente/${encodeURIComponent(c.id || c.pseudonym)}')">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-xs text-slate-900">@${c.pseudonym}</span>
            <span class="text-[10px] text-slate-400 font-medium">🎂 ${c.birthdate || '-'}</span>
            ${c.isBirthdayToday ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold animate-pulse">🎂 ¡Cumple Hoy!</span>' : ''}
            ${c.isBirthdayMonth && !c.isBirthdayToday ? '<span class="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">🎈 Mes Cumple</span>' : ''}
            ${hasOptIn ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium" title="Acepta promociones por correo">✉️ Opt-in</span>' : ''}
          </div>
          <div class="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
            <span>${c.email}</span>
            <span>•</span>
            <span class="font-mono ${c.stamps >= 5 ? 'text-rose-600 font-black' : 'text-orange-600 font-bold'}">${c.stamps}/5 sellos</span>
            ${c.stamps >= 5 ? '<span class="bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded text-[9px] font-black">⭐ Meta 5/5</span>' : ''}
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          ${c.stamps >= 5 ? `
            <!-- Botón Rápido de Reiniciar Tarjeta a 0 al completar los 5 sellos -->
            <button onclick="quickResetCard('${safeId}', '${safePseudo}')" class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1 shadow-xs" title="Tarjeta Completa: Reiniciar a 0 para nuevo ciclo">
              <span>🔄</span>
              <span>Reset 0</span>
            </button>
          ` : `
            <!-- Botón Rápido de +1 Sello -->
            <button onclick="quickAddStamp('${safeId}', '${safePseudo}')" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs" title="Asignar +1 Sello al cierre de jornada">
              <span>+1</span>
              <span class="text-[10px]">Sello</span>
            </button>
          `}
          
          <button onclick="navigateTo('#admin-cliente/${encodeURIComponent(c.id || c.pseudonym)}')" class="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs" title="Ver Ficha Detallada">
            👁️
          </button>
        </div>
      </div>
    `}).join('');

  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-500 text-center py-2">${err.message}</div>`;
  }
}

async function quickAddStamp(clientId, pseudonym) {
  try {
    const res = await API.addStamp({ clientId, clientPseudonym: pseudonym });
    if (res.client && res.client.isCompleted) {
      SoundEffects.playVictory();
      Confetti.launch(60);
      showToast(res.message, 'success', 6500);
    } else {
      SoundEffects.playStamp();
      showToast(res.message, 'success');
    }
    loadAdminClients(document.getElementById('admin-search-input')?.value || '');
    refreshAdminMetrics();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function quickResetCard(clientId, pseudonym) {
  if (!confirm(`¿Deseas reiniciar la tarjeta de @${pseudonym} a 0 sellos para iniciar un nuevo ciclo de compras?`)) {
    return;
  }
  try {
    const res = await API.resetClientCard({ clientId, clientPseudonym: pseudonym });
    SoundEffects.playVictory();
    showToast(res.message, 'success');
    loadAdminClients(document.getElementById('admin-search-input')?.value || '');
    refreshAdminMetrics();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   VISTA 7: FICHA DETALLADA DEL CLIENTE (MÓDULO 3)
   ========================================================================== */
async function renderClientDetailAdminView(container, clientId) {
  container.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  `;

  try {
    const res = await API.getClientDetail(clientId);
    const client = res.client;
    currentClientDetail = client;

    let clientStampSlots = '';
    for (let i = 1; i <= 5; i++) {
      const isStamped = i <= client.stamps;
      const isGoal = i === 5;
      if (isGoal) {
        clientStampSlots += `
          <div class="stamp-slot slot-goal ${isStamped ? 'stamped' : 'empty'} w-10 h-10 flex items-center justify-center">
            ${getKawaiiStarIcon(isStamped, true)}
          </div>
        `;
      } else {
        clientStampSlots += `
          <div class="stamp-slot ${isStamped ? 'stamped' : 'empty'} w-10 h-10 flex items-center justify-center">
            ${getKawaiiHeartIcon(isStamped, i, true)}
          </div>
        `;
      }
    }

    const activeCoupon = client.coupons.find(c => c.status === 'active');

    container.innerHTML = `
      <div class="space-y-4 max-w-2xl mx-auto w-full py-2">
        
        <div class="flex items-center justify-between">
          <button onclick="navigateTo('#admin-dashboard')" class="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1">
            ← Volver al Panel
          </button>
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
            Ficha del Cliente
          </span>
        </div>

        <!-- Perfil Detallado del Cliente -->
        <div class="glass-panel p-4 rounded-3xl space-y-3">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-lg font-black text-slate-900">@${client.pseudonym}</h3>
              <p class="text-xs text-slate-500 font-medium">${client.email}</p>
            </div>
            <div class="text-right">
              <span class="text-xs font-mono font-black text-orange-700 bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                ${client.stamps}/5 Sellos
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
            <div>
              <span class="text-slate-400 block text-[10px] font-semibold">Fecha Nacimiento</span>
              <span class="font-bold text-slate-700">${client.birthdate}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] font-semibold">Premio Ruleta</span>
              <span class="font-bold text-orange-600">${client.welcome_prize || 'No reclamado'}</span>
            </div>
          </div>

          ${client.birthdayInfo.isBirthdayToday ? `
            <div class="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-medium">
              <span>🎂</span>
              <span><strong>¡Hoy cumple años!</strong> Otorgar beneficio especial en caja.</span>
            </div>
          ` : ''}
        </div>

        <!-- Estado de la Tarjeta y Botones de Acción -->
        <div class="glass-panel p-4 rounded-3xl space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black text-slate-800 uppercase tracking-wider">Estado de la Tarjeta</h4>
            <span class="text-xs font-black ${client.stamps === 5 ? 'text-rose-600' : 'text-orange-600'}">
              ${client.stamps === 5 ? '¡Tarjeta Completa 5/5!' : `${client.stamps} de 5`}
            </span>
          </div>

          <div class="flex justify-between items-center py-3 px-2 bg-slate-50 rounded-2xl border border-slate-100">
            ${clientStampSlots}
          </div>

          ${client.stamps < 5 ? `
            <!-- Botón de Asignación de Sellos (+1) -->
            <button id="btn-add-stamp-detail" onclick="addStampFromDetail()" class="btn-primary w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2">
              <span>+1 Sello (Cierre de Jornada)</span>
              <span>⭐</span>
            </button>
          ` : `
            <!-- Botón Destacado de Reinicio a 0 cuando ya completó los 5 sellos -->
            <button onclick="resetCardFromDetail('${String(client.id || client.pseudonym).replace(/'/g, "\\'")}', '${String(client.pseudonym).replace(/'/g, "\\'")}')" class="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-orange-600 text-white w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-md transition">
              <span>🔄 Reiniciar Cuenta a 0 Sellos (Nuevo Ciclo)</span>
            </button>
          `}
        </div>

        <!-- Canje de Cupón si alcanzó 5 sellos -->
        ${activeCoupon ? `
          <div class="digital-coupon p-4 rounded-3xl border-2 border-orange-400 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-black text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
                Cupón Pendiente de Canje
              </span>
              <span class="text-xs font-mono font-black text-orange-600">${activeCoupon.code}</span>
            </div>

            <p class="text-xs text-slate-700 font-medium">${activeCoupon.title}</p>

            <button onclick="redeemClientCoupon('${activeCoupon.code}', '${String(client.id || client.pseudonym).replace(/'/g, "\\'")}')" class="btn-teal w-full py-2.5 rounded-2xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
              <span>Canjear Cupón & Reiniciar Tarjeta a 0</span>
              <span>✅</span>
            </button>
          </div>
        ` : ''}

        <!-- Historial de Sellos del Cliente -->
        <div class="glass-panel p-4 rounded-3xl space-y-2">
          <h4 class="text-xs font-black text-slate-800 uppercase tracking-wider">Historial de Sellos</h4>
          <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            ${client.stampsHistory.length === 0 ? `
              <p class="text-xs text-slate-400 text-center py-2 font-medium">Sin movimientos registrados.</p>
            ` : client.stampsHistory.map(h => `
              <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] flex justify-between items-center">
                <div>
                  <span class="text-orange-600 font-bold">+${h.stamps_added} sello</span>
                  <span class="text-slate-500">(${h.stamps_before} → ${h.stamps_after})</span>
                  <p class="text-[10px] text-slate-400 font-medium">${h.notes}</p>
                </div>
                <span class="text-[9px] text-slate-400 font-medium">${h.created_at}</span>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addStampFromDetail() {
  if (!currentClientDetail) return;
  const btn = document.getElementById('btn-add-stamp-detail');
  if (btn) btn.disabled = true;

  try {
    const res = await API.addStamp({ clientId: currentClientDetail.id, clientPseudonym: currentClientDetail.pseudonym });
    if (res.client && res.client.isCompleted) {
      SoundEffects.playVictory();
      Confetti.launch(70);
      showToast(res.message, 'success', 6500);
    } else {
      SoundEffects.playStamp();
      showToast(res.message, 'success');
    }
    await renderClientDetailAdminView(document.getElementById('app-view'), currentClientDetail.id || currentClientDetail.pseudonym);
  } catch (err) {
    showToast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
}

async function resetCardFromDetail(clientId, pseudonym) {
  if (!confirm(`¿Confirmas el reinicio de la tarjeta de @${pseudonym} a 0 sellos? Su cupón quedará marcado como entregado y el cliente podrá empezar un nuevo ciclo de sellos.`)) {
    return;
  }

  try {
    const res = await API.resetClientCard({ clientId, clientPseudonym: pseudonym });
    SoundEffects.playVictory();
    showToast(res.message, 'success');
    await renderClientDetailAdminView(document.getElementById('app-view'), clientId || pseudonym);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function redeemClientCoupon(couponCode, clientId) {
  if (!confirm(`¿Confirmas el canje del cupón ${couponCode}? Esto reseteará los sellos a 0 para el nuevo ciclo de fidelidad.`)) {
    return;
  }

  try {
    const res = await API.redeemCoupon({ couponCode, clientId });
    SoundEffects.playVictory();
    showToast(res.message, 'success');
    await renderClientDetailAdminView(document.getElementById('app-view'), clientId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   GESTIÓN DE PESTAÑAS Y PROMOCIONES (PANEL ADMIN)
   ========================================================================== */

function switchAdminTab(tab) {
  const sections = {
    clients: document.getElementById('admin-section-clients'),
    promos: document.getElementById('admin-section-promos'),
    products: document.getElementById('admin-section-products'),
    store: document.getElementById('admin-section-store')
  };

  const buttons = {
    clients: document.getElementById('admin-tab-clients-btn'),
    promos: document.getElementById('admin-tab-promos-btn'),
    products: document.getElementById('admin-tab-products-btn'),
    store: document.getElementById('admin-tab-store-btn')
  };

  Object.keys(sections).forEach(key => {
    if (!sections[key] || !buttons[key]) return;
    if (key === tab) {
      sections[key].classList.remove('hidden');
      buttons[key].className = 'py-2 rounded-xl text-[11px] font-black transition bg-white text-slate-900 shadow-xs flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer';
    } else {
      sections[key].classList.add('hidden');
      buttons[key].className = 'py-2 rounded-xl text-[11px] font-bold transition text-slate-600 hover:text-slate-900 flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer';
    }
  });

  if (tab === 'promos') {
    loadAdminPromotions();
    setupCreatePromoForm();
  } else if (tab === 'products') {
    loadAdminProducts();
    setupAdminProductForm();
  } else if (tab === 'store') {
    loadAdminStoreInfo();
    setupAdminStoreInfoForm();
  }
}

function setupCreatePromoForm() {
  const form = document.getElementById('create-promo-form');
  if (!form || form.dataset.listenerAttached) return;

  form.dataset.listenerAttached = 'true';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-promo');
    const title = document.getElementById('promo-title').value.trim();
    const message = document.getElementById('promo-message').value.trim();
    const tag = document.getElementById('promo-tag').value;
    const durationHours = document.getElementById('promo-duration').value;

    btn.disabled = true;
    btn.innerHTML = '<span>Publicando...</span>';

    try {
      const res = await API.createPromotion({ title, message, tag, durationHours });
      showToast(res.message, 'success');
      form.reset();
      loadAdminPromotions();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Publicar en Panel de Clientes</span> <span>🚀</span>';
    }
  });
}

async function loadAdminPromotions() {
  const container = document.getElementById('admin-promos-list-container');
  if (!container) return;

  try {
    const res = await API.getAdminPromotions();
    const promos = res.promotions || [];

    if (promos.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 text-xs text-slate-400 font-medium">
          No hay promociones creadas aún. ¡Crea la primera arriba!
        </div>
      `;
      return;
    }

    container.innerHTML = promos.map(p => {
      const isExpired = p.is_expired === 1 || p.is_active === 0 || p.is_active === false;
      const safeId = String(p.id).replace(/'/g, "\\'");

      let remainingBadge = '';
      if (isExpired) {
        remainingBadge = '<span class="text-[9px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">Expirada / Inactiva</span>';
      } else {
        const mins = p.minutes_remaining;
        const timeText = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
        remainingBadge = `<span class="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full">⏳ Quedan ${timeText}</span>`;
      }

      return `
        <div id="promo-card-${safeId}" class="p-3 rounded-2xl ${isExpired ? 'bg-slate-100/70 opacity-60' : 'bg-slate-50 border border-slate-200/80'} text-xs space-y-1.5 shadow-2xs transition-all duration-300">
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${p.tag === 'FLASH' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}">
              ${p.tag}
            </span>
            <div id="promo-badge-${safeId}">${remainingBadge}</div>
          </div>

          <h5 class="font-black text-slate-900">${p.title}</h5>
          <p class="text-[11px] text-slate-600 font-medium leading-relaxed">${p.message}</p>

          <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-400">
            <span>Por: @${p.admin_pseudonym}</span>
            <div id="promo-actions-${safeId}">
              ${!isExpired ? `
                <button type="button" onclick="deactivateAdminPromotion('${safeId}', this)" class="text-rose-600 font-bold hover:underline flex items-center gap-1 cursor-pointer">
                  <span>🗑️ Desactivar</span>
                </button>
              ` : `
                <span class="text-slate-400 font-medium">Inactiva</span>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-500 text-center py-2">${err.message}</div>`;
  }
}

async function deactivateAdminPromotion(id, btnElement) {
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = '<span class="inline-block w-3 h-3 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span> <span class="text-slate-400">Desactivando...</span>';
  }

  try {
    const res = await API.deletePromotion(id);
    showToast(res.message, 'success');

    // Modificación visual instantánea en el DOM
    const card = document.getElementById(`promo-card-${id}`);
    const badge = document.getElementById(`promo-badge-${id}`);
    const actions = document.getElementById(`promo-actions-${id}`);

    if (card) {
      card.classList.add('opacity-60', 'bg-slate-100/70');
      card.classList.remove('bg-slate-50', 'border-slate-200/80');
    }
    if (badge) {
      badge.innerHTML = '<span class="text-[9px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">Expirada / Inactiva</span>';
    }
    if (actions) {
      actions.innerHTML = '<span class="text-slate-400 font-medium">Inactiva</span>';
    }

    // Re-sincronizar listado en segundo plano
    setTimeout(() => loadAdminPromotions(), 400);

  } catch (err) {
    showToast(err.message || 'Error al desactivar la promoción.', 'error');
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = '<span>🗑️ Desactivar</span>';
    }
  }
}

// Mantener alias de compatibilidad
async function deleteAdminPromotion(id) {
  return deactivateAdminPromotion(id);
}

/* ==========================================================================
   GESTIÓN DE PRODUCTOS Y TIENDA (CMS DEL PANEL ADMIN)
   ========================================================================== */

let adminProductsCache = [];

function setupAdminProductForm() {
  const form = document.getElementById('admin-product-form');
  const fileInput = document.getElementById('prod-image-file');
  const urlInput = document.getElementById('prod-image-url');

  if (fileInput && !fileInput.dataset.listenerAttached) {
    fileInput.dataset.listenerAttached = 'true';
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        showToast('Procesando imagen...', 'info', 2000);
        const compressedDataUrl = await compressImageFile(file, 640, 0.78);
        if (urlInput) urlInput.value = compressedDataUrl;
        showProductImagePreview(compressedDataUrl);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (urlInput && !urlInput.dataset.listenerAttached) {
    urlInput.dataset.listenerAttached = 'true';
    urlInput.addEventListener('input', (e) => {
      showProductImagePreview(e.target.value.trim());
    });
  }

  if (!form || form.dataset.listenerAttached) return;
  form.dataset.listenerAttached = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-product');
    const editId = document.getElementById('prod-edit-id').value.trim();

    const payload = {
      name: document.getElementById('prod-name').value.trim(),
      category: document.getElementById('prod-category').value,
      price: Number(document.getElementById('prod-price').value),
      description: document.getElementById('prod-description').value.trim(),
      image_url: document.getElementById('prod-image-url').value.trim(),
      is_visible: document.getElementById('prod-visible').checked ? 1 : 0
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> <span>Guardando...</span>';

    try {
      let res;
      if (editId) {
        res = await API.updateProduct(editId, payload);
      } else {
        res = await API.createProduct(payload);
      }
      showToast(res.message, 'success');
      resetProductForm();
      await loadAdminProducts();
    } catch (err) {
      showToast(err.message || 'Error al guardar el producto.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>💾 Guardar Producto</span>';
    }
  });
}

function showProductImagePreview(src) {
  const wrap = document.getElementById('prod-image-preview-wrap');
  const img = document.getElementById('prod-image-preview');
  if (!wrap || !img) return;
  if (src) {
    img.src = src;
    wrap.classList.remove('hidden');
  } else {
    img.src = '';
    wrap.classList.add('hidden');
  }
}

function clearProductImage() {
  const fileInput = document.getElementById('prod-image-file');
  const urlInput = document.getElementById('prod-image-url');
  if (fileInput) fileInput.value = '';
  if (urlInput) urlInput.value = '';
  showProductImagePreview('');
}

function resetProductForm() {
  const form = document.getElementById('admin-product-form');
  if (form) form.reset();
  const editId = document.getElementById('prod-edit-id');
  if (editId) editId.value = '';
  const title = document.getElementById('product-form-title');
  if (title) title.innerHTML = '<span>🍨</span> <span>Agregar Nuevo Producto</span>';
  const cancelBtn = document.getElementById('btn-cancel-edit-prod');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  const visibleCheck = document.getElementById('prod-visible');
  if (visibleCheck) visibleCheck.checked = true;
  clearProductImage();
}

async function loadAdminProducts() {
  const container = document.getElementById('admin-products-list');
  if (!container) return;

  try {
    const res = await API.getAdminProducts();
    const products = res.products || [];
    adminProductsCache = products;

    if (products.length === 0) {
      container.innerHTML = '<div class="text-center py-6 text-xs text-slate-400 font-medium">Aún no hay productos en el catálogo.</div>';
      return;
    }

    container.innerHTML = products.map(p => {
      const safeId = String(p.id).replace(/'/g, "\\'");
      const isVisible = p.is_visible === 1 || p.is_visible === true;
      const hasImg = Boolean(p.image_url && p.image_url.trim() !== '');

      return `
        <div class="p-3 rounded-2xl border ${isVisible ? 'bg-slate-50 border-slate-200/80' : 'bg-slate-100/70 border-slate-200 opacity-65'} flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              ${hasImg ? `<img src="${escapeHtml(p.image_url)}" alt="" class="w-full h-full object-cover" />` : `<span class="text-xl">${getCategoryEmoji(p.category)}</span>`}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h5 class="text-xs font-black text-slate-900 truncate">${escapeHtml(p.name)}</h5>
                <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full ${isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
                  ${isVisible ? 'Exhibido' : 'Oculto'}
                </span>
              </div>
              <div class="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                <span class="text-orange-600 font-black">S/ ${Number(p.price || 0).toFixed(2)}</span>
                <span>•</span>
                <span>${escapeHtml(p.category)}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button type="button" onclick="toggleProductVisibility('${safeId}', ${isVisible ? 1 : 0})" class="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-orange-300 text-xs cursor-pointer" title="${isVisible ? 'Ocultar de la web' : 'Mostrar en la web'}">
              ${isVisible ? '👁️' : '🙈'}
            </button>
            <button type="button" onclick="editAdminProduct('${safeId}')" class="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-teal-300 text-xs cursor-pointer" title="Editar producto">
              ✏️
            </button>
            <button type="button" onclick="deleteAdminProduct('${safeId}')" class="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-rose-300 text-xs cursor-pointer" title="Eliminar producto">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-500 text-center py-2">${escapeHtml(err.message)}</div>`;
  }
}

function editAdminProduct(productId) {
  const prod = adminProductsCache.find(p => String(p.id) === String(productId));
  if (!prod) return;

  document.getElementById('prod-edit-id').value = prod.id;
  document.getElementById('prod-name').value = prod.name || '';
  document.getElementById('prod-category').value = prod.category || 'Otros';
  document.getElementById('prod-price').value = prod.price || 0;
  document.getElementById('prod-description').value = prod.description || '';
  document.getElementById('prod-image-url').value = prod.image_url || '';
  document.getElementById('prod-visible').checked = prod.is_visible === 1 || prod.is_visible === true;

  showProductImagePreview(prod.image_url || '');

  const title = document.getElementById('product-form-title');
  if (title) title.innerHTML = `<span>✏️</span> <span>Editando: ${escapeHtml(prod.name)}</span>`;
  const cancelBtn = document.getElementById('btn-cancel-edit-prod');
  if (cancelBtn) cancelBtn.classList.remove('hidden');

  document.getElementById('admin-section-products')?.scrollIntoView({ behavior: 'smooth' });
}

async function toggleProductVisibility(productId, currentVisible) {
  try {
    const res = await API.updateProduct(productId, { is_visible: currentVisible ? 0 : 1 });
    showToast(res.message, 'success');
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteAdminProduct(productId) {
  if (!confirm('¿Deseas eliminar este producto permanentemente del catálogo?')) return;
  try {
    const res = await API.deleteProduct(productId);
    showToast(res.message, 'success');
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAdminStoreInfo() {
  try {
    const res = await API.getAdminStoreInfo();
    const info = res.storeInfo;
    if (!info) return;

    document.getElementById('store-name').value = info.store_name || 'NIJI Perú';
    document.getElementById('store-hero-title').value = info.hero_title || '';
    document.getElementById('store-hero-subtitle').value = info.hero_subtitle || '';
    document.getElementById('store-hero-image').value = info.hero_image_url || '/img/niji-logo.png';
    document.getElementById('store-whatsapp').value = info.whatsapp_number || '';
    document.getElementById('store-whatsapp-msg').value = info.whatsapp_message || '';
    document.getElementById('store-address').value = info.address || '';
    document.getElementById('store-schedule').value = info.schedule || '';
    document.getElementById('store-maps-query').value = info.maps_query || '';
    document.getElementById('store-maps-url').value = info.maps_url || '';
  } catch (err) {
    showToast('No se pudo cargar la configuración de tienda.', 'error');
  }
}

function setupAdminStoreInfoForm() {
  const form = document.getElementById('admin-store-info-form');
  const heroFile = document.getElementById('store-hero-file');
  const heroUrl = document.getElementById('store-hero-image');

  if (heroFile && !heroFile.dataset.listenerAttached) {
    heroFile.dataset.listenerAttached = 'true';
    heroFile.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        showToast('Optimizando imagen principal...', 'info', 2000);
        const compressed = await compressImageFile(file, 720, 0.8);
        if (heroUrl) heroUrl.value = compressed;
        showToast('Imagen lista para guardar.', 'success', 2000);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (!form || form.dataset.listenerAttached) return;
  form.dataset.listenerAttached = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-store-info');
    const payload = {
      store_name: document.getElementById('store-name').value.trim(),
      hero_title: document.getElementById('store-hero-title').value.trim(),
      hero_subtitle: document.getElementById('store-hero-subtitle').value.trim(),
      hero_image_url: document.getElementById('store-hero-image').value.trim(),
      whatsapp_number: document.getElementById('store-whatsapp').value.trim(),
      whatsapp_message: document.getElementById('store-whatsapp-msg').value.trim(),
      address: document.getElementById('store-address').value.trim(),
      schedule: document.getElementById('store-schedule').value.trim(),
      maps_query: document.getElementById('store-maps-query').value.trim(),
      maps_url: document.getElementById('store-maps-url').value.trim()
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> <span>Guardando...</span>';

    try {
      const res = await API.updateAdminStoreInfo(payload);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message || 'Error al guardar información de tienda.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>💾 Guardar Información de Tienda</span>';
    }
  });
}

// Exponer funciones globales para eventos inline del DOM
window.openLoyaltyApp = openLoyaltyApp;
window.filterLandingCategory = filterLandingCategory;
window.downloadClientsCSV = downloadClientsCSV;
window.setClientsFilter = setClientsFilter;
window.deactivateAdminPromotion = deactivateAdminPromotion;
window.editAdminProduct = editAdminProduct;
window.resetProductForm = resetProductForm;
window.clearProductImage = clearProductImage;
window.toggleProductVisibility = toggleProductVisibility;
window.deleteAdminProduct = deleteAdminProduct;
window.loadAdminProducts = loadAdminProducts;
