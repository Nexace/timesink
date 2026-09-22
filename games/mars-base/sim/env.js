import { SOL_TICKS, DAWN, DAY_FRACTION, ROOM } from "../data/balance.js";

export function tod(tick) {
  return (tick % SOL_TICKS) / SOL_TICKS;
}

// 0 at night, rising to 1 at local noon.
export function daylight(tick) {
  const t = tod(tick);
  const d = (t - DAWN) / DAY_FRACTION;
  if (d <= 0 || d >= 1) return 0;
  return Math.sin(Math.PI * d);
}

export function isNight(tick) {
  return daylight(tick) <= 0.02;
}

export function outsideTemp(tick) {
  return ROOM.nightTemp + (ROOM.dayTemp - ROOM.nightTemp) * daylight(tick);
}

export function hasEffect(g, id) {
  return g.s.events.active.some((e) => e.id === id);
}

export function stormFactor(g) {
  return hasEffect(g, "dust-storm") ? 0.3 : 1;
}

// "HH:MM" Martian local time (24h mapped over the sol).
export function clockText(tick) {
  const mins = Math.floor(tod(tick) * 24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
