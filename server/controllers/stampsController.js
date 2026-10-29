const crypto = require('node:crypto');
const { db } = require('../db');
const firestore = require('../firestore');
const { getBirthdayStatus } = require('../utils/birthday');

const BUSINESS_RULE_TEXT = 'Se otorga un sello por compras desde S/ 10. La actualización se procesa al cierre del día.';

/**
 * Obtener estado de la tarjeta de sellos del cliente autenticado
 */
async function getMyCard(req, res) {
  try {
    const userSession = req.user;
    let user = null;
    let activeCoupon = null;
    let history = [];

    if (firestore.isFirestoreConfigured()) {
      user = await firestore.getUserByPseudonym(userSession.pseudonym);
      if (user) {
        activeCoupon = await firestore.getActiveCoupon(user.pseudonym);
        history = await firestore.getUserStampHistory(user.pseudonym);
      }
    }

    if (!user) {
      user = db.prepare(`
        SELECT id, pseudonym, email, birthdate, stamps, has_spun_wheel, welcome_prize
        FROM users WHERE id = ? OR pseudonym = ? COLLATE NOCASE
      `).get(userSession.id || 0, userSession.pseudonym || '');

      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      }

      activeCoupon = db.prepare(`
        SELECT id, code, title, description, status, created_at
        FROM coupons
        WHERE (user_id = ? OR user_pseudonym = ?) AND status = 'active'
        ORDER BY id DESC LIMIT 1
      `).get(user.id, user.pseudonym);

      history = db.prepare(`
        SELECT sh.id, sh.stamps_added, sh.stamps_before, sh.stamps_after, sh.notes, sh.created_at,
               COALESCE(u.pseudonym, sh.admin_pseudonym, 'Personal NIJI') AS admin_pseudonym
        FROM stamps_history sh
        LEFT JOIN users u ON sh.admin_id = u.id
        WHERE sh.user_id = ? OR sh.user_pseudonym = ?
        ORDER BY sh.id DESC
        LIMIT 10
      `).all(user.id, user.pseudonym);
    }

    const currentStamps = user.stamps || 0;
    const birthdayInfo = getBirthdayStatus(user.birthdate);
    const isCardLocked = currentStamps >= 5;

    return res.json({
      success: true,
      card: {
        stamps: currentStamps,
        totalSlots: 5,
        isCompleted: currentStamps >= 5,
        isLocked: isCardLocked,
        businessRule: BUSINESS_RULE_TEXT
      },
      user: {
        id: user.id || user.pseudonym,
        pseudonym: user.pseudonym,
        email: user.email,
        birthdate: user.birthdate,
        welcomePrize: user.welcome_prize,
        birthdayInfo
      },
      activeCoupon: activeCoupon || null,
      history: history || []
    });

  } catch (error) {
    console.error('Error en getMyCard:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar la tarjeta de sellos.'
    });
  }
}

/**
 * Asignar +1 sello manualmente a un cliente (Exclusivo Personal/Admin)
 * Si alcanza 5 sellos, bloquea temporalmente la tarjeta y genera un cupón digital.
 */
async function addStampToClient(req, res) {
  try {
    const adminPseudonym = req.user.pseudonym;
    const adminId = req.user.id || adminPseudonym;
    const { clientPseudonym, clientId, notes } = req.body;

    let targetClient = null;

    if (firestore.isFirestoreConfigured()) {
      if (clientPseudonym) {
        targetClient = await firestore.getUserByPseudonym(clientPseudonym.trim());
      }
      if (!targetClient && clientId) {
        const allClients = await firestore.getAllClients();
        targetClient = allClients.find(c => String(c.id) === String(clientId) || c.pseudonym === clientId);
      }
    }

    if (!targetClient) {
      if (clientId) {
        targetClient = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'client'").get(clientId);
      } else if (clientPseudonym) {
        targetClient = db.prepare("SELECT * FROM users WHERE pseudonym = ? COLLATE NOCASE AND role = 'client'").get(clientPseudonym.trim());
      }
    }

    if (!targetClient) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado en el sistema.'
      });
    }

    const currentStamps = targetClient.stamps || 0;

    // Verificar si ya tiene 5 sellos acumulados
    if (currentStamps >= 5) {
      return res.status(400).json({
        success: false,
        message: `El cliente ${targetClient.pseudonym} ya tiene 5 sellos y una tarjeta completa con cupón pendiente de canje. Debe canjear su cupón antes de volver a acumular.`,
        currentStamps
      });
    }

    const stampsBefore = currentStamps;
    const stampsAfter = stampsBefore + 1;
    let generatedCoupon = null;
    const stampNotes = notes || 'Asignación de sello en cierre de jornada (Compra >= S/10)';

    // Si llega a 5 sellos -> Generar Cupón Digital
    if (stampsAfter === 5) {
      const randomCode = 'NIJI-VIP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const couponTitle = '¡Recompensa 5 Sellos NIJI Perú!';
      const couponDesc = 'Válido por un Combo Especial o Bebida Grande a elección. Presenta este cupón en caja para redimirlo.';
      generatedCoupon = {
        user_pseudonym: targetClient.pseudonym,
        code: randomCode,
        title: couponTitle,
        description: couponDesc,
        status: 'active'
      };
    }

    // Persistir en Google Cloud Firestore
    if (firestore.isFirestoreConfigured()) {
      await firestore.updateUser(targetClient.pseudonym, {
        stamps: stampsAfter
      });

      await firestore.addStampHistory({
        user_pseudonym: targetClient.pseudonym,
        admin_pseudonym: adminPseudonym,
        stamps_added: 1,
        stamps_before: stampsBefore,
        stamps_after: stampsAfter,
        notes: stampNotes
      });

      if (generatedCoupon) {
        const createdCoupon = await firestore.createCoupon(generatedCoupon);
        if (createdCoupon) generatedCoupon = createdCoupon;
      }
    }

    // Réplica en SQLite
    try {
      db.prepare(`
        UPDATE users
        SET stamps = ?, updated_at = datetime('now', 'localtime')
        WHERE pseudonym = ? COLLATE NOCASE OR id = ?
      `).run(stampsAfter, targetClient.pseudonym, targetClient.id || 0);

      db.prepare(`
        INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(targetClient.id || 0, typeof adminId === 'number' ? adminId : 1, 1, stampsBefore, stampsAfter, stampNotes);

      if (generatedCoupon) {
        db.prepare(`
          INSERT INTO coupons (user_id, code, title, description, status)
          VALUES (?, ?, ?, ?, 'active')
        `).run(targetClient.id || 0, generatedCoupon.code, generatedCoupon.title, generatedCoupon.description);
      }
    } catch (sqliteErr) {
      // Ignorar fallos de réplica SQLite local
    }

    return res.json({
      success: true,
      message: stampsAfter === 5
        ? `¡Tarjeta completada para ${targetClient.pseudonym}! Se ha alcanzado los 5 sellos y generado el cupón ${generatedCoupon.code}.`
        : `¡Sello asignado con éxito a ${targetClient.pseudonym}! Saldo actual: ${stampsAfter}/5 sellos.`,
      client: {
        id: targetClient.id || targetClient.pseudonym,
        pseudonym: targetClient.pseudonym,
        stampsBefore,
        stampsCurrent: stampsAfter,
        isCompleted: stampsAfter === 5
      },
      coupon: generatedCoupon
    });

  } catch (error) {
    console.error('Error en addStampToClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al registrar el sello.'
    });
  }
}

module.exports = {
  getMyCard,
  addStampToClient,
  BUSINESS_RULE_TEXT
};
