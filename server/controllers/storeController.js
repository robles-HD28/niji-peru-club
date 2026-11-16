const { db } = require('../db');
const firestore = require('../firestore');

/**
 * Formatea el tiempo restante de promociones activas
 */
function formatRemainingTime(minutesRemaining) {
  const mins = Math.max(0, minutesRemaining || 0);
  if (mins < 60) {
    return `⏳ Vence en ${Math.max(1, mins)} min`;
  }
  if (mins < 1440) {
    const hours = Math.floor(mins / 60);
    return `⏳ Vence en ${hours}h`;
  }
  const days = Math.floor(mins / 1440);
  return `⏳ Válido por ${days} día${days > 1 ? 's' : ''}`;
}

/**
 * Endpoint público para la Landing Page:
 * Retorna información de la tienda, productos visibles y promociones activas
 */
async function getLandingData(req, res) {
  try {
    let storeInfo = null;
    let products = [];
    let promotions = [];

    if (firestore.isFirestoreConfigured()) {
      const [info, visibleProds, activePromos] = await Promise.all([
        firestore.getStoreInfo(),
        firestore.getVisibleProducts(),
        firestore.getActivePromotions()
      ]);

      storeInfo = info;
      products = visibleProds;

      const nowMs = Date.now();
      promotions = activePromos.map(p => {
        const expMs = new Date(p.expires_at).getTime();
        const mins = Math.max(0, Math.round((expMs - nowMs) / 60000));
        return {
          id: p.id,
          title: p.title,
          message: p.message,
          tag: p.tag || 'PROMO',
          expires_at: p.expires_at,
          timeRemainingText: formatRemainingTime(mins)
        };
      });
    } else {
      storeInfo = db.prepare("SELECT * FROM store_info WHERE id = 'main'").get() || firestore.DEFAULT_STORE_INFO;
      products = db.prepare('SELECT * FROM products WHERE is_visible = 1 ORDER BY id DESC').all();

      const sqlitePromos = db.prepare(`
        SELECT id, title, message, tag, expires_at,
               CAST((strftime('%s', expires_at) - strftime('%s', datetime('now', 'localtime'))) / 60 AS INTEGER) as minutes_remaining
        FROM promotions
        WHERE is_active = 1 AND datetime(expires_at) > datetime('now', 'localtime')
        ORDER BY id DESC
      `).all();

      promotions = sqlitePromos.map(p => ({
        ...p,
        timeRemainingText: formatRemainingTime(p.minutes_remaining)
      }));
    }

    return res.json({
      success: true,
      storeInfo,
      products,
      promotions
    });
  } catch (error) {
    console.error('Error en getLandingData:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cargar la información de la tienda.'
    });
  }
}

/**
 * Admin: Listar todos los productos (visibles y ocultos)
 */
async function getAdminProducts(req, res) {
  try {
    let products = [];
    if (firestore.isFirestoreConfigured()) {
      products = await firestore.getAllProducts(true);
    } else {
      products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
    }

    return res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error en getAdminProducts:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el catálogo de productos.'
    });
  }
}

/**
 * Admin: Crear un nuevo producto
 */
async function createProduct(req, res) {
  try {
    const { name, category, price, description, image_url, is_visible } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del producto es obligatorio.'
      });
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa un precio válido (mayor o igual a 0).'
      });
    }

    const cleanName = name.trim();
    const cleanCategory = (category || 'Otros').trim();
    const cleanDesc = (description || '').trim();
    const cleanImage = (image_url || '').trim();
    const visibleFlag = is_visible === false || is_visible === 0 || is_visible === '0' ? 0 : 1;

    let created = null;

    if (firestore.isFirestoreConfigured()) {
      created = await firestore.createProduct({
        name: cleanName,
        category: cleanCategory,
        price: numericPrice,
        description: cleanDesc,
        image_url: cleanImage,
        is_visible: visibleFlag
      });
    } else {
      const info = db.prepare(`
        INSERT INTO products (name, category, price, description, image_url, is_visible)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cleanName, cleanCategory, numericPrice, cleanDesc, cleanImage, visibleFlag);

      created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    }

    return res.status(201).json({
      success: true,
      message: `Producto "${cleanName}" agregado al catálogo.`,
      product: created
    });
  } catch (error) {
    console.error('Error en createProduct:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al guardar el producto.'
    });
  }
}

/**
 * Admin: Actualizar producto existente (nombre, precio, imagen, visibilidad, etc.)
 */
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { name, category, price, description, image_url, is_visible } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (category !== undefined) updates.category = String(category).trim();
    if (price !== undefined) {
      const p = Number(price);
      if (Number.isNaN(p) || p < 0) {
        return res.status(400).json({ success: false, message: 'Precio inválido.' });
      }
      updates.price = p;
    }
    if (description !== undefined) updates.description = String(description).trim();
    if (image_url !== undefined) updates.image_url = String(image_url).trim();
    if (is_visible !== undefined) {
      updates.is_visible = is_visible === false || is_visible === 0 || is_visible === '0' ? 0 : 1;
    }

    let updated = null;
    if (firestore.isFirestoreConfigured()) {
      updated = await firestore.updateProduct(id, updates);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
      }
    } else {
      const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
      }
      db.prepare(`
        UPDATE products
        SET name = ?, category = ?, price = ?, description = ?, image_url = ?, is_visible = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(
        updates.name ?? existing.name,
        updates.category ?? existing.category,
        updates.price ?? existing.price,
        updates.description ?? existing.description,
        updates.image_url ?? existing.image_url,
        updates.is_visible ?? existing.is_visible,
        id
      );
      updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    }

    return res.json({
      success: true,
      message: 'Producto actualizado correctamente.',
      product: updated
    });
  } catch (error) {
    console.error('Error en updateProduct:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el producto.'
    });
  }
}

