/**
 * ORE RUNNER — Core Space Mining Physics & Balance Logic
 * Pure headless simulation functions for Newtonian thrust, mass penalty,
 * asteroid field tiers, and station docking.
 */

export const ASTEROID_TIERS = [
  { id: "silicate", name: "Silicate Ore", value: 15, hp: 35, color: "#8a97b1", weight: 45 },
  { id: "metallic", name: "Metallic Ore", value: 40, hp: 60, color: "#c89d7c", weight: 25 },
  { id: "crystalline", name: "Crystal Ore", value: 90, hp: 80, color: "#00f0ff", weight: 15 },
  { id: "exotic", name: "Exotic Gold", value: 220, hp: 120, color: "#ffd700", weight: 10 },
  { id: "unstable", name: "Unstable Core", value: 450, hp: 90, color: "#ff2233", weight: 5, isUnstable: true }
];

export const STATION_DEFAULT = {
  x: 2000,
  y: 2000,
  radius: 120,
  dockRadius: 85
};

export function calculateMassMultiplier(cargoCount, cargoCapacity = 25) {
  const ratio = Math.min(1.0, Math.max(0, cargoCount / cargoCapacity));
  return 1.0 + ratio * 0.45; // up to 1.45x mass
}

export function calculateEffectiveThrust(baseThrust, cargoCount, cargoCapacity = 25) {
  const mass = calculateMassMultiplier(cargoCount, cargoCapacity);
  return baseThrust / mass;
}

export function calculateEffectiveTurnRate(baseTurnRate, cargoCount, cargoCapacity = 25) {
  const ratio = Math.min(1.0, Math.max(0, cargoCount / cargoCapacity));
  return baseTurnRate / (1.0 + ratio * 0.3); // up to ~23% slower turn rate
}

export function isWithinDockingBay(playerX, playerY, stationX = 2000, stationY = 2000, dockRadius = 85) {
  const dx = playerX - stationX;
  const dy = playerY - stationY;
  return Math.hypot(dx, dy) <= dockRadius;
}

export function calculateUnstableCoreFuse(currentFuse, dt) {
  return Math.max(0, currentFuse - dt);
}

export function bankAllCargo(cargoList) {
  const totalCredits = cargoList.reduce((sum, item) => sum + item.value, 0);
  return {
    depositedCount: cargoList.length,
    creditsEarned: totalCredits,
    remainingCargo: []
  };
}

export function simulateNewtonianMotion(pos, vel, thrustActive, angle, effectiveThrust, dt) {
  let vx = vel.vx;
  let vy = vel.vy;

  if (thrustActive) {
    vx += Math.cos(angle) * effectiveThrust * dt;
    vy += Math.sin(angle) * effectiveThrust * dt;
  }

  // Zero-friction in deep space: no drag decay
  return {
    x: pos.x + vx * dt,
    y: pos.y + vy * dt,
    vx,
    vy
  };
}
