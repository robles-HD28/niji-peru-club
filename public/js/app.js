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

function goToHome() {
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

function logout() {
  API.setToken(null);
  API.setCurrentUser(null);
  updateNavbar();
  showToast('Has cerrado sesión correctamente.', 'info');
  navigateTo('#login');
}

function updateNavbar() {
  const user = API.getCurrentUser();
  const navQuick = document.getElementById('nav-quick-links');
  const navUser = document.getElementById('nav-user-info');
  const navUsername = document.getElementById('nav-username');
  const roleBadge = document.getElementById('role-badge');

  if (user) {
    if (navQuick) navQuick.classList.add('hidden');
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
    if (navQuick) navQuick.classList.remove('hidden');
    if (navUser) navUser.classList.add('hidden');
    if (roleBadge) {
      roleBadge.textContent = 'INVITADO';
      roleBadge.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200';
    }
  }
}

async function handleRoute() {
  const hash = window.location.hash || '#login';
  currentView = hash;
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

  if (hash === '#login') {
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
    renderClientLoginView(appView);
  }
}

/* ==========================================================================
   VISTA 1: LOGIN CLIENTE (TEMA CLARO PASTEL)
   ========================================================================== */
function renderClientLoginView(container) {
  container.innerHTML = `
    <div class="space-y-5 max-w-sm mx-auto w-full my-auto py-2">
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
        <p class="text-[11px] text-slate-500">
          ¿Personal de tienda? 
          <a href="#admin-login" class="text-teal-700 hover:underline font-bold">Portal Cajero / Admin</a>
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
    <div class="space-y-4 max-w-sm mx-auto w-full py-2">
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
    <div class="flex flex-col items-center justify-between text-center max-w-sm mx-auto w-full py-2 space-y-3">
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
        <button id="btn-spin-wheel" class="btn-primary w-full py-3.5 rounded-2xl text-base font-black tracking-wide flex items-center justify-center gap-3 pulse-glow shadow-xl">
          <span class="text-xl">🐾</span>
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
          const isSpinAgain = awardedPrize.type === 'spin_again';
          const isNone = awardedPrize.type === 'none';
          const isStamp = awardedPrize.type === 'stamp';

          if (isSpinAgain) {
            SoundEffects.playCoin();
          } else if (isNone) {
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

          if (isSpinAgain) {
            statusPill.textContent = '🔄 ¡TIRO ADICIONAL!';
            prizeTitle.textContent = '¡Vuelve a girar!';
            prizeDesc.textContent = '¡Qué suerte! Has obtenido un segundo giro libre de bienvenida. ¡Gira la ruleta otra vez!';
            stampBadge.classList.add('hidden');
            actionBtn.textContent = '¡Girar de Nuevo! 🎯';
            actionBtn.onclick = () => {
              document.getElementById('prize-modal').classList.add('hidden');
              spinBtn.disabled = false;
              spinBtn.innerHTML = '<span class="text-xl">🐾</span> <span>¡GIRAR RULETA AHORA!</span> <span class="text-xl">✨</span>';
            };
          } else if (isNone) {
            statusPill.textContent = '🍍 RESULTADO';
            prizeTitle.textContent = '¡Te tocó Piña!';
            prizeDesc.textContent = 'Mala suerte esta vez, no obtuviste premio en la ruleta. ¡Pero tu tarjeta ya está lista para acumular sellos por tus compras!';
            stampBadge.classList.add('hidden');
            actionBtn.textContent = 'Ir a mi Tarjeta de Sellos →';
            actionBtn.onclick = () => navigateTo('#tarjeta');
          } else if (isStamp) {
            statusPill.textContent = '⭐ ¡PREMIO GANADO!';
            prizeTitle.textContent = '¡Un Sello Extra!';
            prizeDesc.textContent = awardedPrize.description || '¡Inicias tu tarjeta con 1 sello acumulado!';
            stampBadge.classList.remove('hidden');
            stampBadge.textContent = '⭐ ¡Se añadió automáticamente 1 sello a tu tarjeta virtual!';
            actionBtn.textContent = 'Ver mi Tarjeta de Sellos →';
            actionBtn.onclick = () => navigateTo('#tarjeta');
          } else {
            statusPill.textContent = '🎁 ¡PREMIO GANADO!';
            prizeTitle.textContent = awardedPrize.title;
            prizeDesc.textContent = awardedPrize.description;
            stampBadge.classList.remove('hidden');
            stampBadge.textContent = `🎁 Presenta este premio en caja: ${awardedPrize.title}`;
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

    // Casilleros de los 5 sellos
    let stampSlotsHTML = '';
    for (let i = 1; i <= 5; i++) {
      const isStamped = i <= stamps;
      const isGoal = i === 5;

      if (isGoal) {
        // El 5to sello (Meta Final): Obligatoriamente una estrella ⭐
        stampSlotsHTML += `
          <div class="flex flex-col items-center gap-1.5">
            <div class="stamp-slot slot-goal ${isStamped ? 'stamped' : 'empty'} relative">
              ${isStamped 
                ? `<span class="text-white text-2xl select-none drop-shadow-md">⭐</span>` 
                : `<span class="text-amber-500 font-black text-2xl select-none opacity-85">⭐</span>`
              }
            </div>
            <span class="text-[10px] font-black ${isStamped ? 'text-amber-600' : 'text-amber-700/80'} flex items-center gap-0.5">
              <span>⭐</span> Meta
            </span>
          </div>
        `;
      } else {
        // Primeros 4 sellos regulares: Huellita de gatito 🐾
        stampSlotsHTML += `
          <div class="flex flex-col items-center gap-1.5">
            <div class="stamp-slot ${isStamped ? 'stamped' : 'empty'}">
              ${isStamped 
                ? `<span class="text-white text-2xl select-none drop-shadow">🐾</span>` 
                : `<span class="text-slate-400 font-black text-sm select-none">${i}</span>`
              }
            </div>
            <span class="text-[10px] font-bold ${isStamped ? 'text-orange-600' : 'text-slate-400'}">
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
      <div class="space-y-4 max-w-sm mx-auto w-full py-2">
        
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
    <div class="space-y-5 max-w-sm mx-auto w-full my-auto py-3">
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
    <div class="space-y-4 max-w-sm mx-auto w-full py-2">
      
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
      <div class="grid grid-cols-3 gap-2">
        <div class="glass-panel p-3 rounded-2xl text-center">
          <span class="text-[10px] text-slate-500 block font-bold">Clientes</span>
          <span class="text-lg font-black text-slate-900">${m.totalClients}</span>
        </div>
        <div class="glass-panel p-3 rounded-2xl text-center">
          <span class="text-[10px] text-orange-600 block font-bold">Tarjetas 5/5</span>
          <span class="text-lg font-black text-orange-600">${m.cardsCompleted}</span>
        </div>
        <div class="glass-panel p-3 rounded-2xl text-center">
          <span class="text-[10px] text-teal-700 block font-bold">Sellos Hoy</span>
          <span class="text-lg font-black text-teal-700">${m.todayStamps}</span>
        </div>
      </div>

      <!-- SELECTOR DE PESTAÑAS (CLIENTES VS PROMOCIONES) -->
      <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
        <button id="admin-tab-clients-btn" onclick="switchAdminTab('clients')" class="flex-1 py-2 rounded-xl text-xs font-black transition bg-white text-slate-900 shadow-xs flex items-center justify-center gap-1.5">
          <span>👥</span>
          <span>Clientes & Sellos</span>
        </button>
        <button id="admin-tab-promos-btn" onclick="switchAdminTab('promos')" class="flex-1 py-2 rounded-xl text-xs font-bold transition text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5">
          <span>📢</span>
          <span>Promociones</span>
        </button>
      </div>

      <!-- PESTAÑA 1: GESTIÓN DE CLIENTES Y SELLOS -->
      <div id="admin-section-clients" class="glass-panel p-4 rounded-3xl space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>🔍</span>
            <span>Buscador Rápido de Clientes</span>
          </label>
          <span class="text-[10px] text-orange-600 font-black">Por Pseudónimo</span>
        </div>

        <div class="relative">
          <span class="absolute left-3.5 top-2.5 text-orange-500 font-black text-xs">@</span>
          <input type="text" id="admin-search-input" placeholder="Buscar por pseudónimo (ej: sakura)..." class="glass-input w-full pl-8 pr-4 py-2 rounded-2xl text-xs" />
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

    </div>
  `;

  loadAdminClients('');

  let searchTimeout;
  const searchInput = document.getElementById('admin-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadAdminClients(e.target.value);
      }, 250);
    });
  }
}

async function loadAdminClients(query = '') {
  const container = document.getElementById('clients-list-container');
  if (!container) return;

  try {
    const res = await API.searchClients(query);
    const clients = res.clients || [];

    if (clients.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 text-xs text-slate-500 font-medium">
          No se encontraron clientes con el pseudónimo "${query}".
        </div>
      `;
      return;
    }

    container.innerHTML = clients.map(c => `
      <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition flex items-center justify-between gap-2 shadow-2xs">
        <div class="space-y-0.5 cursor-pointer flex-1" onclick="navigateTo('#admin-cliente/${c.id}')">
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs text-slate-900">@${c.pseudonym}</span>
            ${c.isBirthdayToday ? '<span class="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">🎂 Cumple Hoy</span>' : ''}
          </div>
          <div class="flex items-center gap-2 text-[10px] text-slate-500">
            <span>${c.email}</span>
            <span>•</span>
            <span class="font-mono ${c.stamps >= 5 ? 'text-rose-600 font-black' : 'text-orange-600 font-bold'}">${c.stamps}/5 sellos</span>
            ${c.stamps >= 5 ? '<span class="bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded text-[9px] font-bold">¡Completo!</span>' : ''}
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          ${c.stamps >= 5 ? `
            <!-- Botón Rápido de Reiniciar Tarjeta a 0 al completar los 5 sellos -->
            <button onclick="quickResetCard(${c.id}, '${c.pseudonym}')" class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1 shadow-xs" title="Tarjeta Completa: Reiniciar a 0 para nuevo ciclo">
              <span>🔄</span>
              <span>Reset 0</span>
            </button>
          ` : `
            <!-- Botón Rápido de +1 Sello -->
            <button onclick="quickAddStamp(${c.id}, '${c.pseudonym}')" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs" title="Asignar +1 Sello al cierre de jornada">
              <span>+1</span>
              <span class="text-[10px]">Sello</span>
            </button>
          `}
          
          <button onclick="navigateTo('#admin-cliente/${c.id}')" class="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs" title="Ver Ficha Detallada">
            👁️
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-500 text-center py-2">${err.message}</div>`;
  }
}

