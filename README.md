# SYS://TIMESINK.NET

A cabinet of small, original browser experiments, styled as an 80s deep-space
terminal. No frameworks, no build step, no trackers, no third-party requests —
plain HTML, CSS, and JavaScript served as static files with self-hosted fonts, except the
Allotropic display masthead which loads from the Adobe Fonts CDN.

Flagship experiment: **Mars Base**, an open-world pixel-art survival game.
Stranded alone on Mars, you patch the hab, farm potatoes, drive a rover across
a seeded planet, call Earth, grow a colony, and choose to go home or stay.

## Run it locally

ES modules require a real server (`file://` will not work):

```bash
npm run dev     # serves . on http://localhost:5173
npm test        # runs every game's engine assertions with plain node
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

- **Daily Sol** — seeded Mars Base runs, same planet for everyone each UTC day;
  survive 30 sols to log the day.
- **Streaks** — consecutive daily completions tracked in localStorage,
  shown as `STREAK: [nn]` in the global HUD.
- **Copy-result** — one click copies a shareable run summary to the clipboard.
- **Top Operators** — local 3-letter-initials hall of fame per game
  (Mars Base logs campaign endings, endless and daily scores).
- **NEW arrivals** — registry `added` dates drive `NEW` badges for 30 days.

## Mars Base design notes

Real-time, top-down, 16px tiles. `games/mars-base/`:

```
main.js        loop (fixed 20 ticks/s, 1×–3× speed, pause), input, saves, modals
data/          balance, tiles, items, recipes, structures, research, events, story
sim/           PURE simulation (node-testable, seeded RNG only, no DOM / Date / Math.random)
  worldgen     384×384 seeded map: plains, dunes, craters, ice north, basalt, a chasma
               with ramps, volcanic slope; POIs + guaranteed reachability
  rooms        flood-filled pressurized rooms (walls/glass/airlocks/rock seal them),
               per-room O₂ + temperature, breaches decompress
  power        union-find grids over touching structures, priority brownout
               (life support first), batteries
  systems      per-second machines, water tanks + reclaimer, crops, dust
  player       movement, vitals (O₂, suit power, food, water, health, suit integrity),
               drilling/shovelling, interaction, repairs, consumables
  rover        momentum driving, battery range, solar roof + base docking
  colonists    needs + jobs (repair, farm, haul, lab, wipe panels) over binary-heap A*
  events       dust storms (warned a sol ahead), meteors (marked zone), radiation
               storms, failures, dust devils, ice pockets, orbiter passes, supply drops
  story        campaign objectives (Acts I–III + finale), Mission Control, endings
  save         seed + tile diffs + RLE fog mask; worlds regenerate from the seed
render/        procedural pixel sprites (no image files), chunk-cached terrain,
               lighting/day-night/fog/storm layers, minimap
ui/            DOM HUD, panels (inventory/craft, build, research, map, journal, comms),
               ambient audio
tests/         unit suites + a scripted bot that plays Act I and drives the rover
```

- Modes: **Campaign** (story), **Endless** (solo or colony kit; score = sols,
  colonists, research), **Daily Sol** (same seed for everyone, 30 sols).
- Saves live under `mars-base-campaign`, `mars-base-endless`, `mars-base-daily`
  (+ a dawn checkpoint for campaign deaths). The old turn-based save key is cleared
  on first load with a one-time notice.
- Test hook: `window.__marsBase` (used by `scripts/verify-mars-base.mjs`).

## 6 New Arcade Games

### 1. IRONSAIL (`ironsail`, Accent: Teal `#00bfa5`)
- **Genre:** Top-Down 2D Naval RPG & Archipelago Conquest (Dokdo-inspired).
- **Core Mechanics:**
  - Automatic broadside cannons firing on left (60–120°) and right (240–300°) arcs, plus forward bow chaser gun.
  - 12 islands spanning the Home Sea (Zones 1-6) and Deep Sea (Zones 7-12). Defeat 10 guard ships per island to capture.
  - Dynamic port commodity markets (Fish, Wood, Stone, Iron, Gold, Ruby) fluctuating ±30% every 2 minutes.
  - Shipwright upgrades: Hull armor, heavy cannons, silk sails, crew holds, forward bow gun, 3 consort escort ships, 2 scout gulls.
  - 180s day/night lighting cycle and tile-based fog of war.

