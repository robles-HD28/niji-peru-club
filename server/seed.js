const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./db');

function seed() {
  initDatabase();

  console.log('🔄 Inicializando base de datos oficial NIJI Perú...');

  // Si ya existen administradores, no duplicar
  const existingAdmins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
  if (existingAdmins >= 2) {
    console.log(`ℹ️ La base de datos ya contiene ${existingAdmins} administradores configurados.`);
    return;
  }

  // Generar hashes de contraseñas seguros
  const salt = bcrypt.genSaltSync(10);
  const hashAdmin1 = bcrypt.hashSync('NijiPeru#2026Admin', salt);
  const hashAdmin2 = bcrypt.hashSync('Niji#Caja2026!', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (pseudonym, email, birthdate, password_hash, role, stamps, has_spun_wheel, welcome_prize)
    VALUES (?, ?, ?, ?, 'admin', 0, 1, 'Staff Oficial')
  `);

  // 1. Administrador General de Tienda
  insertUser.run(
    'admin_niji',
    'admin@nijiperu.com',
    '1990-01-01',
    hashAdmin1
  );

  // 2. Cuenta de Caja / Personal de Tienda
  insertUser.run(
    'caja_tienda',
    'caja@nijiperu.com',
    '1995-05-15',
    hashAdmin2
  );

  // Inicializar premios de la Ruleta Spin-to-Win oficial (exactamente 6 opciones)
  const currentPrizes = db.prepare('SELECT COUNT(*) as count FROM wheel_prizes').get().count;
  const firstPrize = db.prepare('SELECT title FROM wheel_prizes LIMIT 1').get();

  if (currentPrizes !== 6 || !firstPrize || firstPrize.title !== 'Lapicero') {
    db.exec('DELETE FROM wheel_prizes;');
    const insertPrize = db.prepare(`
      INSERT INTO wheel_prizes (title, description, type, value, color, text_color, weight)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const prizes = [
      { title: 'Lapicero', description: '¡Te ganaste un lapicero oficial coleccionable de NIJI Perú!', type: 'gift', value: 0, color: '#ff4d5a', text_color: '#ffffff', weight: 2 },
      { title: 'Raspadilla', description: '¡Una deliciosa raspadilla artesanal refrescante gratis!', type: 'gift', value: 0, color: '#0d9488', text_color: '#ffffff', weight: 2 },
      { title: 'Un sello', description: '¡Se añade automáticamente 1 sello a tu tarjeta virtual!', type: 'stamp', value: 1, color: '#ff7e29', text_color: '#ffffff', weight: 2 },
      { title: '🍍', description: '¡Mala suerte esta vez! No hay premio, pero sigues acumulando sellos.', type: 'none', value: 0, color: '#f59e0b', text_color: '#ffffff', weight: 2 },
      { title: '🍍', description: '¡Mala suerte esta vez! No hay premio, pero sigues acumulando sellos.', type: 'none', value: 0, color: '#f43f5e', text_color: '#ffffff', weight: 2 },
      { title: 'Vuelve a girar', description: '¡Qué suerte! Tienes un segundo tiro gratis. ¡Gira otra vez!', type: 'spin_again', value: 0, color: '#8b5cf6', text_color: '#ffffff', weight: 2 }
    ];

    for (const prize of prizes) {
      insertPrize.run(prize.title, prize.description, prize.type, prize.value, prize.color, prize.text_color, prize.weight);
    }
  }

  console.log('✅ Base de datos de producción configurada con éxito.');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
