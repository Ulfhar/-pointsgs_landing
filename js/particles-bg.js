function initFloatingParticlesOnBody() {
  // prevent duplicates
  if (document.querySelector('canvas.particles-canvas')) return;
  if (document.body.classList.contains('blog-page')) {
    initReadingParticlesOnBody();
    return;
  }

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

// Gentle blog ambience. The landing page keeps its original particle settings.
function initReadingParticlesOnBody() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  canvas.className = 'particles-canvas blog-particles';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = [];
  let width = 0, height = 0, frame = null, lastTime = null;

  function makeParticle() {
    return {
      x: Math.random() * width, y: Math.random() * height,
      size: 1.2 + Math.random() * 1.3,
      speedX: (Math.random() - 0.5) * 4,
      speedY: -(2 + Math.random() * 3),
      opacity: 0.25 + Math.random() * 0.2,
      color: Math.random() > 0.5 ? '112, 216, 202' : '242, 208, 114'
    };
  }

  function draw(delta) {
    ctx.clearRect(0, 0, width, height);
    const readingWidth = Math.min(800, width - 32);
    const readingLeft = (width - readingWidth) / 2;
    for (const p of particles) {
      p.x = (p.x + p.speedX * delta + width) % width;
      p.y = (p.y + p.speedY * delta + height) % height;
      // Keep the glow softer beneath the reading column.
      const softness = p.x >= readingLeft && p.x <= readingLeft + readingWidth ? 0.4 : 1;
      ctx.shadowBlur = 7;
      ctx.shadowColor = `rgba(${p.color}, ${0.24 * softness})`;
      ctx.fillStyle = `rgba(${p.color}, ${p.opacity * softness})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function resize() {
    const oldWidth = width, oldHeight = height;
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (oldWidth && oldHeight) {
      particles.forEach(p => { p.x *= width / oldWidth; p.y *= height / oldHeight; });
    }
    const count = Math.max(10, Math.min(24, Math.round(width * height / 55000)));
    particles.length = Math.min(particles.length, count);
    while (particles.length < count) particles.push(makeParticle());
    draw(0);
  }

  function animate(time) {
    if (document.hidden || reducedMotion.matches) { frame = null; return; }
    if (lastTime === null) lastTime = time;
    const elapsed = time - lastTime;
    if (elapsed >= 1000 / 30) {
      draw(Math.min(elapsed / 1000, 0.1));
      lastTime = time;
    }
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    if (document.hidden) return;
    draw(0);
    if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', syncMotion);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', syncMotion);
  else reducedMotion.addListener(syncMotion);
  syncMotion();
}

// Deferred blog scripts initialize themselves; other pages retain explicit startup.
(function () {
  function initBlogParticles() {
    if (document.body.classList.contains('blog-page')) initFloatingParticlesOnBody();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBlogParticles, { once: true });
  else initBlogParticles();
})();
