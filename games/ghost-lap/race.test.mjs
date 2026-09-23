import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CIRCUITS } from "./circuits.js";
import { buildTrack, createRace, stepRace, classify, project, aiInput, DIFFICULTY_ORDER, TRACK_WIDTH, ERS, LIMITS } from "./race.js";

const track = buildTrack({ key: "monza", name: "Monza", pts: CIRCUITS.monza.pts, lengthM: CIRCUITS.monza.lengthM, theme: "park" });

function run(race, seconds, drivePlayer = true) {
  const dt = 1 / 120;
  for (let k = 0; k < seconds / dt; k++) {
    const inp = race.player && drivePlayer && race.phase === "racing" ? aiInput(race.player, race, dt) : null;
    stepRace(race, inp, dt);
    if (race.player?.finished && race.cars.every((c) => c.finished)) break;
  }
}

describe("Ghost Lap race simulation", () => {
  it("builds a real-scale circuit with DRS zones and a 10-car grid", () => {
    assert.ok(track.L > 15000, "Monza should be a long lap at world scale");
    assert.ok(track.drs.length >= 1);
    assert.equal(track.grid.length, 10);
    for (const s of track.grid) assert.ok(Math.abs(project(track, s.x, s.y).d) < TRACK_WIDTH / 2);
  });

  it("holds the field on the grid until the five lights go out", () => {
    const race = createRace({ track, mode: "gp", laps: 2, seed: 3 });
    const start = race.cars.map((c) => [c.x, c.y]);
    run(race, 3);
    assert.equal(race.phase, "lights");
    race.cars.forEach((c, k) => assert.deepEqual([c.x, c.y], start[k]));
    run(race, 4);
    assert.equal(race.phase, "racing");
  });

  it("runs a full Grand Prix to the flag and classifies all ten cars", () => {
    const race = createRace({ track, mode: "gp", laps: 2, difficulty: "hard", seed: 11 });
    run(race, 150);
    assert.ok(race.flag, "chequered flag shown");
    const rows = classify(race);
    assert.equal(rows.length, 10);
    assert.deepEqual(rows.map((r) => r.pos), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let k = 1; k < rows.length; k++) assert.ok(rows[k].gap >= 0);
    assert.ok(race.bestLap > 10 && race.bestLap < 60, `fastest lap ${race.bestLap}`);
  });

  it("orders AI difficulty from slowest to quickest", () => {
    const times = DIFFICULTY_ORDER.map((difficulty) => {
      const race = createRace({ track, mode: "duel", laps: 1, difficulty, seed: 2 });
      run(race, 120, false);
      const bot = race.cars.find((c) => !c.isPlayer);
      return bot.finishTime;
    });
    for (let k = 1; k < times.length; k++) assert.ok(times[k] < times[k - 1], `${DIFFICULTY_ORDER[k]} should beat ${DIFFICULTY_ORDER[k - 1]}`);
  });

  it("is lenient on track limits: brief kerb hops are free, then five warnings before 3s penalties", () => {
    const race = createRace({ track, mode: "gp", laps: 3, seed: 4 });
    run(race, 8);
    const p = race.player;
    const excursion = (holdSteps) => {
      const i = p.idx;
      const out = [];
      for (let k = 0; k < holdSteps; k++) {
        p.x = track.path[i][0] + track.nor[i][0] * (TRACK_WIDTH / 2 + LIMITS.margin + 20);
        p.y = track.path[i][1] + track.nor[i][1] * (TRACK_WIDTH / 2 + LIMITS.margin + 20);
        p.vx = track.tan[i][0] * 500;
        p.vy = track.tan[i][1] * 500;
        stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
        out.push(...race.events.filter((e) => e.type === "limits"));
      }
      p.x = track.path[i][0];
      p.y = track.path[i][1];
      stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
      return out;
    };
    // A split-second over the line doesn't count
    assert.equal(excursion(10).length, 0);
    assert.equal(p.strikes, 0);
    // Staying out does: five warnings, then the stewards act
    const events = [];
    for (let k = 0; k < LIMITS.warnings + 2; k++) events.push(...excursion(60));
    assert.equal(p.strikes, LIMITS.warnings + 2);
    assert.equal(p.penalty, LIMITS.penalty * 2);
    assert.equal(events[LIMITS.warnings - 1].penalty, 0);
    assert.equal(events[LIMITS.warnings].penalty, LIMITS.penalty);
    assert.equal(p.lapValid, false);
  });

  it("ERS harvests under braking, deploys for more pace, and locks while DRS is open", () => {
    const race = createRace({ track, mode: "trial", seed: 5 });
    const p = race.player;
    const straight = () => {
      const i = p.idx;
      p.x = track.path[i][0];
      p.y = track.path[i][1];
      p.heading = Math.atan2(track.tan[i][1], track.tan[i][0]);
    };
    // Harvest: hard braking from speed refills the battery, up to the per-lap cap
    p.battery = 0.2;
    p.vx = Math.cos(p.heading) * 600;
    p.vy = Math.sin(p.heading) * 600;
    p.fwd = 600;
    for (let k = 0; k < 90; k++) stepRace(race, { throttle: 0, brake: 1, steer: 0 }, 1 / 120);
    assert.ok(p.battery > 0.25, `harvested to ${p.battery}`);
    assert.ok(p.ersHarvestLap <= ERS.harvestLap + 1e-9);

    // Deploy: same launch with and without ERS, ERS car is quicker
    const launch = (ers) => {
      const r = createRace({ track, mode: "trial", seed: 5 });
      r.player.battery = 1;
      for (let k = 0; k < 240; k++) stepRace(r, { throttle: 1, brake: 0, steer: 0, ers }, 1 / 120);
      return { fwd: r.player.fwd, used: r.player.ersUsedLap };
    };
    const plain = launch(false);
    const boosted = launch(true);
    assert.ok(boosted.fwd > plain.fwd + 10, `ERS ${boosted.fwd} vs ${plain.fwd}`);
    assert.ok(boosted.used > 0 && plain.used === 0);

    // Locked with DRS open, and a lap's allowance can't be exceeded
    straight();
    p.battery = 1;
    p.ersUsedLap = 0;
    p.drsOpen = true;
    p.drsEligible = true;
    const before = p.battery;
    const zone = track.drs[0];
    p.idx = zone.from;
    stepRace(race, { throttle: 1, brake: 0, steer: 0, ers: true, drs: true }, 1 / 120);
    assert.equal(p.ersOn, false);
    assert.equal(p.battery, before);
    p.drsOpen = false;
    p.ersUsedLap = ERS.perLap;
    stepRace(race, { throttle: 1, brake: 0, steer: 0, ers: true }, 1 / 120);
    assert.equal(p.ersOn, false);
  });
});
