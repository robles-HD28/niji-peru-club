# 🌈 NIJI Perú - Aplicación Web PWA de Fidelización y Gamificación

Aplicación web móvil progresiva (**PWA**) y sistema de fidelización de clientes para la tienda física **NIJI Perú**. Diseñada con arquitectura Full-Stack, separación estricta de roles (**Cliente** y **Administrador/Cajero**), tarjeta virtual de 5 sellos, ruleta interactiva de bienvenida (*Spin-to-Win*) y panel de gestión de personal.

---

## 📱 Características Principales

### Módulo 1: Autenticación y Registro Gamificado (Vista Cliente)
- **Registro personalizado:** Captura obligatoria de `Pseudónimo`, `Correo electrónico`, `Fecha de nacimiento`, `Contraseña` y `Confirmación de contraseña`.
- **Inicio de sesión ágil:** Acceso mediante **Pseudónimo** y **Contraseña**.
- **Ruleta Spin-to-Win:** Redirección automática por **única vez** tras el registro para reclamar un premio de bienvenida físico en tienda o sellos directos (animación física en Canvas con audio sintetizado Web Audio API y confeti).

### Módulo 2: Tarjeta de Sellos Digital (Vista Cliente)
- **Tarjeta virtual VIP:** Visualizador interactivo de **5 casilleros** con estampado dinámico estilo sello japonés *Hanko*.
- **Regla de negocio visible:** *"Se otorga un sello por cada S/ 5 de consumo y la actualización se procesa al cierre del día."*
- **Personalización por fecha de nacimiento:** 
  - Saludo especial y beneficio si hoy es su cumpleaños.
  - Alerta si se encuentra en el mes de su cumpleaños.
  - Cuenta regresiva de días para el próximo cumpleaños.
- **Recompensa por 5 sellos:** Al alcanzar los 5 sellos, se aplica un **bloqueo temporal** a la tarjeta y se genera un **Cupón Digital** con código único y código de barras interactivo en pantalla para canje en caja.

### Módulo 3: Panel de Administración (Vista Cajero / Admin)
- **Acceso independiente:** Portal exclusivo y seguro para el personal de tienda (`/#admin-login`).
- **Buscador en tiempo real:** Búsqueda instantánea de clientes ingresando su pseudónimo.
- **Ficha detallada del cliente:** Perfil completo, fecha de nacimiento, alerta si hoy cumple años, historial de auditoría y saldo actual de sellos (0 a 5).
- **Acción rápida "+1 Sello":** Actualización manual del saldo al final de la jornada.
- **Canje y reseteo:** Validador de cupones para canjear la recompensa y reiniciar el ciclo de la tarjeta a 0/5.
- **📢 Promociones Programadas con Temporizador:** Módulo para publicar anuncios y ofertas en el panel del cliente con expiración automática (2h, 6h, 12h, 24h, 3 días, 7 días). Al vencer el tiempo, el mensaje se retira automáticamente.

---

## 🗄️ Esquema de Base de Datos Relacional (SQLite)

```sql
-- 1. Tabla de Usuarios (Clientes y Personal)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pseudonym TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  birthdate TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'client')) DEFAULT 'client',
  stamps INTEGER NOT NULL DEFAULT 0 CHECK(stamps >= 0 AND stamps <= 5),
  has_spun_wheel INTEGER NOT NULL DEFAULT 0,
  welcome_prize TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 2. Tabla de Premios de la Ruleta Spin-to-Win
CREATE TABLE wheel_prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'gift',
  value INTEGER DEFAULT 0,
  color TEXT NOT NULL,
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  weight INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 3. Tabla de Cupones Digitales (Recompensas al completar 5 sellos)
CREATE TABLE coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'redeemed', 'expired')) DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  redeemed_at TEXT DEFAULT NULL,
  redeemed_by_admin_id INTEGER DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (redeemed_by_admin_id) REFERENCES users(id)
);

-- 4. Tabla de Historial y Auditoría de Sellos
CREATE TABLE stamps_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  admin_id INTEGER NOT NULL,
  stamps_added INTEGER NOT NULL,
  stamps_before INTEGER NOT NULL,
  stamps_after INTEGER NOT NULL,
  notes TEXT DEFAULT 'Asignación de sello en cierre de jornada',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);
```

---

## 🚀 Puesta en Marcha

### Requisitos
- **Node.js** (v22.5.0 o superior, utiliza el motor nativo `node:sqlite`).

### Iniciar la Aplicación
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor y sembrar base de datos
npm start
```

La aplicación quedará disponible en:
- **Vista Principal (PWA Móvil / Cliente):** [http://localhost:3000](http://localhost:3000)
- **Portal de Personal / Cajero:** [http://localhost:3000/#admin-login](http://localhost:3000/#admin-login)

---

## 🧪 Credenciales de Demostración y Prueba

| Rol | Pseudónimo | Contraseña | Estado / Particularidad |
| :--- | :--- | :--- | :--- |
| **Cajero / Admin** | `admin_cajero` | `Admin123!` | Acceso completo al Panel de Tienda y asignación de sellos |
| **Cliente** | `sakura_lima` | `Cliente123!` | Tiene **4 de 5 sellos** (lista para completar su tarjeta) |
| **Cliente** | `kenji_peru` | `Cliente123!` | **Cumpleaños HOY** (muestra felicitación y promo especial) |
| **Cliente** | `hiroshi_callao` | `Cliente123!` | Tiene **5 sellos y Cupón Activo** listo para canjear en caja |
| **Cliente** | `mariana_surco` | `Cliente123!` | **Giro de Ruleta Pendiente** (para probar la Ruleta Spin-to-Win) |

---

## 🛡️ Pruebas Automatizadas

Se incluye una suite de pruebas de integración completa que verifica los 3 módulos:
```bash
node test-integration.js
```
*Supera las 26 pruebas automáticas de registro, ruleta única, cálculo de cumpleaños, regla de negocio, bloqueo temporal de tarjeta a los 5 sellos, generación de cupón, y canje por el administrador.*
