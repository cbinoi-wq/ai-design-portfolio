document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = new Date().getFullYear();
});

const canvas = document.querySelector("#flower-canvas");
const drawingArea = document.querySelector("#drawing-area");
const clearButton = document.querySelector("#clear-garden");

if (canvas && drawingArea) {
  const context = canvas.getContext("2d");
  const gardenItems = [];
  const palette = [
    [149, 51, 79],
    [226, 126, 149],
    [235, 190, 105],
    [157, 125, 177],
    [92, 142, 174],
    [224, 139, 107],
    [235, 218, 173]
  ];
  const beePalette = [
    [[199, 151, 65], [76, 62, 47]],
    [[216, 174, 90], [89, 69, 49]],
    [[187, 137, 56], [70, 61, 50]]
  ];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationFrame = 0;
  let tapCount = 0;
  let flowerSequence = 0;
  let beeSequence = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resizeCanvas() {
    const rect = drawingArea.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw();
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function createFlower(x, y, delay = 0) {
    flowerSequence += 1;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const kind = ["blossom", "daisy", "ruffled"][Math.floor(Math.random() * 3)];
    const petals = kind === "daisy"
      ? Math.floor(randomBetween(9, 14))
      : kind === "ruffled"
        ? Math.floor(randomBetween(7, 11))
        : Math.floor(randomBetween(5, 7));
    const flower = {
      type: "flower",
      x,
      y,
      size: randomBetween(22, 45),
      petals,
      kind,
      stretch: kind === "daisy" ? randomBetween(1.05, 1.35) : randomBetween(0.72, 1.02),
      widthFactor: kind === "daisy"
        ? randomBetween(0.2, 0.3)
        : kind === "ruffled"
          ? randomBetween(0.34, 0.46)
          : randomBetween(0.46, 0.6),
      rotation: randomBetween(0, Math.PI * 2),
      color,
      center: Math.random() > 0.35 ? [202, 154, 79] : [71, 50, 51],
      born: performance.now() + delay,
      stem: randomBetween(45, 120),
      lean: randomBetween(-18, 18),
      hasStem: flowerSequence % 3 !== 0,
      hasLeaf: flowerSequence % 3 !== 0 && flowerSequence % 2 === 0,
      leafSide: Math.random() > 0.5 ? 1 : -1,
      petalVariation: Array.from({ length: petals }, () => ({
        scale: randomBetween(0.86, 1.08),
        turn: randomBetween(-0.08, 0.08),
        wash: randomBetween(0.28, 0.44)
      }))
    };
    gardenItems.push(flower);
    if (gardenItems.length > 80) gardenItems.splice(0, gardenItems.length - 80);
    startAnimation();
  }

  function createBee(x, y, delay = 0, hasTrail = Math.random() < 0.35, preferredDirection = null) {
    beeSequence += 1;
    const colors = beePalette[Math.floor(Math.random() * beePalette.length)];
    gardenItems.push({
      type: "bee",
      x,
      y,
      size: randomBetween(8, 12),
      rotation: randomBetween(-0.48, 0.48),
      direction: preferredDirection ?? (beeSequence % 2 === 0 ? -1 : 1),
      colors,
      hasTrail,
      born: performance.now() + delay
    });
    if (gardenItems.length > 80) gardenItems.splice(0, gardenItems.length - 80);
    startAnimation();
  }

  function petalPath(size, stretch, widthFactor) {
    context.beginPath();
    context.moveTo(0, 0);
    context.bezierCurveTo(
      size * widthFactor,
      -size * 0.14,
      size * 0.42,
      -size * stretch,
      0,
      -size * stretch
    );
    context.bezierCurveTo(
      -size * widthFactor,
      -size * stretch,
      -size * widthFactor,
      -size * 0.14,
      0,
      0
    );
    context.closePath();
  }

  function drawFlower(flower, now) {
    const age = Math.max(0, now - flower.born);
    const progress = reducedMotion ? 1 : Math.min(age / 480, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const [r, g, b] = flower.color;

    context.save();
    context.translate(flower.x, flower.y);
    context.globalAlpha = 0.88 * eased;
    context.lineCap = "round";
    if (flower.hasStem) {
      context.strokeStyle = "rgba(54, 80, 52, 0.5)";
      context.lineWidth = Math.max(1.3, flower.size * 0.055);
      context.beginPath();
      context.moveTo(0, flower.size * 0.15);
      context.quadraticCurveTo(flower.lean, flower.stem * 0.55, flower.lean * 0.55, flower.stem);
      context.stroke();

      if (flower.hasLeaf) {
        const leafY = flower.stem * 0.58;
        const leafX = flower.lean * 0.34;
        context.save();
        context.translate(leafX, leafY);
        context.scale(flower.leafSide, 1);
        context.beginPath();
        context.moveTo(0, 0);
        context.bezierCurveTo(8, -12, 22, -11, 25, -4);
        context.bezierCurveTo(17, 2, 8, 5, 0, 0);
        context.fillStyle = "rgba(91, 119, 83, 0.27)";
        context.strokeStyle = "rgba(54, 80, 52, 0.32)";
        context.lineWidth = 0.8;
        context.fill();
        context.stroke();
        context.restore();
      }
    }

    context.rotate(flower.rotation);
    context.scale(eased, eased);
    for (let petal = 0; petal < flower.petals; petal += 1) {
      const variation = flower.petalVariation[petal];
      context.save();
      context.rotate((Math.PI * 2 * petal) / flower.petals + variation.turn);
      context.scale(variation.scale, variation.scale);
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${variation.wash})`;
      context.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.48)`;
      context.lineWidth = 0.75;
      petalPath(flower.size, flower.stretch, flower.widthFactor);
      context.fill();
      context.stroke();

      context.save();
      context.translate(flower.size * 0.025, -flower.size * 0.08);
      context.scale(0.86, 0.9);
      context.fillStyle = `rgba(${Math.min(r + 24, 255)}, ${Math.min(g + 24, 255)}, ${Math.min(b + 24, 255)}, 0.18)`;
      petalPath(flower.size, flower.stretch, flower.widthFactor);
      context.fill();
      context.restore();
      context.restore();
    }

    const [cr, cg, cb] = flower.center;
    context.beginPath();
    context.arc(0, 0, flower.size * (flower.kind === "daisy" ? 0.18 : 0.22), 0, Math.PI * 2);
    context.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.78)`;
    context.fill();

    for (let dot = 0; dot < 8; dot += 1) {
      const angle = (Math.PI * 2 * dot) / 8;
      context.beginPath();
      context.arc(
        Math.cos(angle) * flower.size * 0.12,
        Math.sin(angle) * flower.size * 0.12,
        Math.max(0.7, flower.size * 0.022),
        0,
        Math.PI * 2
      );
      context.fillStyle = `rgba(255, 235, 188, 0.62)`;
      context.fill();
    }
    context.restore();
  }

  function drawBee(bee, now) {
    const age = Math.max(0, now - bee.born);
    const progress = reducedMotion ? 1 : Math.min(age / 520, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const wingBeat = reducedMotion || progress === 1 ? 1 : 0.86 + Math.sin(age / 42) * 0.14;
    const [gold, dark] = bee.colors;

    context.save();
    context.translate(bee.x, bee.y);
    context.rotate(bee.rotation);
    context.scale(bee.direction, 1);
    context.scale(eased, eased);
    context.globalAlpha = 0.68 * eased;

    if (bee.hasTrail) {
      context.save();
      context.globalAlpha = 0.24 * eased;
      context.strokeStyle = `rgba(${dark[0]}, ${dark[1]}, ${dark[2]}, 0.62)`;
      context.lineWidth = 1;
      context.lineCap = "round";
      context.setLineDash([1.5, 6]);
      context.beginPath();
      context.moveTo(-bee.size * 3.8, bee.size * 0.12);
      context.bezierCurveTo(
        -bee.size * 3,
        bee.size * 1.2,
        -bee.size * 2,
        -bee.size,
        -bee.size * 0.72,
        bee.size * 0.04
      );
      context.stroke();
      context.restore();
    }

    context.save();
    context.scale(1, wingBeat);
    context.fillStyle = "rgba(250, 248, 239, 0.82)";
    context.strokeStyle = "rgba(85, 72, 60, 0.36)";
    context.lineWidth = 0.7;
    context.beginPath();
    context.ellipse(-bee.size * 0.05, -bee.size * 0.47, bee.size * 0.31, bee.size * 0.46, -0.35, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.ellipse(bee.size * 0.27, -bee.size * 0.43, bee.size * 0.29, bee.size * 0.4, 0.35, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();

    context.save();
    context.beginPath();
    context.ellipse(0, 0, bee.size * 0.68, bee.size * 0.45, 0, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = `rgb(${gold[0]}, ${gold[1]}, ${gold[2]})`;
    context.fillRect(-bee.size, -bee.size, bee.size * 2, bee.size * 2);
    context.fillStyle = `rgb(${dark[0]}, ${dark[1]}, ${dark[2]})`;
    context.fillRect(bee.size * 0.03, -bee.size * 0.55, bee.size * 0.14, bee.size * 1.1);
    context.fillRect(bee.size * 0.38, -bee.size * 0.55, bee.size * 0.42, bee.size * 1.1);
    context.restore();

    context.beginPath();
    context.ellipse(0, 0, bee.size * 0.68, bee.size * 0.45, 0, 0, Math.PI * 2);
    context.strokeStyle = `rgba(${dark[0]}, ${dark[1]}, ${dark[2]}, 0.76)`;
    context.lineWidth = 0.8;
    context.stroke();

    context.fillStyle = `rgb(${dark[0]}, ${dark[1]}, ${dark[2]})`;
    context.beginPath();
    context.arc(-bee.size * 0.43, -bee.size * 0.11, bee.size * 0.065, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = `rgba(${dark[0]}, ${dark[1]}, ${dark[2]}, 0.82)`;
    context.lineWidth = 0.75;
    context.beginPath();
    context.arc(-bee.size * 0.4, bee.size * 0.04, bee.size * 0.17, 0.18, 1.22);
    context.stroke();

    context.beginPath();
    context.moveTo(-bee.size * 0.55, -bee.size * 0.28);
    context.quadraticCurveTo(-bee.size * 0.72, -bee.size * 0.62, -bee.size * 0.95, -bee.size * 0.5);
    context.moveTo(-bee.size * 0.42, -bee.size * 0.34);
    context.quadraticCurveTo(-bee.size * 0.48, -bee.size * 0.7, -bee.size * 0.68, -bee.size * 0.72);
    context.stroke();
    context.restore();
  }

  function drawButterfly(butterfly, now) {
    const age = Math.max(0, now - butterfly.born);
    const progress = reducedMotion ? 1 : Math.min(age / 560, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const flutter = reducedMotion || progress === 1 ? 1 : 0.9 + Math.sin(age / 48) * 0.1;
    const [primary, secondary, ink] = butterfly.colors;

    context.save();
    context.translate(butterfly.x, butterfly.y);
    context.rotate(butterfly.rotation);
    context.scale(butterfly.direction, 1);
    context.scale(eased, eased);
    context.globalAlpha = 0.72 * eased;

    if (butterfly.hasTrail) {
      context.save();
      context.globalAlpha = 0.25 * eased;
      context.strokeStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, 0.68)`;
      context.lineWidth = 1;
      context.lineCap = "round";
      context.setLineDash([1.5, 6]);
      context.beginPath();
      context.moveTo(-butterfly.size * 4.2, butterfly.size * 0.25);
      context.bezierCurveTo(
        -butterfly.size * 3.4,
        butterfly.size * 1.25,
        -butterfly.size * 2.1,
        -butterfly.size * 1.05,
        -butterfly.size * 0.9,
        butterfly.size * 0.08
      );
      context.stroke();
      context.restore();
    }

    if (butterfly.hasSparkles) {
      [[1.55, -0.78, 0.2], [1.95, -0.25, 0.12]].forEach(([x, y, scale]) => {
        const sparkleX = butterfly.size * x;
        const sparkleY = butterfly.size * y;
        const sparkleSize = butterfly.size * scale;
        context.beginPath();
        context.moveTo(sparkleX, sparkleY - sparkleSize);
        context.quadraticCurveTo(sparkleX, sparkleY, sparkleX + sparkleSize, sparkleY);
        context.quadraticCurveTo(sparkleX, sparkleY, sparkleX, sparkleY + sparkleSize);
        context.quadraticCurveTo(sparkleX, sparkleY, sparkleX - sparkleSize, sparkleY);
        context.quadraticCurveTo(sparkleX, sparkleY, sparkleX, sparkleY - sparkleSize);
        context.fillStyle = "rgba(196, 153, 74, 0.55)";
        context.fill();
      });
    }

    context.save();
    context.scale(flutter, 1);
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.moveTo(side * butterfly.size * 0.08, -butterfly.size * 0.08);
      context.bezierCurveTo(
        side * butterfly.size * 0.42,
        -butterfly.size * 0.8,
        side * butterfly.size * 1.14,
        -butterfly.size * 1.05,
        side * butterfly.size * 1.02,
        -butterfly.size * 0.22
      );
      context.bezierCurveTo(
        side * butterfly.size * 0.92,
        butterfly.size * 0.08,
        side * butterfly.size * 0.38,
        butterfly.size * 0.18,
        side * butterfly.size * 0.08,
        butterfly.size * 0.12
      );
      context.fillStyle = `rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, 0.48)`;
      context.strokeStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, 0.58)`;
      context.lineWidth = 0.85;
      context.fill();
      context.stroke();

      context.beginPath();
      context.moveTo(side * butterfly.size * 0.08, butterfly.size * 0.05);
      context.bezierCurveTo(
        side * butterfly.size * 0.68,
        butterfly.size * 0.02,
        side * butterfly.size * 0.88,
        butterfly.size * 0.62,
        side * butterfly.size * 0.45,
        butterfly.size * 0.78
      );
      context.bezierCurveTo(
        side * butterfly.size * 0.16,
        butterfly.size * 0.7,
        side * butterfly.size * 0.1,
        butterfly.size * 0.3,
        side * butterfly.size * 0.08,
        butterfly.size * 0.05
      );
      context.fillStyle = `rgba(${secondary[0]}, ${secondary[1]}, ${secondary[2]}, 0.44)`;
      context.fill();
      context.stroke();

      context.beginPath();
      context.moveTo(side * butterfly.size * 0.16, -butterfly.size * 0.04);
      context.quadraticCurveTo(
        side * butterfly.size * 0.52,
        -butterfly.size * 0.34,
        side * butterfly.size * 0.83,
        -butterfly.size * 0.52
      );
      context.strokeStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, 0.28)`;
      context.lineWidth = 0.65;
      context.stroke();

      for (let spot = 0; spot < 3; spot += 1) {
        context.beginPath();
        context.arc(
          side * butterfly.size * (0.47 + spot * 0.13),
          -butterfly.size * (0.28 + spot * 0.1),
          butterfly.size * (0.035 + spot * 0.008),
          0,
          Math.PI * 2
        );
        context.fillStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, 0.32)`;
        context.fill();
      }
    });
    context.restore();

    context.beginPath();
    context.ellipse(0, 0, butterfly.size * 0.11, butterfly.size * 0.55, 0, 0, Math.PI * 2);
    context.fillStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, 0.88)`;
    context.fill();
    context.beginPath();
    context.arc(0, -butterfly.size * 0.55, butterfly.size * 0.13, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, 0.72)`;
    context.lineWidth = 0.75;
    context.beginPath();
    context.moveTo(-butterfly.size * 0.04, -butterfly.size * 0.64);
    context.quadraticCurveTo(-butterfly.size * 0.18, -butterfly.size * 0.9, -butterfly.size * 0.34, -butterfly.size * 0.92);
    context.moveTo(butterfly.size * 0.04, -butterfly.size * 0.64);
    context.quadraticCurveTo(butterfly.size * 0.18, -butterfly.size * 0.9, butterfly.size * 0.34, -butterfly.size * 0.92);
    context.stroke();
    context.restore();
  }

  function draw(now = performance.now()) {
    context.clearRect(0, 0, width, height);
    gardenItems.forEach((item) => {
      if (item.type === "bee") drawBee(item, now);
      else drawFlower(item, now);
    });
    const growing = gardenItems.some((item) => now - item.born < 650);
    if (growing && !reducedMotion) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      animationFrame = 0;
    }
  }

  function startAnimation() {
    if (!animationFrame) animationFrame = requestAnimationFrame(draw);
  }

  function seedGarden() {
    const isPhone = width <= 620;
    const flowerPositions = isPhone
      ? [[0.16, 0.67], [0.78, 0.7], [0.24, 0.84], [0.74, 0.88]]
      : [[0.1, 0.25], [0.22, 0.78], [0.75, 0.82], [0.9, 0.35]];
    flowerPositions.forEach(([x, y], index) => {
      createFlower(width * x, height * y, index * 60);
    });
    createBee(width * (isPhone ? 0.18 : 0.31), height * (isPhone ? 0.76 : 0.24), 260, true, 1);
    createBee(width * (isPhone ? 0.82 : 0.88), height * (isPhone ? 0.8 : 0.58), 360, false, -1);
  }

  function addSelectedItem(x, y) {
    tapCount += 1;
    if (tapCount % 4 === 0) createBee(x, y);
    else createFlower(x, y);
  }

  drawingArea.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a, button")) return;
    const rect = drawingArea.getBoundingClientRect();
    addSelectedItem(event.clientX - rect.left, event.clientY - rect.top);
  });

  drawingArea.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    addSelectedItem(randomBetween(width * 0.2, width * 0.8), randomBetween(height * 0.2, height * 0.76));
  });

  clearButton?.addEventListener("click", () => {
    gardenItems.length = 0;
    tapCount = 0;
    flowerSequence = 0;
    beeSequence = 0;
    draw();
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  seedGarden();
}
