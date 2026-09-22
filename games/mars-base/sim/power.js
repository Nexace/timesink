import { structById } from "../data/structures.js";
import { daylight, stormFactor } from "./env.js";

// Union-find over structure tiles with 4-neighbour adjacency: every structure conducts.
export function computeGrids(g) {
  const w = g.world.w;
  const parent = new Map();
  const find = (a) => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = a;
    while (parent.get(c) !== r) {
      const n = parent.get(c);
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  for (const i of g.structs.keys()) parent.set(i, i);
  for (const i of g.structs.keys()) {
    const x = i % w;
    for (const n of [x < w - 1 ? i + 1 : -1, i + w]) {
      if (n >= 0 && parent.has(n)) {
        const a = find(i);
        const b = find(n);
        if (a !== b) parent.set(a, b);
      }
    }
  }
  const byRoot = new Map();
  for (const [i, st] of g.structs) {
    const r = find(i);
    let grid = byRoot.get(r);
    if (!grid) {
      grid = { id: byRoot.size, members: [], gens: [], cons: [], batteries: [], gen: 0, demand: 0, stored: 0, cap: 0, brownout: false, lifeBrownout: false };
      byRoot.set(r, grid);
    }
    grid.members.push(i);
    const def = structById(st.id);
    if (def.power > 0) grid.gens.push(i);
    else if (def.power < 0) grid.cons.push(i);
    if (def.store) grid.batteries.push(i);
    st.grid = grid.id;
  }
  g.grids = [...byRoot.values()];
  for (const grid of g.grids) {
    grid.cons.sort((a, b) => (structById(g.structs.get(a).id).prio ?? 5) - (structById(g.structs.get(b).id).prio ?? 5));
  }
  g.dirtyGrids = false;
}

export function genOutput(g, st, def) {
  if (st.broken) return 0;
  if (def.solar) return def.power * daylight(g.s.tick) * (1 - (st.dust ?? 0)) * stormFactor(g);
  return def.power;
}

// dt in seconds. isActive(st, def) decides whether a consumer wants power this second.
export function updatePower(g, dt, isActive) {
  for (const grid of g.grids) {
    let gen = 0;
    for (const i of grid.gens) {
      const st = g.structs.get(i);
      gen += genOutput(g, st, structById(st.id));
    }
    let stored = 0;
    let cap = 0;
    for (const i of grid.batteries) {
      const st = g.structs.get(i);
      stored += st.charge;
      cap += structById(st.id).store;
    }
    let budget = gen * dt + stored;
    let used = 0;
    let demand = 0;
    grid.brownout = false;
    grid.lifeBrownout = false;
    for (const i of grid.cons) {
      const st = g.structs.get(i);
      const def = structById(st.id);
      if (st.broken || !isActive(st, def)) {
        st.powered = false;
        st.active = false;
        continue;
      }
      st.active = true;
      const need = -def.power * dt;
      demand += -def.power;
      if (budget >= need) {
        budget -= need;
        used += need;
        st.powered = true;
      } else {
        st.powered = false;
        grid.brownout = true;
        if ((def.prio ?? 5) === 0) grid.lifeBrownout = true;
      }
    }
    // Settle batteries: surplus charges, deficit drains evenly.
    let net = gen * dt - used;
    if (grid.batteries.length) {
      if (net > 0) {
        for (const i of grid.batteries) {
          const st = g.structs.get(i);
          const room = structById(st.id).store - st.charge;
          const add = Math.min(room, net / grid.batteries.length + 0);
          st.charge += add;
        }
      } else if (net < 0) {
        let need = -net;
        for (let pass = 0; pass < 3 && need > 1e-9; pass += 1) {
          const withCharge = grid.batteries.map((i) => g.structs.get(i)).filter((s) => s.charge > 0);
          if (!withCharge.length) break;
          const share = need / withCharge.length;
          for (const st of withCharge) {
            const take = Math.min(st.charge, share);
            st.charge -= take;
            need -= take;
          }
        }
      }
    }
    stored = 0;
    for (const i of grid.batteries) stored += g.structs.get(i).charge;
    grid.gen = gen;
    grid.demand = demand;
    grid.stored = stored;
    grid.cap = cap;
  }
}

// Recompute grid totals from the stored per-structure flags (used right after loading a save).
export function refreshGridStats(g) {
  for (const grid of g.grids) {
    let gen = 0;
    let demand = 0;
    let stored = 0;
    let cap = 0;
    for (const i of grid.gens) {
      const st = g.structs.get(i);
      gen += genOutput(g, st, structById(st.id));
    }
    for (const i of grid.cons) {
      const st = g.structs.get(i);
      if (st.active) demand += -structById(st.id).power;
    }
    for (const i of grid.batteries) {
      const st = g.structs.get(i);
      stored += st.charge;
      cap += structById(st.id).store;
    }
    Object.assign(grid, { gen, demand, stored, cap });
  }
}
