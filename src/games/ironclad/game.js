/**
 * IRONCLAD.EXE — Naval RTS Interactive Game
 * Side-view 2D real-time strategy with builder drones, modular battlecruisers,
 * autonomous air & naval wings, and ultraweapons.
 */

import { initShell } from "/shared/shell.js";
import { getHowToPlay } from "/shared/registry.js";
import { isSoundEnabled, getVolume } from "/shared/sound.js";
import { saveSlot, loadSlot } from "/src/core/save.js";
import {
  CRUISERS,
  BUILDINGS,
  UNITS,
  BOSSES,
  CAMPAIGN_LEVELS,
  STARTER_LOADOUT,
  createDroneEconomy,
  canStartBuild,
  startConstruction,
  updateDroneEconomy,
  checkBuildQueue,
  TECH_LAB_UPGRADES,
  calculateUpgradedHull,
  canIonCannonHitTarget,
  isSlotShieldProtected,
  isAdjacentToBooster,
  calculateStars,
  evaluateEnemyAiDecision,
  exportSaveCode,
  importSaveCode
} from "./engine.js";

// ── Web Audio Synthesizer ──
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx && typeof window !== "undefined") {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(freq, duration, type = "square", gain = 0.2) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    const vol = gain * getVolume();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

function playExplosionSound(duration = 0.4, lowpass = 320) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpass, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + duration);
    const g = ctx.createGain();
    const vol = 0.45 * getVolume();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  } catch {}
}

function playLaserSound(startFreq = 850, endFreq = 140, duration = 0.12) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    const vol = 0.25 * getVolume();
    g.gain.setValueAtTime(vol, now);
    g.gain.linearRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

function playArtilleryThud() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.38);
    const vol = 0.5 * getVolume();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  } catch {}
}

function playSirenSound() {
  if (!isSoundEnabled()) return;
  playTone(880, 0.25, "sawtooth", 0.35);
  setTimeout(() => playTone(660, 0.25, "sawtooth", 0.35), 260);
}

// ── Persistent Game Save State ──
const SAVE_KEY = "ironclad:save_v1";

function loadSaveData() {
  const defaultData = {
    stars: 0,
    scrap: 150,
    levelStars: {},
    unlockedCruisers: [...STARTER_LOADOUT.cruisers],
    unlockedBuildings: [...STARTER_LOADOUT.buildings],
    unlockedUnits: [...STARTER_LOADOUT.units],
    campaignLevel: 1,
    techTiers: {
      hullArmor: 0,
      startingDrones: 0,
      buildSpeed: 0,
      shieldRecharge: 0,
      nanocoat: false
    }
  };

  const loaded = loadSlot(SAVE_KEY);
  if (!loaded) return defaultData;
  return {
    ...defaultData,
    ...loaded,
    techTiers: { ...defaultData.techTiers, ...(loaded.techTiers || {}) }
  };
}

let saveState = loadSaveData();

function persistSave() {
  saveSlot(SAVE_KEY, saveState);
}

// ── Game Constants & Coordinates ──
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 720;
const WATER_Y = 520;
const PLAYER_CRUISER_X = 350;
const ENEMY_CRUISER_X = 2650;

// ── Active Battle State ──
let battle = null;
let selectedBuildingId = null;
let activeCategory = "factories";
let speedMultiplier = 1;
let isPaused = false;
let contextMenuSlot = null;
let camera = {
  x: 0,
  y: 0,
  zoom: 0.9,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  camStartX: 0,
  camStartY: 0
};

// ── Battle Initialization ──
function initBattle(levelNum = 1, mode = "campaign", customEnemyCruiser = null) {
  const levelIdx = Math.max(0, Math.min(39, levelNum - 1));
  const campaignLvl = CAMPAIGN_LEVELS[levelIdx];
  const boss = BOSSES.find((b) => b.id === campaignLvl.bossId) || BOSSES[0];

  const playerCruiserKey = saveState.unlockedCruisers[0] || "trident";
  const playerSpec = CRUISERS[playerCruiserKey] || CRUISERS.trident;

  // Secret unlock: Yeti Charger at 90+ stars
  if (saveState.stars >= 90 && !saveState.unlockedCruisers.includes("yetiCharger")) {
    saveState.unlockedCruisers.push("yetiCharger");
    persistSave();
  }

  // Calculate upgraded player hull
  const playerMaxHull = calculateUpgradedHull(
    playerSpec.hullHp,
    saveState.techTiers.hullArmor || 0,
    saveState.techTiers.nanocoat || false
  );

  const initialPlayerDrones = 4 + (saveState.techTiers.startingDrones || 0);

  // Enemy Cruiser & Scaling
  const enemyCruiserKey = customEnemyCruiser || boss.cruiser || "trident";
  const enemySpec = CRUISERS[enemyCruiserKey] || CRUISERS.trident;
  const enemyHpScale = mode === "bossrush" ? 1.3 : boss.difficulty === "Hard" ? 1.5 : boss.difficulty === "Medium" ? 1.2 : 1.0;
  const enemyMaxHull = Math.round(enemySpec.hullHp * enemyHpScale);

  // Setup Player Slots
  const playerSlots = playerSpec.slots.map((s) => ({
    ...s,
    isEnemy: false,
    building: null,
    underConstruction: null
  }));

  // Setup Enemy Slots (mirrored along X axis)
  const enemySlots = enemySpec.slots.map((s) => ({
    ...s,
    isEnemy: true,
    building: null,
    underConstruction: null
  }));

  battle = {
    mode,
    levelNum,
    campaignLvl,
    boss,
    time: 0,
    gameOver: false,
    won: false,
    buildingsLost: 0,
    nukeSirenFired: false,
    aiTimer: 0,
    aiSequenceIndex: 0,

    player: {
      id: playerCruiserKey,
      spec: playerSpec,
      x: PLAYER_CRUISER_X,
      y: WATER_Y,
      hull: playerMaxHull,
      maxHull: playerMaxHull,
      shield: 0,
      maxShield: 0,
      shieldRechargeDelayTimer: 0,
      economy: createDroneEconomy(initialPlayerDrones),
      slots: playerSlots,
      drones: []
    },

    enemy: {
      id: enemyCruiserKey,
      spec: enemySpec,
      boss,
      x: ENEMY_CRUISER_X,
      y: WATER_Y,
      hull: enemyMaxHull,
      maxHull: enemyMaxHull,
      shield: 0,
      maxShield: 0,
      shieldRechargeDelayTimer: 0,
      economy: createDroneEconomy(4),
      slots: enemySlots,
      drones: []
    },

    units: [],
    projectiles: [],
    beams: [],
    particles: []
  };

  // Camera focuses initially on player cruiser
  jumpCameraTo("player");
  updateHUD();
  renderBuildCards();
  showBossTaunt(boss.name, boss.taunt || "Prepare for battle!");
}

