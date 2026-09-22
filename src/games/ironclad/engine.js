/**
 * IRONCLAD.EXE — Naval RTS Core Engine
 * Pure headless simulation of Battlecruisers-style side-view naval RTS.
 * Contains economy, 13 cruisers, 29 buildings, 10 units, 24 scripted bosses,
 * 40 campaign levels, combat ballistics, shields, Tech Lab, and save/load logic.
 */

// ── 1. Cruisers Roster (13 Cruisers) ──
export const CRUISERS = {
  trident: {
    id: "trident",
    name: "Trident",
    role: "Balanced Standard Cruiser",
    hullHp: 2000,
    bonusDesc: "Well-rounded hull with a balanced slot layout. No weaknesses, standard build rates.",
    passive: {},
    slotCounts: { bow: 1, deck: 6, utility: 3, mast: 2, platform: 2 },
    slots: [
      { id: "bow_1", type: "bow", x: 260, y: -20 },
      { id: "deck_1", type: "deck", x: 220, y: -38 },
      { id: "deck_2", type: "deck", x: 180, y: -42 },
      { id: "deck_3", type: "deck", x: 140, y: -44 },
      { id: "deck_4", type: "deck", x: 100, y: -44 },
      { id: "deck_5", type: "deck", x: 60, y: -42 },
      { id: "deck_6", type: "deck", x: 20, y: -38 },
      { id: "mast_1", type: "mast", x: 130, y: -100 },
      { id: "mast_2", type: "mast", x: 70, y: -95 },
      { id: "platform_1", type: "platform", x: 155, y: -72 },
      { id: "platform_2", type: "platform", x: 45, y: -72 },
      { id: "util_1", type: "utility", x: 110, y: -18 },
      { id: "util_2", type: "utility", x: 75, y: -18 },
      { id: "util_3", type: "utility", x: 40, y: -18 }
    ]
  },
  raptor: {
    id: "raptor",
    name: "Raptor",
    role: "Light Air Carrier",
    hullHp: 1600,
    bonusDesc: "Streamlined aerodynamic hull. Aircraft build 30% faster from Air Factories.",
    passive: { airBuildSpeedBonus: 0.30 },
    slotCounts: { bow: 1, deck: 4, utility: 4, mast: 3, platform: 1 },
    slots: [
      { id: "bow_1", type: "bow", x: 250, y: -20 },
      { id: "deck_1", type: "deck", x: 200, y: -36 },
      { id: "deck_2", type: "deck", x: 150, y: -40 },
      { id: "deck_3", type: "deck", x: 100, y: -40 },
      { id: "deck_4", type: "deck", x: 50, y: -36 },
      { id: "mast_1", type: "mast", x: 165, y: -105 },
      { id: "mast_2", type: "mast", x: 120, y: -110 },
      { id: "mast_3", type: "mast", x: 75, y: -100 },
      { id: "platform_1", type: "platform", x: 110, y: -70 },
      { id: "util_1", type: "utility", x: 140, y: -16 },
      { id: "util_2", type: "utility", x: 105, y: -16 },
      { id: "util_3", type: "utility", x: 70, y: -16 },
      { id: "util_4", type: "utility", x: 35, y: -16 }
    ]
  },
  bullshark: {
    id: "bullshark",
    name: "Bullshark",
    role: "Naval Foundry Capital",
    hullHp: 2200,
    bonusDesc: "Reinforced slipways. Naval units build 30% faster from Naval Factories.",
    passive: { navalBuildSpeedBonus: 0.30 },
    slotCounts: { bow: 1, deck: 6, utility: 3, mast: 1, platform: 2 },
    slots: [
      { id: "bow_1", type: "bow", x: 270, y: -20 },
      { id: "deck_1", type: "deck", x: 230, y: -38 },
      { id: "deck_2", type: "deck", x: 190, y: -42 },
      { id: "deck_3", type: "deck", x: 150, y: -44 },
      { id: "deck_4", type: "deck", x: 110, y: -44 },
      { id: "deck_5", type: "deck", x: 70, y: -42 },
      { id: "deck_6", type: "deck", x: 30, y: -38 },
      { id: "mast_1", type: "mast", x: 100, y: -95 },
      { id: "platform_1", type: "platform", x: 170, y: -74 },
      { id: "platform_2", type: "platform", x: 50, y: -74 },
      { id: "util_1", type: "utility", x: 120, y: -18 },
      { id: "util_2", type: "utility", x: 80, y: -18 },
      { id: "util_3", type: "utility", x: 40, y: -18 }
    ]
  },
  rockjaw: {
    id: "rockjaw",
    name: "Rockjaw",
    role: "High-Energy Laser Specialist",
    hullHp: 2100,
    bonusDesc: "Heavy capacitor bays. LasCannons build 40% faster and fire 40% faster.",
    passive: { lasCannonBuildBonus: 0.40, lasCannonFireBonus: 0.40 },
    slotCounts: { bow: 1, deck: 6, utility: 3, mast: 2, platform: 2 },
    slots: [
      { id: "bow_1", type: "bow", x: 260, y: -20 },
      { id: "deck_1", type: "deck", x: 220, y: -38 },
      { id: "deck_2", type: "deck", x: 180, y: -42 },
      { id: "deck_3", type: "deck", x: 140, y: -44 },
      { id: "deck_4", type: "deck", x: 100, y: -44 },
      { id: "deck_5", type: "deck", x: 60, y: -42 },
      { id: "deck_6", type: "deck", x: 20, y: -38 },
      { id: "mast_1", type: "mast", x: 140, y: -100 },
      { id: "mast_2", type: "mast", x: 80, y: -100 },
      { id: "platform_1", type: "platform", x: 160, y: -72 },
      { id: "platform_2", type: "platform", x: 40, y: -72 },
      { id: "util_1", type: "utility", x: 110, y: -18 },
      { id: "util_2", type: "utility", x: 70, y: -18 },
      { id: "util_3", type: "utility", x: 30, y: -18 }
    ]
  },
  eagle: {
    id: "eagle",
    name: "Eagle",
    role: "Heavy Air Superiority",
    hullHp: 1900,
    bonusDesc: "Aviation flight control bridge. Aircraft build 30% faster and gain +35% max HP.",
    passive: { airBuildSpeedBonus: 0.30, airHpBonus: 0.35 },
    slotCounts: { bow: 1, deck: 5, utility: 4, mast: 3, platform: 2 },
    slots: [
      { id: "bow_1", type: "bow", x: 260, y: -20 },
      { id: "deck_1", type: "deck", x: 215, y: -38 },
      { id: "deck_2", type: "deck", x: 170, y: -42 },
      { id: "deck_3", type: "deck", x: 125, y: -42 },
      { id: "deck_4", type: "deck", x: 80, y: -40 },
      { id: "deck_5", type: "deck", x: 35, y: -36 },
      { id: "mast_1", type: "mast", x: 180, y: -105 },
      { id: "mast_2", type: "mast", x: 130, y: -110 },
      { id: "mast_3", type: "mast", x: 70, y: -100 },
      { id: "platform_1", type: "platform", x: 145, y: -72 },
      { id: "platform_2", type: "platform", x: 45, y: -72 },
      { id: "util_1", type: "utility", x: 140, y: -18 },
      { id: "util_2", type: "utility", x: 105, y: -18 },
      { id: "util_3", type: "utility", x: 70, y: -18 },
      { id: "util_4", type: "utility", x: 35, y: -18 }
    ]
  },
  hammerhead: {
    id: "hammerhead",
    name: "Hammerhead",
    role: "Heavy Armor Dreadnought",
    hullHp: 3200,
    bonusDesc: "Thick monolithic titanium belt armor. Takes 20% less damage from all incoming weapons.",
    passive: { damageReduction: 0.20 },
    slotCounts: { bow: 1, deck: 4, utility: 3, mast: 1, platform: 2 },
    slots: [
      { id: "bow_1", type: "bow", x: 250, y: -20 },
      { id: "deck_1", type: "deck", x: 200, y: -40 },
      { id: "deck_2", type: "deck", x: 150, y: -44 },
      { id: "deck_3", type: "deck", x: 100, y: -44 },
      { id: "deck_4", type: "deck", x: 50, y: -40 },
      { id: "mast_1", type: "mast", x: 90, y: -95 },
      { id: "platform_1", type: "platform", x: 160, y: -74 },
      { id: "platform_2", type: "platform", x: 40, y: -74 },
      { id: "util_1", type: "utility", x: 120, y: -18 },
      { id: "util_2", type: "utility", x: 80, y: -18 },
      { id: "util_3", type: "utility", x: 40, y: -18 }
    ]
  },
  longbow: {
    id: "longbow",
    name: "Longbow",
    role: "Siege Artillery Platform",
    hullHp: 1800,
    bonusDesc: "Ballistic fire-control telemetry. Artillery and Railguns gain +30% range and +30% fire rate.",
    passive: { artilleryRangeBonus: 0.30, artilleryFireBonus: 0.30 },
    slotCounts: { bow: 1, deck: 6, utility: 3, mast: 2, platform: 2 },
    slots: [
      { id: "bow_1", type: "bow", x: 260, y: -20 },
      { id: "deck_1", type: "deck", x: 220, y: -38 },
      { id: "deck_2", type: "deck", x: 180, y: -42 },
      { id: "deck_3", type: "deck", x: 140, y: -44 },
      { id: "deck_4", type: "deck", x: 100, y: -44 },
      { id: "deck_5", type: "deck", x: 60, y: -42 },
      { id: "deck_6", type: "deck", x: 20, y: -38 },
      { id: "mast_1", type: "mast", x: 150, y: -105 },
      { id: "mast_2", type: "mast", x: 80, y: -100 },
      { id: "platform_1", type: "platform", x: 165, y: -72 },
      { id: "platform_2", type: "platform", x: 45, y: -72 },
      { id: "util_1", type: "utility", x: 110, y: -18 },
      { id: "util_2", type: "utility", x: 70, y: -18 },
      { id: "util_3", type: "utility", x: 30, y: -18 }
    ]
  },
  hurricane: {
    id: "hurricane",
    name: "Hurricane",
    role: "Turret Fortress",
    hullHp: 2300,
    bonusDesc: "High-cadence autoloaders. All defensive turrets and flak fire 35% faster.",
    passive: { turretFireBonus: 0.35 },
    slotCounts: { bow: 1, deck: 7, utility: 3, mast: 3, platform: 1 },
    slots: [
      { id: "bow_1", type: "bow", x: 270, y: -20 },
      { id: "deck_1", type: "deck", x: 235, y: -38 },
      { id: "deck_2", type: "deck", x: 200, y: -42 },
      { id: "deck_3", type: "deck", x: 165, y: -44 },
      { id: "deck_4", type: "deck", x: 130, y: -44 },
      { id: "deck_5", type: "deck", x: 95, y: -42 },
      { id: "deck_6", type: "deck", x: 60, y: -40 },
      { id: "deck_7", type: "deck", x: 25, y: -36 },
      { id: "mast_1", type: "mast", x: 175, y: -105 },
      { id: "mast_2", type: "mast", x: 125, y: -110 },
      { id: "mast_3", type: "mast", x: 75, y: -100 },
      { id: "platform_1", type: "platform", x: 100, y: -72 },
      { id: "util_1", type: "utility", x: 120, y: -18 },
      { id: "util_2", type: "utility", x: 80, y: -18 },
      { id: "util_3", type: "utility", x: 40, y: -18 }
    ]
  },
  blackrig: {
    id: "blackrig",
    name: "Blackrig",
    role: "Covert Tactical Specialist",
    hullHp: 1900,
    bonusDesc: "Radar-absorbent coating. Stealth duration +25%, and all tactical buildings require 1 fewer drone.",
    passive: { stealthDurationBonus: 0.25, tacticalDroneDiscount: 1 },
    slotCounts: { bow: 1, deck: 4, utility: 5, mast: 4, platform: 1 },
    slots: [
      { id: "bow_1", type: "bow", x: 250, y: -20 },
      { id: "deck_1", type: "deck", x: 200, y: -38 },
      { id: "deck_2", type: "deck", x: 150, y: -42 },
      { id: "deck_3", type: "deck", x: 100, y: -42 },
      { id: "deck_4", type: "deck", x: 50, y: -38 },
      { id: "mast_1", type: "mast", x: 180, y: -105 },
      { id: "mast_2", type: "mast", x: 140, y: -110 },
      { id: "mast_3", type: "mast", x: 95, y: -105 },
      { id: "mast_4", type: "mast", x: 55, y: -100 },
      { id: "platform_1", type: "platform", x: 110, y: -70 },
      { id: "util_1", type: "utility", x: 160, y: -18 },
      { id: "util_2", type: "utility", x: 125, y: -18 },
      { id: "util_3", type: "utility", x: 90, y: -18 },
      { id: "util_4", type: "utility", x: 55, y: -18 },
      { id: "util_5", type: "utility", x: 20, y: -18 }
    ]
  },
  rickshaw: {
    id: "rickshaw",
    name: "Rickshaw",
    role: "Fast-Expansion Skiff",
    hullHp: 1400,
    bonusDesc: "Low displacement skiff hull. Starts battle with 6 drones instead of 4.",
    passive: { extraStartingDrones: 2 },
    slotCounts: { bow: 1, deck: 4, utility: 6, mast: 2, platform: 1 },
    slots: [
      { id: "bow_1", type: "bow", x: 240, y: -20 },
      { id: "deck_1", type: "deck", x: 195, y: -36 },
      { id: "deck_2", type: "deck", x: 150, y: -40 },
      { id: "deck_3", type: "deck", x: 105, y: -40 },
      { id: "deck_4", type: "deck", x: 60, y: -36 },
      { id: "mast_1", type: "mast", x: 140, y: -95 },
      { id: "mast_2", type: "mast", x: 80, y: -95 },
      { id: "platform_1", type: "platform", x: 110, y: -68 },
      { id: "util_1", type: "utility", x: 175, y: -16 },
      { id: "util_2", type: "utility", x: 145, y: -16 },
      { id: "util_3", type: "utility", x: 115, y: -16 },
      { id: "util_4", type: "utility", x: 85, y: -16 },
      { id: "util_5", type: "utility", x: 55, y: -16 },
      { id: "util_6", type: "utility", x: 25, y: -16 }
    ]
  },
  flea: {
    id: "flea",
    name: "Flea",
    role: "Micro Swarmer",
    hullHp: 1100,
    bonusDesc: "Extremely compact micro-cruiser. Starts with 6 drones; building repair speed doubled.",
    passive: { extraStartingDrones: 2, repairSpeedMultiplier: 2.0 },
    slotCounts: { bow: 1, deck: 3, utility: 4, mast: 1, platform: 1 },
    slots: [
      { id: "bow_1", type: "bow", x: 210, y: -20 },
      { id: "deck_1", type: "deck", x: 160, y: -36 },
      { id: "deck_2", type: "deck", x: 110, y: -40 },
      { id: "deck_3", type: "deck", x: 60, y: -36 },
      { id: "mast_1", type: "mast", x: 85, y: -90 },
      { id: "platform_1", type: "platform", x: 120, y: -68 },
      { id: "util_1", type: "utility", x: 135, y: -16 },
      { id: "util_2", type: "utility", x: 100, y: -16 },
      { id: "util_3", type: "utility", x: 65, y: -16 },
      { id: "util_4", type: "utility", x: 30, y: -16 }
    ]
  },
  megalodon: {
    id: "megalodon",
    name: "Megalodon",
    role: "Ultraweapon Super-Cruiser",
    hullHp: 2800,
    bonusDesc: "Colossal multi-tier citadel. 9 deck slots with complete shield coverage; ultraweapons build 30% faster.",
    passive: { ultraweaponBuildSpeedBonus: 0.30 },
    slotCounts: { bow: 1, deck: 9, utility: 4, mast: 2, platform: 3 },
    slots: [
      { id: "bow_1", type: "bow", x: 320, y: -20 },
      { id: "deck_1", type: "deck", x: 280, y: -38 },
      { id: "deck_2", type: "deck", x: 245, y: -42 },
      { id: "deck_3", type: "deck", x: 210, y: -44 },
      { id: "deck_4", type: "deck", x: 175, y: -46 },
      { id: "deck_5", type: "deck", x: 140, y: -46 },
      { id: "deck_6", type: "deck", x: 105, y: -44 },
      { id: "deck_7", type: "deck", x: 70, y: -42 },
      { id: "deck_8", type: "deck", x: 35, y: -38 },
      { id: "deck_9", type: "deck", x: 0, y: -34 },
      { id: "mast_1", type: "mast", x: 190, y: -115 },
      { id: "mast_2", type: "mast", x: 90, y: -110 },
      { id: "platform_1", type: "platform", x: 220, y: -78 },
      { id: "platform_2", type: "platform", x: 140, y: -80 },
      { id: "platform_3", type: "platform", x: 60, y: -76 },
      { id: "util_1", type: "utility", x: 150, y: -18 },
      { id: "util_2", type: "utility", x: 110, y: -18 },
      { id: "util_3", type: "utility", x: 70, y: -18 },
      { id: "util_4", type: "utility", x: 30, y: -18 }
    ]
  },
  yetiCharger: {
    id: "yetiCharger",
    name: "Yeti Charger",
    role: "Mythic Apex Flagship",
    hullHp: 3500,
    bonusDesc: "Secret experimental flagship. All weapons deal +20% damage; shields recharge 50% faster.",
    passive: { weaponDamageBonus: 0.20, shieldRechargeBonus: 0.50 },
    slotCounts: { bow: 1, deck: 8, utility: 4, mast: 3, platform: 3 },
    slots: [
      { id: "bow_1", type: "bow", x: 310, y: -20 },
      { id: "deck_1", type: "deck", x: 270, y: -40 },
      { id: "deck_2", type: "deck", x: 230, y: -44 },
      { id: "deck_3", type: "deck", x: 190, y: -46 },
      { id: "deck_4", type: "deck", x: 150, y: -46 },
      { id: "deck_5", type: "deck", x: 110, y: -44 },
      { id: "deck_6", type: "deck", x: 70, y: -42 },
      { id: "deck_7", type: "deck", x: 30, y: -38 },
      { id: "deck_8", type: "deck", x: -5, y: -34 },
      { id: "mast_1", type: "mast", x: 200, y: -115 },
      { id: "mast_2", type: "mast", x: 130, y: -115 },
      { id: "mast_3", type: "mast", x: 60, y: -105 },
      { id: "platform_1", type: "platform", x: 215, y: -78 },
      { id: "platform_2", type: "platform", x: 130, y: -80 },
      { id: "platform_3", type: "platform", x: 45, y: -76 },
      { id: "util_1", type: "utility", x: 150, y: -18 },
      { id: "util_2", type: "utility", x: 110, y: -18 },
      { id: "util_3", type: "utility", x: 70, y: -18 },
      { id: "util_4", type: "utility", x: 30, y: -18 }
    ]
  }
};

