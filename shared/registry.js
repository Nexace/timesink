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
    tagline: "Top-down Formula racing on all 24 real calendar circuits plus 5 classics (India, Malaysia, Hockenheim, Nürburgring, Sochi): 20-car Grands Prix with qualifying, bot duels and ghost time trials.",
    kind: "racing",
    tags: ["racing", "f1", "time-trial"],
    accent: "blue",
    motif: "car",
    version: "2.0",
    status: "live",
    added: "2026-09-20",
    howToPlay: {
      goal: "Qualify, then win 20-car Grands Prix, beat a bot from Noob to Impossible, or chase your own ghost on real-length F1 circuits.",
      steps: [
        "Pick a mode, a circuit, the lap count and the AI level (Noob to Impossible, or Mixed). A Grand Prix starts with qualifying: three laps each from the line, and your best clean lap sets your grid slot (a live timing tower shows every driver's laps as they come in; SUBMIT LAP ends your session early), or skip it for a random grid.",
        "Don't touch the throttle until the five red lights go out: holding it early locks the throttle until you let go.",
        "Corners have real grip limits: brake in a straight line, because kerbs and grass cost grip and speed. Stewards are lenient but fair: kerbs are yours, and running wide only counts if the whole car goes past the kerb and you keep your speed (five warnings, then 3 second penalties). Cutting across the inside of a corner is a warning the first time, then +2 seconds. Being pushed off by another car never counts, and any offence deletes that lap's time.",
        "Every level is a serious racer: up to Medium the bots drive your exact car (same engine, grip, brakes, ERS and DRS); from Hard up their cars are faster too (Hard +3%, Very Hard +6%, Impossible +10%). Behind another car you get a tow on the straights, but dirty air in the corners (less grip, shown as DIRTY). Cars are solid: contact pushes, scrubs speed and can spin you.",
        "Grand Prix brakes (option, on by default): the BRK gauge shows disc temperature and brake life. They work best in the green band (about 350-950 °C); over 1000 °C they fade, and they wear out faster. Worn brakes stop shorter. ERS harvesting takes some of the load off them. The bots manage theirs the same way.",
        "Within a second of the car ahead at the DRS detection line, you can open DRS once you enter the zone for extra top speed; tuck into a slipstream for a tow.",
        "ERS: braking charges the battery. Hold ERS for a power boost anywhere except while DRS is open. Deploying gives +30% power and a higher top speed until the battery is empty; every braking zone puts a chunk back (watch it turn green), up to 80% of the battery per lap, so spend it on corner exits, attacks and defending."
      ],
      controls: "[W / ↑] Throttle, [S / ↓] Brake/Reverse, [A/D / ←/→] Steer, [E] DRS, [Shift] ERS (hold), [Space] Handbrake, [Esc] Pause, [R] Restart. Mouse: drag to turn the view, wheel to zoom, double-click to reset. Settings let you rebind keys, tune steering, acceleration and braking, and choose a fixed or rotating camera.",
      tip: "Follow the racing line guide: red dashes mean brake now, amber means lift, green means flat out."
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
    tagline: "Open-sea naval conquest & trading across a 14 km archipelago: pirate packs, island forts, storms and two sea legends.",
    kind: "naval-rpg",
    tags: ["naval", "trading", "open-world"],
    accent: "teal",
    motif: "ship",
    version: "2.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Capture all 30 islands and sink the Ghost Ship and the Kraken to rule the archipelago.",
      steps: [
        "Steer with A/D, trim sails with W/S (or hold the mouse to sail at the cursor). A beam reach is fastest; heading into the wind is slow.",
        "Broadsides fire automatically at anything in your left or right arc. Pirates roam alone or in packs, fiercer in the outer seas.",
        "Destroy every fort on a hostile island to capture it: it pays taxes and becomes a port where [E] opens the market and shipyard.",
        "Salvage wrecks and floating crates, avoid rocks and whirlpools, then hunt the Ghost Ship in the Devil's Shroud and the Kraken in the Abyssal Trench."
      ],
      controls: "A/D steer, W/S sails, Space all hands, E dock, M chart, Esc pause",
      tip: "Buy goods tagged LOCAL and sell them where they're WANTED; prices shift every two minutes."
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
    tagline: "Newtonian asteroid miner in an endless star field: richer ore, derelict wrecks and pirate packs the further you fly.",
    kind: "space-sim",
    tags: ["physics", "newtonian", "mining"],
    accent: "copper",
    motif: "asteroid",
    version: "1.0",
    status: "live",
    added: "2026-09-21",
    howToPlay: {
      goal: "Mine ore across an endless star field and bank it at the home depot or a remote outpost before pirates or rocks take it.",
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
    tagline: "Drive Ahead-style car battles: bonk the other driver's helmet with your car. 8 cars, 31 arenas including 23 Drive Ahead classics, bots or a friend.",
    kind: "physics-battler",
    tags: ["physics", "versus", "cars"],
    accent: "violet",
    motif: "headbutt",
    version: "2.0",
    status: "live",
    added: "2026-09-22",
    howToPlay: {
      goal: "Touch the other driver's helmet with any part of your car. First to 5 rounds wins; protect your own head.",
      steps: [
        "Pick your car, an opponent (a bot from Easy to Insane, or a friend) and an arena: 8 originals, 23 Drive Ahead classics, or Random.",
        "Drive with A/D; in the air the same keys spin the car, so flip onto their helmet. W fires a nitro boost.",
        "Mind the arena: lava, spikes and drops knock you out, a helmet under water or acid drowns, and sawblades and meteors are deadly to helmets. After 45 seconds sudden death floods the arena, drops saws from the roof or brings the crusher down."
      ],
      controls: "A/D or ←/→ drive and flip, W/↑/Space boost, Esc pause. Vs friend: P1 A D W, P2 ← → ↑.",
      tip: "Get your wheels onto their roof: a car that lands on your cab reaches your helmet before you reach theirs."
    },
  },
  {
    slug: "ironclad",
    title: "Ironclad",
    tagline: "Side-view naval RTS in the Battlecruisers mould: spend builder drones on deck guns, shields and factories, pick targets, and sink the enemy battlecruiser.",
    kind: "naval-rts",
    tags: ["rts", "strategy", "naval", "battlecruiser"],
    accent: "steel",
    motif: "ironclad",
    version: "2.0",
    status: "live",
    added: "2026-09-22",
    howToPlay: {
      goal: "Sink the enemy battlecruiser before it sinks you. Builder drones are your only currency: every building and every unit locks drones while it's being made.",
      steps: [
        "Pick a card in the build dock, then click a glowing slot on your hull. Slots are typed: Utility, Deck, Platform, Mast and Bow. If you're short on drones the build queues.",
        "Build Drone Stations early. More drones let you build more at once and afford the big guns.",
        "Click one of your factories to choose what it produces. It keeps launching that unit, using drones for each one, until you hold production.",
        "Click an enemy building to make it the target for every gun and warship. Kill the artillery and silos first, then batter the hull.",
        "Click your own building to repair it with a drone or demolish it and free the slot. Shields soak damage until they collapse."
      ],
      controls: "Click slot: place · Click enemy building: target · Click own building: repair / production / demolish · Drag, wheel, A/D: camera · Z X C or minimap: jump · Space: pause · F: speed · 1–5: dock tabs · Shift: keep card armed",
      tip: "Watch the red dashed box on your deck: that's what the enemy is aiming at. Put a Shield Generator next to it, or repair it before it falls."
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
