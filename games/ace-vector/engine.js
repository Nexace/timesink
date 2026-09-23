/**
 * ACE VECTOR — Pure Flight Dynamics, Terrain & Combat Engine
 * Exports aircraft rosters, enemy classes, mountain terrain collision,
 * atmospheric strata modeling, and energy-maneuverability physics.
 */

// ── 1. World & Strata Dimensions ──
export const WORLD_WIDTH = 14000;
export const WORLD_HEIGHT = 5400;
export const CEILING_Y = 200;
export const STRATOSPHERE_FLOOR_Y = 2200;
export const CLOUD_DECK_TOP_Y = 2200;
export const CLOUD_DECK_BOTTOM_Y = 3500;
export const LOW_ALTITUDE_TOP_Y = 3500;
export const SEA_LEVEL_Y = 5200;
export const GRAVITY = 85;

// ── 2. Playable Aircraft Roster (5 Unique Fighters) ──
export const AIRCRAFT_ROSTER = {
  f22: {
    id: "f22",
    name: "F-22A Raptor",
    callsign: "RAPTOR",
    role: "Stealth Air Dominance",
    maxSpeed: 960,
    minSpeed: 140,
    stallSpeed: 160,
    pitchRate: 2.8,
    hp: 110,
    maxHp: 110,
    cannonDmg: 30,
    cannonFireRate: 0.08,
    cannonVelocity: 900,
    missilesCount: 6,
    missileType: "AIM-120", // radar guided
    flaresCount: 12,
    radarRange: 2400,
    stealthFactor: 0.65, // reduces enemy detection range
    color: "#ffb700",
    accent: "#00f0ff",
    badge: "5TH-GEN STEALTH",
    desc: "All-weather stealth air dominance fighter with thrust-vectoring diamond delta wings and radar-guided AIM-120 AMRAAM missiles."
  },
  su47: {
    id: "su47",
    name: "Su-47 Berkut",
    callsign: "BERKUT",
    role: "Super-Maneuverable Dogfighter",
    maxSpeed: 920,
    minSpeed: 110,
    stallSpeed: 135,
    pitchRate: 3.4, // supreme agility
    hp: 100,
    maxHp: 100,
    cannonDmg: 36,
    cannonFireRate: 0.10,
    cannonVelocity: 850,
    missilesCount: 6,
    missileType: "R-73 ARCHER", // agile IR
    flaresCount: 14,
    radarRange: 2100,
    stealthFactor: 0.15,
    color: "#38ef7d",
    accent: "#11998e",
    badge: "FORWARD-SWEPT WING",
    desc: "Forward-swept wings and active canards deliver unprecedented pitch rate and super-stall recovery for knife-fight dogfights."
  },
  a10: {
    id: "a10",
    name: "A-10C Warthog",
    callsign: "WARTHOG",
    role: "Titan Ground Attacker",
    maxSpeed: 690,
    minSpeed: 90,
    stallSpeed: 115,
    pitchRate: 2.1,
    hp: 220, // massive armor
    maxHp: 220,
    damageResist: 0.35, // 35% incoming damage reduction
    cannonDmg: 54, // 30mm GAU-8 Avenger rotary cannon
    cannonExplosive: true,
    cannonFireRate: 0.06,
    cannonVelocity: 960,
    missilesCount: 4,
    missileType: "AGM-65 MAVERICK",
    flaresCount: 18,
    radarRange: 1900,
    stealthFactor: 0.0,
    color: "#a8ff78",
    accent: "#78ffd6",
    badge: "30MM GAU-8 TITAN",
    desc: "Heavy titanium bathtub armor with the legendary 30mm GAU-8 rotary cannon firing high-explosive armor-piercing rounds."
  },
  mirage: {
    id: "mirage",
    name: "Mirage 2000",
    callsign: "MIRAGE",
    role: "Pure Delta Energy Fighter",
    maxSpeed: 1040,
    minSpeed: 140,
    stallSpeed: 165,
    pitchRate: 2.9,
    hp: 95,
    maxHp: 95,
    cannonDmg: 32,
    cannonFireRate: 0.09,
    cannonVelocity: 880,
    missilesCount: 6,
    missileType: "MAGIC-2",
    flaresCount: 10,
    radarRange: 2300,
    energyRetention: 1.25, // minimal speed loss in vertical climbs
    color: "#4facfe",
    accent: "#00f2fe",
    badge: "DELTA ENERGY",
    desc: "Tailless delta wing with low wave drag at supersonic speeds and exceptional energy retention during vertical zoom climbs."
  },
  sr71: {
    id: "sr71",
    name: "SR-71X Vector",
    callsign: "HABU",
    role: "Mach-3 Stratospheric Striker",
    maxSpeed: 1250,
    minSpeed: 180,
    stallSpeed: 215,
    pitchRate: 1.9,
    hp: 90,
    maxHp: 90,
    cannonDmg: 42,
    cannonFireRate: 0.12,
    cannonVelocity: 1150,
    missilesCount: 4,
    missileType: "AIM-54 PHOENIX",
    flaresCount: 8,
    radarRange: 3200,
    stealthFactor: 0.45,
    color: "#ff0844",
    accent: "#ffb199",
    badge: "HYPERSONIC MACH-3",
    desc: "Hypersonic needle-nose interceptor designed for ultra-high-altitude stratospheric engagements with extended radar lock."
  }
};