// ── 2. Buildings Roster (Exactly 29 Buildings across 5 Categories) ──
export const BUILDINGS = {
  // FACTORIES (3)
  droneStation: {
    id: "droneStation",
    name: "Drone Station",
    category: "factories",
    allowedSlots: ["utility"],
    drones: 2,
    buildTime: 25,
    hp: 300,
    droneYield: 2,
    desc: "Houses 2 automated builder drones. Increases maximum drone pool by +2."
  },
  airFactory: {
    id: "airFactory",
    name: "Air Factory",
    category: "factories",
    allowedSlots: ["deck"],
    drones: 4,
    buildTime: 45,
    hp: 500,
    canProduce: ["bomber", "gunship", "fighter", "steamCopter", "spyPlane"],
    desc: "Fabricates and launches autonomous combat aircraft from the flight deck."
  },
  navalFactory: {
    id: "navalFactory",
    name: "Naval Factory",
    category: "factories",
    allowedSlots: ["deck"],
    drones: 4,
    buildTime: 45,
    hp: 500,
    canProduce: ["attackRib", "attackBoat", "frigate", "destroyer", "archonBattleship"],
    desc: "Fabricates and launches autonomous warships into the sea from lateral slipways."
  },

  // TACTICAL (8)
  shieldGenerator: {
    id: "shieldGenerator",
    name: "Shield Generator",
    category: "tactical",
    allowedSlots: ["deck"],
    drones: 5,
    buildTime: 60,
    hp: 450,
    shieldMaxHp: 800,
    shieldRadius: 180,
    shieldRechargeRate: 35,
    shieldRechargeDelay: 8.0,
    desc: "Projects a protective hex dome over adjacent slots. Absorbs all incoming damage until depleted."
  },
  localBooster: {
    id: "localBooster",
    name: "Local Booster",
    category: "tactical",
    allowedSlots: ["deck", "utility"],
    drones: 3,
    buildTime: 40,
    hp: 350,
    boosterRadius: 90,
    fireRateBuff: 0.25,
    buildSpeedBuff: 0.25,
    desc: "Overclocks adjacent structures (+25% fire rate and +25% construction speed)."
  },
  controlTower: {
    id: "controlTower",
    name: "Control Tower",
    category: "tactical",
    allowedSlots: ["mast"],
    drones: 4,
    buildTime: 50,
    hp: 400,
    unitSpeedBuff: 0.20,
    unitAccuracyBuff: 0.25,
    desc: "Air and naval command antenna. Buffs all active allied units (+20% speed, +25% accuracy)."
  },
  stealthGenerator: {
    id: "stealthGenerator",
    name: "Stealth Generator",
    category: "tactical",
    allowedSlots: ["mast"],
    drones: 5,
    buildTime: 70,
    hp: 420,
    stealthDuration: 30,
    cooldown: 45,
    desc: "Active ECM cloaking. Masks all cruiser buildings from enemy targeting and radar for 30 seconds."
  },
  spySatellite: {
    id: "spySatellite",
    name: "Spy Satellite",
    category: "tactical",
    allowedSlots: ["mast"],
    drones: 3,
    buildTime: 45,
    hp: 320,
    revealsEnemyBuilds: true,
    desc: "Orbital uplink. Continuously reveals enemy build orders, drone counts, and build queues."
  },
  pointDefenseLaser: {
    id: "pointDefenseLaser",
    name: "Point Defense Laser",
    category: "tactical",
    allowedSlots: ["mast", "deck"],
    drones: 4,
    buildTime: 55,
    hp: 380,
    range: 480,
    fireRate: 0.45,
    interceptsMissiles: true,
    interceptsShells: true,
    desc: "High-speed defensive beam. Vaporizes incoming artillery shells and missiles out of the sky."
  },
  jammerTower: {
    id: "jammerTower",
    name: "Jammer Tower",
    category: "tactical",
    allowedSlots: ["mast"],
    drones: 4,
    buildTime: 60,
    hp: 380,
    missileJamPct: 0.35,
    enemyBuildDelayPct: 0.20,
    desc: "Disrupts enemy missile homing (35% miss chance) and delays enemy drone build starts by 20%."
  },
  energyMatrix: {
    id: "energyMatrix",
    name: "Energy Matrix",
    category: "tactical",
    allowedSlots: ["utility"],
    drones: 3,
    buildTime: 45,
    hp: 360,
    globalShieldRechargeBonus: 0.50,
    desc: "Power distribution grid. Increases shield recharge rate by +50% across all allied shield generators."
  },

  // DEFENSIVE / TURRETS (6)
  shipTurret: {
    id: "shipTurret",
    name: "Ship Turret",
    category: "defensive",
    allowedSlots: ["deck"],
    drones: 2,
    buildTime: 20,
    hp: 400,
    range: 620,
    dmg: 24,
    fireRate: 1.0,
    targets: ["naval"],
    desc: "Rapid-fire deck gun. Effective at repelling incoming enemy surface ships at close-to-medium range."
  },
  antiAirTurret: {
    id: "antiAirTurret",
    name: "Anti-Air Turret",
    category: "defensive",
    allowedSlots: ["deck", "mast"],
    drones: 2,
    buildTime: 20,
    hp: 380,
    range: 680,
    dmg: 18,
    fireRate: 0.6,
    targets: ["air"],
    desc: "High-elevation twin flak autocannon. Shreds enemy fighters and harasser aircraft."
  },
  mortar: {
    id: "mortar",
    name: "Mortar",
    category: "defensive",
    allowedSlots: ["deck"],
    drones: 3,
    buildTime: 35,
    hp: 450,
    range: 980,
    dmg: 70,
    fireRate: 2.2,
    targets: ["naval"],
    poorAccuracyVsSmall: true,
    desc: "Heavy naval mortar. Deals massive damage to frigates and battleships, but misses small low-profile boats."
  },
  samSite: {
    id: "samSite",
    name: "SAM Site",
    category: "defensive",
    allowedSlots: ["mast", "deck"],
    drones: 4,
    buildTime: 50,
    hp: 480,
    range: 920,
    dmg: 90,
    fireRate: 2.5,
    targets: ["air"],
    guided: true,
    desc: "Surface-to-air guided missiles. Locks onto and destroys heavy bombers and gunships."
  },
  teslaCoil: {
    id: "teslaCoil",
    name: "Tesla Coil",
    category: "defensive",
    allowedSlots: ["deck"],
    drones: 4,
    buildTime: 45,
    hp: 550,
    range: 440,
    dmg: 52,
    fireRate: 1.2,
    targets: ["naval", "air"],
    chainCount: 2,
    desc: "Short-range high-voltage arc weapon. Jumps between multiple ships or aircraft that get too close."
  },
  flakBattery: {
    id: "flakBattery",
    name: "Flak Battery",
    category: "defensive",
    allowedSlots: ["mast"],
    drones: 4,
    buildTime: 45,
    hp: 460,
    range: 760,
    dmg: 36,
    fireRate: 1.0,
    targets: ["air"],
    aoeRadius: 45,
    desc: "Heavy flak battery detonating airburst shrapnel clouds. Devastates bunched aircraft squadrons."
  },

  // OFFENSIVE (7)
  artillery: {
    id: "artillery",
    name: "Artillery",
    category: "offensive",
    allowedSlots: ["deck", "platform"],
    drones: 6,
    buildTime: 180, // reference: 1080 drone-seconds
    hp: 600,
    range: 2400,
    dmg: 160,
    fireRate: 4.8,
    ballistic: true,
    targets: ["cruiser"],
    desc: "Heavy long-range siege cannon. Fires high-arc ballistic shells into the enemy battlecruiser."
  },
  railgun: {
    id: "railgun",
    name: "Railgun",
    category: "offensive",
    allowedSlots: ["platform"],
    drones: 7,
    buildTime: 140,
    hp: 650,
    range: 2600,
    dmg: 280,
    fireRate: 6.5,
    hypervelocity: true,
    targets: ["cruiser"],
    desc: "Electromagnetic kinetic accelerator. Fires ultra-high-velocity slugs with massive penetration."
  },
  rocketLauncher: {
    id: "rocketLauncher",
    name: "Rocket Launcher",
    category: "offensive",
    allowedSlots: ["deck"],
    drones: 5,
    buildTime: 90,
    hp: 520,
    range: 2100,
    dmg: 32,
    volleyCount: 6,
    fireRate: 4.2,
    targets: ["cruiser", "naval"],
    desc: "Saturation rocket pods. Fires volleys of 6 rockets; effective at overwhelming distributed shields."
  },
  lasCannon: {
    id: "lasCannon",
    name: "LasCannon",
    category: "offensive",
    allowedSlots: ["deck", "platform"],
    drones: 10,
    buildTime: 120, // reference: 1200 drone-seconds
    hp: 700,
    range: 2200,
    beamDuration: 5.0,
    beamDps: 95,
    fireRate: 8.5,
    targets: ["cruiser", "naval"],
    desc: "Pinpoint thermal beam firing continuous 5s blasts. Can vaporize individual enemy buildings and warships."
  },
  ionCannon: {
    id: "ionCannon",
    name: "Ion Cannon",
    category: "offensive",
    allowedSlots: ["bow"], // strictly BOW only!
    drones: 7,
    buildTime: 90,
    hp: 750,
    range: 2400,
    beamDuration: 4.0,
    beamDps: 150,
    fireRate: 7.5,
    bowOnly: true,
    straightHorizontalBeam: true,
    missesLowProfile: true,
    targets: ["cruiser", "naval"],
    desc: "Bow-mounted heavy particle beam. Fires dead straight ahead: shreds enemy hull and large ships, but misses top decks and low-profile boats."
  },
  broadsides: {
    id: "broadsides",
    name: "Broadsides",
    category: "offensive",
    allowedSlots: ["deck"],
    drones: 6,
    buildTime: 110,
    hp: 680,
    range: 1500,
    dmg: 48,
    salvoCount: 4,
    fireRate: 3.4,
    targets: ["cruiser", "naval"],
    desc: "Battleship-style heavy cannon battery. Fires thunderous 4-shell horizontal broadside salvos."
  },
  floatingLaserBattery: {
    id: "floatingLaserBattery",
    name: "Floating Laser Battery",
    category: "offensive",
    allowedSlots: ["deck"],
    drones: 5,
    buildTime: 80,
    hp: 480,
    range: 1300,
    dmg: 40,
    fireRate: 1.6,
    deploysBuoy: true,
    desc: "Deploys an autonomous floating laser platform directly into the water forward of the cruiser."
  },

  // ULTRAWEAPONS & SUPERWEAPONS (5)
  nukeLauncher: {
    id: "nukeLauncher",
    name: "Nuke Launcher",
    category: "ultraweapons",
    allowedSlots: ["platform"],
    drones: 8,
    buildTime: 360, // 6 MINUTES!
    hp: 950,
    oneHitWin: true,
    sirenThreshold: 0.80,
    limitOne: true,
    desc: "Strategic ICBM silo. 6-minute build. Visible to the enemy with audio sirens at 80%. When fired, instantly annihilates the enemy cruiser."
  },
  deathstarSatellite: {
    id: "deathstarSatellite",
    name: "Deathstar Satellite",
    category: "ultraweapons",
    allowedSlots: ["platform"],
    drones: 8,
    buildTime: 240,
    hp: 800,
    orbitalSweep: true,
    beamDps: 190,
    shieldBreaker: true,
    limitOne: true,
    desc: "Orbital laser platform. Sweeps a devastating beam across the enemy battlecruiser, instantly popping shields."
  },
  ultraliskFabrication: {
    id: "ultraliskFabrication",
    name: "Ultralisk Fabrication Facility",
    category: "ultraweapons",
    allowedSlots: ["platform"],
    drones: 7,
    buildTime: 200,
    hp: 750,
    globalBuildSpeedMultiplier: 2.0,
    limitOne: true,
    desc: "Hyper-automated nano-foundry. Doubles construction speed (+100%) for all allied buildings and units."
  },
  kamikazeSignal: {
    id: "kamikazeSignal",
    name: "Kamikaze Signal",
    category: "ultraweapons",
    allowedSlots: ["platform"],
    drones: 6,
    buildTime: 150,
    hp: 700,
    aircraftDiveBomb: true,
    limitOne: true,
    desc: "Emergency strike broadcast. Commands all active allied aircraft to dive directly into the enemy cruiser as explosive cruise missiles."
  },
  broadsword: {
    id: "broadsword",
    name: "Broadsword",
    category: "ultraweapons",
    allowedSlots: ["platform"],
    drones: 9,
    buildTime: 260,
    hp: 850,
    bombardmentCount: 14,
    bombardmentDmg: 95,
    limitOne: true,
    desc: "Super-heavy orbital kinetic bombardment. Calls down 14 kinetic strike rods showering the enemy hull."
  }
};

