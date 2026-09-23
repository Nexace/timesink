import assert from "node:assert/strict";
import { createGame, placeStruct, removeStruct } from "../sim/state.js";
import { generateWorld, worldHash, floodReach } from "../sim/worldgen.js";
import { step, runTicks } from "../sim/step.js";
import { serialize, deserialize, rleEncode, rleDecode } from "../sim/save.js";
import { roomAtTile, computeRooms } from "../sim/rooms.js";
import { ensureDerived, updateSystems, waterTotal } from "../sim/systems.js";
import { computeGrids, updatePower } from "../sim/power.js";
import { findPath } from "../sim/path.js";
import { interact } from "../sim/player.js";
import { build, canPlace } from "../sim/building.js";
import { chooseEnding, tryLaunch } from "../sim/story.js";
import { OBJECTIVES } from "../data/story.js";
import { aliveColonists } from "../sim/colonists.js";
import { solOf } from "../sim/state.js";
import { isNight } from "../sim/env.js";
import { TERRAIN, T, N } from "../data/tiles.js";
import { TICK_RATE, SOL_TICKS, VITALS } from "../data/balance.js";
import { createBot } from "./bot.mjs";

function addFood(g) {
  const crate = [...g.structs.values()].find((s) => s.id === "crate");
  crate.items[20] = { id: "ration", n: 40 };
}

let passed = 0;
let failed = 0;
function t(name, fn) {
  const t0 = Date.now();
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name} (${Date.now() - t0} ms)`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}\n      ${err.stack?.split("\n").slice(0, 4).join("\n      ")}`);
  }
}

console.log("mars-base tests\n");

const hashGame = (g) => {
  const str = JSON.stringify(serialize(g));
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

t("worldgen is deterministic per seed", () => {
  assert.equal(worldHash(generateWorld(7)), worldHash(generateWorld(7)));
  assert.notEqual(worldHash(generateWorld(7)), worldHash(generateWorld(8)));
});

t("every POI and the ice sheet are reachable on 30 seeds", () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const w = generateWorld(seed * 7919);
    const reach = floodReach(w);
    for (const p of w.pois) {
      let ok = false;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (reach[(p.y + dy) * w.w + p.x + dx]) ok = true;
      assert.ok(ok, `seed ${seed}: ${p.kind} at ${p.x},${p.y} unreachable`);
    }
    let ice = false;
    for (let i = 0; i < reach.length && !ice; i += 1) if (reach[i] && w.terrain[i] === T.ICE) ice = true;
    assert.ok(ice, `seed ${seed}: ice unreachable`);
    const kinds = new Set(w.pois.map((p) => p.kind));
    for (const k of ["hab", "wreck", "rtg", "lander", "mav", "tube"]) assert.ok(kinds.has(k), `seed ${seed}: missing ${k}`);
    // landing zone is open ground
    assert.ok(!TERRAIN[w.terrain[w.start.y * w.w + w.start.x]].solid);
  }
});

t("RLE round-trips the explored mask", () => {
  const a = new Uint8Array(1000);
  for (let i = 100; i < 380; i += 1) a[i] = 1;
  a[999] = 1;
  const b = rleDecode(rleEncode(a), 1000);
  assert.deepEqual([...b], [...a]);
});

t("campaign hab starts breached; one wall seals it", () => {
  const g = createGame({ seed: 11, mode: "campaign" });
  ensureDerived(g);
  const { x, y } = g.world.start;
  const room = roomAtTile(g, x, y);
  assert.ok(room);
  assert.equal(room.sealed, false);
  placeStruct(g, x + 5, y, "wall");
  ensureDerived(g);
  assert.equal(roomAtTile(g, x, y).sealed, true);
  removeStruct(g, x + 5, y);
  ensureDerived(g);
  assert.equal(roomAtTile(g, x, y).sealed, false, "removing a wall breaks the seal again");
});