### 3. ACE VECTOR (`ace-vector`, Accent: Amber `#ffb700`)
- **Genre:** 2D High-G Energy Dogfighter.
- **Core Mechanics:**
  - Realistic Energy-Maneuverability flight physics ($E = \text{alt} \cdot g + v^2/2$). Climbing converts speed into height; diving converts altitude into rapid airspeed.
  - Aerodynamic stall mechanics: dropping below 180 kts causes loss of lift, pitch drop, and sluggish recovery controls.
  - Lead pursuit rotary cannon with projected reticle, heat-seeking Sidewinder IR missiles, and radar-guided missiles.
  - Countermeasures: deployable flares [C] and chaff to spoof missile locks.
  - Airbrake [B] and Afterburner [Shift] for tactical overshoot maneuvers.
  - 8-mission campaign with 4-tier enemy AI (Rookie, Veteran, Ace, Wingman).

### 4. SWARMLINE (`swarmline`, Accent: Magenta `#ff007f`)
- **Genre:** Top-Down Auto-Attack Roguelite (Vampire Survivors formula).
- **Core Mechanics:**
  - Movement-only arcade controls—weapons fire automatically based on internal cooldowns.
  - 6 weapon slots & 6 passive accessory slots. 8 distinct weapons with 8 upgrade tiers.
  - 8 Weapon Evolutions unlocked by pairing Level 8 weapons with their required passive and looting an elite chest (Holy Wand, Thousand Edge, Death Spiral, Heavenly Sword, Unholy Vespers, Hellfire, Soul Eater, La Borra).
  - XP gem magnet pickups (Blue, Green, Red) triggering 3-card upgrade draft modals.
  - 20-minute run survival curve culminating in the arrival of the invincible Red Death Reaper.

### 5. LAST TOWER (`last-tower`, Accent: Green `#00e676`)
- **Genre:** Grid Tower Defense with Dynamic A* Pathfinding.
- **Core Mechanics:**
  - 24x14 defense grid: creeps spawn on the left portal and navigate to the right exit portal.
  - Dynamic A* pathfinding validation: player is free to construct mazes, but blocking all paths to the exit is strictly illegal and blocked by the core engine.
  - 6 tower types (Gatling, Thermal Beam, Mortar, Tesla Coil, Cryo Emitter, Mag-Rail Sniper) with 3 upgrade levels and 70% refund on recycle.
  - 6 enemy variants: Grunt, Scout Runner, Ironclad Tank, direct Hover Flyer, Medic Drone, and Goliath Prime Boss (splits into runners on death).
  - Early wave call button rewarding +20% bonus gold for courageous commanders.

### 6. ORE RUNNER (`ore-runner`, Accent: Orange `#ff7700`)
- **Genre:** Zero-Friction Newtonian Asteroid Miner.
- **Core Mechanics:**
  - True zero-friction spaceflight: main thruster accelerates linearly; retro-burners [S] required to brake.
  - Cargo mass penalty: each mined mineral unit increases vessel mass, reducing linear acceleration and angular maneuverability by up to 30%.
  - Fuel management: engine burns consume fuel; running empty causes the ship to drift indefinitely on inertia.
  - High risk / high reward: unbanked cargo in hold is vaporized on vessel destruction. Must safely enter the central station docking tractor beam to bank credits, refuel, and repair hull.
  - 5 asteroid tiers including the volatile Unstable Core, which triggers an 8-second nuclear countdown once cracked.
  - Hostile pirate drone scavengers patrolling the outer belt.

### 7. SKYDOODLE (`skydoodle`, Accent: Doodle/Lime `#39ff14`)
- **Genre:** Retro Endless Vertical Climber (Doodle Jump-inspired).
- **Core Mechanics:**
  - Auto-bounce on every platform landing — no jump button. Steer left/right only.
  - Gyroscopic tilt controls on mobile with iOS `DeviceOrientationEvent.requestPermission()` support, calibration screen, and touch fallback.
  - 6 platform types: Normal, Bouncy (2× spring), Moving (horizontal), Fragile (breaks after landing), Vanishing (fades), Trap (drops immediately).
  - 6 power-ups: Spring Shoes, Jetpack, Shield (stacks), Magnet, Rocket, Trampoline.
  - 3 enemy types with fair-spawn rules: no enemies near springs/trampolines, guaranteed safe zone after each enemy.
  - 5 progression tiers by altitude: Notebook → Sky → Sunset → Night → Space, each with distinct visual themes.
