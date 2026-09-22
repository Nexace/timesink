/**
 * IRONSAIL — Naval Conquest & Trade Engine (Complete DOKDO Overhaul)
 * Vast 9600x9600 open ocean archipelago, 6 sectors, 18 detailed islands with defense forts,
 * multi-tier visual ship evolutions, DOKDO broadsides, WASD rudder & sail throttle,
 * flotsam salvage, commodity trading, passive island revenue, Ghost Ship & Kraken bosses.
 */

import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { createGameLoop, createInputManager, clamp, lerp, dist, angleDiff } from "/src/core/engine.js";
import { playCannon, playExplosion, playHit, playCoin, playTone, sfx } from "/src/core/audio.js";
import { saveGameScore, saveSlot, loadSlot } from "/src/core/save.js";

initShell({ crumb: "IronSail" });

const canvas = document.getElementById("is-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 960;
canvas.height = 540;

// World bounds (Expanded 9600 x 9600px open ocean)
export const WORLD_SIZE = 9600;

// 6 Oceanic Sectors
export const SECTORS = [
  { id: 1, name: "Tranquil Shallows", color: "#00bfa5", water: "#04202c", bounds: { x0: 0, y0: 0, x1: 4800, y1: 4800 } },
  { id: 2, name: "Coral Archipelago", color: "#00e5ff", water: "#022638", bounds: { x0: 4800, y0: 0, x1: 9600, y1: 4800 } },
  { id: 3, name: "Smuggler's Reach", color: "#ffab00", water: "#1a1e24", bounds: { x0: 0, y0: 4800, x1: 4800, y1: 9600 } },
  { id: 4, name: "Royal Navy Domain", color: "#2979ff", water: "#041630", bounds: { x0: 4800, y0: 4800, x1: 9600, y1: 7200 } },
  { id: 5, name: "The Devil's Shroud", color: "#d500f9", water: "#1b0726", bounds: { x0: 4800, y0: 7200, x1: 9600, y1: 9600 } },
  { id: 6, name: "Abyssal Trench", color: "#ff1744", water: "#01070d", bounds: { x0: 2400, y0: 2400, x1: 7200, y1: 7200 } }
];

// Commodities definition
export const COMMODITIES = [
  { id: "fish", name: "Fresh Cod", basePrice: 12, icon: "🐟" },
  { id: "wood", name: "Timber Planks", basePrice: 20, icon: "🪵" },
  { id: "stone", name: "Cut Stone", basePrice: 35, icon: "🪨" },
  { id: "iron", name: "Iron Ingot", basePrice: 65, icon: "⚙️" },
  { id: "gold", name: "Gold Bar", basePrice: 140, icon: "🪙" },
  { id: "ruby", name: "Deep Ruby", basePrice: 320, icon: "💎" }
];

// 18 Islands definition across the 6 sectors
// Safe home island 1 is at (1200, 1200) with nearest hostile island 2 at (3400, 1400) -> 2200px away!
export const ISLANDS = [
  // Sector 1: Tranquil Shallows
  { id: 1, name: "Tortuga Haven", x: 1200, y: 1200, r: 130, sector: 1, captured: true, level: 1, guardsTotal: 0, fortsCount: 2, seed: 101, tax: 0 },
  { id: 2, name: "Craggy Cay", x: 3400, y: 1400, r: 95, sector: 1, captured: false, level: 1, guardsTotal: 3, fortsCount: 1, seed: 102, tax: 0 },
  { id: 3, name: "Emerald Atoll", x: 2200, y: 3400, r: 110, sector: 1, captured: false, level: 2, guardsTotal: 4, fortsCount: 1, seed: 103, tax: 0 },

  // Sector 2: Coral Archipelago
  { id: 4, name: "Cutlass Reef", x: 5800, y: 1200, r: 105, sector: 2, captured: false, level: 3, guardsTotal: 5, fortsCount: 2, seed: 201, tax: 0 },
  { id: 5, name: "Gull Rock", x: 7400, y: 1600, r: 115, sector: 2, captured: false, level: 4, guardsTotal: 6, fortsCount: 2, seed: 202, tax: 0 },
  { id: 6, name: "Pearl Key", x: 8600, y: 3200, r: 120, sector: 2, captured: false, level: 4, guardsTotal: 6, fortsCount: 2, seed: 203, tax: 0 },

  // Sector 3: Smuggler's Reach
  { id: 7, name: "Skeleton Shoals", x: 1400, y: 6400, r: 110, sector: 3, captured: false, level: 5, guardsTotal: 7, fortsCount: 2, seed: 301, tax: 0 },
  { id: 8, name: "Black Sand Cove", x: 2800, y: 7600, r: 125, sector: 3, captured: false, level: 6, guardsTotal: 8, fortsCount: 2, seed: 302, tax: 0 },
  { id: 9, name: "Corsair's Rest", x: 4000, y: 8600, r: 130, sector: 3, captured: false, level: 6, guardsTotal: 8, fortsCount: 3, seed: 303, tax: 0 },

  // Sector 4: Royal Navy Domain
  { id: 10, name: "Iron Bastion", x: 5800, y: 5600, r: 135, sector: 4, captured: false, level: 7, guardsTotal: 9, fortsCount: 3, seed: 401, tax: 0 },
  { id: 11, name: "Brimstone Isle", x: 7400, y: 6000, r: 140, sector: 4, captured: false, level: 8, guardsTotal: 10, fortsCount: 3, seed: 402, tax: 0 },
  { id: 12, name: "Fort George", x: 8800, y: 5600, r: 145, sector: 4, captured: false, level: 8, guardsTotal: 10, fortsCount: 4, seed: 403, tax: 0 },

  // Sector 5: The Devil's Shroud (Bermuda / Ghost Sea)
  { id: 13, name: "Phantom Cay", x: 6200, y: 7800, r: 130, sector: 5, captured: false, level: 9, guardsTotal: 10, fortsCount: 3, seed: 501, tax: 0 },
  { id: 14, name: "Lost Dutchman Spire", x: 7600, y: 8400, r: 135, sector: 5, captured: false, level: 10, guardsTotal: 12, fortsCount: 4, seed: 502, tax: 0 },
  { id: 15, name: "Wraith Atoll", x: 8800, y: 8800, r: 140, sector: 5, captured: false, level: 10, guardsTotal: 12, fortsCount: 4, seed: 503, tax: 0 },

  // Sector 6: Abyssal Trench
  { id: 16, name: "Abyssal Gate", x: 4400, y: 4400, r: 140, sector: 6, captured: false, level: 11, guardsTotal: 12, fortsCount: 4, seed: 601, tax: 0 },
  { id: 17, name: "Leviathan Maw", x: 3400, y: 4800, r: 145, sector: 6, captured: false, level: 11, guardsTotal: 14, fortsCount: 4, seed: 602, tax: 0 },
  { id: 18, name: "Dread Citadel", x: 5200, y: 3600, r: 155, sector: 6, captured: false, level: 12, guardsTotal: 16, fortsCount: 5, seed: 603, tax: 0 }
];

// Initialize Island coastal forts
ISLANDS.forEach((isl) => {
  isl.forts = [];
  for (let f = 0; f < isl.fortsCount; f++) {
    const ang = (f / isl.fortsCount) * Math.PI * 2 + 0.3;
    const distFromCenter = isl.r - 8;
    isl.forts.push({
      x: isl.x + Math.cos(ang) * distFromCenter,
      y: isl.y + Math.sin(ang) * distFromCenter,
      angle: ang,
      targetAngle: ang,
      hp: 120 + isl.level * 45,
      maxHp: 120 + isl.level * 45,
      dmg: 18 + isl.level * 4,
      range: 280,
      fireCd: 1.0 + Math.random() * 1.5,
      destroyed: false
    });
  }
});

// Dynamic Port Commodity Prices
const portMarkets = {};
function refreshMarketPrices() {
  ISLANDS.forEach((isl) => {
    portMarkets[isl.id] = {};
    COMMODITIES.forEach((c) => {
      const variance = (Math.random() * 0.6 - 0.3); // +/- 30%
      const distanceBonus = isl.level * 0.09;
      const price = Math.max(5, Math.round(c.basePrice * (1 + variance + distanceBonus)));
      portMarkets[isl.id][c.id] = price;
    });
  });
}
refreshMarketPrices();
let marketTimer = 0;

// Ship Tiers (DOKDO Visual & Stat Evolution)
export const SHIP_TIERS = [
  { tier: 1, name: "Coastal Sloop", minHullLvl: 1, gunsPerSide: 1, masts: 1, len: 36, beam: 16, baseHp: 180 },
  { tier: 2, name: "Armed Schooner", minHullLvl: 3, gunsPerSide: 2, masts: 2, len: 46, beam: 20, baseHp: 280 },
  { tier: 3, name: "War Brigantine", minHullLvl: 5, gunsPerSide: 3, masts: 2, len: 58, beam: 24, baseHp: 420 },
  { tier: 4, name: "Heavy Frigate", minHullLvl: 7, gunsPerSide: 4, masts: 3, len: 70, beam: 28, baseHp: 620 },
  { tier: 5, name: "Royal Galleon", minHullLvl: 9, gunsPerSide: 5, masts: 3, len: 84, beam: 32, baseHp: 900 },
  { tier: 6, name: "Sovereign Dreadnought", minHullLvl: 11, gunsPerSide: 6, masts: 4, len: 100, beam: 36, baseHp: 1300 }
];

export function getShipTier(hullLevel) {
  let tier = SHIP_TIERS[0];
  for (const t of SHIP_TIERS) {
    if (hullLevel >= t.minHullLvl) tier = t;
  }
  return tier;
}

// Global Wind System
const wind = {
  angle: Math.PI * 0.25, // Blowing toward NE
  speed: 16, // knots
  timer: 0
};

// Player Ship State
export const player = {
  x: ISLANDS[0].x + 150,
  y: ISLANDS[0].y,
  angle: 0,
  speed: 0,
  sailThrottle: 0, // 0 = idle/anchor, 1 = full sail
  rudderAngle: 0,
  maxSpeed: 155,
  turnRate: 2.2,
  hp: 180,
  maxHp: 180,
  armor: 12,
  hullLevel: 1,
  portGuns: 1,
  starboardGuns: 1,
  hasBowGun: false,
  cannonDmg: 28,
  cannonRange: 280,
  fireRate: 0.9,
  portCooldown: 0,
  starboardCooldown: 0,
  bowCooldown: 0,
  boostTimer: 0,
  boostCooldown: 0,
  gold: 250,
  wood: 15,
  iron: 8,
  cargo: { fish: 2, wood: 15, stone: 5, iron: 8, gold: 0, ruby: 0 },
  cargoCapacity: 35,
  sailsLevel: 1,
  fishingLevel: 1,
  crewLevel: 1,
  consortsCount: 0,
  gullsCount: 0,
  lastPortId: 1,
  shipsSunk: 0,
  islandsCaptured: 1
};

// Companions
const consorts = [];
const gulls = [];
function syncCompanions() {
  while (consorts.length < player.consortsCount) {
    consorts.push({
      x: player.x - 50,
      y: player.y + (consorts.length % 2 === 0 ? 40 : -40),
      angle: player.angle,
      hp: 160,
      maxHp: 160,
      portCd: 0,
      starCd: 0
    });
  }
  while (gulls.length < player.gullsCount) {
    gulls.push({ angle: Math.random() * Math.PI * 2, dist: 60 + Math.random() * 40 });
  }
}
syncCompanions();

// World Entities
const cannonballs = [];
const enemyShips = [];
const floatingLoot = [];
const wakeParticles = [];
const smokeParticles = [];
const splinters = [];
const floatingTexts = [];

// Boss Entities
let ghostShip = null;
let kraken = null;

// Active Island Battle
let activeIslandBattle = null;
let lastFishingTime = 0;
let lastRepairTick = 0;
let taxAccumulatorTimer = 0;
let minimapOpen = false;

// Setup Input Manager
const input = createInputManager({
  canvas,
  buttons: [
    { id: "boost", label: "BOOST" },
    { id: "port", label: "PORT" },
    { id: "map", label: "MAP" },
    { id: "pause", label: "PAUSE" }
  ]
});

// Port Modal Elements
const portModal = document.getElementById("is-port-modal");
const portTitle = document.getElementById("port-modal-title");
const portMarketContainer = document.getElementById("port-market-list");
const portUpgradesContainer = document.getElementById("port-upgrades-list");
const btnClosePort = document.getElementById("btn-close-port");
const btnRepairShip = document.getElementById("btn-repair-ship");

let activePortIsland = null;

export function openPortModal(island) {
  activePortIsland = island;
  if (!portModal) return;
  sfx.click();
  portTitle.textContent = `${island.name.toUpperCase()} — PORT & SHIPYARD`;
  renderPortUI();
  portModal.style.display = "flex";
}

export function closePortModal() {
  if (!portModal) return;
  sfx.click();
  portModal.style.display = "none";
  activePortIsland = null;
}

if (btnClosePort) btnClosePort.addEventListener("click", closePortModal);
if (btnRepairShip) {
  btnRepairShip.addEventListener("click", () => {
    const missing = player.maxHp - player.hp;
    if (missing <= 0) {
      toast({ title: "HULL MINT", body: "Ship is at 100% health!" });
      return;
    }
    const costGold = Math.ceil(missing * 0.4);
    const costWood = Math.ceil(missing * 0.05);
    if (player.gold >= costGold && player.wood >= costWood) {
      player.gold -= costGold;
      player.wood -= costWood;
      player.hp = player.maxHp;
      sfx.good();
      toast({ title: "HULL REPAIRED", body: `Restored to ${player.maxHp} HP (-${costGold}G, -${costWood} Wood)`, icon: "check" });
      renderPortUI();
    } else {
      sfx.deny();
      toast({ title: "NEED RESOURCES", body: `Repair costs ${costGold} Gold & ${costWood} Wood!`, icon: "alert" });
    }
  });
}

// Collect all passive taxes from captured islands
function collectAllTaxes() {
  let totalGold = 0;
  let totalWood = 0;
  let totalIron = 0;

  ISLANDS.forEach((isl) => {
    if (isl.captured && isl.tax > 0) {
      totalGold += Math.floor(isl.tax);
      totalWood += Math.floor(isl.tax * 0.4);
      totalIron += Math.floor(isl.tax * 0.2);
      isl.tax = 0;
    }
  });

  if (totalGold === 0 && totalWood === 0) {
    toast({ title: "VAULT EMPTY", body: "Captured islands generate taxes every 30s." });
    return;
  }

  player.gold += totalGold;
  player.wood += totalWood;
  player.iron += totalIron;
  playCoin();
  toast({
    title: "TAXES HARVESTED!",
    body: `+${totalGold} Gold, +${totalWood} Wood, +${totalIron} Iron!`,
    icon: "trophy"
  });
  renderPortUI();
}

function renderPortUI() {
  if (!activePortIsland || !portMarketContainer) return;
  const prices = portMarkets[activePortIsland.id] || {};

  // Tax Vault Header
  let pendingTaxGold = 0;
  ISLANDS.forEach((isl) => {
    if (isl.captured) pendingTaxGold += Math.floor(isl.tax);
  });

  // Commodities Market
  portMarketContainer.innerHTML = `
    <div style="margin-bottom:10px; padding:8px; background:#071c26; border:1px solid #00bfa5; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <b style="color:#ffd700;">ISLAND TAX VAULT:</b>
        <span style="font-size:11px; color:#63d1c1;">${pendingTaxGold} Gold accumulated</span>
      </div>
      <button class="btn btn--sm" id="btn-collect-taxes" style="background:#00bfa5; color:#000; font-weight:bold; cursor:pointer;">HARVEST ALL TAXES</button>
    </div>
    <div class="market-grid">
      ${COMMODITIES.map((c) => {
        const price = prices[c.id] || c.basePrice;
        const count = player.cargo[c.id] || 0;
        return `
          <div class="market-item">
            <span class="market-item-title">${c.icon} ${escapeHtml(c.name)}</span>
            <span class="market-item-price">BUY/SELL: ${price} G</span>
            <span>IN HOLD: <b>${count}</b></span>
            <div class="market-actions">
              <button class="btn-trade" data-buy="${c.id}">BUY</button>
              <button class="btn-trade" data-sell="${c.id}">SELL</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  const btnTax = document.getElementById("btn-collect-taxes");
  if (btnTax) btnTax.addEventListener("click", collectAllTaxes);

  // Shipwright & DOKDO Upgrades Tree
  const tier = getShipTier(player.hullLevel);
  const nextTier = getShipTier(player.hullLevel + 2);
  const upgrades = [
    {
      id: "hull",
      title: `Hull Reinforce [Lvl ${player.hullLevel}]`,
      costGold: 120 + player.hullLevel * 45,
      costWood: 10 + player.hullLevel * 4,
      desc: `+45 HP, +4% Armor. ${nextTier.tier > tier.tier ? `EVOLVES TO ${nextTier.name.toUpperCase()}!` : ""}`
    },
    {
      id: "portCannons",
      title: `Port Cannons [${player.portGuns}/6 Guns]`,
      costGold: 140 + player.portGuns * 60,
      costIron: 6 + player.portGuns * 3,
      desc: player.portGuns < 6 ? `Adds extra port cannon barrel & +6 Dmg` : `MAX BROADSIDE REACHED`
    },
    {
      id: "starboardCannons",
      title: `Starboard Cannons [${player.starboardGuns}/6 Guns]`,
      costGold: 140 + player.starboardGuns * 60,
      costIron: 6 + player.starboardGuns * 3,
      desc: player.starboardGuns < 6 ? `Adds extra starboard cannon barrel & +6 Dmg` : `MAX BROADSIDE REACHED`
    },
    {
      id: "bowGun",
      title: `Bow Chaser Gun`,
      costGold: 280,
      costIron: 14,
      desc: player.hasBowGun ? `EQUIPPED & OPERATIONAL` : `Unlocks forward chasing cannon`
    },
    {
      id: "sails",
      title: `Canvas Sails & Rigging [Lvl ${player.sailsLevel}]`,
      costGold: 110 + player.sailsLevel * 40,
      costWood: 8 + player.sailsLevel * 3,
      desc: `+20 Top Speed, +0.2 Turn Agility`
    },
    {
      id: "crew",
      title: `Marines & Shipwrights [Lvl ${player.crewLevel}]`,
      costGold: 100 + player.crewLevel * 35,
      costFood: 5,
      desc: `Faster broadside reloads & passive out-of-combat repairs`
    },
    {
      id: "cargo",
      title: `Reinforced Cargo Hold`,
      costGold: 90,
      costWood: 12,
      desc: `Capacity: ${player.cargoCapacity} -> ${player.cargoCapacity + 15} crates`
    },
    {
      id: "consort",
      title: `Escort Fleet [${player.consortsCount}/3 Ships]`,
      costGold: 380 + player.consortsCount * 150,
      costWood: 25,
      desc: player.consortsCount < 3 ? `Commission allied gun cutter escort` : `FLEET AT MAXIMUM CAPACITY`
    }
  ];

  if (portUpgradesContainer) {
    portUpgradesContainer.innerHTML = `
      <div style="margin-bottom:6px; font-size:11px; color:#00bfa5;">
        CURRENT SHIP: <b>${tier.name.toUpperCase()}</b> (TIER ${tier.tier}/6 • ${tier.masts} MASTS)
      </div>
      <div class="upgrades-grid">
        ${upgrades.map((u) => {
          const isMaxed = (u.id === "bowGun" && player.hasBowGun) ||
                          (u.id === "portCannons" && player.portGuns >= 6) ||
                          (u.id === "starboardCannons" && player.starboardGuns >= 6) ||
                          (u.id === "consort" && player.consortsCount >= 3);
          const reqs = [];
          if (u.costGold) reqs.push(`${u.costGold}G`);
          if (u.costWood) reqs.push(`${u.costWood} Wood`);
          if (u.costIron) reqs.push(`${u.costIron} Iron`);

          return `
            <div class="upgrade-card">
              <div>
                <strong style="color:#ffffff;">${escapeHtml(u.title)}</strong>
                <p style="margin:4px 0; color:#8a97b1; font-size:10px;">${escapeHtml(u.desc)}</p>
              </div>
              <button class="btn-trade" data-upgrade="${u.id}" ${isMaxed ? "disabled" : ""}>
                ${isMaxed ? "MAXED" : `UPGRADE: ${reqs.join(", ")}`}
              </button>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }
}

// Market Trading & Upgrade Clicks
if (portModal) {
  portModal.addEventListener("click", (e) => {
    const buyBtn = e.target.closest("[data-buy]");
    if (buyBtn && activePortIsland) {
      const cid = buyBtn.dataset.buy;
      const price = portMarkets[activePortIsland.id][cid];
      const curCargo = Object.values(player.cargo).reduce((a, b) => a + b, 0);
      if (curCargo >= player.cargoCapacity) {
        sfx.deny();
        toast({ title: "CARGO FULL", body: `Maximum ${player.cargoCapacity} slots.`, icon: "alert" });
        return;
      }
      if (player.gold >= price) {
        player.gold -= price;
        player.cargo[cid] = (player.cargo[cid] || 0) + 1;
        if (cid === "wood") player.wood++;
        if (cid === "iron") player.iron++;
        playCoin();
        renderPortUI();
      } else {
        sfx.deny();
        toast({ title: "NOT ENOUGH GOLD", icon: "alert" });
      }
      return;
    }

    const sellBtn = e.target.closest("[data-sell]");
    if (sellBtn && activePortIsland) {
      const cid = sellBtn.dataset.sell;
      const count = player.cargo[cid] || 0;
      if (count > 0) {
        const price = portMarkets[activePortIsland.id][cid];
        player.cargo[cid] -= 1;
        if (cid === "wood" && player.wood > 0) player.wood--;
        if (cid === "iron" && player.iron > 0) player.iron--;
        player.gold += price;
        playCoin();
        renderPortUI();
      } else {
        sfx.deny();
      }
      return;
    }

    const upgBtn = e.target.closest("[data-upgrade]");
    if (upgBtn) {
      const uid = upgBtn.dataset.upgrade;
      applyUpgrade(uid);
    }
  });
}

function applyUpgrade(uid) {
  if (uid === "hull") {
    const costG = 120 + player.hullLevel * 45;
    const costW = 10 + player.hullLevel * 4;
    if (player.gold >= costG && player.wood >= costW) {
      player.gold -= costG;
      player.wood -= costW;
      player.hullLevel++;
      player.maxHp += 45;
      player.hp += 45;
      player.armor = Math.min(65, player.armor + 4);
      sfx.powerup();
      const newTier = getShipTier(player.hullLevel);
      toast({ title: "HULL REINFORCED", body: `Ship is now ${newTier.name}!`, icon: "shield" });
    } else {
      sfx.deny();
      toast({ title: "MISSING RESOURCES", body: `Need ${costG} Gold & ${costW} Wood`, icon: "alert" });
    }
  } else if (uid === "portCannons" && player.portGuns < 6) {
    const costG = 140 + player.portGuns * 60;
    const costI = 6 + player.portGuns * 3;
    if (player.gold >= costG && player.iron >= costI) {
      player.gold -= costG;
      player.iron -= costI;
      player.portGuns++;
      player.cannonDmg += 6;
      sfx.powerup();
      toast({ title: "PORT CANNONS UPGRADED", body: `${player.portGuns} Broadside Guns Mounted!`, icon: "swords" });
    } else {
      sfx.deny();
      toast({ title: "MISSING RESOURCES", body: `Need ${costG} Gold & ${costI} Iron`, icon: "alert" });
    }
  } else if (uid === "starboardCannons" && player.starboardGuns < 6) {
    const costG = 140 + player.starboardGuns * 60;
    const costI = 6 + player.starboardGuns * 3;
    if (player.gold >= costG && player.iron >= costI) {
      player.gold -= costG;
      player.iron -= costI;
      player.starboardGuns++;
      player.cannonDmg += 6;
      sfx.powerup();
      toast({ title: "STARBOARD CANNONS UPGRADED", body: `${player.starboardGuns} Broadside Guns Mounted!`, icon: "swords" });
    } else {
      sfx.deny();
      toast({ title: "MISSING RESOURCES", body: `Need ${costG} Gold & ${costI} Iron`, icon: "alert" });
    }
  } else if (uid === "bowGun" && !player.hasBowGun) {
    if (player.gold >= 280 && player.iron >= 14) {
      player.gold -= 280;
      player.iron -= 14;
      player.hasBowGun = true;
      sfx.powerup();
      toast({ title: "BOW CHASER UNLOCKED", body: "Forward cannon operational!", icon: "bolt" });
    } else {
      sfx.deny();
      toast({ title: "MISSING RESOURCES", body: "Need 280 Gold & 14 Iron", icon: "alert" });
    }
  } else if (uid === "sails") {
    const costG = 110 + player.sailsLevel * 40;
    const costW = 8 + player.sailsLevel * 3;
    if (player.gold >= costG && player.wood >= costW) {
      player.gold -= costG;
      player.wood -= costW;
      player.sailsLevel++;
      player.maxSpeed += 20;
      player.turnRate += 0.2;
      sfx.powerup();
      toast({ title: "RIGGING TUNED", body: `Top speed now ${player.maxSpeed} Kts!`, icon: "wind" });
    } else {
      sfx.deny();
    }
  } else if (uid === "crew") {
    const costG = 100 + player.crewLevel * 35;
    if (player.gold >= costG) {
      player.gold -= costG;
      player.crewLevel++;
      player.fireRate = Math.max(0.45, player.fireRate - 0.08);
      sfx.powerup();
      toast({ title: "CREW RECRUITED", body: "Reload speeds and auto-repairs increased!", icon: "heart" });
    } else {
      sfx.deny();
    }
  } else if (uid === "cargo") {
    if (player.gold >= 90 && player.wood >= 12) {
      player.gold -= 90;
      player.wood -= 12;
      player.cargoCapacity += 15;
      sfx.powerup();
      toast({ title: "HOLD EXPANDED", body: `Capacity now ${player.cargoCapacity} slots.`, icon: "box" });
    } else {
      sfx.deny();
    }
  } else if (uid === "consort" && player.consortsCount < 3) {
    const costG = 380 + player.consortsCount * 150;
    if (player.gold >= costG && player.wood >= 25) {
      player.gold -= costG;
      player.wood -= 25;
      player.consortsCount++;
      syncCompanions();
      sfx.powerup();
      toast({ title: "ESCORT COMMISSIONED", body: `Allied Gun Cutter joined your fleet!`, icon: "star" });
    } else {
      sfx.deny();
    }
  }
  renderPortUI();
}

// Boost Trigger
export function triggerBoost() {
  if (player.boostCooldown <= 0) {
    player.boostTimer = 2.5;
    player.boostCooldown = 5.5;
    sfx.powerup();
    toast({ title: "FULL SAIL SURGE!", body: "+75% Speed & Wind Advantage", icon: "wind" });
  }
}

// Fire Cannonball Helper
export function fireCannonball(fromX, fromY, toX, toY, dmg, maxRange, isFriendly, isGhost = false) {
  const d = dist(fromX, fromY, toX, toY);
  const ang = Math.atan2(toY - fromY, toX - fromX);
  const speed = 420;
  const life = Math.min(d / speed, maxRange / speed);

  cannonballs.push({
    x: fromX,
    y: fromY,
    startX: fromX,
    startY: fromY,
    targetX: toX,
    targetY: toY,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    life,
    maxLife: life,
    dmg,
    isFriendly,
    isGhost
  });

  playCannon({ pitch: isGhost ? 0.7 : 1.0 });

  // Cannon Smoke Muzzle Puff
  for (let s = 0; s < 3; s++) {
    smokeParticles.push({
      x: fromX + Math.cos(ang) * 10,
      y: fromY + Math.sin(ang) * 10,
      vx: Math.cos(ang + (Math.random() - 0.5) * 0.5) * (30 + Math.random() * 30),
      vy: Math.sin(ang + (Math.random() - 0.5) * 0.5) * (30 + Math.random() * 30),
      radius: 4 + Math.random() * 4,
      alpha: 0.7,
      isGhost
    });
  }
}

// Spawn Floating Loot Barrels
export function spawnFlotsam(x, y, level = 1) {
  const types = ["gold", "wood", "iron", "fish"];
  if (level >= 8) types.push("ruby");

  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const t = types[Math.floor(Math.random() * types.length)];
    let amount = 1;
    if (t === "gold") amount = 15 + level * 10 + Math.floor(Math.random() * 20);
    else if (t === "wood") amount = 2 + Math.floor(Math.random() * 4);
    else if (t === "iron") amount = 1 + Math.floor(Math.random() * 3);
    else if (t === "fish") amount = 1 + Math.floor(Math.random() * 2);
    else if (t === "ruby") amount = 1;

    floatingLoot.push({
      x: x + (Math.random() - 0.5) * 60,
      y: y + (Math.random() - 0.5) * 60,
      type: t,
      amount,
      bobOffset: Math.random() * Math.PI * 2,
      collected: false
    });
  }
}