t("colony-kit hab is sealed and breathable; oxygenator keeps it topped up", () => {
  const g = createGame({ seed: 12, mode: "endless", start: "colony" });
  runTicks(g, TICK_RATE * 60);
  const room = roomAtTile(g, g.world.start.x, g.world.start.y);
  assert.equal(room.sealed, true);
  assert.ok(room.o2 > 0.9, `o2 ${room.o2}`);
  assert.ok(room.temp > 5, `temp ${room.temp}`);
});

t("breach decompresses a room within seconds", () => {
  const g = createGame({ seed: 12, mode: "endless", start: "colony" });
  runTicks(g, TICK_RATE * 5);
  const { x, y } = g.world.start;
  removeStruct(g, x + 5, y);
  runTicks(g, TICK_RATE * 5);
  const room = roomAtTile(g, x, y);
  assert.equal(room.sealed, false);
  assert.ok(room.o2 < 0.1, `o2 ${room.o2}`);
});

t("brownout keeps life support first", () => {
  const g = createGame({ seed: 13, mode: "endless", start: "colony" });
  ensureDerived(g);
  const { x, y } = g.world.start;
  // Starve the grid: remove batteries' charge, remove solar, add a smelter that's busy.
  for (const st of g.structs.values()) {
    if (st.id === "battery") st.charge = 0;
  }
  for (const st of [...g.structs.values()]) if (st.id === "solar") removeStruct(g, st.x, st.y);
  placeStruct(g, x + 1, y - 4, "rtg"); // 2 × 1.2 steady, adjacent to the north wall
  placeStruct(g, x + 3, y - 4, "rtg");
  const sm = placeStruct(g, x + 2, y + 1, "smelter");
  sm.busy = true;
  const room = roomAtTile(g, x, y);
  ensureDerived(g);
  roomAtTile(g, x, y).o2 = 0.5; // make the oxygenator want power
  updatePower(g, 1, (st) => (st.id === "smelter" ? true : st.id === "oxygenator" ? true : st.id === "heater" ? false : true));
  const oxy = [...g.structs.values()].find((s) => s.id === "oxygenator");
  assert.equal(oxy.powered, true, "oxygenator stays on");
  assert.equal(sm.powered, false, "smelter is shed");
  void room;
});

t("suit O₂ drains outside and refills in a breathable room", () => {
  const g = createGame({ seed: 14, mode: "endless", start: "colony" });
  runTicks(g, TICK_RATE * 2);
  const p = g.s.player;
  p.o2 = 50;
  runTicks(g, TICK_RATE * 5);
  assert.ok(p.o2 > 60, `refills inside (${p.o2})`);
  p.x = g.world.start.x - 10.5;
  p.y = g.world.start.y + 0.5;
  const before = p.o2;
  runTicks(g, TICK_RATE * 10);
  assert.ok(Math.abs(before - p.o2 - VITALS.o2DrainOutside * 10) < 0.05, `drain ${before - p.o2}`);
});

t("save round-trip preserves the game", () => {
  const g = createGame({ seed: 15, mode: "campaign" });
  runTicks(g, TICK_RATE * 30);
  g.s.player.x -= 3;
  const data = JSON.parse(JSON.stringify(serialize(g)));
  const g2 = deserialize(data);
  assert.ok(g2);
  assert.equal(g2.structs.size, g.structs.size);
  assert.equal(g2.s.tick, g.s.tick);
  assert.equal(worldHash(g2.world), worldHash(g.world));
  assert.equal(g2.explored.reduce((a, b) => a + b, 0), g.explored.reduce((a, b) => a + b, 0));
  runTicks(g, TICK_RATE * 20);
  runTicks(g2, TICK_RATE * 20);
  assert.equal(hashGame(g2), hashGame(g), "continues identically after load");
});