async function quickAddStamp(clientId, pseudonym) {
  try {
    const res = await API.addStamp({ clientId });
    SoundEffects.playStamp();
    showToast(res.message, 'success');
    loadAdminClients(document.getElementById('admin-search-input')?.value || '');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function quickResetCard(clientId, pseudonym) {
  if (!confirm(`¿Deseas reiniciar la tarjeta de @${pseudonym} a 0 sellos para iniciar un nuevo ciclo de compras?`)) {
    return;
  }
  try {
    const res = await API.resetClientCard({ clientId });
    SoundEffects.playVictory();
    showToast(res.message, 'success');
    loadAdminClients(document.getElementById('admin-search-input')?.value || '');
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
          <div class="stamp-slot slot-goal ${isStamped ? 'stamped' : 'empty'} w-10 h-10 text-sm">
            ⭐
          </div>
        `;
      } else {
        clientStampSlots += `
          <div class="stamp-slot ${isStamped ? 'stamped' : 'empty'} w-10 h-10 text-xs">
            ${isStamped ? '🐾' : i}
          </div>
        `;
      }
    }

    const activeCoupon = client.coupons.find(c => c.status === 'active');

    container.innerHTML = `
      <div class="space-y-4 max-w-sm mx-auto w-full py-2">
        
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
            <button onclick="resetCardFromDetail(${client.id}, '${client.pseudonym}')" class="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-orange-600 text-white w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-md transition">
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

            <button onclick="redeemClientCoupon('${activeCoupon.code}', ${client.id})" class="btn-teal w-full py-2.5 rounded-2xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
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
  btn.disabled = true;

  try {
    const res = await API.addStamp({ clientId: currentClientDetail.id });
    SoundEffects.playStamp();
    showToast(res.message, 'success');
    await renderClientDetailAdminView(document.getElementById('app-view'), currentClientDetail.id);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

async function resetCardFromDetail(clientId, pseudonym) {
  if (!confirm(`¿Confirmas el reinicio de la tarjeta de @${pseudonym} a 0 sellos? Su cupón quedará marcado como entregado y el cliente podrá empezar un nuevo ciclo de sellos.`)) {
    return;
  }

  try {
    const res = await API.resetClientCard({ clientId });
    SoundEffects.playVictory();
    showToast(res.message, 'success');
    await renderClientDetailAdminView(document.getElementById('app-view'), clientId);
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
  const clientsSection = document.getElementById('admin-section-clients');
  const promosSection = document.getElementById('admin-section-promos');
  const clientsBtn = document.getElementById('admin-tab-clients-btn');
  const promosBtn = document.getElementById('admin-tab-promos-btn');

  if (!clientsSection || !promosSection) return;

  if (tab === 'clients') {
    clientsSection.classList.remove('hidden');
    promosSection.classList.add('hidden');

    clientsBtn.className = 'flex-1 py-2 rounded-xl text-xs font-black transition bg-white text-slate-900 shadow-xs flex items-center justify-center gap-1.5';
    promosBtn.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5';
  } else {
    clientsSection.classList.add('hidden');
    promosSection.classList.remove('hidden');

    promosBtn.className = 'flex-1 py-2 rounded-xl text-xs font-black transition bg-white text-slate-900 shadow-xs flex items-center justify-center gap-1.5';
    clientsBtn.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5';

    loadAdminPromotions();
    setupCreatePromoForm();
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
      const isExpired = p.is_expired === 1 || p.is_active === 0;

      let remainingBadge = '';
      if (isExpired) {
        remainingBadge = '<span class="text-[9px] bg-slate-200 text-slate-500 font-bold px-2 py-0.5 rounded-full">Expirada / Inactiva</span>';
      } else {
        const mins = p.minutes_remaining;
        const timeText = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
        remainingBadge = `<span class="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full">⏳ Quedan ${timeText}</span>`;
      }

      return `
        <div class="p-3 rounded-2xl ${isExpired ? 'bg-slate-100/60 opacity-60' : 'bg-slate-50 border border-slate-200/80'} text-xs space-y-1.5 shadow-2xs">
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${p.tag === 'FLASH' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}">
              ${p.tag}
            </span>
            ${remainingBadge}
          </div>

          <h5 class="font-black text-slate-900">${p.title}</h5>
          <p class="text-[11px] text-slate-600 font-medium">${p.message}</p>

          <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-400">
            <span>Por: @${p.admin_pseudonym}</span>
            ${!isExpired ? `
              <button onclick="deleteAdminPromotion(${p.id}, '${p.title}')" class="text-rose-600 font-bold hover:underline flex items-center gap-1">
                <span>🗑️ Desactivar</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-500 text-center py-2">${err.message}</div>`;
  }
}

async function deleteAdminPromotion(id, title) {
  if (!confirm(`¿Deseas retirar de inmediato la promoción "${title}" del panel de clientes?`)) {
    return;
  }

  try {
    const res = await API.deletePromotion(id);
    showToast(res.message, 'info');
    loadAdminPromotions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
