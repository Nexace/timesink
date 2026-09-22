import { structById } from "../data/structures.js";
import { TERRAIN } from "../data/tiles.js";
import { ROOM } from "../data/balance.js";

const SEED_FLAGS = (def) => def.floor || def.interior || def.planter || def.bunk;

function sealsTile(g, i) {
  const st = g.structs.get(i);
  if (st) {
    const def = structById(st.id);
    if (def.seals && !(def.door && st.broken)) return true;
    return false;
  }
  return TERRAIN[g.world.terrain[i]].solid; // natural rock walls hold pressure
}

// Recompute pressurized rooms. Keeps atmosphere values by tile-weighted averaging from old rooms.
export function computeRooms(g, outsideTemp) {
  const { w, h } = g.world;
  const oldRoomOf = g.roomOf;
  const oldRooms = g.rooms;
  const roomOf = new Int32Array(w * h).fill(-1);
  const rooms = [];
  const stack = [];

  for (const [i, st] of g.structs) {
    if (roomOf[i] !== -1) continue;
    const def = structById(st.id);
    if (!SEED_FLAGS(def)) continue;
    if (def.seals && !(def.door && st.broken)) continue;
    const id = rooms.length;
    const room = { id, tiles: [], sealed: true, o2: 0, temp: outsideTemp, glass: false, people: 0, heatBuf: 0 };
    rooms.push(room);
    roomOf[i] = id;
    stack.length = 0;
    stack.push(i);
    while (stack.length) {
      const c = stack.pop();
      room.tiles.push(c);
      if (room.tiles.length > ROOM.maxTiles) room.sealed = false;
      const x = c % w;
      const y = (c - x) / w;
      const nbs = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1];
      for (const n of nbs) {
        if (n < 0) {
          room.sealed = false;
          continue;
        }
        if (roomOf[n] !== -1) continue;
        const nst = g.structs.get(n);
        if (nst && structById(nst.id).glass) room.glass = true;
        if (sealsTile(g, n)) continue;
        if (!nst) {
          room.sealed = false; // open to the outside
          continue;
        }
        roomOf[n] = id;
        stack.push(n);
      }
    }
    // Carry over atmosphere.
    let o2 = 0;
    let temp = 0;
    for (const t of room.tiles) {
      const old = oldRoomOf && oldRooms ? oldRoomOf[t] : -1;
      if (old >= 0 && oldRooms[old]) {
        o2 += oldRooms[old].o2;
        temp += oldRooms[old].temp;
      } else {
        temp += outsideTemp;
      }
    }
    room.o2 = o2 / room.tiles.length;
    room.temp = temp / room.tiles.length;
  }

  // Apply persisted atmospheres (after a load) once.
  if (g.s.atmos?.length && !oldRooms) {
    for (const a of g.s.atmos) {
      const r = roomOf[a.at];
      if (r >= 0) {
        rooms[r].o2 = a.o2;
        rooms[r].temp = a.temp;
      }
    }
  }

  g.rooms = rooms;
  g.roomOf = roomOf;
  g.dirtyRooms = false;
}

export function roomAtTile(g, x, y) {
  if (!g.roomOf) return null;
  if (x < 0 || y < 0 || x >= g.world.w || y >= g.world.h) return null;
  const r = g.roomOf[y * g.world.w + x];
  return r >= 0 ? g.rooms[r] : null;
}

export function isBreathable(room) {
  return Boolean(room && room.sealed && room.o2 >= ROOM.breathableFrac);
}

export function snapshotAtmos(g) {
  if (!g.rooms) return g.s.atmos;
  return g.rooms.filter((r) => r.tiles.length).map((r) => ({ at: r.tiles[0], o2: r.o2, temp: r.temp }));
}
