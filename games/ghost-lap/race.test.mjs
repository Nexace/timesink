import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CIRCUITS } from "./circuits.js";
import { buildTrack, createRace, stepRace, classify, project, aiInput, DIFFICULTY, DIFFICULTY_ORDER, TRACK_WIDTH, ERS, LIMITS, CUT_PENALTY, CAR, cornerSpeed, gripAt, makeField, qualifyingLap } from "./race.js";

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
  it("builds a real-scale circuit with DRS zones and a 20-car grid", () => {
    assert.ok(track.L > 15000, "Monza should be a long lap at world scale");
    assert.ok(track.drs.length >= 1);
    assert.equal(track.grid.length, 20);
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

  it("runs a full Grand Prix to the flag and classifies all twenty cars", () => {
    const race = createRace({ track, mode: "gp", laps: 2, difficulty: "hard", seed: 11 });
    run(race, 150);
    assert.ok(race.flag, "chequered flag shown");
    const rows = classify(race);
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.map((r) => r.pos), Array.from({ length: 20 }, (_, k) => k + 1));
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

  it("is lenient but fair on track limits: kerb hops, no-advantage trips and being pushed are free", () => {
    const race = createRace({ track, mode: "gp", laps: 3, seed: 4 });
    run(race, 8);
    const p = race.player;
    // Just the player on track, so no rival can bump it mid-test (contact is exempt, tested below)
    race.cars = race.cars.filter((c) => c.isPlayer);
    race.order = race.order.filter((c) => c.isPlayer);
    // Hold the whole car past the kerb for a while, then rejoin at `backSpeed` (px/s)
    const excursion = (holdSteps, { backSpeed = 500, hit = false } = {}) => {
      const i = p.idx;
      const out = [];
      for (let k = 0; k < holdSteps; k++) {
        p.x = track.path[i][0] + track.nor[i][0] * (TRACK_WIDTH / 2 + LIMITS.margin + 20);
        p.y = track.path[i][1] + track.nor[i][1] * (TRACK_WIDTH / 2 + LIMITS.margin + 20);
        p.vx = track.tan[i][0] * 500;
        p.vy = track.tan[i][1] * 500;
        if (hit) p.lastHit = race.t;
        stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
        out.push(...race.events.filter((e) => e.type === "limits"));
      }
      p.x = track.path[i][0];
      p.y = track.path[i][1];
      p.vx = track.tan[i][0] * backSpeed;
      p.vy = track.tan[i][1] * backSpeed;
      stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
      out.push(...race.events.filter((e) => e.type === "limits"));
      if (hit) p.lastHit = -9;
      return out;
    };
    // A split-second over the line doesn't count
    assert.equal(excursion(10).length, 0);
    // Out long enough, but it came back much slower: no advantage, no strike
    assert.equal(excursion(60, { backSpeed: 250 }).length, 0);
    // Shoved off by contact: not the driver's fault
    assert.equal(excursion(60, { hit: true }).length, 0);
    assert.equal(p.strikes, 0);
    // Running wide and keeping the speed does count: five warnings, then the stewards act
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

    // Locked with DRS open; usable again as soon as there's charge
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
    p.battery = 0;
    stepRace(race, { throttle: 1, brake: 0, steer: 0, ers: true }, 1 / 120);
    assert.equal(p.ersOn, false);
    // Flat battery: one hard stop from speed puts a real chunk back, and ERS works again
    p.vx = Math.cos(p.heading) * 650;
    p.vy = Math.sin(p.heading) * 650;
    for (let k = 0; k < 40; k++) stepRace(race, { throttle: 0, brake: 1, steer: 0 }, 1 / 120);
    assert.ok(p.battery > 0.15, `one stop recovered ${p.battery}`);
    stepRace(race, { throttle: 1, brake: 0, steer: 0, ers: true }, 1 / 120);
    assert.equal(p.ersOn, true);
  });

  it("corners need braking: grip grows with speed but slow corners are slow", () => {
    assert.ok(gripAt(CAR.top) > gripAt(0));
    // A 50 px (~15 m) hairpin is well under 100 km/h; only a very long radius is flat out
    assert.ok(cornerSpeed(50) * 0.47 < 100, `hairpin ${cornerSpeed(50) * 0.47}`);
    assert.ok(cornerSpeed(300) < CAR.top);
    assert.ok(cornerSpeed(5000) >= CAR.top);
    assert.ok(cornerSpeed(200, 1.1) > cornerSpeed(200, 0.9));
  });

  it("cutting a corner: first one is a warning, then +2 s, and a push onto the inside is free", () => {
    const race = createRace({ track, mode: "gp", laps: 3, seed: 9 });
    run(race, 8);
    const p = race.player;
    // Find a long, steady corner and drive the car across its inside, off the road, at 300 px/s:
    // it covers ~10 px of track per frame while only driving 2.5 px, a clear shortcut
    let i0 = -1;
    let best = 0;
    for (let i = 20; i < track.n - 20; i++) {
      const sg = Math.sign(track.curv[i]);
      let sum = 0;
      let steady = true;
      for (let k = -14; k <= 14; k++) {
        const c = track.curv[i + k];
        if (Math.sign(c) !== sg || 1 / Math.abs(c) < 120) steady = false;
        sum += Math.abs(c);
      }
      if (steady && sum > best) {
        best = sum;
        i0 = i;
      }
    }
    assert.ok(i0 > 0, "needs a sweeping corner");
    const inside = Math.sign(track.curv[i0]);
    const cut = ({ hit = false } = {}) => {
      // Line the car up on the kerb before the cut so the only progress counted is the shortcut
      const s0 = i0 - 9;
      p.x = track.path[s0][0];
      p.y = track.path[s0][1];
      stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
      const out = [];
      for (let k = -8; k <= 8; k++) {
        const i = (i0 + k + track.n) % track.n;
        p.x = track.path[i][0] + track.nor[i][0] * inside * (TRACK_WIDTH / 2 + 30);
        p.y = track.path[i][1] + track.nor[i][1] * inside * (TRACK_WIDTH / 2 + 30);
        p.vx = track.tan[i][0] * 300;
        p.vy = track.tan[i][1] * 300;
        if (hit) p.lastHit = race.t;
        stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
        out.push(...race.events.filter((e) => e.type === "cut"));
      }
      const back = (i0 + 9) % track.n;
      p.x = track.path[back][0];
      p.y = track.path[back][1];
      stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
      out.push(...race.events.filter((e) => e.type === "cut"));
      p.lastHit = -9;
      return out;
    };
    assert.equal(cut({ hit: true }).length, 0);
    assert.equal(p.penalty, 0);
    const first = cut();
    assert.equal(first.length, 1);
    assert.equal(first[0].warning, true);
    assert.equal(p.penalty, 0);
    assert.equal(p.lapValid, false);
    const second = cut();
    assert.equal(second.length, 1);
    assert.equal(second[0].penalty, CUT_PENALTY);
    assert.equal(p.penalty, CUT_PENALTY);
  });

  it("fields 19 rivals, adds Noob below Very Easy, and MIXED spans every level", () => {
    assert.equal(DIFFICULTY_ORDER[0], "noob");
    assert.ok(DIFFICULTY.noob.pace < DIFFICULTY.veryEasy.pace);
    assert.equal(makeField({ mode: "gp", difficulty: "hard", seed: 3 }).length, 19);
    const mixed = makeField({ mode: "gp", difficulty: "mixed", seed: 3 });
    const paces = new Set(mixed.map((f) => f.skill.pace));
    assert.equal(paces.size, DIFFICULTY_ORDER.length);
    for (let k = 1; k < mixed.length; k++) assert.ok(mixed[k].skill.pace <= mixed[k - 1].skill.pace);
  });

  it("qualifying: quicker drivers set quicker laps, and a grid can put the player on pole", () => {
    const fast = qualifyingLap(track, DIFFICULTY.impossible, () => 0.5);
    const slow = qualifyingLap(track, DIFFICULTY.noob, () => 0.5);
    assert.ok(Number.isFinite(fast) && fast < slow, `${fast} vs ${slow}`);
    const field = makeField({ mode: "gp", difficulty: "medium", seed: 5 });
    const race = createRace({ track, mode: "gp", laps: 2, seed: 5, grid: ["player", ...field] });
    assert.equal(race.cars[0].isPlayer, true);
    assert.equal(race.cars.length, 20);
  });

  it("ERS: the out-lap doesn't use up lap 1's harvest cap", () => {
    const race = createRace({ track, mode: "trial", seed: 3 });
    const p = race.player;
    p.ersHarvestLap = ERS.harvestLap;
    for (let k = 0; k < 120 * 60 && p.laps < 0; k++) stepRace(race, aiInput(p, race, 1 / 120), 1 / 120);
    assert.equal(p.laps, 0);
    assert.ok(p.ersHarvestLap < 0.05, `harvested ${p.ersHarvestLap}`);
  });
});
