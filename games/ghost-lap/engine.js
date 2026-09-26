// Ghost Lap engine sound: a 2006-2013 Formula 1 V8 (idle ~4,200 rpm, limiter 18,000), built on a real
// recording and tuned against a 2013 onboard. Three layers per car:
//  • the engine itself: a seamless loop cut from a real F1 V8 held at a steady ~14,860 rpm ("F1 BR 06
//    Engine Starts" by rfhache, freesound.org/s/44771, CC BY 4.0; looped and processed), played faster
//    or slower to match the revs
//  • the scream: the engine orders a trackside recording loses with distance, their strengths measured
//    from a 2013 onboard flat out (and lifting, where the upper orders fall away)
//  • the rasp: exhaust and air noise in the 2-6 kHz band, opening up with the throttle
// plus a cut on every upshift, pops and crackle on the overrun and the rev limiter. The player's car and
// the nearest rival (panned left/right and Doppler-shifted as it passes).
import { isSoundEnabled, getVolume, onSoundStateChange } from "/shared/sound.js";
import { getSharedAudioContext } from "/shared/audio.js";
import { V8, engineGear, engineRpm } from "./race.js";

const LOOP_URL = new URL("./audio/v8-loop.wav", import.meta.url).href;
const LOOP_RPM = 14858; // the recording's steady revs (its loudest note, rpm/30, is 495.3 Hz)
const SOUND_SPEED = 1530; // px/s (343 m/s at the game's scale), for the Doppler shift

// Engine orders 1-32 (multiples of rpm/60), dB relative to the loudest, measured from the onboard
const ORDERS_ON = [-22.7, 0, -26.1, -2.7, -11.3, -10.7, -16.8, -17.2, -22.1, -17.6, -17.1, -13.9, -19.3, -21.5, -14.9, -19.8, -16.7, -17.2, -25.3, -25.4, -24.4, -25.2, -27.5, -27.4, -28.9, -29.4, -32.5, -32.5, -30.6, -30.1, -33.4, -33.2];
const ORDERS_OFF = [-24.4, 0, -33.2, -15.3, -29.2, -18.7, -28.8, -19, -26.3, -28.5, -31.5, -32.8, -33.4, -33.7, -36.4, -35, -37.7, -37, -35.2, -34.6, -29.1, -37, -37.9, -34.4, -35.8, -34.3, -34.9, -34.2, -38.4, -34.1, -39.5, -34.1];

// Layer balance, fitted so the mix's spectrum matches the onboard's: within ~3 dB on average per
// sixth-octave band from 150 Hz to 10 kHz, flat out and lifting
export const MIX = {
  sample: 1, // the recorded engine
  sampleShelfDb: 18, // high shelf on the recording (made from the grandstand, it has lost its top end)
  harmonics: 0.515, // the measured scream
  fundDb: -6, // its main note (order 2) relative to the measured profile: the recording already carries it
  noise: 1.19, // rasp
  noiseHz: 5250,
  lowpassOn: 7500, // tone on and off the throttle
  lowpassOff: 6000,
  // Aggression, on top of the fitted balance
  drive: 3.2, // saturation of the whole engine (a hard-worked exhaust)
  presenceDb: 5, // bite around 1.8 kHz, where the scream cuts through
  pulse: 0.9, // the rasp fires in pulses at the firing rate (0 = steady hiss)
  shiftCut: 0.12, // how far the sound drops in the upshift torque cut
  crackle: 16, // overrun pops per second (at most)
  popLevel: 7
};

function orderWave(ctx, db, fundDb = 0) {
  const real = new Float32Array(db.length + 1);
  const imag = new Float32Array(db.length + 1);
  db.forEach((v, k) => (imag[k + 1] = Math.pow(10, (v + (k === 1 ? fundDb : 0)) / 20)));
  // (not normalised: the layer's level is set by the mix, the same whatever the profile)
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
}

// Soft-clipping curve for the drive stage (tanh, levels kept comparable)
function driveCurve(amount) {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return c;
}

