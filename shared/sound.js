let ctx = null;
let enabled = false;
const listeners = new Set();
let sharedNoise = null;

function ac() {
  try {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") {
      const resumed = ctx.resume?.();
      resumed?.catch?.(() => {});
    }
    return ctx;
  } catch {
    return null;
  }
}

function blip({ freq = 440, freq2 = null, dur = 0.08, type = "square", gain = 0.05, delay = 0 }) {
  if (!enabled) return;
  try {
    const audio = ac();
    if (!audio) return;
  const t0 = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freq2 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(freq2, 1), t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    return;
  }
}

function noise({ dur = 0.16, gain = 0.05, delay = 0, hp = 600 }) {
  if (!enabled) return;
  try {
    const audio = ac();
    if (!audio) return;
    if (!sharedNoise || sharedNoise.sampleRate !== audio.sampleRate) {
      const frames = Math.min(8192, Math.floor(audio.sampleRate * 0.25));
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
    filter.type = "highpass";
    filter.frequency.value = hp;
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(amp).connect(audio.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  } catch {
    return;
  }
}

export const sfx = {
  click: () => blip({ freq: 520, freq2: 620, dur: 0.05, gain: 0.035 }),
  hover: () => blip({ freq: 380, dur: 0.03, gain: 0.018 }),
  build: () => {
    blip({ freq: 300, freq2: 600, dur: 0.1, type: "square", gain: 0.05 });
    blip({ freq: 600, freq2: 900, dur: 0.09, type: "triangle", gain: 0.035, delay: 0.07 });
  },
  deny: () => blip({ freq: 180, freq2: 90, dur: 0.14, type: "sawtooth", gain: 0.045 }),
  sol: () => blip({ freq: 660, freq2: 880, dur: 0.09, type: "triangle", gain: 0.045 }),
  good: () => {
    blip({ freq: 523, dur: 0.07, type: "triangle", gain: 0.045 });
    blip({ freq: 784, dur: 0.09, type: "triangle", gain: 0.045, delay: 0.07 });
  },
  bad: () => {
    blip({ freq: 220, freq2: 110, dur: 0.22, type: "sawtooth", gain: 0.05 });
    noise({ dur: 0.2, gain: 0.03, hp: 300 });
  },
  alarm: () => {
    blip({ freq: 880, dur: 0.09, type: "square", gain: 0.04 });
    blip({ freq: 660, dur: 0.09, type: "square", gain: 0.04, delay: 0.1 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      blip({ freq: f, dur: 0.16, type: "triangle", gain: 0.05, delay: i * 0.11 })
    );
  },
};

export function setSoundEnabled(value) {
  enabled = value === true;
  if (enabled) ac();
  listeners.forEach((fn) => {
    try {
      fn(enabled);
    } catch {
      return;
    }
  });
  return enabled;
}

export function isSoundEnabled() {
  return enabled;
}

export function onSoundStateChange(fn) {
  if (typeof fn === "function") listeners.add(fn);
  return () => listeners.delete(fn);
}
