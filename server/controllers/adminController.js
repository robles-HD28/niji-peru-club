const { db } = require('../db');
const { getBirthdayStatus } = require('../utils/birthday');

/**
 * Buscar clientes por pseudónimo o correo (Buscador rápido para el cajero)
 */
function searchClients(req, res) {
  try {
    const query = (req.query.q || '').trim();

    let clients;
    if (!query) {
      // Devolver los últimos 20 clientes registrados
      clients = db.prepare(`
        SELECT u.id, u.pseudonym, u.email, u.birthdate, u.stamps, u.has_spun_wheel, u.welcome_prize, u.created_at,
               (SELECT COUNT(*) FROM coupons c WHERE c.user_id = u.id AND c.status = 'active') AS active_coupons_count
        FROM users u
        WHERE u.role = 'client'
        ORDER BY u.id DESC
        LIMIT 20
      `).all();
    } else {
      clients = db.prepare(`
        SELECT u.id, u.pseudonym, u.email, u.birthdate, u.stamps, u.has_spun_wheel, u.welcome_prize, u.created_at,
               (SELECT COUNT(*) FROM coupons c WHERE c.user_id = u.id AND c.status = 'active') AS active_coupons_count
        FROM users u
        WHERE u.role = 'client'
          AND (u.pseudonym LIKE ? OR u.email LIKE ?)
        ORDER BY u.pseudonym ASC
        LIMIT 20
      `).all(`%${query}%`, `%${query}%`);
    }

    // Agregar información de cumpleaños a cada cliente
    const formattedClients = clients.map(client => {
      const birthday = getBirthdayStatus(client.birthdate);
      return {
        ...client,
        isBirthdayToday: birthday.isBirthdayToday,
        isBirthdayMonth: birthday.isBirthdayMonth,
        greetingMessage: birthday.greetingMessage
      };
    });

    return res.json({
      success: true,
      count: formattedClients.length,
      clients: formattedClients
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
function getClientDetail(req, res) {
  try {
    const { id } = req.params;

    const client = db.prepare(`
      SELECT id, pseudonym, email, birthdate, role, stamps, has_spun_wheel, welcome_prize, created_at, updated_at
      FROM users
      WHERE id = ? AND role = 'client'
    `).get(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.'
      });
    }

    const birthdayInfo = getBirthdayStatus(client.birthdate);

    // Cupones del cliente (activos y canjeados)
    const coupons = db.prepare(`
      SELECT id, code, title, description, status, created_at, redeemed_at
      FROM coupons
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(client.id);

    // Historial de sellos otorgados
    const stampsHistory = db.prepare(`
      SELECT sh.id, sh.stamps_added, sh.stamps_before, sh.stamps_after, sh.notes, sh.created_at,
             admin.pseudonym AS admin_pseudonym
      FROM stamps_history sh
      JOIN users admin ON sh.admin_id = admin.id
      WHERE sh.user_id = ?
      ORDER BY sh.id DESC
      LIMIT 15
    `).all(client.id);

    return res.json({
      success: true,
      client: {
        ...client,
        birthdayInfo,
        hasActiveReward: client.stamps === 5,
        coupons,
        stampsHistory
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
function redeemCoupon(req, res) {
  try {
    const adminId = req.user.id;
    const { couponCode, clientId } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, proporciona el código del cupón a canjear.'
      });
    }

    const coupon = db.prepare(`
      SELECT * FROM coupons WHERE code = ? COLLATE NOCASE
    `).get(couponCode.trim());

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: `El cupón "${couponCode}" no existe.`
      });
    }

    if (coupon.status === 'redeemed') {
      return res.status(400).json({
        success: false,
        message: `Este cupón ya fue canjeado el ${coupon.redeemed_at}.`
      });
    }

    const client = db.prepare('SELECT id, pseudonym, stamps FROM users WHERE id = ?').get(coupon.user_id);

    // Transacción: Marcar cupón como canjeado y resetear los sellos a 0 para nuevo ciclo
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE coupons
        SET status = 'redeemed',
            redeemed_at = datetime('now', 'localtime'),
            redeemed_by_admin_id = ?
        WHERE id = ?
      `).run(adminId, coupon.id);

      db.prepare(`
        UPDATE users
        SET stamps = 0,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(client.id);

      // Registrar reinicio en historial
      db.prepare(`
        INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes)
        VALUES (?, ?, 0, ?, 0, ?)
      `).run(client.id, adminId, client.stamps, `Canje de cupón ${coupon.code} y reinicio de tarjeta a nuevo ciclo`);

      db.exec('COMMIT;');
    } catch (txError) {
      db.exec('ROLLBACK;');
      throw txError;
    }

    return res.json({
      success: true,
      message: `¡Cupón ${coupon.code} canjeado exitosamente para ${client.pseudonym}! La tarjeta ha sido reiniciada a 0/5 sellos para su próximo ciclo.`,
      coupon: {
        code: coupon.code,
        status: 'redeemed'
      },
      client: {
        id: client.id,
        pseudonym: client.pseudonym,
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
function resetClientCard(req, res) {
  try {
    const adminId = req.user.id;
    const { clientId, clientPseudonym } = req.body;

    let client;
    if (clientId) {
      client = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'client'").get(clientId);
    } else if (clientPseudonym) {
      client = db.prepare("SELECT * FROM users WHERE pseudonym = ? COLLATE NOCASE AND role = 'client'").get(clientPseudonym.trim());
    }

    if (!client) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
    }

    const previousStamps = client.stamps;

    // Transacción: Resetear sellos a 0 y marcar cupones activos como canjeados
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE users
        SET stamps = 0,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(client.id);

      // Marcar cupones activos de este cliente como canjeados
      db.prepare(`
        UPDATE coupons
        SET status = 'redeemed',
            redeemed_at = datetime('now', 'localtime'),
            redeemed_by_admin_id = ?
        WHERE user_id = ? AND status = 'active'
      `).run(adminId, client.id);

      // Auditoría en stamps_history
      db.prepare(`
        INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes)
        VALUES (?, ?, 0, ?, 0, 'Reinicio manual de tarjeta tras entrega de recompensa')
      `).run(client.id, adminId, previousStamps);

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    return res.json({
      success: true,
      message: `¡Tarjeta de @${client.pseudonym} reiniciada exitosamente a 0/5 sellos! Ya puede comenzar a acumular nuevamente.`,
      client: {
        id: client.id,
        pseudonym: client.pseudonym,
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
function getDashboardMetrics(req, res) {
  try {
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
