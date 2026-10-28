const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new DatabaseSync(DB_PATH);

// Activar soporte de claves foráneas y modo WAL para concurrencia
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  // 1. Tabla de Usuarios (Pseudónimo, Correo, Fecha de nacimiento, Hash de contraseña, Rol, Sellos)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
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
  `);

  // 2. Tabla de Premios de la Ruleta Spin-to-Win
  db.exec(`
    CREATE TABLE IF NOT EXISTS wheel_prizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'gift', -- 'stamp', 'discount', 'gift'
      value INTEGER DEFAULT 0,
      color TEXT NOT NULL,
      text_color TEXT NOT NULL DEFAULT '#ffffff',
      weight INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `);

  // 3. Tabla de Cupones Digitales (Recompensa de 5 sellos o promociones)
  db.exec(`
    CREATE TABLE IF NOT EXISTS coupons (
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
  `);

  // 4. Tabla de Historial de Sellos (Trazabilidad y auditoría)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stamps_history (
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
  `);

  // 5. Tabla de Promociones y Avisos Programados (Vista Cliente & Admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'PROMO',
      starts_at TEXT DEFAULT (datetime('now', 'localtime')),
      expires_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (admin_id) REFERENCES users(id)
    );
  `);

  // Índices para optimizar búsquedas frecuentes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_pseudonym ON users(pseudonym);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
    CREATE INDEX IF NOT EXISTS idx_stamps_history_user ON stamps_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, expires_at);
  `);
}

module.exports = {
  db,
  initDatabase
};
