/**
 * Utilidades para verificación y personalización de fecha de nacimiento
 */
function getBirthdayStatus(birthdateStr) {
  if (!birthdateStr) {
    return {
      isBirthdayToday: false,
      isBirthdayMonth: false,
      daysUntilBirthday: null,
      greetingMessage: null
    };
  }

  const [birthYear, birthMonth, birthDay] = birthdateStr.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate();

  const isBirthdayToday = (currentMonth === birthMonth && currentDay === birthDay);
  const isBirthdayMonth = (currentMonth === birthMonth);

  // Calcular días restantes para el próximo cumpleaños
  let nextBirthday = new Date(currentYear, birthMonth - 1, birthDay);
  const todayDateOnly = new Date(currentYear, now.getMonth(), currentDay);

  if (nextBirthday < todayDateOnly) {
    nextBirthday = new Date(currentYear + 1, birthMonth - 1, birthDay);
  }

  const diffTime = nextBirthday.getTime() - todayDateOnly.getTime();
  const daysUntilBirthday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let greetingMessage = '';
  if (isBirthdayToday) {
    greetingMessage = '🎂 ¡Feliz Cumpleaños! En NIJI Perú celebramos tu día especial. ¡Presenta tu documento en caja para una cortesía exclusiva de la casa!';
  } else if (isBirthdayMonth) {
    greetingMessage = '🎉 ¡Estamos en el mes de tu cumpleaños! Disfruta de promociones y beneficios especiales pensados para ti durante todo este mes.';
  } else if (daysUntilBirthday !== null && daysUntilBirthday <= 30) {
    greetingMessage = `🎈 ¡Faltan solo ${daysUntilBirthday} días para tu cumpleaños! Ve preparando tu lista de antojos en NIJI.`;
  }

  return {
    birthdate: birthdateStr,
    isBirthdayToday,
    isBirthdayMonth,
    daysUntilBirthday,
    greetingMessage
  };
}

module.exports = {
  getBirthdayStatus
};
