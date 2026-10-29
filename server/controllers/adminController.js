const { db } = require('../db');
const firestore = require('../firestore');
const { getBirthdayStatus } = require('../utils/birthday');

/**
 * Buscar clientes por pseudónimo o correo (Buscador rápido para el cajero)
 */
async function searchClients(req, res) {
  try {
    const query = (req.query.q || '').trim();
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

      clients = allClients.slice(0, 30).map(c => {
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
          created_at: c.created_at,
          active_coupons_count: activeCouponsMap[userKey] || 0,
          isBirthdayToday: birthday.isBirthdayToday,
          isBirthdayMonth: birthday.isBirthdayMonth,
          greetingMessage: birthday.greetingMessage
        };
      });
    }

    if (clients.length === 0 && !firestore.isFirestoreConfigured()) {
      let sqliteClients;
      if (!query) {
        sqliteClients = db.prepare(`
          SELECT u.id, u.pseudonym, u.email, u.birthdate, u.stamps, u.has_spun_wheel, u.welcome_prize, u.created_at,
                 (SELECT COUNT(*) FROM coupons c WHERE c.user_id = u.id AND c.status = 'active') AS active_coupons_count
          FROM users u
          WHERE u.role = 'client'
          ORDER BY u.id DESC
          LIMIT 20
        `).all();
      } else {
        sqliteClients = db.prepare(`
          SELECT u.id, u.pseudonym, u.email, u.birthdate, u.stamps, u.has_spun_wheel, u.welcome_prize, u.created_at,
                 (SELECT COUNT(*) FROM coupons c WHERE c.user_id = u.id AND c.status = 'active') AS active_coupons_count
          FROM users u
          WHERE u.role = 'client'
            AND (u.pseudonym LIKE ? OR u.email LIKE ?)
          ORDER BY u.pseudonym ASC
          LIMIT 20
        `).all(`%${query}%`, `%${query}%`);
      }

      clients = sqliteClients.map(client => {
        const birthday = getBirthdayStatus(client.birthdate);
        return {
          ...client,
          isBirthdayToday: birthday.isBirthdayToday,
          isBirthdayMonth: birthday.isBirthdayMonth,
          greetingMessage: birthday.greetingMessage
        };
      });
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
      message: 'Error al buscar clientes en el sistema.'
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

      if (client) {
        coupons = await firestore.getUserCoupons(client.pseudonym);
        stampsHistory = await firestore.getUserStampHistory(client.pseudonym);
      }
    }

    if (!client) {
      client = db.prepare(`
        SELECT id, pseudonym, email, birthdate, role, stamps, has_spun_wheel, welcome_prize, created_at, updated_at
        FROM users
        WHERE (id = ? OR pseudonym = ? COLLATE NOCASE) AND role = 'client'
      `).get(id, id);

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado.'
        });
      }

      coupons = db.prepare(`
        SELECT id, code, title, description, status, created_at, redeemed_at
        FROM coupons
        WHERE user_id = ? OR user_pseudonym = ?
        ORDER BY id DESC
      `).all(client.id, client.pseudonym);

      stampsHistory = db.prepare(`
        SELECT sh.id, sh.stamps_added, sh.stamps_before, sh.stamps_after, sh.notes, sh.created_at,
               COALESCE(admin.pseudonym, sh.admin_pseudonym, 'Personal NIJI') AS admin_pseudonym
        FROM stamps_history sh
        LEFT JOIN users admin ON sh.admin_id = admin.id
        WHERE sh.user_id = ? OR sh.user_pseudonym = ?
        ORDER BY sh.id DESC
        LIMIT 15
      `).all(client.id, client.pseudonym);
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
        created_at: client.created_at,
        birthdayInfo,
        hasActiveReward: currentStamps >= 5,
        coupons: coupons || [],
        stampsHistory: stampsHistory || []
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
    const { couponCode, clientId } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, proporciona el código del cupón a canjear.'
      });
    }

    const cleanCode = couponCode.trim().toUpperCase();
    let redeemedCouponDoc = null;
    let clientPseudonym = '';

    if (firestore.isFirestoreConfigured()) {
      redeemedCouponDoc = await firestore.redeemCouponByCode(cleanCode, adminPseudonym);
      if (redeemedCouponDoc) {
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
            notes: `Canje de cupón ${cleanCode} y reinicio de tarjeta a nuevo ciclo`
          });
        }
      }
    }

    // Réplica o fallback en SQLite
    let sqliteCoupon = null;
    try {
      sqliteCoupon = db.prepare(`SELECT * FROM coupons WHERE code = ? COLLATE NOCASE`).get(cleanCode);
      if (sqliteCoupon && sqliteCoupon.status !== 'redeemed') {
        const client = db.prepare('SELECT id, pseudonym, stamps FROM users WHERE id = ?').get(sqliteCoupon.user_id);
        db.prepare(`
          UPDATE coupons
          SET status = 'redeemed', redeemed_at = datetime('now', 'localtime'), redeemed_by_admin_id = ?
          WHERE id = ?
        `).run(typeof adminId === 'number' ? adminId : 1, sqliteCoupon.id);

        if (client) {
          clientPseudonym = clientPseudonym || client.pseudonym;
          db.prepare(`UPDATE users SET stamps = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(client.id);
          db.prepare(`
            INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes)
            VALUES (?, ?, 0, ?, 0, ?)
          `).run(client.id, typeof adminId === 'number' ? adminId : 1, client.stamps, `Canje de cupón ${cleanCode} y reinicio a 0`);
        }
      }
    } catch (e) {}

    if (!redeemedCouponDoc && (!sqliteCoupon || sqliteCoupon.status === 'redeemed')) {
      if (sqliteCoupon && sqliteCoupon.status === 'redeemed') {
        return res.status(400).json({
          success: false,
          message: `Este cupón ya fue canjeado previamente.`
        });
      }
      return res.status(404).json({
        success: false,
        message: `El cupón "${cleanCode}" no fue encontrado en el sistema.`
      });
    }

    return res.json({
      success: true,
      message: `¡Cupón ${cleanCode} canjeado exitosamente para ${clientPseudonym || 'el cliente'}! La tarjeta ha sido reiniciada a 0/5 sellos para su próximo ciclo.`,
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

    let targetPseudonym = clientPseudonym;

    if (!targetPseudonym && clientId && firestore.isFirestoreConfigured()) {
      const allClients = await firestore.getAllClients();
      const match = allClients.find(c => String(c.id) === String(clientId) || c.pseudonym === clientId);
      if (match) targetPseudonym = match.pseudonym;
    }

    if (firestore.isFirestoreConfigured() && targetPseudonym) {
      const client = await firestore.getUserByPseudonym(targetPseudonym);
      if (client) {
        const previousStamps = client.stamps || 0;
        await firestore.updateUser(targetPseudonym, { stamps: 0 });
        await firestore.markUserCouponsAsRedeemed(targetPseudonym, adminPseudonym);
        await firestore.addStampHistory({
          user_pseudonym: targetPseudonym,
          admin_pseudonym: adminPseudonym,
          stamps_added: 0,
          stamps_before: previousStamps,
          stamps_after: 0,
          notes: 'Reinicio manual de tarjeta tras entrega de recompensa'
        });
      }
    }

    // Réplica en SQLite
    try {
      let client;
      if (clientId) {
        client = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'client'").get(clientId);
      } else if (targetPseudonym) {
        client = db.prepare("SELECT * FROM users WHERE pseudonym = ? COLLATE NOCASE AND role = 'client'").get(targetPseudonym.trim());
      }

      if (client) {
        targetPseudonym = targetPseudonym || client.pseudonym;
        db.prepare(`UPDATE users SET stamps = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(client.id);
        db.prepare(`UPDATE coupons SET status = 'redeemed', redeemed_at = datetime('now', 'localtime') WHERE user_id = ? AND status = 'active'`).run(client.id);
        db.prepare(`INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes) VALUES (?, ?, 0, ?, 0, 'Reinicio manual de tarjeta tras entrega de recompensa')`).run(client.id, typeof adminId === 'number' ? adminId : 1, client.stamps);
      }
    } catch (e) {}

    return res.json({
      success: true,
      message: `¡Tarjeta de @${targetPseudonym} reiniciada exitosamente a 0/5 sellos! Ya puede comenzar a acumular nuevamente.`,
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

      return res.json({
        success: true,
        metrics: {
          totalClients,
          cardsCompleted,
          activeCoupons,
          redeemedCoupons,
          todayStamps
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

    return res.json({
      success: true,
      metrics: {
        totalClients,
        cardsCompleted,
        activeCoupons,
        redeemedCoupons,
        todayStamps
      }
    });
  } catch (error) {
    console.error('Error en getDashboardMetrics:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener métricas.' });
  }
}

module.exports = {
  searchClients,
  getClientDetail,
  redeemCoupon,
  resetClientCard,
  getDashboardMetrics
};