// ── Camera Helpers ──
function jumpCameraTo(target) {
  const canvas = document.getElementById("ic-canvas");
  if (!canvas) return;
  const viewW = canvas.width / camera.zoom;

  if (target === "player") {
    camera.x = PLAYER_CRUISER_X - 250;
  } else if (target === "enemy") {
    camera.x = ENEMY_CRUISER_X - viewW + 250;
  } else {
    camera.x = (WORLD_WIDTH - viewW) / 2;
  }
  camera.y = 0;
  clampCamera();
}

function clampCamera() {
  const canvas = document.getElementById("ic-canvas");
  if (!canvas) return;
  const viewW = canvas.width / camera.zoom;
  const viewH = canvas.height / camera.zoom;

  camera.x = Math.max(0, Math.min(WORLD_WIDTH - viewW, camera.x));
  camera.y = Math.max(-100, Math.min(WORLD_HEIGHT - viewH + 100, camera.y));
}

// ── HUD Updates ──
function updateHUD() {
  if (!battle) return;

  const playerHullPct = Math.max(0, (battle.player.hull / battle.player.maxHull) * 100);
  const enemyHullPct = Math.max(0, (battle.enemy.hull / battle.enemy.maxHull) * 100);

  const playerHullBar = document.getElementById("hud-player-hull-bar");
  const enemyHullBar = document.getElementById("hud-enemy-hull-bar");
  const playerHpText = document.getElementById("hud-player-hp-text");
  const enemyHpText = document.getElementById("hud-enemy-hp-text");

  if (playerHullBar) playerHullBar.style.width = `${playerHullPct}%`;
  if (enemyHullBar) enemyHullBar.style.width = `${enemyHullPct}%`;

  if (playerHpText) playerHpText.textContent = `${Math.ceil(battle.player.hull)} / ${battle.player.maxHull} HP`;
  if (enemyHpText) enemyHpText.textContent = `${Math.ceil(battle.enemy.hull)} / ${battle.enemy.maxHull} HP`;

  // Drones
  const dronesEl = document.getElementById("hud-drones");
  if (dronesEl) {
    dronesEl.textContent = `${battle.player.economy.idleDrones} / ${battle.player.economy.maxDrones}`;
  }

  // Scrap and Stars
  const scrapEl = document.getElementById("hud-scrap");
  const starsEl = document.getElementById("hud-stars");
  if (scrapEl) scrapEl.textContent = saveState.scrap;
  if (starsEl) starsEl.textContent = `${saveState.stars} ★`;

  // Center Timer
  const timerEl = document.getElementById("hud-timer");
  if (timerEl) {
    const mins = Math.floor(battle.time / 60);
    const secs = Math.floor(battle.time % 60);
    timerEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Enemy Details
  const enemyNameEl = document.getElementById("hud-enemy-name");
  const enemyTypeEl = document.getElementById("hud-enemy-cruiser-type");
  const parTimeEl = document.getElementById("hud-par-time");
  if (enemyNameEl) enemyNameEl.textContent = battle.boss.name.toUpperCase();
  if (enemyTypeEl) enemyTypeEl.textContent = battle.enemy.spec.name.toUpperCase();
  if (parTimeEl && battle.campaignLvl) {
    const pm = Math.floor(battle.campaignLvl.parTime / 60);
    const ps = Math.floor(battle.campaignLvl.parTime % 60);
    parTimeEl.textContent = `${String(pm).padStart(2, "0")}:${String(ps).padStart(2, "0")}`;
  }

  // Update build strip
  updateBuildStrip();
}

function updateBuildStrip() {
  const container = document.getElementById("build-items-container");
  if (!container || !battle) return;

  const activeBuilds = battle.player.economy.activeBuilds;
  const queue = battle.player.economy.queue;

  if (activeBuilds.length === 0 && queue.length === 0) {
    container.innerHTML = `<span style="color: #64748b; font-style: italic;">All builder drones on standby.</span>`;
    return;
  }

  let html = "";
  for (const b of activeBuilds) {
    const spec = BUILDINGS[b.buildingId];
    const pct = Math.min(100, (b.progress / b.totalDuration) * 100);
    html += `
      <div class="ic-build-item">
        <span style="font-weight:700; color:#fff;">${spec ? spec.name : b.buildingId}</span>
        <div class="ic-build-item__bar">
          <div class="ic-build-item__fill" style="width: ${pct}%;"></div>
        </div>
        <span style="color:#00f0ff; font-size:10px;">${Math.floor(pct)}%</span>
      </div>
    `;
  }

  for (const q of queue) {
    const spec = BUILDINGS[q.buildingId];
    html += `
      <div class="ic-build-item" style="border-style:dashed; opacity:0.75;">
        <span style="color:#ffb703;">[QUEUED] ${spec ? spec.name : q.buildingId}</span>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ── Build Dock Rendering ──
function renderBuildCards() {
  const cardsContainer = document.getElementById("dock-cards");
  if (!cardsContainer) return;

  const bldgKeys = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].category === activeCategory);

  cardsContainer.innerHTML = bldgKeys
    .map((k) => {
      const b = BUILDINGS[k];
      const isUnlocked = saveState.unlockedBuildings.includes(k);
      const isSelected = selectedBuildingId === k;
      const canAfford = battle ? canStartBuild(battle.player.economy, b) : false;

      return `
        <div class="ic-bldg-card ${isSelected ? "selected" : ""} ${!isUnlocked ? "locked" : ""}" data-building-id="${k}">
          <div class="ic-bldg-card__header">
            <span class="ic-bldg-card__name">${b.name}</span>
            <span class="ic-bldg-card__slots">${b.allowedSlots.join("/")}</span>
          </div>
          <div class="ic-bldg-card__cost">
            <span class="ic-bldg-card__drones">▲ ${b.drones} DRONES</span>
            <span class="ic-bldg-card__time">⏱ ${b.buildTime}s</span>
          </div>
          <div class="ic-bldg-card__desc">${isUnlocked ? b.desc : "[LOCKED // ADVANCE CAMPAIGN]"}</div>
        </div>
      `;
    })
    .join("");
}

// ── Construction & Placement ──
function handleSlotClick(slot) {
  if (!battle || battle.gameOver) return;

  // If a building card is selected, try to place it into this slot
  if (selectedBuildingId) {
    const spec = BUILDINGS[selectedBuildingId];
    if (!spec) return;

    // Check slot compatibility
    if (!spec.allowedSlots.includes(slot.type)) {
      playTone(180, 0.15, "sawtooth", 0.3);
      return;
    }

    // Check if slot already occupied
    if (slot.building || slot.underConstruction) {
      playTone(180, 0.15, "sawtooth", 0.3);
      return;
    }

    // Start construction via Drone Economy
    const buildSpeedMult = 1.0 + (saveState.techTiers.buildSpeed || 0) * 0.05;
    const res = startConstruction(battle.player.economy, slot.id, selectedBuildingId, spec, buildSpeedMult);

    if (res.success || res.queued) {
      slot.underConstruction = {
        buildingId: selectedBuildingId,
        spec,
        progress: 0,
        totalDuration: spec.buildTime / buildSpeedMult,
        isQueued: res.queued
      };

      playTone(res.queued ? 380 : 540, 0.1, "sine", 0.25);
      selectedBuildingId = null;
      renderBuildCards();
      updateHUD();
    }
  } else if (slot.building) {
    // Clicked an existing building -> open context menu
    openContextMenu(slot);
  }
}

function openContextMenu(slot) {
  contextMenuSlot = slot;
  const menu = document.getElementById("context-menu");
  if (!menu) return;

  menu.style.display = "flex";
  menu.style.left = "400px";
  menu.style.top = "200px";
}

function closeContextMenu() {
  contextMenuSlot = null;
  const menu = document.getElementById("context-menu");
  if (menu) menu.style.display = "none";
}

// ── Boss Dialogue Banner ──
let bossBannerTimeout = null;
function showBossTaunt(bossName, dialogText) {
  const banner = document.getElementById("boss-banner");
  const nameEl = document.getElementById("boss-name");
  const textEl = document.getElementById("boss-dialog");
  if (!banner || !nameEl || !textEl) return;

  nameEl.textContent = bossName.toUpperCase();
  textEl.textContent = `"${dialogText}"`;
  banner.style.display = "flex";

  if (bossBannerTimeout) clearTimeout(bossBannerTimeout);
  bossBannerTimeout = setTimeout(() => {
    banner.style.display = "none";
  }, 6000);
}

// ── Enemy AI Logic ──
function updateEnemyAi(dt) {
  if (!battle || battle.gameOver) return;

  battle.aiTimer += dt;
  if (battle.aiTimer < 4.0) return; // Evaluate every 4 seconds
  battle.aiTimer = 0;

  const enemy = battle.enemy;
  const boss = battle.boss;

  // 1. Scripted Opening Sequence
  if (boss.openingBuild && battle.aiSequenceIndex < boss.openingBuild.length) {
    const nextItem = boss.openingBuild[battle.aiSequenceIndex];
    if (BUILDINGS[nextItem]) {
      const spec = BUILDINGS[nextItem];
      // Find valid empty enemy slot
      const emptySlot = enemy.slots.find(
        (s) => !s.building && !s.underConstruction && spec.allowedSlots.includes(s.type)
      );

      if (emptySlot && canStartBuild(enemy.economy, spec)) {
        startConstruction(enemy.economy, emptySlot.id, nextItem, spec, 1.0);
        emptySlot.underConstruction = {
          buildingId: nextItem,
          spec,
          progress: 0,
          totalDuration: spec.buildTime
        };
        battle.aiSequenceIndex++;
        return;
      }
    } else if (UNITS[nextItem]) {
      // Spawn unit
      spawnUnit(nextItem, true, ENEMY_CRUISER_X - 100, WATER_Y);
      battle.aiSequenceIndex++;
      return;
    }
  }

  // 2. Reactive Threat Evaluation
  const playerUnits = battle.units.filter((u) => !u.isEnemy);
  const playerBuildings = battle.player.slots.filter((s) => s.building).map((s) => s.building);
  const aiDecision = evaluateEnemyAiDecision(playerUnits, playerBuildings);

  for (const recommendedId of aiDecision.recommended) {
    const spec = BUILDINGS[recommendedId];
    if (!spec) continue;
    const emptySlot = enemy.slots.find(
      (s) => !s.building && !s.underConstruction && spec.allowedSlots.includes(s.type)
    );
    if (emptySlot && canStartBuild(enemy.economy, spec)) {
      startConstruction(enemy.economy, emptySlot.id, recommendedId, spec, 1.0);
      emptySlot.underConstruction = {
        buildingId: recommendedId,
        spec,
        progress: 0,
        totalDuration: spec.buildTime
      };
      break;
    }
  }
}

// ── Combat Simulation & Game Loop ──
function updateBattle(dt) {
  if (!battle || battle.gameOver || isPaused) return;

  const stepDt = dt * speedMultiplier;
  if (stepDt <= 0) return;

  battle.time += stepDt;

  // Update Player Drone Economy
  updateDroneEconomy(battle.player.economy, stepDt, (completedBuild) => {
    const slot = battle.player.slots.find((s) => s.id === completedBuild.slotId);
    if (slot && slot.underConstruction) {
      const spec = BUILDINGS[completedBuild.buildingId];
      slot.building = {
        id: completedBuild.buildingId,
        spec,
        hp: spec.hp,
        maxHp: spec.hp,
        cooldown: 0,
        beamActiveTime: 0
      };
      slot.underConstruction = null;
      playTone(660, 0.2, "triangle", 0.3);
      createExplosionParticles(PLAYER_CRUISER_X + slot.x, WATER_Y + slot.y, 8, "#00f0ff");
      renderBuildCards();
    }
  });

  // Update Enemy Drone Economy
  updateDroneEconomy(battle.enemy.economy, stepDt, (completedBuild) => {
    const slot = battle.enemy.slots.find((s) => s.id === completedBuild.slotId);
    if (slot && slot.underConstruction) {
      const spec = BUILDINGS[completedBuild.buildingId];
      slot.building = {
        id: completedBuild.buildingId,
        spec,
        hp: spec.hp,
        maxHp: spec.hp,
        cooldown: 0,
        beamActiveTime: 0
      };
      slot.underConstruction = null;
    }
  });

  // Sync underConstruction progress
  for (const slot of battle.player.slots) {
    if (slot.underConstruction) {
      const active = battle.player.economy.activeBuilds.find((b) => b.slotId === slot.id);
      if (active) slot.underConstruction.progress = active.progress;
    }
  }

  for (const slot of battle.enemy.slots) {
    if (slot.underConstruction) {
      const active = battle.enemy.economy.activeBuilds.find((b) => b.slotId === slot.id);
      if (active) slot.underConstruction.progress = active.progress;
    }
  }

  // Check Nuke Launcher Alert (>80% progress)
  const enemyNukeSlot = battle.enemy.slots.find(
    (s) => s.underConstruction && s.underConstruction.buildingId === "nukeLauncher"
  );
  if (enemyNukeSlot) {
    const pct = enemyNukeSlot.underConstruction.progress / enemyNukeSlot.underConstruction.totalDuration;
    const nukeWarn = document.getElementById("nuke-warning");
    if (pct >= 0.8) {
      if (nukeWarn) nukeWarn.style.display = "flex";
      if (!battle.nukeSirenFired) {
        battle.nukeSirenFired = true;
        playSirenSound();
      }
    }
  }

  // Update Enemy AI
  updateEnemyAi(stepDt);

  // Update Building Weapons
  updateCruiserBuildings(battle.player, battle.enemy, stepDt, false);
  updateCruiserBuildings(battle.enemy, battle.player, stepDt, true);

  // Update Units (Naval & Air)
  updateUnits(stepDt);

  // Update Projectiles
  updateProjectiles(stepDt);

  // Update Beams
  updateBeams(stepDt);

  // Update Particles
  updateParticles(stepDt);

  // Check Victory / Defeat
  if (battle.enemy.hull <= 0 && !battle.gameOver) {
    handleBattleEnd(true);
  } else if (battle.player.hull <= 0 && !battle.gameOver) {
    handleBattleEnd(false);
  }

  updateHUD();
}

function updateCruiserBuildings(fleet, opposingFleet, dt, isEnemy) {
  for (const slot of fleet.slots) {
    if (!slot.building) continue;
    const bldg = slot.building;
    const spec = bldg.spec;

    bldg.cooldown = Math.max(0, bldg.cooldown - dt);

    // Boosters nearby reduce cooldown faster
    const boosted = fleet.slots.some(
      (s) => s.building && s.building.id === "localBooster" && isAdjacentToBooster(s, slot, 90)
    );
    const fireInterval = spec.fireRate ? spec.fireRate * (boosted ? 0.75 : 1.0) : 1.0;

    const sourceX = isEnemy ? ENEMY_CRUISER_X - slot.x : PLAYER_CRUISER_X + slot.x;
    const sourceY = WATER_Y + slot.y;

    // 1. Factory Production
    if (spec.category === "factories" && spec.canProduce) {
      if (bldg.cooldown <= 0) {
        bldg.cooldown = 18.0; // Fabricates unit every 18s
        const unitType = spec.canProduce[Math.floor(Math.random() * spec.canProduce.length)];
        spawnUnit(unitType, isEnemy, sourceX, sourceY);
      }
    }

    // 2. Weapons Firing
    if (bldg.cooldown <= 0) {
      // Beam weapons: LasCannon
      if (spec.id === "lasCannon") {
        bldg.cooldown = fireInterval;
        playLaserSound(1100, 320, 0.3);
        battle.beams.push({
          sourceX,
          sourceY,
          targetX: isEnemy ? PLAYER_CRUISER_X + 150 : ENEMY_CRUISER_X - 150,
          targetY: WATER_Y - 30,
          color: isEnemy ? "#ff5964" : "#00f0ff",
          duration: spec.beamDuration || 5.0,
          elapsed: 0,
          dps: spec.beamDps || 95,
          isEnemy
        });
      }

      // Bow Ion Cannon (dead-straight horizontal beam across water line)
      else if (spec.id === "ionCannon") {
        bldg.cooldown = fireInterval;
        playTone(340, 0.4, "sawtooth", 0.4);
        battle.beams.push({
          sourceX,
          sourceY: WATER_Y - 20,
          targetX: isEnemy ? 0 : WORLD_WIDTH,
          targetY: WATER_Y - 20,
          color: "#00f0ff",
          duration: spec.beamDuration || 4.0,
          elapsed: 0,
          dps: spec.beamDps || 150,
          isIonCannon: true,
          isEnemy
        });
      }

      // Artillery & Mortar (Ballistic Shells)
      else if (spec.ballistic || spec.id === "mortar") {
        bldg.cooldown = fireInterval;
        playArtilleryThud();
        const targetX = isEnemy ? PLAYER_CRUISER_X + 100 : ENEMY_CRUISER_X - 100;
        battle.projectiles.push({
          type: "ballistic",
          x: sourceX,
          y: sourceY,
          startX: sourceX,
          startY: sourceY,
          targetX,
          targetY: WATER_Y - 30,
          progress: 0,
          speed: 0.35,
          dmg: spec.dmg || 120,
          isEnemy
        });
      }

      // Deck Guns / Turrets
      else if (spec.dmg && spec.range) {
        bldg.cooldown = fireInterval;
        playTone(480, 0.08, "square", 0.2);
        battle.projectiles.push({
          type: "linear",
          x: sourceX,
          y: sourceY,
          vx: isEnemy ? -360 : 360,
          vy: 0,
          rangeRemaining: spec.range,
          dmg: spec.dmg,
          isEnemy
        });
      }
    }
  }
}

function spawnUnit(unitId, isEnemy, x, y) {
  const spec = UNITS[unitId];
  if (!spec) return;

  const altitude = spec.domain === "air" ? WATER_Y - 120 - Math.random() * 100 : WATER_Y;

  battle.units.push({
    id: unitId,
    spec,
    isEnemy,
    x,
    y: altitude,
    hp: spec.hp,
    maxHp: spec.hp,
    cooldown: 0,
    speed: spec.speed
  });
}

function updateUnits(dt) {
  for (let i = battle.units.length - 1; i >= 0; i--) {
    const u = battle.units[i];
    const dir = u.isEnemy ? -1 : 1;
    u.x += dir * u.speed * dt;

    // Unit combat against opposing units
    u.cooldown = Math.max(0, u.cooldown - dt);

    const opponent = battle.units.find(
      (other) => other.isEnemy !== u.isEnemy && Math.abs(other.x - u.x) <= u.spec.range
    );

    if (opponent && u.cooldown <= 0) {
      u.cooldown = u.spec.fireRate || 1.0;
      opponent.hp -= u.spec.dmg || 15;
      playTone(520, 0.06, "square", 0.15);
      createExplosionParticles(opponent.x, opponent.y, 4, "#ffb703");
    }

    // Cruiser strike if in range
    const targetCruiserX = u.isEnemy ? PLAYER_CRUISER_X : ENEMY_CRUISER_X;
    if (Math.abs(u.x - targetCruiserX) <= 120) {
      const fleet = u.isEnemy ? battle.player : battle.enemy;
      fleet.hull -= u.spec.dmg || 20;
      createExplosionParticles(u.x, u.y, 8, "#ff5964");
      playExplosionSound(0.2, 280);
      battle.units.splice(i, 1);
      continue;
    }

    // Death check
    if (u.hp <= 0) {
      createExplosionParticles(u.x, u.y, 10, "#e63946");
      playExplosionSound(0.25, 240);
      battle.units.splice(i, 1);
    }
  }
}

function updateProjectiles(dt) {
  for (let i = battle.projectiles.length - 1; i >= 0; i--) {
    const p = battle.projectiles[i];

    if (p.type === "ballistic") {
      p.progress += p.speed * dt;
      p.x = p.startX + (p.targetX - p.startX) * p.progress;
      const arcH = 260 * Math.sin(p.progress * Math.PI);
      p.y = p.startY + (p.targetY - p.startY) * p.progress - arcH;

      if (p.progress >= 1.0) {
        // Impact!
        const targetFleet = p.isEnemy ? battle.player : battle.enemy;
        targetFleet.hull -= p.dmg;
        createExplosionParticles(p.targetX, p.targetY, 16, "#ffb703");
        playExplosionSound(0.4, 200);
        battle.projectiles.splice(i, 1);
      }
    } else if (p.type === "linear") {
      const step = p.vx * dt;
      p.x += step;
      p.rangeRemaining -= Math.abs(step);

      // Check hit with opposing cruiser
      const targetCruiserX = p.isEnemy ? PLAYER_CRUISER_X : ENEMY_CRUISER_X;
      if (Math.abs(p.x - targetCruiserX) <= 80 || p.rangeRemaining <= 0) {
        const targetFleet = p.isEnemy ? battle.player : battle.enemy;
        targetFleet.hull -= p.dmg;
        createExplosionParticles(p.x, p.y, 6, "#e2e8f0");
        battle.projectiles.splice(i, 1);
      }
    }
  }
}

function updateBeams(dt) {
  for (let i = battle.beams.length - 1; i >= 0; i--) {
    const b = battle.beams[i];
    b.elapsed += dt;

    const targetFleet = b.isEnemy ? battle.player : battle.enemy;

    // Apply DPS
    if (b.isIonCannon) {
      // Ion cannon sweeps horizontally across water line
      // Hits opposing cruiser hull
      targetFleet.hull -= b.dps * dt;

      // Also hits naval units EXCEPT low-profile boats!
      for (const u of battle.units) {
        if (u.isEnemy !== b.isEnemy && canIonCannonHitTarget(u.spec)) {
          u.hp -= b.dps * dt;
        }
      }
    } else {
      targetFleet.hull -= b.dps * dt;
    }

    if (b.elapsed >= b.duration) {
      battle.beams.splice(i, 1);
    }
  }
}

function createExplosionParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 80;
    battle.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 15,
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.8,
      size: 2 + Math.random() * 4,
      color
    });
  }
}

function updateParticles(dt) {
  for (let i = battle.particles.length - 1; i >= 0; i--) {
    const p = battle.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt; // gravity
    if (p.life <= 0) battle.particles.splice(i, 1);
  }
}

function handleBattleEnd(won) {
  battle.gameOver = true;
  battle.won = won;

  const modal = document.getElementById("result-modal");
  const titleEl = document.getElementById("result-title");
  const starsEl = document.getElementById("result-stars");
  const timeEl = document.getElementById("result-time");
  const scrapEl = document.getElementById("result-scrap");
  const unlockEl = document.getElementById("result-unlock");

  const elapsed = Math.floor(battle.time);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  if (won) {
    playTone(523, 0.15, "triangle", 0.4);
    setTimeout(() => playTone(659, 0.15, "triangle", 0.4), 160);
    setTimeout(() => playTone(784, 0.35, "triangle", 0.45), 320);

    const stars = calculateStars(true, elapsed, battle.campaignLvl ? battle.campaignLvl.parTime : 180, battle.buildingsLost);
    saveState.stars += stars;

    const scrapWon = battle.campaignLvl ? battle.campaignLvl.scrapReward : 100;
    saveState.scrap += scrapWon;

    if (titleEl) {
      titleEl.className = "ic-result-title ic-result-title--win";
      titleEl.textContent = "SECTOR SECURED";
    }

    if (starsEl) {
      starsEl.innerHTML = `
        <span class="ic-star ${stars >= 1 ? "awarded" : ""}">★</span>
        <span class="ic-star ${stars >= 2 ? "awarded" : ""}">★</span>
        <span class="ic-star ${stars >= 3 ? "awarded" : ""}">★</span>
      `;
    }

    // Unlock campaign reward
    if (battle.campaignLvl && battle.campaignLvl.unlock) {
      const unl = battle.campaignLvl.unlock;
      if (unl.type === "cruiser" && !saveState.unlockedCruisers.includes(unl.id)) {
        saveState.unlockedCruisers.push(unl.id);
      } else if (unl.type === "building" && !saveState.unlockedBuildings.includes(unl.id)) {
        saveState.unlockedBuildings.push(unl.id);
      } else if (unl.type === "unit" && !saveState.unlockedUnits.includes(unl.id)) {
        saveState.unlockedUnits.push(unl.id);
      }
      if (unlockEl) unlockEl.textContent = `UNLOCKED: ${unl.name.toUpperCase()}`;
    }

    if (saveState.campaignLevel <= battle.levelNum) {
      saveState.campaignLevel = battle.levelNum + 1;
    }

    persistSave();
  } else {
    playExplosionSound(0.6, 120);
    if (titleEl) {
      titleEl.className = "ic-result-title ic-result-title--lose";
      titleEl.textContent = "HULL BREACHED // DEFEAT";
    }
    if (starsEl) {
      starsEl.innerHTML = `<span class="ic-star">★</span><span class="ic-star">★</span><span class="ic-star">★</span>`;
    }
    if (unlockEl) unlockEl.textContent = "NO RECOVERED SALVAGE";
  }

  if (timeEl) timeEl.textContent = timeStr;
  if (scrapEl) scrapEl.textContent = won ? `+${battle.campaignLvl ? battle.campaignLvl.scrapReward : 100}` : "+0";
  if (modal) modal.style.display = "flex";
}

// ── Canvas Rendering Engine ──
function render(ctx) {
  const canvas = ctx.canvas;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply Camera transform
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // 1. Flooded Sunset Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, WATER_Y);
  skyGrad.addColorStop(0, "#090d1a");
  skyGrad.addColorStop(0.35, "#1f1832");
  skyGrad.addColorStop(0.65, "#5a2a42");
  skyGrad.addColorStop(0.85, "#a34841");
  skyGrad.addColorStop(1, "#e07a48");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WORLD_WIDTH, WATER_Y);

  // Distant Sun
  ctx.fillStyle = "rgba(255, 214, 112, 0.75)";
  ctx.beginPath();
  ctx.arc(WORLD_WIDTH / 2, WATER_Y - 20, 70, 0, Math.PI * 2);
  ctx.fill();

  // Distant Mountain Silhouettes
  ctx.fillStyle = "#111422";
  ctx.beginPath();
  ctx.moveTo(0, WATER_Y);
  for (let x = 0; x <= WORLD_WIDTH; x += 100) {
    const h = 40 + Math.sin(x * 0.005) * 30 + Math.cos(x * 0.012) * 20;
    ctx.lineTo(x, WATER_Y - h);
  }
  ctx.lineTo(WORLD_WIDTH, WATER_Y);
  ctx.closePath();
  ctx.fill();

  // 2. Battlecruisers
  if (battle) {
    drawCruiser(ctx, battle.player, false);
    drawCruiser(ctx, battle.enemy, true);

    // Drones
    drawBuilderDrones(ctx, battle.player, false);
    drawBuilderDrones(ctx, battle.enemy, true);

    // Units
    for (const u of battle.units) {
      drawUnit(ctx, u);
    }

    // Projectiles
    for (const p of battle.projectiles) {
      drawProjectile(ctx, p);
    }

    // Beams
    for (const b of battle.beams) {
      drawBeam(ctx, b);
    }

    // Particles
    for (const part of battle.particles) {
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. Dynamic Water Surface with Sunset Reflection
  const seaGrad = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_HEIGHT + 500);
  seaGrad.addColorStop(0, "#0f283d");
  seaGrad.addColorStop(0.15, "#0b1c2d");
  seaGrad.addColorStop(0.5, "#06101c");
  seaGrad.addColorStop(1, "#02060c");
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, WATER_Y, WORLD_WIDTH, WORLD_HEIGHT + 500 - WATER_Y);

  // Sunset Golden Water Shimmer (Reflection of setting sun)
  const time = battle ? battle.time : 0;
  const sunX = WORLD_WIDTH / 2;
  const sunReflectGrad = ctx.createLinearGradient(sunX - 180, WATER_Y, sunX + 180, WATER_Y);
  sunReflectGrad.addColorStop(0, "rgba(224, 122, 72, 0)");
  sunReflectGrad.addColorStop(0.5, "rgba(255, 183, 3, 0.22)");
  sunReflectGrad.addColorStop(1, "rgba(224, 122, 72, 0)");
  ctx.fillStyle = sunReflectGrad;
  ctx.fillRect(sunX - 250, WATER_Y, 500, 160);

  // Multi-frequency Animated Water Waves & Foaming Crests
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(104, 216, 214, 0.65)";
  ctx.beginPath();
  for (let x = 0; x <= WORLD_WIDTH; x += 12) {
    const waveY = WATER_Y + Math.sin(x * 0.015 + time * 2.5) * 4 + Math.cos(x * 0.04 + time * 1.8) * 2;
    if (x === 0) ctx.moveTo(x, waveY);
    else ctx.lineTo(x, waveY);
  }
  ctx.stroke();

  // Secondary Deep Wave Ripple
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(70, 130, 180, 0.35)";
  ctx.beginPath();
  for (let x = 0; x <= WORLD_WIDTH; x += 16) {
    const waveY = WATER_Y + 14 + Math.sin(x * 0.012 + time * 1.6 + 1.2) * 3;
    if (x === 0) ctx.moveTo(x, waveY);
    else ctx.lineTo(x, waveY);
  }
  ctx.stroke();

  ctx.restore();
}

function drawCruiser(ctx, fleet, isEnemy) {
  const cx = isEnemy ? ENEMY_CRUISER_X : PLAYER_CRUISER_X;
  const cy = WATER_Y;

  ctx.save();
  ctx.translate(cx, cy);
  if (isEnemy) ctx.scale(-1, 1); // Mirror enemy cruiser horizontally

  // Hull Silhouette
  ctx.fillStyle = isEnemy ? "#1e0e15" : "#0d1824";
  ctx.strokeStyle = isEnemy ? "#ff5964" : "#4682b4";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(-180, 20); // Stern underwater
  ctx.lineTo(280, 20);  // Bow keel
  ctx.lineTo(290, -10); // Bow ram
  ctx.lineTo(250, -32); // Foredeck
  ctx.lineTo(160, -42); // Mid-deck
  ctx.lineTo(60, -45);  // Superstructure deck
  ctx.lineTo(-40, -42); // Afterdeck
  ctx.lineTo(-170, -28);// Stern rail
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hull Armor Seams & Plating Lines
  ctx.strokeStyle = isEnemy ? "rgba(255, 89, 100, 0.25)" : "rgba(70, 130, 180, 0.3)";
  ctx.lineWidth = 1;
  for (let x = -140; x <= 220; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, -35);
    ctx.lineTo(x, 15);
    ctx.stroke();
  }

  // Porthole Lights & Bridge Windows (Warm Amber)
  ctx.fillStyle = isEnemy ? "rgba(255, 117, 143, 0.8)" : "rgba(255, 214, 112, 0.85)";
  for (let x = -120; x <= 180; x += 30) {
    ctx.fillRect(x, -8, 4, 3);
  }
  // Bridge tower windows
  for (let wx = 70; wx <= 110; wx += 10) {
    ctx.fillRect(wx, -55, 5, 4);
  }

  // Waterline Hull Foam & Stern Wake
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(-175, 16, 450, 4);
  ctx.fillStyle = "rgba(104, 216, 214, 0.4)";
  ctx.fillRect(275, 12, 18, 5); // Bow spray

  // Draw Slots & Mounted Buildings
  for (const slot of fleet.slots) {
    drawSlot(ctx, slot, isEnemy);
  }

  ctx.restore();
}

function drawSlot(ctx, slot, isEnemy) {
  const isCompatible = selectedBuildingId && BUILDINGS[selectedBuildingId]?.allowedSlots.includes(slot.type);

  // Slot Base
  ctx.beginPath();
  ctx.arc(slot.x, slot.y, 14, 0, Math.PI * 2);
  ctx.fillStyle = isCompatible ? "rgba(0, 240, 255, 0.35)" : "rgba(13, 21, 32, 0.6)";
  ctx.fill();
  ctx.strokeStyle = isCompatible ? "#00f0ff" : "#23354b";
  ctx.lineWidth = isCompatible ? 2.5 : 1;
  ctx.stroke();

  if (isCompatible && !slot.building && !slot.underConstruction) {
    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(slot.type.toUpperCase(), slot.x, slot.y - 18);
  }

  // If under construction, draw wireframe scaffold + rising progress
  if (slot.underConstruction) {
    const uc = slot.underConstruction;
    const pct = Math.min(1.0, uc.progress / uc.totalDuration);

    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(slot.x - 16, slot.y - 28, 32, 28);

    // Rising progress fill
    ctx.fillStyle = "rgba(255, 183, 3, 0.45)";
    ctx.fillRect(slot.x - 14, slot.y - 26 + (1 - pct) * 24, 28, pct * 24);

    // Progress percentage
    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.floor(pct * 100)}%`, slot.x, slot.y - 32);

    // Welding sparks
    if (Math.random() < 0.4) {
      createExplosionParticles(slot.x, slot.y - 14, 2, "#68d8d6");
    }
  } else if (slot.building) {
    // Draw Completed Building
    drawBuildingSprite(ctx, slot.x, slot.y, slot.building.id, isEnemy);
  }
}

