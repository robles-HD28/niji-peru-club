const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./db');

function seed() {
  initDatabase();

  try {
    // Asegurar cuentas oficiales de administrador (NijiPeru28 y NijiCaja26)
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

    const hashCaja = bcrypt.hashSync('Caja#Niji2026', salt);
    const existingCaja = db.prepare("SELECT * FROM users WHERE pseudonym = 'NijiCaja26' COLLATE NOCASE").get();

    if (!existingCaja) {
      db.prepare(`
        INSERT INTO users (pseudonym, email, birthdate, password_hash, role, stamps, has_spun_wheel, welcome_prize)
        VALUES ('NijiCaja26', 'caja@nijiperu.com', '2000-01-01', ?, 'admin', 0, 1, 'Staff Oficial')
      `).run(hashCaja);
    } else {
      db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?").run(hashCaja, existingCaja.id);
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

    // Inicializar productos iniciales en SQLite si está vacío
    const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get()?.count || 0;
    if (prodCount === 0) {
      const insertProd = db.prepare(`
        INSERT INTO products (name, category, price, description, image_url, is_visible)
        VALUES (?, ?, ?, ?, ?, 1)
      `);
      const defaultProds = [
        ['Cuchareable Choco-Lúcuma', 'Cuchareables', 14.00, 'Bizcocho húmedo de chocolate belga, mousse suave de lúcuma peruana y topping crocante.', ''],
        ['Cuchareable Tres Leches Berry', 'Cuchareables', 13.50, 'Clásico tres leches cremoso acompañado de compota artesanal de frutos rojos.', ''],
        ['Raspadilla Artesanal Clásica', 'Raspadillas', 8.00, 'Hielo granizado súper fino con jarabes de fruta 100% natural: fresa, maracuyá o mango.', ''],
        ['Raspadilla Especial NIJI Mix', 'Raspadillas', 11.00, 'Doble sabor frutal con leche condensada, jalea dulce y trozos de fruta fresca.', ''],
        ['Pack Mochis Kawaii (x3)', 'Postres', 12.00, 'Suaves bocaditos japoneses rellenos de crema pastelera, matcha y fresa.', '']
      ];
      for (const p of defaultProds) {
        insertProd.run(...p);
      }
    }

    // Inicializar store_info en SQLite si no existe
    const infoExists = db.prepare("SELECT id FROM store_info WHERE id = 'main'").get();
    if (!infoExists) {
      db.prepare(`
        INSERT INTO store_info (id, store_name, hero_title, hero_subtitle, hero_image_url, whatsapp_number, whatsapp_message, address, schedule, maps_query, maps_url)
        VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'NIJI Perú',
        '¡Endulza tu día con el auténtico sabor kawaii!',
        'Descubre nuestros cuchareables artesanales, raspadillas refrescantes y postres únicos preparados cada día para ti.',
        '/img/niji-logo.png',
        'https://wa.me/message/5WW2JMTOWA47J1',
        '¡Hola NIJI Perú! Quisiera hacer un pedido o consultar sobre sus productos.',
        'Piura 20009, Perú — NIJI Perú',
        'Lun - Dom: 12:00 PM - 9:00 PM',
        'Niji Perú, Piura 20009',
        'https://maps.app.goo.gl/qbLnkaY5zTVMrvTG9?g_st=aw'
      );
    }
  } catch (seedErr) {
    console.warn('ℹ️ Seed SQLite omitido en entorno serverless.');
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
