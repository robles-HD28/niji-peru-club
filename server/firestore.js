/**
 * Conector oficial a Google Cloud Firestore REST API para NIJI Perú Club
 * Utiliza fetch nativo de Node.js con paginación completa y caché en memoria
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'niji-peru-club';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyD3d_MgCXa_kskzVMe88eGP0fpr0MNrpy8';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Caché en memoria de corta duración (TTL 8s) para optimizar búsquedas y proteger cuota de lecturas
const collectionCache = new Map();
const CACHE_TTL_MS = 8000;

function invalidateCache(collection) {
  if (collection) {
    collectionCache.delete(collection);
  } else {
    collectionCache.clear();
  }
}

function isFirestoreConfigured() {
  return Boolean(PROJECT_ID && API_KEY);
}

// Convertir un objeto JavaScript simple a formato Firestore REST fields
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value.toString() };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(v => typeof v === 'object' ? { mapValue: { fields: toFirestoreFields(v) } } : { stringValue: String(v) })
        }
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(value) } };
    }
  }
  return fields;
}

// Convertir un documento Firestore REST a un objeto JavaScript simple
function fromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const result = {};

  if (doc.name) {
    const parts = doc.name.split('/');
    result.id = parts[parts.length - 1];
  }

  for (const [key, valObj] of Object.entries(doc.fields)) {
    if ('stringValue' in valObj) {
      result[key] = valObj.stringValue;
    } else if ('integerValue' in valObj) {
      result[key] = parseInt(valObj.integerValue, 10);
    } else if ('doubleValue' in valObj) {
      result[key] = parseFloat(valObj.doubleValue);
    } else if ('booleanValue' in valObj) {
      result[key] = valObj.booleanValue;
    } else if ('nullValue' in valObj) {
      result[key] = null;
    } else if ('mapValue' in valObj) {
      result[key] = fromFirestoreDoc(valObj.mapValue);
    } else if ('arrayValue' in valObj) {
      result[key] = (valObj.arrayValue.values || []).map(v => v.stringValue || v.integerValue || v);
    }
  }
  return result;
}

// ================= OPERACIONES CRUD =================

async function getDoc(collection, docId) {
  const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore getDoc error [${collection}/${docId}] (${res.status}): ${err}`);
  }
  const data = await res.json();
  return fromFirestoreDoc(data);
}

async function setDoc(collection, docId, data) {
  const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(data) })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore setDoc error (${res.status}): ${err}`);
  }
  invalidateCache(collection);
  const result = await res.json();
  return fromFirestoreDoc(result);
}

async function addDoc(collection, data) {
  const url = `${BASE_URL}/${collection}?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(data) })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore addDoc error (${res.status}): ${err}`);
  }
  invalidateCache(collection);
  const result = await res.json();
  return fromFirestoreDoc(result);
}

/**
 * Consulta paginada completa con caché inteligente para evitar colapsos al crecer la BD
 */