- **Controls:** Tilt phone / Arrow keys / A-D to steer. Space / tap to shoot. ESC to pause.
- **Scoring:** Height = score. Displayed as altitude in pixels.

### 8. GRIDLOCK (`gridlock`, Accent: Phosphor `#00ff41`)
- **Genre:** Terminal-Styled Sudoku with Web Worker Puzzle Generator.
- **Core Mechanics:**
  - Randomized backtracking generator with unique-solution verification (solution-counting solver, limit=2).
  - Technique-tagged difficulty tiers: Rookie (40-45 clues), Standard (32-39), Hard (28-31), Expert (24-27), Nightmare (20-23).
  - Logical solver tags: Naked Singles, Hidden Singles, Pointing Pairs, Box-Line Reduction, X-Wing, Swordfish.
  - 3-stage progressive hint system: Step 1 highlights technique, Step 2 reveals cell, Step 3 shows value.
  - Pencil mode for candidate annotations, auto-candidate fill, conflict highlighting.
  - Modes: Endless (random puzzles), Daily (seeded, shareable result), Killer (cage sum constraints).
  - Undo/redo stack, mistake counter (max 3), shareable emoji result on solve.
- **Controls:** Click cell + type 1-9. P = Pencil mode. U = Undo. N = New puzzle. Keypad buttons for mobile.
- **Scoring:** Time-based with penalty for hints (-30s each) and mistakes. Lower time = better.

### 9. TERAFORM RUN (`teraform-run`, Accent: Mono `#f4f6f8`)
- **Genre:** 1-Bit Enhanced Chrome Dino Endless Runner.
- **Core Mechanics:**
  - **Multi-box collision** (NOT single bounding box): Dino = head + body + legs (3 boxes), Small Cactus = trunk + 2 arms (3 boxes), Pterodactyl = body + 2 wings + beak + tail (5 boxes).
  - **Variable jump height:** Tap (< 150ms) = short hop at 55% velocity, Hold = full jump, release mid-air = cut to 40%.
  - **Fast-fall:** Press Down while airborne for 3× fall speed with ground slam particles.
  - **Ducking:** Down on ground reduces hitbox height by ~40% (wider + shorter profile).
  - **Roguelite perks:** Every 500 points, choose 1 of 3 random perks (Iron Legs, Phase Shift, Magnet Boots, Double Coins, Slow-Mo, Featherfall, Turbo, Thick Skin).
  - **Combo near-miss system:** Passing within 18px of obstacles without hitting = combo counter, scoring bonus × (1 + combo × 0.1).
  - **Night mode:** Toggles every 700 points with visual theme shift (dark blue sky, cyan sprites).
  - **6 biomes** cycling every 1000 points: Desert, Tundra, Volcanic, Jungle, Cyber, Void — visual themes only, same collision mechanics.
  - **Coins** spawning mid-air, persistent across runs in localStorage.
  - Speed ramps from 300 px/s to 1200 px/s cap.
- **Controls:** Space/Up/W = Jump. Down/S = Duck/Fast-fall. Left touch zone = Duck/Slam. Right touch zone = Jump. ESC = Pause.
- **Scoring:** Distance in pixels ÷ 10. Combo multiplier bonus. Coins for persistent shop.

