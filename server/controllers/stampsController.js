const crypto = require('node:crypto');
const { db } = require('../db');
const firestore = require('../firestore');
const { getBirthdayStatus } = require('../utils/birthday');

const BUSINESS_RULE_TEXT = 'Se otorga un sello por cada S/ 5 de consumo. La actualización se procesa al cierre del día.';

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

        // Auto-recuperación: si el cliente tiene 5 sellos pero un fallo previo de red impidió crear su cupón
        if ((user.stamps || 0) >= 5 && !activeCoupon) {
          const recoveryCode = 'NIJI-VIP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
          activeCoupon = await firestore.createCoupon({
            user_pseudonym: user.pseudonym,
            code: recoveryCode,
            title: '¡Recompensa 5 Sellos NIJI Perú!',
            description: 'Válido por un Combo Especial o Bebida Grande a elección. Presenta este cupón en caja para redimirlo.',
            status: 'active'
          });
        }
      }
    } else {
      user = db.prepare(`
        SELECT id, pseudonym, email, birthdate, stamps, has_spun_wheel, welcome_prize
        FROM users WHERE id = ? OR pseudonym = ? COLLATE NOCASE
      `).get(userSession.id || 0, userSession.pseudonym || '');

      if (user) {
        activeCoupon = db.prepare(`
          SELECT id, code, title, description, status, created_at
          FROM coupons
          WHERE user_id = ? AND status = 'active'
          ORDER BY id DESC LIMIT 1
        `).get(user.id);

        history = db.prepare(`
          SELECT sh.id, sh.stamps_added, sh.stamps_before, sh.stamps_after, sh.notes, sh.created_at,
                 COALESCE(u.pseudonym, 'Personal NIJI') AS admin_pseudonym
          FROM stamps_history sh
          LEFT JOIN users u ON sh.admin_id = u.id
          WHERE sh.user_id = ?
          ORDER BY sh.id DESC
          LIMIT 10
        `).all(user.id);
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
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
      history: (history || []).slice(0, 10)
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
      const lookupKey = (clientPseudonym || clientId || '').toString().trim();
      if (lookupKey) {
        targetClient = await firestore.getUserByPseudonym(lookupKey);
      }
      if (!targetClient && lookupKey) {
        const allClients = await firestore.getAllClients();
        targetClient = allClients.find(c => String(c.id) === lookupKey || (c.pseudonym || '').toLowerCase() === lookupKey.toLowerCase());
      }
    } else {
      if (clientId) {
        targetClient = db.prepare("SELECT * FROM users WHERE (id = ? OR pseudonym = ? COLLATE NOCASE) AND role = 'client'").get(clientId, String(clientId));
      } else if (clientPseudonym) {
        targetClient = db.prepare("SELECT * FROM users WHERE pseudonym = ? COLLATE NOCASE AND role = 'client'").get(clientPseudonym.trim());
      }
    }

    if (!targetClient || targetClient.role !== 'client') {
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
        message: `El cliente @${targetClient.pseudonym} ya alcanzó la meta de 5/5 sellos. Por favor, canjea su cupón o usa el botón "Reset 0" para iniciar un nuevo ciclo.`,
        currentStamps
      });
    }

    const stampsBefore = currentStamps;
    const stampsAfter = stampsBefore + 1;
    let generatedCoupon = null;
    const stampNotes = notes || 'Asignación de sello en cierre de jornada (Compra >= S/ 5)';

    if (firestore.isFirestoreConfigured()) {
      // 1. Si llega al 5to sello (Meta Final), asegurar primero la creación del cupón en la nube
      if (stampsAfter === 5) {
        const existingActive = await firestore.getActiveCoupon(targetClient.pseudonym);
        if (existingActive) {
          generatedCoupon = existingActive;
        } else {
          const randomCode = 'NIJI-VIP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
          generatedCoupon = await firestore.createCoupon({
            user_pseudonym: targetClient.pseudonym,
            code: randomCode,
            title: '¡Recompensa 5 Sellos NIJI Perú!',
            description: 'Válido por un Combo Especial o Bebida Grande a elección. Presenta este cupón en caja para redimirlo.',
            status: 'active'
          });
        }
      }

      // 2. Actualizar contador de sellos del cliente
      await firestore.updateUser(targetClient.pseudonym, {
        stamps: stampsAfter
      });

      // 3. Registrar auditoría en historial
      await firestore.addStampHistory({
        user_pseudonym: targetClient.pseudonym,
        admin_pseudonym: adminPseudonym,
        stamps_added: 1,
        stamps_before: stampsBefore,
        stamps_after: stampsAfter,
        notes: stampNotes
      });

    } else {
      // Modo Fallback SQLite Local con Transacción ACID
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`
          UPDATE users SET stamps = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
        `).run(stampsAfter, targetClient.id);

        db.prepare(`
          INSERT INTO stamps_history (user_id, admin_id, stamps_added, stamps_before, stamps_after, notes)
          VALUES (?, ?, 1, ?, ?, ?)
        `).run(targetClient.id, typeof adminId === 'number' ? adminId : 1, stampsBefore, stampsAfter, stampNotes);

        if (stampsAfter === 5) {
          const randomCode = 'NIJI-VIP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
          const couponTitle = '¡Recompensa 5 Sellos NIJI Perú!';
          const couponDesc = 'Válido por un Combo Especial o Bebida Grande a elección. Presenta este cupón en caja para redimirlo.';
          const resCoupon = db.prepare(`
            INSERT INTO coupons (user_id, code, title, description, status) VALUES (?, ?, ?, ?, 'active')
          `).run(targetClient.id, randomCode, couponTitle, couponDesc);

          generatedCoupon = {
            id: Number(resCoupon.lastInsertRowid),
            code: randomCode,
            title: couponTitle,
            description: couponDesc,
            status: 'active'
          };
        }
        db.exec('COMMIT;');
      } catch (txErr) {
        db.exec('ROLLBACK;');
        throw txErr;
      }
    }

    return res.json({
      success: true,
      message: stampsAfter === 5
        ? `⭐ ¡META 5/5 ALCANZADA para @${targetClient.pseudonym}! Se generó el cupón ${generatedCoupon.code}. Usa "Reset 0" tras entregar su premio.`
        : `¡Sello asignado con éxito a @${targetClient.pseudonym}! Saldo actual: ${stampsAfter}/5 sellos.`,
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
      message: 'No se pudo guardar el sello por un error de conexión con la base de datos. Por favor intenta nuevamente.'
    });
  }
}

module.exports = {
  getMyCard,
  addStampToClient,
  BUSINESS_RULE_TEXT
};