// ── 3. Units Roster (10 Units: 5 Naval, 5 Air) ──
export const UNITS = {
  // NAVAL (Produced by Naval Factory)
  attackRib: {
    id: "attackRib",
    name: "AttackRIB",
    domain: "naval",
    hp: 85,
    speed: 180,
    dmg: 14,
    fireRate: 0.8,
    range: 360,
    lowProfile: true, // immune to straight IonCannon and Mortar shells miss!
    drones: 2,
    buildTime: 14,
    desc: "Tiny high-speed rigid inflatable boat with mounted gun. Low profile makes it immune to horizontal IonCannons and Mortars."
  },
  attackBoat: {
    id: "attackBoat",
    name: "AttackBoat",
    domain: "naval",
    hp: 170,
    speed: 145,
    dmg: 26,
    fireRate: 1.1,
    range: 430,
    lowProfile: true,
    drones: 2,
    buildTime: 20,
    desc: "Fast coastal attack gunboat. Skims low across the water line; difficult for heavy artillery and mortars to hit."
  },
  frigate: {
    id: "frigate",
    name: "Frigate",
    domain: "naval",
    hp: 380,
    speed: 100,
    dmg: 48,
    fireRate: 1.8,
    range: 590,
    lowProfile: false,
    drones: 3,
    buildTime: 32,
    desc: "Medium multi-role warship equipped with a rapid deck gun. Forms the backbone of surface fleet engagements."
  },
  destroyer: {
    id: "destroyer",
    name: "Destroyer",
    domain: "naval",
    hp: 700,
    speed: 75,
    dmg: 80,
    fireRate: 2.2,
    range: 760,
    lowProfile: false,
    drones: 4,
    buildTime: 48,
    desc: "Heavy fleet escort equipped with long-range dual cannons and anti-air flak pods."
  },
  archonBattleship: {
    id: "archonBattleship",
    name: "Archon Battleship",
    domain: "naval",
    hp: 1750,
    speed: 45,
    dmg: 150,
    fireRate: 2.8,
    range: 950,
    lowProfile: false,
    drones: 6,
    buildTime: 90,
    desc: "Colossal surface capital ship with immense hull plating and dual triple-barreled heavy turrets."
  },

  // AIR (Produced by Air Factory)
  steamCopter: {
    id: "steamCopter",
    name: "SteamCopter",
    domain: "air",
    hp: 95,
    speed: 195,
    dmg: 16,
    fireRate: 0.7,
    range: 390,
    altitude: -120,
    drones: 2,
    buildTime: 16,
    desc: "Light agile rotorcraft designed for early harassment of surface ships and deck buildings."
  },
  fighter: {
    id: "fighter",
    name: "Fighter",
    domain: "air",
    hp: 190,
    speed: 270,
    dmg: 34,
    fireRate: 0.6,
    range: 460,
    targetsAir: true,
    altitude: -175,
    drones: 3,
    buildTime: 24,
    desc: "High-speed air superiority interceptor. Actively hunts and shoots down enemy aircraft."
  },
  gunship: {
    id: "gunship",
    name: "Gunship",
    domain: "air",
    hp: 360,
    speed: 125,
    dmg: 54,
    fireRate: 1.2,
    range: 520,
    altitude: -115,
    drones: 3,
    buildTime: 36,
    desc: "Armored VTOL strafing gunship. Hovers and rains autocannon fire upon surface warships and deck structures."
  },
  bomber: {
    id: "bomber",
    name: "Bomber",
    domain: "air",
    hp: 440,
    speed: 145,
    bombDmg: 190,
    fireRate: 3.5,
    altitude: -155,
    drones: 4,
    buildTime: 45,
    desc: "Heavy ordnance bomber. Flies over the enemy cruiser to drop bunker-busting payloads on structures."
  },
  spyPlane: {
    id: "spyPlane",
    name: "Spy Plane",
    domain: "air",
    hp: 150,
    speed: 310,
    revealsIntel: true,
    altitude: -230,
    drones: 2,
    buildTime: 20,
    desc: "High-altitude reconnaissance aircraft. Bypasses ground defenses to reveal enemy structures and construction."
  }
};

