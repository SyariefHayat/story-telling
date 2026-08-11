// ===== Load-in blur fade + cursor/gyro parallax + dust particles =====
(() => {
  window.addEventListener("load", () => {
    requestAnimationFrame(() => {
      document.body.classList.add("is-loaded");
    });
  });

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReducedMotion) return;

  const isMobile = window.matchMedia("(width < 748px)").matches;

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
    window.addEventListener("mousemove", (e) => {
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
      window.addEventListener("deviceorientation", handleOrientation);
    }

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      // iOS requires an explicit user gesture before granting motion sensor access
      const requestGyroPermission = () => {
        document.removeEventListener("click", requestGyroPermission);
        document.removeEventListener("touchend", requestGyroPermission);
        DeviceOrientationEvent.requestPermission()
          .then((state) => {
            if (state === "granted") enableGyro();
          })
          .catch(() => {});
      };
      document.addEventListener("click", requestGyroPermission, { once: true });
      document.addEventListener("touchend", requestGyroPermission, {
        once: true,
      });
    } else {
      enableGyro();
    }
  }

  const bgPhoto = document.getElementById("bgPhoto");

  // ----- floating dust particles -----
  const canvas = document.getElementById("dust");
  const ctx = canvas ? canvas.getContext("2d") : null;
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

      const wobbleX =
        Math.sin(time * 0.001 * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmp;
      const drawX = p.x + wobbleX + pointerXNorm * maxParallax * p.depth;
      const drawY = p.y + pointerYNorm * maxParallax * p.depth;

      const edgeFade = Math.min(
        1,
        (band - p.y) / (band * 0.15) + 1,
        (p.y + 10) / (band * 0.15),
      );
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
    window.addEventListener("resize", () => {
      resizeCanvas();
      createParticles();
    });
  }

  function tick(time) {
    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;
    dustX += (targetX - dustX) * 0.02;
    dustY += (targetY - dustY) * 0.02;
    if (bgPhoto && !document.body.classList.contains("is-reading")) {
      bgPhoto.style.backgroundPosition = `${currentX}% ${currentY}%`;
    }
    drawParticles(time);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

// ===== Hotspots (flower / book), page transition, and book reveal/close =====
(() => {
  const bgPhoto = document.getElementById("bgPhoto");
  const flowerEl = document.getElementById("hotspotFlower");
  const bookEl = document.getElementById("hotspotBook");
  const book = document.querySelector(".book");
  const closeBtn = document.getElementById("bookClose");
  if (!bgPhoto || !flowerEl || !bookEl) return;

  // -- position the flower/book hotspot buttons over the background photo --

  // bounding box of each object as a fraction of the rendered photo (x/y = center, w/h = size)
  const HOTSPOTS = {
    flower: {
      desktop: { x: 0.325, y: 0.45, w: 0.11, h: 0.38 },
      mobile: { x: 0.285, y: 0.53, w: 0.23, h: 0.38 },
    },
    book: {
      desktop: { x: 0.53, y: 0.4, w: 0.32, h: 0.53 },
      mobile: { x: 0.58, y: 0.51, w: 0.46, h: 0.38 },
    },
  };

  let mobileImg = { w: 0, h: 0 };
  const preload = new Image();
  preload.onload = () => {
    mobileImg = { w: preload.naturalWidth, h: preload.naturalHeight };
  };
  preload.src = "./public/mobile-1.png";

  const isMobileLayout = () => window.matchMedia("(width < 748px)").matches;

  // mirrors the CSS background-size used for #bgPhoto at each breakpoint
  function getRenderedPhotoSize() {
    const cw = window.innerWidth;
    const ch = window.innerHeight;

    if (isMobileLayout()) {
      if (!mobileImg.w || !mobileImg.h) return null;
      const scale = Math.max(cw / mobileImg.w, ch / mobileImg.h);
      return { w: mobileImg.w * scale, h: mobileImg.h * scale };
    }

    return { w: cw * 1.1, h: ch * 1.1 };
  }

  function positionHotspots() {
    const size = getRenderedPhotoSize();
    if (!size) return;

    const cw = window.innerWidth;
    const ch = window.innerHeight;

    const [posXRaw, posYRaw] = bgPhoto.style.backgroundPosition.split(" ");
    const posX = parseFloat(posXRaw);
    const posY = parseFloat(posYRaw);
    const offsetX = (cw - size.w) * ((Number.isNaN(posX) ? 50 : posX) / 100);
    const offsetY = (ch - size.h) * ((Number.isNaN(posY) ? 50 : posY) / 100);

    const layout = isMobileLayout() ? "mobile" : "desktop";

    [
      [flowerEl, HOTSPOTS.flower[layout]],
      [bookEl, HOTSPOTS.book[layout]],
    ].forEach(([el, spot]) => {
      el.style.left = `${offsetX + spot.x * size.w}px`;
      el.style.top = `${offsetY + spot.y * size.h}px`;
      el.style.width = `${spot.w * size.w}px`;
      el.style.height = `${spot.h * size.h}px`;
    });
  }

  window.addEventListener("resize", positionHotspots);

  function loop() {
    positionHotspots();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // -- circle-wipe page transition, used when navigating to the flower page --

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const pageTransition = document.getElementById("pageTransition");

  // reset the overlay when the page is restored from bfcache (e.g. browser back button),
  // otherwise it stays stuck fully covering the screen since no script re-runs on restore
  window.addEventListener("pageshow", () => {
    if (!pageTransition) return;
    pageTransition.classList.remove("is-active");
    pageTransition.style.pointerEvents = "none";
  });

  function navigateWithTransition(url, originEl) {
    if (!pageTransition) {
      window.location.href = url;
      return;
    }

    const rect = originEl.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    // distance to the farthest viewport corner, so the circle fully covers the screen
    const farX = Math.max(originX, window.innerWidth - originX);
    const farY = Math.max(originY, window.innerHeight - originY);
    const radiusNeeded = Math.hypot(farX, farY);
    const scale = (radiusNeeded * 2) / 40;

    pageTransition.style.setProperty("--tx", `${originX}px`);
    pageTransition.style.setProperty("--ty", `${originY}px`);
    pageTransition.style.setProperty("--scale", String(scale));
    pageTransition.style.pointerEvents = "auto";

    requestAnimationFrame(() => {
      pageTransition.classList.add("is-active");
    });

    window.setTimeout(
      () => {
        window.location.href = url;
      },
      reduceMotion ? 0 : 2000,
    );
  }

  // -- click feedback: bloom particle + background pulse --

  let pulseTimer = null;
  function pulseBackground() {
    if (reduceMotion) return;
    bgPhoto.classList.add("bg-pulse");
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => bgPhoto.classList.remove("bg-pulse"), 650);
  }

  function spawnFx(el, variant) {
    if (reduceMotion) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const fx = document.createElement("div");
    fx.className = `hotspot-fx hotspot-fx--${variant}`;
    fx.style.left = `${rect.left + rect.width / 2}px`;
    fx.style.top = `${rect.top + rect.height / 2}px`;
    fx.style.width = `${size}px`;
    fx.style.height = `${size}px`;
    fx.addEventListener("animationend", () => fx.remove());
    document.body.appendChild(fx);
  }

  function handleFlowerClick() {
    spawnFx(flowerEl, "flower");
    pulseBackground();
    document.dispatchEvent(new CustomEvent("hotspot:flower"));
    navigateWithTransition("./Flower-animation/index.html", flowerEl);
  }

  // -- book hotspot: bg zoom/rotate, then reveal the book; close button/Escape reverses it --

  function pulseZoom() {
    if (reduceMotion) return;
    bgPhoto.classList.add("is-zoomed");
  }

  // -- "someone opened the book" email notification, sent once per visit --
  // Fill these in after setting up a free account at https://www.emailjs.com/
  const EMAILJS_PUBLIC_KEY = "lu7fhAvBUeknWgujp";
  const EMAILJS_SERVICE_ID = "service_u9ijdi4";
  const EMAILJS_TEMPLATE_ID = "template_a4c7dkf";

  if (
    typeof emailjs !== "undefined" &&
    EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY"
  ) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  let notified = false;
  function notifyBookOpened() {
    if (notified) return;
    notified = true;

    if (
      typeof emailjs === "undefined" ||
      EMAILJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY"
    )
      return;

    emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        from_name: "Story Telling Visitor",
        to_name: "Admin",
        message: `Buku dibuka di ${window.location.href}`,
        time: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
        page: window.location.href,
      })
      .then((res) => console.log("EmailJS Success:", res.status, res.text))
      .catch((err) => {
        console.error("EmailJS Error details:", err);
        if (err && err.text) console.error("Server response text:", err.text);
      });
  }

  let bookRevealed = false;
  function revealBook() {
    if (bookRevealed || !book) return;
    bookRevealed = true;
    book.classList.add("is-visible");
    document.body.classList.add("is-reading");
    notifyBookOpened();
  }

  function closeBook() {
    if (!bookRevealed) return;
    bookRevealed = false;
    if (book) book.classList.remove("is-visible");
    document.body.classList.remove("is-reading");
    bgPhoto.classList.remove("is-zoomed");
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeBook);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeBook();
  });

  function handleBookClick() {
    spawnFx(bookEl, "book");
    pulseBackground();

    if (reduceMotion) {
      revealBook();
    } else {
      pulseZoom();
      bgPhoto.addEventListener("transitionend", function onZoomEnd(event) {
        if (event.propertyName !== "transform") return;
        bgPhoto.removeEventListener("transitionend", onZoomEnd);
        revealBook();
      });
    }

    document.dispatchEvent(new CustomEvent("hotspot:book"));
  }

  flowerEl.addEventListener("click", handleFlowerClick);
  bookEl.addEventListener("click", handleBookClick);
})();