// ── 3. Distinct Enemy Aircraft Classes (5 Classes) ──
export const ENEMY_CLASSES = {
  mig21: {
    id: "mig21",
    name: "MiG-21 Fishbed",
    role: "Light Interceptor",
    maxHp: 75,
    speed: 380,
    pitchRate: 2.0,
    scoreValue: 100,
    attackRange: 600,
    fireRate: 1.6,
    firesMissiles: false,
    color: "#ff5252",
    length: 28,
    wingspan: 20
  },
  su27: {
    id: "su27",
    name: "Su-27 Flanker",
    role: "Heavy Air Superiority",
    maxHp: 130,
    speed: 430,
    pitchRate: 2.5,
    scoreValue: 220,
    attackRange: 750,
    fireRate: 1.3,
    firesMissiles: true,
    color: "#ff2a6d",
    length: 36,
    wingspan: 26
  },
  tu160: {
    id: "tu160",
    name: "Tu-160 Blackjack",
    role: "Heavy Strategic Bomber",
    maxHp: 380,
    speed: 310,
    pitchRate: 0.9,
    scoreValue: 550,
    attackRange: 900,
    fireRate: 0.8,
    defensiveFlak: true,
    firesMissiles: false,
    color: "#b53471",
    length: 50,
    wingspan: 44
  },
  j20: {
    id: "j20",
    name: "J-20 Mighty Dragon",
    role: "Stealth Canard Fighter",
    maxHp: 140,
    speed: 460,
    pitchRate: 2.7,
    scoreValue: 350,
    attackRange: 800,
    fireRate: 1.2,
    stealth: true,
    firesMissiles: true,
    color: "#6c5ce7",
    length: 38,
    wingspan: 24
  },
  blackGhost: {
    id: "blackGhost",
    name: "Black Ghost Ace",
    role: "Hypersonic Prototype Boss",
    maxHp: 280,
    speed: 530,
    pitchRate: 3.1,
    scoreValue: 1200,
    attackRange: 950,
    fireRate: 0.75,
    highGManeuvers: true,
    firesMissiles: true,
    color: "#d63031",
    length: 42,
    wingspan: 28
  }
};

// ── 4. Atmospheric Strata & Environmental Helpers ──
export function getAtmosphericZone(y) {
  if (y < CLOUD_DECK_TOP_Y) {
    return "STRATOSPHERE";
  }
  if (y >= CLOUD_DECK_TOP_Y && y <= CLOUD_DECK_BOTTOM_Y) {
    return "CLOUD_DECK";
  }
  return "LOW_ALTITUDE";
}

export function isInCloudDeck(y) {
  return y >= CLOUD_DECK_TOP_Y && y <= CLOUD_DECK_BOTTOM_Y;
}

