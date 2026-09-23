/**
 * SYS://TIMESINK.NET — Vintage Synthesizer & Audio Engine
 * Web Audio API retro sound synthesis with multi-oscillator pulse-width modulation,
 * mechanical microswitch transients, chiptune arpeggios, and CRT speaker acoustic modeling.
 */

let ctx = null;
let master = null;
let compressor = null;
let crtFilter = null;
let enabled = true;
let volume = 1;
const listeners = new Set();
let sharedNoise = null;
const pulseWaveCache = new Map();

let userUnlocked = false;
if (typeof window !== "undefined") {
  const unlock = () => {
    userUnlocked = true;
    if (ctx && ctx.state === "suspended") {
      ctx.resume?.().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
}

/**
 * Return or create the shared AudioContext with master dynamics processing
 */
function ac() {
  try {
    if (typeof window === "undefined" || !userUnlocked) return null;
    if (!ctx) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended" && userUnlocked) {
      ctx.resume?.().catch(() => {});
    }
    if (!master) {
      // 1. Dynamics compressor for punchy retro cabinet presence & zero distortion
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.knee.setValueAtTime(8, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.15, ctx.currentTime);

      // 2. Vintage CRT speaker low-pass filter (gentle roll-off above 11 kHz)
      crtFilter = ctx.createBiquadFilter();
      crtFilter.type = "lowpass";
      crtFilter.frequency.setValueAtTime(11500, ctx.currentTime);
      crtFilter.Q.setValueAtTime(0.707, ctx.currentTime);

      // 3. Master volume gain
      master = ctx.createGain();
      master.gain.value = volume;

      // Routing: Sound Nodes -> Master -> CRT Filter -> Compressor -> Destination
      master.connect(crtFilter);
      crtFilter.connect(compressor);
      compressor.connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

// Auto-unlock Web Audio on the very first user interaction
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    const audio = ac();
    if (audio && audio.state === "suspended") {
      audio.resume().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };
  window.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
  window.addEventListener("keydown", unlockAudio, { once: true, passive: true });
  window.addEventListener("touchstart", unlockAudio, { once: true, passive: true });
}

/**
 * Generate a vintage pulse wave with custom duty cycle (e.g. 12.5%, 25%, 50%)
 * Emulates the Ricoh 2A03 / Yamaha YM2149 sound chips.
 */
function getPulseWave(audio, duty = 0.25) {
  const key = Math.round(duty * 100);
  if (pulseWaveCache.has(key)) return pulseWaveCache.get(key);
  try {
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    }
    const wave = audio.createPeriodicWave(real, imag);
    pulseWaveCache.set(key, wave);
    return wave;
  } catch {
    return null;
  }
}

/**
 * Synthesize a vintage pulse wave note
 */
function pulse({
  freq = 440,
  freq2 = null,
  dur = 0.1,
  duty = 0.25,
  gain = 0.05,
  delay = 0,
  vibrato = false,
  detune = 0,
}) {
  if (!enabled) return;
  try {
    const audio = ac();
    if (!audio) return;
    const t0 = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const amp = audio.createGain();

    const wave = getPulseWave(audio, duty);
    if (wave) osc.setPeriodicWave(wave);
    else osc.type = "square";

    osc.frequency.setValueAtTime(Math.max(freq, 1), t0);
    if (freq2 !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freq2, 1), t0 + dur);
    }
    if (detune !== 0) {
      osc.detune.setValueAtTime(detune, t0);
    }

    // Optional subtle chiptune vibrato
    if (vibrato) {
      const lfo = audio.createOscillator();
      const lfoGain = audio.createGain();
      lfo.frequency.setValueAtTime(24, t0);
      lfoGain.gain.setValueAtTime(14, t0);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.02);
    }

    // Snappy envelope with short attack
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(amp).connect(master ?? audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    return;
  }
}

/**
 * Multi-waveform synthesizer (sine, triangle, sawtooth, square)
 */
