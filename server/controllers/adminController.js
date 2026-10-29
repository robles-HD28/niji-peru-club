const crypto = require('node:crypto');
const { db } = require('../db');
const firestore = require('../firestore');
const { getBirthdayStatus } = require('../utils/birthday');

/**
 * Buscar clientes por pseudónimo, correo o fecha de nacimiento (Buscador rápido para el cajero)
 */
async function searchClients(req, res) {
  try {
    const query = (req.query.q || '').trim();
    const filter = (req.query.filter || 'all').toLowerCase(); // 'all', 'birthday_today', 'birthday_month'
    let clients = [];

    if (firestore.isFirestoreConfigured()) {
      const allClients = await firestore.getAllClients(query);
      const allCoupons = await firestore.queryCollection('coupons');
      const activeCouponsMap = {};

      allCoupons.forEach(c => {
        if (c.status === 'active') {
          const userKey = (c.user_pseudonym || '').toLowerCase();
          activeCouponsMap[userKey] = (activeCouponsMap[userKey] || 0) + 1;
        }
      });

      // Ordenar: recientes primero
      const sorted = allClients.sort((a, b) => {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      let mapped = sorted.map(c => {
        const birthday = getBirthdayStatus(c.birthdate);
        const userKey = (c.pseudonym || '').toLowerCase();
        return {
          id: c.id || c.pseudonym,
          pseudonym: c.pseudonym,
          email: c.email,
          birthdate: c.birthdate,
          stamps: c.stamps || 0,
          has_spun_wheel: c.has_spun_wheel || 0,
          welcome_prize: c.welcome_prize,
          accepts_promotions: c.accepts_promotions !== undefined ? c.accepts_promotions : 1,
          created_at: c.created_at,
          active_coupons_count: activeCouponsMap[userKey] || 0,
          isBirthdayToday: birthday.isBirthdayToday,
          isBirthdayMonth: birthday.isBirthdayMonth,
          daysUntilBirthday: birthday.daysUntilBirthday,
          greetingMessage: birthday.greetingMessage
        };
      });

      if (filter === 'birthday_today') {
        mapped = mapped.filter(c => c.isBirthdayToday);
      } else if (filter === 'birthday_month') {
        mapped = mapped.filter(c => c.isBirthdayMonth);
      }

      clients = mapped.slice(0, 100);
    } else {
      let sqliteClients;
      if (!query) {
        sqliteClients = db.prepare(`
          SELECT u.id, u.pseudonym, u.email, u.birthdate, u.stamps, u.has_spun_wheel, u.welcome_prize, u.accepts_promotions, u.created_at,
                 (SELECT COUNT(*) FROM coupons c WHERE c.user_id = u.id AND c.status = 'active') AS active_coupons_count
          FROM users u
          WHERE u.role = 'client'
          ORDER BY u.id DESC
          LIMIT 100
        `).all();
      } else {
        sqliteClients = db.prepare(`
          SELECT u.id, u.pseudonym, u.email, u.birthdate, u.stamps, u.has_spun_wheel, u.welcome_prize, u.accepts_promotions, u.created_at,
                 (SELECT COUNT(*) FROM coupons c WHERE c.user_id = u.id AND c.status = 'active') AS active_coupons_count
          FROM users u
          WHERE u.role = 'client'
            AND (u.pseudonym LIKE ? OR u.email LIKE ? OR u.birthdate LIKE ?)
          ORDER BY u.pseudonym ASC
          LIMIT 100
        `).all(`%${query}%`, `%${query}%`, `%${query}%`);
      }

      let mapped = sqliteClients.map(client => {
        const birthday = getBirthdayStatus(client.birthdate);
        return {
          ...client,
          isBirthdayToday: birthday.isBirthdayToday,
          isBirthdayMonth: birthday.isBirthdayMonth,
          daysUntilBirthday: birthday.daysUntilBirthday,
          greetingMessage: birthday.greetingMessage
        };
      });

      if (filter === 'birthday_today') {
        mapped = mapped.filter(c => c.isBirthdayToday);
      } else if (filter === 'birthday_month') {
        mapped = mapped.filter(c => c.isBirthdayMonth);
      }

      clients = mapped.slice(0, 100);
    }

    return res.json({
      success: true,
      count: clients.length,
      clients
    });

  } catch (error) {
    console.error('Error en searchClients:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al buscar clientes en la base de datos.'
    });
  }
}

/**
 * Ficha detallada del cliente (Módulo 3: Ficha detallada)
 * Muestra perfil, estado actual de la tarjeta (0 a 5), cupones, e historial
 */
async function getClientDetail(req, res) {
  try {
    const { id } = req.params;
    let client = null;
    let coupons = [];
    let stampsHistory = [];

    if (firestore.isFirestoreConfigured()) {
      client = await firestore.getUserByPseudonym(id);
      if (!client) {
        const all = await firestore.getAllClients();
        client = all.find(c => String(c.id) === String(id) || (c.pseudonym || '').toLowerCase() === String(id).toLowerCase());
      }

      if (client && client.role === 'client') {
        coupons = await firestore.getUserCoupons(client.pseudonym);
        stampsHistory = await firestore.getUserStampHistory(client.pseudonym);

        // Si el cliente tiene 5 sellos pero ningún cupón activo, regenerar automáticamente
        const hasActive = coupons.some(c => c.status === 'active');
        if ((client.stamps || 0) >= 5 && !hasActive) {
          const recoveryCode = 'NIJI-VIP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
          const newCoupon = await firestore.createCoupon({
            user_pseudonym: client.pseudonym,
            code: recoveryCode,
            title: '¡Recompensa 5 Sellos NIJI Perú!',
            description: 'Válido por un Combo Especial o Bebida Grande a elección. Presenta este cupón en caja para redimirlo.',
            status: 'active'
          });
          if (newCoupon) coupons.unshift(newCoupon);
        }
      }
    } else {
      client = db.prepare(`
        SELECT id, pseudonym, email, birthdate, role, stamps, has_spun_wheel, welcome_prize, created_at, updated_at
        FROM users
        WHERE (id = ? OR pseudonym = ? COLLATE NOCASE) AND role = 'client'
      `).get(id, id);

      if (client) {
        coupons = db.prepare(`
          SELECT id, code, title, description, status, created_at, redeemed_at
          FROM coupons
          WHERE user_id = ?
          ORDER BY id DESC
        `).all(client.id);

        stampsHistory = db.prepare(`
          SELECT sh.id, sh.stamps_added, sh.stamps_before, sh.stamps_after, sh.notes, sh.created_at,
                 COALESCE(admin.pseudonym, 'Personal NIJI') AS admin_pseudonym
          FROM stamps_history sh
          LEFT JOIN users admin ON sh.admin_id = admin.id
          WHERE sh.user_id = ?
          ORDER BY sh.id DESC
          LIMIT 15
        `).all(client.id);
      }
    }

    if (!client || client.role !== 'client') {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.'
      });
    }

    const currentStamps = client.stamps || 0;
    const birthdayInfo = getBirthdayStatus(client.birthdate);

    return res.json({
      success: true,
      client: {
        id: client.id || client.pseudonym,
        pseudonym: client.pseudonym,
        email: client.email,
        birthdate: client.birthdate,
        role: client.role,
        stamps: currentStamps,
        has_spun_wheel: client.has_spun_wheel || 0,
        welcome_prize: client.welcome_prize,
        accepts_promotions: client.accepts_promotions !== undefined ? client.accepts_promotions : 1,
        created_at: client.created_at,
        birthdayInfo,
        hasActiveReward: currentStamps >= 5,
        coupons: coupons || [],
        stampsHistory: (stampsHistory || []).slice(0, 15)
      }
    });

  } catch (error) {
    console.error('Error en getClientDetail:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la ficha del cliente.'
    });
  }
}