// Sinking Respawn
function handlePlayerDeath() {
  playExplosion({ duration: 1.0, lowpass: 250 });
  toast({ title: "VESSEL SUNK!", body: "Lost 40% cargo. Towing back to safe harbor...", icon: "skull" });

  for (const k in player.cargo) {
    player.cargo[k] = Math.floor(player.cargo[k] * 0.6);
  }
  player.wood = player.cargo.wood || 0;
  player.iron = player.cargo.iron || 0;

  const port = ISLANDS[0]; // Always safe Tortuga Haven
  player.x = port.x + 150;
  player.y = port.y;
  player.hp = player.maxHp;
  player.speed = 0;
  player.sailThrottle = 0;
  player.angle = 0;
}

// Check island proximity & trigger battle
function checkIslandEncounter() {
  // Only trigger if not currently engaged
  if (activeIslandBattle) return;

  for (const isl of ISLANDS) {
    if (isl.captured) continue;

    // Territorial waters trigger radius: isl.r + 260px
    const d = dist(player.x, player.y, isl.x, isl.y);
    if (d < isl.r + 260) {
      activeIslandBattle = isl;
      enemyShips.length = 0;

      // Spawn defending warships around the island
      const count = isl.guardsTotal;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const r = isl.r + 100 + Math.random() * 90;
        enemyShips.push({
          x: isl.x + Math.cos(a) * r,
          y: isl.y + Math.sin(a) * r,
          angle: a + Math.PI / 2,
          speed: 65 + isl.level * 6,
          hp: 45 + isl.level * 22,
          maxHp: 45 + isl.level * 22,
          armor: isl.level * 3,
          dmg: 12 + isl.level * 3.5,
          range: 240,
          fireCd: Math.random() * 1.5,
          islandId: isl.id
        });
      }

      sfx.warn();
      toast({
        title: `TERRITORY OF ${isl.name.toUpperCase()}!`,
        body: `Defeat ${count} warships & ${isl.forts.filter(f => !f.destroyed).length} forts to claim this island!`,
        icon: "swords"
      });
      break;
    }
  }
}

