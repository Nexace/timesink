import { sfx, isSoundEnabled, getVolume, onSoundStateChange } from "../../../shared/sound.js";

// Small ambient layer: filtered-noise wind (louder outside and in storms), rover motor hum,
// plus one-shot synth blips for mining and alarms. Everything respects the cabinet's sound toggle.
let ctx = null;
let wind = null;
let hum = null;
let unlocked = false;

function ac() {
  if (!unlocked) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    unlocked = true;
    ac();
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
  // The wind and rover loops only fade when the sim updates them; a hidden tab or the SFX toggle
  // must silence them straight away.
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (unlocked) ctx.resume().catch(() => {});
  });
  onSoundStateChange((on) => {
    if (on || !ctx) return;
    for (const layer of [wind, hum]) if (layer) layer.gain.gain.setValueAtTime(0, ctx.currentTime);
  });
}

function noiseBuffer(c, secs = 2) {
  const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i += 1) {
    last = (last + (Math.random() * 2 - 1) * 0.08) * 0.985; // brown-ish
    d[i] = last * 3;
  }
  return b;
}

function ensureWind(c) {
  if (wind) return wind;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 3);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
  wind = { src, filter, gain };
  return wind;
}

function ensureHum(c) {
  if (hum) return hum;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 50;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 220;
  const gain = c.createGain();
  gain.gain.value = 0;
  osc.connect(filter).connect(gain).connect(c.destination);
  osc.start();
  hum = { osc, filter, gain };
  return hum;
}

// Called ~10×/s with the current scene.
export function updateAmbience({ outside, storm, roverSpeed, inRover, paused }) {
  const c = ac();
  if (!c) return;
  const on = isSoundEnabled() && !paused;
  if (!on && !wind) return; // don't spin up the loops until they'd actually be heard
  const vol = getVolume();
  const w = ensureWind(c);
  const target = on ? (storm ? 0.16 : outside ? 0.045 : 0.012) * vol : 0;
  w.gain.gain.setTargetAtTime(target, c.currentTime, 0.4);
  w.filter.frequency.setTargetAtTime(storm ? 900 : 380, c.currentTime, 0.6);
  const h = ensureHum(c);
  const ht = on && inRover ? (0.02 + Math.min(1, Math.abs(roverSpeed) / 7) * 0.05) * vol : 0;
  h.gain.gain.setTargetAtTime(ht, c.currentTime, 0.15);
  h.osc.frequency.setTargetAtTime(45 + Math.abs(roverSpeed) * 9, c.currentTime, 0.2);
}

export function blip(freq, dur = 0.05, type = "square", gain = 0.05, slide = 0) {
  const c = ac();
  if (!c || !isSoundEnabled()) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(gain * getVolume(), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function thud(dur = 0.4, lowpass = 300, gain = 0.25) {
  const c = ac();
  if (!c || !isSoundEnabled()) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(lowpass, t);
  f.frequency.exponentialRampToValueAtTime(40, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain * getVolume(), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}

export const sound = {
  drill: () => blip(140 + Math.random() * 60, 0.05, "square", 0.035),
  crack: () => {
    blip(90, 0.12, "triangle", 0.12, -40);
    thud(0.18, 900, 0.12);
  },
  dig: () => thud(0.12, 500, 0.12),
  pickup: () => blip(880, 0.05, "square", 0.03, 400),
  build: () => sfx.build(),
  deny: () => sfx.deny(),
  click: () => sfx.click(),
  good: () => sfx.good(),
  bad: () => sfx.bad(),
  alarm: () => sfx.alarm(),
  warn: () => sfx.warn(),
  win: () => sfx.win(),
  powerup: () => sfx.powerup(),
  impact: () => thud(0.7, 260, 0.45),
  explosion: () => thud(1.1, 500, 0.6),
  airlock: () => {
    thud(0.35, 1400, 0.08);
    blip(300, 0.2, "sine", 0.03, -200);
  },
  wipe: () => thud(0.2, 2400, 0.05),
  eat: () => blip(420, 0.06, "square", 0.03, -120),
  scan: () => {
    blip(600, 0.3, "sine", 0.05, 900);
    setTimeout(() => blip(1200, 0.25, "sine", 0.03, -600), 120);
  },
  objective: () => {
    blip(523, 0.1, "square", 0.05);
    setTimeout(() => blip(784, 0.18, "square", 0.05), 90);
  },
};