// ── 4. 24 Scripted Bosses with Lore, Cruisers, and Gimmicks ──
export const BOSSES = [
  {
    id: 1,
    name: "SCRAPWICK",
    title: "Rust Scavenger",
    cruiser: "trident",
    taunt: "Just picked this rust bucket off the reef. Let's see if your cannons even fire!",
    openingBuild: ["droneStation", "shipTurret", "navalFactory", "frigate"],
    gimmick: "Tutorial boss: slow build pace, relies entirely on basic Ship Turrets and Frigates.",
    parTime: 180
  },
  {
    id: 2,
    name: "RUSTY GRETA",
    title: "Swarm Raider",
    cruiser: "rickshaw",
    taunt: "My AttackRIBs will chew through your hull before your first drone even boots up!",
    openingBuild: ["droneStation", "navalFactory", "navalFactory", "attackRib", "attackRib", "attackRib"],
    gimmick: "Spams cheap AttackRIBs early to punish players who fail to construct early defenses.",
    parTime: 170
  },
  {
    id: 3,
    name: "LT. BOLTZ",
    title: "Siege Specialist",
    cruiser: "trident",
    taunt: "Two artillery batteries sighted on your bridge. Better hope your hull doesn't buckle!",
    openingBuild: ["droneStation", "droneStation", "artillery", "artillery"],
    gimmick: "Early double Artillery rush from maximum range.",
    parTime: 220
  },
  {
    id: 4,
    name: "THE PIGEONEER",
    title: "Wing Commander",
    cruiser: "eagle",
    taunt: "Look to the clouds, captain! The skies belong to my bomber squadrons!",
    openingBuild: ["droneStation", "airFactory", "airFactory", "bomber", "bomber", "fighter"],
    gimmick: "Heavy bomber air rush. Demands Anti-Air Turrets and SAM sites.",
    parTime: 200
  },
  {
    id: 5,
    name: "COMMODORE KLANG",
    title: "Fleet Admiral",
    cruiser: "bullshark",
    taunt: "A steady tide of steel will wash over your cruiser! Full steam ahead!",
    openingBuild: ["droneStation", "navalFactory", "navalFactory", "frigate", "destroyer", "frigate"],
    gimmick: "Relentless stream of Frigates and heavy Destroyers from slipways.",
    parTime: 240
  },
  {
    id: 6,
    name: "MADAM SPARKS",
    title: "Arc Engineer",
    cruiser: "hurricane",
    taunt: "Touch my hull and you will be grounded into slag! Tesla coils charged!",
    openingBuild: ["droneStation", "shieldGenerator", "teslaCoil", "teslaCoil", "shieldGenerator"],
    gimmick: "Turtles behind layered shields and Tesla Coils before launching counter-battery fire.",
    parTime: 240
  },
  {
    id: 7,
    name: "ORBITRON",
    title: "Rotor Ace",
    cruiser: "raptor",
    taunt: "Gunships incoming every forty-five seconds on the dot. Time to dance!",
    openingBuild: ["droneStation", "airFactory", "gunship", "gunship", "controlTower"],
    gimmick: "Launches coordinated Gunship strike waves every 45 seconds.",
    parTime: 210
  },
  {
    id: 8,
    name: "DR. MAGNETO-9",
    title: "Kinetic Savant",
    cruiser: "longbow",
    taunt: "My electromagnetic rail-accelerators out-range your puny deck guns by nautical miles!",
    openingBuild: ["droneStation", "droneStation", "railgun", "artillery", "artillery"],
    gimmick: "Massive range advantage; bombards player from outside standard turret response radius.",
    parTime: 250
  },
  {
    id: 9,
    name: "THE ACCOUNTANT",
    title: "Drone Arch-Logician",
    cruiser: "flea",
    taunt: "Compound interest, captain. My drone compound will overwhelm you mathematically!",
    openingBuild: ["droneStation", "droneStation", "droneStation", "droneStation", "droneStation"],
    gimmick: "Builds massive drone swarm early, resulting in an overwhelming high-tech late-game spike.",
    parTime: 240
  },
  {
    id: 10,
    name: "LADY LUMEN",
    title: "Photon Empress",
    cruiser: "rockjaw",
    taunt: "Focus the lenses! Let us see how long your decks survive a concentrated solar burn!",
    openingBuild: ["droneStation", "droneStation", "lasCannon", "lasCannon", "lasCannon"],
    gimmick: "Triple LasCannon build. Wipes individual structures rapidly unless shielded.",
    parTime: 230
  },
  {
    id: 11,
    name: "GRIMGEAR",
    title: "Iron Titan",
    cruiser: "hammerhead",
    taunt: "Fire all you want. My armor plates were forged to outlast nations!",
    openingBuild: ["droneStation", "shipTurret", "mortar", "broadsides", "shieldGenerator"],
    gimmick: "Extremely high hull HP and damage reduction. Player must sustain high DPS to win.",
    parTime: 280
  },
  {
    id: 12,
    name: "SPECTRA",
    title: "Ghost in the Fog",
    cruiser: "blackrig",
    taunt: "You are shooting at shadows on the radar, captain. Where am I truly aiming?",
    openingBuild: ["droneStation", "stealthGenerator", "railgun", "rocketLauncher", "stealthGenerator"],
    gimmick: "Stealth Generator maintains perpetual cloak; player cannot see what weapons are being constructed.",
    parTime: 220
  },
  {
    id: 13,
    name: "BOSUN BARNACLE",
    title: "Dreadnought Builder",
    cruiser: "bullshark",
    taunt: "In six minutes, the Archon Battleship will slide into the brine. Your doom approaches!",
    openingBuild: ["droneStation", "droneStation", "navalFactory", "archonBattleship"],
    gimmick: "Rushes an Archon Battleship at 6 minutes; player must rush down the Naval Factory.",
    parTime: 270
  },
  {
    id: 14,
    name: "THE TWINS",
    title: "Dual Admirals",
    cruiser: "rickshaw",
    taunt: "Two cruisers, one target. Divide your fire and fall to pieces!",
    openingBuild: ["droneStation", "shipTurret", "airFactory", "navalFactory"],
    gimmick: "Dual cruiser battle: twin enemy battlecruisers firing alternating volleys.",
    parTime: 260
  },
  {
    id: 15,
    name: "IONA",
    title: "Particle Vanguard",
    cruiser: "trident",
    taunt: "Bow energy conduits engaged! Clear the horizon of their flagship!",
    openingBuild: ["droneStation", "droneStation", "ionCannon", "shieldGenerator", "shieldGenerator"],
    gimmick: "Bow Ion Cannon rush aiming directly at player's hull waterline.",
    parTime: 210
  },
  {
    id: 16,
    name: "HAILSTONE",
    title: "Air Denier",
    cruiser: "hurricane",
    taunt: "Launch all the planes you want. Nothing with wings survives in my airspace!",
    openingBuild: ["droneStation", "antiAirTurret", "samSite", "flakBattery", "airFactory", "fighter"],
    gimmick: "Impenetrable anti-air and fighter screen. Renders player air wings useless; forces naval tactics.",
    parTime: 240
  },
  {
    id: 17,
    name: "THE REPAIRMAN",
    title: "Chief Engineer",
    cruiser: "hammerhead",
    taunt: "Damage control active! Every scratch you make is welded shut in seconds!",
    openingBuild: ["droneStation", "droneStation", "droneStation", "shieldGenerator", "mortar"],
    gimmick: "Massive repair rate. Drones heal damaged structures and hull nearly instantly; burst DPS required.",
    parTime: 260
  },
  {
    id: 18,
    name: "VOLTRINA",
    title: "Orbital Striker",
    cruiser: "megalodon",
    taunt: "Satellite coordinates locked. When the orbital lens focuses, your ship burns from above!",
    openingBuild: ["droneStation", "droneStation", "deathstarSatellite", "shieldGenerator"],
    gimmick: "Deathstar Satellite comes online at minute 8, wiping shields and high-value structures.",
    parTime: 320
  },
  {
    id: 19,
    name: "BARON KABOOM",
    title: "Zeppelin Fanatic",
    cruiser: "eagle",
    taunt: "Witness glorious aeronautical sacrifice! All wings, dive on their bridge!",
    openingBuild: ["droneStation", "airFactory", "airFactory", "kamikazeSignal"],
    gimmick: "Triggers Kamikaze Signal whenever 10+ aircraft are in flight, sending them plunging into player hull.",
    parTime: 230
  },
  {
    id: 20,
    name: "CHRONOSTAT",
    title: "Temporal Machinist",
    cruiser: "megalodon",
    taunt: "Time is malleable. My Ultralisk facility doubles our output while you stand still!",
    openingBuild: ["droneStation", "droneStation", "ultraliskFabrication", "artillery", "lasCannon"],
    gimmick: "Ultralisk Facility doubles all build speeds after minute 5, snowballing production.",
    parTime: 260
  },
  {
    id: 21,
    name: "WIDOWMAKER",
    title: "Nuclear Harbinger",
    cruiser: "longbow",
    taunt: "The clock is ticking, captain. Six minutes to nuclear baptism. Can you reach me in time?",
    openingBuild: ["droneStation", "droneStation", "nukeLauncher", "shieldGenerator", "pointDefenseLaser"],
    gimmick: "Starts a Nuke Launcher at minute 2; race against time to destroy the silo before it fires.",
    parTime: 300
  },
  {
    id: 22,
    name: "THE ARMADA",
    title: "Flotilla High Command",
    cruiser: "trident",
    taunt: "Three cruisers in echelon formation! The center shields the wings!",
    openingBuild: ["droneStation", "shieldGenerator", "shieldGenerator", "broadsides", "navalFactory"],
    gimmick: "Three-cruiser line battle: middle cruiser shields the flanks while weapons cross-fire.",
    parTime: 340
  },
  {
    id: 23,
    name: "ADMIRAL ZERO",
    title: "The Adaptive Mind",
    cruiser: "megalodon",
    taunt: "I have calculated every branch of your strategy. Whatever you build, I construct the counter.",
    openingBuild: ["droneStation", "droneStation", "shieldGenerator", "lasCannon"],
    gimmick: "Highly adaptive AI: scans player's composition every 10 seconds and builds exact hard counters.",
    parTime: 290
  },
  {
    id: 24,
    name: "OVERLORD PRIME",
    title: "Supreme Apex Core",
    cruiser: "yetiCharger",
    taunt: "I am the culmination of naval warfare. Your obsolescence will be swift and absolute!",
    openingBuild: ["droneStation", "droneStation", "ionCannon", "deathstarSatellite", "broadsword"],
    gimmick: "Final campaign boss. 3 phases at 66% and 33% HP unlocking a new ultraweapon each phase.",
    parTime: 360
  }
];

