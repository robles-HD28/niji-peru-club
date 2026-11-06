const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./db');

function seed() {
  initDatabase();

  try {
    // Asegurar cuenta oficial de administrador NijiPeru28
    const salt = bcrypt.genSaltSync(10);
    const hashAdmin = bcrypt.hashSync('Niji#2811Peru', salt);
    const existing = db.prepare("SELECT * FROM users WHERE pseudonym = 'NijiPeru28' COLLATE NOCASE").get();

    if (!existing) {
      db.prepare(`
        INSERT INTO users (pseudonym, email, birthdate, password_hash, role, stamps, has_spun_wheel, welcome_prize)
        VALUES ('NijiPeru28', 'staff@nijiperu.com', '2000-01-01', ?, 'admin', 0, 1, 'Staff Oficial')
      `).run(hashAdmin);
    } else {
      db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?").run(hashAdmin, existing.id);
    }

    // Inicializar premios de la Ruleta Spin-to-Win oficial (exactamente 6 opciones simétricas)
    const currentPrizes = db.prepare('SELECT COUNT(*) as count FROM wheel_prizes').get()?.count || 0;
    const firstPrize = db.prepare('SELECT title FROM wheel_prizes LIMIT 1').get();

    if (currentPrizes !== 6 || !firstPrize || firstPrize.title !== '🍧 Raspadilla') {
      db.exec('DELETE FROM wheel_prizes;');
      const insertPrize = db.prepare(`
        INSERT INTO wheel_prizes (title, description, type, value, color, text_color, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const prizes = [
        { title: '🍧 Raspadilla', description: '¡Una deliciosa raspadilla artesanal refrescante de regalo!', type: 'gift', value: 0, color: '#0d9488', text_color: '#ffffff', weight: 1 },
        { title: '⭐ +1 Sello', description: '¡Se añade automáticamente 1 sello a tu tarjeta virtual!', type: 'stamp', value: 1, color: '#ff7e29', text_color: '#ffffff', weight: 2 },
        { title: '✏️ Lapicero', description: '¡Te ganaste un lapicero oficial coleccionable de NIJI Perú!', type: 'gift', value: 0, color: '#ff4d5a', text_color: '#ffffff', weight: 2 },
        { title: '🍍 Sin Premio', description: '¡Mala suerte esta vez! No hay premio, pero sigues acumulando sellos.', type: 'none', value: 0, color: '#f59e0b', text_color: '#ffffff', weight: 1 },
        { title: '⭐ +1 Sello', description: '¡Se añade automáticamente 1 sello a tu tarjeta virtual!', type: 'stamp', value: 1, color: '#ff7e29', text_color: '#ffffff', weight: 2 },
        { title: '✏️ Lapicero', description: '¡Te ganaste un lapicero oficial coleccionable de NIJI Perú!', type: 'gift', value: 0, color: '#ff4d5a', text_color: '#ffffff', weight: 2 }
      ];

      for (const prize of prizes) {
        insertPrize.run(prize.title, prize.description, prize.type, prize.value, prize.color, prize.text_color, prize.weight);
      }
    }
  } catch (seedErr) {
    console.warn('ℹ️ Seed SQLite omitido en entorno serverless.');
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
