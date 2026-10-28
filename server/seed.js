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

  // Inicializar premios de la Ruleta Spin-to-Win oficial (si no existen)
  const existingPrizes = db.prepare('SELECT COUNT(*) as count FROM wheel_prizes').get().count;
  if (existingPrizes === 0) {
    const insertPrize = db.prepare(`
      INSERT INTO wheel_prizes (title, description, type, value, color, text_color, weight)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const prizes = [
      { title: '⭐ 1 Sello Extra', description: '¡Inicias tu tarjeta con 1 sello acumulado de inmediato!', type: 'stamp', value: 1, color: '#ff7e29', text_color: '#ffffff', weight: 3 },
      { title: '🍹 Bebida Gratis', description: 'Una bebida artesanal NIJI a elección en tu próxima compra', type: 'gift', value: 0, color: '#ff4d5a', text_color: '#ffffff', weight: 2 },
      { title: '🏷️ 15% Descuento', description: '15% de descuento en tu compra mínima de S/ 15', type: 'discount', value: 15, color: '#0d9488', text_color: '#ffffff', weight: 2 },
      { title: '🍡 Postre Mochi', description: 'Un delicioso mochi tradicional japonés gratis', type: 'gift', value: 0, color: '#f43f5e', text_color: '#ffffff', weight: 2 },
      { title: '💰 Vale S/ 5', description: 'Vale de S/ 5 de descuento directo en caja', type: 'discount', value: 5, color: '#f59e0b', text_color: '#ffffff', weight: 2 },
      { title: '🎁 Pack Stickers NIJI', description: 'Set coleccionable de stickers holográficos del gatito NIJI', type: 'gift', value: 0, color: '#0d9488', text_color: '#ffffff', weight: 3 }
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
