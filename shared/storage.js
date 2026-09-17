const PREFIX = "timesink";

function safeStorage() {
  try {
    const probe = `${PREFIX}:__probe__`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

let backing = null;
function store() {
  if (backing === undefined) return null;
  if (backing === null) {
    backing = safeStorage() ?? false;
  }
  return backing || null;
}

export function nsKey(namespace, key) {
  return `${PREFIX}:${namespace}:${key}`;
}

export function rawGet(key) {
  const s = store();
  if (!s) return null;
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

export function rawSet(key, value) {
  const s = store();
  if (!s) return false;
  try {
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function rawRemove(key) {
  const s = store();
  if (!s) return false;
  try {
    s.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function createStore(namespace, { version = 1, migrate = null } = {}) {
  const key = nsKey(namespace, "save");

  return {
    key,
    load(fallback) {
      const raw = rawGet(key);
      if (!raw) return fallback;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return fallback;
        if (parsed.version === version) return parsed.data;
        if (typeof migrate === "function") {
          const migrated = migrate(parsed.data, parsed.version, version);
          return migrated ?? fallback;
        }
        return fallback;
      } catch {
        return fallback;
      }
    },
    save(data) {
      return rawSet(key, JSON.stringify({ version, data, savedAt: Date.now() }));
    },
    exists() {
      return rawGet(key) !== null;
    },
    clear() {
      return rawRemove(key);
    },
  };
}

export function createPrefStore(namespace) {
  const memory = new Map();
  const s = store();

  return {
    get(key, fallback) {
      const full = nsKey(namespace, key);
      if (!memory.has(full)) {
        const raw = s ? rawGet(full) : null;
        memory.set(full, raw === null ? fallback : deserialize(raw, fallback));
      }
      return memory.get(full);
    },
    set(key, value) {
      const full = nsKey(namespace, key);
      memory.set(full, value);
      if (s) rawSet(full, serialize(value));
      return value;
    },
    toggle(key, fallback = false) {
      return this.set(key, !this.get(key, fallback));
    },
  };
}

function serialize(value) {
  return JSON.stringify({ v: value });
}

function deserialize(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "v" in parsed) return parsed.v;
    return fallback;
  } catch {
    return fallback;
  }
}

export function exportCode(data) {
  try {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return null;
  }
}

export function importCode(code) {
  try {
    const normalized = String(code).trim().replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
