const path = require('node:path');

let db = null;
let sqliteAvailable = false;

try {
  // node:sqlite está disponible en Node 22.5+, pero en Vercel el filesystem es efímero y la versión default puede ser Node 20
  const { DatabaseSync } = require('node:sqlite');
  const DB_PATH = process.env.VERCEL ? path.join('/tmp', 'database.sqlite') : path.join(__dirname, 'database.sqlite');
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  sqliteAvailable = true;
} catch (err) {
  console.warn('⚠️ SQLite nativo no disponible en este entorno serverless. Usando Firestore como motor principal.');
  // Mock seguro para evitar crashes si alguna función accede a db cuando Firestore está activo
  db = {
    exec: () => {},
    prepare: () => ({
      get: () => null,
      all: () => [],
      run: () => ({ changes: 0, lastInsertRowid: 0 })
    })
  };
}

function initDatabase() {
  if (!sqliteAvailable) return;

  try {
    // 1. Tabla de Usuarios
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
        accepts_promotions INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    try {
      db.exec(`ALTER TABLE users ADD COLUMN accepts_promotions INTEGER NOT NULL DEFAULT 1;`);
    } catch (e) {}

    // 2. Tabla de Premios de la Ruleta
    db.exec(`
      CREATE TABLE IF NOT EXISTS wheel_prizes (
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
    `);

    // 3. Tabla de Cupones Digitales
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

    // 4. Tabla de Historial de Sellos
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

    // 5. Tabla de Promociones
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

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_pseudonym ON users(pseudonym);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id);
      CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
      CREATE INDEX IF NOT EXISTS idx_stamps_history_user ON stamps_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, expires_at);
    `);
  } catch (err) {
    console.warn('⚠️ Error inicializando SQLite local:', err.message);
  }
}

module.exports = {
  db,
  initDatabase
};