t("saves made on the original 384-tile map still load on that map", () => {
  const g = createGame({ seed: 15, mode: "campaign" });
  assert.equal(g.world.w, 1024, "new games use the big map");
  const data = JSON.parse(JSON.stringify(serialize(g)));
  delete data.worldW;
  delete data.worldH;
  data.explored = rleEncode(new Uint8Array(384 * 384));
  data.structs = [];
  const g2 = deserialize(data);
  assert.ok(g2);
  assert.equal(g2.world.w, 384);
  assert.equal(worldHash(g2.world), worldHash(generateWorld(15, { w: 384, h: 384 })));
});

t("deserialize rejects garbage and wrong versions", () => {
  assert.equal(deserialize(null), null);
  assert.equal(deserialize({ version: 1 }), null);
  assert.equal(deserialize([]), null);
});

t("same seed + same inputs = same run (daily determinism)", () => {
  const a = createGame({ seed: 777, mode: "daily", start: "colony", dailyKey: "2026-01-01" });
  const b = createGame({ seed: 777, mode: "daily", start: "colony", dailyKey: "2026-01-01" });
  const input = { mx: 0.5, my: -0.2, use: false, aim: null };
  runTicks(a, SOL_TICKS * 2, input);
  runTicks(b, SOL_TICKS * 2, input);
  assert.equal(hashGame(a), hashGame(b));
});

t("a do-nothing commander dies between sol 1 and sol 5", () => {
  const g = createGame({ seed: 21, mode: "campaign" });
  let guard = 0;
  while (g.s.status === "playing" && guard < SOL_TICKS * 8) {
    step(g);
    guard += 1;
  }
  assert.equal(g.s.status, "dead");
  const sol = solOf(g.s.tick);
  assert.ok(sol >= 1 && sol <= 5, `died on sol ${sol} (${g.s.deathCause})`);
});

t("potatoes grow under a grow lamp in ~4 sols and die when frozen", () => {
  const g = createGame({ seed: 22, mode: "endless", start: "colony" });
  ensureDerived(g);
  const planters = [...g.structs.values()].filter((s) => s.id === "planter");
  assert.ok(planters.length >= 2);
  const pl = planters[0];
  pl.crop = { type: "potato", g: 0, stress: 0, dead: false };
  // grow lamp next to the planter
  const lampAt = { x: pl.x, y: pl.y - 1 };
  removeStruct(g, lampAt.x, lampAt.y);
  placeStruct(g, lampAt.x, lampAt.y, "growlamp");
  for (const st of g.structs.values()) if (st.id === "tank") st.water = 200;
  g.s.player.food = 100;
  addFood(g);
  runTicks(g, Math.round(SOL_TICKS * 4.2));
  assert.equal(g.s.status, "playing", g.s.deathCause);
  assert.ok(pl.crop.g >= 1 || g.s.stats.harvested > 0, `growth ${pl.crop.g}`);
  // Freeze a second crop: breach the room.
  const pl2 = planters[1];
  pl2.crop = { type: "potato", g: 0.2, stress: 0, dead: false };
  removeStruct(g, g.world.start.x + 5, g.world.start.y);
  runTicks(g, TICK_RATE * 45);
  assert.ok(g.s.log.some((l) => l.text.includes("crop died")), "a crop should die in the breach");
});

t("A* finds a path around obstacles and respects the node budget", () => {
  const w = 20;
  const h = 20;
  const blocked = (x, y) => x === 10 && y < 18;
  const path = findPath(w, h, 2, 2, 17, 2, blocked);
  assert.ok(path && path.length > 15);
  assert.equal(findPath(w, h, 2, 2, 17, 2, (x) => x === 10), null);
});

t("endless colony kit: crew lander arrives and colonists walk inside", () => {
  const g = createGame({ seed: 31, mode: "endless", start: "colony" });
  runTicks(g, SOL_TICKS * 1.1);
  const crew = aliveColonists(g);
  assert.ok(crew.length >= 1, "a lander should arrive at the first dawn");
  runTicks(g, TICK_RATE * 60);
  const inside = crew.filter((c) => roomAtTile(g, Math.floor(c.x), Math.floor(c.y))?.sealed);
  assert.ok(inside.length >= 1, "colonists should make it into the hab");
});

