/**
 * Conector oficial a Google Cloud Firestore REST API para NIJI Perú Club
 * Utiliza fetch nativo de Node.js (cero dependencias externas pesadas)
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'niji-peru-club';
const API_KEY = process.env.FIREBASE_API_KEY || '';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
  
  // Extraer el ID del documento a partir de su path completo (projects/.../documents/col/ID)
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
    console.error(`Firestore getDoc error [${collection}/${docId}]:`, err);
    return null;
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
    throw new Error(`Firestore setDoc error: ${err}`);
  }
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
    throw new Error(`Firestore addDoc error: ${err}`);
  }
  const result = await res.json();
  return fromFirestoreDoc(result);
}

async function queryCollection(collection) {
  const url = `${BASE_URL}/${collection}?pageSize=100&key=${API_KEY}`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) {
    console.error(`Firestore queryCollection error [${collection}]:`, await res.text());
    return [];
  }
  const data = await res.json();
  if (!data.documents) return [];
  return data.documents.map(fromFirestoreDoc);
}

async function deleteDoc(collection, docId) {
  const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  const res = await fetch(url, { method: 'DELETE' });
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
    (c.email || '').toLowerCase().includes(q)
  );
}

// ================= GESTIÓN DE PREMIOS DE RULETA =================

const DEFAULT_PRIZES = [
  { id: 'prize_1', title: 'Lapicero', description: '¡Te ganaste un lapicero oficial coleccionable de NIJI Perú!', type: 'gift', value: 0, color: '#ff4d5a', text_color: '#ffffff', weight: 2 },
  { id: 'prize_2', title: 'Raspadilla', description: '¡Una deliciosa raspadilla artesanal refrescante gratis!', type: 'gift', value: 0, color: '#0d9488', text_color: '#ffffff', weight: 2 },
  { id: 'prize_3', title: 'Un sello', description: '¡Se añade automáticamente 1 sello a tu tarjeta virtual!', type: 'stamp', value: 1, color: '#ff7e29', text_color: '#ffffff', weight: 2 },
  { id: 'prize_4', title: '🍍', description: '¡Mala suerte esta vez! No hay premio, pero sigues acumulando sellos.', type: 'none', value: 0, color: '#f59e0b', text_color: '#ffffff', weight: 2 },
  { id: 'prize_5', title: '🍍', description: '¡Mala suerte esta vez! No hay premio, pero sigues acumulando sellos.', type: 'none', value: 0, color: '#f43f5e', text_color: '#ffffff', weight: 2 },
  { id: 'prize_6', title: 'Vuelve a girar', description: '¡Qué suerte! Tienes un segundo tiro gratis. ¡Gira otra vez!', type: 'spin_again', value: 0, color: '#8b5cf6', text_color: '#ffffff', weight: 2 }
];

async function getWheelPrizes() {
  const prizes = await queryCollection('wheel_prizes');
  if (prizes.length === 0 || prizes.length !== 6 || prizes[0].title !== 'Lapicero') {
    // Sincronizar premios oficiales
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
  const coupons = await queryCollection('coupons');
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
  const coupons = await queryCollection('coupons');
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
  return allHistory.filter(h => (h.user_pseudonym || '').toLowerCase() === clean);
}

// ================= PROMOCIONES PROGRAMADAS =================

async function getActivePromotions() {
  const allPromos = await queryCollection('promotions');
  const now = new Date();

  return allPromos.filter(p => {
    if (p.is_active === 0) return false;
    const expiresAt = new Date(p.expires_at);
    return expiresAt > now;
  });
}

async function getAllPromotions() {
  return await queryCollection('promotions');
}

async function createPromotion(promoObj) {
  return await addDoc('promotions', {
    ...promoObj,
    is_active: 1,
    created_at: new Date().toISOString()
  });
}

async function deletePromotion(promoId) {
  return await deleteDoc('promotions', promoId);
}

// ================= INICIALIZACIÓN DE FIRESTORE =================

const bcrypt = require('bcryptjs');

async function initFirestoreDatabase() {
  if (!isFirestoreConfigured()) return;
  console.log('☁️ Verificando base de datos en Google Cloud Firestore (niji-peru-club)...');

  try {
    const admin1 = await getUserByPseudonym('admin_niji');
    if (!admin1) {
      console.log('👤 Creando cuenta admin_niji en Firestore...');
      const salt = bcrypt.genSaltSync(10);
      const hash1 = bcrypt.hashSync('NijiPeru#2026Admin', salt);
      await createUser({
        pseudonym: 'admin_niji',
        email: 'admin@nijiperu.com',
        birthdate: '1990-01-01',
        password_hash: hash1,
        role: 'admin',
        stamps: 0,
        has_spun_wheel: 1,
        welcome_prize: 'Staff Oficial'
      });
    }

    const admin2 = await getUserByPseudonym('caja_tienda');
    if (!admin2) {
      console.log('👤 Creando cuenta caja_tienda en Firestore...');
      const salt = bcrypt.genSaltSync(10);
      const hash2 = bcrypt.hashSync('Niji#Caja2026!', salt);
      await createUser({
        pseudonym: 'caja_tienda',
        email: 'caja@nijiperu.com',
        birthdate: '1995-05-15',
        password_hash: hash2,
        role: 'admin',
        stamps: 0,
        has_spun_wheel: 1,
        welcome_prize: 'Staff Oficial'
      });
    }

    // Inicializar o sincronizar premios oficiales de Ruleta en Firestore
    const existingPrizes = await queryCollection('wheel_prizes');
    if (existingPrizes.length !== 6 || existingPrizes[0].title !== 'Lapicero') {
      console.log('🎁 Sincronizando 6 opciones oficiales de Ruleta en Firestore...');
      for (const p of DEFAULT_PRIZES) {
        await setDoc('wheel_prizes', p.id, p);
      }
    }

    console.log('✅ Google Cloud Firestore conectado y listo para persistir datos 24/7.');

  } catch (initErr) {
    console.error('⚠️ Error al inicializar Firestore:', initErr.message);
  }
}

module.exports = {
  isFirestoreConfigured,
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
  deletePromotion,
  initFirestoreDatabase
};