/**
 * Admin: Eliminar producto
 */
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    if (firestore.isFirestoreConfigured()) {
      await firestore.deleteProduct(id);
    } else {
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    }

    return res.json({
      success: true,
      message: 'Producto eliminado del catálogo.'
    });
  } catch (error) {
    console.error('Error en deleteProduct:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar el producto.'
    });
  }
}

/**
 * Admin: Obtener configuración actual de la tienda
 */
async function getAdminStoreInfo(req, res) {
  try {
    let storeInfo = null;
    if (firestore.isFirestoreConfigured()) {
      storeInfo = await firestore.getStoreInfo(true);
    } else {
      storeInfo = db.prepare("SELECT * FROM store_info WHERE id = 'main'").get() || firestore.DEFAULT_STORE_INFO;
    }

    return res.json({
      success: true,
      storeInfo
    });
  } catch (error) {
    console.error('Error en getAdminStoreInfo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la información de la tienda.'
    });
  }
}

/**
 * Admin: Actualizar información básica, WhatsApp, dirección, mapa e imagen principal
 */
async function updateAdminStoreInfo(req, res) {
  try {
    const {
      store_name,
      hero_title,
      hero_subtitle,
      hero_image_url,
      whatsapp_number,
      whatsapp_message,
      address,
      schedule,
      maps_query
    } = req.body;

    // Limpiar número de WhatsApp dejando solo dígitos
    const cleanPhone = String(whatsapp_number || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa un número de WhatsApp válido (incluyendo código de país, ej: 51999999999).'
      });
    }

    const updates = {
      store_name: (store_name || 'NIJI Perú').trim(),
      hero_title: (hero_title || '¡Endulza tu día con NIJI Perú!').trim(),
      hero_subtitle: (hero_subtitle || '').trim(),
      hero_image_url: (hero_image_url || '/img/niji-logo.png').trim(),
      whatsapp_number: cleanPhone,
      whatsapp_message: (whatsapp_message || '¡Hola NIJI Perú!').trim(),
      address: (address || '').trim(),
      schedule: (schedule || '').trim(),
      maps_query: (maps_query || address || 'Lima, Peru').trim()
    };

    let updated = null;
    if (firestore.isFirestoreConfigured()) {
      updated = await firestore.updateStoreInfo(updates);
    } else {
      const existing = db.prepare("SELECT id FROM store_info WHERE id = 'main'").get();
      if (!existing) {
        db.prepare(`
          INSERT INTO store_info (id, store_name, hero_title, hero_subtitle, hero_image_url, whatsapp_number, whatsapp_message, address, schedule, maps_query)
          VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          updates.store_name, updates.hero_title, updates.hero_subtitle,
          updates.hero_image_url, updates.whatsapp_number, updates.whatsapp_message,
          updates.address, updates.schedule, updates.maps_query
        );
      } else {
        db.prepare(`
          UPDATE store_info
          SET store_name = ?, hero_title = ?, hero_subtitle = ?, hero_image_url = ?, whatsapp_number = ?, whatsapp_message = ?, address = ?, schedule = ?, maps_query = ?, updated_at = datetime('now', 'localtime')
          WHERE id = 'main'
        `).run(
          updates.store_name, updates.hero_title, updates.hero_subtitle,
          updates.hero_image_url, updates.whatsapp_number, updates.whatsapp_message,
          updates.address, updates.schedule, updates.maps_query
        );
      }
      updated = db.prepare("SELECT * FROM store_info WHERE id = 'main'").get();
    }

    return res.json({
      success: true,
      message: 'Información de la tienda actualizada con éxito.',
      storeInfo: updated
    });
  } catch (error) {
    console.error('Error en updateAdminStoreInfo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al guardar la información de la tienda.'
    });
  }
}

module.exports = {
  getLandingData,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminStoreInfo,
  updateAdminStoreInfo
};