// Main Game Update
function update(dt) {
  // Global Wind oscillation
  wind.timer += dt;
  if (wind.timer > 45) {
    wind.timer = 0;
    wind.angle += (Math.random() - 0.5) * 0.6;
    wind.speed = Math.max(8, Math.min(28, wind.speed + (Math.random() - 0.5) * 6));
  }

  // Market prices refresh
  marketTimer += dt;
  if (marketTimer >= 120) {
    marketTimer = 0;
    refreshMarketPrices();
  }

  // Passive Island Tax accumulation (every 30s)
  taxAccumulatorTimer += dt;
  if (taxAccumulatorTimer >= 30) {
    taxAccumulatorTimer = 0;
    ISLANDS.forEach((isl) => {
      if (isl.captured) {
        isl.tax += isl.level * 2.5;
      }
    });
  }

  // Out of combat passive repair (crew skill)
  if (enemyShips.length === 0 && !activeIslandBattle && player.hp < player.maxHp) {
    lastRepairTick += dt;
    if (lastRepairTick >= 3.0) {
      lastRepairTick = 0;
      player.hp = Math.min(player.maxHp, player.hp + player.crewLevel * 2);
    }
  }

  // Boost timer
  if (player.boostTimer > 0) player.boostTimer -= dt;
  if (player.boostCooldown > 0) player.boostCooldown -= dt;
  if (input.button("boost") || input.wasPressed("Space")) triggerBoost();
  if (input.wasPressed("KeyM") || input.button("map")) minimapOpen = !minimapOpen;

  // ==========================================
  // DUAL INPUT CONTROLS: WASD + ARROWS + MOUSE
  // ==========================================
  let isUsingKeyboard = false;

  // Rudder steering with A / D or Left / Right
  let steer = 0;
  if (input.isDown("KeyA") || input.isDown("ArrowLeft")) steer -= 1;
  if (input.isDown("KeyD") || input.isDown("ArrowRight")) steer += 1;

  if (steer !== 0) {
    isUsingKeyboard = true;
    const speedRatio = Math.max(0.4, Math.min(1.2, Math.abs(player.speed) / (player.maxSpeed * 0.5)));
    player.angle += steer * player.turnRate * speedRatio * dt;
  }

  // Sail Throttle with W / S or Up / Down
  if (input.isDown("KeyW") || input.isDown("ArrowUp")) {
    isUsingKeyboard = true;
    player.sailThrottle = lerp(player.sailThrottle, 1.0, dt * 3.0);
  } else if (input.isDown("KeyS") || input.isDown("ArrowDown")) {
    isUsingKeyboard = true;
    player.sailThrottle = lerp(player.sailThrottle, -0.25, dt * 4.0);
  } else if (isUsingKeyboard) {
    // Gradual drag when keys released
    player.sailThrottle = lerp(player.sailThrottle, 0, dt * 1.5);
  }

  // Mouse / Touch input (seamless alternate)
  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;
  const worldMouseX = input.mouse.x + camX;
  const worldMouseY = input.mouse.y + camY;

  if (!isUsingKeyboard) {
    if (input.mouse.down) {
      const targetAngle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
      const dAngle = angleDiff(targetAngle, player.angle);
      player.angle += clamp(dAngle, -player.turnRate * dt, player.turnRate * dt);
      player.sailThrottle = lerp(player.sailThrottle, 1.0, dt * 2.5);
    } else if (input.stick.active) {
      const dAngle = angleDiff(input.stick.angle, player.angle);
      player.angle += clamp(dAngle, -player.turnRate * dt, player.turnRate * dt);
      player.sailThrottle = lerp(player.sailThrottle, input.stick.distance, dt * 3.0);
    } else {
      player.sailThrottle = lerp(player.sailThrottle, 0, dt * 1.8);
    }
  }

  // Wind speed modifier (Authentic sailing: sailing with wind gives +25% bonus)
  const windAngleDiff = Math.abs(angleDiff(wind.angle, player.angle));
  const windFactor = 1.0 + Math.cos(windAngleDiff) * 0.25;

  const boostMult = player.boostTimer > 0 ? 1.75 : 1.0;
  const targetSpeed = player.sailThrottle * player.maxSpeed * windFactor * boostMult;
  player.speed = lerp(player.speed, targetSpeed, dt * 2.2);

  // Position integration
  player.x += Math.cos(player.angle) * player.speed * dt;
  player.y += Math.sin(player.angle) * player.speed * dt;
  player.x = clamp(player.x, 150, WORLD_SIZE - 150);
  player.y = clamp(player.y, 150, WORLD_SIZE - 150);

  // Wake particle emission
  if (Math.abs(player.speed) > 20) {
    wakeParticles.push({
      x: player.x - Math.cos(player.angle) * 22,
      y: player.y - Math.sin(player.angle) * 22,
      alpha: 0.65,
      size: 4 + Math.random() * 4
    });
  }

  // Consort Ships AI follow formation
  consorts.forEach((c, idx) => {
    const followDist = 55 + idx * 35;
    const offsetSide = idx % 2 === 0 ? 45 : -45;
    const targetX = player.x - Math.cos(player.angle) * followDist + Math.sin(player.angle) * offsetSide;
    const targetY = player.y - Math.sin(player.angle) * followDist - Math.cos(player.angle) * offsetSide;
    c.x = lerp(c.x, targetX, dt * 4.0);
    c.y = lerp(c.y, targetY, dt * 4.0);
    c.angle = lerp(c.angle, player.angle, dt * 3.5);
  });

  // Check island proximity & Port access
  checkIslandEncounter();

  ISLANDS.forEach((isl) => {
    const d = dist(player.x, player.y, isl.x, isl.y);
    if (d < isl.r + 70 && isl.captured) {
      player.lastPortId = isl.id;

      // Auto-fishing when anchored or slow near friendly island
      if (Math.abs(player.speed) < 18) {
        if (performance.now() - lastFishingTime > 3500) {
          lastFishingTime = performance.now();
          const totalCargo = Object.values(player.cargo).reduce((a, b) => a + b, 0);
          if (totalCargo < player.cargoCapacity) {
            player.cargo.fish = (player.cargo.fish || 0) + 1;
            playTone(660, 0.08, "sine", 0.15);
            toast({ title: "CAUGHT FISH!", body: "+1 Fresh Cod for the hold" });
          }
        }
      }

      // Open port on E key or port button
      if ((input.wasPressed("KeyE") || input.button("port")) && (!portModal || portModal.style.display !== "flex")) {
        openPortModal(isl);
      }
    }
  });

  // ==========================================
  // DOKDO BROADSIDE AUTO-FIRING MECHANIC
  // ==========================================
  player.portCooldown -= dt;
  player.starboardCooldown -= dt;
  player.bowCooldown -= dt;

  // Target list: Enemy warships + Enemy Coastal Forts
  const enemyTargets = [];
  enemyShips.forEach(e => enemyTargets.push(e));
  if (activeIslandBattle) {
    activeIslandBattle.forts.forEach(f => {
      if (!f.destroyed) enemyTargets.push(f);
    });
  }

  enemyTargets.forEach((target) => {
    const d = dist(player.x, player.y, target.x, target.y);
    if (d > player.cannonRange) return;

    let relAngle = (Math.atan2(target.y - player.y, target.x - player.x) - player.angle) % (Math.PI * 2);
    if (relAngle < 0) relAngle += Math.PI * 2;
    const deg = (relAngle * 180) / Math.PI;

    // Port (Left) Broadside: 50° to 130°
    if (deg >= 50 && deg <= 130 && player.portCooldown <= 0) {
      player.portCooldown = player.fireRate;
      for (let g = 0; g < player.portGuns; g++) {
        setTimeout(() => {
          fireCannonball(player.x, player.y, target.x, target.y, player.cannonDmg, player.cannonRange, true);
        }, g * 70);
      }
    }

    // Starboard (Right) Broadside: 230° to 310°
    if (deg >= 230 && deg <= 310 && player.starboardCooldown <= 0) {
      player.starboardCooldown = player.fireRate;
      for (let g = 0; g < player.starboardGuns; g++) {
        setTimeout(() => {
          fireCannonball(player.x, player.y, target.x, target.y, player.cannonDmg, player.cannonRange, true);
        }, g * 70);
      }
    }

    // Forward Bow Gun: 340° to 360° or 0° to 20°
    if (player.hasBowGun && (deg <= 20 || deg >= 340) && player.bowCooldown <= 0) {
      player.bowCooldown = player.fireRate * 0.8;
      fireCannonball(player.x, player.y, target.x, target.y, player.cannonDmg * 0.85, player.cannonRange * 1.15, true);
    }
  });

  // Consorts broadsides
  consorts.forEach((c) => {
    c.portCd -= dt;
    c.starCd -= dt;
    enemyTargets.forEach((target) => {
      const d = dist(c.x, c.y, target.x, target.y);
      if (d > 220) return;
      let rel = (Math.atan2(target.y - c.y, target.x - c.x) - c.angle) % (Math.PI * 2);
      if (rel < 0) rel += Math.PI * 2;
      const deg = (rel * 180) / Math.PI;

      if (deg >= 55 && deg <= 125 && c.portCd <= 0) {
        c.portCd = 1.2;
        fireCannonball(c.x, c.y, target.x, target.y, 20, 220, true);
      }
      if (deg >= 235 && deg <= 305 && c.starCd <= 0) {
        c.starCd = 1.2;
        fireCannonball(c.x, c.y, target.x, target.y, 20, 220, true);
      }
    });
  });

  // Update Enemy Ships AI
  for (let i = enemyShips.length - 1; i >= 0; i--) {
    const e = enemyShips[i];
    e.fireCd -= dt;

    // AI navigation: circle and align broadsides with player
    const toPlayerAngle = Math.atan2(player.y - e.y, player.x - e.x);
    const dToPlayer = dist(e.x, e.y, player.x, player.y);

    let targetHeading = toPlayerAngle;
    if (dToPlayer < 180) {
      // Circle player to bring broadside to bear
      targetHeading = toPlayerAngle + Math.PI / 2;
    }

    e.angle += clamp(angleDiff(targetHeading, e.angle), -1.4 * dt, 1.4 * dt);
    e.x += Math.cos(e.angle) * e.speed * dt;
    e.y += Math.sin(e.angle) * e.speed * dt;

    // Enemy broadside firing
    if (dToPlayer < e.range && e.fireCd <= 0) {
      e.fireCd = 1.8 + Math.random() * 0.6;
      fireCannonball(e.x, e.y, player.x, player.y, e.dmg, e.range, false);
    }

    if (e.hp <= 0) {
      playExplosion({ duration: 0.7, lowpass: 220 });
      spawnFlotsam(e.x, e.y, activeIslandBattle?.level || 1);
      player.shipsSunk++;
      enemyShips.splice(i, 1);
    }
  }

  // Update Island Forts
  if (activeIslandBattle) {
    activeIslandBattle.forts.forEach((fort) => {
      if (fort.destroyed) return;
      fort.fireCd -= dt;
      const d = dist(fort.x, fort.y, player.x, player.y);
      if (d < fort.range && fort.fireCd <= 0) {
        fort.fireCd = 2.0 + Math.random() * 0.8;
        fireCannonball(fort.x, fort.y, player.x, player.y, fort.dmg, fort.range, false);
      }

      if (fort.hp <= 0) {
        fort.destroyed = true;
        playExplosion({ duration: 1.0, lowpass: 200 });
        spawnFlotsam(fort.x, fort.y, activeIslandBattle.level + 2);
        toast({ title: "COASTAL FORT DESTROYED!", body: "Island defenses crumbling!", icon: "boom" });
      }
    });

    // Check Island Capture Condition: All enemy ships defeated AND all forts destroyed!
    const fortsRemaining = activeIslandBattle.forts.filter(f => !f.destroyed).length;
    if (enemyShips.length === 0 && fortsRemaining === 0) {
      activeIslandBattle.captured = true;
      sfx.fanfare();
      player.islandsCaptured = ISLANDS.filter((i) => i.captured).length;
      player.gold += activeIslandBattle.level * 120;
      playCoin();

      toast({
        title: `ISLAND CONQUERED: ${activeIslandBattle.name.toUpperCase()}!`,
        body: `+${activeIslandBattle.level * 120} Gold Reward! Safe port & passive taxes unlocked!`,
        icon: "trophy"
      });

      // Save game progress
      saveGameScore("ironsail", player.islandsCaptured, `${player.islandsCaptured}/18 Islands Captured (${player.gold} Gold)`);
      saveSlot("ironsail:dokdo_save", {
        gold: player.gold,
        wood: player.wood,
        iron: player.iron,
        hullLevel: player.hullLevel,
        portGuns: player.portGuns,
        starboardGuns: player.starboardGuns,
        hasBowGun: player.hasBowGun,
        sailsLevel: player.sailsLevel,
        crewLevel: player.crewLevel,
        consortsCount: player.consortsCount,
        capturedIds: ISLANDS.filter(i => i.captured).map(i => i.id)
      });

      activeIslandBattle = null;
    }
  }

  // Update Cannonballs & Ballistic Trajectory
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const cb = cannonballs[i];
    cb.x += cb.vx * dt;
    cb.y += cb.vy * dt;
    cb.life -= dt;

    // Check hit against player
    if (!cb.isFriendly) {
      if (dist(cb.x, cb.y, player.x, player.y) < 26) {
        const netDmg = Math.max(4, Math.round(cb.dmg * (1 - player.armor / 100)));
        player.hp -= netDmg;
        playHit({ isCritical: false });
        createSplinters(cb.x, cb.y);
        cannonballs.splice(i, 1);
        if (player.hp <= 0) handlePlayerDeath();
        continue;
      }
    }

    // Check hit against enemies
    if (cb.isFriendly) {
      let hit = false;
      for (const e of enemyShips) {
        if (dist(cb.x, cb.y, e.x, e.y) < 24) {
          const netDmg = Math.max(5, Math.round(cb.dmg * (1 - e.armor / 100)));
          e.hp -= netDmg;
          playHit({ isCritical: true });
          createSplinters(cb.x, cb.y);
          cannonballs.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // Check hit against hostile coastal forts
      if (activeIslandBattle) {
        for (const fort of activeIslandBattle.forts) {
          if (!fort.destroyed && dist(cb.x, cb.y, fort.x, fort.y) < 32) {
            fort.hp -= cb.dmg;
            playHit({ isCritical: true });
            createSplinters(cb.x, cb.y);
            cannonballs.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }
    }

    if (cb.life <= 0) {
      // Splash in ocean
      cannonballs.splice(i, 1);
    }
  }

  // Update Floating Loot Magnet & Pickup
  for (let i = floatingLoot.length - 1; i >= 0; i--) {
    const loot = floatingLoot[i];
    loot.bobOffset += dt * 3.0;

    const d = dist(player.x, player.y, loot.x, loot.y);
    if (d < 160) {
      // Magnet toward ship
      loot.x = lerp(loot.x, player.x, dt * 5.0);
      loot.y = lerp(loot.y, player.y, dt * 5.0);
    }

    if (d < 48) {
      // Collect loot!
      playCoin();
      if (loot.type === "gold") {
        player.gold += loot.amount;
        floatingTexts.push({ text: `+${loot.amount} GOLD`, x: loot.x, y: loot.y, life: 1.2, color: "#ffd700" });
      } else if (loot.type === "wood") {
        player.wood += loot.amount;
        player.cargo.wood = (player.cargo.wood || 0) + loot.amount;
        floatingTexts.push({ text: `+${loot.amount} TIMBER`, x: loot.x, y: loot.y, life: 1.2, color: "#d2a679" });
      } else if (loot.type === "iron") {
        player.iron += loot.amount;
        player.cargo.iron = (player.cargo.iron || 0) + loot.amount;
        floatingTexts.push({ text: `+${loot.amount} IRON`, x: loot.x, y: loot.y, life: 1.2, color: "#a8c0ff" });
      } else if (loot.type === "fish") {
        player.cargo.fish = (player.cargo.fish || 0) + loot.amount;
        floatingTexts.push({ text: `+${loot.amount} FISH`, x: loot.x, y: loot.y, life: 1.2, color: "#00e5ff" });
      } else if (loot.type === "ruby") {
        player.cargo.ruby = (player.cargo.ruby || 0) + loot.amount;
        floatingTexts.push({ text: `+${loot.amount} RUBY`, x: loot.x, y: loot.y, life: 1.4, color: "#ff1744" });
      }
      floatingLoot.splice(i, 1);
    }
  }

  // Update Particles
  for (let i = wakeParticles.length - 1; i >= 0; i--) {
    wakeParticles[i].alpha -= dt * 0.45;
    if (wakeParticles[i].alpha <= 0) wakeParticles.splice(i, 1);
  }
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    smokeParticles[i].x += smokeParticles[i].vx * dt;
    smokeParticles[i].y += smokeParticles[i].vy * dt;
    smokeParticles[i].alpha -= dt * 0.8;
    smokeParticles[i].radius += dt * 4;
    if (smokeParticles[i].alpha <= 0) smokeParticles.splice(i, 1);
  }
  for (let i = splinters.length - 1; i >= 0; i--) {
    splinters[i].x += splinters[i].vx * dt;
    splinters[i].y += splinters[i].vy * dt;
    splinters[i].alpha -= dt * 1.2;
    if (splinters[i].alpha <= 0) splinters.splice(i, 1);
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].y -= dt * 30;
    floatingTexts[i].life -= dt;
    if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
  }

  // Sync Telemetry HUD
  updateHUD();
}

function createSplinters(x, y) {
  for (let i = 0; i < 8; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 80;
    splinters.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      alpha: 1.0,
      len: 3 + Math.random() * 4
    });
  }
}