function drawBuildingSprite(ctx, x, y, bldgId, isEnemy) {
  ctx.save();
  ctx.translate(x, y);

  const mainColor = isEnemy ? "#ff5964" : "#4682b4";
  const glowColor = isEnemy ? "#ff758f" : "#00f0ff";

  if (bldgId === "artillery" || bldgId === "mortar") {
    // Turret Base
    ctx.fillStyle = "#162231";
    ctx.beginPath();
    ctx.arc(0, 0, 12, Math.PI, 0);
    ctx.fill();
    // Gun Barrel pointing up at an angle
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(18, -26);
    ctx.stroke();
  } else if (bldgId === "lasCannon") {
    // Energy Capacitor
    ctx.fillStyle = "#0c1724";
    ctx.fillRect(-10, -22, 20, 22);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -22, 20, 22);
    // Emitter Lens
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(10, -11, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (bldgId === "ionCannon") {
    // Heavy Bow Emitter
    ctx.fillStyle = "#09121c";
    ctx.fillRect(0, -16, 26, 16);
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -16, 26, 16);
  } else if (bldgId === "shieldGenerator") {
    // Pulsing Dish
    ctx.fillStyle = "#122030";
    ctx.beginPath();
    ctx.arc(0, -14, 12, 0, Math.PI);
    ctx.fill();
    // Shield Dome Overlay
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -14, 60, Math.PI, 0);
    ctx.stroke();
  } else if (bldgId === "airFactory" || bldgId === "navalFactory") {
    // Industrial Hangar
    ctx.fillStyle = "#152436";
    ctx.fillRect(-18, -24, 36, 24);
    ctx.strokeStyle = mainColor;
    ctx.strokeRect(-18, -24, 36, 24);
  } else {
    // Generic Military Module
    ctx.fillStyle = "#131f2d";
    ctx.fillRect(-12, -20, 24, 20);
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -20, 24, 20);
  }

  ctx.restore();
}

