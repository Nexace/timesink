export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
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
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    weighted(entries) {
      const total = entries.reduce((sum, e) => sum + e.weight, 0);
      if (total <= 0) return entries[0]?.id ?? null;
      let roll = next() * total;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) return entry.id;
      }
      return entries[entries.length - 1].id;
    },
    shuffle(list) {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    snapshot() {
      return { seed: seed >>> 0, calls };
    },
    get calls() {
      return calls;
    },
    get seed() {
      return seed >>> 0;
    },
  };
}

export function rngFromSnapshot({ seed, calls }) {
  const rng = createRng(seed);
  for (let i = 0; i < calls; i += 1) rng.next();
  return rng;
}

export function dailySeedKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
