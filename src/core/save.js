/**
 * SYS://TIMESINK.NET — Core Save & Score System
 * Bridges games with the global high score wall and provides local storage slot management.
 */

import { saveScore, getBestScore } from "/shared/scores.js";

export function saveGameScore(slug, score, label = "", meta = {}) {
  return saveScore(slug, score, label, meta);
}

export function loadGameScore(slug) {
  return getBestScore(slug);
}

export function saveSlot(key, data) {
  try {
    localStorage.setItem(`timesink:${key}`, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSlot(key) {
  try {
    const raw = localStorage.getItem(`timesink:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function wipeSlot(key) {
  try {
    localStorage.removeItem(`timesink:${key}`);
    return true;
  } catch {
    return false;
  }
}