function drawBuilderDrones(ctx, fleet, isEnemy) {
  // Drones hover over active builds
  const activeBuilds = fleet.economy.activeBuilds;
  for (const b of activeBuilds) {
    const slot = fleet.slots.find((s) => s.id === b.slotId);
    if (!slot) continue;

    const dx = isEnemy ? ENEMY_CRUISER_X - slot.x : PLAYER_CRUISER_X + slot.x;
    const dy = WATER_Y + slot.y - 45 + Math.sin(battle.time * 6) * 4;

    ctx.save();
    ctx.translate(dx, dy);

    // Quad-drone body
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(-6, -4, 12, 8);
    // Rotor blades
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(10, -6);
    ctx.stroke();

    ctx.restore();
  }
}

function drawUnit(ctx, unit) {
  ctx.save();
  ctx.translate(unit.x, unit.y);
  if (unit.isEnemy) ctx.scale(-1, 1);

  const color = unit.isEnemy ? "#ff5964" : "#4682b4";

  if (unit.spec.domain === "naval") {
    // Boat Hull
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(18, 4);
    ctx.lineTo(24, -2);
    ctx.lineTo(-14, -4);
    ctx.closePath();
    ctx.fill();
  } else {
    // Aircraft Silhouette
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -8);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, 8);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawProjectile(ctx, p) {
  ctx.save();
  ctx.fillStyle = p.isEnemy ? "#ff5964" : "#ffb703";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBeam(ctx, b) {
  ctx.save();
  ctx.strokeStyle = b.color;
  ctx.lineWidth = b.isIonCannon ? 8 : 4;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.moveTo(b.sourceX, b.sourceY);
  ctx.lineTo(b.targetX, b.targetY);
  ctx.stroke();

  // White-hot core
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

// ── Event Listeners & Interaction Setup ──
function setupEvents() {
  const canvas = document.getElementById("ic-canvas");

  // Mouse Drag Camera Panning
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      // Left Click
      camera.isDragging = true;
      camera.dragStartX = e.clientX;
      camera.dragStartY = e.clientY;
      camera.camStartX = camera.x;
      camera.camStartY = camera.y;

      // Check slot click in placement mode
      handleCanvasClick(e);
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (camera.isDragging) {
      const dx = (e.clientX - camera.dragStartX) / camera.zoom;
      const dy = (e.clientY - camera.dragStartY) / camera.zoom;
      camera.x = camera.camStartX - dx;
      camera.y = camera.camStartY - dy;
      clampCamera();
    }
  });

  window.addEventListener("mouseup", () => {
    camera.isDragging = false;
  });

  // Mouse Wheel Zoom
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    camera.zoom = Math.max(0.45, Math.min(1.4, camera.zoom * zoomFactor));
    clampCamera();
  });

  // Category Tabs
  document.querySelectorAll(".ic-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ic-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.dataset.category;
      selectedBuildingId = null;
      renderBuildCards();
    });
  });

  // Building Card Selection
  const dockCards = document.getElementById("dock-cards");
  if (dockCards) {
    dockCards.addEventListener("click", (e) => {
      const card = e.target.closest(".ic-bldg-card");
      if (!card || card.classList.contains("locked")) return;
      const bldgId = card.dataset.buildingId;
      selectedBuildingId = selectedBuildingId === bldgId ? null : bldgId;
      renderBuildCards();
    });
  }

  // Speed Controls
  const setSpeed = (spd) => {
    speedMultiplier = spd;
    isPaused = spd === 0;
    document.querySelectorAll(".ic-btn-speed").forEach((b) => b.classList.remove("active"));
    if (spd === 1) document.getElementById("btn-speed-1")?.classList.add("active");
    if (spd === 2) document.getElementById("btn-speed-2")?.classList.add("active");
    if (spd === 4) document.getElementById("btn-speed-4")?.classList.add("active");
    if (spd === 0) document.getElementById("btn-pause")?.classList.add("active");
  };

  document.getElementById("btn-speed-1")?.addEventListener("click", () => setSpeed(1));
  document.getElementById("btn-speed-2")?.addEventListener("click", () => setSpeed(2));
  document.getElementById("btn-speed-4")?.addEventListener("click", () => setSpeed(4));
  document.getElementById("btn-pause")?.addEventListener("click", () => setSpeed(isPaused ? 1 : 0));

  // Jump shortcuts
  document.getElementById("btn-jump-player")?.addEventListener("click", () => jumpCameraTo("player"));
  document.getElementById("btn-jump-mid")?.addEventListener("click", () => jumpCameraTo("mid"));
  document.getElementById("btn-jump-enemy")?.addEventListener("click", () => jumpCameraTo("enemy"));

  // Tech Lab Modal
  document.getElementById("btn-open-tech")?.addEventListener("click", () => openTechModal());
  document.getElementById("btn-close-tech")?.addEventListener("click", () => {
    document.getElementById("tech-modal").style.display = "none";
  });

  // Sectors Modal
  document.getElementById("btn-open-sectors")?.addEventListener("click", () => openSectorsModal());
  document.getElementById("btn-close-sectors")?.addEventListener("click", () => {
    document.getElementById("sector-modal").style.display = "none";
  });

  // Next / Retry result buttons
  document.getElementById("btn-result-next")?.addEventListener("click", () => {
    document.getElementById("result-modal").style.display = "none";
    initBattle(battle.levelNum + 1);
  });
  document.getElementById("btn-result-retry")?.addEventListener("click", () => {
    document.getElementById("result-modal").style.display = "none";
    initBattle(battle.levelNum);
  });

  // Keyboard Hotkeys
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      selectedBuildingId = null;
      closeContextMenu();
      document.getElementById("tech-modal").style.display = "none";
      document.getElementById("sector-modal").style.display = "none";
      renderBuildCards();
    } else if (e.key === "1") setCategoryByIndex(0);
    else if (e.key === "2") setCategoryByIndex(1);
    else if (e.key === "3") setCategoryByIndex(2);
    else if (e.key === "4") setCategoryByIndex(3);
    else if (e.key === "5") setCategoryByIndex(4);
    else if (e.key === " ") setSpeed(isPaused ? 1 : 0);
    else if (e.key.toLowerCase() === "t") openTechModal();
  });
}