/**
 * Checks if radar lock can penetrate between two positions.
 * Cloud deck occludes radar lock unless aircraft are very close.
 */
export function canMaintainRadarLock(p1, p2) {
  const inCloud1 = isInCloudDeck(p1.y);
  const inCloud2 = isInCloudDeck(p2.y);
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dist = Math.hypot(dx, dy);

  // If one is in clouds and one is outside, cloud barrier breaks lock if dist > 600
  if (inCloud1 !== inCloud2 && dist > 600) {
    return false;
  }
  // If both inside cloud deck, radar is heavily diffused beyond 800 units
  if (inCloud1 && inCloud2 && dist > 800) {
    return false;
  }
  return true;
}

// ── 5. Procedural Mountain Landscape & Collision ──

/**
 * Generates mountain peaks and valleys across world coordinates x: [0, WORLD_WIDTH].
 * Peaks reach up to y = 3700 (~3000 ft altitude from sea level 5200).
 * Valleys contain evergreen pine forests or open ocean lagoons.
 */
export function generateMountainTerrain(seed = 123) {
  const points = [];
  // Start at western ocean boundary
  points.push({ x: -2000, y: SEA_LEVEL_Y, type: "water" });
  points.push({ x: 0, y: SEA_LEVEL_Y, type: "water" });

  let currentX = 200;
  let s = seed;

  // Simple pseudo-random helper for deterministic generation
  function pseudoRand() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  while (currentX < WORLD_WIDTH) {
    const isWaterValley = pseudoRand() < 0.28;
    const segmentWidth = 600 + pseudoRand() * 900;

    if (isWaterValley) {
      // Ocean inlet or flat valley
      points.push({ x: currentX, y: SEA_LEVEL_Y, type: "water" });
      currentX += segmentWidth;
      points.push({ x: currentX, y: SEA_LEVEL_Y, type: "water" });
    } else {
      // Mountain ridge with foothills, sub-peaks, and summits
      const peakY = 3700 + pseudoRand() * 900; // y between 3700 (tall) and 4600 (low hill)
      const midX = currentX + segmentWidth * 0.5;

      // Foothill up
      points.push({ x: currentX, y: SEA_LEVEL_Y - 40, type: "rock" });
      // Shoulder
      points.push({ x: currentX + segmentWidth * 0.25, y: (SEA_LEVEL_Y + peakY) * 0.55, type: "rock" });
      // Sharp snow peak
      points.push({ x: midX, y: peakY, type: "snow" });
      // Far shoulder
      points.push({ x: currentX + segmentWidth * 0.75, y: (SEA_LEVEL_Y + peakY) * 0.58, type: "rock" });
      // Foothill down
      points.push({ x: currentX + segmentWidth, y: SEA_LEVEL_Y - 40, type: "rock" });

      currentX += segmentWidth;
    }
  }

  // Eastern ocean boundary
  points.push({ x: WORLD_WIDTH + 2000, y: SEA_LEVEL_Y, type: "water" });

  // Generate pine tree clusters in valleys where y >= 4850
  const trees = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (p1.y >= 4850 && p2.y >= 4850) {
      const treeCount = Math.floor(3 + pseudoRand() * 5);
      for (let t = 0; t < treeCount; t++) {
        const tx = p1.x + (p2.x - p1.x) * ((t + 0.5) / treeCount) + (pseudoRand() - 0.5) * 20;
        const ty = p1.y + (p2.y - p1.y) * ((t + 0.5) / treeCount);
        trees.push({ x: tx, y: ty, h: 18 + pseudoRand() * 14 });
      }
    }
  }

  // Generate coastal & maritime installations
  const installations = [
    {
      type: "carrier",
      name: "CVN-80 VALIANT",
      x: 1400,
      y: SEA_LEVEL_Y,
      length: 480,
      deckH: 30,
      islandX: 1540,
      islandW: 60,
      islandH: 48,
      catapults: [1260, 1420],
      arrestorWires: [1160, 1190, 1220]
    },
    {
      type: "airfield",
      name: "FORWARD BASE OMEGA",
      x: 3900,
      y: SEA_LEVEL_Y,
      length: 700,
      runwayY: SEA_LEVEL_Y - 8,
      towerX: 3820,
      towerH: 80,
      hangars: [3620, 3720],
      radarX: 4220
    },
    {
      type: "oilRig",
      name: "TITAN DEEPWATER PLATFORM",
      x: 7400,
      y: SEA_LEVEL_Y,
      width: 200,
      deckH: 46,
      flareStackX: 7480,
      flareH: 70
    },
    {
      type: "lighthouse",
      name: "CAPE VALIANT LIGHT",
      x: 9600,
      y: SEA_LEVEL_Y - 45,
      towerH: 85,
      beamAngle: 0
    }
  ];

  // Distant parallax mountain ridges (Layer 1: far 0.15x, Layer 2: mid 0.4x)
  const distantRidges = {
    far: [],
    mid: []
  };

  for (let x = -2000; x <= WORLD_WIDTH + 2000; x += 140) {
    const farY = 4100 + Math.sin(x * 0.0018 + 1.2) * 550 + Math.cos(x * 0.0042) * 220;
    distantRidges.far.push({ x, y: farY });

    const midY = 3850 + Math.sin(x * 0.0028 + 0.5) * 620 + Math.cos(x * 0.0065) * 310;
    distantRidges.mid.push({ x, y: midY });
  }

  return { points, trees, installations, distantRidges };
}

