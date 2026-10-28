const express = require('express');
const router = express.Router();

const { authenticateToken, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');
const wheelController = require('../controllers/wheelController');
const stampsController = require('../controllers/stampsController');
const adminController = require('../controllers/adminController');
const promoController = require('../controllers/promoController');

// ================= Rutas de Autenticación =================
// Registro de Cliente
router.post('/auth/register', authController.register);

// Login de Cliente (Pseudónimo + Password)
router.post('/auth/login', authController.loginClient);

// Login de Admin / Personal (Pseudónimo + Password)
router.post('/auth/admin-login', authController.loginAdmin);

// Perfil actual del usuario autenticado
router.get('/auth/me', authenticateToken, authController.getMe);

// ================= Módulo 1: Ruleta Spin-to-Win =================
router.get('/wheel/prizes', wheelController.getPrizes);
router.post('/wheel/spin', authenticateToken, requireRole('client'), wheelController.spinWheel);

// ================= Módulo 2: Tarjeta de Sellos (Cliente) =================
router.get('/stamps/my-card', authenticateToken, requireRole('client'), stampsController.getMyCard);

// ================= Módulo 3: Panel de Administración (Admin/Cajero) =================
// Métricas rápidas
router.get('/admin/metrics', authenticateToken, requireRole('admin'), adminController.getDashboardMetrics);

// Buscador de clientes por pseudónimo
router.get('/admin/clients', authenticateToken, requireRole('admin'), adminController.searchClients);

// Ficha detallada del cliente
router.get('/admin/clients/:id', authenticateToken, requireRole('admin'), adminController.getClientDetail);

// Asignación de sellos (+1 Sello manual al cierre del día)
router.post('/admin/stamps/add', authenticateToken, requireRole('admin'), stampsController.addStampToClient);

// Reinicio de tarjeta de sellos a 0 (al completar los 5 sellos)
router.post('/admin/stamps/reset', authenticateToken, requireRole('admin'), adminController.resetClientCard);

// Canje de cupón digital y reinicio de ciclo de sellos
router.post('/admin/coupons/redeem', authenticateToken, requireRole('admin'), adminController.redeemCoupon);

// ================= Promociones Programadas =================
// Promociones activas (Vista Cliente)
router.get('/promotions/active', promoController.getActivePromotions);

// Gestión de promociones (Vista Admin / Personal)
router.get('/admin/promotions', authenticateToken, requireRole('admin'), promoController.getAllPromotions);
router.post('/admin/promotions', authenticateToken, requireRole('admin'), promoController.createPromotion);
router.delete('/admin/promotions/:id', authenticateToken, requireRole('admin'), promoController.deletePromotion);

// Configuración de Firebase leída exclusivamente de variables de entorno
router.get('/config/firebase', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || null,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || null,
    appId: process.env.FIREBASE_APP_ID || null
  });
});

module.exports = router;
