import { TS, makeCanvas, drawStruct, hash, buildAssets } from "./sprites.js";
import { hex } from "./palette.js";
import { CHUNK } from "../data/balance.js";
import { structById } from "../data/structures.js";
import { itemById } from "../data/items.js";
import { NODES } from "../data/tiles.js";
import { daylight } from "../sim/env.js";

const SEAL_IDS = new Set(["wall", "rwall", "glass-wall", "airlock"]);

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const assets = buildAssets();
  const chunks = new Map();
  let W = 480;
  let H = 270;
  let scale = 3;
  const light = makeCanvas(W, H);
  const cam = { x: 0, y: 0, shake: 0, init: false };
  const particles = [];
  let reduceMotion = false;
  const dither = makeCanvas(TS, TS);
  dither.ctx.fillStyle = "rgba(5,3,3,0.85)";
  for (let py = 0; py < TS; py += 1) for (let pxx = py % 2; pxx < TS; pxx += 2) dither.ctx.fillRect(pxx, py, 1, 1);

  function resize(cssW, cssH, zoom) {
    scale = Math.max(1, zoom);
    W = Math.max(160, Math.ceil(cssW / scale));
    H = Math.max(120, Math.ceil(cssH / scale));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    light.c.width = W;
    light.c.height = H;
    ctx.imageSmoothingEnabled = false;
  }

  function setReducedMotion(v) {
    reduceMotion = v;
  }

  function chunkCanvas(g, cx, cy) {
    const key = `${cx},${cy}`;
    let ch = chunks.get(key);
    if (ch) return ch;
    const size = CHUNK * TS;
    const { c, ctx: cc } = makeCanvas(size, size);
    const { w, h, terrain, nodes } = g.world;
    for (let ty = 0; ty < CHUNK; ty += 1) {
      for (let tx = 0; tx < CHUNK; tx += 1) {
        const x = cx * CHUNK + tx;
        const y = cy * CHUNK + ty;
        if (x >= w || y >= h) continue;
        const i = y * w + x;
        const t = terrain[i];
        const v = Math.floor(hash(x, y, 7) * 4);
        cc.drawImage(assets.terrain[t][v], tx * TS, ty * TS);
        // Cliff shading: a darker lip where solid terrain meets open ground below.
        if ((t === 4 || t === 5) && y + 1 < h && terrain[i + w] !== t && terrain[i + w] !== 4 && terrain[i + w] !== 5) {
          cc.fillStyle = hex(t === 5 ? 1 : 24);
          cc.fillRect(tx * TS, ty * TS + TS - 3, TS, 3);
        }
        const n = nodes[i];
        if (n && assets.nodes[n]) cc.drawImage(assets.nodes[n], tx * TS, ty * TS);
      }
    }
    ch = c;
    chunks.set(key, ch);
    return ch;
  }

  function invalidate(g) {
    if (!g.dirtyChunks.size) return;
    for (const k of g.dirtyChunks) chunks.delete(k);
    g.dirtyChunks.clear();
  }

  function resetCache() {
    chunks.clear();
    cam.init = false;
  }

  function nbOf(g, st) {
    const w = g.world.w;
    const i = st.y * w + st.x;
    const get = (j) => g.structs.get(j);
    const same = (o) => {
      if (!o) return false;
      if (st.id === "cable") return true; // cables connect to anything
      if (SEAL_IDS.has(st.id)) return SEAL_IDS.has(o.id);
      return o.id === st.id;
    };
    return { l: same(get(i - 1)), r: same(get(i + 1)), u: same(get(i - w)), d: same(get(i + w)) };
  }

  function worldToScreen(x, y) {
    return { x: Math.round(x * TS - cam.px), y: Math.round(y * TS - cam.py) };
  }

  function screenToWorld(sx, sy) {
    // sx/sy in CSS pixels relative to the canvas
    return { x: (sx / scale + cam.px) / TS, y: (sy / scale + cam.py) / TS };
  }

  function emit(kind, x, y, n = 8) {
    if (reduceMotion && kind !== "impact") n = Math.ceil(n / 3);
    const palette = {
      dust: [7, 8, 6],
      spark: [10, 30, 20],
      ice: [12, 15, 23],
      smoke: [18, 27, 3],
      fire: [20, 10, 2],
      green: [13, 29, 15],
      steam: [15, 28, 12],
    }[kind] ?? [15];
    for (let k = 0; k < n; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = (kind === "fire" ? 3 : 1.4) * (0.4 + Math.random());
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === "smoke" || kind === "steam" ? 0.8 : 0),
        life: 0.4 + Math.random() * (kind === "smoke" ? 1.2 : 0.5),
        c: palette[k % palette.length],
        s: kind === "fire" || kind === "smoke" ? 2 : 1,
      });
    }
    if (particles.length > 600) particles.splice(0, particles.length - 600);
  }

  function shake(amount) {
    if (reduceMotion) return;
    cam.shake = Math.max(cam.shake, amount);
  }

  function draw(g, view, dt, now) {
    invalidate(g);
    const s = g.s;
    const p = s.player;
    const target = p.inRover ? { x: s.rover.x, y: s.rover.y } : { x: p.x, y: p.y };
    if (!cam.init) {
      cam.x = target.x;
      cam.y = target.y;
      cam.init = true;
    }
    const lerpK = 1 - Math.pow(0.0005, dt);
    cam.x += (target.x - cam.x) * lerpK;
    cam.y += (target.y - cam.y) * lerpK;
    let sx = 0;
    let sy = 0;
    if (cam.shake > 0) {
      sx = (Math.random() * 2 - 1) * cam.shake;
      sy = (Math.random() * 2 - 1) * cam.shake;
      cam.shake = Math.max(0, cam.shake - dt * 12);
    }
    cam.px = Math.round(cam.x * TS - W / 2 + sx);
    cam.py = Math.round(cam.y * TS - H / 2 + sy);

    ctx.fillStyle = "#050303";
    ctx.fillRect(0, 0, W, H);

    // Terrain chunks
    const size = CHUNK * TS;
    const cx0 = Math.max(0, Math.floor(cam.px / size));
    const cy0 = Math.max(0, Math.floor(cam.py / size));
    const cx1 = Math.min(Math.ceil(g.world.w / CHUNK) - 1, Math.floor((cam.px + W) / size));
    const cy1 = Math.min(Math.ceil(g.world.h / CHUNK) - 1, Math.floor((cam.py + H) / size));
    for (let cy = cy0; cy <= cy1; cy += 1) {
      for (let cx = cx0; cx <= cx1; cx += 1) {
        ctx.drawImage(chunkCanvas(g, cx, cy), cx * size - cam.px, cy * size - cam.py);
      }
    }

    const tx0 = Math.floor(cam.px / TS) - 1;
    const ty0 = Math.floor(cam.py / TS) - 1;
    const tx1 = Math.ceil((cam.px + W) / TS) + 1;
    const ty1 = Math.ceil((cam.py + H) / TS) + 1;
    const visible = (x, y) => x >= tx0 && x <= tx1 && y >= ty0 && y <= ty1;

    // Node damage cracks
    if (p.mining && !p.mining.decon) {
      const i = p.mining.i;
      const mx = i % g.world.w;
      const my = (i - mx) / g.world.w;
      const n = g.world.nodes[i];
      if (n) {
        const frac = 1 - g.world.nodeHp[i] / NODES[n].hp;
        const o = worldToScreen(mx, my);
        ctx.fillStyle = hex(1);
        const cracks = Math.floor(frac * 6);
        for (let k = 0; k < cracks; k += 1) ctx.fillRect(o.x + 3 + ((k * 5) % 10), o.y + 4 + ((k * 3) % 8), 3, 1);
      }
    }

    // Structures
    const t = now / 1000;
    for (const st of g.structs.values()) {
      if (!visible(st.x, st.y)) continue;
      const o = worldToScreen(st.x, st.y);
      const def = structById(st.id);
      const extra = {};
      if (def.store) extra.charge = st.charge / def.store;
      if (def.water) extra.water = st.water / def.water;
      drawStruct(ctx, st, o.x, o.y, t, nbOf(g, st), extra);
    }

    // Leak outlines: unsealed rooms get a blinking red frame
    if (g.rooms && Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = hex(2);
      for (const r of g.rooms) {
        if (r.sealed) continue;
        for (const ti of r.tiles) {
          const x = ti % g.world.w;
          const y = (ti - x) / g.world.w;
          if (!visible(x, y)) continue;
          const o = worldToScreen(x, y);
          ctx.fillRect(o.x + 6, o.y + 6, 4, 4);
        }
      }
    }

    // Ground drops
    for (const d of s.drops) {
      if (!visible(Math.floor(d.x), Math.floor(d.y))) continue;
      const o = worldToScreen(d.x, d.y);
      const bob = reduceMotion ? 0 : Math.round(Math.sin(t * 4 + d.x) * 1);
      ctx.fillStyle = hex(1);
      ctx.fillRect(o.x - 3, o.y + 2, 6, 1);
      ctx.fillStyle = hex(itemById(d.id)?.color ?? 14);
      ctx.fillRect(o.x - 2, o.y - 3 + bob, 4, 4);
      ctx.fillStyle = hex(15);
      ctx.fillRect(o.x - 2, o.y - 3 + bob, 1, 1);
    }

    // Meteor warning zones
    for (const ev of s.events.scheduled) {
      if (ev.id !== "meteor" || !ev.warned) continue;
      const o = worldToScreen(ev.x + 0.5, ev.y + 0.5);
      const r = 4.5 * TS;
      ctx.strokeStyle = Math.floor(t * 4) % 2 ? hex(2) : hex(10);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(232,72,58,0.12)";
      ctx.fill();
    }

    // Entities, y-sorted
    const ents = [];
    if (!p.inRover && s.status !== "dead") ents.push({ y: p.y, draw: () => drawAstro(assets.player, p, t) });
    for (const c of s.colonists) {
      if (!c.alive || !visible(Math.floor(c.x), Math.floor(c.y))) continue;
      ents.push({ y: c.y, draw: () => drawAstro(c.id % 2 ? assets.colonistAlt : assets.colonist, c, t, true) });
    }
    ents.push({ y: s.rover.y, draw: () => drawRover(s.rover) });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    // Mining / deconstruct progress
    if (p.mining && !p.mining.blocked) {
      const i = p.mining.i;
      const mx = i % g.world.w;
      const my = (i - mx) / g.world.w;
      const o = worldToScreen(mx, my);
      const max = p.mining.decon ? 1.5 : 0.9;
      const frac = Math.min(1, p.mining.t / max);
      ctx.fillStyle = hex(1);
      ctx.fillRect(o.x + 1, o.y - 4, 14, 3);
      ctx.fillStyle = hex(p.mining.decon ? 2 : 10);
      ctx.fillRect(o.x + 2, o.y - 3, Math.round(12 * frac), 1);
    }

    // Build ghost / aim cursor
    if (view.ghost) {
      const o = worldToScreen(view.ghost.x, view.ghost.y);
      ctx.globalAlpha = 0.6;
      drawStruct(ctx, { id: view.ghost.id, x: view.ghost.x, y: view.ghost.y }, o.x, o.y, t, { l: false, r: false, u: false, d: false }, {});
      ctx.globalAlpha = 1;
      ctx.strokeStyle = view.ghost.ok ? hex(13) : hex(2);
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, TS - 1, TS - 1);
    } else if (view.cursor) {
      const o = worldToScreen(view.cursor.x, view.cursor.y);
      ctx.strokeStyle = view.cursor.inReach ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.22)";
      const L = 4;
      ctx.beginPath();
      for (const [ax, ay, dx, dy] of [[0, 0, 1, 1], [TS, 0, -1, 1], [0, TS, 1, -1], [TS, TS, -1, -1]]) {
        ctx.moveTo(o.x + ax + 0.5 * dx, o.y + ay + (L + 0.5) * dy);
        ctx.lineTo(o.x + ax + 0.5 * dx, o.y + ay + 0.5 * dy);
        ctx.lineTo(o.x + ax + (L + 0.5) * dx, o.y + ay + 0.5 * dy);
      }
      ctx.stroke();
    }

    // Scanner highlights
    const scanFx = view.scan;
    if (scanFx && s.tick < scanFx.until) {
      const age = (scanFx.until - s.tick) / (20 * 25);
      ctx.globalAlpha = Math.min(1, age * 2);
      for (let y = Math.floor(scanFx.y - scanFx.r); y <= scanFx.y + scanFx.r; y += 1) {
        for (let x = Math.floor(scanFx.x - scanFx.r); x <= scanFx.x + scanFx.r; x += 1) {
          if (!visible(x, y) || x < 0 || y < 0 || x >= g.world.w || y >= g.world.h) continue;
          const n = g.world.nodes[y * g.world.w + x];
          if (!n || !NODES[n].scan) continue;
          const o = worldToScreen(x, y);
          ctx.strokeStyle = hex(n === 3 ? 12 : n === 1 ? 14 : n === 4 ? 10 : n === 9 ? 16 : 13);
          ctx.strokeRect(o.x + 0.5, o.y + 0.5, TS - 1, TS - 1);
        }
      }
      ctx.globalAlpha = 1;
      const o = worldToScreen(scanFx.x, scanFx.y);
      const ringR = ((1 - age) * 3 % 1) * scanFx.r * TS;
      ctx.strokeStyle = "rgba(158,230,255,0.5)";
      ctx.beginPath();
      ctx.arc(o.x, o.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Particles
    for (let k = particles.length - 1; k >= 0; k -= 1) {
      const q = particles[k];
      q.life -= dt;
      if (q.life <= 0) {
        particles.splice(k, 1);
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.96;
      q.vy *= 0.96;
      const o = worldToScreen(q.x, q.y);
      ctx.fillStyle = hex(q.c);
      ctx.fillRect(o.x, o.y, q.s, q.s);
    }

    // Day/night tint + darkness with light cutouts
    const dl = daylight(s.tick);
    const storm = s.events.active.some((e) => e.id === "dust-storm");
    if (dl < 0.55) {
      ctx.globalCompositeOperation = "multiply";
      const k = dl / 0.55;
      const r = Math.round(96 + (255 - 96) * k);
      const gg = Math.round(112 + (190 - 112) * k);
      const b = Math.round(176 + (150 - 176) * k);
      ctx.fillStyle = `rgb(${r},${gg},${b})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    const dark = Math.min(0.86, (1 - Math.min(1, dl * 2.2)) * 0.8 + (storm ? 0.25 : 0));
    if (dark > 0.02) {
      const lc = light.ctx;
      lc.globalCompositeOperation = "source-over";
      lc.clearRect(0, 0, W, H);
      lc.fillStyle = `rgba(4,3,12,${dark})`;
      lc.fillRect(0, 0, W, H);
      lc.globalCompositeOperation = "destination-out";
      const hole = (wx, wy, rTiles, strength = 1) => {
        const o = worldToScreen(wx, wy);
        const steps = [1, 0.72, 0.45];
        for (let k2 = 0; k2 < steps.length; k2 += 1) {
          lc.fillStyle = `rgba(0,0,0,${0.34 * strength})`;
          lc.beginPath();
          lc.arc(o.x, o.y, rTiles * TS * steps[k2], 0, Math.PI * 2);
          lc.fill();
        }
      };
      if (!p.inRover && p.power > 0) hole(p.x, p.y, 4.5);
      if (s.rover) {
        const rv = s.rover;
        hole(rv.x, rv.y, 2.5, 0.8);
        if (p.inRover && rv.battery > 0) hole(rv.x + Math.cos(rv.a) * 4, rv.y + Math.sin(rv.a) * 4, 4.5);
      }
      for (const c of s.colonists) if (c.alive && visible(Math.floor(c.x), Math.floor(c.y))) hole(c.x, c.y, 2.5, 0.7);
      lc.fillStyle = "rgba(0,0,0,0.75)";
      for (const st of g.structs.values()) {
        if (!visible(st.x, st.y)) continue;
        if (st.id === "lamp" && st.powered) hole(st.x + 0.5, st.y + 0.5, 6);
        else if (st.id === "growlamp" && st.powered) hole(st.x + 0.5, st.y + 0.5, 3.5, 0.8);
        else if (st.id === "reactor" || st.id === "rtg") hole(st.x + 0.5, st.y + 0.5, 1.8, 0.7);
        else if (structById(st.id).floor || structById(st.id).interior || st.id === "bunk") {
          const grid = g.grids?.[st.grid];
          if (grid && (grid.stored > 1 || grid.gen > 0.2)) {
            const o = worldToScreen(st.x, st.y);
            lc.fillRect(o.x, o.y, TS, TS);
          }
        }
      }
      lc.globalCompositeOperation = "source-over";
      ctx.drawImage(light.c, 0, 0);
    }

    // Storm haze and streaks
    if (storm) {
      ctx.fillStyle = "rgba(184,90,50,0.32)";
      ctx.fillRect(0, 0, W, H);
      if (!reduceMotion) {
        ctx.fillStyle = "rgba(240,178,122,0.55)";
        for (let k = 0; k < 90; k += 1) {
          const sx2 = (hash(k, 1, 3) * W + t * (180 + hash(k, 2, 3) * 120)) % W;
          const sy2 = (hash(k, 3, 3) * H + t * 30) % H;
          ctx.fillRect(Math.floor(sx2), Math.floor(sy2), 3, 1);
        }
      }
    }
    // Radiation event: green pulse
    if (s.events.active.some((e) => e.id === "spe")) {
      ctx.fillStyle = `rgba(200,224,74,${0.08 + (reduceMotion ? 0 : Math.abs(Math.sin(t * 2)) * 0.08)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Fog of war over unexplored tiles, dithered at the frontier
    ctx.fillStyle = "#050303";
    for (let y = ty0; y <= ty1; y += 1) {
      for (let x = tx0; x <= tx1; x += 1) {
        const out = x < 0 || y < 0 || x >= g.world.w || y >= g.world.h;
        if (!out && g.explored[y * g.world.w + x]) continue;
        const o = worldToScreen(x, y);
        ctx.fillRect(o.x, o.y, TS, TS);
      }
    }
    // dither the edge
    for (let y = ty0; y <= ty1; y += 1) {
      for (let x = tx0; x <= tx1; x += 1) {
        if (x < 1 || y < 1 || x >= g.world.w - 1 || y >= g.world.h - 1) continue;
        const i = y * g.world.w + x;
        if (!g.explored[i]) continue;
        const w = g.world.w;
        if (g.explored[i - 1] && g.explored[i + 1] && g.explored[i - w] && g.explored[i + w]) continue;
        const o = worldToScreen(x, y);
        ctx.drawImage(dither.c, o.x, o.y);
      }
    }
  }

  function drawAstro(set, e, t, colonist = false) {
    const frame = e.moving ? Math.floor(t * 8) % 2 : 0;
    const img = set[e.dir ?? 2][frame];
    const o = worldToScreen(e.x, e.y);
    ctx.fillStyle = "rgba(11,6,8,0.45)";
    ctx.fillRect(o.x - 4, o.y + 5, 8, 2);
    ctx.drawImage(img, o.x - 8, o.y - 11);
    if (colonist && e.working) {
      ctx.fillStyle = hex(10);
      if (Math.floor(t * 3) % 2) ctx.fillRect(o.x - 1, o.y - 15, 2, 2);
    }
  }

  function drawRover(rv) {
    const k = ((Math.round((rv.a / (Math.PI * 2)) * 16) % 16) + 16) % 16;
    const img = (rv.broken ? assets.roverBroken : assets.rover)[k];
    const o = worldToScreen(rv.x, rv.y);
    ctx.fillStyle = "rgba(11,6,8,0.4)";
    ctx.fillRect(o.x - 10, o.y + 6, 20, 3);
    ctx.drawImage(img, o.x - 16, o.y - 16);
  }

  return { resize, draw, screenToWorld, worldToScreen, emit, shake, resetCache, setReducedMotion, assets, get scale() { return scale; }, get size() { return { W, H }; } };
}
