/**
 * Motor de Ruleta Canvas "Spin-to-Win" para NIJI Perú (Identidad Oficial)
 */
class RouletteWheel {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!canvasId || !this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.prizes = options.prizes || [];
    this.currentAngle = 0;
    this.isSpinning = false;
    this.onFinish = options.onFinish || (() => {});

    // Cargar imagen central del logo
    this.centerLogo = new Image();
    this.centerLogo.src = '/img/niji-logo.png';
    this.centerLogo.onload = () => this.draw();

    this.initCanvas();
    this.draw();
  }

  initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.min(rect.width || 320, 320);

    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = size;
    this.height = size;
    this.radius = (size / 2) - 16;
  }

  setPrizes(prizes) {
    this.prizes = prizes;
    this.draw();
  }

  draw() {
    if (!this.ctx || this.prizes.length === 0) return;

    const ctx = this.ctx;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const numSlices = this.prizes.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    ctx.clearRect(0, 0, this.width, this.height);

    // Sombra externa suave para fondo claro
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.radius + 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 126, 41, 0.22)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.restore();

    // Borde exterior en dorado cálido
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.radius + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Dibujar sectores
    for (let i = 0; i < numSlices; i++) {
      const prize = this.prizes[i];
      const startAngle = this.currentAngle + (i * sliceAngle);
      const endAngle = startAngle + sliceAngle;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, this.radius, startAngle, endAngle);
      ctx.closePath();

      // Relleno del sector con color oficial
      ctx.fillStyle = prize.color || '#ff6b00';
      ctx.fill();

      // Borde divisor blanco nítido
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Texto del premio
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = prize.text_color || '#ffffff';
      ctx.font = 'bold 12px "Outfit", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(prize.title, this.radius - 14, 4);
      ctx.restore();

      ctx.restore();
    }

    // Centro de la ruleta con avatar del Gatito NIJI
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 34, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ff6b00';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.clip();

    if (this.centerLogo.complete && this.centerLogo.naturalHeight !== 0) {
      // Dibujar imagen centrada
      ctx.drawImage(this.centerLogo, centerX - 28, centerY - 28, 56, 56);
    } else {
      ctx.fillStyle = '#ff2638';
      ctx.font = 'bold 20px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('niji', centerX, centerY);
    }
    ctx.restore();
  }

  spinTo(targetIndex, onComplete) {
    if (this.isSpinning || this.prizes.length === 0) return;
    this.isSpinning = true;

    const numSlices = this.prizes.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    const pointerAngle = 1.5 * Math.PI;
    const sliceCenterAngle = (targetIndex * sliceAngle) + (sliceAngle / 2);
    
    const fullSpins = 6;
    const normalizedTarget = (pointerAngle - sliceCenterAngle) % (2 * Math.PI);
    const finalAngle = (fullSpins * 2 * Math.PI) + (normalizedTarget >= 0 ? normalizedTarget : normalizedTarget + 2 * Math.PI);

    const startAngle = this.currentAngle % (2 * Math.PI);
    const totalAngleToRotate = finalAngle - startAngle;

    const duration = 5200;
    const startTime = performance.now();
    let lastSliceChecked = -1;

    const animateSpin = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = 1 - Math.pow(1 - progress, 3.5);
      this.currentAngle = startAngle + (totalAngleToRotate * ease);

      const currentSlice = Math.floor((this.currentAngle / sliceAngle)) % numSlices;
      if (currentSlice !== lastSliceChecked) {
        SoundEffects.playTick();
        lastSliceChecked = currentSlice;
      }

      this.draw();

      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        this.isSpinning = false;
        if (typeof onComplete === 'function') {
          onComplete(this.prizes[targetIndex]);
        }
      }
    };

    requestAnimationFrame(animateSpin);
  }
}
