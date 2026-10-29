const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const firestore = require('../firestore');

// Derivar secreto JWT criptográfico: usa JWT_SECRET o combina con FIREBASE_API_KEY (secreto de entorno en Render)
const RAW_SECRET = process.env.JWT_SECRET || (process.env.FIREBASE_API_KEY ? `niji_jwt_${process.env.FIREBASE_API_KEY}` : 'niji_peru_local_dev_secret_2026');
const JWT_SECRET = crypto.createHash('sha256').update(RAW_SECRET).digest('hex');
const JWT_EXPIRES_IN = '7d';

// Limitador de intentos de inicio de sesión contra fuerza bruta (en memoria por IP)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutos

function rateLimitLogin(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record && now < record.resetAt) {
    if (record.count >= MAX_ATTEMPTS) {
      const waitMins = Math.ceil((record.resetAt - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Demasiados intentos de inicio de sesión. Por seguridad, espera ${waitMins} min.`
      });
    }
    record.count += 1;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  }
  next();
}

/**
 * Middleware para autenticar token JWT
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado: Token de autenticación no proporcionado.'
    });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Sesión inválida o expirada. Por favor, inicia sesión nuevamente.'
      });
    }

    try {
      let user = null;

      if (firestore.isFirestoreConfigured()) {
        user = await firestore.getUserByPseudonym(decoded.pseudonym);
      } else {
        user = db.prepare(`
          SELECT id, pseudonym, email, birthdate, role, stamps, has_spun_wheel, welcome_prize, accepts_promotions
          FROM users WHERE pseudonym = ? COLLATE NOCASE OR id = ?
        `).get(decoded.pseudonym || '', decoded.id || 0);
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'El usuario ya no existe en el sistema.'
        });
      }

      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Error verificando sesión en base de datos:', dbErr.message);
      return res.status(503).json({
        success: false,
        message: 'Servicio de base de datos temporalmente no disponible. Intenta de nuevo.'
      });
    }
  });
}

/**
 * Middleware para restringir acceso estrictamente por rol ('client' o 'admin')
 */
function requireRole(allowedRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado.' });
    }

    if (req.user.role !== allowedRole) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere rol de ${allowedRole === 'admin' ? 'Administrador/Personal' : 'Cliente'}.`
      });
    }

    next();
  };
}

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  rateLimitLogin,
  authenticateToken,
  requireRole
};
