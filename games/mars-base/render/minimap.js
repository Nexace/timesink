import { MINI, hex } from "./palette.js";

const LABELLED = new Set(["hab", "wreck", "rtg", "lander", "mav", "tube"]);
const POI_COLORS = { hab: "#ffcf4a", wreck: "#a8a8b0", rtg: "#ff7a1a", lander: "#9ee6ff", mav: "#f4f4f0", tube: "#b06adf", cache: "#58c070", science: "#b06adf" };

// Renders the explored world into an ImageData-backed canvas (1 px per tile), cached until dirty.
export function createMinimap() {
  let base = null;
  let dirty = true;

  function rebuild(g) {
    const { w, h, terrain, nodes } = g.world;
    if (!base) {
      base = document.createElement("canvas");
      base.width = w;
      base.height = h;
    }
    const bctx = base.getContext("2d");
    const img = bctx.createImageData(w, h);
    const rgb = MINI.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
    for (let i = 0; i < w * h; i += 1) {
      const o = i * 4;
      if (!g.explored[i]) {
        img.data[o] = 8;
        img.data[o + 1] = 5;
        img.data[o + 2] = 6;
        img.data[o + 3] = 255;
        continue;
      }
      let [r, gg, b] = rgb[terrain[i]] ?? [180, 90, 50];
      if (nodes[i]) {
        r = Math.min(255, r + 30);
        gg = Math.min(255, gg + 30);
        b = Math.min(255, b + 30);
      }
      if (g.structs.has(i)) {
        r = 230;
        gg = 230;
        b = 225;
      }
      img.data[o] = r;
      img.data[o + 1] = gg;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
    dirty = false;
  }

  function markDirty() {
    dirty = true;
  }

  // Draws a window of the map centred on the player (local) or the full map.
  function draw(g, canvas, { full = false, radius = 64, blink = false } = {}) {
    if (dirty || !base) rebuild(g);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.fillStyle = "#080506";
    ctx.fillRect(0, 0, cw, ch);
    const p = g.s.player;
    const { w, h } = g.world;
    let sx;
    let sy;
    let sw;
    let sh;
    if (full) {
      sx = 0;
      sy = 0;
      sw = w;
      sh = h;
    } else {
      sw = radius * 2;
      sh = radius * 2;
      sx = Math.round(p.x - radius);
      sy = Math.round(p.y - radius);
    }
    ctx.drawImage(base, sx, sy, sw, sh, 0, 0, cw, ch);
    const kx = cw / sw;
    const ky = ch / sh;
    const toC = (x, y) => ({ x: (x - sx) * kx, y: (y - sy) * ky });

    // POIs (only once discovered)
    for (const poi of g.world.pois) {
      if (!g.explored[poi.y * w + poi.x]) continue;
      if (poi.kind === "cache" && !g.world.nodes[poi.y * w + poi.x]) continue;
      const o = toC(poi.x + 0.5, poi.y + 0.5);
      const r = full ? 3 : 2;
      ctx.fillStyle = "#000";
      ctx.fillRect(Math.round(o.x - r - 1), Math.round(o.y - r - 1), r * 2 + 2, r * 2 + 2);
      ctx.fillStyle = POI_COLORS[poi.kind] ?? "#fff";
      ctx.fillRect(Math.round(o.x - r), Math.round(o.y - r), r * 2, r * 2);
      if (full && LABELLED.has(poi.kind)) {
        ctx.font = "7px 'Press Start 2P', monospace";
        const label = poi.name.toUpperCase();
        const lx = Math.round(Math.min(o.x + 6, cw - ctx.measureText(label).width - 2));
        ctx.fillStyle = "#000";
        ctx.fillText(label, lx + 1, Math.round(o.y + 4));
        ctx.fillStyle = "#f4f4f0";
        ctx.fillText(label, lx, Math.round(o.y + 3));
      }
    }
    // Objective target always shown (even undiscovered) as a pulsing ring
    const target = g._objectiveTarget;
    if (target) {
      const o = toC(target.x + 0.5, target.y + 0.5);
      ctx.strokeStyle = blink ? "#ffcf4a" : "#ff7a1a";
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(o.x) - 4.5, Math.round(o.y) - 4.5, 9, 9);
    }
    // Beacons
    for (const b of g.s.beacons) {
      const o = toC(b.x + 0.5, b.y + 0.5);
      ctx.fillStyle = hex(2);
      ctx.fillRect(Math.round(o.x) - 1, Math.round(o.y) - 3, 1, 5);
      ctx.fillRect(Math.round(o.x), Math.round(o.y) - 3, 2, 2);
      if (full && b.label) {
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.fillStyle = "#e8483a";
        ctx.fillText(b.label, Math.round(o.x + 4), Math.round(o.y));
      }
    }
    // Rover
    const rv = g.s.rover;
    const ro = toC(rv.x, rv.y);
    ctx.fillStyle = "#6ec8f0";
    ctx.fillRect(Math.round(ro.x) - 2, Math.round(ro.y) - 2, 4, 4);
    // Colonists
    ctx.fillStyle = "#cfd3da";
    for (const c of g.s.colonists) {
      if (!c.alive) continue;
      const o = toC(c.x, c.y);
      ctx.fillRect(Math.round(o.x), Math.round(o.y), 1, 1);
    }
    // Player
    const po = toC(p.x, p.y);
    ctx.fillStyle = blink ? "#ffffff" : "#ff7a1a";
    ctx.fillRect(Math.round(po.x) - 2, Math.round(po.y) - 2, 4, 4);
    ctx.fillStyle = "#000";
    ctx.fillRect(Math.round(po.x) - 1, Math.round(po.y) - 1, 2, 2);
    return { sx, sy, kx, ky };
  }

  return { draw, markDirty };
}
