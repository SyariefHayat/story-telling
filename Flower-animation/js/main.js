window.addEventListener("load", () => {
    document.body.classList.remove("container");
});

document.addEventListener("touchmove", (e) => {
    e.preventDefault();
}, { passive: false });

window.addEventListener("load", () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const garden = document.querySelector(".rain-garden");
    if (!garden) return;

    const rain = [];
    const fragments = [];
    const largeBlooms = [];
    const flowerPalette = [
        ["#ff8fb8", "#ffe07a"],
        ["#b59cff", "#f7d9ff"],
        ["#ffb45e", "#fff0a6"],
        ["#75c9ff", "#e8fbff"],
        ["#ff6f83", "#ffe4a7"]
    ];
    const collisionSelector = [
        ".flower__leaf", ".flower__white-circle", ".flower__line",
        ".flower__line__leaf", ".tulip__petal", ".flower__grass",
        ".flower__grass__leaf", ".flower__g-long", ".flower__g-right",
        ".flower__g-front", ".flower__g-fr", ".long-g", ".leaf",
        ".rain-big-bloom__head", ".rain-big-bloom__root"
    ].join(",");
    let targets = [];
    let lastTargetRead = 0;
    let lastSpawn = 0;
    let lastFrame = performance.now();
    const rainStartDelay = 7000;
    // Mobile CPUs/GPUs choke on the same drop count and collision-check
    // frequency that desktop handles fine, so this trims both for phones.
    const isMobile = window.innerWidth <= 700;
    const maxRaindrops = isMobile ? 10 : 22;
    const rainSpawnInterval = isMobile ? 260 : 170;
    const targetRefreshInterval = isMobile ? 320 : 140;
    const fragmentsPerSplit = isMobile ? 2 : 3;
    const largeFlowerSlots = new Set();
    // Three "core" spots fill in reliably at the usual odds; a handful of
    // extra spots further out only sprout very rarely, so seeing a big
    // cluster of large flowers at once is an occasional treat, not the norm.
    const LARGE_FLOWER_SLOTS = [
        { position: 0.34, chance: 0.18 },
        { position: 0.5, chance: 0.18 },
        { position: 0.66, chance: 0.18 },
        { position: 0.1, chance: 0.015 },
        { position: 0.22, chance: 0.015 },
        { position: 0.78, chance: 0.015 },
        { position: 0.9, chance: 0.015 }
    ];
    // A big bloom sprouts slightly small (matches the "to" scale in the
    // rain-big-grow keyframe) and reaches full size/openness after a
    // couple of waterings. Uses a uniform scale (not scaleY) so the round
    // bud stays round instead of squashing into an oval while it grows.
    const GROWTH_START = 0.7;
    const GROWTH_PER_HIT = 0.15;
    const GROWTH_OPEN_THRESHOLD = 0.95;

    function refreshTargets(now) {
        if (now - lastTargetRead < targetRefreshInterval) return;
        lastTargetRead = now;
        targets = [...document.querySelectorAll(collisionSelector)]
            .map((element) => ({ element, rect: element.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 1 && rect.height > 1);
    }

    function makeDrop() {
        const element = document.createElement("i");
        element.className = "rain-drop";
        garden.append(element);
        rain.push({
            element,
            x: Math.random() * window.innerWidth,
            y: -24,
            speed: 260 + Math.random() * 170
        });
    }

    function splash(x, y) {
        const element = document.createElement("i");
        element.className = "rain-splash";
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        garden.append(element);
        window.setTimeout(() => element.remove(), 540);
    }

    function ripple(x, y) {
        const element = document.createElement("i");
        element.className = "rain-ripple";
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        garden.append(element);
        window.setTimeout(() => element.remove(), 720);
    }

    function groundImpact(x) {
        splash(x, window.innerHeight - 8);
        ripple(x, window.innerHeight);
        seedAtGround(x);
    }

    const activeBlooms = [];

    function witherBloom(element) {
        if (element.classList.contains("is-withering")) return;
        element.classList.add("is-withering");
        const index = activeBlooms.indexOf(element);
        if (index !== -1) activeBlooms.splice(index, 1);
        window.setTimeout(() => element.remove(), 900);
    }

    function growFlower(x) {
        const element = document.createElement("i");
        const [color, center] = flowerPalette[Math.floor(Math.random() * flowerPalette.length)];
        const variants = ["daisy", "star"];
        const variant = variants[Math.floor(Math.random() * variants.length)];
        const size = 1.25 + Math.random() * 0.55;
        // On phones the small blooms read as too tiny at the same vmin sizing
        // as desktop, so bump them up overall and give height an extra nudge.
        const isMobile = window.innerWidth <= 700;
        const mobileScale = isMobile ? 1.5 : 1;
        const mobileHeightBoost = isMobile ? 1.2 : 1;
        element.className = `rain-bloom rain-bloom--${variant}`;
        element.style.left = `${Math.max(8, Math.min(window.innerWidth - 16, x))}px`;
        element.style.setProperty("--bloom-width", `${(1.5 * size * mobileScale).toFixed(2)}vmin`);
        element.style.setProperty("--bloom-height", `${(5 * size * mobileScale * mobileHeightBoost).toFixed(2)}vmin`);
        element.style.setProperty("--bloom-scale", (size * mobileScale).toFixed(2));
        element.style.setProperty("--bloom-color", color);
        element.style.setProperty("--bloom-center", center);
        element.innerHTML = '<i class="rain-bloom__stem"></i><i class="rain-bloom__head"></i>';
        garden.append(element);
        activeBlooms.push(element);
        if (activeBlooms.length > 240) witherBloom(activeBlooms[0]);
        window.setTimeout(() => witherBloom(element), 600000);
    }

    function seedLargeFlower(x) {
        const nearestSlot = LARGE_FLOWER_SLOTS
            .map((slot, index) => ({ ...slot, index, distance: Math.abs(slot.position * window.innerWidth - x) }))
            .sort((a, b) => a.distance - b.distance)
            .find((slot) => !largeFlowerSlots.has(slot.index));
        if (!nearestSlot || Math.random() > nearestSlot.chance) return;

        const element = document.createElement("i");
        const [color, center] = flowerPalette[Math.floor(Math.random() * flowerPalette.length)];
        element.className = "rain-big-bloom";
        const size = nearestSlot.position === 0.5 ? 1 : 0.78;
        element.style.left = `${nearestSlot.position * 100}vw`;
        element.style.transform = "translateX(-50%)";
        element.style.width = `${(18 * size).toFixed(2)}vmin`;
        element.style.height = `${(43 * size).toFixed(2)}vmin`;
        element.style.setProperty("--big-scale", size.toFixed(2));
        element.style.setProperty("--bloom-color", color);
        element.style.setProperty("--bloom-center", center);
        element.innerHTML = '<i class="rain-big-bloom__root"></i><i class="rain-big-bloom__stem"></i><i class="rain-big-bloom__head"><i class="rain-big-bloom__petal"></i><i class="rain-big-bloom__petal"></i><i class="rain-big-bloom__petal"></i><i class="rain-big-bloom__petal"></i><i class="rain-big-bloom__petal"></i><i class="rain-big-bloom__petal"></i><i class="rain-big-bloom__center"></i></i>';
        garden.append(element);
        largeFlowerSlots.add(nearestSlot.index);
        const swayEntry = {
            element,
            phase: Math.random() * Math.PI * 2,
            growth: GROWTH_START,
            displayGrowth: GROWTH_START
        };
        largeBlooms.push(swayEntry);
        window.setTimeout(() => {
            largeFlowerSlots.delete(nearestSlot.index);
            largeBlooms.splice(largeBlooms.indexOf(swayEntry), 1);
            element.remove();
        }, 600000);
    }

    function waterLargeFlower(element) {
        const bloom = element.closest(".rain-big-bloom");
        if (!bloom) return;

        const hits = Number(bloom.dataset.waterHits || 0) + 1;
        bloom.dataset.waterHits = hits;
        const growth = Math.min(1, GROWTH_START + hits * GROWTH_PER_HIT);
        const swayEntry = largeBlooms.find((entry) => entry.element === bloom);
        if (swayEntry) swayEntry.growth = growth;

        if (growth >= GROWTH_OPEN_THRESHOLD) {
            bloom.classList.add("is-opening");
        }
    }

    function waterNearbyLargeFlowers(x) {
        const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
        const reach = 10 * vmin;
        garden.querySelectorAll(".rain-big-bloom").forEach((bloom) => {
            const rect = bloom.getBoundingClientRect();
            if (x >= rect.left - reach && x <= rect.right + reach) {
                waterLargeFlower(bloom);
            }
        });
    }

    function seedAtGround(x) {
        growFlower(x);
        seedLargeFlower(x);
        waterNearbyLargeFlowers(x);
    }

    function createFragment(x, y, vx, vy) {
        const element = document.createElement("i");
        element.className = "rain-fragment";
        garden.append(element);
        return {
            element,
            x,
            y,
            vx,
            vy,
        };
    }

    function split(drop) {
        splash(drop.x, drop.y);
        for (let index = 0; index < fragmentsPerSplit; index += 1) {
            fragments.push(createFragment(
                drop.x,
                drop.y,
                (Math.random() - 0.5) * 170,
                -80 - Math.random() * 115
            ));
        }
        drop.element.remove();
    }

    function targetAt(x, y) {
        let fallback = null;
        for (let index = 0; index < targets.length; index += 1) {
            const target = targets[index];
            const { rect } = target;
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
            if (target.element.classList.contains("rain-big-bloom__head")) return target;
            if (!fallback) fallback = target;
        }
        return fallback;
    }

    function frame(now) {
        const delta = Math.min(34, now - lastFrame) / 1000;
        lastFrame = now;
        refreshTargets(now);

        if (now - lastSpawn > rainSpawnInterval && rain.length < maxRaindrops) {
            makeDrop();
            lastSpawn = now;
        }

        for (let index = rain.length - 1; index >= 0; index -= 1) {
            const drop = rain[index];
            drop.y += drop.speed * delta;
            drop.element.style.transform = `translate3d(${drop.x}px, ${drop.y}px, 0)`;
            const target = targetAt(drop.x, drop.y + 12);
            if (target) {
                waterLargeFlower(target.element);
                split(drop);
                rain.splice(index, 1);
            } else if (drop.y > window.innerHeight) {
                groundImpact(drop.x);
                drop.element.remove();
                rain.splice(index, 1);
            }
        }

        for (let index = fragments.length - 1; index >= 0; index -= 1) {
            const fragment = fragments[index];
            fragment.vy += 430 * delta;
            fragment.x += fragment.vx * delta;
            fragment.y += fragment.vy * delta;
            fragment.element.style.transform = `translate3d(${fragment.x}px, ${fragment.y}px, 0)`;
            if (fragment.y >= window.innerHeight - 14) {
                // Splash fragments still grow a flower (rain hitting an
                // object should count same as rain hitting the ground) but
                // skip the heavier ripple/seedLargeFlower/waterNearby part
                // of groundImpact — that cascade per fragment was what made
                // hitting objects feel laggy, growFlower alone is cheap.
                splash(fragment.x, window.innerHeight - 8);
                growFlower(fragment.x);
                fragment.element.remove();
                fragments.splice(index, 1);
            }
        }

        const nowSeconds = now / 1000;
        largeBlooms.forEach((entry) => {
            entry.displayGrowth += (entry.growth - entry.displayGrowth) * Math.min(1, delta * 3);
            const idle = Math.sin(nowSeconds * 0.5 + entry.phase) * 1.6;
            entry.element.style.transform =
                `translateX(-50%) rotate(${idle.toFixed(2)}deg) scale(${entry.displayGrowth.toFixed(3)})`;
        });

        requestAnimationFrame(frame);
    }

    // Wait for the staged flowers, grass, and leaves to finish growing.
    window.setTimeout(() => {
        lastFrame = performance.now();
        requestAnimationFrame(frame);
    }, rainStartDelay);
});
