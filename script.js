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
    [118, 28, 49],
    [231, 214, 184],
    [190, 143, 85],
    [156, 91, 102],
    [82, 111, 77],
    [70, 91, 117]
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

  function createBee(x, y, delay = 0, hasTrail = Math.random() < 0.35) {
    const colors = beePalette[Math.floor(Math.random() * beePalette.length)];
    gardenItems.push({
      type: "bee",
      x,
      y,
      size: randomBetween(8, 12),
      rotation: randomBetween(-0.4, 0.4),
      direction: Math.random() > 0.5 ? 1 : -1,
      colors,
      hasTrail,
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
    [[0.1, 0.25], [0.22, 0.78], [0.75, 0.82], [0.9, 0.35]].forEach(([x, y], index) => {
      createFlower(width * x, height * y, index * 60);
    });
    createBee(width * 0.31, height * 0.24, 260, true);
    createBee(width * 0.88, height * 0.58, 360, false);
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
    draw();
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  seedGarden();
}