/**
 * Canjear cupón digital y reiniciar tarjeta de sellos a 0 (Nuevo ciclo)
 */
async function redeemCoupon(req, res) {
  try {
    const adminPseudonym = req.user.pseudonym;
    const adminId = req.user.id || adminPseudonym;
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, proporciona el código del cupón a canjear.'
      });
    }

    const cleanCode = couponCode.trim().toUpperCase();
    let clientPseudonym = '';

    if (firestore.isFirestoreConfigured()) {
      const redeemedCouponDoc = await firestore.redeemCouponByCode(cleanCode, adminPseudonym);
      if (!redeemedCouponDoc) {
        return res.status(404).json({
          success: false,
          message: `El cupón "${cleanCode}" no existe en el sistema.`
        });
      }

      clientPseudonym = redeemedCouponDoc.user_pseudonym;
      if (clientPseudonym) {
        const clientData = await firestore.getUserByPseudonym(clientPseudonym);
        const previousStamps = clientData ? (clientData.stamps || 0) : 5;

        await firestore.updateUser(clientPseudonym, { stamps: 0 });
        await firestore.addStampHistory({
          user_pseudonym: clientPseudonym,
          admin_pseudonym: adminPseudonym,
          stamps_added: 0,
          stamps_before: previousStamps,
          stamps_after: 0,
          notes: `Canje de cupón ${cleanCode} y reinicio de tarjeta a 0/5 sellos`
        });
      }
    } else {
      const sqliteCoupon = db.prepare(`SELECT * FROM coupons WHERE code = ? COLLATE NOCASE`).get(cleanCode);
      if (!sqliteCoupon) {
        return res.status(404).json({
          success: false,
          message: `El cupón "${cleanCode}" no fue encontrado en el sistema.`
        });
      }
      if (sqliteCoupon.status === 'redeemed') {
        return res.status(400).json({
          success: false,
          message: 'Este cupón ya fue canjeado previamente.'
        });
      }

      const client = db.prepare('SELECT id, pseudonym, stamps FROM users WHERE id = ?').get(sqliteCoupon.user_id);
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`
          UPDATE coupons
          SET status = 'redeemed', redeemed_at = datetime('now', 'localtime'), redeemed_by_admin_id = ?
          WHERE id = ?
        `).run(typeof adminId === 'number' ? adminId : 1, sqliteCoupon.id);

        if (client) {
          clientPseudonym = client.pseudonym;
          db.prepare(`UPDATE users SET stamps = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(client.id);
          db.prepare(`
            INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes)
            VALUES (?, ?, 0, ?, 0, ?)
          `).run(client.id, typeof adminId === 'number' ? adminId : 1, client.stamps, `Canje de cupón ${cleanCode} y reinicio a 0`);
        }
        db.exec('COMMIT;');
      } catch (txErr) {
        db.exec('ROLLBACK;');
        throw txErr;
      }
    }

    return res.json({
      success: true,
      message: `¡Cupón ${cleanCode} canjeado con éxito para @${clientPseudonym}! La tarjeta se reinició a 0/5 sellos para su nuevo ciclo.`,
      coupon: {
        code: cleanCode,
        status: 'redeemed'
      },
      client: {
        pseudonym: clientPseudonym,
        stamps: 0
      }
    });

  } catch (error) {
    console.error('Error en redeemCoupon:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el canje de cupón.'
    });
  }
}

/**
 * Reiniciar cuenta de sellos a 0 (Acción rápida para el cajero al completar los 5 sellos)
 */
async function resetClientCard(req, res) {
  try {
    const adminPseudonym = req.user.pseudonym;
    const adminId = req.user.id || adminPseudonym;
    const { clientId, clientPseudonym } = req.body;

    let targetPseudonym = (clientPseudonym || clientId || '').toString().trim();

    if (firestore.isFirestoreConfigured()) {
      let client = await firestore.getUserByPseudonym(targetPseudonym);
      if (!client) {
        const allClients = await firestore.getAllClients();
        client = allClients.find(c => String(c.id) === targetPseudonym || (c.pseudonym || '').toLowerCase() === targetPseudonym.toLowerCase());
      }

      if (!client || client.role !== 'client') {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
      }

      targetPseudonym = client.pseudonym;
      const previousStamps = client.stamps || 0;

      await firestore.updateUser(targetPseudonym, { stamps: 0 });
      await firestore.markUserCouponsAsRedeemed(targetPseudonym, adminPseudonym);
      await firestore.addStampHistory({
        user_pseudonym: targetPseudonym,
        admin_pseudonym: adminPseudonym,
        stamps_added: 0,
        stamps_before: previousStamps,
        stamps_after: 0,
        notes: 'Reinicio manual de tarjeta a 0/5 tras entrega de recompensa'
      });
    } else {
      const client = db.prepare("SELECT * FROM users WHERE (id = ? OR pseudonym = ? COLLATE NOCASE) AND role = 'client'").get(clientId || 0, targetPseudonym);
      if (!client) {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
      }

      targetPseudonym = client.pseudonym;
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`UPDATE users SET stamps = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(client.id);
        db.prepare(`UPDATE coupons SET status = 'redeemed', redeemed_at = datetime('now', 'localtime') WHERE user_id = ? AND status = 'active'`).run(client.id);
        db.prepare(`INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes) VALUES (?, ?, 0, ?, 0, 'Reinicio manual de tarjeta tras entrega de recompensa')`).run(client.id, typeof adminId === 'number' ? adminId : 1, client.stamps);
        db.exec('COMMIT;');
      } catch (txErr) {
        db.exec('ROLLBACK;');
        throw txErr;
      }
    }

    return res.json({
      success: true,
      message: `¡Tarjeta de @${targetPseudonym} reiniciada exitosamente a 0/5 sellos! El cliente ya puede acumular su siguiente ciclo.`,
      client: {
        pseudonym: targetPseudonym,
        stamps: 0
      }
    });

  } catch (error) {
    console.error('Error en resetClientCard:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al reiniciar la tarjeta de sellos del cliente.'
    });
  }
}

