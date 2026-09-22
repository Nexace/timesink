export const SITE = {
  name: "timesink",
  tagline: "Small games that eat your time politely.",
  url: "https://timesink.net",
  repo: "",
};

export const games = [
  {
    slug: "mars-base",
    title: "Mars Base",
    tagline: "The crew left. You didn't. Science your way off a very red planet.",
    kind: "survival",
    tags: ["survival", "sim", "open-world"],
    accent: "flare",
    motif: "dome",
    version: "2.0",
    status: "live",
    featured: true,
    added: "2026-09-16",
    howToPlay: {
      goal: "Survive alone on Mars, restore contact with Earth, grow a colony — then choose to go home or stay.",
      steps: [
        "Salvage scrap, craft metal and sealant, and patch the breached hab before your suit runs dry.",
        "Repair the Oxygenator and Water Reclaimer, wipe the solar panels, and plant potatoes under the skylights.",
        "Drive the rover across the seeded map to the old lander, bring its antenna home and call Earth."
      ],
      controls: "WASD move · Hold L-Click to use tool · E interact · TAB inventory/craft · B build · M map · F rover · Space pause",
      tip: "Sealed rooms refill your suit. Keep the batteries charged before nightfall — life support gets power first, everything else waits."
    },
  },
  {
    slug: "ground-zero",
    title: "Ground Zero",
    tagline: "Nuclear blast effects simulator using Glasstone-Dolan scaling laws and Leaflet wireframe.",
    kind: "simulator",
    tags: ["physics", "geo", "tactical"],
    accent: "lime",
    motif: "nuke",
    version: "1.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Simulate nuclear detonations and observe thermal & blast radii on real maps.",
      steps: [
        "Select weapon yield (15kt Hiroshima to 50Mt Tsar Bomba) and burst mode (Airburst vs Surface).",
        "Click anywhere on the tactical map or drag the crosshairs to set Ground Zero.",
        "Click 'DETONATE' to calculate fireball, 20psi heavy blast, thermal radiation, and fallout."
      ],
      controls: "Mouse Click to target, Map Pan/Zoom, Detonate button",
      tip: "Airburst maximizes blast pressure radius; Surface burst creates massive local radioactive fallout."
    },
  },
  {
    slug: "scale-jump",
    title: "Scale Jump",
    tagline: "Logarithmic zoom from Planck length to the observable universe across 60+ detailed scientific checkpoints.",
    kind: "science",
    tags: ["cosmic", "powers-of-10", "toy"],
    accent: "cyan",
    motif: "scale",
    version: "2.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Traverse 62 powers of ten from quantum Planck strings to the cosmic observable universe.",
      steps: [
        "Drag the horizontal logarithmic slider, use mouse wheel, or press Arrow keys / PageUp / PageDown to zoom.",
        "Click any category regime (Quantum, Subatomic, Atomic, Cellular, Human, Planetary, Stellar, Galactic, Cosmic) for instant jump.",
        "Toggle COMPARE MODE for true-size side-by-side relative scale with preset matchups and mind-bending analogies."
      ],
      controls: "[← / →] or Mouse Wheel to zoom, [PageUp / PageDown] for 10x steps, [Home / End] for extremes",
      tip: "Check the Mind-Bending Scale Analogy section on each checkpoint to truly grasp the unimaginable relative sizes of reality!"
    },
  },
  {
    slug: "diet-game",
    title: "The Diet Game",
    tagline: "Escalating meal planner with 25 increasingly absurd and contradictory diet rules.",
    kind: "puzzle",
    tags: ["rules", "absurd", "word-game"],
    accent: "pink",
    motif: "apple",
    version: "1.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Build valid daily meal plates that satisfy an escalating list of contradictory diet rules.",
      steps: [
        "Click foods from the pantry inventory to place them onto your plate.",
        "Each level unlocks new mandatory diet rules (calories, nutrients, letter patterns, colors).",
        "Satisfy every single active rule simultaneously, then submit your plate to advance."
      ],
      controls: "Mouse Click food cards to add/remove, Submit button",
      tip: "Read food ingredient tags carefully—some foods secretly satisfy multiple tricky rules at once!"
    },
  },
  {
    slug: "ping-age",
    title: "Ping Age",
    tagline: "12-question internet nostalgia quiz calculating your true digital era, subculture, and archaeological dossier.",
    kind: "quiz",
    tags: ["retro", "web-history", "personality"],
    accent: "indigo",
    motif: "modem",
    version: "2.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Discover your true digital generation, hybrid era DNA, and digital archaeology dossier through 12 culturally authentic questions.",
      steps: [
        "Answer 12 authentic multiple-choice questions covering dial-up modem trauma to hyper-accelerated brainrot.",
        "Choose the options that honestly reflect your earliest personal internet memories.",
        "Unlock your Digital Archaeology Dossier (Holy Relic, Natural Habitat, Defining Trauma, Superpower) and Hybrid DNA breakdown."
      ],
      controls: "Mouse Click or Keyboard [A-E / 1-5] to select answer",
      tip: "Selecting answers across disparate eras unlocks special recognition badges like Time Traveller or Digital Omnivore!"
    },
  },
  {
    slug: "rootkit",
    title: "Rootkit",
    tagline: "Authentic retro terminal intrusion system with network recon, ciphers, hex dumps, port knocking, and proxy routing.",
    kind: "terminal",
    tags: ["hacker", "cli", "puzzle"],
    accent: "purple",
    motif: "terminal",
    version: "2.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Infiltrate 6 secure networks, decrypt military ciphers, bypass firewalls, and deploy Ring-0 rootkits before IDS trace hits 100%.",
      steps: [
        "Use 'scan' to sweep subnets for hosts, then 'connect <ip>' and 'crack <port>' to harvest credentials.",
        "Execute firewall port knocking ('knock 7721 8840 9912'), analyze memory buffers ('dump memory.dmp'), and inject SQL queries.",
        "Route through compromised nodes ('proxy add <ip>') and sanitize audit trails ('shred audit.log') to evade IDS detection."
      ],
      controls: "Keyboard CLI: [Tab] Autocomplete, [↑/↓] Command History, [Ctrl+L] Clear Screen, 'help' for directory",
      tip: "Bouncing through proxy nodes significantly damps trace buildup, while shredding audit logs drops active trace by 25%!"
    },
  },
  {
    slug: "ghost-lap",
    title: "Ghost Lap",
    tagline: "Neon vector top-down time-trial racer with ghost replays, live delta, and track editor.",
    kind: "racing",
    tags: ["arcade", "drifting", "time-trial"],
    accent: "blue",
    motif: "car",
    version: "1.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Set blistering lap records across world-famous circuits and outrun your ghost car.",
      steps: [
        "Steer into corners and brake before the turn-in point to avoid skidding off-track.",
        "Use Handbrake Drift to kick the rear out around sharp chicanes and hairpins.",
        "Race against your recorded ghost car to shave off milliseconds every lap."
      ],
      controls: "[W / ↑] Accel, [S / ↓] Brake/Rev, [A/D / ←/→] Steer, [Space] Drift, [C] Controls, [R] Restart",
      tip: "Brake in a straight line before turning in; trail-braking maintains high apex speed!"
    },
  },
  {
    slug: "redlight",
    title: "Redlight",
    tagline: "NHRA drag-racing reaction time trainer with Christmas tree, splits, and timeslip receipts.",
    kind: "arcade",
    tags: ["reaction", "drag-racing", "precision"],
    accent: "crimson",
    motif: "tree",
    version: "1.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Achieve the lowest reaction time off the dragstrip Christmas Tree without redlighting.",
      steps: [
        "Click 'STAGE' to roll your funny car into the start beams.",
        "Focus on the descending amber countdown bulbs (spaced exactly 0.500s apart).",
        "Hit [SPACE] or click 'LAUNCH' the exact millisecond the green light illuminates."
      ],
      controls: "[Space] or Mouse Click to Stage and Launch",
      tip: "Anticipate the cadence between amber bulbs—reacting to green takes ~0.200s of human reflex!"
    },
  },
  {
    slug: "resume-game",
    title: "The Resume Game",
    tagline: "Escalating ATS resume builder with 28 brutal rules and a dynamic HR reaction engine.",
    kind: "puzzle",
    tags: ["rules", "career", "absurd"],
    accent: "gold",
    motif: "doc",
    version: "1.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Survive escalating recruiter filters and ATS bots to get your resume hired.",
      steps: [
        "Edit your job experience, skills, and certifications on the resume sheet.",
        "Satisfy increasingly unreasonable ATS scanning rules without triggering buzzword bans.",
        "Submit for recruiter review to advance through interview stages."
      ],
      controls: "Mouse Click to edit bullets, add skills, and submit application",
      tip: "Balance keyword density with human readability—over-stuffing keywords triggers immediate HR rejection!"
    },
  },
  {
    slug: "ironsail",
    title: "IronSail",
    tagline: "Top-down naval conquest & trading RPG. Capture 12 islands, command broadsides, and conquer the archipelago.",
    kind: "naval-rpg",
    tags: ["naval", "trading", "conquest"],
    accent: "teal",
    motif: "ship",
    version: "1.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Capture all 12 islands across the Home Sea and Deep Sea to rule the archipelago.",
      steps: [
        "Click or drag mouse to steer your vessel toward destination or enemy ships.",
        "Broadside cannons auto-fire on enemies within left and right firing arcs.",
        "Approach captured friendly islands and press [E] to trade commodities, repair hull, and buy upgrades."
      ],
      controls: "Mouse Click/Drag or Virtual Stick to steer, [Space] Boost, [E] Dock at Port",
      tip: "Commodity prices fluctuate every 2 minutes—buy low at island ports and sell high across the sea!"
    },
  },
  {
    slug: "ace-vector",
    title: "Ace Vector",
    tagline: "High-octane 2D energy dogfighter with 5 flyable aircraft, varied enemy classes, mountain & ocean terrain hazards, and cloud strata.",
    kind: "flight-sim",
    tags: ["dogfight", "energy-physics", "combat", "aircraft"],
    accent: "amber",
    motif: "jet",
    version: "2.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Dominate the skies: choose from 5 unique fighters, weave through mountain canyons and cloud banks, and eliminate all enemy bandit wings.",
      steps: [
        "Select your fighter in the hangar: F-22A Stealth Raptor, Su-47 Berkut, A-10C Warthog, Mirage 2000, or SR-71X Vector.",
        "Maneuver vertically across 3 distinct zones: high stratosphere, dense cloud deck (breaks radar lock), and low-altitude mountain canyons & ocean.",
        "Beware terrain collision: avoid crashing into mountain peaks and the ocean while dogfighting low or escaping radar.",
        "Engage 5 enemy classes: nimble MiG-21s, aggressive Su-27s, heavy Tu-160 bombers, stealth J-20s, and the hypersonic Black Ghost ace."
      ],
      controls: "[W/S] or [Arrows] Pitch, [H] Hangar / Aircraft Roster, [Space] Cannon, [F] Missile, [C] Flares, [Shift] Burner, [B] Airbrake",
      tip: "Dive into cloud cover to break enemy missile locks, or lure bandit fighters into steep mountain canyons!"
    },
  },
  {
    slug: "swarmline",
    title: "Swarmline",
    tagline: "Top-down auto-attack roguelite. 20-minute runs, 6 weapon & 6 passive slots, and 8 weapon evolutions.",
    kind: "roguelite",
    tags: ["auto-shooter", "bullet-heaven", "upgrade"],
    accent: "magenta",
    motif: "swarm",
    version: "1.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Survive 20 minutes against relentless hordes until the arrival of Red Death.",
      steps: [
        "Focus purely on dodging and movement—all weapons fire automatically.",
        "Collect blue and green XP gems dropped by slain foes to trigger level-up upgrades.",
        "Pair Level 8 weapons with their matching passives to unlock game-breaking Weapon Evolutions."
      ],
      controls: "[W/A/S/D] or Arrow Keys or Virtual Stick to Move",
      tip: "Garlic and King Bible form a protective perimeter to keep early swarm mobs at bay!"
    },
  },
  {
    slug: "last-tower",
    title: "Last Tower",
    tagline: "Grid tower defense with dynamic A* pathfinding maze validation, 6 towers with 3 upgrade levels, and 6 enemy types.",
    kind: "tower-defense",
    tags: ["strategy", "pathfinding", "defense"],
    accent: "emerald",
    motif: "tower",
    version: "1.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Construct maze defenses to prevent 30 waves of invaders from breaching your Core.",
      steps: [
        "Place Gatling, Laser, Mortar, Tesla, Cryo, and Sniper towers onto the grid.",
        "Design intricate mazes, but note that completely blocking the path to the exit is illegal.",
        "Call waves early using the button below for a +20% bonus gold reward!"
      ],
      controls: "Mouse Click to select tower and build on grid, buttons to Upgrade/Recycle/Call Early",
      tip: "Mix Cryo slow fields with heavy splash Mortar cannons to obliterate grouped clusters!"
    },
  },
  {
    slug: "ore-runner",
    title: "Ore Runner",
    tagline: "Newtonian zero-friction asteroid miner. Cargo mass inertia, fuel conservation, unbanked cargo loss, and unstable cores.",
    kind: "space-sim",
    tags: ["physics", "newtonian", "mining"],
    accent: "copper",
    motif: "asteroid",
    version: "1.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Mine precious minerals across the asteroid belt and safely deposit them at the central depot.",
      steps: [
        "Master zero-friction Newtonian thrust: use retro-burners [S] to slow down before collisions.",
        "Heavier cargo holds increase your ship's mass, slowing turn rate and acceleration by up to 30%.",
        "Cracking an Unstable Core starts an 8-second nuclear detonation clock—mine and run!",
      ],
      controls: "[A/D] Steer, [W / Space] Main Thruster, [S] Retro-Brake, [F / E] Mining Laser",
      tip: "Unbanked ore in your cargo hold is destroyed if your ship explodes—dock frequently at the central station!"
    },
  },
  {
    slug: "skydoodle",
    title: "SkyDoodle",
    tagline: "Retro endless vertical climber. Auto-bouncing landing physics, gyro tilt, power-ups, and fair-spawn rules.",
    kind: "climber",
    tags: ["vertical", "gyro", "arcade"],
    accent: "mint",
    motif: "doodle",
    version: "1.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Climb through the sky and into deep space by bouncing off ledges and blasting hazards.",
      steps: [
        "Your character bounces automatically on every landing—steer left or right to hit the next platform.",
        "Moving off either screen edge wraps your character around to the opposite side.",
        "Press [Space] (or tap screen) to shoot monsters and UFOs from below before they touch you."
      ],
      controls: "Tilt Phone / Arrow Keys / [A/D] Steer, [Space] Shoot",
      tip: "Fair-spawn protection guarantees safe landing zones after enemy clusters—don't panic-swerve!"
    },
  },
  {
    slug: "gridlock",
    title: "Gridlock",
    tagline: "Retro terminal Sudoku with Web Worker unique solution generator, technique-tagged difficulty, and Killer Sudoku.",
    kind: "puzzle",
    tags: ["sudoku", "logic", "terminal"],
    accent: "phosphor",
    motif: "sudoku",
    version: "1.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Fill every row, column, and 3x3 box with digits 1 through 9 with zero duplicate conflicts.",
      steps: [
        "Click or tap an empty cell, then select a number from the keypad or type 1-9.",
        "Toggle [PENCIL] mode or press [P] to annotate small candidate marks.",
        "Use [AUTO] for automatic candidate updates, or [HINT] for stepped technique breakdowns."
      ],
      controls: "Mouse Click, Keys [1-9], [P] Pencil Mode, [U] Undo, Keypad Buttons",
      tip: "Selecting any number highlights all instances on the board to spot missing peer placements quickly!"
    },
  },
  {
    slug: "teraform-run",
    title: "Teraform Run",
    tagline: "Enhanced 1-bit endless runner. Multi-box pixel collision, fast-fall slamming, roguelite perks, and 6 biomes.",
    kind: "runner",
    tags: ["runner", "1-bit", "roguelite"],
    accent: "silver",
    motif: "dino",
    version: "1.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Survive across shifting biomes, collect coins, and stack roguelite perks as speed accelerates.",
      steps: [
        "Tap [Up / Space] for a short hop, or hold for a high jump to clear wide triple-cactus clusters.",
        "Press [Down / S] mid-air for Fast-Fall slam recovery; hold [Down / S] on ground to duck-slide.",
        "Every 500 points, select one of three roguelite run modifiers to upgrade your runner."
      ],
      controls: "[Up / Space] Jump, [Down / S] Duck / Fast-Fall, Buttons on Mobile",
      tip: "Grazing obstacles within 8px triggers Near-Miss style combos that multiply your score gains!"
    },
  },
  {
    slug: "headbutt",
    title: "Headbutt",
    tagline: "Side-view 2D physics car battler against intelligent bot AI. Land a hit on the bot's exposed driver head to win. 12 vehicles, 12 arenas.",
    kind: "physics-battler",
    tags: ["physics", "fighting", "bot-ai"],
    accent: "violet",
    motif: "headbutt",
    version: "1.0",
    status: "live",
    added: "2026-09-22",
    howToPlay: {
      goal: "Land a hit on the bot's exposed driver head to win the round. First to 5 round wins takes the match.",
      steps: [
        "Select your vehicle, choose the bot's car and AI difficulty in the battle garage.",
        "Smoothly drive, jump, and air-pitch your car to dive onto the bot's head hitbox.",
        "Dodge arena hazards like rotating buzzsaws, lava geysers, seesaw decks, and swinging wrecking balls."
      ],
      controls: "A/D or ←/→ to drive & pitch in air. Space/Enter to start. ESC to pause.",
      tip: "Controls auto-invert when flipped upside-down so you can drive inverted for surprise comeback attacks!"
    },
  },
  {
    slug: "ironclad",
    title: "Ironclad",
    tagline: "Side-view 2D naval RTS. Command enormous battlecruisers, manage builder drones, construct tactical slots, and unleash superweapons.",
    kind: "naval-rts",
    tags: ["rts", "strategy", "naval", "battlecruiser"],
    accent: "steel",
    motif: "ironclad",
    version: "1.0",
    status: "live",
    added: "2026-09-22",
    howToPlay: {
      goal: "Reduce the enemy battlecruiser's hull HP to 0 while protecting your own. Manage builder drones with strategic timing!",
      steps: [
        "Drones are your only currency: builds lock idle drones for their build duration (true cost = drones × time).",
        "Assign buildings into specialized slots: Utility (Drone Stations), Deck (guns/shields/factories), Platform (ultraweapons), Mast (anti-air), and Bow (Ion Cannon).",
        "Deploy autonomous naval ships and air squadrons from factories to swarm and screen enemy forces.",
        "Right-click damaged buildings to assign idle drones to repair them, or sell buildings to clear slots."
      ],
      controls: "Left Click: Select & Place / Focus Target. Right Click: Repair / Sell. Drag / Wheel: Pan & Zoom. [1-3]: Camera Jump. [Space]: Pause.",
      tip: "Artillery (6 drones × 180s) is cheaper and earlier than LasCannon (10 drones × 120s) — build Drone Stations early to scale into high-tech superweapons!"
    },
  },
];

export function getGame(slug) {
  return games.find((g) => g.slug === slug) ?? null;
}

export function gameHref(slug) {
  return `/games/${encodeURIComponent(String(slug ?? ""))}`;
}

export function liveGames() {
  return games.filter((g) => g.status === "live");
}

export function soonGames() {
  return games.filter((g) => g.status !== "live");
}

export function getHowToPlay(slugOrGame) {
  const game = typeof slugOrGame === "object" ? slugOrGame : getGame(slugOrGame);
  if (game?.howToPlay) return game.howToPlay;

  const fallbackTitle = game?.title || (typeof slugOrGame === "string" ? slugOrGame : "this game");

  // Smart fallback for newly created or future games
  return {
    goal: `Master challenges and set high scores in ${fallbackTitle}.`,
    steps: [
      game?.tagline || "Interact with the arcade terminal to play.",
      "Follow on-screen HUD telemetry and objectives.",
      "Submit your final record to the arcade high score wall."
    ],
    controls: "Mouse & Keyboard",
    tip: "Check the in-game HUD for live feedback and telemetry!"
  };
}
