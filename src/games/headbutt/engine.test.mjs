import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CARS, CAR_KEYS, ARENAS, ARENA_KEYS, BOTS, contactOutcome, hazardOutcome, resolveRound, matchWinner, mirrorCar, ownerOf, isHead, WINS_NEEDED } from "./data.js";

const polyArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};
const isConvex = (pts) => {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const [cx, cy] = pts[(i + 2) % pts.length];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (cross !== 0) {
      if (sign && Math.sign(cross) !== sign) return false;
      sign = Math.sign(cross);
    }
  }
  return true;
};

describe("Headbutt cars", () => {
  it("ships 8 cars with convex parts, wheels under the body and a helmet on top", () => {
    assert.equal(CAR_KEYS.length, 8);
    for (const [key, c] of Object.entries(CARS)) {
      for (const p of c.parts) if (p.poly) assert.ok(isConvex(p.poly) && Math.abs(polyArea(p.poly)) > 50, `${key} poly`);
      assert.ok(c.wheels.length >= 2, `${key} wheels`);
      const bodyBottom = Math.max(...c.parts.map((p) => (p.rect ? p.rect[1] + p.rect[3] / 2 : Math.max(...p.poly.map((v) => v[1])))));
      for (const w of c.wheels) assert.ok(w.y + w.r > bodyBottom, `${key} wheels reach below the body`);
      assert.ok(c.head.y < Math.min(...c.wheels.map((w) => w.y - w.r)), `${key} head sits above the wheels`);
      for (const s of Object.values(c.stats)) assert.ok(s >= 0 && s <= 1);
    }
  });

  it("mirrors a car to face left without changing its shape", () => {
    const m = mirrorCar(CARS.hotrod);
    assert.equal(m.head.x, -CARS.hotrod.head.x);
    assert.equal(m.wheels[0].x, -CARS.hotrod.wheels[0].x);
    const poly = CARS.hotrod.parts[1].poly;
    assert.ok(Math.abs(Math.abs(polyArea(m.parts[1].poly)) - Math.abs(polyArea(poly))) < 1e-9);
    assert.ok(isConvex(m.parts[1].poly));
  });
});

describe("Headbutt arenas", () => {
  it("ships 8 originals plus the 23 Drive Ahead classics, each with two on-screen spawns and a sudden-death rule", () => {
    assert.equal(ARENA_KEYS.length, 31);
    assert.equal(ARENA_KEYS.filter((k) => ARENAS[k].section === "classic").length, 23);
    for (const [key, a] of Object.entries(ARENAS)) {
      assert.equal(a.spawns.length, 2, key);
      for (const s of a.spawns) assert.ok(s.x > 100 && s.x < 1180 && s.y > 100 && s.y < 700, `${key} spawn`);
      assert.ok(a.spawns[0].x < a.spawns[1].x, `${key} left/right spawns`);
      assert.ok(["crusher", "lava", "flood", "acid", "saws"].includes(a.overtime), key);
      if (a.overtime === "flood" || a.overtime === "acid") assert.ok(a.liquid, `${key} needs a liquid to raise`);
      if (a.liquid) assert.ok(["water", "acid"].includes(a.liquid.kind), key);
      assert.ok(a.gravity > 0 && a.friction > 0, key);
      for (const s of a.solids) if (s.poly) assert.ok(isConvex(s.poly), `${key} solid convex`);
    }
    assert.ok(ARENAS.moon.gravity < 0.5, "the moon has low gravity");
    assert.ok(ARENAS.ice.friction < 0.1, "the rink is slippery");
  });

  it("sawblades and meteors only count when they hit a helmet", () => {
    assert.deepEqual(contactOutcome("p0_head", "saw"), { loser: 0, by: "saw" });
    assert.deepEqual(contactOutcome("meteor", "p1_head"), { loser: 1, by: "meteor" });
    assert.equal(contactOutcome("p0_body", "saw"), null);
    assert.equal(hazardOutcome("p0_wheel", "saw"), null);
  });

  it("bot levels get faster and sharper", () => {
    const order = ["easy", "normal", "hard", "insane"].map((k) => BOTS[k]);
    for (let i = 1; i < order.length; i++) {
      assert.ok(order[i].reaction < order[i - 1].reaction);
      assert.ok(order[i].noise < order[i - 1].noise);
    }
  });
});

describe("Headbutt rules", () => {
  it("reads owners and heads from part labels", () => {
    assert.equal(ownerOf("p0_body"), 0);
    assert.equal(ownerOf("p1_wheel"), 1);
    assert.equal(ownerOf("world"), -1);
    assert.ok(isHead("p1_head"));
    assert.ok(!isHead("p1_body"));
  });

  it("a car touching the other driver's helmet knocks that driver out", () => {
    assert.deepEqual(contactOutcome("p1_head", "p0_body"), { loser: 1, by: "car" });
    assert.deepEqual(contactOutcome("p0_wheel", "p1_head"), { loser: 1, by: "car" });
    assert.deepEqual(contactOutcome("p0_head", "p1_head"), { loser: 0, by: "car" });
    assert.equal(contactOutcome("p0_head", "world"), null, "your own helmet on the floor is fine");
    assert.equal(contactOutcome("p0_head", "p0_body"), null);
  });

  it("hazards knock out whoever touches them", () => {
    assert.deepEqual(hazardOutcome("hazard", "p0_wheel"), { loser: 0, by: "hazard" });
    assert.deepEqual(hazardOutcome("p1_body", "hazard"), { loser: 1, by: "hazard" });
    assert.equal(hazardOutcome("hazard", "world"), null);
  });

  it("resolves a step's knockouts, including a double K.O.", () => {
    assert.equal(resolveRound([]), null);
    assert.deepEqual(resolveRound([{ loser: 1 }]), { winner: 0, loser: 1 });
    assert.deepEqual(resolveRound([{ loser: 0 }, { loser: 0 }]), { winner: 1, loser: 0 });
    assert.deepEqual(resolveRound([{ loser: 0 }, { loser: 1 }]), { draw: true });
  });

  it("first to five takes the match", () => {
    assert.equal(WINS_NEEDED, 5);
    assert.equal(matchWinner([4, 4]), -1);
    assert.equal(matchWinner([5, 3]), 0);
    assert.equal(matchWinner([2, 5]), 1);
  });
});