// ── 5. Campaign Progression (40 Levels Matrix) ──
export const CAMPAIGN_LEVELS = Array.from({ length: 40 }, (_, idx) => {
  const levelNum = idx + 1;
  const bossIndex = Math.min(BOSSES.length - 1, Math.floor((idx / 40) * BOSSES.length));
  const boss = BOSSES[bossIndex];

  // Unlocks definition
  let unlock = null;
  if (levelNum === 1) unlock = { type: "cruiser", id: "trident", name: "Trident Cruiser" };
  else if (levelNum === 2) unlock = { type: "building", id: "mortar", name: "Mortar" };
  else if (levelNum === 3) unlock = { type: "unit", id: "attackBoat", name: "AttackBoat" };
  else if (levelNum === 4) unlock = { type: "building", id: "samSite", name: "SAM Site" };
  else if (levelNum === 5) unlock = { type: "cruiser", id: "raptor", name: "Raptor Cruiser" };
  else if (levelNum === 6) unlock = { type: "unit", id: "gunship", name: "Gunship" };
  else if (levelNum === 7) unlock = { type: "building", id: "teslaCoil", name: "Tesla Coil" };
  else if (levelNum === 8) unlock = { type: "cruiser", id: "bullshark", name: "Bullshark Cruiser" };
  else if (levelNum === 9) unlock = { type: "unit", id: "destroyer", name: "Destroyer" };
  else if (levelNum === 10) unlock = { type: "building", id: "shieldGenerator", name: "Shield Generator" };
  else if (levelNum === 11) unlock = { type: "cruiser", id: "rockjaw", name: "Rockjaw Cruiser" };
  else if (levelNum === 12) unlock = { type: "building", id: "lasCannon", name: "LasCannon" };
  else if (levelNum === 13) unlock = { type: "cruiser", id: "eagle", name: "Eagle Cruiser" };
  else if (levelNum === 14) unlock = { type: "building", id: "localBooster", name: "Local Booster" };
  else if (levelNum === 15) unlock = { type: "cruiser", id: "hammerhead", name: "Hammerhead Cruiser" };
  else if (levelNum === 16) unlock = { type: "building", id: "broadsides", name: "Broadsides" };
  else if (levelNum === 17) unlock = { type: "cruiser", id: "longbow", name: "Longbow Cruiser" };
  else if (levelNum === 18) unlock = { type: "building", id: "railgun", name: "Railgun" };
  else if (levelNum === 19) unlock = { type: "cruiser", id: "hurricane", name: "Hurricane Cruiser" };
  else if (levelNum === 20) unlock = { type: "building", id: "flakBattery", name: "Flak Battery" };
  else if (levelNum === 21) unlock = { type: "cruiser", id: "blackrig", name: "Blackrig Cruiser" };
  else if (levelNum === 22) unlock = { type: "building", id: "stealthGenerator", name: "Stealth Generator" };
  else if (levelNum === 23) unlock = { type: "cruiser", id: "rickshaw", name: "Rickshaw Cruiser" };
  else if (levelNum === 24) unlock = { type: "unit", id: "archonBattleship", name: "Archon Battleship" };
  else if (levelNum === 25) unlock = { type: "building", id: "ionCannon", name: "Ion Cannon" };
  else if (levelNum === 26) unlock = { type: "cruiser", id: "flea", name: "Flea Cruiser" };
  else if (levelNum === 27) unlock = { type: "building", id: "pointDefenseLaser", name: "Point Defense Laser" };
  else if (levelNum === 28) unlock = { type: "building", id: "deathstarSatellite", name: "Deathstar Satellite" };
  else if (levelNum === 29) unlock = { type: "cruiser", id: "megalodon", name: "Megalodon Cruiser" };
  else if (levelNum === 30) unlock = { type: "building", id: "ultraliskFabrication", name: "Ultralisk Facility" };
  else if (levelNum === 31) unlock = { type: "building", id: "kamikazeSignal", name: "Kamikaze Signal" };
  else if (levelNum === 32) unlock = { type: "building", id: "nukeLauncher", name: "Nuke Launcher" };
  else if (levelNum === 33) unlock = { type: "building", id: "broadsword", name: "Broadsword Superweapon" };
  else if (levelNum === 34) unlock = { type: "building", id: "floatingLaserBattery", name: "Floating Laser Battery" };
  else if (levelNum === 35) unlock = { type: "building", id: "jammerTower", name: "Jammer Tower" };
  else if (levelNum === 36) unlock = { type: "building", id: "energyMatrix", name: "Energy Matrix" };
  else if (levelNum === 37) unlock = { type: "unit", id: "spyPlane", name: "Spy Plane" };
  else if (levelNum === 38) unlock = { type: "building", id: "rocketLauncher", name: "Rocket Launcher" };
  else if (levelNum === 39) unlock = { type: "building", id: "controlTower", name: "Control Tower" };
  else if (levelNum === 40) unlock = { type: "cruiser", id: "yetiCharger", name: "Yeti Charger Apex Cruiser" };

  return {
    level: levelNum,
    title: `SECTOR ${levelNum} // VS ${boss.name}`,
    bossId: boss.id,
    parTime: Math.max(140, boss.parTime - Math.floor(idx * 1.5)),
    scrapReward: 50 + idx * 15,
    unlock
  };
});

