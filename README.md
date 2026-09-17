# Time Sink

A hub of small, original browser games. No frameworks, no build step, no trackers —
plain HTML, CSS, and JavaScript served as static files.

Live game: **Mars Base**, a turn-based colony tycoon. Grow a Mars settlement
to 50 colonists and keep it self-sustaining, one sol at a time.

## Run it locally

ES modules require a real server (`file://` will not work):

```bash
npm run dev     # serves . on http://localhost:5173
npm test        # runs the Mars Base engine assertions with plain node
```

Any static server works (`npx serve .`, `python -m http.server`, …).

## Deploy

Push to Vercel. `vercel.json` enables clean URLs (`/games/mars-base`)
and caching for shared assets. Assumes deployment at the domain root —
absolute paths (`/shared/…`, `/games/…`) are used throughout.

## Structure

```
index.html / index.js / home.css   landing page, card grid
404.html / 404.css                 not-found page
shared/
  tokens.css      design tokens (colors, type, spacing, motion)
  base.css        reset, header/footer, buttons, badges, toast, modal
  registry.js     the games list — the single source of truth
  shell.js        injects header/footer, toasts, modals, sound prefs
  storage.js      namespaced localStorage, save export/import codes
  sound.js        WebAudio synth blips, muted by default
  rng.js          seeded PRNG (mulberry32) + daily seed helpers
  icons.js        inline SVG icon set
  format.js       number formatting (K/M/B, deltas, costs)
games/<slug>/
  index.html      page shell + meta
  game.css        per-game styles
  data.js         balance tables (resources, buildings, events)
  engine.js       PURE simulation — no DOM, deterministic
  ui.js           DOM rendering + input, no game logic
  engine.test.mjs assertions runnable with plain `node`
```

## Adding a game

1. Create `games/<slug>/` with `index.html`, `game.css`, `data.js`, `engine.js`, `ui.js`
   (copy Mars Base's shape: pure engine + thin UI + data tables).
2. Add one entry to the `games` array in `shared/registry.js`
   (`slug`, `title`, `tagline`, `kind`, `tags`, `accent`, `status`).
3. The landing grid, footer, and stats update themselves.

Conventions worth keeping:

- Each game's accent comes from `tokens.css` (`data-accent="…"` on `<body>`)
  and is set on `<html>` by `shell.js`.
- Persist with `createStore(namespace, { version })` so schema changes
  can migrate or reset gracefully. Strip non-serializable fields (e.g.
  undo history) before saving.
- Build static DOM once, then patch values on each render — never
  `innerHTML` a container that holds focused or hovered controls.
- Hover/active feedback must not move geometry (`transform` on `:hover`/`:active`
  breaks real-mouse hit-testing). Use glow, border, and brightness instead.
- Gate all motion behind `prefers-reduced-motion`, announce state changes
  with `aria-live`, and never use color as the only signal.

## Mars Base design notes

- Turn-based: Advance Sol resolves production → upkeep → event → report → autosave.
- Five resources (Power, Water, Oxygen, Ore, Credits) plus Population as a stat.
- Ore is the strategic pivot: construction material for advanced tiers
  *and* export good at the Trade Hub, which only sells half the stock
  so a construction reserve always accumulates.
- Deterministic simulation: `engine.js` plus a seed reproduces any run,
  which powers the Daily Sol challenge and the share-code export.
- Balance is validated by `engine.test.mjs` (24 assertions) and was tuned
  with bot playthroughs: a reactive player wins most runs in ~300–400 sols.
