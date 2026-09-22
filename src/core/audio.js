/**
 * SYS://TIMESINK.NET — Core Audio System
 * Oscillator-based SFX helpers, custom retro sound synthesizers,
 * and seamless integration with the global cabinet sound controls.
 */

import { sfx, isSoundEnabled, getVolume } from "/shared/sound.js";

let audioCtx = null;
let userInteracted = false;

if (typeof window !== "undefined") {
  const unlockAudio = () => {
    userInteracted = true;
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
}

function getAudioContext() {
  if (typeof window === "undefined" || !userInteracted) return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === "suspended" && userInteracted) {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTone(freq = 440, duration = 0.1, type = "square", gainVal = 0.2) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  const vol = gainVal * getVolume();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

export function playLaser({ startFreq = 880, endFreq = 120, duration = 0.14, type = "sawtooth" } = {}) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

  const vol = 0.25 * getVolume();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.linearRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

export function playExplosion({ duration = 0.45, lowpass = 380 } = {}) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(lowpass, now);
  filter.frequency.exponentialRampToValueAtTime(40, now + duration);

  const gain = ctx.createGain();
  const vol = 0.4 * getVolume();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

export function playCannon() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Low punch + noise transient
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

  const vol = 0.45 * getVolume();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.35);

  playExplosion({ duration: 0.25, lowpass: 500 });
}

export function playHit({ pitch = 140, duration = 0.12 } = {}) {
  playTone(pitch, duration, "triangle", 0.18);
}

export function playCoin() {
  sfx.coin();
}

export function playPowerup() {
  sfx.powerup();
}

export function playLockTone(isHigh = false) {
  playTone(isHigh ? 1200 : 440, 0.08, "sine", 0.18);
}

export function playWarningBeep() {
  playTone(880, 0.09, "square", 0.22);
}

let engineHumNode = null;
let engineGainNode = null;

export function setEngineHum(active, { throttle = 0.5, baseFreq = 55 } = {}) {
  if (!isSoundEnabled() || !active) {
    if (engineHumNode) {
      try {
        engineHumNode.stop();
        engineHumNode.disconnect();
      } catch {}
      engineHumNode = null;
      engineGainNode = null;
    }
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const targetFreq = baseFreq + throttle * 80;
  if (!engineHumNode) {
    engineHumNode = ctx.createOscillator();
    engineGainNode = ctx.createGain();
    engineHumNode.type = "sawtooth";
    engineHumNode.frequency.setValueAtTime(targetFreq, ctx.currentTime);

    engineGainNode.gain.setValueAtTime(0.05 * getVolume(), ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(180, ctx.currentTime);

    engineHumNode.connect(filter);
    filter.connect(engineGainNode);
    engineGainNode.connect(ctx.destination);

    engineHumNode.start();
  } else {
    engineHumNode.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
    engineGainNode.gain.setTargetAtTime(0.06 * getVolume(), ctx.currentTime, 0.05);
  }
}

export { sfx, isSoundEnabled };