function setCategoryByIndex(idx) {
  const tabs = ["factories", "tactical", "defensive", "offensive", "ultraweapons"];
  if (tabs[idx]) {
    activeCategory = tabs[idx];
    document.querySelectorAll(".ic-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.category === activeCategory);
    });
    selectedBuildingId = null;
    renderBuildCards();
  }
}

function handleCanvasClick(e) {
  if (!battle) return;
  const canvas = document.getElementById("ic-canvas");
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;

  // Convert to world coordinates
  const worldX = (canvasX / camera.zoom) + camera.x;
  const worldY = (canvasY / camera.zoom) + camera.y;

  // Check collision with player slots (generous 35px click radius)
  for (const slot of battle.player.slots) {
    const slotWorldX = PLAYER_CRUISER_X + slot.x;
    const slotWorldY = WATER_Y + slot.y;
    const dist = Math.hypot(worldX - slotWorldX, worldY - slotWorldY);
    if (dist <= 35) {
      handleSlotClick(slot);
      return;
    }
  }
}

// ── Tech Lab Modal Implementation ──
function openTechModal() {
  const modal = document.getElementById("tech-modal");
  const grid = document.getElementById("tech-grid");
  const scrapDisplay = document.getElementById("tech-scrap-display");
  const starsDisplay = document.getElementById("tech-stars-display");

  if (!modal || !grid) return;

  scrapDisplay.textContent = saveState.scrap;
  starsDisplay.textContent = `${saveState.stars} ★`;

  grid.innerHTML = Object.keys(TECH_LAB_UPGRADES)
    .map((k) => {
      const upg = TECH_LAB_UPGRADES[k];
      const curTier = saveState.techTiers[k] || 0;
      const isMax = curTier >= upg.maxTier;
      const cost = isMax ? 0 : upg.costs[curTier];
      const canAfford = !isMax && saveState.scrap >= cost;

      return `
        <div class="ic-tech-card">
          <div class="ic-tech-card__top">
            <span class="ic-tech-card__name">${upg.name}</span>
            <span class="ic-tech-card__tier">TIER ${curTier} / ${upg.maxTier}</span>
          </div>
          <div class="ic-tech-card__desc">${upg.desc}</div>
          <div class="ic-tech-card__action">
            <span style="font-weight:700; color:var(--steel-warning); font-size:11px;">
              ${isMax ? "MAX LEVEL" : `${cost} SCRAP`}
            </span>
            <button type="button" class="ic-btn-upgrade" data-upgrade-id="${k}" ${!canAfford ? "disabled" : ""}>
              ${isMax ? "INSTALLED" : "RESEARCH"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach upgrade handlers
  grid.querySelectorAll(".ic-btn-upgrade").forEach((btn) => {
    btn.addEventListener("click", () => {
      const upgId = btn.dataset.upgradeId;
      const upg = TECH_LAB_UPGRADES[upgId];
      const curTier = saveState.techTiers[upgId] || 0;
      if (curTier < upg.maxTier && saveState.scrap >= upg.costs[curTier]) {
        saveState.scrap -= upg.costs[curTier];
        saveState.techTiers[upgId] = curTier + 1;
        persistSave();
        playTone(660, 0.15, "triangle", 0.3);
        openTechModal(); // refresh
        updateHUD();
      }
    });
  });

  // Export / Import
  const input = document.getElementById("save-code-input");
  document.getElementById("btn-save-export").onclick = () => {
    if (input) input.value = exportSaveCode(saveState);
  };
  document.getElementById("btn-save-import").onclick = () => {
    if (input && input.value.trim()) {
      const imported = importSaveCode(input.value);
      if (imported) {
        saveState = imported;
        persistSave();
        playTone(520, 0.2, "sine", 0.3);
        openTechModal();
        updateHUD();
      }
    }
  };

  modal.style.display = "flex";
}

// ── Sector Selection Modal Implementation ──
function openSectorsModal() {
  const modal = document.getElementById("sector-modal");
  const list = document.getElementById("sector-list");
  if (!modal || !list) return;

  list.innerHTML = CAMPAIGN_LEVELS.map((lvl) => {
    const isUnlocked = lvl.level <= saveState.campaignLevel;
    return `
      <div style="background:#070d15; border:1px solid ${isUnlocked ? "var(--steel-accent)" : "#1e3046"}; padding:8px; border-radius:3px; opacity:${isUnlocked ? "1" : "0.5"}; cursor:${isUnlocked ? "pointer" : "not-allowed"};" data-sector-lvl="${lvl.level}">
        <div style="font-weight:700; color:${isUnlocked ? "#fff" : "#64748b"}; font-size:12px;">SECTOR ${lvl.level}</div>
        <div style="font-size:10px; color:#8da4c4; margin-top:2px;">PAR: ${Math.floor(lvl.parTime / 60)}m ${lvl.parTime % 60}s</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-sector-lvl]").forEach((card) => {
    card.addEventListener("click", () => {
      const lvl = parseInt(card.dataset.sectorLvl, 10);
      if (lvl <= saveState.campaignLevel) {
        modal.style.display = "none";
        initBattle(lvl);
      }
    });
  });

  modal.style.display = "flex";
}

// ── Game Loop Setup ──
let lastTimestamp = 0;
function gameLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  updateBattle(dt);

  const canvas = document.getElementById("ic-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    render(ctx);
  }

  requestAnimationFrame(gameLoop);
}

// ── Main Entrypoint ──
function init() {
  initShell({ howToPlay: getHowToPlay("ironclad") });
  setupEvents();
  initBattle(1);
  if (typeof window !== "undefined") {
    window.ironclad = {
      getBattle: () => battle,
      initBattle,
      handleSlotClick,
      saveState
    };
  }
  requestAnimationFrame(gameLoop);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
