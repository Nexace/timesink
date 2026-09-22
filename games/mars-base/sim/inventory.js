import { itemById } from "../data/items.js";

// Generic slot-array helpers; work for the player inventory and crate contents alike.
export function countIn(slots, id) {
  let n = 0;
  for (const s of slots) if (s && s.id === id) n += s.n;
  return n;
}

export function spaceFor(slots, id) {
  const def = itemById(id);
  if (!def) return 0;
  let space = 0;
  for (const s of slots) {
    if (!s) space += def.stack;
    else if (s.id === id) space += def.stack - s.n;
  }
  return space;
}

// Adds as many as fit. Returns the leftover count.
export function addTo(slots, id, n) {
  const def = itemById(id);
  if (!def || n <= 0) return n;
  let left = n;
  for (const s of slots) {
    if (left <= 0) break;
    if (s && s.id === id && s.n < def.stack) {
      const take = Math.min(def.stack - s.n, left);
      s.n += take;
      left -= take;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i += 1) {
    if (!slots[i]) {
      const take = Math.min(def.stack, left);
      slots[i] = { id, n: take };
      left -= take;
    }
  }
  return left;
}

// Removes up to n; returns number removed. Takes from the last stacks first so hotbar items survive.
export function removeFrom(slots, id, n) {
  let left = n;
  for (let i = slots.length - 1; i >= 0 && left > 0; i -= 1) {
    const s = slots[i];
    if (s && s.id === id) {
      const take = Math.min(s.n, left);
      s.n -= take;
      left -= take;
      if (s.n <= 0) slots[i] = null;
    }
  }
  return n - left;
}

export function hasAll(slots, cost, extraSlots = null) {
  for (const [id, n] of Object.entries(cost)) {
    const have = countIn(slots, id) + (extraSlots ? countIn(extraSlots, id) : 0);
    if (have < n) return false;
  }
  return true;
}

export function missingFor(slots, cost, extraSlots = null) {
  const out = [];
  for (const [id, n] of Object.entries(cost)) {
    const have = countIn(slots, id) + (extraSlots ? countIn(extraSlots, id) : 0);
    if (have < n) out.push({ id, need: n, have });
  }
  return out;
}

// Pays from the primary slots first, then from extra (nearby crates).
export function pay(slots, cost, extraSlots = null) {
  if (!hasAll(slots, cost, extraSlots)) return false;
  for (const [id, n] of Object.entries(cost)) {
    const took = removeFrom(slots, id, n);
    if (took < n && extraSlots) removeFrom(extraSlots, id, n - took);
  }
  return true;
}

export function moveSlot(from, fi, to) {
  const s = from[fi];
  if (!s) return false;
  const left = addTo(to, s.id, s.n);
  if (left === s.n) return false;
  if (left > 0) s.n = left;
  else from[fi] = null;
  return true;
}

export function swapSlots(slots, a, b) {
  const t = slots[a];
  slots[a] = slots[b];
  slots[b] = t;
}

// A "pool" is a list of slot arrays (player inventory first, then nearby crates).
export function poolCount(pool, id) {
  let n = 0;
  for (const slots of pool) n += countIn(slots, id);
  return n;
}
export function poolMissing(pool, cost) {
  const out = [];
  for (const [id, n] of Object.entries(cost)) {
    const have = poolCount(pool, id);
    if (have < n) out.push({ id, need: n, have });
  }
  return out;
}
export function poolHas(pool, cost) {
  return poolMissing(pool, cost).length === 0;
}
export function poolPay(pool, cost) {
  if (!poolHas(pool, cost)) return false;
  for (const [id, n] of Object.entries(cost)) {
    let left = n;
    for (const slots of pool) {
      if (left <= 0) break;
      left -= removeFrom(slots, id, left);
    }
  }
  return true;
}
