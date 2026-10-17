document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = new Date().getFullYear();
});

const canvas = document.querySelector("#flower-canvas");
const drawingArea = document.querySelector("#drawing-area");
const clearButton = document.querySelector("#clear-garden");
const modeButtons = document.querySelectorAll("[data-garden-mode]");
const gardenInstruction = document.querySelector("#garden-instruction");

if (canvas && drawingArea) {
  const context = canvas.getContext("2d");
  const gardenItems = [];
  const palette = [
    [118, 28, 49],
    [231, 214, 184],
    [190, 143, 85],
    [156, 91, 102],
    [82, 111, 77],
    [70, 91, 117]
  ];
  const butterflyPalette = [
    [[118, 28, 49], [231, 214, 184]],
    [[57, 81, 105], [196, 155, 95]],
    [[83, 111, 77], [238, 212, 161]],
    [[151, 80, 96], [239, 220, 190]],
    [[190, 126, 56], [86, 54, 43]]
  ];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationFrame = 0;
  let activeMode = "flower";
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
    const color = palette[Math.floor(Math.random() * palette.length)];
    const flower = {
      type: "flower",
      x,
      y,
      size: randomBetween(24, 54),
      petals: Math.floor(randomBetween(5, 11)),
      stretch: randomBetween(0.72, 1.35),
      rotation: randomBetween(0, Math.PI * 2),
      color,
      center: Math.random() > 0.5 ? [196, 155, 95] : [61, 48, 37],
      born: performance.now() + delay,
      stem: randomBetween(45, 120),
      lean: randomBetween(-18, 18)
    };
    gardenItems.push(flower);
    if (gardenItems.length > 80) gardenItems.splice(0, gardenItems.length - 80);
    startAnimation();
  }

  function createButterfly(x, y, delay = 0) {
    const colors = butterflyPalette[Math.floor(Math.random() * butterflyPalette.length)];
    gardenItems.push({
      type: "butterfly",
      x,
      y,
      size: randomBetween(22, 42),
      rotation: randomBetween(-0.5, 0.5),
      stretch: randomBetween(0.82, 1.18),
      colors,
      born: performance.now() + delay
    });
    if (gardenItems.length > 80) gardenItems.splice(0, gardenItems.length - 80);
    startAnimation();
  }

  function petalPath(size, stretch) {
    context.beginPath();
    context.moveTo(0, 0);
    context.bezierCurveTo(
      size * 0.34,
      -size * 0.14,
      size * 0.42,
      -size * stretch,
      0,
      -size * stretch
    );
    context.bezierCurveTo(
      -size * 0.42,
      -size * stretch,
      -size * 0.34,
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
    context.strokeStyle = "rgba(54, 80, 52, 0.5)";
    context.lineWidth = Math.max(1.3, flower.size * 0.055);
    context.beginPath();
    context.moveTo(0, flower.size * 0.15);
    context.quadraticCurveTo(flower.lean, flower.stem * 0.55, flower.lean * 0.55, flower.stem);
    context.stroke();

    context.rotate(flower.rotation);
    context.scale(eased, eased);
    for (let petal = 0; petal < flower.petals; petal += 1) {
      context.save();
      context.rotate((Math.PI * 2 * petal) / flower.petals);
      context.fillStyle = `rgba(${r}, ${g}, ${b}, 0.82)`;
      context.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
      context.lineWidth = 1;
      petalPath(flower.size, flower.stretch);
      context.fill();
      context.stroke();
      context.restore();
    }

    const [cr, cg, cb] = flower.center;
    context.beginPath();
    context.arc(0, 0, flower.size * 0.22, 0, Math.PI * 2);
    context.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
    context.fill();
    context.restore();
  }

  function drawButterfly(butterfly, now) {
    const age = Math.max(0, now - butterfly.born);
    const progress = reducedMotion ? 1 : Math.min(age / 540, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const wingBeat = reducedMotion || progress === 1 ? 1 : 0.86 + Math.sin(age / 65) * 0.14;
    const [outer, inner] = butterfly.colors;

    context.save();
    context.translate(butterfly.x, butterfly.y);
    context.rotate(butterfly.rotation);
    context.scale(eased, eased);
    context.globalAlpha = 0.92 * eased;

    [-1, 1].forEach((side) => {
      context.save();
      context.scale(side * wingBeat, butterfly.stretch);

      context.beginPath();
      context.moveTo(0, 0);
      context.bezierCurveTo(
        butterfly.size * 0.22,
        -butterfly.size * 0.92,
        butterfly.size * 1.15,
        -butterfly.size * 0.84,
        butterfly.size * 0.92,
        -butterfly.size * 0.08
      );
      context.bezierCurveTo(
        butterfly.size * 0.77,
        butterfly.size * 0.36,
        butterfly.size * 0.26,
        butterfly.size * 0.46,
        0,
        butterfly.size * 0.12
      );
      context.closePath();
      context.fillStyle = `rgba(${outer[0]}, ${outer[1]}, ${outer[2]}, 0.86)`;
      context.strokeStyle = `rgba(${outer[0]}, ${outer[1]}, ${outer[2]}, 1)`;
      context.lineWidth = 1;
      context.fill();
      context.stroke();

      context.beginPath();
      context.ellipse(
        butterfly.size * 0.53,
        -butterfly.size * 0.25,
        butterfly.size * 0.18,
        butterfly.size * 0.28,
        -0.55,
        0,
        Math.PI * 2
      );
      context.fillStyle = `rgba(${inner[0]}, ${inner[1]}, ${inner[2]}, 0.9)`;
      context.fill();
      context.restore();
    });

    context.strokeStyle = "rgba(44, 37, 31, 0.82)";
    context.fillStyle = "rgba(44, 37, 31, 0.88)";
    context.lineWidth = 1.5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, -butterfly.size * 0.16);
    context.lineTo(0, butterfly.size * 0.65);
    context.stroke();
    context.beginPath();
    context.arc(0, -butterfly.size * 0.2, butterfly.size * 0.1, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(-1, -butterfly.size * 0.25);
    context.quadraticCurveTo(-butterfly.size * 0.18, -butterfly.size * 0.52, -butterfly.size * 0.34, -butterfly.size * 0.55);
    context.moveTo(1, -butterfly.size * 0.25);
    context.quadraticCurveTo(butterfly.size * 0.18, -butterfly.size * 0.52, butterfly.size * 0.34, -butterfly.size * 0.55);
    context.stroke();
    context.restore();
  }

  function draw(now = performance.now()) {
    context.clearRect(0, 0, width, height);
    gardenItems.forEach((item) => {
      if (item.type === "butterfly") drawButterfly(item, now);
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
    [[0.1, 0.25], [0.22, 0.78], [0.75, 0.82], [0.9, 0.35]].forEach(([x, y], index) => {
      createFlower(width * x, height * y, index * 60);
    });
    [[0.32, 0.25], [0.72, 0.2]].forEach(([x, y], index) => {
      createButterfly(width * x, height * y, 260 + index * 90);
    });
  }

  function addSelectedItem(x, y) {
    if (activeMode === "butterfly") createButterfly(x, y);
    else createFlower(x, y);
  }

  function setMode(mode) {
    activeMode = mode;
    modeButtons.forEach((button) => {
      const isActive = button.dataset.gardenMode === mode;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    if (gardenInstruction) {
      gardenInstruction.textContent = mode === "butterfly"
        ? "Tap anywhere to release a butterfly."
        : "Tap anywhere to grow a flower.";
    }
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
    draw();
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.gardenMode));
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  seedGarden();
}