function blip({
  freq = 440,
  freq2 = null,
  dur = 0.08,
  type = "square",
  gain = 0.05,
  delay = 0,
  attack = 0.006,
  detune = 0,
}) {
  if (!enabled) return;
  try {
    const audio = ac();
    if (!audio) return;
    const t0 = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const amp = audio.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(freq, 1), t0);
    if (freq2 !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freq2, 1), t0 + dur);
    }
    if (detune !== 0) {
      osc.detune.setValueAtTime(detune, t0);
    }

    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(amp).connect(master ?? audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    return;
  }
}

/**
 * Filtered noise burst for percussive hits, mechanical snaps, and explosions
 */
function noise({
  dur = 0.16,
  gain = 0.05,
  delay = 0,
  hp = 600,
  lp = null,
  bp = null,
  q = 1,
}) {
  if (!enabled) return;
  try {
    const audio = ac();
    if (!audio) return;
    if (!sharedNoise || sharedNoise.sampleRate !== audio.sampleRate) {
      const frames = Math.min(16384, Math.floor(audio.sampleRate * 0.35));
      sharedNoise = audio.createBuffer(1, frames, audio.sampleRate);
      const seed = sharedNoise.getChannelData(0);
      for (let i = 0; i < frames; i += 1) seed[i] = Math.random() * 2 - 1;
    }
    const t0 = audio.currentTime + delay;
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const amp = audio.createGain();

    src.buffer = sharedNoise;
    src.loop = true;

    if (bp !== null) {
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(bp, t0);
      filter.Q.setValueAtTime(q, t0);
    } else if (lp !== null) {
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(lp, t0);
      filter.Q.setValueAtTime(q, t0);
    } else {
      filter.type = "highpass";
      filter.frequency.setValueAtTime(hp, t0);
      filter.Q.setValueAtTime(q, t0);
    }

    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(amp).connect(master ?? audio.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  } catch {
    return;
  }
}

/**
 * Mechanical microswitch click (Cherry/Omron tactile snap + plastic chassis resonance)
 */
function mechanicalClick({ pitch = 1, gain = 0.06, delay = 0 } = {}) {
  // 1. High transient burst (switch contact snap)
  noise({ dur: 0.008, gain: gain * 0.8, delay, bp: 3800 * pitch, q: 2.2 });
  // 2. Low resonant pop (chassis body)
  blip({
    freq: 260 * pitch,
    freq2: 60 * pitch,
    dur: 0.022,
    type: "triangle",
    gain: gain * 0.7,
    delay,
    attack: 0.002,
  });
}

/**
 * Public Sound Effects Suite
 */
export const sfx = {
  /**
   * Tactile mechanical arcade button click
   */
  click: () => mechanicalClick({ pitch: 1.0, gain: 0.065 }),

  /**
   * Subtle high-frequency CRT cursor pip for hover states
   */
  hover: () => {
    blip({
      freq: 1800,
      freq2: 2400,
      dur: 0.016,
      type: "sine",
      gain: 0.014,
      attack: 0.002,
    });
  },

  /**
   * Iconic arcade coin drop / cartridge insertion launch chime
   * Dual-tone arpeggio: B5 (987.77 Hz) -> E6 (1318.51 Hz) with shimmering vibrato
   */
  coin: () => {
    pulse({ freq: 987.77, dur: 0.08, duty: 0.5, gain: 0.06 });
    pulse({ freq: 1318.51, dur: 0.28, duty: 0.25, gain: 0.075, delay: 0.07, vibrato: true });
    blip({ freq: 1318.51, dur: 0.32, type: "triangle", gain: 0.035, delay: 0.07 });
  },

  /**
   * Alias for game cartridge launch
   */
  launch: () => sfx.coin(),

  /**
   * Affirmative / Power-Up Chime: Sparkling melodic interval (G5 -> C6)
   */
  good: () => {
    blip({ freq: 783.99, freq2: 820, dur: 0.06, type: "sine", gain: 0.04 });
    pulse({ freq: 1046.5, dur: 0.16, duty: 0.25, gain: 0.06, delay: 0.05 });
    blip({ freq: 1046.5, dur: 0.18, type: "triangle", gain: 0.03, delay: 0.05 });
  },

  /**
   * Glitch / Failure: Detuned dissonant descending crunch
   */
  bad: () => {
    pulse({ freq: 240, freq2: 75, dur: 0.22, duty: 0.125, gain: 0.065 });
    blip({ freq: 248, freq2: 70, dur: 0.22, type: "sawtooth", gain: 0.05 });
    noise({ dur: 0.18, gain: 0.035, hp: 220 });
  },

  /**
   * Access Denied / Locked: Two punchy warning thuds
   */
  deny: () => {
    blip({ freq: 180, freq2: 110, dur: 0.08, type: "square", gain: 0.055 });
    blip({ freq: 150, freq2: 90, dur: 0.09, type: "square", gain: 0.055, delay: 0.09 });
  },

  /**
   * Error: Low retro buzzer buzz
   */
  error: () => {
    pulse({ freq: 160, dur: 0.18, duty: 0.125, gain: 0.06 });
    blip({ freq: 240, dur: 0.18, type: "sawtooth", gain: 0.045 });
  },

  /**
   * Sol Advance (Mars Base): Sci-fi planetary sub-bass bloom + telemetry ping
   */
  sol: () => {
    blip({ freq: 140, freq2: 60, dur: 0.35, type: "sine", gain: 0.065 });
    pulse({ freq: 880, freq2: 1320, dur: 0.09, duty: 0.25, gain: 0.045, delay: 0.03 });
  },

  /**
   * Construction / Upgrade: Ratchet mechanical clicks + ascending confirmation
   */
  build: () => {
    for (let i = 0; i < 3; i++) {
      mechanicalClick({ pitch: 0.9 + i * 0.18, gain: 0.045, delay: i * 0.035 });
    }
    pulse({ freq: 587.33, freq2: 880, dur: 0.14, duty: 0.25, gain: 0.055, delay: 0.13 });
    blip({ freq: 880, dur: 0.16, type: "triangle", gain: 0.035, delay: 0.15 });
  },

  /**
   * Red Alert / Klaxon Alarm: Alternating two-tone emergency sirens
   */
  alarm: () => {
    for (let i = 0; i < 3; i++) {
      blip({ freq: 880, freq2: 960, dur: 0.08, type: "square", gain: 0.045, delay: i * 0.18 });
      blip({ freq: 660, freq2: 580, dur: 0.08, type: "square", gain: 0.045, delay: i * 0.18 + 0.09 });
    }
  },

  /**
   * Warning Staccato Beep
   */
  warn: () => {
    blip({ freq: 660, freq2: 440, dur: 0.1, type: "square", gain: 0.05 });
  },

  /**
   * Impact / Hit thud
   */
  hit: () => {
    blip({ freq: 180, freq2: 60, dur: 0.1, type: "triangle", gain: 0.06 });
  },

  /**
   * Powerup affirmation
   */
  powerup: () => {
    sfx.good();
  },

  /**
   * Triumphant Victory Fanfare: Sparkling chiptune arpeggio into rich major power chord
   */
  win: () => {
    // 6-step arpeggio: C5, E5, G5, C6, E6, G6
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    arp.forEach((f, i) => {
      pulse({ freq: f, dur: 0.08, duty: 0.25, gain: 0.05, delay: i * 0.055 });
    });
    // Sustained celebratory major chord with shimmering vibrato
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f) => {
      pulse({ freq: f, dur: 0.48, duty: 0.5, gain: 0.04, delay: 0.38, vibrato: true });
      blip({ freq: f, dur: 0.52, type: "triangle", gain: 0.03, delay: 0.38 });
    });
  },

  /**
   * Engine Throttle (Redlight / Ghost Lap): Multi-harmonic top-fuel rumble
   */
  rev: () => {
    blip({ freq: 55, freq2: 190, dur: 0.28, type: "sawtooth", gain: 0.075 });
    blip({ freq: 110, freq2: 380, dur: 0.28, type: "sawtooth", gain: 0.06 });
    noise({ dur: 0.16, gain: 0.035, delay: 0.08, hp: 450 });
  },

  /**
   * Dragstrip Penalty Horn (Redlight foul): Harsh, unyielding 85Hz + 128Hz horn
   */
  buzzer: () => {
    blip({ freq: 85, dur: 0.42, type: "square", gain: 0.075 });
    blip({ freq: 128, dur: 0.42, type: "sawtooth", gain: 0.065 });
  },

  /**
   * Christmas Tree Staging Amber (Redlight): Clean electronic 1000Hz pip
   */
  treeAmber: () => {
    blip({ freq: 1000, dur: 0.065, type: "sine", gain: 0.055 });
    pulse({ freq: 1000, dur: 0.065, duty: 0.5, gain: 0.035 });
  },

  /**
   * Christmas Tree Launch Green (Redlight): Bright 1760Hz launch chirp
   */
  treeGreen: () => {
    pulse({ freq: 1760, dur: 0.22, duty: 0.25, gain: 0.075 });
    blip({ freq: 1760, dur: 0.24, type: "sine", gain: 0.05 });
  },

  /**
   * Vintage mechanical keyboard key clack with randomized pitch
   */
  type: () => {
    const r = 0.92 + Math.random() * 0.16;
    noise({ dur: 0.007, gain: 0.032, bp: 2600 * r, q: 2.0 });
    blip({ freq: 360 * r, freq2: 120 * r, dur: 0.016, type: "triangle", gain: 0.03 });
  },

  /**
   * Logarithmic scale warp / zoom sweep
   */
  warp: (up = true) => {
    const f1 = up ? 150 : 800;
    const f2 = up ? 800 : 150;
    blip({ freq: f1, freq2: f2, dur: 0.15, type: "sine", gain: 0.05 });
    pulse({ freq: f1, freq2: f2, dur: 0.14, duty: 0.25, gain: 0.035 });
  },

  /** Big victory beat (boss down, island taken) — the win arpeggio. */
  fanfare: () => sfx.win(),

  /** Soft two-step chirp for page navigation (scroll cues, section jumps). */
  nav: () => {
    blip({ freq: 660, dur: 0.05, type: "square", gain: 0.03 });
    blip({ freq: 990, dur: 0.07, type: "square", gain: 0.03, delay: 0.05 });
  },

  /**
   * Heavy rubber stamp thud (The Resume Game)
   */
  stamp: () => {
    blip({ freq: 220, freq2: 45, dur: 0.08, type: "triangle", gain: 0.08 });
    noise({ dur: 0.06, gain: 0.05, lp: 800 });
  },

  /**
   * 90s modem handshake burst (Ping Age)
   */
  dialup: () => {
    blip({ freq: 1209, dur: 0.06, type: "sine", gain: 0.04 });
    blip({ freq: 697, dur: 0.06, type: "sine", gain: 0.04 });
    blip({ freq: 1336, dur: 0.08, type: "sine", gain: 0.04, delay: 0.07 });
    blip({ freq: 770, dur: 0.08, type: "sine", gain: 0.04, delay: 0.07 });
    noise({ dur: 0.12, gain: 0.025, delay: 0.16, hp: 1200 });
  },

  /**
   * Sci-fi laser shot
   */
  laser: () => {
    pulse({ freq: 1400, freq2: 120, dur: 0.12, duty: 0.25, gain: 0.06 });
  },

  /**
   * High-friction tire screech and brake pad bite (Ghost Lap)
   */
  brake: () => {
    noise({ dur: 0.18, gain: 0.042, bp: 2100, q: 4.0 });
    blip({ freq: 780, freq2: 380, dur: 0.16, type: "sawtooth", gain: 0.032 });
  },
};

/**
 * Set master volume (0 to 1)
 */
export function setVolume(value) {
  const v = Math.min(1, Math.max(0, Number(value)));
  volume = Number.isFinite(v) ? v : 1;
  if (master && ctx) {
    try {
      master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
    } catch {
      return volume;
    }
  }
  return volume;
}

/**
 * Get current volume
 */
export function getVolume() {
  return volume;
}

/**
 * Enable or disable sound effects
 */
export function setSoundEnabled(value) {
  enabled = value === true;
  if (enabled) {
    ac(); // ensure context is created and resumed
  }
  listeners.forEach((fn) => {
    try {
      fn(enabled);
    } catch {
      return;
    }
  });
  return enabled;
}

/**
 * Check if sound is enabled
 */
export function isSoundEnabled() {
  return enabled;
}

/**
 * Subscribe to sound state changes
 */
export function onSoundStateChange(fn) {
  if (typeof fn === "function") listeners.add(fn);
  return () => listeners.delete(fn);
}