// Initial unlocked loadout at Level 1
export const STARTER_LOADOUT = {
  cruisers: ["trident"],
  buildings: [
    "droneStation",
    "shipTurret",
    "antiAirTurret",
    "airFactory",
    "navalFactory",
    "artillery"
  ],
  units: [
    "frigate",
    "bomber",
    "fighter",
    "attackRib",
    "steamCopter"
  ]
};

// ── 6. Economy & Drone System Logic ──
export function createDroneEconomy(initialDrones = 4) {
  return {
    maxDrones: initialDrones,
    idleDrones: initialDrones,
    assignedDrones: 0,
    activeBuilds: [],
    queue: []
  };
}

export function canStartBuild(economy, buildingSpec) {
  return economy.idleDrones >= buildingSpec.drones;
}

export function startConstruction(economy, slotId, buildingId, buildingSpec, buildSpeedMultiplier = 1.0) {
  if (!canStartBuild(economy, buildingSpec)) {
    // Add to queue
    const queuedItem = { slotId, buildingId, buildingSpec, buildSpeedMultiplier };
    economy.queue.push(queuedItem);
    return { success: false, queued: true };
  }

  // Allocate drones
  economy.idleDrones -= buildingSpec.drones;
  economy.assignedDrones += buildingSpec.drones;

  const build = {
    slotId,
    buildingId,
    dronesLocked: buildingSpec.drones,
    progress: 0,
    totalDuration: buildingSpec.buildTime / buildSpeedMultiplier,
    isComplete: false
  };

  economy.activeBuilds.push(build);
  return { success: true, queued: false, build };
}

