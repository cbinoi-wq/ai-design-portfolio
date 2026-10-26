(() => {
  const demo = document.querySelector('#swallow-demo');
  const hole = document.querySelector('#demo-hole');
  const status = document.querySelector('#demo-status');
  const message = document.querySelector('#demo-message');
  const reset = document.querySelector('#demo-reset');
  const objects = [...document.querySelectorAll('.demo-object')];

  if (demo && hole && status && message && reset && objects.length) {
    let level = 1;
    let swallowed = 0;

    const updateStatus = () => {
      const noise = Math.max(12, 100 - swallowed * 11);
      status.textContent = 'NOISE ' + noise + '% · HOLE SIZE 0' + level;
      demo.style.setProperty('--calm', String(swallowed / 9));
      hole.style.setProperty('--hole-size', String(48 + level * 22) + 'px');
    };

    const resetDemo = () => {
      level = 1;
      swallowed = 0;
      objects.forEach((object) => object.classList.remove('is-swallowed', 'is-blocked'));
      hole.style.left = '50%';
      hole.style.top = '52%';
      message.textContent = 'Start with the smallest objects.';
      updateStatus();
    };

    objects.forEach((object) => {
      object.addEventListener('click', () => {
        const size = Number(object.dataset.size);
        hole.style.left = object.style.getPropertyValue('--x');
        hole.style.top = object.style.getPropertyValue('--y');

        if (size === 9) {
          object.classList.remove('is-blocked');
          void object.offsetWidth;
          object.classList.add('is-blocked');
          message.textContent = 'Keep one memory. Not everything needs to disappear.';
          return;
        }

        if (size > level) {
          object.classList.remove('is-blocked');
          void object.offsetWidth;
          object.classList.add('is-blocked');
          message.textContent = 'Still too large. Swallow something smaller first.';
          return;
        }

        if (object.classList.contains('is-swallowed')) return;
        object.classList.add('is-swallowed');
        swallowed += 1;
        if (swallowed >= 7) level = 3;
        else if (swallowed >= 3) level = 2;

        if (swallowed >= 8) {
          message.textContent = 'Quiet. The memory remains.';
          demo.classList.add('is-calm');
        } else if (level === 3) {
          message.textContent = 'The tower fits now.';
        } else if (level === 2) {
          message.textContent = 'You grew. Try a car, tree, or house.';
        } else {
          message.textContent = 'Soft pop. A little more room.';
        }
        updateStatus();
      });
    });

    reset.addEventListener('click', () => {
      demo.classList.remove('is-calm');
      resetDemo();
    });
    resetDemo();
  }

  const soundButton = document.querySelector('#sound-demo');
  if (soundButton) {
    soundButton.addEventListener('click', () => {
      if (soundButton.getAttribute('aria-pressed') === 'true') return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        soundButton.textContent = 'Sound is not supported here';
        return;
      }

      const context = new AudioContext();
      const now = context.currentTime;
      const master = context.createGain();
      const tone = context.createOscillator();
      const air = context.createOscillator();
      const filter = context.createBiquadFilter();
      tone.type = 'sine';
      air.type = 'triangle';
      tone.frequency.setValueAtTime(210, now);
      tone.frequency.exponentialRampToValueAtTime(72, now + 0.72);
      air.frequency.setValueAtTime(420, now);
      air.frequency.exponentialRampToValueAtTime(120, now + 0.58);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.78);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.07, now + 0.05);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.86);
      tone.connect(filter);
      air.connect(filter);
      filter.connect(master);
      master.connect(context.destination);
      tone.start(now);
      air.start(now);
      tone.stop(now + 0.9);
      air.stop(now + 0.9);

      soundButton.setAttribute('aria-pressed', 'true');
      soundButton.textContent = 'Listening…';
      window.setTimeout(() => {
        soundButton.setAttribute('aria-pressed', 'false');
        soundButton.innerHTML = 'Play the swallow sound <span aria-hidden="true">♪</span>';
        context.close();
      }, 1100);
    });
  }
})();
