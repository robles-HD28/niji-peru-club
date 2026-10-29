const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const firestore = require('../firestore');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');
const { getBirthdayStatus } = require('../utils/birthday');

/**
 * Registro de Cliente (Vista Cliente)
 * Campos: Pseudónimo, Correo electrónico, Fecha de nacimiento, Contraseña y Confirmación de contraseña
 */
async function register(req, res) {
  try {
    const { pseudonym, email, birthdate, password, confirmPassword, accepts_promotions, acceptsPromotions } = req.body;

    // 1. Validaciones de presencia
    if (!pseudonym || !email || !birthdate || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios: Pseudónimo, Correo electrónico, Fecha de nacimiento, Contraseña y Confirmación.'
      });
    }

    const cleanPseudonym = pseudonym.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanBirthdate = birthdate.trim();
    const optIn = (accepts_promotions === false || acceptsPromotions === false || accepts_promotions === 0 || acceptsPromotions === 0) ? 0 : 1;

    // 2. Validación de formato de pseudónimo
    if (cleanPseudonym.length < 3 || cleanPseudonym.length > 25) {
      return res.status(400).json({
        success: false,
        message: 'El pseudónimo debe contener entre 3 y 25 caracteres.'
      });
    }

    if (/\s/.test(cleanPseudonym)) {
      return res.status(400).json({
        success: false,
        message: 'El pseudónimo no puede contener espacios en blanco. Usa guiones bajos (_) si lo deseas.'
      });
    }

    // 3. Validación de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa un formato de correo electrónico válido.'
      });
    }

    // 4. Validación de fecha de nacimiento
    const birthDateObj = new Date(cleanBirthdate);
    if (isNaN(birthDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha de nacimiento inválido. Debe ser AAAA-MM-DD.'
      });
    }

    // 5. Validación de contraseña
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Las contraseñas no coinciden. Por favor, revísalas.'
      });
    }

    // 6. Verificar duplicados en Firestore o SQLite
    let existingUser = null;
    if (firestore.isFirestoreConfigured()) {
      existingUser = await firestore.getUserByPseudonym(cleanPseudonym) || await firestore.getUserByEmail(cleanEmail);
    }
    if (!existingUser) {
      existingUser = db.prepare(`
        SELECT id, pseudonym, email FROM users
        WHERE pseudonym = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
      `).get(cleanPseudonym, cleanEmail);
    }

    if (existingUser) {
      if (existingUser.pseudonym.toLowerCase() === cleanPseudonym.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: `El pseudónimo "${cleanPseudonym}" ya está en uso. Elige otro.`
        });
      }
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta registrada con este correo electrónico.'
      });
    }

    // 7. Hash de contraseña
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // 8. Inserción en Cloud Firestore de Google
    const userPayload = {
      pseudonym: cleanPseudonym,
      email: cleanEmail,
      birthdate: cleanBirthdate,
      password_hash: passwordHash,
      role: 'client',
      stamps: 0,
      has_spun_wheel: 0,
      welcome_prize: null,
      accepts_promotions: optIn
    };

    let newUserId = Date.now();
    if (firestore.isFirestoreConfigured()) {
      const createdFirestore = await firestore.createUser(userPayload);
      if (createdFirestore && createdFirestore.id) newUserId = createdFirestore.id;
    }

    // Réplica en SQLite local como fallback
    try {
      const result = db.prepare(`
        INSERT INTO users (pseudonym, email, birthdate, password_hash, role, stamps, has_spun_wheel, welcome_prize, accepts_promotions)
        VALUES (?, ?, ?, ?, 'client', 0, 0, NULL, ?)
      `).run(cleanPseudonym, cleanEmail, cleanBirthdate, passwordHash, optIn);
      if (!firestore.isFirestoreConfigured()) newUserId = Number(result.lastInsertRowid);
    } catch (e) {
      // Ignorar si en SQLite ya existía
    }

    // 9. Generar Token JWT
    const token = jwt.sign(
      { id: newUserId, pseudonym: cleanPseudonym, role: 'client' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const birthdayInfo = getBirthdayStatus(cleanBirthdate);

    return res.status(201).json({
      success: true,
      message: '¡Registro exitoso! Bienvenido a NIJI Perú.',
      token,
      user: {
        id: newUserId,
        pseudonym: cleanPseudonym,
        email: cleanEmail,
        birthdate: cleanBirthdate,
        role: 'client',
        stamps: 0,
        has_spun_wheel: 0,
        welcome_prize: null,
        accepts_promotions: optIn,
        birthdayInfo
      },
      must_spin_wheel: true
    });

  } catch (error) {
    console.error('Error en register:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno en el servidor al registrar usuario.'
    });
  }
}