let noiseBuffer = null;
function noiseSource(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

/**
 * One engine voice into `out`. `loop` is the decoded recording (AudioBuffer). Returns
 * { set({ rpm, throttle, gear, level, panTo, pitch }, dt), stop() }.
 */
export function createVoice(ctx, out, loop, mix = MIX) {
  const t0 = ctx.currentTime;
  // The recorded engine
  const rec = ctx.createBufferSource();
  rec.buffer = loop;
  rec.loop = true;
  const recShelf = ctx.createBiquadFilter();
  recShelf.type = "highshelf";
  recShelf.frequency.value = 1200;
  recShelf.gain.value = mix.sampleShelfDb;
  const recGain = ctx.createGain();
  recGain.gain.value = mix.sample;
  // The scream: on- and off-throttle order profiles, crossfaded by the throttle
  const on = ctx.createOscillator();
  on.setPeriodicWave(orderWave(ctx, ORDERS_ON, mix.fundDb));
  const off = ctx.createOscillator();
  off.setPeriodicWave(orderWave(ctx, ORDERS_OFF, mix.fundDb));
  const onGain = ctx.createGain();
  const offGain = ctx.createGain();
  onGain.gain.value = 0;
  offGain.gain.value = 0;
  // The rasp
  const hiss = noiseSource(ctx);
  const hissBand = ctx.createBiquadFilter();
  hissBand.type = "bandpass";
  hissBand.frequency.value = mix.noiseHz;
  hissBand.Q.value = 0.6;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0;
  // Overrun pops
  const pops = noiseSource(ctx);
  const popBand = ctx.createBiquadFilter();
  popBand.type = "highpass";
  popBand.frequency.value = 900;
  const popGain = ctx.createGain();
  popGain.gain.value = 0;

  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.Q.value = 0.7;
  tone.frequency.value = mix.lowpassOn;
  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 1800;
  presence.Q.value = 0.9;
  presence.gain.value = mix.presenceDb;
  const drive = ctx.createWaveShaper();
  drive.curve = driveCurve(mix.drive);
  drive.oversample = "2x";
  // Combustion pulses: an oscillator at the firing rate swings the rasp's level
  const pulse = ctx.createOscillator();
  pulse.type = "sawtooth";
  const pulseDepth = ctx.createGain();
  pulseDepth.gain.value = 0;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

  rec.connect(recShelf).connect(recGain).connect(tone);
  on.connect(onGain).connect(tone);
  off.connect(offGain).connect(tone);
  hiss.connect(hissBand).connect(hissGain).connect(tone);
  tone.connect(presence).connect(drive).connect(gain);
  pulse.connect(pulseDepth).connect(hissGain.gain);
  pops.connect(popBand).connect(popGain).connect(gain);
  if (pan) gain.connect(pan).connect(out);
  else gain.connect(out);
  rec.start(t0, Math.random() * loop.duration);
  on.start(t0);
  pulse.start(t0);
  off.start(t0);
  hiss.start(t0);
  pops.start(t0, Math.random());

  let lastGear = null;
  let limiterPhase = 0;
  let thrSmooth = 0;
  return {
    set({ rpm, throttle, gear, level, panTo = 0, pitch = 1 }, dt) {
      const t = ctx.currentTime;
      const onThrottle = throttle > 0.05;
      thrSmooth += ((onThrottle ? 1 : 0) - thrSmooth) * Math.min(1, dt * 10);
      // Rev limiter: the ignition cuts in and out off 18,000
      let cut = 1;
      let r = rpm;
      if (rpm >= V8.limiter - 60 && onThrottle) {
        limiterPhase = (limiterPhase + dt * 22) % 1;
        cut = limiterPhase < 0.5 ? 1 : 0.2;
        r = limiterPhase < 0.5 ? rpm : rpm * 0.97;
      }
      const rate = (r / LOOP_RPM) * pitch;
      const f1 = (r / 60) * pitch; // engine order 1
      const upshift = lastGear != null && gear > lastGear && gear > 1;
      lastGear = gear;
      if (upshift) {
        // The revs drop at once, with a split-second torque cut
        for (const p of [rec.playbackRate, on.frequency, off.frequency]) p.cancelScheduledValues(t);
        rec.playbackRate.setValueAtTime(rate, t);
        on.frequency.setValueAtTime(f1, t);
        pulse.frequency.setValueAtTime(f1 * 4, t);
        off.frequency.setValueAtTime(f1, t);
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value * mix.shiftCut, t);
        // the crack of the shift
        popGain.gain.cancelScheduledValues(t);
        popGain.gain.setValueAtTime(level * mix.popLevel * 0.6, t);
        popGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        gain.gain.linearRampToValueAtTime(level * cut, t + 0.07);
      } else {
        rec.playbackRate.setTargetAtTime(rate, t, 0.02);
        on.frequency.setTargetAtTime(f1, t, 0.02);
        pulse.frequency.setTargetAtTime(f1 * 4, t, 0.02);
        off.frequency.setTargetAtTime(f1, t, 0.02);
        gain.gain.setTargetAtTime(level * cut, t, 0.03);
      }
      const load = thrSmooth * (0.4 + 0.6 * Math.max(0, Math.min(1, throttle)));
      onGain.gain.setTargetAtTime(mix.harmonics * load, t, 0.04);
      offGain.gain.setTargetAtTime(mix.harmonics * 0.8 * (1 - thrSmooth), t, 0.04);
      hissGain.gain.setTargetAtTime(mix.noise * (0.15 + 0.85 * load), t, 0.04);
      pulseDepth.gain.setTargetAtTime(mix.noise * mix.pulse * (0.15 + 0.85 * load), t, 0.04);
      recGain.gain.setTargetAtTime(mix.sample * (0.55 + 0.45 * load), t, 0.04);
      tone.frequency.setTargetAtTime(mix.lowpassOff + (mix.lowpassOn - mix.lowpassOff) * thrSmooth, t, 0.05);
      // Overrun: off the throttle at high revs the exhaust pops and crackles
      if (!onThrottle && rpm > 8000 && Math.random() < dt * mix.crackle) {
        const p = 0.25 + Math.random() * 0.45;
        popGain.gain.cancelScheduledValues(t);
        popGain.gain.setValueAtTime(p * level * mix.popLevel, t);
        popGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
      }
      if (pan) pan.pan.setTargetAtTime(panTo, t, 0.05);
    },
    stop() {
      try {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        const at = ctx.currentTime + 0.2;
        for (const s of [rec, on, off, hiss, pops, pulse]) s.stop(at);
        setTimeout(() => gain.disconnect(), 300);
      } catch {}
    }
  };
}