### 19. IRONCLAD.EXE (`ironclad`, Accent: Steel `#4682b4`)
- **Genre:** Side-View 2D Modular Naval RTS (faithful mechanical recreation of *Battlecruisers*).
- **Core Mechanics:**
  - **Drone-Only Economy:** No minerals, gold, or credits during battle. Players command a fleet of automated builder drones (starts at 4, expandable via Drone Stations and Tech Lab upgrades).
  - **True Build Costs:** Balanced by drone-seconds (drones × buildTime).
    - Artillery = 6 drones × 180s = 1080 drone-seconds.
    - LasCannon = 10 drones × 120s = 1200 drone-seconds.
    - Nuke Launcher = 8 drones × 360s = 2880 drone-seconds (6-minute build).
  - **Parallel Builds & Build Queue:** Dispatch drones across multiple simultaneous deck slots, or queue builds when drones are occupied.
  - **Right-Click Maintenance & Deconstruction:** Repair damaged structures on demand or recycle/sell obsolete modules to instantly recover drones.
  - **13 Specialized Battlecruisers:**
    - *Trident:* Balanced standard capital cruiser.
    - *Raptor:* Light aircraft carrier (+30% air build speed).
    - *Bullshark:* Heavy naval foundry (+30% warship build speed).
    - *Rockjaw:* High-energy laser specialist (+40% LasCannon build & fire rate).
    - *Eagle:* Long-range aerial command cruiser (+35% aircraft radar and speed).
    - *Hammerhead:* Armored battering ram dreadnought (+40% hull armor, front bow reinforcement).
    - *Longbow:* Siege platform (+25% artillery and mortar range).
    - *Hurricane:* Multi-barrel kinetic flak fortress.
    - *Blackrig:* Stealth industrial platform.
    - *Rickshaw:* Light high-mobility catamaran cruiser.
    - *Flea:* Ultra-compact micro-cruiser (low profile, extreme agility).
    - *Megalodon:* Apex dreadnought (massive platform capacity).
    - *Yeti Charger:* Secret apex unlockable cruiser (awarded at 90+ stars, 3200+ HP behemoth with dual superweapon platforms).
  - **29 Modular Buildings across 5 Categories:**
    - *Factories (3):* Naval Factory, Air Factory, Drone Station (+2 drones).
    - *Tactical (8):* Shield Generator, Local Booster (+25% speed aura), Control Tower, Stealth Generator, Spy Satellite, Point Defense Laser, Jammer Tower, Energy Matrix.
    - *Defensive (6):* Ship Turret, Anti-Air Turret, Mortar (heavy naval siege, misses small boats), SAM Site (guided), Tesla Coil (chain arcs), Flak Battery (AoE shrapnel).
    - *Offensive (7):* Artillery (high-arc ballistic shells), Railgun (hypervelocity kinetic slugs), Rocket Launcher (saturation volleys), LasCannon (continuous 5s beam), Bow Ion Cannon (dead-straight horizontal beam), Broadsides (4-shell heavy salvos), Floating Laser Battery.
    - *Ultraweapons (5):* Nuke Launcher (6-minute build, global siren at 80%, one-hit kill), Deathstar Satellite (orbital shield-shredding sweep), Ultralisk Fabrication (+100% global build speed), Kamikaze Signal (converts aircraft into cruise missiles), Broadsword (14-rod orbital kinetic strike).
  - **10 Autonomous Combat Units:**
    - *Naval (5):* AttackRIB (low-profile speed boat), AttackBoat (low-profile torpedo launch), Frigate, Destroyer, Archon Battleship.
    - *Air (5):* Bomber, Gunship, Fighter (anti-air interceptor), SteamCopter, Spy Plane.
    - *Low-Profile Immunity:* AttackRIB and AttackBoat pass cleanly underneath horizontal Bow Ion Cannon beams and dodge inaccurate Mortar shells.
  - **Modes & Progression:**
    - *Campaign Mode:* 40 escalating sectors facing 24 unique scripted bosses with distinct personality dialogues and opening build sequences.
    - *Skirmish Mode:* Custom match configuration.
    - *Boss Rush Mode:* Continuous 24-boss endurance challenge.
    - *Tech Lab:* Spend salvaged Scrap on permanent upgrades (Reinforced Belt Armor, Expanded Drone Bay, High-Frequency Assemblers, Capacitor Boosters, Reactive Nanocoat).
    - *Save Codes:* One-click Base64 save code export and import.
- **Controls:**
  - `1` to `5`: Switch bottom dock category tabs.
  - `Click`: Place selected building into compatible glowing slot.
  - `Right-Click`: Open slot maintenance menu (Repair, Sell/Deconstruct, Cycle Target).
  - `Mouse Drag / Scroll Wheel`: Pan and zoom camera across the 3000px battlefront.
  - `1`, `2`, `3` Quick Keys: Instantly jump camera to Allied Hull, Midfield, or Enemy Hull.
  - `Space`: Toggle game speed (1x, 2x, 4x, Pause).
  - `T`: Open Research & Tech Lab modal.
  - `ESC`: Close menus / Cancel placement.

