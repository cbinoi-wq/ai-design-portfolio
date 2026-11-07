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
  const soundToggle = document.querySelector('#sound-toggle');
  const restartButton = document.querySelector('#restart-game');

  const WORLD = { width: 960, height: 620 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stages = [
    {
      name: 'Release',
      goal: 7,
      echoes: 0,
      message: 'Clear the small, solid thoughts.',
      colors: ['#c8d8d4', '#e8d2cb'],
      intro: 'Start with what feels manageable.',
      copy: 'Move into the solid objects. Every gentle gulp makes the world quieter and helps the creature grow.'
    },
    {
      name: 'Doubt',
      goal: 8,
      echoes: 5,
      message: 'Flickering double images are only echoes.',
      colors: ['#c8c7d9', '#b8d8d3'],
      intro: 'The city begins to copy itself.',
      copy: 'Some objects now flicker and split into double images. They are hallucinated echoes, so touching them gives no growth.'
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

  const player = {
    x: WORLD.width * .5,
    y: WORLD.height * .57,
    radius: 28,
    targetRadius: 28,
    vx: 0,
    vy: 0,
    chomp: 0,
    blink: 0,
    facing: 1
  };

  const objectKinds = ['note', 'cup', 'phone', 'clock', 'book', 'lamp'];

  function resizeCanvas() {
    const rect = wrap.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
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
      removing: false
    };
  }

  function buildStage(index) {
    const stage = stages[index];
    stageIndex = index;
    cleared = 0;
    noise = 100;
    completionReady = false;
    objects = [];
    particles = [];
    ripples = [];
    player.x = WORLD.width * .5;
    player.y = WORLD.height * .57;
    player.radius = 28 + index * 4;
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
  }

  function showOverlay(step, title, copy, buttonText, action, final = false) {
    overlayStep.textContent = step;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    overlayButton.textContent = buttonText;
    overlayButton.onclick = action;
    instructionGrid.hidden = step !== 'FIRST DRAFT · WEEK 02';
    overlayLink.hidden = !final && step !== 'FIRST DRAFT · WEEK 02';
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
      'FIRST DRAFT COMPLETE',
      'Quiet does not have to mean empty.',
      'You cleared the visual noise and left one memory glowing in the city. Thank you for testing this early version of Swallow the Static.',
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

  function addParticles(object, color) {
    const amount = reducedMotion ? 4 : 12;
    for (let index = 0; index < amount; index += 1) {
      const angle = random(0, Math.PI * 2);
      particles.push({
        x: object.x,
        y: object.y,
        vx: Math.cos(angle) * random(22, 90),
        vy: Math.sin(angle) * random(22, 90),
        life: 1,
        size: random(2, 5),
        color
      });
    }
    ripples.push({ x: object.x, y: object.y, radius: object.radius, life: 1, color });
  }

  function consumeObject(object) {
    if (object.removing) return;
    object.removing = true;
    player.chomp = 1;
    cleared += 1;
    noise = Math.max(stageIndex === 2 ? 14 : 8, 100 - (cleared / stages[stageIndex].goal) * (stageIndex === 2 ? 86 : 92));
    player.targetRadius = Math.min(47, player.targetRadius + 2.2);
    addParticles(object, objectColor(object.kind));
    playGulp();
    message.textContent = cleared === stages[stageIndex].goal
      ? (stageIndex === 2 ? 'The city is quiet. Return to the glowing memory.' : 'This part of the city is quiet now.')
      : ['Soft gulp. A little more room.', 'The noise is getting lighter.', 'You grew. Keep clearing the solid objects.'][cleared % 3];
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
    if (object.removing || bumpCooldown > 0) return;
    object.removing = true;
    bumpCooldown = .35;
    noise = Math.min(100, noise + 6);
    addParticles(object, '#9bc8d0');
    playEcho();
    message.textContent = 'Only an echo. It looked real, but it gave no growth.';
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
    player.chomp = Math.max(0, player.chomp - delta * 4);
    player.blink += delta;
  }

  function update(delta) {
    if (!playing) return;
    elapsed += delta;
    bumpCooldown = Math.max(0, bumpCooldown - delta);
    updatePlayer(delta);

    objects.forEach((object) => {
      if (object.removing) {
        object.scale -= delta * 4.5;
        return;
      }
      if (distance(player, object) < player.radius * .72 + object.radius * .72) {
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
      note: '#fff6e6',
      cup: '#e5898d',
      phone: '#71c8c4',
      clock: '#f1c663',
      book: '#8b7baa',
      lamp: '#e9a47f',
      memory: '#fff0a7'
    };
    return colors[kind] || '#fff6e6';
  }

  function drawBackground(stage) {
    const calm = 1 - noise / 100;
    const gradient = context.createLinearGradient(0, 0, WORLD.width, WORLD.height);
    gradient.addColorStop(0, stage.colors[0]);
    gradient.addColorStop(1, stage.colors[1]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, WORLD.width, WORLD.height);

    context.save();
    context.globalAlpha = .18 - calm * .08;
    context.strokeStyle = '#263247';
    context.lineWidth = 1;
    for (let x = -60; x < WORLD.width + 60; x += 62) {
      context.beginPath();
      context.moveTo(x + Math.sin(elapsed * .4 + x) * stageIndex * 2, 0);
      context.lineTo(x - 50 + Math.sin(elapsed * .35 + x) * stageIndex * 4, WORLD.height);
      context.stroke();
    }
    for (let y = 20; y < WORLD.height; y += 62) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WORLD.width, y + Math.sin(y * .03 + elapsed * .35) * stageIndex * 7);
      context.stroke();
    }
    context.restore();

    context.save();
    context.globalAlpha = .4;
    context.strokeStyle = '#fffaf1';
    context.lineCap = 'round';
    context.lineWidth = 54;
    context.beginPath();
    context.moveTo(-80, WORLD.height * .73);
    context.bezierCurveTo(WORLD.width * .22, WORLD.height * .53, WORLD.width * .56, WORLD.height * .88, WORLD.width + 90, WORLD.height * .48);
    context.stroke();
    context.lineWidth = 35;
    context.beginPath();
    context.moveTo(WORLD.width * .72, -40);
    context.bezierCurveTo(WORLD.width * .66, WORLD.height * .28, WORLD.width * .79, WORLD.height * .55, WORLD.width * .62, WORLD.height + 50);
    context.stroke();
    context.restore();

    const buildingAlpha = .16 + stageIndex * .035;
    context.save();
    context.globalAlpha = buildingAlpha;
    context.fillStyle = '#253149';
    [[20,40,120,80],[170,20,75,105],[790,50,130,72],[40,440,100,130],[760,430,160,120]].forEach(([x,y,w,h], index) => {
      context.fillRect(x, y, w, h);
      context.fillStyle = index % 2 ? '#f8efe0' : '#253149';
      for (let wx = x + 13; wx < x + w - 7; wx += 22) {
        for (let wy = y + 13; wy < y + h - 7; wy += 24) context.fillRect(wx, wy, 7, 9);
      }
      context.fillStyle = '#253149';
    });
    context.restore();
  }

  function drawObjectShape(object, alpha = 1, offsetX = 0) {
    context.save();
    context.translate(object.x + offsetX, object.y);
    context.rotate(object.rotation);
    context.scale(Math.max(0, object.scale), Math.max(0, object.scale));
    context.globalAlpha = alpha;
    const color = objectColor(object.kind);
    context.fillStyle = color;
    context.strokeStyle = '#24283a';
    context.lineWidth = 2;

    if (object.kind === 'note') {
      context.fillRect(-15, -19, 30, 38);
      context.strokeRect(-15, -19, 30, 38);
      context.strokeStyle = '#e4837f';
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
      const glow = context.createRadialGradient(0, 0, 2, 0, 0, 38);
      glow.addColorStop(0, 'rgba(255,250,210,.95)');
      glow.addColorStop(.35, 'rgba(241,198,99,.52)');
      glow.addColorStop(1, 'rgba(241,198,99,0)');
      context.fillStyle = glow;
      context.beginPath(); context.arc(0, 0, 40, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#fff4b5';
      context.beginPath();
      for (let point = 0; point < 8; point += 1) {
        const angle = -Math.PI / 2 + point * Math.PI / 4;
        const radius = point % 2 === 0 ? 19 : 7;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (!point) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath(); context.fill();
    }
    context.restore();
  }

  function drawObjects() {
    objects.forEach((object) => {
      if (object.type === 'echo') {
        const flicker = reducedMotion ? .34 : .2 + (Math.sin(elapsed * 8 + object.phase) + 1) * .13;
        drawObjectShape(object, flicker, -7);
        drawObjectShape(object, flicker + .12, 7);
        context.save();
        context.globalAlpha = .22;
        context.strokeStyle = '#fffaf1';
        context.setLineDash([3, 6]);
        context.beginPath(); context.arc(object.x, object.y, object.radius + 8, 0, Math.PI * 2); context.stroke();
        context.restore();
      } else {
        drawObjectShape(object, 1);
      }
    });
  }

  function drawPlayer() {
    const moving = Math.hypot(player.vx, player.vy);
    const bob = reducedMotion ? 0 : Math.sin(elapsed * 4.2) * 2;
    const squash = player.chomp > 0 ? 1 - Math.sin(player.chomp * Math.PI) * .14 : 1;
    const radius = player.radius;
    context.save();
    context.translate(player.x, player.y + bob);
    context.scale(player.facing, 1);
    context.scale(1 / squash, squash);

    context.save();
    context.globalAlpha = .16;
    context.fillStyle = '#171a2a';
    context.beginPath();
    context.ellipse(0, radius * .82, radius * .78, radius * .24, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

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
      context.beginPath(); context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); context.fill();
      context.restore();
    });
  }

  function draw() {
    context.save();
    context.scale(cssWidth / WORLD.width, cssHeight / WORLD.height);
    drawBackground(stages[stageIndex]);
    drawObjects();
    drawEffects();
    drawPlayer();
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
    buildStage(0);
    showOverlay(
      'FIRST DRAFT · WEEK 02',
      'Make some room to breathe.',
      'Move the little dream creature into the solid objects. Each one you swallow makes the world a little quieter.',
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
