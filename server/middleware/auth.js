const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'niji_peru_secret_key_2026_super_secure';
const JWT_EXPIRES_IN = '7d';

/**
 * Middleware para autenticar token JWT
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado: Token de autenticación no proporcionado.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Sesión inválida o expirada. Por favor, inicia sesión nuevamente.'
      });
    }

    // Consultar usuario actualizado en la base de datos
    const user = db.prepare(`
      SELECT id, pseudonym, email, birthdate, role, stamps, has_spun_wheel, welcome_prize
      FROM users WHERE id = ?
    `).get(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'El usuario ya no existe en el sistema.'
      });
    }

    req.user = user;
    next();
  });
}

/**
 * Middleware para restringir acceso por rol ('client' o 'admin')
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
  authenticateToken,
  requireRole
};
