const PREFIX = "timesink";

function safeStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
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
      try {
        return rawSet(key, JSON.stringify({ version, data, savedAt: Date.now() }));
      } catch {
        return false;
      }
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

  function read(key, fallback) {
    const full = nsKey(namespace, key);
    if (!memory.has(full)) {
      const raw = s ? rawGet(full) : null;
      memory.set(full, raw === null ? fallback : deserialize(raw, fallback));
    }
    const value = memory.get(full);
    return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
  }

  function write(key, value) {
    const full = nsKey(namespace, key);
    memory.set(full, value);
    if (s && !rawSet(full, serialize(value))) return false;
    return value;
  }

  return {
    get: read,
    set: write,
    toggle(key, fallback = false) {
      return write(key, !read(key, fallback));
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
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
    }
    return btoa(chunks.join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return null;
  }
}

export function importCode(code) {
  try {
    const normalized = String(code).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!normalized) return null;
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
