const PATHS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
  back: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  github:
    '<path d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 4.5-1.4 4.5-4.9 0-1-.3-1.8-.9-2.4.1-.3.4-1.3-.1-2.6 0 0-1-.3-3.2 1.1a10.9 10.9 0 0 0-5.6 0C7.7 3.7 6.7 4 6.7 4c-.5 1.3-.2 2.3-.1 2.6-.6.6-.9 1.4-.9 2.4 0 3.5 1.7 4.6 4.5 4.9-.5.5-.5 1-.5 1.9V22"/>',
  "volume-on":
    '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  "volume-off": '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
  trophy:
    '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5v2a3 3 0 0 0 3 3"/><path d="M16 5h3v2a3 3 0 0 1-3 3"/><path d="M12 13v4"/><path d="M8.5 20h7"/><path d="m10 17 4 0 .6 3H9.4l.6-3Z"/>',
  alert: '<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4"/><path d="M12 17.4v.4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.8v.4"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  undo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 4h16"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
  gamepad:
    '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1"/><circle cx="18.5" cy="14.5" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  skull:
    '<path d="M12 3a8 8 0 0 0-8 8v3l2 2v3h12v-3l2-2v-3a8 8 0 0 0-8-8Z"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><path d="M11 17.5v1M13 17.5v1"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
  droplet: '<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z"/>',
  oxygen: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  ore: '<path d="m12 3 5 5-5 13-5-13 5-5Z"/><path d="M7 8h10"/>',
  credits:
    '<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5A3 3 0 0 0 9.5 11c0 3 5 1 5 4a3 3 0 0 1-5-2.5"/><path d="M12 6.5v11"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.4a3.2 3.2 0 0 1 0 5.2"/><path d="M18.5 20a6 6 0 0 0-2.6-4.9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  reactor:
    '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/>',
  factory: '<path d="M3 21V10l5 3V10l5 3V7l8 4v10H3Z"/><path d="M7 21v-4M12 21v-4M17 21v-4"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6L4.6 18A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7.6 15h8.8"/>',
  rocket:
    '<path d="M12 2c3.5 2.5 5.5 6.5 5.5 10.5L12 17l-5.5-4.5C6.5 8.5 8.5 4.5 12 2Z"/><circle cx="12" cy="9.5" r="2"/><path d="M6.5 12.5 4 16l3.5 1"/><path d="M17.5 12.5 20 16l-3.5 1"/><path d="M10 20c.8 1.2 3.2 1.2 4 0"/>',
  dome: '<path d="M3 20h18"/><path d="M5 20v-6a7 7 0 0 1 14 0v6"/><path d="M12 7v13"/><path d="M6.6 12.6h10.8"/>',
  drill: '<path d="M8 3h8v6l-2 3v6l-2 3-2-3v-6L8 9V3Z"/><path d="M8 6h8"/>',
  leaf: '<path d="M4 20c0-9 6-15 16-16 0 10-5 16-13 16H4Z"/><path d="M4 20c3-6 7-9 12-11"/>',
  trade: '<path d="M3 8h13l-3-3"/><path d="M21 16H8l3 3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  sparkle:
    '<path d="m12 3 1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z"/><path d="m18.5 15.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/>',
  snowflake: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  shield: '<path d="m12 3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  flag: '<path d="M5 21V4"/><path d="M5 5h11l-2 3.5L16 12H5"/>',
};

export function icon(name, { size = 20, strokeWidth = 1.8, cls = "" } = {}) {
  const body = PATHS[name];
  if (!body) return "";
  const px = Math.min(256, Math.max(8, Math.floor(Number(size) || 20)));
  const sw = Math.min(8, Math.max(0.5, Number(strokeWidth) || 1.8));
  const safeCls = String(cls).replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 64);
  const classes = safeCls ? ` class="${safeCls}"` : "";
  return `<svg${classes} width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function iconNames() {
  return Object.keys(PATHS);
}
