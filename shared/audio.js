/**
 * SYS://TIMESINK.NET — Core Audio System
 * Oscillator-based SFX helpers, custom retro sound synthesizers,
 * and seamless integration with the global cabinet sound controls.
 */

import { sfx, isSoundEnabled, getVolume, onSoundStateChange } from "/shared/sound.js";

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
  // A hidden tab stops the game loop, so nothing would ever tell a running engine hum to stop.
  // Suspend the context while hidden, and cut the hum the moment SFX is switched off.
  document.addEventListener("visibilitychange", () => {
    if (!audioCtx) return;
    if (document.hidden) audioCtx.suspend().catch(() => {});
    else if (userInteracted) audioCtx.resume().catch(() => {});
  });
  onSoundStateChange((on) => {
    if (!on) setEngineHum(false);
  });
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

/** The shared AudioContext (null until the player has interacted with the page), for games that
 * build their own sound graphs on the same context the cabinet controls suspend and resume. */
export function getSharedAudioContext() {
  return getAudioContext();
}

// Audio must never be able to crash a game loop: every helper validates its inputs and swallows
// WebAudio errors. playTone also accepts the (freq, type, duration, gain) order used by some callers.
function finite(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function playTone(freq = 440, duration = 0.1, type = "square", gainVal = 0.2) {
  if (typeof duration === "string") [duration, type] = [type, duration];
  freq = Math.max(20, finite(freq, 440));
  duration = Math.max(0.01, finite(duration, 0.1));
  gainVal = Math.max(0, finite(gainVal, 0.2));
  if (!["sine", "square", "sawtooth", "triangle"].includes(type)) type = "square";
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
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
  } catch {
    /* audio is best-effort */
  }
}

export function playLaser({ startFreq, endFreq, duration = 0.14, type = "sawtooth", pitch } = {}) {
  // `pitch` is accepted as an alias for the start frequency (older call sites).
  startFreq = Math.max(20, finite(startFreq ?? pitch, 880));
  endFreq = Math.max(20, finite(endFreq ?? (pitch ? pitch * 0.5 : 120), 120));
  duration = Math.max(0.01, finite(duration, 0.14));
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
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
  } catch {
    /* audio is best-effort */
  }
}

export function playExplosion({ duration = 0.45, lowpass = 380 } = {}) {
  duration = Math.min(4, Math.max(0.02, finite(duration, 0.45)));
  lowpass = Math.max(40, finite(lowpass, 380));
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
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
  } catch {
    /* audio is best-effort */
  }
}

export function playCannon() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
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
  } catch {
    /* audio is best-effort */
  }

  playExplosion({ duration: 0.25, lowpass: 500 });
}

export function playHit({ pitch = 140, duration = 0.12 } = {}) {
  // (tolerates being called with no argument)
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