/**
 * Inicio de Sesión de Cliente (Vista Cliente)
 */
async function loginClient(req, res) {
  try {
    const { pseudonym, password } = req.body;

    if (!pseudonym || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, ingresa tu pseudónimo y contraseña.'
      });
    }

    const cleanPseudonym = pseudonym.trim();

    let user = null;
    if (firestore.isFirestoreConfigured()) {
      user = await firestore.getUserByPseudonym(cleanPseudonym);
    }
    if (!user) {
      user = db.prepare(`
        SELECT * FROM users WHERE pseudonym = ? COLLATE NOCASE
      `).get(cleanPseudonym);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas. Revisa tu pseudónimo y contraseña.'
      });
    }

    if (user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Esta cuenta pertenece al personal. Utiliza el portal de Administración (/admin).'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas. Revisa tu pseudónimo y contraseña.'
      });
    }

    const token = jwt.sign(
      { id: user.id || user.pseudonym, pseudonym: user.pseudonym, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const birthdayInfo = getBirthdayStatus(user.birthdate);

    return res.json({
      success: true,
      message: `¡Hola de nuevo, ${user.pseudonym}!`,
      token,
      user: {
        id: user.id || user.pseudonym,
        pseudonym: user.pseudonym,
        email: user.email,
        birthdate: user.birthdate,
        role: user.role,
        stamps: user.stamps || 0,
        has_spun_wheel: user.has_spun_wheel || 0,
        welcome_prize: user.welcome_prize,
        accepts_promotions: user.accepts_promotions !== undefined ? user.accepts_promotions : 1,
        birthdayInfo
      },
      must_spin_wheel: user.has_spun_wheel === 0
    });

  } catch (error) {
    console.error('Error en loginClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno en el servidor al iniciar sesión.'
    });
  }
}

/**
 * Inicio de Sesión de Administrador / Cajero (Vista Admin)
 */
async function loginAdmin(req, res) {
  try {
    const { pseudonym, password } = req.body;

    if (!pseudonym || !password) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa el usuario de personal y contraseña.'
      });
    }

    const cleanPseudonym = pseudonym.trim();

    let user = null;
    if (firestore.isFirestoreConfigured()) {
      user = await firestore.getUserByPseudonym(cleanPseudonym);
    }
    if (!user) {
      user = db.prepare(`
        SELECT * FROM users WHERE pseudonym = ? COLLATE NOCASE
      `).get(cleanPseudonym);
    }

    if (!user || user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Acceso no autorizado. Credenciales de personal inválidas.'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Acceso no autorizado. Credenciales de personal inválidas.'
      });
    }

    const token = jwt.sign(
      { id: user.id || user.pseudonym, pseudonym: user.pseudonym, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      message: 'Bienvenido al Portal de Administración NIJI Perú.',
      token,
      user: {
        id: user.id || user.pseudonym,
        pseudonym: user.pseudonym,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error en loginAdmin:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión de administrador.'
    });
  }
}

/**
 * Obtener perfil del usuario en sesión actual (/api/auth/me)
 */
async function getMe(req, res) {
  try {
    const user = req.user;
    const birthdayInfo = getBirthdayStatus(user.birthdate);

    let activeCoupon = null;
    if (firestore.isFirestoreConfigured()) {
      activeCoupon = await firestore.getActiveCoupon(user.pseudonym);
    }
    if (!activeCoupon) {
      activeCoupon = db.prepare(`
        SELECT id, code, title, description, status, created_at
        FROM coupons
        WHERE user_id = ? AND status = 'active'
        ORDER BY id DESC LIMIT 1
      `).get(user.id);
    }

    return res.json({
      success: true,
      user: {
        id: user.id || user.pseudonym,
        pseudonym: user.pseudonym,
        email: user.email,
        birthdate: user.birthdate,
        role: user.role,
        stamps: user.stamps || 0,
        has_spun_wheel: user.has_spun_wheel || 0,
        welcome_prize: user.welcome_prize,
        accepts_promotions: user.accepts_promotions !== undefined ? user.accepts_promotions : 1,
        birthdayInfo
      },
      activeCoupon: activeCoupon || null,
      businessRule: 'Se otorga un sello por cada S/ 5 de consumo y la actualización se procesa al cierre del día.'
    });
  } catch (error) {
    console.error('Error en getMe:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al recuperar perfil de usuario.'
    });
  }
}

module.exports = {
  register,
  loginClient,
  loginAdmin,
  getMe
};