t("building validates cost, range and occupancy", () => {
  const g = createGame({ seed: 41, mode: "campaign" });
  ensureDerived(g);
  const { x, y } = g.world.start;
  assert.equal(canPlace(g, "wall", x + 30, y).ok, false, "too far");
  assert.equal(canPlace(g, "wall", x - 5, y - 3).ok, false, "occupied");
  const r = canPlace(g, "wall", x + 5, y);
  assert.equal(r.ok, false, "no metal/sealant yet");
  g.s.inv[10] = { id: "metal", n: 5 };
  g.s.inv[11] = { id: "sealant", n: 5 };
  assert.equal(build(g, "wall", x + 5, y).ok, true);
});

t("the rover reaches the old lander and gets home on one charge", () => {
  const g = createGame({ seed: 20260922, mode: "campaign" });
  const bot = createBot(g);
  g.s.rover.broken = false;
  g.s.rover.battery = 100;
  const rv = g.s.rover;
  bot.walkTo(Math.floor(rv.x), Math.floor(rv.y) - 1, 1.6);
  const r = interact(g, { x: rv.x, y: rv.y });
  assert.equal(g.s.player.inRover, true, r?.msg);
  g.s.player.food = 100;
  g.s.player.water = 100;
  const lander = g.world.pois.find((p) => p.kind === "lander");
  const d0 = Math.hypot(lander.x - rv.x, lander.y - rv.y);
  bot.drive(lander.x, lander.y, 3);
  const used = 100 - rv.battery;
  // Park and let the roof panels recharge before the drive home, like a real expedition.
  g.s.inv[20] = { id: "water", n: 10 };
  g.s.inv[21] = { id: "ration", n: 10 };
  let waited = 0;
  while (rv.battery < 80 && waited < SOL_TICKS * 3) {
    bot.wait(30);
    waited += TICK_RATE * 30;
  }
  bot.drive(g.world.start.x, g.world.start.y + 7, 3);
  console.log(`      lander ${Math.round(d0)} tiles away; out-leg used ${Math.round(used)}%, recharged for ${(waited / SOL_TICKS).toFixed(2)} sols, ${Math.round(rv.battery)}% left at home`);
  assert.ok(rv.battery > 0);
});