function updateHUD() {
  const hpFill = document.getElementById("hud-hp-fill");
  const hpText = document.getElementById("hud-hp-text");
  const goldText = document.getElementById("hud-gold");
  const cargoText = document.getElementById("hud-cargo");
  const islandStatus = document.getElementById("hud-island-status");
  const shipTierEl = document.getElementById("hud-ship-tier");
  const windDirEl = document.getElementById("hud-wind-dir");

  if (hpFill) {
    const pct = Math.max(0, player.hp / player.maxHp);
    hpFill.style.width = `${pct * 100}%`;
    hpFill.className = pct < 0.3 ? "hud-hp-fill danger" : "hud-hp-fill";
  }
  if (hpText) hpText.textContent = `${Math.max(0, Math.round(player.hp))} / ${player.maxHp}`;
  if (goldText) goldText.textContent = `${player.gold} G`;
  if (cargoText) {
    const curCargo = Object.values(player.cargo).reduce((a, b) => a + b, 0);
    cargoText.textContent = `${curCargo} / ${player.cargoCapacity}`;
  }
  if (islandStatus) {
    const captured = ISLANDS.filter(i => i.captured).length;
    islandStatus.textContent = `CAPTURED: [${captured} / 18 ISLANDS]`;
  }
  if (shipTierEl) {
    const tier = getShipTier(player.hullLevel);
    shipTierEl.textContent = `TIER ${tier.tier}: ${tier.name.toUpperCase()}`;
  }
  if (windDirEl) {
    const deg = Math.round((wind.angle * 180) / Math.PI) % 360;
    windDirEl.textContent = `${deg}° (${wind.speed} KTS)`;
  }
}

