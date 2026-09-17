# SYS://ARCADE.NET

A cabinet of small, original browser experiments, styled as an 80s deep-space
terminal. No frameworks, no build step, no trackers — plain HTML, CSS, and
JavaScript served as static files.

Live experiment: **Mars Base**, a turn-based colony sim. Grow a Mars settlement
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
index.html / index.js / home.css   directory: boot hero, filters, game grid
game-template.html                 copy-paste stage frame for new games
404.html / 404.css                 signal-lost page
shared/
  tokens.css      terminal design tokens (colors, fonts, CRT, phosphor)
  base.css        reset, HUD shell, filters, buttons, stage, console, modal
  registry.js     the games list — the single source of truth
  shell.js        injects HUD/footer, clock, toggles, toasts, modals
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

1. Copy `game-template.html` to `games/<slug>/index.html` and replace the
   `GAME_*` slots (title, tagline, slug, accent, instructions, keys).
2. Add `game.css`, plus `data.js` / `engine.js` / `ui.js` following the
   Mars Base shape: pure engine + thin UI + data tables.
3. Add one entry to `games` in `shared/registry.js`
   (`slug`, `title`, `tagline`, `kind`, `tags`, `accent`, `motif`,
   `version`, `status`, `added`). `kind` drives the directory filters;
   `motif` picks the card thumbnail; `status: "live"` shows the card,
   anything else renders as STANDBY.
4. Every game over/win screen should include a copy-result button
   (see `copyResult()` in Mars Base) and one clean verb in its pitch.

Conventions worth keeping:

- Page accent comes from `data-accent="…"` on `<body>`; `shell.js`
  promotes it to `<html>`. Phosphor themes (`data-phosphor`) override it.
- Persist with `createStore(namespace, { version })` so schema changes
  can migrate or reset gracefully. Strip non-serializable fields (e.g.
  undo history) before saving.
- Build static DOM once, then patch values on each render — never
  `innerHTML` a container that holds focused or hovered controls.
- Hover/active feedback must not move geometry (`transform` on `:hover`/`:active`
  breaks real-mouse hit-testing). Use glow, border, and fill inversion instead.
- Gate all motion behind `prefers-reduced-motion`, announce state changes
  with `aria-live`, and never use color as the only signal.
- Secrets: the Konami-code pattern lives here — keep future easter eggs
  in one place and document them in this file when added.

## Engagement systems (all serverless)

- **Daily Sol** — seeded runs, same colony for everyone each UTC day,
  plus yesterday's seed. No undo in daily mode.
- **Streaks** — consecutive daily completions tracked in localStorage,
  shown as `STREAK: [nn]` in the global HUD.
- **Copy-result** — one click copies a shareable run summary to the clipboard.
- **Top Operators** — local 3-letter-initials hall of fame per game
  (Mars Base ranks fewest sols to establish).
- **NEW arrivals** — registry `added` dates drive `NEW` badges for 30 days.

## Mars Base design notes

- Turn-based: Advance Sol resolves production → upkeep → event → report → autosave.
- Five resources (Power, Water, Oxygen, Ore, Credits) plus Population as a stat.
- Ore is the strategic pivot: construction material for advanced tiers
  *and* export good at the Trade Hub, which only sells half the stock
  so a construction reserve always accumulates.
- Deterministic simulation: `engine.js` plus a seed reproduces any run,
  which powers Daily Sol and the share-code export.
- Balance is validated by `engine.test.mjs` (24 assertions) and was tuned
  with bot playthroughs: a reactive player wins most runs in ~300–400 sols.