t("campaign chain: Act II → III → both endings are reachable", () => {
  const g = createGame({ seed: 99, mode: "campaign" });
  const { x: sx, y: sy } = g.world.start;
  const idxOf = (id) => OBJECTIVES.findIndex((o) => o.id === id);
  const s = g.s;
  const give = (id, n) => {
    const i = s.inv.findIndex((v) => !v);
    s.inv[i] = { id, n };
  };
  // Fast-forward: Act I done, hab sealed and fixed, player healthy.
  placeStruct(g, sx + 5, sy, "wall");
  for (const st of g.structs.values()) st.broken = false;
  s.rover.broken = false;
  s.story.idx = idxOf("lander");
  const keepAlive = () => {
    const p = s.player;
    p.o2 = 100;
    p.food = 100;
    p.water = 100;
    p.health = 100;
    p.power = 100;
  };
  // Lander: stand next to it, then drill the antenna out.
  const lander = g.world.pois.find((p) => p.kind === "lander");
  s.player.x = lander.x - 0.5;
  s.player.y = lander.y + 0.5;
  runTicks(g, TICK_RATE * 2);
  assert.equal(OBJECTIVES[s.story.idx].id, "antenna");
  s.sel = 0;
  for (let i = 0; i < TICK_RATE * 12 && !s.story.flags.antenna; i += 1) step(g, { mx: 0, my: 0, use: true, aim: { x: lander.x + 0.5, y: lander.y + 0.5 } });
  runTicks(g, TICK_RATE * 2);
  assert.equal(OBJECTIVES[s.story.idx].id, "comms", "antenna salvaged");
  // Comms dish next to the hab.
  s.player.x = sx + 0.5;
  s.player.y = sy + 6.5;
  keepAlive();
  give("metal", 40);
  give("circuit", 10);
  give("wire", 10);
  give("concrete", 20);
  give("glass", 10);
  give("plastic", 10);
  give("sample", 10);
  assert.equal(build(g, "comms", sx, sy + 5).ok, true);
  runTicks(g, TICK_RATE * 2);
  assert.equal(OBJECTIVES[s.story.idx].id, "research", "comms online");
  assert.ok(s.story.messages.length >= 3, "Mission Control checks in");
  // Research: a lab inside the hab + samples.
  s.player.x = sx + 1.5;
  s.player.y = sy + 0.5;
  assert.equal(build(g, "lab", sx + 2, sy + 1).ok, true);
  const lab = g.structs.get((sy + 1) * g.world.w + sx + 2);
  interact(g, { x: lab.x + 0.5, y: lab.y + 0.5 });
  s.research.current = "lettuce";
  for (let i = 0; i < 6 && !s.research.done.length; i += 1) {
    keepAlive();
    runTicks(g, TICK_RATE * 30);
  }
  assert.ok(s.research.done.includes("lettuce"), "research completes");
  runTicks(g, TICK_RATE * 2);
  assert.equal(OBJECTIVES[s.story.idx].id, "pad");
  assert.ok(s.credits > 0, "research earns credits once comms are up");
  // Pad + bunks + food → colonists in campaign mode.
  s.player.x = sx + 0.5;
  s.player.y = sy + 7.5;
  assert.equal(build(g, "pad", sx - 2, sy + 9).ok, true);
  s.player.x = sx + 1.5;
  s.player.y = sy + 0.5;
  for (const [dx, dy] of [[-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2]]) assert.equal(build(g, "bunk", sx + dx, sy + dy).ok, true, `bunk ${dx},${dy}`);
  const crate = [...g.structs.values()].find((st) => st.id === "crate");
  crate.items[20] = { id: "ration", n: 50 };
  for (let i = 0; i < 12 && aliveColonists(g).length < 4; i += 1) {
    keepAlive();
    crate.items[20] = { id: "ration", n: 50 };
    runTicks(g, SOL_TICKS);
  }
  assert.ok(aliveColonists(g).length >= 4, `colonists ${aliveColonists(g).length}`);
  runTicks(g, TICK_RATE * 2);
  assert.equal(OBJECTIVES[s.story.idx].id, "colonists10");
  // Jump to the finale gates.
  s.story.idx = idxOf("sustain");
  s.sustain.streak = 10;
  runTicks(g, TICK_RATE * 2);
  assert.equal(OBJECTIVES[s.story.idx].id, "choice");
  // Branch A: go home.
  const homebound = deserialize(JSON.parse(JSON.stringify(serialize(g))));
  chooseEnding(homebound, "homebound");
  runTicks(homebound, TICK_RATE * 2);
  assert.equal(OBJECTIVES[homebound.s.story.idx].id, "mav");
  const out = tryLaunch(homebound);
  assert.equal(out.ui, "ending");
  assert.equal(homebound.s.status, "won");
  assert.equal(homebound.s.ending, "homebound");
  // Branch B: stay.
  chooseEnding(g, "founder");
  assert.equal(g.s.status, "won");
  assert.equal(g.s.ending, "founder");
});