/**
 * Resumen estadístico del panel de administración
 */
async function getDashboardMetrics(req, res) {
  try {
    if (firestore.isFirestoreConfigured()) {
      const allClients = await firestore.getAllClients();
      const allCoupons = await firestore.queryCollection('coupons');
      const allStamps = await firestore.queryCollection('stamps_history');

      const todayStr = new Date().toISOString().substring(0, 10);
      const totalClients = allClients.length;
      const cardsCompleted = allClients.filter(c => (c.stamps || 0) >= 5).length;
      const activeCoupons = allCoupons.filter(c => c.status === 'active').length;
      const redeemedCoupons = allCoupons.filter(c => c.status === 'redeemed').length;
      const todayStamps = allStamps.filter(s => (s.created_at || '').startsWith(todayStr) && (s.stamps_added > 0)).length;
      const birthdaysToday = allClients.filter(c => getBirthdayStatus(c.birthdate).isBirthdayToday).length;
      const birthdaysMonth = allClients.filter(c => getBirthdayStatus(c.birthdate).isBirthdayMonth).length;

      return res.json({
        success: true,
        metrics: {
          totalClients,
          cardsCompleted,
          activeCoupons,
          redeemedCoupons,
          todayStamps,
          birthdaysToday,
          birthdaysMonth
        }
      });
    }

    // Fallback SQLite
    const totalClients = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'client'").get().count;
    const cardsCompleted = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'client' AND stamps = 5").get().count;
    const activeCoupons = db.prepare("SELECT COUNT(*) as count FROM coupons WHERE status = 'active'").get().count;
    const redeemedCoupons = db.prepare("SELECT COUNT(*) as count FROM coupons WHERE status = 'redeemed'").get().count;
    const todayStamps = db.prepare(`
      SELECT COUNT(*) as count FROM stamps_history
      WHERE date(created_at) = date('now', 'localtime') AND stamps_added > 0
    `).get().count;
    const allSqliteClients = db.prepare("SELECT birthdate FROM users WHERE role = 'client'").all();
    const birthdaysToday = allSqliteClients.filter(c => getBirthdayStatus(c.birthdate).isBirthdayToday).length;
    const birthdaysMonth = allSqliteClients.filter(c => getBirthdayStatus(c.birthdate).isBirthdayMonth).length;

    return res.json({
      success: true,
      metrics: {
        totalClients,
        cardsCompleted,
        activeCoupons,
        redeemedCoupons,
        todayStamps,
        birthdaysToday,
        birthdaysMonth
      }
    });
  } catch (error) {
    console.error('Error en getDashboardMetrics:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener métricas.' });
  }
}