export function updateDroneEconomy(economy, dt, onComplete) {
  for (let i = economy.activeBuilds.length - 1; i >= 0; i--) {
    const b = economy.activeBuilds[i];
    b.progress += dt;
    if (b.progress >= b.totalDuration) {
      b.isComplete = true;
      // Free drones
      economy.idleDrones += b.dronesLocked;
      economy.assignedDrones -= b.dronesLocked;
      economy.activeBuilds.splice(i, 1);

      if (onComplete) onComplete(b);

      // Check if queued items can now start
      checkBuildQueue(economy, onComplete);
    }
  }
}

export function checkBuildQueue(economy, onComplete) {
  for (let i = 0; i < economy.queue.length; i++) {
    const q = economy.queue[i];
    if (canStartBuild(economy, q.buildingSpec)) {
      economy.queue.splice(i, 1);
      startConstruction(economy, q.slotId, q.buildingId, q.buildingSpec, q.buildSpeedMultiplier);
      i--; // adjust index after removal
    }
  }
}

// ── 7. Tech Lab Upgrades & Progression ──
export const TECH_LAB_UPGRADES = {
  hullArmor: {
    id: "hullArmor",
    name: "Reinforced Belt Armor",
    maxTier: 5,
    costs: [100, 200, 350, 550, 800],
    effectPerTier: 0.05, // +5% hull HP per tier
    desc: "+5% cruiser maximum hull HP per tier."
  },
  startingDrones: {
    id: "startingDrones",
    name: "Expanded Drone Bay",
    maxTier: 2,
    costs: [250, 600],
    effectPerTier: 1, // +1 starting drone per tier
    desc: "+1 starting drone at battle launch (up to +2 drones)."
  },
  buildSpeed: {
    id: "buildSpeed",
    name: "High-Frequency Assemblers",
    maxTier: 5,
    costs: [120, 250, 420, 650, 950],
    effectPerTier: 0.05, // +5% build speed per tier
    desc: "+5% faster construction speed across all structures."
  },
  shieldRecharge: {
    id: "shieldRecharge",
    name: "Capacitor Boosters",
    maxTier: 5,
    costs: [110, 220, 380, 580, 850],
    effectPerTier: 0.10, // +10% recharge speed
    desc: "+10% shield regeneration speed per tier."
  },
  nanocoat: {
    id: "nanocoat",
    name: "Reactive Nanocoat",
    maxTier: 1,
    costs: [500],
    effectPerTier: 0.05, // -5% damage taken
    desc: "Advanced self-healing hull coating. Reduces all incoming damage by 5%."
  }
};

