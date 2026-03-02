function initFloatingParticlesOnBody() {
  // prevent duplicates
  if (document.querySelector('canvas.particles-canvas')) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'particles-canvas';

  // keep it out of layout flow + behind content
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '0' // або -1, якщо не треба перехоплювати нічого взагалі
  });

  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  const particles = [];
  const particleCount = 40;
  let dpr = 1;

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  class Particle {
    constructor() {
      this.reset();
      this.x = Math.random() * window.innerWidth;
      this.y = Math.random() * window.innerHeight;
    }
    reset() {
      this.size = Math.random() * 2 + 1;
      this.speedX = Math.random() * 0.5 - 0.25;
      this.speedY = Math.random() * 0.5 - 0.25;
      this.opacity = Math.random() * 0.5 + 0.2;
      this.base = Math.random() > 0.5 ? 'rgba(64, 224, 208,' : 'rgba(255, 215, 0,';
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x > window.innerWidth) this.x = 0;
      if (this.x < 0) this.x = window.innerWidth;
      if (this.y > window.innerHeight) this.y = 0;
      if (this.y < 0) this.y = window.innerHeight;
    }
    draw() {
      ctx.shadowBlur = 10;
      ctx.shadowColor = `${this.base}0.8)`;
      ctx.fillStyle = `${this.base}${this.opacity})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (const p of particles) { p.update(); p.draw(); }
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  animate();
}