async function queryCollection(collection, forceRefresh = false) {
  const now = Date.now();
  const cached = collectionCache.get(collection);
  if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.docs;
  }

  let allDocs = [];
  let pageToken = '';

  do {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `${BASE_URL}/${collection}?pageSize=300${tokenParam}&key=${API_KEY}`;
    const res = await fetch(url);
    if (res.status === 404) return [];
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore queryCollection error [${collection}] (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (data.documents && data.documents.length > 0) {
      allDocs = allDocs.concat(data.documents.map(fromFirestoreDoc));
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  collectionCache.set(collection, { docs: allDocs, timestamp: now });
  return allDocs;
}

async function deleteDoc(collection, docId) {
  const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  const res = await fetch(url, { method: 'DELETE' });
  invalidateCache(collection);
  return res.ok;
}

// ================= GESTIÓN DE USUARIOS =================

async function getUserByPseudonym(pseudonym) {
  if (!pseudonym) return null;
  const clean = pseudonym.trim().toLowerCase();
  return await getDoc('users', clean);
}

async function getUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const allUsers = await queryCollection('users');
  return allUsers.find(u => (u.email || '').toLowerCase() === cleanEmail) || null;
}

async function createUser(userObj) {
  const docId = userObj.pseudonym.trim().toLowerCase();
  return await setDoc('users', docId, {
    ...userObj,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

async function updateUser(pseudonym, fields) {
  const docId = pseudonym.trim().toLowerCase();
  const current = await getDoc('users', docId);
  if (!current) throw new Error('Usuario no encontrado en Firestore.');
  const merged = {
    ...current,
    ...fields,
    updated_at: new Date().toISOString()
  };
  return await setDoc('users', docId, merged);
}

async function getAllClients(query = '') {
  const allUsers = await queryCollection('users');
  const clients = allUsers.filter(u => u.role === 'client');
  if (!query) return clients;

  const q = query.toLowerCase().trim();
  return clients.filter(c =>
    (c.pseudonym || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.birthdate || '').includes(q)
  );
}

// ================= GESTIÓN DE PREMIOS DE RULETA =================

const DEFAULT_PRIZES = [
  { id: 'prize_1', title: '🍧 Raspadilla', description: '¡Una deliciosa raspadilla artesanal refrescante de regalo!', type: 'gift', value: 0, color: '#0d9488', text_color: '#ffffff', weight: 1 },
  { id: 'prize_2', title: '⭐ +1 Sello', description: '¡Se añade automáticamente 1 sello a tu tarjeta virtual!', type: 'stamp', value: 1, color: '#ff7e29', text_color: '#ffffff', weight: 2 },
  { id: 'prize_3', title: '✏️ Lapicero', description: '¡Te ganaste un lapicero oficial coleccionable de NIJI Perú!', type: 'gift', value: 0, color: '#ff4d5a', text_color: '#ffffff', weight: 2 },
  { id: 'prize_4', title: '🍍 Sin Premio', description: '¡Mala suerte esta vez! No hay premio, pero sigues acumulando sellos.', type: 'none', value: 0, color: '#f59e0b', text_color: '#ffffff', weight: 1 },
  { id: 'prize_5', title: '⭐ +1 Sello', description: '¡Se añade automáticamente 1 sello a tu tarjeta virtual!', type: 'stamp', value: 1, color: '#ff7e29', text_color: '#ffffff', weight: 2 },
  { id: 'prize_6', title: '✏️ Lapicero', description: '¡Te ganaste un lapicero oficial coleccionable de NIJI Perú!', type: 'gift', value: 0, color: '#ff4d5a', text_color: '#ffffff', weight: 2 }
];

async function getWheelPrizes() {
  const prizes = await queryCollection('wheel_prizes');
  if (prizes.length === 0 || prizes.length !== 6 || prizes[0].title !== '🍧 Raspadilla' || prizes[3].title !== '🍍 Sin Premio') {
    for (const p of DEFAULT_PRIZES) {
      await setDoc('wheel_prizes', p.id, p);
    }
    return DEFAULT_PRIZES;
  }
  return prizes;
}

// ================= GESTIÓN DE CUPONES =================

async function createCoupon(couponObj) {
  return await addDoc('coupons', {
    ...couponObj,
    created_at: new Date().toISOString()
  });
}

async function getActiveCoupon(pseudonym) {
  const clean = pseudonym.trim().toLowerCase();
  const coupons = await queryCollection('coupons');
  return coupons.find(c => (c.user_pseudonym || '').toLowerCase() === clean && c.status === 'active') || null;
}

async function getUserCoupons(pseudonym) {
  const clean = pseudonym.trim().toLowerCase();
  const coupons = await queryCollection('coupons');
  return coupons.filter(c => (c.user_pseudonym || '').toLowerCase() === clean);
}

async function redeemCouponByCode(code, adminPseudonym) {
  const coupons = await queryCollection('coupons', true);
  const target = coupons.find(c => (c.code || '').toUpperCase() === code.trim().toUpperCase());
  if (!target) return null;

  await setDoc('coupons', target.id, {
    ...target,
    status: 'redeemed',
    redeemed_at: new Date().toISOString(),
    redeemed_by_admin: adminPseudonym
  });

  return target;
}

async function markUserCouponsAsRedeemed(pseudonym, adminPseudonym) {
  const clean = pseudonym.trim().toLowerCase();
  const coupons = await queryCollection('coupons', true);
  const userCoupons = coupons.filter(c => (c.user_pseudonym || '').toLowerCase() === clean && c.status === 'active');
  for (const c of userCoupons) {
    await setDoc('coupons', c.id, {
      ...c,
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      redeemed_by_admin: adminPseudonym
    });
  }
  return userCoupons.length;
}

// ================= HISTORIAL DE SELLOS =================

async function addStampHistory(item) {
  return await addDoc('stamps_history', {
    ...item,
    created_at: new Date().toISOString()
  });
}

async function getUserStampHistory(pseudonym) {
  const clean = pseudonym.trim().toLowerCase();
  const allHistory = await queryCollection('stamps_history');
  return allHistory
    .filter(h => (h.user_pseudonym || '').toLowerCase() === clean)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

// ================= PROMOCIONES PROGRAMADAS =================

async function getActivePromotions(forceRefresh = false) {
  const allPromos = await queryCollection('promotions', forceRefresh);
  const now = new Date();

  return allPromos.filter(p => {
    if (p.is_active === 0 || p.is_active === false) return false;
    const expiresAt = new Date(p.expires_at);
    return expiresAt > now;
  });
}

async function getAllPromotions(forceRefresh = false) {
  return await queryCollection('promotions', forceRefresh);
}

async function createPromotion(promoObj) {
  const res = await addDoc('promotions', {
    ...promoObj,
    is_active: 1,
    created_at: new Date().toISOString()
  });
  invalidateCache('promotions');
  return res;
}

async function deactivatePromotion(promoId) {
  const cleanId = String(promoId).trim();
  let doc = await getDoc('promotions', cleanId);
  if (!doc) {
    const all = await queryCollection('promotions', true);
    doc = all.find(p => String(p.id) === cleanId);
  }
  if (doc) {
    await setDoc('promotions', doc.id, {
      ...doc,
      is_active: 0,
      deactivated_at: new Date().toISOString()
    });
    invalidateCache('promotions');
    return true;
  }
  return false;
}

async function deletePromotion(promoId) {
  const res = await deleteDoc('promotions', promoId);
  invalidateCache('promotions');
  return res;
}

// ================= GESTIÓN DE PRODUCTOS Y TIENDA (LANDING PAGE) =================

const DEFAULT_STORE_INFO = {
  store_name: 'NIJI Perú',
  hero_title: '¡Endulza tu día con el auténtico sabor kawaii!',
  hero_subtitle: 'Descubre nuestros cuchareables artesanales, raspadillas refrescantes y postres únicos preparados cada día para ti.',
  hero_image_url: '/img/niji-logo.png',
  whatsapp_number: 'https://wa.me/message/5WW2JMTOWA47J1',
  whatsapp_message: '¡Hola NIJI Perú! Quisiera hacer un pedido o consultar sobre sus productos.',
  address: 'Piura 20009, Perú — NIJI Perú',
  schedule: 'Lun - Dom: 12:00 PM - 9:00 PM',
  maps_query: 'Niji Perú, Piura 20009',
  maps_url: 'https://maps.app.goo.gl/qbLnkaY5zTVMrvTG9?g_st=aw'
};

const DEFAULT_PRODUCTS = [];

function inferProductCategory(name, existingCategory) {
  if (existingCategory && existingCategory.trim()) return existingCategory.trim();
  const n = String(name || '').toLowerCase();
  if (/cuchareable|cheesecake|tres leches|torta|\bmochis?\b|promoci[oó]n de 2x/i.test(n)) return 'Cuchareables';
  if (/raspadilla/i.test(n)) return 'Raspadillas';
  if (/postre|dulce|helado/i.test(n)) return 'Postres';
  if (/mikes|agua|volt|sporade|cifrut|cerveza|\bkr\b|guaran[aá]|bebida|gaseosa|jugo/i.test(n)) return 'Bebidas';
  return 'Otros';
}

function normalizeProductDoc(p, useImageEndpoint = true) {
  const category = inferProductCategory(p.name, p.category);
  let isVisible;
  if (p.is_visible !== undefined && p.is_visible !== null) {
    isVisible = (p.is_visible === 1 || p.is_visible === true) ? 1 : 0;
  } else {
    // Por defecto exhibir automáticamente los comestibles principales (Cuchareables, Raspadillas, Postres)
    isVisible = (category === 'Cuchareables' || category === 'Raspadillas' || category === 'Postres') ? 1 : 0;
  }

  const rawImg = p.image_url || p.photo_url || '';
  let imageUrl = rawImg;
  if (useImageEndpoint && rawImg.startsWith('data:image/')) {
    imageUrl = `/api/store/product-image/${encodeURIComponent(p.id)}?v=${encodeURIComponent(p.updated_at || '1')}`;
  }

  return {
    id: p.id,
    name: p.name || '',
    category,
    price: Number(p.price) || 0,
    description: p.description || '',
    image_url: imageUrl,
    is_visible: isVisible,
    stock: p.stock !== undefined ? Number(p.stock) : 0,
    created_at: p.created_at || '',
    updated_at: p.updated_at || ''
  };
}

async function getAllProducts(forceRefresh = false) {
  const products = await queryCollection('products', forceRefresh);
  return products
    .map(p => normalizeProductDoc(p, true))
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
}

async function getVisibleProducts(forceRefresh = false) {
  const all = await getAllProducts(forceRefresh);
  return all.filter(p => p.is_visible === 1 || p.is_visible === true);
}

async function getProductRawById(productId) {
  return await getDoc('products', productId);
}

async function createProduct(productObj) {
  const now = new Date().toISOString();
  const img = productObj.image_url || '';
  const res = await addDoc('products', {
    name: productObj.name,
    category: productObj.category || inferProductCategory(productObj.name, ''),
    price: Number(productObj.price) || 0,
    cost: Number(productObj.cost) || 0,
    stock: productObj.stock !== undefined ? Number(productObj.stock) : 10,
    description: productObj.description || '',
    image_url: img,
    photo_url: img,
    is_visible: productObj.is_visible !== undefined ? (productObj.is_visible ? 1 : 0) : 1,
    created_at: now,
    updated_at: now
  });
  invalidateCache('products');
  return normalizeProductDoc(res, true);
}

async function updateProduct(productId, updates) {
  const existing = await getDoc('products', productId);
  if (!existing) return null;

  const cleanUpdates = { ...updates };
  if (cleanUpdates.image_url !== undefined) {
    if (String(cleanUpdates.image_url).startsWith('/api/store/product-image/')) {
      // Conservar la imagen original en Base64 si el admin no subió una nueva
      delete cleanUpdates.image_url;
    } else {
      cleanUpdates.photo_url = cleanUpdates.image_url;
    }
  }

  const merged = {
    ...existing,
    ...cleanUpdates,
    updated_at: new Date().toISOString()
  };
  delete merged.id;
  await setDoc('products', existing.id, merged);
  invalidateCache('products');
  return normalizeProductDoc({ id: existing.id, ...merged }, true);
}

async function deleteProduct(productId) {
  const res = await deleteDoc('products', productId);
  invalidateCache('products');
  return res;
}

async function getStoreInfo(forceRefresh = false) {
  const docs = await queryCollection('landing_store_info', forceRefresh);
  const main = docs.find(d => d.id === 'main');
  if (!main) {
    await setDoc('landing_store_info', 'main', {
      ...DEFAULT_STORE_INFO,
      updated_at: new Date().toISOString()
    });
    return { id: 'main', ...DEFAULT_STORE_INFO };
  }
  return main;
}

async function updateStoreInfo(updates) {
  const current = await getStoreInfo(true);
  const merged = {
    ...DEFAULT_STORE_INFO,
    ...current,
    ...updates,
    updated_at: new Date().toISOString()
  };
  delete merged.id;
  await setDoc('landing_store_info', 'main', merged);
  invalidateCache('landing_store_info');
  return { id: 'main', ...merged };
}

// ================= INICIALIZACIÓN DE FIRESTORE =================

const bcrypt = require('bcryptjs');

async function initFirestoreDatabase() {
  if (!isFirestoreConfigured()) return;
  console.log('☁️ Verificando base de datos en Google Cloud Firestore (niji-peru-club)...');

  try {
    const adminUser = await getUserByPseudonym('NijiPeru28');
    const salt = bcrypt.genSaltSync(10);
    const adminPassHash = bcrypt.hashSync('Niji#2811Peru', salt);

    if (!adminUser) {
      console.log('👤 Creando cuenta oficial NijiPeru28 en Firestore...');
      await createUser({
        pseudonym: 'NijiPeru28',
        email: 'staff@nijiperu.com',
        birthdate: '2000-01-01',
        password_hash: adminPassHash,
        role: 'admin',
        stamps: 0,
        has_spun_wheel: 1,
        welcome_prize: 'Staff Oficial'
      });
    } else {
      await updateUser('NijiPeru28', {
        password_hash: adminPassHash,
        role: 'admin'
      });
    }

    const cajaUser = await getUserByPseudonym('NijiCaja26');
    const cajaPassHash = bcrypt.hashSync('Caja#Niji2026', salt);

    if (!cajaUser) {
      console.log('👤 Creando cuenta oficial NijiCaja26 en Firestore...');
      await createUser({
        pseudonym: 'NijiCaja26',
        email: 'caja@nijiperu.com',
        birthdate: '2000-01-01',
        password_hash: cajaPassHash,
        role: 'admin',
        stamps: 0,
        has_spun_wheel: 1,
        welcome_prize: 'Staff Oficial'
      });
    } else {
      await updateUser('NijiCaja26', {
        password_hash: cajaPassHash,
        role: 'admin'
      });
    }

    const existingPrizes = await queryCollection('wheel_prizes');
    if (existingPrizes.length !== 6 || existingPrizes[0].title !== '🍧 Raspadilla' || existingPrizes[3].title !== '🍍 Sin Premio') {
      console.log('🎁 Sincronizando 6 opciones oficiales y simétricas de Ruleta en Firestore...');
      for (const p of DEFAULT_PRIZES) {
        await setDoc('wheel_prizes', p.id, p);
      }
    }

    // Inicializar productos iniciales solo si la colección products está vacía
    const existingProducts = await queryCollection('products');
    if (existingProducts.length === 0) {
      console.log('🍨 Sembrando catálogo inicial de productos NIJI Perú en Firestore...');
      const now = new Date().toISOString();
      for (const prod of DEFAULT_PRODUCTS) {
        const { id, ...prodData } = prod;
        await setDoc('products', id, { ...prodData, created_at: now, updated_at: now });
      }
      invalidateCache('products');
    }

    // Asegurar documento de información básica de tienda y migrar placeholders si aún existen
    const currentInfo = await getStoreInfo(true);
    if (currentInfo && (currentInfo.whatsapp_number === '51999999999' || currentInfo.address === 'Av. Principal 123, Lima, Perú')) {
      await updateStoreInfo({
        whatsapp_number: DEFAULT_STORE_INFO.whatsapp_number,
        address: DEFAULT_STORE_INFO.address,
        maps_query: DEFAULT_STORE_INFO.maps_query,
        maps_url: DEFAULT_STORE_INFO.maps_url
      });
    }

    console.log('✅ Google Cloud Firestore conectado y listo para persistir datos 24/7.');

  } catch (initErr) {
    console.error('⚠️ Error al inicializar Firestore:', initErr.message);
  }
}

module.exports = {
  isFirestoreConfigured,
  invalidateCache,
  queryCollection,
  getUserByPseudonym,
  getUserByEmail,
  createUser,
  updateUser,
  getAllClients,
  getWheelPrizes,
  createCoupon,
  getActiveCoupon,
  getUserCoupons,
  redeemCouponByCode,
  markUserCouponsAsRedeemed,
  addStampHistory,
  getUserStampHistory,
  getActivePromotions,
  getAllPromotions,
  createPromotion,
  deactivatePromotion,
  deletePromotion,
  getAllProducts,
  getVisibleProducts,
  getProductRawById,
  createProduct,
  updateProduct,
  deleteProduct,
  getStoreInfo,
  updateStoreInfo,
  DEFAULT_STORE_INFO,
  DEFAULT_PRODUCTS,
  initFirestoreDatabase
};
