const { db } = require('../db');
const firestore = require('../firestore');

/**
 * Obtener promociones activas y vigentes (Para el panel del cliente)
 * Solo muestra aquellas cuyo tiempo programado aún no ha expirado
 */
async function getActivePromotions(req, res) {
  try {
    let promos = [];

    if (firestore.isFirestoreConfigured()) {
      const cloudPromos = await firestore.getActivePromotions();
      const nowMs = Date.now();

      promos = cloudPromos.map(p => {
        const expMs = new Date(p.expires_at).getTime();
        const minutes_remaining = Math.max(0, Math.round((expMs - nowMs) / 60000));
        return {
          id: p.id,
          title: p.title,
          message: p.message,
          tag: p.tag || 'PROMO',
          starts_at: p.starts_at,
          expires_at: p.expires_at,
          created_at: p.created_at,
          minutes_remaining
        };
      });
    }

    if (promos.length === 0 && !firestore.isFirestoreConfigured()) {
      promos = db.prepare(`
        SELECT id, title, message, tag, starts_at, expires_at, created_at,
               strftime('%Y-%m-%d %H:%M:%S', expires_at) as expires_at_formatted,
               CAST((strftime('%s', expires_at) - strftime('%s', datetime('now', 'localtime'))) / 60 AS INTEGER) as minutes_remaining
        FROM promotions
        WHERE is_active = 1
          AND datetime(expires_at) > datetime('now', 'localtime')
        ORDER BY id DESC
      `).all();
    }

    // Formatear mensaje amigable de tiempo restante
    const formattedPromos = promos.map(p => {
      let timeRemainingText = '';
      const mins = p.minutes_remaining;

      if (mins < 60) {
        timeRemainingText = `⏳ Vence en ${Math.max(1, mins)} min`;
      } else if (mins < 1440) {
        const hours = Math.floor(mins / 60);
        timeRemainingText = `⏳ Vence en ${hours}h`;
      } else {
        const days = Math.floor(mins / 1440);
        timeRemainingText = `⏳ Válido por ${days} día${days > 1 ? 's' : ''}`;
      }

      return {
        ...p,
        timeRemainingText
      };
    });

    return res.json({
      success: true,
      promotions: formattedPromos
    });

  } catch (error) {
    console.error('Error en getActivePromotions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar promociones activas.'
    });
  }
}

/**
 * Obtener todas las promociones (Para el panel del cajero/admin)
 */
async function getAllPromotions(req, res) {
  try {
    let promos = [];

    if (firestore.isFirestoreConfigured()) {
      // Forzar lectura fresca para el panel de administración
      const cloudPromos = await firestore.getAllPromotions(true);
      const nowMs = Date.now();

      promos = cloudPromos.map(p => {
        const expMs = new Date(p.expires_at).getTime();
        const is_expired = (expMs <= nowMs || p.is_active === 0 || p.is_active === false) ? 1 : 0;
        const minutes_remaining = Math.max(0, Math.round((expMs - nowMs) / 60000));
        return {
          id: p.id,
          title: p.title,
          message: p.message,
          tag: p.tag || 'PROMO',
          starts_at: p.starts_at,
          expires_at: p.expires_at,
          is_active: (p.is_active === 0 || p.is_active === false) ? 0 : 1,
          is_expired,
          minutes_remaining,
          admin_pseudonym: p.admin_pseudonym || 'Admin',
          created_at: p.created_at
        };
      });
    }

    if (promos.length === 0 && !firestore.isFirestoreConfigured()) {
      promos = db.prepare(`
        SELECT p.id, p.title, p.message, p.tag, p.starts_at, p.expires_at, p.is_active, p.created_at,
               u.pseudonym as admin_pseudonym,
               CASE 
                 WHEN datetime(p.expires_at) <= datetime('now', 'localtime') THEN 1 
                 ELSE 0 
               END as is_expired,
               CAST((strftime('%s', p.expires_at) - strftime('%s', datetime('now', 'localtime'))) / 60 AS INTEGER) as minutes_remaining
        FROM promotions p
        JOIN users u ON p.admin_id = u.id
        ORDER BY p.id DESC
        LIMIT 30
      `).all();
    }

    return res.json({
      success: true,
      promotions: promos
    });

  } catch (error) {
    console.error('Error en getAllPromotions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar promociones para el personal.'
    });
  }
}

/**
 * Crear una nueva promoción con programación de tiempo (Admin/Cajero)
 */
async function createPromotion(req, res) {
  try {
    const adminPseudonym = req.user.pseudonym;
    const adminId = req.user.id || adminPseudonym;
    const { title, message, tag, durationHours, customExpiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, ingresa el título y el mensaje de la promoción.'
      });
    }

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const cleanTag = (tag || 'PROMO').trim().toUpperCase();

    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h por defecto

    if (durationHours && Number(durationHours) > 0) {
      expiresAt = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
    } else if (customExpiresAt) {
      const targetDate = new Date(customExpiresAt);
      if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'La fecha y hora de expiración debe ser en el futuro.'
        });
      }
      expiresAt = targetDate;
    }

    const nowISO = new Date().toISOString();
    const expiresISO = expiresAt.toISOString();

    let createdPromo = null;

    if (firestore.isFirestoreConfigured()) {
      createdPromo = await firestore.createPromotion({
        admin_pseudonym: adminPseudonym,
        title: cleanTitle,
        message: cleanMessage,
        tag: cleanTag,
        starts_at: nowISO,
        expires_at: expiresISO,
        is_active: 1
      });
    }

    // Réplica en SQLite
    try {
      const sqliteExpires = expiresISO.replace('T', ' ').substring(0, 19);
      const result = db.prepare(`
        INSERT INTO promotions (admin_id, title, message, tag, starts_at, expires_at, is_active)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime(?), 1)
      `).run(typeof adminId === 'number' ? adminId : 1, cleanTitle, cleanMessage, cleanTag, sqliteExpires);

      if (!createdPromo) {
        createdPromo = db.prepare('SELECT * FROM promotions WHERE id = ?').get(Number(result.lastInsertRowid));
      }
    } catch (e) {}

    return res.status(201).json({
      success: true,
      message: `¡Promoción "${cleanTitle}" publicada exitosamente en el panel del cliente!`,
      promotion: createdPromo || {
        title: cleanTitle,
        message: cleanMessage,
        tag: cleanTag,
        starts_at: nowISO,
        expires_at: expiresISO
      }
    });

  } catch (error) {
    console.error('Error en createPromotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al crear la promoción.'
    });
  }
}

/**
 * Desactivar promoción de inmediato (Admin/Cajero)
 */
async function deletePromotion(req, res) {
  try {
    const { id } = req.params;

    if (firestore.isFirestoreConfigured()) {
      await firestore.deactivatePromotion(id);
    } else {
      db.prepare('UPDATE promotions SET is_active = 0 WHERE id = ?').run(id);
    }

    return res.json({
      success: true,
      message: 'La promoción ha sido desactivada del panel de clientes exitosamente.'
    });

  } catch (error) {
    console.error('Error en deletePromotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al desactivar la promoción: ' + error.message
    });
  }
}

module.exports = {
  getActivePromotions,
  getAllPromotions,
  createPromotion,
  deletePromotion
};
