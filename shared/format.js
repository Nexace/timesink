export function fmt(n, digits = 0) {
  if (!Number.isFinite(n)) return "∞";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  if (abs >= 100 || digits === 0) return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}${abs.toFixed(digits)}`;
}

export function fmtDelta(n, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  const rounded = digits === 0 ? Math.round(n) : Number(n.toFixed(digits));
  if (rounded === 0) return digits === 0 ? "±0" : `±${(0).toFixed(digits)}`;
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${fmt(Math.abs(rounded), digits)}`;
}

export function fmtExact(n) {
  if (!Number.isFinite(n)) return "∞";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtCost(cost) {
  return Object.entries(cost)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${fmt(v)} ${k}`)
    .join(" + ");
}

export function pct(n, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function round(n, places = 2) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
