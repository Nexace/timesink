import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CIRCUITS, fitCircuit, cornerRadii } from "./circuits.js";

describe("Ghost Lap real F1 circuits", () => {
  it("ships all 24 calendar layouts", () => {
    assert.equal(Object.keys(CIRCUITS).length, 24);
  });

  it("fits every circuit inside the stage margin with evenly spaced points", () => {
    for (const [key, c] of Object.entries(CIRCUITS)) {
      const path = fitCircuit(c.pts, 1760, 800, 72, 8);
      assert.ok(path.length > 300, `${key} too coarse`);
      for (const [x, y] of path) {
        assert.ok(x >= 56 && x <= 1704 && y >= 56 && y <= 744, `${key} point out of bounds`);
      }
      for (let i = 1; i < path.length; i++) {
        const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
        assert.ok(d > 5.5 && d < 8.2, `${key} spacing ${d}`);
      }
    }
  });

  it("finds tight corners but treats straights as straight", () => {
    const path = fitCircuit(CIRCUITS.monza.pts, 1760, 800, 72, 8);
    const r = cornerRadii(path, 3);
    assert.ok(Math.min(...r) < 60, "Monza chicanes should be tight");
    assert.ok(r.filter((x) => x > 1000).length > path.length * 0.3, "Monza is mostly straights");
  });
});