/**
 * Calculates the interpolated ground/mountain height at a given horizontal coordinate x.
 */
export function getTerrainHeightAt(x, terrainPoints) {
  if (!terrainPoints || terrainPoints.length < 2) return SEA_LEVEL_Y;

  if (x <= terrainPoints[0].x) return terrainPoints[0].y;
  if (x >= terrainPoints[terrainPoints.length - 1].x) return terrainPoints[terrainPoints.length - 1].y;

  // Binary search or linear scan for segment
  for (let i = 0; i < terrainPoints.length - 1; i++) {
    const p1 = terrainPoints[i];
    const p2 = terrainPoints[i + 1];
    if (x >= p1.x && x <= p2.x) {
      const t = (x - p1.x) / (p2.x - p1.x);
      return p1.y + t * (p2.y - p1.y);
    }
  }

  return SEA_LEVEL_Y;
}

/**
 * Checks if an aircraft or projectile at (x, y) with bounding radius collides with terrain.
 * Returns { collided, type: "mountain"|"ocean"|null, surfaceY }
 */
export function checkTerrainCollision(x, y, radius = 10, terrainPoints) {
  // 1. Water Crash Check
  if (y + radius >= SEA_LEVEL_Y) {
    return { collided: true, type: "ocean", surfaceY: SEA_LEVEL_Y };
  }

  // 2. Mountain Ridge Collision Check
  const surfaceY = getTerrainHeightAt(x, terrainPoints);
  if (y + radius >= surfaceY) {
    return { collided: true, type: "mountain", surfaceY };
  }

  return { collided: false, type: null, surfaceY };
}

/**
 * Ground Proximity Warning System (GPWS)
 * Triggers "TERRAIN // PULL UP!" if aircraft is rapidly descending towards ground.
 */
export function checkGroundProximity(x, y, vy, terrainPoints) {
  const surfaceY = getTerrainHeightAt(x, terrainPoints);
  const clearance = surfaceY - y;
  // Warning triggers if clearance is under 420 units and aircraft is descending (vy > 20)
  // or if clearance is under 180 units regardless of descent rate
  const warning = (clearance < 420 && vy > 20) || clearance < 180;
  return { warning, clearance: Math.max(0, clearance), surfaceY };
}

