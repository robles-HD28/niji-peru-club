const { db } = require('../db');
const firestore = require('../firestore');

/**
 * Obtener lista de premios disponibles para la ruleta Spin-to-Win
 */
async function getPrizes(req, res) {
  try {
    let prizes = [];
    if (firestore.isFirestoreConfigured()) {
      prizes = await firestore.getWheelPrizes();
    }
    if (!prizes || prizes.length === 0) {
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
 * Ejecutar giro de la ruleta de bienvenida (Solo 1 vez por cliente registrado)
 */
async function spinWheel(req, res) {
  try {
    const userSession = req.user;

    let user = null;
    if (firestore.isFirestoreConfigured()) {
      user = await firestore.getUserByPseudonym(userSession.pseudonym);
    }
    if (!user) {
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
    }
    if (!prizes || prizes.length === 0) {
      prizes = db.prepare(`
        SELECT id, title, description, type, value, color, text_color, weight
        FROM wheel_prizes
        WHERE is_active = 1
        ORDER BY id ASC
      `).all();
    }

    if (prizes.length === 0) {
      return res.status(500).json({ success: false, message: 'No hay premios configurados en este momento.' });
    }

    // 3. Algoritmo de ruleta ponderada por peso
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

    // 4. Aplicar premio si otorga sellos
    let newStamps = user.stamps || 0;
    if (selectedPrize.type === 'stamp' && selectedPrize.value > 0) {
      newStamps = Math.min(5, newStamps + selectedPrize.value);
    }

    // 5. Actualizar usuario en Firestore de forma permanente
    if (firestore.isFirestoreConfigured()) {
      await firestore.updateUser(user.pseudonym, {
        has_spun_wheel: 1,
        welcome_prize: selectedPrize.title,
        stamps: newStamps
      });
    }

    // Réplica en SQLite
    try {
      db.prepare(`
        UPDATE users
        SET has_spun_wheel = 1,
            welcome_prize = ?,
            stamps = ?,
            updated_at = datetime('now', 'localtime')
        WHERE pseudonym = ? COLLATE NOCASE OR id = ?
      `).run(selectedPrize.title, newStamps, user.pseudonym, user.id || 0);
    } catch (e) {}

    return res.json({
      success: true,
      message: `¡Felicitaciones! Has ganado: ${selectedPrize.title}`,
      prize: selectedPrize,
      prizeIndex: selectedIndex,
      updatedStamps: newStamps,
      hasSpunWheel: 1
    });

  } catch (error) {
    console.error('Error en spinWheel:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el giro de la ruleta.'
    });
  }
}

module.exports = {
  getPrizes,
  spinWheel
};
