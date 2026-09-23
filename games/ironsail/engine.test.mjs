import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WORLD,
  COMMODITIES,
  SHIPS,
  UPGRADES,
  MAX_UPGRADE,
  upgradeCost,
  generateWorld,
  priceAt,
  sellPrice,
  shipStats,
  windFactor,
  pirateSpawns,
  sectorOf,
  newSave,
  validateSave,
  cargoCount,
  hasWon
} from "./world.js";

const world = generateWorld(1717);

describe("Ironsail world", () => {
  it("is deterministic from the seed", () => {
    const again = generateWorld(1717);
    assert.deepEqual(
      again.islands.map((i) => [i.name, Math.round(i.x), Math.round(i.y)]),
      world.islands.map((i) => [i.name, Math.round(i.x), Math.round(i.y)])
    );
    assert.equal(again.features.length, world.features.length);
  });

  it("spreads 30 uniquely named islands across the ocean without overlaps", () => {
    assert.equal(world.islands.length, 30);
    assert.equal(new Set(world.islands.map((i) => i.name)).size, 30);
    for (const a of world.islands) {
      assert.ok(a.x > 0 && a.y > 0 && a.x < WORLD && a.y < WORLD);
      for (const b of world.islands) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 500, `${a.name} vs ${b.name}`);
    }
    const sectors = new Set(world.islands.map((i) => sectorOf(i.x, i.y).name));
    assert.ok(sectors.size >= 8, "islands in (nearly) every sector");
    assert.equal(world.islands[0].forts, 0, "home port starts friendly");
  });

  it("fills the open sea with rocks, reefs, wrecks, ruins, lighthouses and loot", () => {
    const kinds = {};
    for (const f of world.features) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
    for (const k of ["rocks", "stack", "reef", "wreck", "ruins", "lighthouse", "buoy", "whirlpool", "crate"]) assert.ok(kinds[k] > 0, k);
    for (const f of world.features) for (const i of world.islands) assert.ok(Math.hypot(f.x - i.x, f.y - i.y) > i.r * 1.3, `${f.kind} clear of ${i.name}`);
  });

  it("spawns pirates alone and in packs, more in dangerous seas", () => {
    let solo = 0;
    let packs = 0;
    let calm = 0;
    let rough = 0;
    for (let epoch = 0; epoch < 6; epoch++) {
      for (let cy = 0; cy < 7; cy++) {
        for (let cx = 0; cx < 7; cx++) {
          const list = pirateSpawns(world, cx, cy, epoch);
          const groups = new Set(list.map((p) => p.group));
          for (const g of groups) (list.filter((p) => p.group === g).length > 1 ? packs++ : solo++);
          const d = sectorOf(cx * 2000 + 1000, cy * 2000 + 1000).danger;
          if (d <= 1) calm += list.length;
          if (d >= 3) rough += list.length;
        }
      }
    }
    assert.ok(solo > 0 && packs > 0, `solo ${solo}, packs ${packs}`);
    assert.ok(rough > calm, `rough ${rough} vs calm ${calm}`);
    assert.deepEqual(pirateSpawns(world, 3, 4, 2), pirateSpawns(world, 3, 4, 2), "same cell and epoch, same raiders");
  });
});

describe("Ironsail economy", () => {
  it("prices goods cheaply where they're made and dearly where they're wanted", () => {
    const isl = world.islands[3];
    const made = isl.produces[0];
    const wanted = isl.demands[0];
    let madeSum = 0;
    let wantedSum = 0;
    for (let e = 0; e < 20; e++) {
      madeSum += priceAt(world, isl, made, e) / COMMODITIES.find((c) => c.id === made).base;
      wantedSum += priceAt(world, isl, wanted, e) / COMMODITIES.find((c) => c.id === wanted).base;
    }
    assert.ok(madeSum < wantedSum);
    assert.ok(sellPrice(100) < 100);
  });

  it("ship tiers and upgrades scale sensibly", () => {
    for (let t = 1; t < SHIPS.length; t++) {
      assert.ok(SHIPS[t].hull > SHIPS[t - 1].hull);
      assert.ok(SHIPS[t].guns > SHIPS[t - 1].guns);
      assert.ok(SHIPS[t].price > SHIPS[t - 1].price);
    }
    const base = shipStats(0, {});
    const maxed = shipStats(0, Object.fromEntries(UPGRADES.map((u) => [u.id, MAX_UPGRADE])));
    assert.ok(maxed.maxHull > base.maxHull && maxed.damage > base.damage && maxed.speedMult > base.speedMult && maxed.reload < base.reload);
    assert.ok(upgradeCost(UPGRADES[0], 4) > upgradeCost(UPGRADES[0], 0));
  });

  it("sails fastest on a beam reach and slowest into the wind", () => {
    const into = windFactor(Math.PI, 0);
    const beam = windFactor(Math.PI / 2, 0);
    const run = windFactor(0, 0);
    assert.ok(beam > run && run > into, `${into} ${beam} ${run}`);
    assert.ok(into >= 0.38);
  });
});

describe("Ironsail saves", () => {
  it("validates garbage into a fresh save and keeps good data", () => {
    assert.deepEqual(validateSave(null, world), newSave());
    assert.deepEqual(validateSave({ v: 1 }, world), newSave());
    const s = validateSave({ v: 2, gold: 1e12, tier: 99, upgrades: { guns: 7, bogus: 3 }, cargo: { rum: 5, gold: 9 }, captured: [0, 4, 999], bosses: ["kraken", "dragon"], x: -50, y: 1e9 }, world);
    assert.equal(s.gold, 1e8);
    assert.equal(s.tier, SHIPS.length - 1);
    assert.equal(s.upgrades.guns, MAX_UPGRADE);
    assert.ok(!("bogus" in s.upgrades));
    assert.deepEqual(s.cargo, { rum: 5 });
    assert.deepEqual(s.captured, [0, 4]);
    assert.deepEqual(s.bosses, ["kraken"]);
    assert.ok(s.x >= 100 && s.y <= WORLD - 100);
    assert.equal(cargoCount({ rum: 3, silk: 2 }), 5);
  });

  it("victory needs every island and both legends", () => {
    const all = world.islands.map((i) => i.id);
    assert.ok(!hasWon({ captured: all, bosses: ["ghost"] }, world));
    assert.ok(hasWon({ captured: all, bosses: ["ghost", "kraken"] }, world));
  });
});
