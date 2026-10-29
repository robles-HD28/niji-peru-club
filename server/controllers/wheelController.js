const { db } = require('../db');
const firestore = require('../firestore');

// Bloqueo en memoria contra condiciones de carrera (Race Condition) en giros simultáneos
const activeSpinLocks = new Set();

/**
 * Obtener lista de premios disponibles para la ruleta Spin-to-Win
 */
async function getPrizes(req, res) {
  try {
    let prizes = [];
    if (firestore.isFirestoreConfigured()) {
      prizes = await firestore.getWheelPrizes();
    } else {
      prizes = db.prepare(`
        SELECT id, title, description, type, value, color, text_color, weight
        FROM wheel_prizes
        WHERE is_active = 1
        ORDER BY id ASC
      `).all();
    }

    return res.json({
      success: true,
      prizes
    });
  } catch (error) {
    console.error('Error en getPrizes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar premios de la ruleta.'
    });
  }
}

/**
 * Ejecutar giro de la ruleta de bienvenida (Protegido en servidor contra manipulación y concurrencia)
 */
async function spinWheel(req, res) {
  const userSession = req.user;
  const lockKey = (userSession.pseudonym || '').toLowerCase();

  if (activeSpinLocks.has(lockKey)) {
    return res.status(429).json({
      success: false,
      message: 'Ya hay un giro en curso para tu cuenta. Por favor espera unos segundos.'
    });
  }

  activeSpinLocks.add(lockKey);

  try {
    let user = null;
    if (firestore.isFirestoreConfigured()) {
      user = await firestore.getUserByPseudonym(userSession.pseudonym);
    } else {
      user = db.prepare('SELECT id, pseudonym, stamps, has_spun_wheel, welcome_prize FROM users WHERE id = ?').get(userSession.id);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (user.has_spun_wheel === 1) {
      return res.status(400).json({
        success: false,
        message: 'Ya has utilizado tu giro de ruleta de bienvenida único.',
        welcomePrize: user.welcome_prize
      });
    }

    // 2. Obtener premios activos
    let prizes = [];
    if (firestore.isFirestoreConfigured()) {
      prizes = await firestore.getWheelPrizes();
    } else {
      prizes = db.prepare(`
        SELECT id, title, description, type, value, color, text_color, weight
        FROM wheel_prizes
        WHERE is_active = 1
        ORDER BY id ASC
      `).all();
    }

    if (!prizes || prizes.length === 0) {
      return res.status(500).json({ success: false, message: 'No hay premios configurados en este momento.' });
    }

    // 3. Algoritmo de ruleta ponderada ejecutado 100% en el servidor
    const totalWeight = prizes.reduce((acc, p) => acc + (p.weight || 1), 0);
    let randomNum = Math.random() * totalWeight;
    let selectedPrize = prizes[0];
    let selectedIndex = 0;

    for (let i = 0; i < prizes.length; i++) {
      randomNum -= (prizes[i].weight || 1);
      if (randomNum <= 0) {
        selectedPrize = prizes[i];
        selectedIndex = i;
        break;
      }
    }

    // 4. Aplicar premio según su tipo
    let newStamps = user.stamps || 0;
    let hasSpun = 1;
    let prizeRecordTitle = selectedPrize.title;

    if (selectedPrize.type === 'stamp' && selectedPrize.value > 0) {
      newStamps = Math.min(5, newStamps + selectedPrize.value);
    } else if (selectedPrize.type === 'spin_again') {
      hasSpun = 0; // Se le permite volver a girar la ruleta
      prizeRecordTitle = null;
    } else if (selectedPrize.type === 'none') {
      prizeRecordTitle = '🍍 (Sin premio)';
    }

    // 5. Persistir resultado de forma atómica
    if (firestore.isFirestoreConfigured()) {
      await firestore.updateUser(user.pseudonym, {
        has_spun_wheel: hasSpun,
        welcome_prize: prizeRecordTitle,
        stamps: newStamps
      });
    } else {
      db.prepare(`
        UPDATE users
        SET has_spun_wheel = ?,
            welcome_prize = ?,
            stamps = ?,
            updated_at = datetime('now', 'localtime')
        WHERE pseudonym = ? COLLATE NOCASE OR id = ?
      `).run(hasSpun, prizeRecordTitle, newStamps, user.pseudonym, user.id || 0);
    }

    let customMessage = `¡Felicitaciones! Has ganado: ${selectedPrize.title}`;
    if (selectedPrize.type === 'spin_again') {
      customMessage = '¡Qué suerte! Tienes un segundo tiro libre. ¡Gira la ruleta otra vez!';
    } else if (selectedPrize.type === 'none') {
      customMessage = '¡Uy, te tocó piña 🍍! No hay premio esta vez, pero tu tarjeta ya acumula sellos.';
    }

    return res.json({
      success: true,
      message: customMessage,
      prize: selectedPrize,
      prizeIndex: selectedIndex,
      updatedStamps: newStamps,
      hasSpunWheel: hasSpun,
      canSpinAgain: selectedPrize.type === 'spin_again'
    });

  } catch (error) {
    console.error('Error en spinWheel:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el giro de la ruleta. Tu giro no se ha consumido, intenta nuevamente.'
    });
  } finally {
    activeSpinLocks.delete(lockKey);
  }
}

module.exports = {
  getPrizes,
  spinWheel
};
