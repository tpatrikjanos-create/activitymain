/* ===== ACTIVITY HANGRENDSZER =====
   Minden hang először MP3-ból próbál lejátszani (sounds/ mappa).
   Ha a fájl nincs ott, Web Audio API-val generálja a hangot.
   Hangerő a GM panelből állítható, és ki is kapcsolható.
*/

const SoundEngine = (() => {
  let ctx = null;
  let masterVolume = parseFloat(localStorage.getItem('act_volume') ?? '0.7');
  let enabled = localStorage.getItem('act_sound') !== 'false';

  const MP3 = {
    'card-draw':   'sounds/card-draw.mp3',
    'timer-start': 'sounds/timer-start.mp3',
    'tick':        'sounds/tick.mp3',
    'tick-fast':   'sounds/tick-fast.mp3',
    'beep':        'sounds/beep.mp3',
    'buzzer':      'sounds/buzzer.mp3',
    'btn-click':   'sounds/btn-click.mp3',
    'cat-select':  'sounds/cat-select.mp3',
    'menu-open':   'sounds/menu-open.mp3',
  };

  const audioCache = {};
  const mp3Available = {};

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // MP3 elérhetőség előellenőrzése
  async function checkMP3s() {
    for (const [key, path] of Object.entries(MP3)) {
      try {
        const r = await fetch(path, { method: 'HEAD' });
        mp3Available[key] = r.ok;
      } catch { mp3Available[key] = false; }
    }
  }
  checkMP3s();

  async function playMP3(key) {
    if (!mp3Available[key]) return false;
    try {
      if (!audioCache[key]) {
        const audio = new Audio(MP3[key]);
        audioCache[key] = audio;
      }
      const a = audioCache[key].cloneNode();
      a.volume = masterVolume;
      await a.play();
      return true;
    } catch { return false; }
  }

  // ===== WEB AUDIO HANGOK =====

  function makeGain(vol = 1) {
    const g = getCtx().createGain();
    g.gain.value = masterVolume * vol;
    g.connect(getCtx().destination);
    return g;
  }

  function osc(freq, type, start, dur, gainVal, rampDown = true) {
    const c = getCtx();
    const o = c.createOscillator();
    const g = makeGain(gainVal);
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (rampDown) g.gain.setTargetAtTime(0, start + dur * 0.6, dur * 0.15);
    o.connect(g);
    o.start(start);
    o.stop(start + dur);
  }

  function noise(dur, gainVal) {
    const c = getCtx();
    const bufLen = c.sampleRate * dur;
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;
    const g = makeGain(gainVal);
    g.gain.setTargetAtTime(0, c.currentTime + dur * 0.3, dur * 0.2);
    src.connect(filter);
    filter.connect(g);
    src.start();
    src.stop(c.currentTime + dur);
  }

  const SYNTH = {
    'card-draw'() {
      const c = getCtx(), t = c.currentTime;
      // Papírsuhogás + felfelé glide
      noise(0.12, 0.3);
      osc(200, 'sine', t, 0.12, 0.15);
      osc(400, 'sine', t + 0.04, 0.1, 0.12);
      const o = c.createOscillator();
      const g = makeGain(0.2);
      o.type = 'sine';
      o.frequency.setValueAtTime(300, t + 0.05);
      o.frequency.linearRampToValueAtTime(600, t + 0.18);
      g.gain.setTargetAtTime(0, t + 0.1, 0.05);
      o.connect(g); o.start(t + 0.05); o.stop(t + 0.25);
    },
    'timer-start'() {
      const c = getCtx(), t = c.currentTime;
      // Felfelé skálázó fanfár
      [0, 0.1, 0.2, 0.32].forEach((delay, i) => {
        const freqs = [440, 550, 660, 880];
        osc(freqs[i], 'square', t + delay, 0.18, 0.18 - i * 0.02);
      });
      osc(880, 'sine', t + 0.32, 0.35, 0.25);
    },
    'tick'() {
      const c = getCtx(), t = c.currentTime;
      osc(1200, 'square', t, 0.04, 0.12);
    },
    'tick-fast'() {
      const c = getCtx(), t = c.currentTime;
      osc(1400, 'square', t, 0.04, 0.2);
      osc(700, 'sine', t, 0.03, 0.1);
    },
    'beep'() {
      const c = getCtx(), t = c.currentTime;
      osc(880, 'sine', t, 0.15, 0.35);
      osc(880, 'sine', t, 0.12, 0.2);
    },
    'buzzer'() {
      const c = getCtx(), t = c.currentTime;
      // Mély, hosszú buzzer
      const o = c.createOscillator();
      const o2 = c.createOscillator();
      const g = makeGain(0.4);
      o.type = 'sawtooth'; o.frequency.value = 120;
      o2.type = 'square'; o2.frequency.value = 118;
      g.gain.setValueAtTime(masterVolume * 0.4, t);
      g.gain.setTargetAtTime(0, t + 0.7, 0.2);
      o.connect(g); o2.connect(g);
      o.start(t); o.stop(t + 1.2);
      o2.start(t); o2.stop(t + 1.2);
      // Másodszor is megüti
      setTimeout(() => {
        const o3 = c.createOscillator();
        const g2 = makeGain(0.3);
        o3.type = 'sawtooth'; o3.frequency.value = 100;
        g2.gain.setTargetAtTime(0, c.currentTime + 0.5, 0.15);
        o3.connect(g2); o3.start(); o3.stop(c.currentTime + 0.8);
      }, 400);
    },
    'btn-click'() {
      const c = getCtx(), t = c.currentTime;
      osc(800, 'sine', t, 0.05, 0.15);
    },
    'cat-select'() {
      const c = getCtx(), t = c.currentTime;
      osc(660, 'sine', t, 0.07, 0.18);
      osc(880, 'sine', t + 0.06, 0.07, 0.14);
    },
    'menu-open'() {
      const c = getCtx(), t = c.currentTime;
      osc(440, 'sine', t, 0.08, 0.12);
      osc(550, 'sine', t + 0.07, 0.08, 0.1);
    }
  };

  async function play(key) {
    if (!enabled) return;
    try {
      const mp3ok = await playMP3(key);
      if (!mp3ok && SYNTH[key]) SYNTH[key]();
    } catch(e) {
      try { if (SYNTH[key]) SYNTH[key](); } catch {}
    }
  }

  function setVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('act_volume', masterVolume);
  }
  function setEnabled(v) {
    enabled = v;
    localStorage.setItem('act_sound', v ? 'true' : 'false');
  }
  function getVolume() { return masterVolume; }
  function isEnabled() { return enabled; }

  return { play, setVolume, setEnabled, getVolume, isEnabled };
})();