export function calculateUpgradedHull(baseHp, armorTier, hasNanocoat) {
  const armorBonus = 1 + armorTier * 0.05;
  const nanocoatReduction = hasNanocoat ? 0.95 : 1.0;
  return Math.round((baseHp * armorBonus) / nanocoatReduction);
}

// ── 8. Combat Calculations & Special Mechanics ──

/**
 * Ion Cannon Rules:
 * - Must be placed strictly in BOW slot.
 * - Fires straight horizontal beam across water line.
 * - Cannot aim up at top deck structures (only hits bow/hull/low structures).
 * - Misses low-profile targets (AttackRIB and AttackBoat).
 */
export function canIonCannonHitTarget(target) {
  if (target.lowProfile) return false;
  // If target is building, only hits low deck / bow slots (y > -50)
  if (target.slotType && target.slotType !== "bow" && target.y < -50) return false;
  return true;
}

/**
 * Shield generator dome coverage calculation.
 * Returns true if target slot is within shield generator's coverage radius.
 */
export function isSlotShieldProtected(shieldSlotPos, targetSlotPos, radius = 180) {
  const dx = shieldSlotPos.x - targetSlotPos.x;
  const dy = shieldSlotPos.y - targetSlotPos.y;
  return Math.hypot(dx, dy) <= radius;
}

/**
 * Local Booster adjacent slot check.
 * Returns true if slot is within booster radius (90px).
 */
export function isAdjacentToBooster(boosterPos, slotPos, radius = 90) {
  const dx = boosterPos.x - slotPos.x;
  const dy = boosterPos.y - slotPos.y;
  return Math.hypot(dx, dy) <= radius;
}

/**
 * Calculate stars awarded for a victory:
 * 1 star: Victory achieved
 * 2 stars: Won under par time
 * 3 stars: No buildings lost during combat
 */
export function calculateStars(won, elapsedSeconds, parTime, buildingsLost) {
  if (!won) return 0;
  let stars = 1;
  if (elapsedSeconds <= parTime) stars++;
  if (buildingsLost === 0) stars++;
  return stars;
}

/**
 * AI Decision Engine:
 * Analyzes player threat composition and picks appropriate counter.
 */
export function evaluateEnemyAiDecision(playerUnits, playerBuildings) {
  let airThreat = 0;
  let navalThreat = 0;
  let beamThreat = 0;
  let siegeThreat = 0;

  playerUnits.forEach((u) => {
    if (u.domain === "air") airThreat++;
    if (u.domain === "naval") navalThreat++;
  });

  playerBuildings.forEach((b) => {
    if (b.buildingId === "lasCannon" || b.buildingId === "ionCannon") beamThreat++;
    if (b.buildingId === "artillery" || b.buildingId === "railgun") siegeThreat++;
  });

  if (airThreat >= 3) return { priority: "counter_air", recommended: ["antiAirTurret", "samSite", "flakBattery"] };
  if (navalThreat >= 2) return { priority: "counter_naval", recommended: ["mortar", "shipTurret", "teslaCoil"] };
  if (beamThreat >= 2 || siegeThreat >= 2) return { priority: "counter_siege", recommended: ["shieldGenerator", "pointDefenseLaser"] };

  return { priority: "offensive_push", recommended: ["artillery", "lasCannon", "navalFactory", "airFactory"] };
}

// ── 9. Save / Load & Code Export ──
export function exportSaveCode(saveData) {
  try {
    const json = JSON.stringify(saveData);
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return "";
  }
}

export function importSaveCode(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