/**
 * Exportar directorio de clientes a formato CSV (Excel)
 * Incluye clientes registrados y segmentación de opt-in y cumpleaños
 */
async function exportClientsCSV(req, res) {
  try {
    let clients = [];
    if (firestore.isFirestoreConfigured()) {
      clients = await firestore.getAllClients();
    } else {
      clients = db.prepare(`SELECT * FROM users WHERE role = 'client' ORDER BY id DESC`).all();
    }

    // Ordenar de más reciente a más antiguo
    clients.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const rows = [
      [
        'Pseudonimo',
        'Correo Electronico',
        'Fecha de Nacimiento',
        'Cumple Hoy',
        'Cumple este Mes',
        'Sellos Acumulados',
        'Premio Ruleta',
        'Acepta Promociones y Regalos',
        'Fecha de Registro'
      ]
    ];

    clients.forEach(c => {
      const birthday = getBirthdayStatus(c.birthdate);
      const optIn = (c.accepts_promotions !== 0 && c.accepts_promotions !== false) ? 'SI' : 'NO';
      const isToday = birthday.isBirthdayToday ? 'SI' : 'NO';
      const isMonth = birthday.isBirthdayMonth ? 'SI' : 'NO';
      rows.push([
        c.pseudonym || '',
        c.email || '',
        c.birthdate || '',
        isToday,
        isMonth,
        String(c.stamps || 0),
        c.welcome_prize || 'Ninguno',
        optIn,
        c.created_at || ''
      ]);
    });

    // Formato CSV con BOM UTF-8 para apertura directa y limpia en Microsoft Excel
    const csvContent = '\uFEFF' + rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const dateStr = new Date().toISOString().substring(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clientes_niji_directorio_${dateStr}.csv"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error exportando clientes CSV:', err);
    return res.status(500).json({ success: false, message: 'Error exportando base de datos de clientes.' });
  }
}

module.exports = {
  searchClients,
  getClientDetail,
  redeemCoupon,
  resetClientCard,
  getDashboardMetrics,
  exportClientsCSV
};