t("bot completes Act I of the campaign", () => {
  const g = createGame({ seed: 20260922, mode: "campaign" });
  const bot = createBot(g);
  const { x: sx, y: sy } = g.world.start;
  const idx = () => g.s.story.idx;
  // 1. EVA
  bot.walkTo(sx - 8, sy, 0.8);
  bot.wait(2);
  assert.ok(idx() >= 1, "eva");
  // 2. Salvage scrap (plenty for the whole act)
  while ((g.s.story.flags.scrapTotal ?? 0) < 40) {
    const n = bot.nearestNode(N.SCRAP, 40);
    if (!n) break;
    bot.mine(n.x, n.y);
  }
  bot.wait(2);
  assert.ok(idx() >= 2, "scrap");
  // 3. Patch: metal (hand), regolith, sealant at the workbench, wall in the breach
  bot.craft("metal-scrap", 5);
  bot.shovel(sx + 8, sy + 2, 4);
  const bench = [...g.structs.values()].find((s) => s.id === "workbench");
  bot.walkTo(sx, sy, 1); // go inside via the breach
  bot.craft("sealant", 1, bench);
  bot.place("wall", sx + 5, sy);
  bot.wait(2);
  assert.ok(idx() >= 3, "patch");
  // 4. Oxygenator: wire + circuit, then repair
  bot.craft("wire-scrap", 2, bench);
  bot.craft("circuit-scrap", 2, bench);
  const oxy = [...g.structs.values()].find((s) => s.id === "oxygenator");
  bot.select("multitool");
  const r1 = bot.act(oxy.x, oxy.y);
  assert.ok(!oxy.broken, `oxygenator repair: ${r1?.msg}`);
  bot.wait(3);
  assert.ok(idx() >= 4, `oxy (idx ${idx()})`);
  // 5. Panels: go out through the airlock and wipe all four
  for (const st of [...g.structs.values()].filter((s) => s.id === "solar")) bot.act(st.x, st.y);
  bot.wait(2);
  assert.ok(idx() >= 5, "panels");
  // 6. Reclaimer: plastic + circuit
  bot.craft("plastic-hyd", 1, bench);
  const rec = [...g.structs.values()].find((s) => s.id === "reclaimer");
  bot.select("multitool");
  bot.act(rec.x, rec.y);
  bot.wait(2);
  assert.ok(idx() >= 6, "reclaimer");
  // 7. Farm: soil + 3 planters under the skylights, plant potatoes
  bot.shovel(sx - 8, sy + 3, 4);
  bot.walkTo(sx, sy, 1);
  const recy = [...g.structs.values()].find((s) => s.id === "recycler");
  bot.act(recy.x, recy.y);
  bot.craft("soil", 3);
  const spots = [[sx - 1, sy + 2], [sx, sy + 2], [sx + 1, sy + 2]];
  for (const [px, py] of spots) {
    bot.place("planter", px, py);
    bot.act(px, py);
  }
  bot.wait(2);
  assert.ok(idx() >= 7, `farm (idx ${idx()})`);
  // 8. Water: mine ice lenses and melt them into the tank
  while (waterTotal(g).total < 82) {
    const n = bot.nearestNode(N.ICE, 60);
    assert.ok(n, "ice nearby");
    bot.mine(n.x, n.y);
    if (bot.has("ice") >= 6 || !bot.nearestNode(N.ICE, 60)) {
      const tank = [...g.structs.values()].find((s) => s.id === "tank");
      bot.act(tank.x, tank.y);
    }
  }
  bot.wait(2);
  assert.ok(idx() >= 8, `water (idx ${idx()})`);
  // 9. Rover
  bot.craft("wire-scrap", 1, bench);
  bot.craft("metal-scrap", 2);
  bot.select("multitool");
  bot.act(Math.floor(g.s.rover.x), Math.floor(g.s.rover.y));
  if (g.s.player.inRover) {
    g.s.player.inRover = false;
  }
  bot.wait(2);
  assert.ok(idx() >= 9, `rover (idx ${idx()}) broken=${g.s.rover.broken}`);
  // 10. RTG (walk there, mine it)
  const rtg = g.world.pois.find((p) => p.kind === "rtg");
  // top up O2 first
  bot.walkTo(sx, sy, 1);
  bot.wait(20);
  bot.mine(rtg.x, rtg.y);
  bot.wait(2);
  assert.ok(idx() >= 10, `rtg (idx ${idx()})`);
  // 11. Bring the RTG home and wire it into the hab (north wall), then live in the hab until harvest.
  bot.craft("metal-scrap", 1);
  bot.place("rtg", sx + 6, sy - 2);
  bot.walkTo(sx + 2, sy + 1, 0.8);
  let minFood = 100;
  const bunk = [...g.structs.values()].find((s) => s.id === "bunk");
  let guard = 0;
  const perimeter = [];
  for (let y = sy - 3; y <= sy + 4; y += 1) for (let x = sx - 5; x <= sx + 5; x += 1) perimeter.push({ x, y, edge: x === sx - 5 || x === sx + 5 || y === sy - 3 || y === sy + 4 });
  const patchHab = () => {
    for (const w of perimeter) {
      if (g.structs.get(w.y * g.world.w + w.x)) continue;
      if (bot.has("metal") < 1) {
        const n = bot.nearestNode(N.SCRAP, 50);
        bot.mine(n.x, n.y);
        bot.mine(bot.nearestNode(N.SCRAP, 50).x, bot.nearestNode(N.SCRAP, 50).y);
        bot.craft("metal-scrap", 1);
      }
      if (bot.has("sealant") < 1) {
        bot.shovel(sx + 8, sy + 2, 1);
        bot.craft("sealant", 1, bench);
      }
      if (process.env.MB_DEBUG) console.log("patching", w);
      bot.place(w.edge ? "wall" : "floor", w.x, w.y);
    }
  };
  while (idx() < 11 && guard < 1200) {
    guard += 1;
    if (!roomAtTile(g, sx, sy)?.sealed) patchHab();
    const dead = [...g.structs.values()].find((s) => s.id === "planter" && s.crop?.dead);
    if (dead && roomAtTile(g, sx, sy)?.temp > 5) {
      bot.act(dead.x, dead.y);
      bot.act(dead.x, dead.y);
      continue;
    }
    const ripe = [...g.structs.values()].find((s) => s.id === "planter" && s.crop && !s.crop.dead && s.crop.g >= 1);
    if (ripe) {
      bot.act(ripe.x, ripe.y);
      bot.wait(2);
      continue;
    }
    const dusty = [...g.structs.values()].filter((s) => s.id === "solar" && s.dust > 0.35);
    if (dusty.length && !isNight(g.s.tick)) {
      for (const st of dusty) bot.act(st.x, st.y);
      bot.walkTo(sx + 2, sy + 1, 0.8);
    }
    if (isNight(g.s.tick) && !g.s.player.sleeping) {
      const r = bot.act(bunk.x, bunk.y);
      void r;
    }
    bot.wait(10);
    minFood = Math.min(minFood, g.s.player.food);
    if (process.env.MB_DEBUG && (guard % 20 === 0 || solOf(g.s.tick) >= 9)) {
      const pls = [...g.structs.values()].filter((s) => s.id === "planter").map((s) => s.crop && `${s.crop.g.toFixed(2)}${s.crop.dead ? "X" : ""}`);
      const r = roomAtTile(g, sx, sy);
      console.log(`sol ${solOf(g.s.tick)} tod ${(g.s.tick % SOL_TICKS / SOL_TICKS).toFixed(2)} crops ${pls} room ${r.sealed} o2 ${r.o2.toFixed(2)} T ${r.temp.toFixed(0)} water ${waterTotal(g).total.toFixed(0)} food ${g.s.player.food.toFixed(0)} hp ${g.s.player.health.toFixed(0)} grid ${g.grids.map((x) => `${x.gen.toFixed(1)}/${x.demand.toFixed(1)}/${x.stored.toFixed(0)}`)}`);
    }
  }
  assert.equal(idx(), 11, "harvest");
  const sol = solOf(g.s.tick);
  console.log(`      Act I done on sol ${sol}; min food ${Math.round(minFood)}; health ${Math.round(g.s.player.health)}`);
  assert.ok(sol >= 4 && sol <= 20, `Act I took until sol ${sol}`);
  assert.ok(minFood >= 20, `food dipped to ${minFood}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
