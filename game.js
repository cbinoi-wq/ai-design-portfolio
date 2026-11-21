(() => {
  const canvas = document.querySelector('#game-canvas');
  const wrap = document.querySelector('#canvas-wrap');
  if (!canvas || !wrap) return;

  const context = canvas.getContext('2d');
  const overlay = document.querySelector('#game-overlay');
  const overlayStep = document.querySelector('#overlay-step');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const overlayButton = document.querySelector('#overlay-button');
  const overlayLink = document.querySelector('#overlay-link');
  const instructionGrid = document.querySelector('#instruction-grid');
  const message = document.querySelector('#game-message');
  const stageNumber = document.querySelector('#stage-number');
  const stageName = document.querySelector('#stage-name');
  const noiseFill = document.querySelector('#noise-fill');
  const noiseValue = document.querySelector('#noise-value');
  const clearedCount = document.querySelector('#cleared-count');
  const clearedGoal = document.querySelector('#cleared-goal');
  const growthPips = document.querySelector('#growth-pips');
  const soundToggle = document.querySelector('#sound-toggle');
  const restartButton = document.querySelector('#restart-game');

  const gameBoardImage = new Image();
  gameBoardImage.src = 'assets/swallow-static-game-board.png?v=1';
  const creatureImage = new Image();
  creatureImage.src = 'assets/swallow-static-creature.png?v=1';

  const WORLD = { width: 960, height: 620 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INTRO_STEP = 'FINAL GAME · WEEK 03';
  const stages = [
    {
      name: 'Release',
      goal: 7,
      echoes: 3,
      message: 'Three fake thoughts are already hiding here. They look swallowable—until you touch them.',
      colors: ['#c8d8d4', '#e8d2cb'],
      intro: 'Start with what feels manageable.',
      copy: 'The dreamer begins tiny. Swallow real thoughts to grow, but three identical-looking copies are already hiding in this first stage.'
    },
    {
      name: 'Doubt',
      goal: 8,
      echoes: 5,
      message: 'The copies are getting restless. Trust what the city does, not only what you see.',
      colors: ['#c8c7d9', '#b8d8d3'],
      intro: 'The city begins to copy itself.',
      copy: 'The city now lies more often. False thoughts may briefly slip out of alignment, but only touching one reveals the truth.'
    },
    {
      name: 'Remember',
      goal: 6,
      echoes: 6,
      memory: true,
      message: 'Clear the static, but leave the glowing memory.',
      colors: ['#c9cedb', '#ead3c8'],
      intro: 'Not everything should disappear.',
      copy: 'Clear the final solid thoughts. The glowing memory cannot be swallowed. When the city is quiet, return to it.'
    }
  ];

  let cssWidth = 0;
  let cssHeight = 0;
  let pixelRatio = 1;
  let playing = false;
  let stageIndex = 0;
  let cleared = 0;
  let noise = 100;
  let objects = [];
  let particles = [];
  let ripples = [];
  let keys = new Set();
  let pointerActive = false;
  let pointerTarget = null;
  let lastTime = performance.now();
  let elapsed = 0;
  let audioEnabled = true;
  let audioContext = null;
  let completionReady = false;
  let bumpCooldown = 0;
  let objectId = 0;
  let animationFrame = 0;
  let combo = 0;
  let comboTimer = 0;
  let comboFlash = 0;
  let trailTimer = 0;
  let totalSwallowed = 0;
  let growthLevel = 0;
  let growthPulse = 0;

  const BASE_PLAYER_RADIUS = 26;
  const MAX_PLAYER_RADIUS = 54;

  const player = {
    x: WORLD.width * .5,
    y: WORLD.height * .57,
    radius: BASE_PLAYER_RADIUS,
    targetRadius: BASE_PLAYER_RADIUS,
    vx: 0,
    vy: 0,
    chomp: 0,
    blink: 0,
    facing: 1
  };

  const objectKinds = ['note', 'cup', 'phone', 'clock', 'book', 'lamp'];

  function growthRadius() {
    return Math.min(MAX_PLAYER_RADIUS, BASE_PLAYER_RADIUS + growthLevel * ((MAX_PLAYER_RADIUS - BASE_PLAYER_RADIUS) / 5));
  }

  function resetGrowth() {
    totalSwallowed = 0;
    growthLevel = 0;
    growthPulse = 0;
    player.radius = BASE_PLAYER_RADIUS;
    player.targetRadius = BASE_PLAYER_RADIUS;
  }

  function resizeCanvas() {
    const rect = wrap.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    const previousWorldWidth = WORLD.width;
    const nextWorldWidth = Math.max(460, Math.min(960, WORLD.height * (cssWidth / cssHeight)));
    if (Math.abs(nextWorldWidth - previousWorldWidth) > 1) {
      const horizontalScale = nextWorldWidth / previousWorldWidth;
      player.x *= horizontalScale;
      objects.forEach((object) => { object.x *= horizontalScale; });
      if (pointerTarget) pointerTarget.x *= horizontalScale;
      WORLD.width = nextWorldWidth;
      player.x = Math.max(player.radius + 9, Math.min(WORLD.width - player.radius - 9, player.x));
    }
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function findOpenPosition(radius = 24, includeMemory = true) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = {
        x: random(85, WORLD.width - 85),
        y: random(80, WORLD.height - 80)
      };
      if (distance(candidate, player) < 145) continue;
      if (objects.some((object) => (!includeMemory && object.kind === 'memory') || distance(candidate, object) < radius + object.radius + 34)) continue;
      return candidate;
    }
    return { x: random(90, WORLD.width - 90), y: random(90, WORLD.height - 90) };
  }

  function makeObject(type = 'solid', forcedKind = null) {
    const kind = forcedKind || objectKinds[Math.floor(Math.random() * objectKinds.length)];
    const radius = type === 'memory' ? 27 : random(15, 23);
    const position = findOpenPosition(radius);
    return {
      id: objectId += 1,
      type,
      kind,
      radius,
      x: position.x,
      y: position.y,
      rotation: random(-.35, .35),
      phase: random(0, Math.PI * 2),
      scale: 1,
      removing: false,
      revealed: false,
      glitch: 0
    };
  }

  function buildStage(index) {
    const stage = stages[index];
    stageIndex = index;
    cleared = 0;
    noise = 100;
    completionReady = false;
    combo = 0;
    comboTimer = 0;
    comboFlash = 0;
    trailTimer = 0;
    objects = [];
    particles = [];
    ripples = [];
    player.x = WORLD.width * .5;
    player.y = WORLD.height * .57;
    player.radius = growthRadius();
    player.targetRadius = player.radius;
    player.vx = 0;
    player.vy = 0;
    pointerTarget = null;

    for (let index = 0; index < stage.goal; index += 1) objects.push(makeObject('solid'));
    for (let index = 0; index < stage.echoes; index += 1) objects.push(makeObject('echo'));
    if (stage.memory) {
      const memory = makeObject('memory', 'memory');
      memory.x = WORLD.width * .82;
      memory.y = WORLD.height * .22;
      objects.push(memory);
    }
    updateHud();
    message.textContent = stage.message;
  }

  function updateHud() {
    const stage = stages[stageIndex];
    stageNumber.textContent = `STAGE 0${stageIndex + 1}`;
    stageName.textContent = stage.name;
    clearedCount.textContent = String(cleared);
    clearedGoal.textContent = String(stage.goal);
    noiseValue.textContent = `${Math.round(noise)}%`;
    noiseFill.style.width = `${noise}%`;
    if (growthPips) {
      growthPips.querySelectorAll('i').forEach((pip, index) => pip.classList.toggle('is-on', index < growthLevel));
      growthPips.parentElement?.setAttribute('aria-label', `Creature growth, ${growthLevel} of 5`);
    }
  }

  function showOverlay(step, title, copy, buttonText, action, final = false) {
    overlayStep.textContent = step;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    overlayButton.textContent = buttonText;
    overlayButton.onclick = action;
    instructionGrid.hidden = step !== INTRO_STEP;
    overlayLink.hidden = !final && step !== INTRO_STEP;
    overlayLink.textContent = final ? 'Read the original proposal' : 'Read the original proposal';
    overlay.classList.add('is-visible');
    playing = false;
  }

  function hideOverlay() {
    overlay.classList.remove('is-visible');
    playing = true;
    lastTime = performance.now();
    ensureAudio();
  }

  function beginGame() {
    resetGrowth();
    buildStage(0);
    hideOverlay();
  }

  function showStageIntro(nextIndex) {
    const nextStage = stages[nextIndex];
    showOverlay(
      `STAGE 0${nextIndex + 1} · ${nextStage.name.toUpperCase()}`,
      nextStage.intro,
      nextStage.copy,
      `Enter stage 0${nextIndex + 1}`,
      () => {
        buildStage(nextIndex);
        hideOverlay();
      }
    );
  }

  function finishGame() {
    playFinishSound();
    showOverlay(
      'THE DREAM IS QUIET',
      'Quiet does not have to mean empty.',
      'You exposed the false thoughts, swallowed what was real, and left one memory glowing in the city. The dreamer can finally rest.',
      'Play again',
      beginGame,
      true
    );
    overlayLink.hidden = false;
  }

  function ensureAudio() {
    if (!audioEnabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
  }

  function tone(startFrequency, endFrequency, duration, volume, type = 'sine', delay = 0) {
    if (!audioEnabled) return;
    ensureAudio();
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + .03);
  }

  function playGulp() {
    // A short bright pop makes the contact easy to hear, followed by a
    // rounded low gulp. All tones are synthesized in the browser.
    tone(330, 145, .13, .06, 'triangle');
    tone(175, 58, .38, .09, 'sine', .035);
    tone(92, 44, .45, .04, 'sine', .09);
  }

  function playCombo() {
    tone(420, 620, .18, .035, 'sine');
    tone(620, 880, .24, .026, 'sine', .08);
  }

  function playEcho() {
    tone(430, 260, .18, .018, 'sine');
    tone(520, 310, .22, .012, 'sine', .04);
  }

  function playMemory() {
    tone(330, 440, .5, .035, 'sine');
    tone(440, 660, .6, .022, 'sine', .12);
  }

  function playFinishSound() {
    playMemory();
    tone(660, 880, .55, .018, 'sine', .28);
  }

  function addParticles(object, color, extra = 0) {
    const amount = reducedMotion ? 5 : 14 + extra;
    for (let index = 0; index < amount; index += 1) {
      const angle = random(0, Math.PI * 2);
      particles.push({
        x: object.x,
        y: object.y,
        vx: Math.cos(angle) * random(22, 90),
        vy: Math.sin(angle) * random(22, 90),
        life: 1,
        size: random(2, 5),
        color,
        shape: index % 3 === 0 ? 'star' : 'dot'
      });
    }
    ripples.push({ x: object.x, y: object.y, radius: object.radius, life: 1, color });
  }

  function consumeObject(object) {
    if (object.removing) return;
    object.removing = true;
    player.chomp = 1;
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = 2.15;
    comboFlash = 1;
    cleared += 1;
    totalSwallowed += 1;
    noise = Math.max(stageIndex === 2 ? 14 : 8, 100 - (cleared / stages[stageIndex].goal) * (stageIndex === 2 ? 86 : 92));
    const nextGrowthLevel = Math.min(5, Math.floor(totalSwallowed / 3));
    const didGrow = nextGrowthLevel > growthLevel;
    if (didGrow) {
      growthLevel = nextGrowthLevel;
      player.targetRadius = growthRadius();
      growthPulse = 1;
      addParticles(player, '#ffc1da', 14);
    }
    addParticles(object, objectColor(object.kind), Math.min(12, combo * 2));
    playGulp();
    if (combo >= 2) playCombo();
    message.textContent = cleared === stages[stageIndex].goal
      ? (stageIndex === 2 ? 'The city is quiet. Return to the glowing memory.' : 'This part of the city is quiet now.')
      : didGrow
        ? `Growth ${growthLevel}/5! The tiny dreamer is visibly bigger now. ✦`
      : combo >= 2
        ? `Sparkle combo x${combo}! Keep going!`
        : ['Yum! Chase another glowing thought.', 'The city feels lighter already.', 'A little more room to breathe.'][cleared % 3];
    updateHud();

    if (cleared >= stages[stageIndex].goal) {
      completionReady = true;
      if (stageIndex < 2) {
        window.setTimeout(() => showStageIntro(stageIndex + 1), 650);
      } else {
        const memory = objects.find((item) => item.type === 'memory');
        if (memory) ripples.push({ x: memory.x, y: memory.y, radius: 30, life: 2.2, color: '#fff0a7' });
      }
    }
  }

  function touchEcho(object) {
    if (object.removing || object.revealed || bumpCooldown > 0) return;
    object.revealed = true;
    object.glitch = 1;
    bumpCooldown = .6;
    const fallbackX = player.facing || 1;
    const awayX = player.x - object.x;
    const awayY = player.y - object.y;
    const awayLength = Math.hypot(awayX, awayY) || 1;
    const normalX = awayLength > 2 ? awayX / awayLength : fallbackX;
    const normalY = awayLength > 2 ? awayY / awayLength : -.25;
    player.x += normalX * 34;
    player.y += normalY * 34;
    player.vx = normalX * 90;
    player.vy = normalY * 90;
    noise = Math.min(100, noise + 8);
    addParticles(object, '#7ed7d1', 9);
    addParticles(object, '#ff8f9f', 7);
    playEcho();
    message.textContent = 'Fake thought! It looked swallowable, but the dreamer cannot eat it.';
    updateHud();
  }

  function touchMemory(object) {
    if (bumpCooldown > 0) return;
    bumpCooldown = .7;
    ripples.push({ x: object.x, y: object.y, radius: 28, life: 1.4, color: '#fff0a7' });
    playMemory();
    if (completionReady) {
      message.textContent = 'You remembered what to keep.';
      window.setTimeout(finishGame, 480);
    } else {
      message.textContent = 'Keep this one. Clear the solid static around it first.';
      const angle = Math.atan2(player.y - object.y, player.x - object.x);
      player.x += Math.cos(angle) * 26;
      player.y += Math.sin(angle) * 26;
    }
  }

  function updatePlayer(delta) {
    let xDirection = 0;
    let yDirection = 0;
    if (keys.has('arrowleft') || keys.has('a')) xDirection -= 1;
    if (keys.has('arrowright') || keys.has('d')) xDirection += 1;
    if (keys.has('arrowup') || keys.has('w')) yDirection -= 1;
    if (keys.has('arrowdown') || keys.has('s')) yDirection += 1;

    if (xDirection || yDirection) {
      const length = Math.hypot(xDirection, yDirection) || 1;
      const speed = 250;
      player.vx += (xDirection / length) * speed * delta * 6;
      player.vy += (yDirection / length) * speed * delta * 6;
      pointerTarget = null;
    } else if (pointerTarget) {
      const dx = pointerTarget.x - player.x;
      const dy = pointerTarget.y - player.y;
      const distanceToTarget = Math.hypot(dx, dy);
      if (distanceToTarget > 6) {
        const speed = Math.min(370, 90 + distanceToTarget * 2.2);
        player.vx += (dx / distanceToTarget) * speed * delta * 5;
        player.vy += (dy / distanceToTarget) * speed * delta * 5;
      } else if (!pointerActive) {
        pointerTarget = null;
      }
    }

    const damping = Math.pow(.0008, delta);
    player.vx *= damping;
    player.vy *= damping;
    player.x += player.vx * delta;
    player.y += player.vy * delta;
    if (Math.abs(player.vx) > 2) player.facing = Math.sign(player.vx);
    player.radius += (player.targetRadius - player.radius) * Math.min(1, delta * 8);
    player.x = Math.max(player.radius + 9, Math.min(WORLD.width - player.radius - 9, player.x));
    player.y = Math.max(player.radius + 9, Math.min(WORLD.height - player.radius - 9, player.y));
    // Keep the swallow reaction long enough to read as two soft chews.
    player.chomp = Math.max(0, player.chomp - delta * 1.35);
    player.blink += delta;
  }

  function update(delta) {
    if (!playing) return;
    elapsed += delta;
    bumpCooldown = Math.max(0, bumpCooldown - delta);
    comboTimer = Math.max(0, comboTimer - delta);
    comboFlash = Math.max(0, comboFlash - delta * 2.4);
    growthPulse = Math.max(0, growthPulse - delta * 1.7);
    if (comboTimer === 0) combo = 0;
    updatePlayer(delta);

    const playerSpeed = Math.hypot(player.vx, player.vy);
    trailTimer -= delta;
    if (!reducedMotion && playerSpeed > 35 && trailTimer <= 0) {
      trailTimer = .055;
      particles.push({
        x: player.x + random(-8, 8),
        y: player.y + player.radius * .45 + random(-5, 5),
        vx: random(-18, 18),
        vy: random(10, 35),
        life: .65,
        size: random(2, 4.5),
        color: Math.random() > .42 ? '#f1c663' : '#ffc1da',
        shape: Math.random() > .55 ? 'star' : 'dot'
      });
    }

    objects.forEach((object) => {
      if (object.removing) {
        object.scale -= delta * 4.5;
        return;
      }
      if (object.revealed && object.glitch > 0) {
        object.glitch = Math.max(0, object.glitch - delta * .52);
        if (object.glitch === 0) object.removing = true;
        return;
      }
      if (!object.revealed && distance(player, object) < player.radius * .72 + object.radius + 11) {
        if (object.type === 'solid') consumeObject(object);
        else if (object.type === 'echo') touchEcho(object);
        else touchMemory(object);
      }
    });
    objects = objects.filter((object) => object.scale > 0);

    particles.forEach((particle) => {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= Math.pow(.08, delta);
      particle.vy *= Math.pow(.08, delta);
      particle.life -= delta * 1.8;
    });
    particles = particles.filter((particle) => particle.life > 0);
    ripples.forEach((ripple) => {
      ripple.radius += delta * 70;
      ripple.life -= delta * .9;
    });
    ripples = ripples.filter((ripple) => ripple.life > 0);
  }

  function objectColor(kind) {
    const colors = {
      note: '#fff6df',
      cup: '#ff9caf',
      phone: '#7ce0dc',
      clock: '#ffd36e',
      book: '#b79bdf',
      lamp: '#ffb47f',
      memory: '#fff1a4'
    };
    return colors[kind] || '#fff6e6';
  }

  function starPath(x, y, outerRadius, innerRadius = outerRadius * .42, points = 4) {
    context.beginPath();
    for (let point = 0; point < points * 2; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / points;
      const radius = point % 2 === 0 ? outerRadius : innerRadius;
      const pointX = x + Math.cos(angle) * radius;
      const pointY = y + Math.sin(angle) * radius;
      if (!point) context.moveTo(pointX, pointY); else context.lineTo(pointX, pointY);
    }
    context.closePath();
  }

  function drawObjectFace(kind) {
    const faceY = { note: 3, cup: 2, phone: 0, clock: 4, book: 5, lamp: -10 }[kind] ?? 2;
    context.save();
    context.rotate(-.02);
    context.fillStyle = '#4b3559';
    context.beginPath();
    context.ellipse(-5, faceY, 1.7, 2.2, 0, 0, Math.PI * 2);
    context.ellipse(5, faceY, 1.7, 2.2, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#4b3559';
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(0, faceY + 1, 4, .28, Math.PI - .28);
    context.stroke();
    context.fillStyle = 'rgba(239,105,145,.5)';
    context.beginPath();
    context.arc(-9, faceY + 4, 2, 0, Math.PI * 2);
    context.arc(9, faceY + 4, 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawBackground(stage) {
    const calm = 1 - noise / 100;
    if (gameBoardImage.complete && gameBoardImage.naturalWidth) {
      const imageRatio = gameBoardImage.naturalWidth / gameBoardImage.naturalHeight;
      const worldRatio = WORLD.width / WORLD.height;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = gameBoardImage.naturalWidth;
      let sourceHeight = gameBoardImage.naturalHeight;
      if (imageRatio > worldRatio) {
        sourceWidth = sourceHeight * worldRatio;
        sourceX = (gameBoardImage.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = sourceWidth / worldRatio;
        sourceY = (gameBoardImage.naturalHeight - sourceHeight) / 2;
      }
      if (!reducedMotion) {
        const horizontalRoom = Math.max(0, (gameBoardImage.naturalWidth - sourceWidth) / 2);
        const verticalRoom = Math.max(0, (gameBoardImage.naturalHeight - sourceHeight) / 2);
        sourceX += Math.sin(elapsed * .18) * Math.min(72, horizontalRoom);
        sourceY += Math.cos(elapsed * .13) * Math.min(24, verticalRoom);
      }
      context.drawImage(gameBoardImage, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, WORLD.width, WORLD.height);
    } else {
      const gradient = context.createLinearGradient(0, 0, WORLD.width, WORLD.height);
      gradient.addColorStop(0, '#272449');
      gradient.addColorStop(1, '#4b2f61');
      context.fillStyle = gradient;
      context.fillRect(0, 0, WORLD.width, WORLD.height);
    }

    const dreamWash = context.createLinearGradient(0, 0, 0, WORLD.height);
    dreamWash.addColorStop(0, `rgba(19,18,48,${.18 + stageIndex * .045})`);
    dreamWash.addColorStop(.52, `rgba(37,24,68,${.08 + (1 - calm) * .08})`);
    dreamWash.addColorStop(1, 'rgba(12,15,35,.24)');
    context.fillStyle = dreamWash;
    context.fillRect(0, 0, WORLD.width, WORLD.height);

    // Moving fog and reflected light make the illustrated city visibly breathe.
    if (!reducedMotion) {
      context.save();
      context.globalCompositeOperation = 'screen';
      for (let layer = 0; layer < 3; layer += 1) {
        const travel = (elapsed * (22 + layer * 8) + layer * 270) % (WORLD.width + 420);
        const x = travel - 210;
        const y = WORLD.height * (.22 + layer * .24) + Math.sin(elapsed * .25 + layer) * 28;
        const fog = context.createRadialGradient(x, y, 10, x, y, 210 + layer * 36);
        fog.addColorStop(0, layer === 1 ? 'rgba(255,177,219,.14)' : 'rgba(145,224,235,.13)');
        fog.addColorStop(.55, 'rgba(185,151,235,.06)');
        fog.addColorStop(1, 'rgba(145,224,235,0)');
        context.fillStyle = fog;
        context.beginPath();
        context.ellipse(x, y, 255 + layer * 45, 52 + layer * 10, -.12, 0, Math.PI * 2);
        context.fill();
      }

      context.lineCap = 'round';
      for (let trail = 0; trail < 5; trail += 1) {
        const drift = Math.sin(elapsed * .38 + trail * 1.6) * 24;
        context.globalAlpha = .08 + trail * .012;
        context.strokeStyle = trail % 2 ? '#ffd58a' : '#d49bff';
        context.lineWidth = 1.2 + trail * .3;
        context.beginPath();
        context.moveTo(-80, WORLD.height * (.33 + trail * .1) + drift);
        context.bezierCurveTo(WORLD.width * .22, WORLD.height * (.2 + trail * .11), WORLD.width * .7, WORLD.height * (.56 + trail * .045), WORLD.width + 90, WORLD.height * (.38 + trail * .08) - drift);
        context.stroke();
      }
      context.restore();
    }

    // Traveling fireflies and star sparks make the background motion easy to see.
    context.save();
    context.globalCompositeOperation = 'screen';
    for (let index = 0; index < 34; index += 1) {
      const travelWidth = WORLD.width + 80;
      const speed = 8 + (index % 6) * 3.2;
      const x = ((index * 173 + 79 + elapsed * speed) % travelWidth) - 40;
      const baseY = (index * 97 + 55) % WORLD.height;
      const y = baseY + Math.sin(elapsed * (.85 + (index % 3) * .14) + index * 1.7) * 19;
      const alpha = .24 + (Math.sin(elapsed * 2.1 + index) + 1) * .18;
      context.globalAlpha = alpha;
      context.fillStyle = index % 4 === 0 ? '#9ee9eb' : '#ffd97c';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = 15;
      if (index % 5 === 0) starPath(x, y, 4.2, 1.25);
      else {
        context.beginPath();
        context.arc(x, y, index % 3 === 0 ? 2.8 : 1.7, 0, Math.PI * 2);
      }
      context.fill();
    }

    // A handful of bright wisps visibly cross the plaza behind the objects.
    for (let wisp = 0; wisp < 4; wisp += 1) {
      const progress = ((elapsed * (42 + wisp * 7) + wisp * 230) % (WORLD.width + 260)) - 130;
      const wispY = WORLD.height * (.18 + wisp * .19) + Math.sin(elapsed * .8 + wisp) * 22;
      const tail = context.createLinearGradient(progress - 70, wispY, progress + 8, wispY);
      tail.addColorStop(0, 'rgba(255,213,138,0)');
      tail.addColorStop(1, wisp % 2 ? 'rgba(158,233,235,.48)' : 'rgba(255,213,138,.52)');
      context.globalAlpha = .7;
      context.strokeStyle = tail;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(progress - 70, wispY + 9);
      context.quadraticCurveTo(progress - 28, wispY - 12, progress, wispY);
      context.stroke();
      context.fillStyle = wisp % 2 ? '#9ee9eb' : '#ffd58a';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = 18;
      starPath(progress, wispY, 5, 1.5);
      context.fill();
    }
    context.restore();

    if (stageIndex > 0) {
      context.save();
      context.globalAlpha = stageIndex === 1 ? .055 : .085;
      context.fillStyle = '#7ed7d1';
      context.fillRect(Math.sin(elapsed * 1.7) * 9 - 10, 0, WORLD.width, WORLD.height);
      context.globalCompositeOperation = 'screen';
      context.fillStyle = '#ff8f79';
      context.fillRect(Math.cos(elapsed * 1.3) * -7 + 8, 0, WORLD.width, WORLD.height);
      context.restore();
    }
  }

  function drawObjectShape(object, alpha = 1, offsetX = 0) {
    const color = objectColor(object.kind);
    const revealedEcho = object.type === 'echo' && object.revealed;
    const floatY = reducedMotion ? 0 : Math.sin(elapsed * 2.4 + object.phase) * 4;
    context.save();
    const glitchJitter = revealedEcho && object.glitch > 0 ? Math.sin(elapsed * 42 + object.phase) * object.glitch * 5 : 0;
    context.translate(object.x + offsetX + glitchJitter, object.y + floatY);
    context.scale(Math.max(0, object.scale), Math.max(0, object.scale));
    context.globalAlpha = alpha;

    if (object.kind !== 'memory') {
      const bubbleRadius = object.radius + 17;
      const bubble = context.createRadialGradient(-bubbleRadius * .28, -bubbleRadius * .32, 2, 0, 0, bubbleRadius);
      bubble.addColorStop(0, revealedEcho ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.84)');
      bubble.addColorStop(.52, revealedEcho ? 'rgba(126,215,209,.08)' : `${color}bb`);
      bubble.addColorStop(1, revealedEcho ? 'rgba(255,143,159,0)' : `${color}4d`);
      context.fillStyle = bubble;
      context.strokeStyle = revealedEcho ? 'rgba(255,255,255,.34)' : 'rgba(255,250,240,.86)';
      context.lineWidth = revealedEcho ? 1.2 : 1.8;
      context.setLineDash(revealedEcho ? [3, 5] : []);
      context.shadowColor = color;
      context.shadowBlur = revealedEcho ? 8 : 24;
      context.beginPath();
      context.arc(0, 0, bubbleRadius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.stroke();
      context.setLineDash([]);

      if (!revealedEcho) {
        context.fillStyle = '#fff4b5';
        context.shadowColor = '#fff1a0';
        context.shadowBlur = 9;
        starPath(bubbleRadius * .7, -bubbleRadius * .62, 4.5, 1.7);
        context.fill();
        context.globalAlpha = alpha * .62;
        starPath(-bubbleRadius * .67, bubbleRadius * .48, 3, 1.2);
        context.fill();
        context.globalAlpha = alpha;
      }
    }

    context.rotate(object.rotation);
    context.shadowColor = color;
    context.shadowBlur = revealedEcho ? 5 : 10;
    context.fillStyle = color;
    context.strokeStyle = '#4b3559';
    context.lineWidth = 2;

    if (object.kind === 'note') {
      context.beginPath();
      context.roundRect(-15, -19, 30, 38, 4);
      context.fill(); context.stroke();
      context.strokeStyle = '#e4837f';
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(-8, -8); context.lineTo(8, -8);
      context.moveTo(-8, 0); context.lineTo(5, 0);
      context.moveTo(-8, 8); context.lineTo(9, 8);
      context.stroke();
    } else if (object.kind === 'cup') {
      context.beginPath();
      context.roundRect(-16, -12, 28, 27, 5);
      context.fill(); context.stroke();
      context.beginPath();
      context.arc(14, 0, 8, -Math.PI / 2, Math.PI / 2);
      context.stroke();
    } else if (object.kind === 'phone') {
      context.beginPath();
      context.roundRect(-12, -21, 24, 42, 5);
      context.fill(); context.stroke();
      context.fillStyle = '#fffaf1';
      context.beginPath(); context.arc(0, 15, 2, 0, Math.PI * 2); context.fill();
    } else if (object.kind === 'clock') {
      context.beginPath(); context.arc(0, 0, 19, 0, Math.PI * 2); context.fill(); context.stroke();
      context.beginPath(); context.moveTo(0, 0); context.lineTo(1, -11); context.moveTo(0, 0); context.lineTo(9, 5); context.stroke();
    } else if (object.kind === 'book') {
      context.beginPath();
      context.moveTo(0, -16); context.quadraticCurveTo(-11, -22, -22, -13); context.lineTo(-22, 17); context.quadraticCurveTo(-11, 9, 0, 17);
      context.quadraticCurveTo(11, 9, 22, 17); context.lineTo(22, -13); context.quadraticCurveTo(11, -22, 0, -16); context.fill(); context.stroke();
      context.beginPath(); context.moveTo(0, -16); context.lineTo(0, 17); context.stroke();
    } else if (object.kind === 'lamp') {
      context.fillRect(-3, -3, 6, 25);
      context.beginPath();
      context.moveTo(-17, -4); context.lineTo(-11, -22); context.lineTo(11, -22); context.lineTo(17, -4); context.closePath(); context.fill(); context.stroke();
      context.beginPath(); context.moveTo(-12, 22); context.lineTo(12, 22); context.stroke();
    } else if (object.kind === 'memory') {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(elapsed * 3) * .07;
      context.scale(pulse, pulse);
      const glow = context.createRadialGradient(0, 0, 2, 0, 0, 48);
      glow.addColorStop(0, 'rgba(255,250,210,.95)');
      glow.addColorStop(.35, 'rgba(241,198,99,.52)');
      glow.addColorStop(1, 'rgba(241,198,99,0)');
      context.fillStyle = glow;
      context.beginPath(); context.arc(0, 0, 49, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#fff4b5';
      context.shadowColor = '#fff0a7';
      context.shadowBlur = 20;
      starPath(0, 0, 22, 9, 5);
      context.fill();
      context.fillStyle = '#fffdf0';
      starPath(-6, -7, 5, 2, 4);
      context.fill();
    }

    context.shadowBlur = 0;
    if (object.kind !== 'memory') drawObjectFace(object.kind);
    context.restore();
  }

  function drawObjects() {
    objects.forEach((object) => {
      if (object.type === 'echo') {
        if (object.revealed) {
          const strength = Math.max(.18, object.glitch);
          drawObjectShape(object, .42 + strength * .25, -8 - strength * 4);
          drawObjectShape(object, .5 + strength * .25, 8 + strength * 4);
          context.save();
          context.globalAlpha = .28 + strength * .34;
          context.strokeStyle = '#fffaf1';
          context.setLineDash([3, 6]);
          context.beginPath(); context.arc(object.x, object.y, object.radius + 18 + strength * 8, 0, Math.PI * 2); context.stroke();
          context.fillStyle = '#fff7e8';
          context.font = '800 8px "Segoe UI", Arial, sans-serif';
          context.textAlign = 'center';
          context.fillText('FALSE ECHO', object.x, object.y - object.radius - 27);
          context.restore();
        } else {
          // Before contact, a hallucination deliberately passes as a real object.
          drawObjectShape(object, .98, 0);
          const tell = reducedMotion ? -1 : Math.sin(elapsed * .72 + object.phase);
          if (tell > .91) {
            const whisper = (tell - .91) / .09;
            drawObjectShape(object, whisper * .12, -3);
            drawObjectShape(object, whisper * .1, 3);
          }
        }
      } else {
        drawObjectShape(object, 1);
      }
    });
  }

  function drawPlayer() {
    const moving = Math.hypot(player.vx, player.vy);
    const bob = reducedMotion ? 0 : Math.sin(elapsed * 3.7) * 5;
    const squash = player.chomp > 0 ? 1 - Math.sin(player.chomp * Math.PI) * .14 : 1;
    const growBounce = growthPulse > 0 && !reducedMotion ? 1 + Math.sin((1 - growthPulse) * Math.PI) * .14 : 1;
    const radius = player.radius;
    context.save();
    context.translate(player.x, player.y + bob);
    if (!reducedMotion) context.rotate(Math.sin(elapsed * 1.8) * .035);
    context.scale(player.facing, 1);
    context.scale(growBounce / squash, growBounce * squash);

    context.save();
    context.globalAlpha = .16;
    context.fillStyle = '#171a2a';
    context.beginPath();
    context.ellipse(0, radius * .82, radius * .78, radius * .24, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    if (creatureImage.complete && creatureImage.naturalWidth) {
      const aura = context.createRadialGradient(0, 0, radius * .1, 0, 0, radius * 1.75);
      aura.addColorStop(0, 'rgba(255,210,145,.2)');
      aura.addColorStop(.55, 'rgba(180,132,233,.13)');
      aura.addColorStop(1, 'rgba(180,132,233,0)');
      context.fillStyle = aura;
      context.beginPath();
      context.arc(0, 0, radius * 1.8, 0, Math.PI * 2);
      context.fill();

      context.save();
      for (let sparkle = 0; sparkle < 5; sparkle += 1) {
        const angle = elapsed * .45 + sparkle * Math.PI * .4;
        const orbit = radius * (1.35 + (sparkle % 2) * .22);
        const x = Math.cos(angle) * orbit;
        const y = Math.sin(angle) * orbit * .62;
        context.globalAlpha = .52 + Math.sin(elapsed * 2 + sparkle) * .18;
        context.fillStyle = sparkle % 2 ? '#ffd77e' : '#ffc1dd';
        context.shadowColor = context.fillStyle;
        context.shadowBlur = 10;
        starPath(x, y, sparkle % 2 ? 3.7 : 2.8, 1.2);
        context.fill();
      }
      context.restore();

      const spriteSize = radius * 4.65;
      context.shadowColor = 'rgba(241,198,99,.36)';
      context.shadowBlur = player.chomp > 0 ? 24 : 12;
      const moveEnergy = Math.min(1, moving / 180);
      const breath = reducedMotion ? 0 : Math.sin(elapsed * 2.25) * .035;
      const step = reducedMotion ? 0 : Math.sin(elapsed * 8.4) * moveEnergy;
      const travelTilt = reducedMotion ? 0 : Math.max(-.055, Math.min(.055, player.vx * .00016));
      const chewProgress = player.chomp > 0 ? 1 - player.chomp : 0;
      const chewWave = player.chomp > 0 && !reducedMotion ? Math.sin(chewProgress * Math.PI * 4) : 0;
      const chewOpen = player.chomp > 0 ? (chewWave + 1) / 2 : 1;

      // Draw the creature exactly once so the silhouette always remains a
      // single soft character. Squash, stretch, tilt, and bounce animate the
      // complete body without cutting the illustration into visible pieces.
      context.save();
      context.translate(step * 2.2, Math.abs(step) * 1.6 - Math.abs(chewWave) * 2.2);
      context.rotate(travelTilt + step * .018 + chewWave * .012);
      context.scale(
        1 + breath + moveEnergy * .018 + Math.abs(chewWave) * .035,
        1 - breath * .7 - moveEnergy * .025 - Math.abs(chewWave) * .045
      );
      context.drawImage(creatureImage, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
      context.restore();

      // The original art has open eyes, so soft colored eyelids are drawn over
      // the exact eye positions for a natural blink every few seconds.
      const blinkCycle = reducedMotion ? 0 : player.blink % 3.7;
      const blinkAmount = blinkCycle > 3.34 ? Math.sin(((blinkCycle - 3.34) / .36) * Math.PI) : 0;
      if (blinkAmount > 0) {
        const lidGradient = context.createLinearGradient(0, -spriteSize * .24, 0, -spriteSize * .08);
        lidGradient.addColorStop(0, '#d07ab6');
        lidGradient.addColorStop(1, '#9c5aaa');
        const drawEyelid = (x, y, rx, ry, rotation) => {
          context.save();
          context.translate(x, y);
          context.rotate(rotation);
          context.fillStyle = lidGradient;
          context.strokeStyle = 'rgba(70,35,72,.86)';
          context.lineWidth = Math.max(1.2, spriteSize * .012);
          context.beginPath();
          context.ellipse(0, 0, rx, Math.max(1, ry * blinkAmount), 0, 0, Math.PI * 2);
          context.fill();
          if (blinkAmount > .55) {
            context.beginPath();
            context.moveTo(-rx * .8, 0);
            context.quadraticCurveTo(0, ry * .35, rx * .8, 0);
            context.stroke();
          }
          context.restore();
        };
        drawEyelid(spriteSize * .02, -spriteSize * .158, spriteSize * .075, spriteSize * .066, -.07);
        drawEyelid(spriteSize * .222, -spriteSize * .197, spriteSize * .065, spriteSize * .06, -.24);
      }

      // During a swallow, redraw the mouth as it closes and opens twice. This
      // produces a clear chewing expression while keeping the body unified.
      if (player.chomp > 0) {
        const mouthX = spriteSize * .166;
        const mouthY = -spriteSize * .088;
        const mouthHeight = spriteSize * (.008 + chewOpen * .036);
        context.save();
        context.translate(mouthX, mouthY);
        context.rotate(.08);
        context.fillStyle = '#542542';
        context.strokeStyle = 'rgba(62,25,54,.88)';
        context.lineWidth = Math.max(1, spriteSize * .009);
        context.beginPath();
        context.ellipse(0, 0, spriteSize * .048, mouthHeight, 0, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        if (chewOpen > .46) {
          context.fillStyle = '#f2707f';
          context.beginPath();
          context.ellipse(0, mouthHeight * .45, spriteSize * .025, mouthHeight * .3, 0, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      }
      context.restore();
      return;
    }

    context.fillStyle = '#9a83b9';
    context.strokeStyle = 'rgba(255,250,241,.72)';
    context.lineWidth = 2;
    context.beginPath(); context.arc(-radius * .57, -radius * .62, radius * .32, 0, Math.PI * 2); context.fill(); context.stroke();
    context.beginPath(); context.arc(radius * .57, -radius * .62, radius * .32, 0, Math.PI * 2); context.fill(); context.stroke();

    const body = context.createLinearGradient(-radius, -radius, radius, radius);
    body.addColorStop(0, '#b9a5d0');
    body.addColorStop(.58, '#9279b2');
    body.addColorStop(1, '#6f5b94');
    context.fillStyle = body;
    context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fill(); context.stroke();

    context.fillStyle = 'rgba(255,157,170,.58)';
    context.beginPath(); context.arc(-radius * .62, radius * .22, radius * .1, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(radius * .62, radius * .22, radius * .1, 0, Math.PI * 2); context.fill();

    const blinking = !reducedMotion && player.blink % 4.7 > 4.58;
    context.fillStyle = '#fffaf1';
    context.strokeStyle = '#392d4b';
    context.lineWidth = 1.6;
    if (blinking) {
      context.beginPath(); context.moveTo(-radius * .55, -radius * .15); context.lineTo(-radius * .18, -radius * .15); context.stroke();
      context.beginPath(); context.moveTo(radius * .18, -radius * .15); context.lineTo(radius * .55, -radius * .15); context.stroke();
    } else {
      context.beginPath(); context.ellipse(-radius * .34, -radius * .14, radius * .18, radius * .22, 0, 0, Math.PI * 2); context.fill(); context.stroke();
      context.beginPath(); context.ellipse(radius * .34, -radius * .14, radius * .18, radius * .22, 0, 0, Math.PI * 2); context.fill(); context.stroke();
      context.fillStyle = '#392d4b';
      context.beginPath(); context.arc(-radius * .29, -radius * .11, radius * .065, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.arc(radius * .39, -radius * .11, radius * .065, 0, Math.PI * 2); context.fill();
    }

    const mouthHeight = player.chomp > 0 ? radius * .34 : radius * .17 + Math.min(4, moving * .006);
    context.fillStyle = '#49334f';
    context.strokeStyle = 'rgba(255,250,241,.7)';
    context.beginPath();
    context.roundRect(-radius * .28, radius * .25, radius * .56, mouthHeight, [3, 3, radius * .25, radius * .25]);
    context.fill(); context.stroke();
    context.fillStyle = '#ff9aa4';
    context.beginPath(); context.ellipse(0, radius * .25 + mouthHeight * .78, radius * .15, mouthHeight * .22, 0, 0, Math.PI * 2); context.fill();
    context.restore();
  }

  function drawEffects() {
    ripples.forEach((ripple) => {
      context.save();
      context.globalAlpha = Math.min(1, ripple.life) * .55;
      context.strokeStyle = ripple.color;
      context.lineWidth = 2;
      context.beginPath(); context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2); context.stroke();
      context.restore();
    });
    particles.forEach((particle) => {
      context.save();
      context.globalAlpha = particle.life;
      context.fillStyle = particle.color;
      context.shadowColor = particle.color;
      context.shadowBlur = 8;
      if (particle.shape === 'star') {
        starPath(particle.x, particle.y, particle.size * 1.5, particle.size * .55);
        context.fill();
      } else {
        context.beginPath(); context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); context.fill();
      }
      context.restore();
    });
  }

  function drawPointerTarget() {
    if (!playing || !pointerTarget) return;
    const pulse = reducedMotion ? 1 : .9 + Math.sin(elapsed * 5) * .12;
    context.save();
    context.translate(pointerTarget.x, pointerTarget.y);
    context.scale(pulse, pulse);
    context.strokeStyle = 'rgba(255,245,190,.72)';
    context.lineWidth = 1.4;
    context.setLineDash([3, 5]);
    context.beginPath();
    context.arc(0, 0, 18, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = '#fff0a7';
    context.shadowColor = '#fff0a7';
    context.shadowBlur = 13;
    starPath(0, 0, 5, 1.8);
    context.fill();
    context.restore();
  }

  function drawCombo() {
    if (combo < 2 || comboTimer <= 0) return;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(comboFlash * Math.PI) * .08;
    context.save();
    context.translate(WORLD.width / 2, 58);
    context.scale(pulse, pulse);
    context.font = '800 12px "Segoe UI", Arial, sans-serif';
    const label = `✦  SPARKLE COMBO x${combo}`;
    const width = context.measureText(label).width + 34;
    context.fillStyle = 'rgba(255,248,225,.92)';
    context.strokeStyle = 'rgba(117,75,145,.42)';
    context.lineWidth = 1.6;
    context.beginPath();
    context.roundRect(-width / 2, -18, width, 36, 18);
    context.fill();
    context.stroke();
    context.fillStyle = '#7b4f91';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(255,255,255,.9)';
    context.shadowBlur = 8;
    context.fillText(label, 0, 1);
    context.restore();
  }

  function draw() {
    context.save();
    context.scale(cssWidth / WORLD.width, cssHeight / WORLD.height);
    drawBackground(stages[stageIndex]);
    drawObjects();
    drawPointerTarget();
    drawEffects();
    drawPlayer();
    drawCombo();
    context.restore();
  }

  function loop(now) {
    const delta = Math.min(.04, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(delta);
    draw();
    animationFrame = requestAnimationFrame(loop);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * WORLD.width,
      y: (event.clientY - rect.top) / rect.height * WORLD.height
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!playing) return;
    pointerActive = true;
    pointerTarget = pointerPosition(event);
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!playing || !pointerActive) return;
    pointerTarget = pointerPosition(event);
  });
  canvas.addEventListener('pointerup', (event) => {
    pointerActive = false;
    pointerTarget = pointerPosition(event);
  });
  canvas.addEventListener('pointercancel', () => { pointerActive = false; });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(key)) {
      keys.add(key);
      if (playing) event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  soundToggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    soundToggle.setAttribute('aria-pressed', String(audioEnabled));
    soundToggle.setAttribute('aria-label', audioEnabled ? 'Mute game sound' : 'Turn on game sound');
    soundToggle.innerHTML = `<span aria-hidden="true">♪</span> Sound ${audioEnabled ? 'on' : 'off'}`;
    if (audioEnabled) playEcho();
  });

  restartButton.addEventListener('click', () => {
    resetGrowth();
    buildStage(0);
    showOverlay(
      INTRO_STEP,
      'Make some room to breathe.',
      'Guide the little dreamer through the living city. Real thoughts help it grow, but some thoughts may only be copies.',
      'Start the game',
      beginGame
    );
  });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  buildStage(0);
  overlayButton.onclick = beginGame;
  animationFrame = requestAnimationFrame(loop);
})();
