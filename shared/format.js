function safeDigits(digits) {
  const d = Math.floor(Number(digits));
  if (!Number.isFinite(d)) return 0;
  return Math.min(100, Math.max(0, d));
}

function safeNum(n, fallback = NaN) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function fmt(n, digits = 0) {
  const v = safeNum(n);
  if (!Number.isFinite(v)) return "—";
  const d = safeDigits(digits);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  if (abs >= 100 || d === 0) return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}${abs.toFixed(d)}`;
}

export function fmtDelta(n, digits = 0) {
  const v = safeNum(n);
  if (!Number.isFinite(v)) return "—";
  const d = safeDigits(digits);
  const rounded = d === 0 ? Math.round(v) : Number(v.toFixed(d));
  if (rounded === 0) return d === 0 ? "±0" : `±${(0).toFixed(d)}`;
  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${fmt(Math.abs(rounded), d)}`;
}

export function fmtExact(n) {
  const v = safeNum(n);
  if (!Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("en-US");
}

export function fmtCost(cost) {
  if (!cost || typeof cost !== "object") return "—";
  const parts = Object.entries(cost)
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => `${fmt(v)} ${String(k).replace(/[^a-z]/gi, "")}`);
  return parts.length ? parts.join(" + ") : "free";
}

export function pct(n, digits = 0) {
  const v = safeNum(n);
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(safeDigits(digits))}%`;
}

export function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many;
}

export function clamp(n, min, max) {
  const v = safeNum(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function round(n, places = 2) {
  const v = safeNum(n, 0);
  const p = safeDigits(places);
  const f = 10 ** Math.min(p, 15);
  return Math.round(v * f) / f;
}

export function ordinal(n) {
  const v = Math.floor(safeNum(n, 0));
  const s = ["th", "st", "nd", "rd"];
  const mod = ((v % 100) + 100) % 100;
  return `${v}${s[(mod - 20) % 10] ?? s[mod] ?? s[0]}`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(safeNum(seconds, 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