// The recording, decoded once per audio context
let loopPromise = null;
let loopBuffer = null;
function loadLoop(ctx) {
  if (!loopPromise) {
    loopPromise = fetch(LOOP_URL)
      .then((r) => r.arrayBuffer())
      .then((b) => new Promise((ok, fail) => ctx.decodeAudioData(b, ok, fail)))
      .then((buf) => (loopBuffer = buf))
      .catch(() => {
        loopPromise = null; // try again next time
      });
  }
  return loopBuffer;
}

let engine = null;
function build(ctx, loop) {
  const master = ctx.createGain();
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -12;
  limit.ratio.value = 6;
  master.connect(limit).connect(ctx.destination);
  return { master, me: createVoice(ctx, master, loop), rival: createVoice(ctx, master, loop) };
}

/** Silence and tear down the engines (race over, paused, menu, SFX switched off). */
export function stopEngines() {
  if (!engine) return;
  engine.me.stop();
  engine.rival.stop();
  const m = engine.master;
  setTimeout(() => m.disconnect(), 300);
  engine = null;
}
onSoundStateChange((on) => {
  if (!on) stopEngines();
});

/**
 * Update the engine sounds for a frame: `me` (the player's car) and the nearest other car within
 * earshot. `listener` is the camera ({ x, y, angle }).
 */
export function updateEngines(race, me, listener, dt) {
  if (!isSoundEnabled() || !me) return stopEngines();
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const loop = loadLoop(ctx);
  if (!loop) return; // still loading
  if (!engine) engine = build(ctx, loop);
  engine.master.gain.setTargetAtTime(0.9 * getVolume(), ctx.currentTime, 0.05);

  const rev = (c) => {
    const thr = c.throttle ?? 0;
    return { rpm: engineRpm(c.fwd, thr), throttle: thr, gear: engineGear(c.fwd) };
  };
  engine.me.set({ ...rev(me), level: 0.125 + 0.09 * (me.throttle ?? 0) }, dt);

  let best = null;
  let bestD = 1500;
  for (const c of race.cars) {
    if (c === me) continue;
    const d = Math.hypot(c.x - listener.x, c.y - listener.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) {
    engine.rival.set({ rpm: V8.idle, throttle: 0, gear: 0, level: 0 }, dt);
    return;
  }
  const dx = best.x - listener.x;
  const dy = best.y - listener.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  // Closing speed toward the listener (the camera moves with the player's car)
  const toward = -((best.vx - me.vx) * dx + (best.vy - me.vy) * dy) / d;
  const pitch = Math.max(0.8, Math.min(1.25, SOUND_SPEED / (SOUND_SPEED - Math.max(-600, Math.min(600, toward)))));
  const a = listener.angle || 0;
  const screenX = dx * Math.cos(a) + dy * Math.sin(a);
  const near = Math.max(0, 1 - d / 1500) ** 2;
  engine.rival.set({ ...rev(best), level: 0.14 * near, panTo: Math.max(-0.8, Math.min(0.8, screenX / 500)), pitch }, dt);
}
