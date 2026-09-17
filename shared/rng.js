export function hashSeed(str) {
  const text = typeof str === "string" ? str : String(str ?? "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  let calls = 0;

  function next() {
    calls += 1;
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    float(min, max) {
      const lo = Number(min);
      const hi = Number(max);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return lo;
      return lo + next() * (hi - lo);
    },
    int(min, max) {
      const lo = Math.ceil(Number(min));
      const hi = Math.floor(Number(max));
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return lo;
      return Math.floor(lo + next() * (hi - lo + 1));
    },
    chance(p) {
      const prob = Number(p);
      if (!Number.isFinite(prob) || prob <= 0) return false;
      if (prob >= 1) return true;
      return next() < prob;
    },
    pick(list) {
      if (!Array.isArray(list) || !list.length) return undefined;
      return list[Math.floor(next() * list.length)];
    },
    weighted(entries) {
      if (!Array.isArray(entries) || !entries.length) return null;
      const weights = entries.map((e) => {
        const w = Number(e?.weight);
        return Number.isFinite(w) && w > 0 ? w : 0;
      });
      const total = weights.reduce((sum, w) => sum + w, 0);
      if (total <= 0) return entries[0]?.id ?? null;
      let roll = next() * total;
      for (let i = 0; i < entries.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) return entries[i].id;
      }
      return entries[entries.length - 1].id;
    },
    shuffle(list) {
      if (!Array.isArray(list)) return [];
      const out = [...list];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    snapshot() {
      return { seed: Number(seed) >>> 0, state, calls };
    },
    restore(savedState, savedCalls) {
      state = savedState >>> 0;
      calls = savedCalls;
    },
    get calls() {
      return calls;
    },
    get seed() {
      return Number(seed) >>> 0;
    },
  };
}

export function rngFromSnapshot(snap) {
  const seed = snap?.seed;
  const calls = Number(snap?.calls);
  if (!Number.isInteger(calls) || calls < 0 || calls > 10000000) {
    throw new RangeError("Invalid RNG snapshot");
  }
  const rng = createRng(seed);
  if (Number.isInteger(snap?.state)) {
    rng.restore(snap.state, calls);
    return rng;
  }
  for (let i = 0; i < calls; i += 1) rng.next();
  return rng;
}

export function dailySeedKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
