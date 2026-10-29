const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { initDatabase } = require('./db');
const seed = require('./seed');
const firestore = require('./firestore');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar y sembrar BD si es necesario
initDatabase();
seed();
firestore.initFirestoreDatabase();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos de la PWA con headers para evitar caché obsoleto
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Desactivar caché HTTP en rutas API para garantizar datos en tiempo real
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Rutas de API REST
app.use('/api', apiRoutes);

// Redirigir cualquier otra ruta al index.html para soportar navegación SPA / PWA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('⚠️ Error no controlado en servidor:', err);
  res.status(500).json({
    success: false,
    message: 'Ocurrió un error inesperado en el servidor NIJI Perú.'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor NIJI Perú Loyalty PWA activo en: http://localhost:${PORT}`);
  console.log(`📱 Vista Cliente: http://localhost:${PORT}`);
  console.log(`🔒 Vista Cajero/Admin: http://localhost:${PORT}/#admin-login`);
});

module.exports = app;
