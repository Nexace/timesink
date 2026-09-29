import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CIRCUITS } from "./circuits.js";
import { buildTrack, createRace, stepRace, classify, project, aiInput, DIRTY_AIR, BRAKES, brakeEfficiency, DRS_GAP, DIFFICULTY, DIFFICULTY_ORDER, TRACK_WIDTH, ERS, LIMITS, CUT_PENALTY, CAR, cornerSpeed, gripAt, makeField, qualifyingLap, MIN_CARS, MAX_CARS, halfAt, STRAIGHT_WIDTH, V8, engineGear, engineRpm, STYLES, makePersona, carLine, stepCar, makeCar } from "./race.js";

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
  it("builds a real-scale circuit with DRS zones and a grid for up to 30 cars", () => {
    assert.ok(track.L > 15000, "Monza should be a long lap at world scale");
    assert.ok(track.drs.length >= 1);
    assert.equal(track.grid.length, MAX_CARS);
    for (const s of track.grid) assert.ok(Math.abs(project(track, s.x, s.y).d) < halfAt(track, s.i));
    // The road is full width through the corners and narrower on the long straights
    const tight = track.radii.findIndex((r) => r < 300);
    assert.equal(halfAt(track, tight), TRACK_WIDTH / 2);
    assert.ok(track.half.some((h) => Math.abs(h - STRAIGHT_WIDTH / 2) < 1e-9), "some straight is at the narrow width");
    for (let i = 0; i < track.n; i++) assert.ok(Math.abs(track.half[i] - track.half[(i + 1) % track.n]) < 1.5, "the width changes gradually");
  });

  it("holds the field on the grid until the five lights go out", () => {
    const race = createRace({ track, mode: "gp", laps: 2, seed: 3 });
    const start = race.cars.map((c) => [c.x, c.y]);
    run(race, 3);
    assert.equal(race.phase, "lights");
    race.cars.forEach((c, k) => assert.deepEqual([c.x, c.y], start[k]));
    run(race, race.lightsOutAt - race.clock - 0.05);
    assert.equal(race.phase, "lights");
    run(race, 0.1);
    assert.equal(race.phase, "racing");
  });

  it("randomises the start: light gaps and the hold before lights out differ every race", () => {
    const starts = [1, 2, 3, 4, 5, 6].map((seed) => createRace({ track, mode: "gp", laps: 2, seed }));
    for (const r of starts) {
      r.lightTimes.forEach((t, k) => {
        const gap = t - (k ? r.lightTimes[k - 1] : 0);
        assert.ok(gap >= 0.65 && gap <= 1.25, `light gap ${gap}`);
      });
      const hold = r.lightsOutAt - r.lightTimes[4];
      assert.ok(hold >= 0.2 && hold <= 3, `hold ${hold}`);
    }
    assert.equal(new Set(starts.map((r) => r.lightsOutAt.toFixed(3))).size, starts.length);
    assert.equal(new Set(starts.map((r) => r.lightTimes[0].toFixed(3))).size, starts.length);
  });

  it("runs 3-car and 30-car Grands Prix to the flag with every car classified", () => {
    for (const fieldSize of [MIN_CARS, MAX_CARS]) {
      const race = createRace({ track, mode: "gp", laps: 1, difficulty: "medium", seed: 11, fieldSize });
      assert.equal(race.cars.length, fieldSize);
      assert.equal(race.cars.filter((c) => c.isPlayer).length, 1);
      run(race, 120);
      assert.ok(race.flag, `${fieldSize} cars: chequered flag shown`);
      assert.equal(classify(race).length, fieldSize);
    }
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

  it("a bot that crashes into the barrier finds its way back onto the road", () => {
    for (let s = 0; s < 8; s++) {
      const race = createRace({ track, mode: "trial", seed: 1 });
      const car = race.cars[0];
      car.isPlayer = false;
      race.player = null;
      car.skill = DIFFICULTY.hard;
      run(race, 2);
      // Put it against the barrier, pointing into it at an angle, at eight spots round the lap
      const i = Math.floor((track.n * (s + 0.5)) / 8);
      const side = s % 2 ? 1 : -1;
      const d = side * (track.walls[side > 0 ? 1 : 0][i] - 10);
      car.x = track.path[i][0] + track.nor[i][0] * d;
      car.y = track.path[i][1] + track.nor[i][1] * d;
      car.heading = Math.atan2(track.tan[i][1], track.tan[i][0]) + side * [0.6, 1.2, 1.6, 2.4][s % 4];
      car.vx = Math.cos(car.heading) * 200;
      car.vy = Math.sin(car.heading) * 200;
      car.idx = i;
      let back = false;
      for (let k = 0; k < 120 * 10 && !back; k++) {
        stepRace(race, null, 1 / 120);
        const tn = track.tan[car.idx];
        const err = Math.abs(Math.atan2(Math.sin(Math.atan2(tn[1], tn[0]) - car.heading), Math.cos(Math.atan2(tn[1], tn[0]) - car.heading)));
        back = Math.abs(car.d) < halfAt(track, car.idx) && err < 0.4 && car.fwd > 250;
      }
      assert.ok(back, `stuck off the road at point ${i}: d ${car.d.toFixed(0)}, speed ${car.fwd.toFixed(0)}`);
    }
  });

  it("orders AI difficulty from slowest to quickest", () => {
    // A twisty track: on Monza's straights the two gentlest levels are within a tenth of each other
    const twisty = buildTrack({ key: "hungary", ...CIRCUITS.hungary });
    const times = DIFFICULTY_ORDER.map((difficulty) => {
      const race = createRace({ track: twisty, mode: "duel", laps: 1, difficulty, seed: 2 });
      run(race, 120, false);
      const bot = race.cars.find((c) => !c.isPlayer);
      return bot.finishTime;
    });
    for (let k = 1; k < times.length; k++) assert.ok(times[k] < times[k - 1], `${DIFFICULTY_ORDER[k]} should beat ${DIFFICULTY_ORDER[k - 1]}`);
  });

  it("is lenient but fair on track limits: kerb hops, no-advantage trips and being pushed are free", () => {
    const race = createRace({ track, mode: "gp", laps: 3, seed: 4 });
    run(race, race.lightsOutAt + 3);
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

  it("ERS can't harvest while it's deploying (throttle and brake together)", () => {
    const race = createRace({ track, mode: "trial", seed: 5 });
    const p = race.player;
    p.battery = 0.5;
    for (let k = 0; k < 120; k++) stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
    const before = p.battery;
    for (let k = 0; k < 60; k++) stepRace(race, { throttle: 1, brake: 1, steer: 0, ers: true }, 1 / 120);
    assert.ok(p.battery <= before + 1e-9, `battery went ${before} -> ${p.battery}`);
  });

  it("an offence running over the finish line deletes the lap it helped, not the next one", () => {
    const race = createRace({ track, mode: "gp", laps: 5, seed: 4 });
    const p = race.player;
    race.cars = [p];
    race.order = [p];
    run(race, race.lightsOutAt + 0.2, false);
    // Flying toward the line, well past the kerb at racing speed, on lap 2
    p.laps = 1;
    p.lapStart = race.t - 40;
    p.lapValid = true;
    p.sector = 2;
    const put = (i, d) => {
      p.x = track.path[i][0] + track.nor[i][0] * d;
      p.y = track.path[i][1] + track.nor[i][1] * d;
      p.heading = Math.atan2(track.tan[i][1], track.tan[i][0]);
      p.vx = Math.cos(p.heading) * 700;
      p.vy = Math.sin(p.heading) * 700;
    };
    // (only the position is set each step; the game tracks the index, so it sees the line crossing)
    p.idx = track.n - 31;
    const off = halfAt(track, track.n - 30) + LIMITS.margin + 12;
    for (let k = 0; k < 60; k++) {
      put((track.n - 30 + k) % track.n, off);
      stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
    }
    assert.equal(p.laps, 2, "crossed the line");
    assert.equal(p.lapTimes.at(-1).valid, false, "the lap that ended off the track is deleted");
    // Back on the road with its speed: a strike, but the new lap is untouched
    put(40, 0);
    stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
    assert.equal(p.strikes, 1);
    assert.equal(p.lapValid, true, "the new lap stays valid");
  });

  it("reversing back over the line and driving over it again doesn't count as a lap", () => {
    const race = createRace({ track, mode: "gp", laps: 5, seed: 4 });
    const p = race.player;
    race.cars = [p];
    race.order = [p];
    run(race, race.lightsOutAt + 0.3, false);
    const put = (i) => {
      p.x = track.path[i][0];
      p.y = track.path[i][1];
      p.heading = Math.atan2(track.tan[i][1], track.tan[i][0]);
    };
    const drive = (from, to, dir) => {
      for (let i = from; i !== to; ) {
        i = (i + dir + track.n) % track.n;
        put(i);
        stepRace(race, { throttle: 0, brake: 0, steer: 0 }, 1 / 120);
      }
    };
    p.idx = track.n - 10;
    put(track.n - 10);
    drive(track.n - 10, 10, 1); // over the line: the lap starts
    assert.equal(p.laps, 0);
    for (let k = 0; k < 3; k++) {
      drive(10, track.n - 10, -1); // back over it
      drive(track.n - 10, 10, 1); // and forward again
    }
    assert.equal(p.laps, 0, "no laps farmed");
    assert.equal(p.lapTimes.length, 0);
    // A real lap still counts
    drive(10, track.n - 10, 1);
    drive(track.n - 10, 10, 1);
    assert.equal(p.laps, 1);
  });

  it("V8 engine: 8 gears, each pulling up to the limiter, revs dropping on every upshift", () => {
    assert.equal(engineGear(0), 0);
    assert.equal(engineGear(-40), -1);
    assert.equal(engineRpm(0, 1), V8.limiter, "revving on the grid hits the limiter");
    assert.equal(engineRpm(0, 0), V8.idle);
    let prev = null;
    let upshifts = 0;
    for (let v = 10; v <= CAR.top * 1.25; v += 2) {
      const g = engineGear(v);
      const rpm = engineRpm(v, 1);
      assert.ok(rpm >= V8.idle && rpm <= V8.limiter, `rpm ${rpm} at ${v}`);
      if (prev && g === prev.g) assert.ok(rpm >= prev.rpm, "revs rise within a gear");
      if (prev && g > prev.g) {
        upshifts++;
        assert.ok(rpm < prev.rpm - 3000, `upshift ${prev.g}->${g} drops the revs`);
      }
      prev = { g, rpm };
    }
    assert.equal(upshifts, 7);
    assert.equal(prev.g, 8);
    const atTop = engineRpm(CAR.top, 1);
    assert.ok(atTop > 16500 && atTop < V8.limiter, `near the limiter at top speed: ${atTop}`);
  });

  it("contact with the player is reported with the player's car", () => {
    const race = createRace({ track, mode: "duel", laps: 3, seed: 2 });
    run(race, race.lightsOutAt + 1);
    const [a, b] = race.cars;
    const i = a.idx;
    const h = Math.atan2(track.tan[i][1], track.tan[i][0]);
    for (const [c, back, v] of [[a, 0, 200], [b, 3, 500]]) {
      const k = (i - back + track.n) % track.n;
      c.x = track.path[k][0];
      c.y = track.path[k][1];
      c.heading = h;
      c.vx = Math.cos(h) * v;
      c.vy = Math.sin(h) * v;
    }
    const events = [];
    for (let k = 0; k < 30; k++) {
      stepRace(race, { throttle: 1, brake: 0, steer: 0 }, 1 / 120);
      events.push(...race.events);
    }
    const hit = events.find((e) => e.type === "contact");
    assert.ok(hit, "contact reported");
    assert.equal(hit.car, race.player.id);
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
    assert.ok(DIFFICULTY.noob.corner < DIFFICULTY.veryEasy.corner);
    assert.equal(makeField({ mode: "gp", difficulty: "hard", seed: 3 }).length, 19);
    // Field size is the player's choice, 3 to 30 cars; every rival has their own timing code
    assert.equal(makeField({ mode: "gp", difficulty: "hard", seed: 3, cars: MIN_CARS }).length, MIN_CARS - 1);
    const big = makeField({ mode: "gp", difficulty: "hard", seed: 3, cars: MAX_CARS });
    assert.equal(big.length, MAX_CARS - 1);
    assert.equal(new Set(big.map((f) => f.livery.code)).size, big.length);
    assert.equal(makeField({ mode: "gp", difficulty: "hard", seed: 3, cars: 99 }).length, MAX_CARS - 1);
    const mixed = makeField({ mode: "gp", difficulty: "mixed", seed: 3 });
    const paces = new Set(mixed.map((f) => `${f.skill.corner}/${f.skill.brake}/${f.skill.boost}`));
    assert.equal(paces.size, DIFFICULTY_ORDER.length);
    for (let k = 1; k < mixed.length; k++) assert.ok(mixed[k].skill.corner <= mixed[k - 1].skill.corner);
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

  it("bots drive the same car: same launch, same top speed, same ERS as the player", () => {
    const race = createRace({ track, mode: "duel", laps: 3, difficulty: "impossible", seed: 2 });
    run(race, 1);
    const [a, b] = race.cars;
    const bot = a.isPlayer ? b : a;
    const me = a.isPlayer ? a : b;
    // Put both on the same straight, side by side, flat out with ERS: they must stay level
    const i = track.drs[0].from;
    for (const [c, side] of [[me, -30], [bot, 30]]) {
      c.x = track.path[i][0] + track.nor[i][0] * side;
      c.y = track.path[i][1] + track.nor[i][1] * side;
      c.heading = Math.atan2(track.tan[i][1], track.tan[i][0]);
      c.vx = track.tan[i][0] * 300;
      c.vy = track.tan[i][1] * 300;
      c.battery = 1;
      c.steer = 0;
    }
    const botInput = { throttle: 1, brake: 0, steer: 0, ers: true };
    const saved = bot.isPlayer;
    for (let k = 0; k < 120; k++) {
      // Drive the bot with the same pedal inputs through the same physics step
      bot.isPlayer = true;
      race.player = bot;
      stepRace(race, botInput, 1 / 240);
      bot.isPlayer = saved;
      me.isPlayer = true;
      race.player = me;
      stepRace(race, botInput, 1 / 240);
    }
    assert.ok(Math.abs(me.fwd - bot.fwd) < 3, `player ${me.fwd} vs bot ${bot.fwd}`);
  });

  it("dirty air: a car close behind in a corner has less grip; clean air has full grip", () => {
    const race = createRace({ track, mode: "duel", laps: 3, seed: 2 });
    run(race, race.lightsOutAt + 1);
    const [lead, chase] = race.cars;
    const i = lead.idx;
    const put = (c, back) => {
      const k = (i - back + track.n) % track.n;
      c.x = track.path[k][0];
      c.y = track.path[k][1];
      c.heading = Math.atan2(track.tan[k][1], track.tan[k][0]);
    };
    put(lead, 0);
    put(chase, 8);
    stepRace(race, null, 1 / 120);
    assert.ok(chase.dirty > 0.4, `close behind: ${chase.dirty}`);
    assert.equal(lead.dirty, 0);
    put(chase, 60);
    stepRace(race, null, 1 / 120);
    assert.equal(chase.dirty, 0);
    assert.ok(DIRTY_AIR.grip > 0 && DIRTY_AIR.grip < 0.3);
  });

  it("cars are solid: a rear-end hit pushes them apart and slows the chaser", () => {
    const race = createRace({ track, mode: "duel", laps: 3, seed: 2 });
    run(race, race.lightsOutAt + 1);
    const [a, b] = race.cars;
    const i = a.idx;
    const h = Math.atan2(track.tan[i][1], track.tan[i][0]);
    for (const [c, back, v] of [[a, 0, 200], [b, 3, 400]]) {
      const k = (i - back + track.n) % track.n;
      c.x = track.path[k][0];
      c.y = track.path[k][1];
      c.heading = h;
      c.vx = Math.cos(h) * v;
      c.vy = Math.sin(h) * v;
    }
    stepRace(race, null, 1 / 120);
    const gap = Math.hypot(a.x - b.x, a.y - b.y);
    assert.ok(gap >= 40, `bodies overlap: ${gap}`);
    const along = (c) => c.vx * Math.cos(h) + c.vy * Math.sin(h);
    assert.ok(along(b) < 380 && along(a) > 200, `chaser ${along(b)}, leader ${along(a)}`);
  });

  it("DRS in a race: crossing the detection line under 1.0 s behind any car enables it, over 1.0 s doesn't", () => {
    const tryGap = (seconds) => {
      const race = createRace({ track, mode: "duel", laps: 5, seed: 2 });
      run(race, 6);
      const [a, b] = race.cars;
      const me = a.isPlayer ? a : b;
      const rival = a.isPlayer ? b : a;
      const z = track.drs[0];
      const v = 400;
      // Both on lap 2, rolling down the road toward the detection line, `seconds` apart
      for (const [c, back] of [[rival, 30], [me, 30 + (v * seconds) / 10]]) {
        const k = (z.detect - Math.round(back) + track.n) % track.n;
        c.laps = 1;
        c.x = track.path[k][0];
        c.y = track.path[k][1];
        c.heading = Math.atan2(track.tan[k][1], track.tan[k][0]);
        c.vx = track.tan[k][0] * v;
        c.vy = track.tan[k][1] * v;
        c.idx = k;
        c.drsEligible = false;
      }
      const events = [];
      for (let k = 0; k < 360 && !events.length; k++) {
        const hold = { throttle: 0.5, brake: 0, steer: 0, drs: true };
        stepRace(race, hold, 1 / 120);
        events.push(...race.events.filter((e) => e.type === "drsDetect"));
      }
      return { eligible: me.drsEligible, event: events[0] };
    };
    const close = tryGap(0.5);
    assert.equal(close.eligible, true);
    assert.ok(close.event && close.event.gap < DRS_GAP, JSON.stringify(close.event));
    const far = tryGap(1.6);
    assert.equal(far.eligible, false);
  });

  it("brakes: hard use overheats and fades them, and wears them out; the option is off by default", () => {
    assert.equal(createRace({ track, mode: "gp", laps: 3, seed: 1 }).player.brakeTemp, undefined);
    const race = createRace({ track, mode: "gp", laps: 3, seed: 1, brakes: true });
    run(race, 6);
    const p = race.player;
    assert.ok(Math.abs(p.brakeTemp - BRAKES.start) < 200);
    // Stamp on the brakes from top speed over and over without letting them cool
    for (let rep = 0; rep < 8; rep++) {
      p.vx = Math.cos(p.heading) * CAR.top;
      p.vy = Math.sin(p.heading) * CAR.top;
      p.fwd = CAR.top;
      for (let k = 0; k < 30; k++) stepRace(race, { throttle: 0, brake: 1, steer: 0 }, 1 / 120);
    }
    assert.ok(p.brakeTemp > BRAKES.fade, `temp ${p.brakeTemp}`);
    assert.ok(p.brakeEff < 0.95, `efficiency ${p.brakeEff}`);
    assert.ok(p.brakeLife < 1);
    assert.ok(brakeEfficiency(600, 1) === 1 && brakeEfficiency(600, 0.05) < 0.7 && brakeEfficiency(200, 1) < 1);
  });

  it("stored fastest lines match their tracks, are used, and are quicker than the elastic line", async () => {
    const { RACING_LINES } = await import("./lines.js");
    const { CIRCUITS } = await import("./circuits.js");
    const { trackShapeKey, lineLapTime } = await import("./race.js");
    assert.ok(Object.keys(RACING_LINES).length >= 20);
    for (const key of Object.keys(RACING_LINES)) {
      const def = { key, ...CIRCUITS[key] };
      const elastic = buildTrack({ ...def, elasticLine: true });
      const fast = buildTrack(def);
      assert.equal(RACING_LINES[key].shape, trackShapeKey(elastic.path, elastic.half), `${key}: re-run scripts/optimize-lines.mjs`);
      assert.ok(lineLapTime(fast, fast.line) < lineLapTime(elastic, elastic.line), `${key} line not quicker`);
      assert.ok(fast.line.every((o, i) => Math.abs(o) <= fast.half[i] - 16 + 1e-9), `${key} line leaves the road`);
    }
  });

  it("line guide: brake before slow corners, full throttle on the straights", () => {
    const g = track.guide;
    const counts = [0, 0, 0];
    for (const x of g) counts[x]++;
    assert.ok(counts[0] > track.n * 0.3, "mostly full throttle at Monza");
    assert.ok(counts[2] > 10, "braking zones exist");
    // Every braking zone ends in a slower section than it starts
    for (let i = 0; i < track.n; i++) {
      if (g[i] === 2 && g[(i + 1) % track.n] !== 2) assert.ok(track.plan[(i + 1) % track.n] < CAR.top * 0.95);
    }
  });

  it("from Hard up the bots get a faster car, and each level is quicker than the one below", () => {
    assert.equal(DIFFICULTY.medium.boost, 1);
    assert.ok(DIFFICULTY.hard.boost > 1 && DIFFICULTY.veryHard.boost > DIFFICULTY.hard.boost && DIFFICULTY.impossible.boost > DIFFICULTY.veryHard.boost);
    const lapFor = (d) => {
      const race = createRace({ track, mode: "trial", seed: 1 });
      const c = race.cars[0];
      c.isPlayer = false;
      c.skill = DIFFICULTY[d];
      race.player = null;
      for (let k = 0; k < 120 * 200 && c.lapTimes.length < 2; k++) stepRace(race, null, 1 / 120);
      return c.lapTimes[1].time;
    };
    const med = lapFor("medium");
    const imp = lapFor("impossible");
    assert.ok(imp < med * 0.96, `impossible ${imp} vs medium ${med}`);
  });

  it("driving styles: ten, dealt at random each race (duels too), every trait varied per driver", () => {
    assert.equal(STYLES.length, 10);
    const gp = makeField({ mode: "gp", difficulty: "hard", seed: 11, cars: 11 });
    // a 10-rival field gets every style once
    assert.equal(new Set(gp.map((f) => f.skill.style)).size, 10);
    const duels = new Set();
    for (let seed = 1; seed <= 40; seed++) duels.add(makeField({ mode: "duel", difficulty: "hard", seed })[0].skill.style);
    assert.ok(duels.size >= 7, `duel styles seen: ${duels.size}`);
    // the same style isn't the same driver twice
    let r = 1;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const a = makePersona("aggressor", rand);
    const b = makePersona("aggressor", rand);
    assert.notEqual(a.agg, b.agg);
    assert.notEqual(a.feint, b.feint);
    // and the level's pace values are left exactly as set
    const duel = makeField({ mode: "duel", difficulty: "hard", seed: 2 })[0].skill;
    assert.equal(duel.corner, DIFFICULTY.hard.corner);
    assert.equal(duel.brake, DIFFICULTY.hard.brake);
  });

  it("bots take their own lines through corners, and learn quicker ones as they go", () => {
    const race = createRace({ track, mode: "trial", seed: 4 });
    const car = race.cars[0];
    car.isPlayer = false;
    car.skill = { ...DIFFICULTY.hard, persona: { ...makePersona("wildcard", () => 0.5), explore: 1 } };
    race.player = null;
    for (let k = 0; k < 120 * 400 && car.lapTimes.length < 8; k++) stepRace(race, null, 1 / 120);
    const c = track.cornerAt.findIndex((x) => x >= 0);
    assert.notEqual(carLine(car, track, c + 30), track.line[c + 30]);
    assert.ok(car.lines.adopted > 0, "adopted no new lines");
  });

  it("mistakes: the lower levels make them (off the road, cuts, penalties), the top ones hardly ever", () => {
    const count = (difficulty) => {
      let mistakes = 0;
      let offs = 0;
      for (const seed of [3, 8, 13]) {
        const race = createRace({ track, mode: "demo", laps: 4, difficulty, seed });
        const seen = new Set();
        const was = new Map();
        for (let k = 0; k < 120 * 400 && !race.cars.every((x) => x.finished); k++) {
          stepRace(race, null, 1 / 120);
          for (const x of race.cars) {
            if (x.mistake && !seen.has(x.mistake)) seen.add(x.mistake);
            // an incident: off the road, or a big moment
            const bad = x.offTrack || x.cutGain > 0 || (x.oversteer || 0) > 0.35 || x.wallHit > 0;
            if (bad && !was.get(x)) offs++;
            was.set(x, bad);
          }
        }
        mistakes += seen.size;
        assert.ok(race.cars.every((x) => x.finished), `${difficulty}: a car never finished`);
      }
      return { mistakes, offs };
    };
    const noob = count("noob");
    const imp = count("impossible");
    assert.ok(noob.mistakes > imp.mistakes * 5, `noob ${noob.mistakes} vs impossible ${imp.mistakes}`);
    assert.ok(noob.offs > imp.offs, `incidents: noob ${noob.offs} vs impossible ${imp.offs}`);
  });

  it("car balance: understeer plants the rear, oversteer loosens it; neither end is free speed", () => {
    const corner = (balance, brake = 0) => {
      const car = makeCar("p", { name: "P", code: "P", color: "#fff" }, track.grid[0], { isPlayer: true });
      car.vx = Math.cos(car.heading) * 700;
      car.vy = Math.sin(car.heading) * 700;
      let over = 0;
      for (let k = 0; k < 60; k++) {
        stepCar(car, { throttle: brake ? 0 : 0.5, brake, steer: 1, balance }, track, 1 / 120);
        over = Math.max(over, car.oversteer || 0);
      }
      return over;
    };
    assert.ok(corner(1, 0.8) > corner(0, 0.8), "oversteer setting should step out more on the brakes");
    assert.ok(corner(-1, 0.8) <= corner(0, 0.8), "understeer setting should step out less");
    const lap = (balance) => {
      const race = createRace({ track, mode: "trial", seed: 3 });
      const car = race.player;
      for (let k = 0; k < 120 * 300 && car.lapTimes.length < 3; k++) {
        const inp = aiInput(car, race, 1 / 120);
        inp.balance = balance;
        stepRace(race, inp, 1 / 120);
      }
      return Math.min(...car.lapTimes.slice(1).map((l) => l.time));
    };
    const neutral = lap(0);
    assert.ok(lap(1) > neutral * 0.985, "full oversteer shouldn't be free speed");
    assert.ok(lap(-1) > neutral, "full understeer costs a little pace");
  });
});