// ==========================================
// DETAILED RETRO PROCEDURAL RENDERING
// ==========================================
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const camX = Math.round(player.x - canvas.width / 2);
  const camY = Math.round(player.y - canvas.height / 2);

  ctx.save();
  ctx.translate(-camX, -camY);

  // 1. Ocean Background with Dynamic Sector Depth Color
  drawOcean(camX, camY);

  // 2. Wake Foams
  wakeParticles.forEach((p) => {
    ctx.fillStyle = `rgba(200, 240, 255, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Islands with Organic Coastlines, Beaches, Trees, Docks, & Forts
  ISLANDS.forEach((isl) => {
    if (dist(player.x, player.y, isl.x, isl.y) < 1400) {
      drawDetailedIsland(isl);
    }
  });

  // 4. Floating Flotsam & Cargo Barrels
  floatingLoot.forEach((loot) => {
    drawFlotsamItem(loot);
  });

  // 5. Enemy Warships
  enemyShips.forEach((e) => {
    drawDetailedShip(e.x, e.y, e.angle, 1, false, e.hp / e.maxHp, 2);
  });

  // 6. Consorts
  consorts.forEach((c) => {
    drawDetailedShip(c.x, c.y, c.angle, 1, true, c.hp / c.maxHp, 1);
  });

  // 7. Player Ship
  const playerTier = getShipTier(player.hullLevel);
  drawBroadsideArcs(player.x, player.y, player.angle, player.cannonRange);
  drawDetailedShip(player.x, player.y, player.angle, playerTier.tier, true, player.hp / player.maxHp, player.portGuns);

  // 8. Cannonballs & Shadows
  drawCannonballs();

  // 9. Smoke & Splinter Particles
  smokeParticles.forEach((sp) => {
    ctx.fillStyle = sp.isGhost ? `rgba(80, 255, 120, ${sp.alpha})` : `rgba(200, 200, 200, ${sp.alpha})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  splinters.forEach((s) => {
    ctx.strokeStyle = `rgba(210, 166, 121, ${s.alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.vx * 0.04, s.y + s.vy * 0.04);
    ctx.stroke();
  });

  // 10. Floating Loot Text
  floatingTexts.forEach((ft) => {
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = ft.color;
    ctx.textAlign = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
  });

  ctx.restore();

  // 11. HUD Minimap & Radar Overlay
  drawMinimap(minimapOpen);
}

// Detailed Ocean with Grid & Waves
function drawOcean(camX, camY) {
  // Determine dominant sector color for water tint
  let waterColor = "#041c26";
  for (const s of SECTORS) {
    if (player.x >= s.bounds.x0 && player.x <= s.bounds.x1 &&
        player.y >= s.bounds.y0 && player.y <= s.bounds.y1) {
      waterColor = s.water;
      break;
    }
  }

  ctx.fillStyle = waterColor;
  ctx.fillRect(camX, camY, canvas.width, canvas.height);

  // Wave ripple lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const time = performance.now() * 0.001;
  const startGridX = Math.floor(camX / 80) * 80;
  const startGridY = Math.floor(camY / 80) * 80;

  ctx.beginPath();
  for (let x = startGridX; x < camX + canvas.width + 80; x += 80) {
    for (let y = startGridY; y < camY + canvas.height + 80; y += 80) {
      const waveX = x + Math.sin(time + y * 0.02) * 8;
      ctx.moveTo(waveX, y);
      ctx.lineTo(waveX + 16, y);
    }
  }
  ctx.stroke();
}

// Broadside Cones of Fire
function drawBroadsideArcs(x, y, angle, range) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = "rgba(0, 191, 165, 0.04)";
  ctx.strokeStyle = "rgba(0, 191, 165, 0.2)";
  ctx.lineWidth = 1;

  // Port Broadside: 50° to 130°
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, range, (50 * Math.PI) / 180, (130 * Math.PI) / 180);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Starboard Broadside: 230° to 310°
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, range, (230 * Math.PI) / 180, (310 * Math.PI) / 180);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Detailed Procedural Ship Renderer
function drawDetailedShip(x, y, angle, tierNum, isFriendly, hpRatio, gunCount) {
  const tier = SHIP_TIERS[tierNum - 1] || SHIP_TIERS[0];
  const len = tier.len;
  const beam = tier.beam;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 1. Water displacement shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 3, len * 0.55, beam * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Wooden Hull Body (Oak Plank Texture)
  ctx.fillStyle = isFriendly ? "#1c2b36" : "#38171d";
  ctx.strokeStyle = isFriendly ? "#00bfa5" : "#ff3344";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(len * 0.55, 0); // Bowsprit prow
  ctx.lineTo(len * 0.25, beam * 0.5);
  ctx.lineTo(-len * 0.45, beam * 0.45); // Stern
  ctx.lineTo(-len * 0.5, 0);
  ctx.lineTo(-len * 0.45, -beam * 0.45);
  ctx.lineTo(len * 0.25, -beam * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 3. Deck Planks
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-len * 0.4, -beam * 0.25);
  ctx.lineTo(len * 0.2, -beam * 0.25);
  ctx.moveTo(-len * 0.4, 0);
  ctx.lineTo(len * 0.3, 0);
  ctx.moveTo(-len * 0.4, beam * 0.25);
  ctx.lineTo(len * 0.2, beam * 0.25);
  ctx.stroke();

  // 4. Protruding Cannon Barrels on Port & Starboard sides!
  ctx.fillStyle = "#111111";
  const numGuns = Math.min(6, Math.max(1, gunCount));
  const spacing = (len * 0.55) / (numGuns + 1);
  for (let g = 0; g < numGuns; g++) {
    const gx = -len * 0.25 + (g + 1) * spacing;
    // Port barrel
    ctx.fillRect(gx - 2, beam * 0.45, 4, 5);
    // Starboard barrel
    ctx.fillRect(gx - 2, -beam * 0.45 - 5, 4, 5);
  }

  // 5. Masts & Fluttering Canvas Sails
  const numMasts = tier.masts;
  const mastSpacing = (len * 0.6) / (numMasts + 1);
  for (let m = 0; m < numMasts; m++) {
    const mx = -len * 0.3 + (m + 1) * mastSpacing;
    const mastWidth = beam * (0.9 - m * 0.1);

    // Mast crossbeam
    ctx.fillStyle = "#4a3319";
    ctx.fillRect(mx - 1.5, -mastWidth * 0.5, 3, mastWidth);

    // Billowing White Canvas Sail (fluttering curve)
    ctx.fillStyle = isFriendly ? "#f4f4f6" : "#423235";
    ctx.strokeStyle = "#8a97a0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx - 2, -mastWidth * 0.5);
    ctx.quadraticCurveTo(mx + 4, 0, mx - 2, mastWidth * 0.5);
    ctx.lineTo(mx + 2, mastWidth * 0.5);
    ctx.quadraticCurveTo(mx + 8, 0, mx + 2, -mastWidth * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 6. Gilded Figurehead on bow (Tiers 4+)
  if (tierNum >= 4) {
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(len * 0.55, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. Overhead Health Bar
  ctx.rotate(-angle);
  const barW = Math.max(28, len * 0.6);
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(-barW / 2, -len * 0.5 - 12, barW, 4);

  ctx.fillStyle = hpRatio < 0.3 ? "#ff2233" : (isFriendly ? "#00ff66" : "#ff9900");
  ctx.fillRect(-barW / 2, -len * 0.5 - 12, barW * Math.max(0, hpRatio), 4);

  ctx.restore();
}

// Detailed Island with Beaches, Organic Terrain, Trees, Docks, & Coastal Forts
function drawDetailedIsland(isl) {
  ctx.save();

  // 1. Organic Sandy Shoreline & Foaming Surf
  ctx.fillStyle = isl.captured ? "#ffd699" : "#d2b48c";
  ctx.beginPath();
  const numPts = 16;
  for (let i = 0; i < numPts; i++) {
    const a = (i / numPts) * Math.PI * 2;
    // Pseudo-random bumpy radius using island seed
    const bump = Math.sin(a * 4 + isl.seed) * 12 + Math.cos(a * 7 + isl.seed) * 6;
    const r = isl.r + bump;
    const px = isl.x + Math.cos(a) * r;
    const py = isl.y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // 2. Interior Lush Green / Volcanic Ground
  ctx.fillStyle = isl.captured ? "#2d8a4e" : "#555d66";
  ctx.beginPath();
  for (let i = 0; i < numPts; i++) {
    const a = (i / numPts) * Math.PI * 2;
    const bump = Math.sin(a * 4 + isl.seed) * 10;
    const r = isl.r - 18 + bump;
    const px = isl.x + Math.cos(a) * r;
    const py = isl.y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // 3. Palm Trees & Tropical Foliage Clusters
  ctx.fillStyle = "#1b5e20";
  for (let t = 0; t < 6; t++) {
    const ta = (t / 6) * Math.PI * 2 + isl.seed;
    const tr = (isl.r * 0.45) + (t % 2) * 12;
    ctx.beginPath();
    ctx.arc(isl.x + Math.cos(ta) * tr, isl.y + Math.sin(ta) * tr, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Harbor Pier / Wooden Dock
  ctx.fillStyle = "#5c4033";
  ctx.fillRect(isl.x + isl.r - 15, isl.y - 8, 30, 16);
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(isl.x + isl.r - 12, isl.y - 6, 26, 12);

  // 5. Coastal Fortresses & Defense Towers
  isl.forts.forEach((fort, fIdx) => {
    if (fort.destroyed) {
      // Rubble
      ctx.fillStyle = "#444";
      ctx.beginPath();
      ctx.arc(fort.x, fort.y, 10, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Stone Bastion
    ctx.fillStyle = isl.captured ? "#1c3b44" : "#4a1921";
    ctx.strokeStyle = isl.captured ? "#00bfa5" : "#ff3344";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fort.x, fort.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotating Cannon Turret
    const aimAngle = Math.atan2(player.y - fort.y, player.x - fort.x);
    ctx.save();
    ctx.translate(fort.x, fort.y);
    ctx.rotate(aimAngle);
    ctx.fillStyle = "#111";
    ctx.fillRect(4, -3, 10, 6);
    ctx.restore();

    // Fort HP Bar
    if (!isl.captured) {
      const fortHpPct = fort.hp / fort.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(fort.x - 16, fort.y - 22, 32, 4);
      ctx.fillStyle = fortHpPct < 0.3 ? "#ff2233" : "#00ff66";
      ctx.fillRect(fort.x - 16, fort.y - 22, 32 * fortHpPct, 4);
    }
  });

  // 6. Island Name Banner
  ctx.fillStyle = "#ffffff";
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillText(isl.name, isl.x, isl.y - isl.r - 14);

  if (isl.captured) {
    ctx.fillStyle = "#00bfa5";
    ctx.font = '8px "VT323", monospace';
    ctx.fillText(`[PORT OPEN • TAX: ${Math.floor(isl.tax)}G]`, isl.x, isl.y - isl.r - 2);
  } else {
    ctx.fillStyle = "#ff4444";
    ctx.font = '8px "VT323", monospace';
    const fortsAlive = isl.forts.filter(f => !f.destroyed).length;
    ctx.fillText(`[LVL ${isl.level} HOSTILE • ${fortsAlive} FORTS]`, isl.x, isl.y - isl.r - 2);
  }

  ctx.restore();
}

// Floating Flotsam Render
function drawFlotsamItem(loot) {
  const bobY = Math.sin(loot.bobOffset) * 3;
  ctx.save();
  ctx.translate(loot.x, loot.y + bobY);

  // Barrel shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (loot.type === "gold") {
    // Treasure Chest
    ctx.fillStyle = "#b8860b";
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 1.5;
    ctx.fillRect(-7, -5, 14, 10);
    ctx.strokeRect(-7, -5, 14, 10);
  } else {
    // Wooden Barrel
    ctx.fillStyle = loot.type === "wood" ? "#8b5a2b" : (loot.type === "iron" ? "#708090" : "#4682b4");
    ctx.strokeStyle = "#2f1e0e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

// Cannonballs with Ballistic Elevation & Shadow
function drawCannonballs() {
  cannonballs.forEach((cb) => {
    const prog = 1 - cb.life / cb.maxLife;
    const height = Math.sin(prog * Math.PI) * 16; // parabolic arc

    // Water shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.arc(cb.x, cb.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Elevated projectile
    ctx.fillStyle = cb.isGhost ? "#50ff78" : (cb.isFriendly ? "#ffd700" : "#ff3333");
    ctx.beginPath();
    ctx.arc(cb.x, cb.y - height, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Full Radar & Interactive Ocean Minimap — Nautical Chart Overhaul
function drawMinimap(isExpanded) {
  const now = performance.now();

  // ── Layout: collapsed sits below the top-right HUD; expanded centers on canvas ──
  const pad = 8;              // inner padding around chart area
  const headerH = 22;         // header bar height

  let mapW, mapH, mapX, mapY, chartSize;
  if (isExpanded) {
    mapW = 520;
    mapH = 520;
    mapX = Math.round((canvas.width - mapW) / 2);
    mapY = Math.round((canvas.height - mapH) / 2);
    chartSize = mapW - pad * 2;
  } else {
    chartSize = 148;           // 1:1 square chart
    mapW = chartSize + pad * 2;
    mapH = chartSize + pad * 2 + headerH;
    mapX = canvas.width - mapW - 12;
    mapY = 74;                 // safely below HUD cards (~64px tall)
  }

  const chartX = mapX + pad;
  const chartY = mapY + headerH + pad;
  const chartEnd = chartSize;  // alias for readability

  // Projection helpers: world coords → chart pixel coords (1:1 square, fully clamped)
  const toMX = (wx) => chartX + (clamp(wx, 0, WORLD_SIZE) / WORLD_SIZE) * chartEnd;
  const toMY = (wy) => chartY + (clamp(wy, 0, WORLD_SIZE) / WORLD_SIZE) * chartEnd;

  ctx.save();

  // ── Expanded-mode dimming backdrop ──
  if (isExpanded) {
    ctx.fillStyle = "rgba(2, 10, 16, 0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Outer frame & background ──
  ctx.fillStyle = "rgba(3, 12, 20, 0.92)";
  ctx.strokeStyle = "#00bfa5";
  ctx.lineWidth = 2;
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeRect(mapX, mapY, mapW, mapH);

  // ── Sector bathymetry tints ──
  SECTORS.forEach((s) => {
    if (s.id === 6) return; // Abyssal overlaps others; skip or draw last
    const sx0 = toMX(s.bounds.x0);
    const sy0 = toMY(s.bounds.y0);
    const sx1 = toMX(s.bounds.x1);
    const sy1 = toMY(s.bounds.y1);
    ctx.fillStyle = s.water + "44"; // translucent sector wash
    ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  });
  // Abyssal Trench (sector 6) drawn on top
  const abyss = SECTORS[5];
  ctx.fillStyle = abyss.water + "33";
  ctx.fillRect(toMX(abyss.bounds.x0), toMY(abyss.bounds.y0),
    toMX(abyss.bounds.x1) - toMX(abyss.bounds.x0),
    toMY(abyss.bounds.y1) - toMY(abyss.bounds.y0));

  // ── Lat/Long navigation grid ──
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 4]);
  const gridStep = isExpanded ? 1200 : 2400;
  for (let g = gridStep; g < WORLD_SIZE; g += gridStep) {
    const gx = toMX(g);
    const gy = toMY(g);
    ctx.beginPath(); ctx.moveTo(gx, chartY); ctx.lineTo(gx, chartY + chartEnd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(chartX, gy); ctx.lineTo(chartX + chartEnd, gy); ctx.stroke();
  }
  ctx.setLineDash([]);

  // ── Sector name watermarks (expanded only) ──
  if (isExpanded) {
    ctx.font = '8px "VT323", monospace';
    ctx.textAlign = "center";
    SECTORS.forEach((s) => {
      if (s.id === 6) return;
      const cx = toMX((s.bounds.x0 + s.bounds.x1) / 2);
      const cy = toMY((s.bounds.y0 + s.bounds.y1) / 2);
      ctx.fillStyle = s.color + "30";
      ctx.fillText(s.name.toUpperCase(), cx, cy);
    });
  }

  // ── Sector boundary lines ──
  ctx.strokeStyle = "rgba(0, 191, 165, 0.15)";
  ctx.lineWidth = 1;
  // Vertical divider at x=4800
  ctx.beginPath();
  ctx.moveTo(toMX(4800), chartY);
  ctx.lineTo(toMX(4800), chartY + chartEnd);
  ctx.stroke();
  // Horizontal divider at y=4800
  ctx.beginPath();
  ctx.moveTo(chartX, toMY(4800));
  ctx.lineTo(chartX + chartEnd, toMY(4800));
  ctx.stroke();
  // Horizontal divider at y=7200 (Royal Navy / Devil's Shroud split)
  ctx.beginPath();
  ctx.moveTo(toMX(4800), toMY(7200));
  ctx.lineTo(toMX(9600), toMY(7200));
  ctx.stroke();

  // ── Camera viewport frustum box ──
  const camX = player.x - canvas.width / 2;
  const camY_pos = player.y - canvas.height / 2;
  const vx0 = toMX(camX);
  const vy0 = toMY(camY_pos);
  const vx1 = toMX(camX + canvas.width);
  const vy1 = toMY(camY_pos + canvas.height);
  ctx.fillStyle = "rgba(0, 191, 165, 0.06)";
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.strokeStyle = "rgba(0, 255, 204, 0.35)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.setLineDash([]);

  // ── Islands ──
  ISLANDS.forEach((isl) => {
    const mx = toMX(isl.x);
    const my = toMY(isl.y);
    const dotR = isExpanded ? 5 : 3;

    // Active battle pulsing warning ring
    if (activeIslandBattle?.id === isl.id) {
      const pulse = 0.5 + Math.sin(now * 0.008) * 0.5;
      ctx.strokeStyle = `rgba(255, 235, 59, ${0.3 + pulse * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, dotR + 3 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Island dot
    ctx.fillStyle = isl.captured ? "#00bfa5" : (activeIslandBattle?.id === isl.id ? "#ffeb3b" : "#ff3344");
    ctx.beginPath();
    ctx.arc(mx, my, dotR, 0, Math.PI * 2);
    ctx.fill();

    // Captured anchor ring
    if (isl.captured) {
      ctx.strokeStyle = "rgba(0, 191, 165, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx, my, dotR + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Island labels
    if (isExpanded) {
      ctx.fillStyle = isl.captured ? "#a0f0e0" : "#ff8888";
      ctx.font = '8px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.fillText(isl.name, mx, my - dotR - 3);

      // Level badge & fort count
      if (!isl.captured) {
        const fortsAlive = isl.forts ? isl.forts.filter(f => !f.destroyed).length : 0;
        ctx.fillStyle = "#ffaa44";
        ctx.font = '7px "VT323", monospace';
        ctx.fillText(`LV${isl.level} • ${fortsAlive}F`, mx, my + dotR + 9);
      } else {
        ctx.fillStyle = "#63d1c1";
        ctx.font = '7px "VT323", monospace';
        ctx.fillText(`PORT • ${Math.floor(isl.tax)}G`, mx, my + dotR + 9);
      }
    }
  });

  // ── Enemy warship pips ──
  enemyShips.forEach((e) => {
    const ex = toMX(e.x);
    const ey = toMY(e.y);
    ctx.fillStyle = "#ff3344";
    // Diamond shape
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  });

  // ── Consort ship pips ──
  consorts.forEach((c) => {
    const cx = toMX(c.x);
    const cy = toMY(c.y);
    ctx.fillStyle = "#00ff88";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2.5);
    ctx.lineTo(cx + 2, cy + 2);
    ctx.lineTo(cx - 2, cy + 2);
    ctx.closePath();
    ctx.fill();
  });

  // ── Floating loot glitter (nearby only) ──
  if (isExpanded) {
    floatingLoot.forEach((loot) => {
      const lx = toMX(loot.x);
      const ly = toMY(loot.y);
      const twinkle = 0.4 + Math.sin(now * 0.01 + loot.bobOffset) * 0.4;
      ctx.fillStyle = `rgba(255, 215, 0, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ── Animated radar sweep (collapsed only) ──
  if (!isExpanded) {
    const sweepAngle = (now * 0.002) % (Math.PI * 2);
    const pmx = toMX(player.x);
    const pmy = toMY(player.y);
    const sweepR = chartEnd * 0.45;

    ctx.save();
    ctx.beginPath();
    ctx.rect(chartX, chartY, chartEnd, chartEnd);
    ctx.clip();

    const grad = ctx.createConicalGradient
      ? null  // not widely supported; fallback to arc
      : null;
    // Draw a fading sweep arc
    for (let i = 0; i < 20; i++) {
      const a = sweepAngle - (i / 20) * 0.8;
      const alpha = (1 - i / 20) * 0.12;
      ctx.strokeStyle = `rgba(0, 255, 200, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pmx, pmy);
      ctx.lineTo(pmx + Math.cos(a) * sweepR, pmy + Math.sin(a) * sweepR);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Player vessel icon (golden directional ship) ──
  const pmx = toMX(player.x);
  const pmy = toMY(player.y);

  // Sonar ping pulse ring
  const pingPhase = (now * 0.003) % 1;
  const pingR = pingPhase * (isExpanded ? 30 : 16);
  const pingAlpha = (1 - pingPhase) * 0.45;
  ctx.strokeStyle = `rgba(0, 255, 204, ${pingAlpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pmx, pmy, pingR, 0, Math.PI * 2);
  ctx.stroke();

  // Forward heading beam
  ctx.strokeStyle = "rgba(0, 255, 200, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pmx, pmy);
  const beamLen = isExpanded ? 22 : 12;
  ctx.lineTo(pmx + Math.cos(player.angle) * beamLen, pmy + Math.sin(player.angle) * beamLen);
  ctx.stroke();

  // Directional vessel triangle
  const shipSize = isExpanded ? 5 : 3.5;
  ctx.save();
  ctx.translate(pmx, pmy);
  ctx.rotate(player.angle);
  ctx.fillStyle = "#ffd700";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(shipSize * 1.5, 0);          // bow
  ctx.lineTo(-shipSize, -shipSize * 0.8);  // port stern
  ctx.lineTo(-shipSize * 0.4, 0);          // notch
  ctx.lineTo(-shipSize, shipSize * 0.8);   // starboard stern
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // ── Compass rose (bottom-left of chart) ──
  const crX = chartX + (isExpanded ? 30 : 14);
  const crY = chartY + chartEnd - (isExpanded ? 30 : 14);
  const crR = isExpanded ? 16 : 8;

  // Rose circle
  ctx.strokeStyle = "rgba(0, 191, 165, 0.3)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(crX, crY, crR, 0, Math.PI * 2);
  ctx.stroke();

  // Cardinal directions
  ctx.fillStyle = "#63d1c1";
  ctx.font = `${isExpanded ? 7 : 5}px "VT323", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", crX, crY - crR - 3);
  if (isExpanded) {
    ctx.fillText("S", crX, crY + crR + 4);
    ctx.fillText("E", crX + crR + 5, crY);
    ctx.fillText("W", crX - crR - 5, crY);
  }

  // North pointer
  ctx.strokeStyle = "#ff4444";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(crX, crY);
  ctx.lineTo(crX, crY - crR);
  ctx.stroke();

  // Wind direction arrow
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 1;
  const wdx = Math.cos(wind.angle) * crR * 0.7;
  const wdy = Math.sin(wind.angle) * crR * 0.7;
  ctx.beginPath();
  ctx.moveTo(crX, crY);
  ctx.lineTo(crX + wdx, crY + wdy);
  ctx.stroke();
  // Arrowhead
  ctx.fillStyle = "#00e5ff";
  ctx.beginPath();
  const waAngle = wind.angle;
  ctx.moveTo(crX + wdx, crY + wdy);
  ctx.lineTo(crX + wdx - Math.cos(waAngle - 0.5) * 4, crY + wdy - Math.sin(waAngle - 0.5) * 4);
  ctx.lineTo(crX + wdx - Math.cos(waAngle + 0.5) * 4, crY + wdy - Math.sin(waAngle + 0.5) * 4);
  ctx.closePath();
  ctx.fill();

  // ── Header bar ──
  ctx.fillStyle = "rgba(0, 40, 50, 0.85)";
  ctx.fillRect(mapX + 1, mapY + 1, mapW - 2, headerH);
  // Bottom separator line
  ctx.strokeStyle = "rgba(0, 191, 165, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mapX + 1, mapY + headerH);
  ctx.lineTo(mapX + mapW - 1, mapY + headerH);
  ctx.stroke();

  if (isExpanded) {
    // Expanded header: coordinates + sector + heading
    ctx.fillStyle = "#63d1c1";
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = "left";
    ctx.fillText("[M] OCEAN CHART", mapX + 8, mapY + 14);

    ctx.fillStyle = "#a0ccc0";
    ctx.font = '8px "VT323", monospace';
    ctx.textAlign = "right";
    const heading = Math.round(((player.angle * 180 / Math.PI) % 360 + 360) % 360);
    ctx.fillText(`${Math.round(player.x)}, ${Math.round(player.y)} • ${heading}° • ${Math.round(wind.speed)} KTS`, mapX + mapW - 8, mapY + 14);
  } else {
    // Collapsed header: minimal
    ctx.fillStyle = "#63d1c1";
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = "left";
    ctx.fillText("RADAR", mapX + 6, mapY + 14);

    ctx.fillStyle = "#5ab0a5";
    ctx.font = '7px "VT323", monospace';
    ctx.textAlign = "right";
    ctx.fillText("[M]", mapX + mapW - 6, mapY + 14);
  }

  // ── Telemetry footer (expanded only) ──
  if (isExpanded) {
    const footY = mapY + mapH - 16;
    ctx.fillStyle = "rgba(0, 40, 50, 0.7)";
    ctx.fillRect(mapX + 1, footY, mapW - 2, 15);

    const capturedCount = ISLANDS.filter(i => i.captured).length;
    ctx.fillStyle = "#a0ccc0";
    ctx.font = '8px "VT323", monospace';
    ctx.textAlign = "left";
    ctx.fillText(`CAPTURED: ${capturedCount}/18 ISLANDS`, mapX + 10, footY + 10);

    ctx.textAlign = "center";
    ctx.fillText(`GOLD: ${player.gold}G`, mapX + mapW / 2, footY + 10);

    ctx.textAlign = "right";
    let sectorName = "OPEN OCEAN";
    for (const s of SECTORS) {
      if (player.x >= s.bounds.x0 && player.x <= s.bounds.x1 &&
          player.y >= s.bounds.y0 && player.y <= s.bounds.y1) {
        sectorName = s.name.toUpperCase();
        break;
      }
    }
    ctx.fillText(`SEC: ${sectorName}`, mapX + mapW - 10, footY + 10);
  }

  ctx.restore();
}

// Start Game Loop
const loop = createGameLoop({
  canvas,
  update,
  render
});

loop.start();
