(() => {
  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      document.body.classList.add('is-loaded');
    });
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const isMobile = window.matchMedia('(width < 748px)').matches;

  // pan range on each axis, in percent, around the 50% center
  const range = 15;

  let targetX = 50;
  let targetY = 50;
  let currentX = 50;
  let currentY = 50;
  let dustX = 50;
  let dustY = 50;

  // ----- pointer/gyro input -----
  if (!isMobile) {
    window.addEventListener('mousemove', (e) => {
      const xRatio = e.clientX / window.innerWidth;
      const yRatio = e.clientY / window.innerHeight;
      targetX = 50 - range + xRatio * range * 2;
      targetY = 50 - range + yRatio * range * 2;
    });
  } else {
    setupGyro();
  }

  function setupGyro() {
    const maxTilt = 20; // degrees of tilt mapped to the full pan range
    let baseBeta = null;
    let baseGamma = null;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function handleOrientation(e) {
      if (e.beta === null || e.gamma === null) return;

      if (baseBeta === null) {
        baseBeta = e.beta;
        baseGamma = e.gamma;
      }

      const deltaBeta = clamp(e.beta - baseBeta, -maxTilt, maxTilt);
      const deltaGamma = clamp(e.gamma - baseGamma, -maxTilt, maxTilt);

      targetX = 50 + (deltaGamma / maxTilt) * range;
      targetY = 50 + (deltaBeta / maxTilt) * range;
    }

    function enableGyro() {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS requires an explicit user gesture before granting motion sensor access
      const requestGyroPermission = () => {
        document.removeEventListener('click', requestGyroPermission);
        document.removeEventListener('touchend', requestGyroPermission);
        DeviceOrientationEvent.requestPermission()
          .then((state) => {
            if (state === 'granted') enableGyro();
          })
          .catch(() => {});
      };
      document.addEventListener('click', requestGyroPermission, { once: true });
      document.addEventListener('touchend', requestGyroPermission, { once: true });
    } else {
      enableGyro();
    }
  }

  // ----- floating dust particles -----
  const canvas = document.getElementById('dust');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bandRatio = 0.55; // dust stays within the top 55% of the viewport
  const maxParallax = 14; // px of drift applied to particles from pointer/gyro

  let particles = [];

  function spawnParticle() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * bandRatio,
      r: Math.random() * 1.6 + 0.6,
      baseAlpha: Math.random() * 0.45 + 0.15,
      vy: (Math.random() * 0.18 + 0.04) * (Math.random() < 0.5 ? 1 : -1),
      wobbleAmp: Math.random() * 14 + 6,
      wobbleSpeed: Math.random() * 0.5 + 0.15,
      wobblePhase: Math.random() * Math.PI * 2,
      depth: Math.random() * 0.6 + 0.4,
    };
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    const count = Math.round((window.innerWidth * window.innerHeight) / 3000);
    particles = Array.from({ length: count }, spawnParticle);
  }

  function drawParticles(time) {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const pointerXNorm = (dustX - 50) / range; // -1..1
    const pointerYNorm = (dustY - 50) / range;
    const band = window.innerHeight * bandRatio;

    particles.forEach((p) => {
      p.y += p.vy;
      if (p.y < -10) p.y = band + 10;
      if (p.y > band + 10) p.y = -10;

      const wobbleX = Math.sin(time * 0.001 * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmp;
      const drawX = p.x + wobbleX + pointerXNorm * maxParallax * p.depth;
      const drawY = p.y + pointerYNorm * maxParallax * p.depth;

      const edgeFade = Math.min(1, (band - p.y) / (band * 0.15) + 1, (p.y + 10) / (band * 0.15));
      const alpha = p.baseAlpha * Math.max(0, Math.min(1, edgeFade));

      ctx.beginPath();
      ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 246, 214, ${alpha})`;
      ctx.fill();
    });
  }

  if (canvas && ctx) {
    resizeCanvas();
    createParticles();
    window.addEventListener('resize', () => {
      resizeCanvas();
      createParticles();
    });
  }

  function tick(time) {
    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;
    dustX += (targetX - dustX) * 0.02;
    dustY += (targetY - dustY) * 0.02;
    document.body.style.backgroundPosition = `${currentX}% ${currentY}%`;
    drawParticles(time);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
