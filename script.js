document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = new Date().getFullYear();
});

const canvas = document.querySelector("#flower-canvas");
const drawingArea = document.querySelector("#drawing-area");
const clearButton = document.querySelector("#clear-garden");

if (canvas && drawingArea) {
  const context = canvas.getContext("2d");
  const flowers = [];
  const palette = [
    [118, 28, 49],
    [231, 214, 184],
    [190, 143, 85],
    [156, 91, 102],
    [82, 111, 77],
    [70, 91, 117]
  ];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationFrame = 0;
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
    flowers.push(flower);
    if (flowers.length > 70) flowers.splice(0, flowers.length - 70);
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

  function draw(now = performance.now()) {
    context.clearRect(0, 0, width, height);
    flowers.forEach((flower) => drawFlower(flower, now));
    const growing = flowers.some((flower) => now - flower.born < 520);
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
    const positions = [
      [0.08, 0.22], [0.17, 0.78], [0.29, 0.12], [0.73, 0.16],
      [0.84, 0.72], [0.94, 0.34], [0.63, 0.89], [0.4, 0.88]
    ];
    positions.forEach(([x, y], index) => createFlower(width * x, height * y, index * 55));
  }

  drawingArea.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a, button")) return;
    const rect = drawingArea.getBoundingClientRect();
    createFlower(event.clientX - rect.left, event.clientY - rect.top);
  });

  clearButton?.addEventListener("click", () => {
    flowers.length = 0;
    draw();
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  seedGarden();
}