// ── 6. Flight Physics Step (Energy-Maneuverability) ──
export function simulateFlightStep(plane, inputs, dt) {
  const stats = AIRCRAFT_ROSTER[plane.type] || AIRCRAFT_ROSTER.f22;

  // 1. Airbrake & Afterburner handling
  if (inputs.isBraking) {
    plane.speed = Math.max(stats.minSpeed, plane.speed - dt * 280);
  }

  if (inputs.isBurner && plane.fuel > 0) {
    plane.throttle = 1.5;
    plane.fuel = Math.max(0, plane.fuel - dt * 3.8);
    const accelBonus = stats.maxSpeed > 1000 ? 220 : 190;
    plane.speed = Math.min(stats.maxSpeed, plane.speed + dt * accelBonus);
  } else {
    plane.throttle = 0.8;
  }

  // 2. Energy Trade: Climbing converts kinetic speed to potential energy; diving does the opposite
  // In canvas coords, y = 0 is sky, so angle < 0 is nose-up climbing!
  const climbRate = -Math.sin(plane.angle); // positive when climbing UP
  const retention = stats.energyRetention || 1.0;
  if (climbRate > 0) {
    // Climbing up drains speed
    plane.speed -= (climbRate * dt * 140) / retention;
  } else {
    // Diving down adds speed
    plane.speed += Math.abs(climbRate) * dt * 160;
  }

  // 3. Cruising speed equilibrium
  const targetCruise = 420 * plane.throttle;
  plane.speed += (targetCruise - plane.speed) * dt * 0.45;

  // 4. Stall Aerodynamics
  if (plane.speed < stats.stallSpeed) {
    plane.isStalled = true;
    // Nose drops toward gravity (PI / 2)
    plane.angle += (Math.PI / 2 - plane.angle) * dt * 2.4;
    plane.y += GRAVITY * dt * 1.8;
  } else {
    plane.isStalled = false;
  }

  // 5. Pitch Rate Application
  const effectivePitch = stats.pitchRate * (plane.isStalled ? 0.25 : 1.0);
  plane.angle += inputs.pitchInput * effectivePitch * dt;

  // 6. Velocity & Position Integration
  plane.vx = Math.cos(plane.angle) * plane.speed;
  plane.vy = Math.sin(plane.angle) * plane.speed;
  plane.x += plane.vx * dt;
  plane.y += plane.vy * dt;

  // Ceiling Boundary
  if (plane.y <= CEILING_Y) {
    plane.y = CEILING_Y;
    plane.speed = Math.max(stats.minSpeed, plane.speed - dt * 120);
  }

  return plane;
}

/**
 * High-precision flight control mapper supporting dual Keyboard and Mouse Aim.
 */
export function calculateFlightControls(plane, input, dt, mouseAim = null) {
  let pitchInput = 0;

  // 1. Keyboard Pitch: W/ArrowUp = climb (-1), S/ArrowDown = dive (+1)
  if (input.isDown("KeyW") || input.isDown("ArrowUp")) {
    pitchInput -= 1;
  }
  if (input.isDown("KeyS") || input.isDown("ArrowDown")) {
    pitchInput += 1;
  }

  // Virtual touch stick y-axis
  if (input.stick && input.stick.active) {
    if (Math.abs(input.stick.y) > 0.25) {
      pitchInput = input.stick.y > 0 ? 1 : -1;
    }
  }

  // 2. Mouse Aim flight vectoring
  if (mouseAim && mouseAim.active && pitchInput === 0) {
    let diff = mouseAim.targetAngle - plane.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    if (Math.abs(diff) > 0.06) {
      pitchInput = Math.max(-1, Math.min(1, diff * 3.2));
    }
  }

  // 3. Airbrake: A, ArrowLeft, KeyB, or touch airbrake
  const isBraking = Boolean(
    input.isDown("KeyA") ||
    input.isDown("ArrowLeft") ||
    input.isDown("KeyB") ||
    input.isDown("airbrake")
  );

  // 4. Afterburner: D, ArrowRight, Shift, or touch burner
  const isBurner = Boolean(
    (input.isDown("KeyD") ||
     input.isDown("ArrowRight") ||
     input.isDown("ShiftLeft") ||
     input.isDown("ShiftRight") ||
     input.isDown("burner")) &&
    plane.fuel > 0
  );

  return {
    pitchInput,
    isBraking,
    isBurner
  };
}
