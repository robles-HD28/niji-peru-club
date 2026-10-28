const { db } = require('../db');

/**
 * Obtener promociones activas y vigentes (Para el panel del cliente)
 * Solo muestra aquellas cuyo tiempo programado aún no ha expirado
 */
function getActivePromotions(req, res) {
  try {
    const promos = db.prepare(`
      SELECT id, title, message, tag, starts_at, expires_at, created_at,
             strftime('%Y-%m-%d %H:%M:%S', expires_at) as expires_at_formatted,
             CAST((strftime('%s', expires_at) - strftime('%s', datetime('now', 'localtime'))) / 60 AS INTEGER) as minutes_remaining
      FROM promotions
      WHERE is_active = 1
        AND datetime(expires_at) > datetime('now', 'localtime')
      ORDER BY id DESC
    `).all();

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
function getAllPromotions(req, res) {
  try {
    const promos = db.prepare(`
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
function createPromotion(req, res) {
  try {
    const adminId = req.user.id;
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

    let expiresAtSQL = '';

    if (durationHours && Number(durationHours) > 0) {
      // Calcular expiración sumando horas a la hora local actual de SQLite
      const hours = parseInt(durationHours, 10);
      expiresAtSQL = `datetime('now', 'localtime', '+${hours} hours')`;
    } else if (customExpiresAt) {
      // Validar fecha personalizada
      const targetDate = new Date(customExpiresAt);
      if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'La fecha y hora de expiración debe ser en el futuro.'
        });
      }
      const formattedDate = targetDate.toISOString().replace('T', ' ').substring(0, 19);
      expiresAtSQL = `'${formattedDate}'`;
    } else {
      // Por defecto: 24 horas de vigencia
      expiresAtSQL = "datetime('now', 'localtime', '+24 hours')";
    }

    // Insertar promoción con fecha de expiración calculada
    const insertQuery = `
      INSERT INTO promotions (admin_id, title, message, tag, starts_at, expires_at, is_active)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ${expiresAtSQL}, 1)
    `;

    const result = db.prepare(insertQuery).run(adminId, cleanTitle, cleanMessage, cleanTag);
    const newId = Number(result.lastInsertRowid);

    const createdPromo = db.prepare('SELECT * FROM promotions WHERE id = ?').get(newId);

    return res.status(201).json({
      success: true,
      message: `¡Promoción "${cleanTitle}" publicada exitosamente en el panel del cliente!`,
      promotion: createdPromo
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
 * Desactivar o eliminar promoción de inmediato (Admin/Cajero)
 */
function deletePromotion(req, res) {
  try {
    const { id } = req.params;

    const promo = db.prepare('SELECT id, title FROM promotions WHERE id = ?').get(id);
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promoción no encontrada.' });
    }

    // Marcar como inactiva
    db.prepare('UPDATE promotions SET is_active = 0 WHERE id = ?').run(id);

    return res.json({
      success: true,
      message: `La promoción "${promo.title}" ha sido desactivada del panel de clientes.`
    });

  } catch (error) {
    console.error('Error en deletePromotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al desactivar la promoción.'
    });
  }
}

module.exports = {
  getActivePromotions,
  getAllPromotions,
  createPromotion,
  deletePromotion
};
