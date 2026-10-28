const crypto = require('node:crypto');
const { db } = require('../db');
const { getBirthdayStatus } = require('../utils/birthday');

const BUSINESS_RULE_TEXT = 'Se otorga un sello por compras desde S/ 10. La actualización se procesa al cierre del día.';

/**
 * Obtener estado de la tarjeta de sellos del cliente autenticado
 */
function getMyCard(req, res) {
  try {
    const userId = req.user.id;

    const user = db.prepare(`
      SELECT id, pseudonym, email, birthdate, stamps, has_spun_wheel, welcome_prize
      FROM users WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const birthdayInfo = getBirthdayStatus(user.birthdate);

    // Consultar cupón activo (si llegó a 5 sellos)
    const activeCoupon = db.prepare(`
      SELECT id, code, title, description, status, created_at
      FROM coupons
      WHERE user_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    // Consultar historial de sellos
    const history = db.prepare(`
      SELECT sh.id, sh.stamps_added, sh.stamps_before, sh.stamps_after, sh.notes, sh.created_at,
             u.pseudonym AS admin_pseudonym
      FROM stamps_history sh
      JOIN users u ON sh.admin_id = u.id
      WHERE sh.user_id = ?
      ORDER BY sh.id DESC
      LIMIT 10
    `).all(userId);

    const isCardLocked = user.stamps >= 5;

    return res.json({
      success: true,
      card: {
        stamps: user.stamps,
        totalSlots: 5,
        isCompleted: user.stamps >= 5,
        isLocked: isCardLocked,
        businessRule: BUSINESS_RULE_TEXT
      },
      user: {
        pseudonym: user.pseudonym,
        email: user.email,
        birthdate: user.birthdate,
        welcomePrize: user.welcome_prize,
        birthdayInfo
      },
      activeCoupon: activeCoupon || null,
      history
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
function addStampToClient(req, res) {
  try {
    const adminId = req.user.id;
    const { clientPseudonym, clientId, notes } = req.body;

    let targetClient;
    if (clientId) {
      targetClient = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'client'").get(clientId);
    } else if (clientPseudonym) {
      targetClient = db.prepare("SELECT * FROM users WHERE pseudonym = ? COLLATE NOCASE AND role = 'client'").get(clientPseudonym.trim());
    }

    if (!targetClient) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado en el sistema.'
      });
    }

    // Verificar si ya tiene 5 sellos acumulados
    if (targetClient.stamps >= 5) {
      return res.status(400).json({
        success: false,
        message: `El cliente ${targetClient.pseudonym} ya tiene 5 sellos y una tarjeta completa con cupón pendiente de canje. Debe canjear su cupón antes de volver a acumular.`,
        currentStamps: targetClient.stamps
      });
    }

    const stampsBefore = targetClient.stamps;
    const stampsAfter = stampsBefore + 1;
    let generatedCoupon = null;

    // Iniciar transacción de actualización
    db.exec('BEGIN TRANSACTION;');

    try {
      // 1. Actualizar sellos del usuario
      db.prepare(`
        UPDATE users
        SET stamps = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(stampsAfter, targetClient.id);

      // 2. Registrar en historial de auditoría
      const stampNotes = notes || 'Asignación de sello en cierre de jornada (Compra >= S/10)';
      db.prepare(`
        INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(targetClient.id, adminId, 1, stampsBefore, stampsAfter, stampNotes);

      // 3. Regla de negocio: Si llega a 5 sellos -> Generar Cupón Digital y bloquear
      if (stampsAfter === 5) {
        const randomCode = 'NIJI-VIP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const couponTitle = '¡Recompensa 5 Sellos NIJI Perú!';
        const couponDesc = 'Válido por un Combo Especial o Bebida Grande a elección. Presenta este cupón en caja para redimirlo.';

        const couponResult = db.prepare(`
          INSERT INTO coupons (user_id, code, title, description, status)
          VALUES (?, ?, ?, ?, 'active')
        `).run(targetClient.id, randomCode, couponTitle, couponDesc);

        generatedCoupon = {
          id: Number(couponResult.lastInsertRowid),
          code: randomCode,
          title: couponTitle,
          description: couponDesc,
          status: 'active'
        };
      }

      db.exec('COMMIT;');

    } catch (txError) {
      db.exec('ROLLBACK;');
      throw txError;
    }

    return res.json({
      success: true,
      message: stampsAfter === 5
        ? `¡Tarjeta completada para ${targetClient.pseudonym}! Se ha alcanzado los 5 sellos y generado el cupón ${generatedCoupon.code}.`
        : `¡Sello asignado con éxito a ${targetClient.pseudonym}! Saldo actual: ${stampsAfter}/5 sellos.`,
      client: {
        id: targetClient.id,
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
