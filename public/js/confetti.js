/**
 * Generador de partículas de confeti en Canvas
 */
const Confetti = (() => {
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animationId = null;

  function init() {
    canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function launch(count = 70) {
    if (!canvas) init();
    if (!ctx) return;

    const colors = ['#e11d48', '#fbbf24', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316'];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() * 200 - 100),
        y: canvas.height / 3 + (Math.random() * 100 - 50),
        w: Math.random() * 10 + 6,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.8) * 15,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        opacity: 1
      });
    }

    if (!animationId) {
      animate();
    }
  }

  function animate() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Gravedad
      p.vx *= 0.98; // Resistencia
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.008;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    particles = particles.filter(p => p.opacity > 0 && p.y < canvas.height + 50);

    if (particles.length > 0) {
      animationId = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationId = null;
    }
  }

  return {
    init,
    launch
  };
})();
