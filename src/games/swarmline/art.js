/**
 * SWARMLINE — pixel art & crypt environment.
 * Every sprite is authored as character rows and rasterised once (see /src/core/gfx.js).
 */
import { sprite, tinted, makeCanvas, mulberry32, hash2, shade, rgba, glow } from "/src/core/gfx.js";

const S = 2; // sprite pixel scale

// ---------------------------------------------------------------- player
const WIZ_PAL = {
  O: "#7df9ff", o: "#00b8d4", T: "#8b5a2b", t: "#5a3a1a",
  H: "#7b2fd0", h: "#4a1a86", b: "#2e1054", g: "#ffd24a",
  S: "#f2c7a0", E: "#1a0f0a", B: "#eceaf4", R: "#8e3fe0", r: "#58218f", w: "#2a1a12"
};
const WIZ_A = [
  "...........oO...",
  "......HH...OO...",
  ".....HHHh...T...",
  "....HHHHhg..T...",
  "...HHHHHHh..T...",
  "..bbbbbbbbb.T...",
  "....SSSSS...T...",
  "....SESES..ST...",
  "....BBBBB..ST...",
  "...RRBBBRRRRT...",
  "..RRRRBRRRRr....",
  "..RgRRRRRRgr....",
  "..RRRRRRRRRr....",
  "..rRRRRRRRrr....",
  "...ww...ww......",
  "................"
];
const WIZ_B = [...WIZ_A.slice(0, 14), "....ww.ww.......", "................"];

// ---------------------------------------------------------------- enemies
const BAT_PAL = { K: "#3b0a17", k: "#1c040b", R: "#ff2d55", E: "#ffe066" };
const BAT_A = [
  "K..............K",
  "KK............KK",
  "KKk..........kKK",
  ".KKK..RkkR..KKK.",
  ".KKKKKKKKKKKKKK.",
  "..KKKKKEKEKKKK..",
  "....KKKKKKKK....",
  ".....KR..RK.....",
  "................"
];
const BAT_B = [
  "................",
  "................",
  "......RkkR......",
  "....KKKKKKKK....",
  "..KKKKKEKEKKKK..",
  ".KKKKKKKKKKKKKK.",
  "KKk...KKKK...kKK",
  "KK....R..R....KK",
  "K..............K"
];


// Skeleton archer: bone frame with a drawn bow and quiver
const ARCHER_PAL = { W: "#ece6d6", w: "#a79f8c", K: "#120b0b", R: "#6fd3ff", B: "#8a5a2b", b: "#5a3a1a", S: "#d9d9d9" };
const ARCHER_A = [
  "...WWWWWW...",
  "..WWWWWWWW..",
  "..WKKWWKKW..",
  "..WKRWWKRW.B",
  "..wWWKKWWwB.",
  "...WKWKWK.BS",
  "..b.wWWw..BS",
  ".bb.WwWWw.BS",
  ".bWWwWWwWWBS",
  ".b.wWwWWwWB.",
  "....WWWW..B.",
  "....W..W...B",
  "...WW..WW...",
  "...w....w..."
];
const ARCHER_B = [...ARCHER_A.slice(0, 11), "....W..W...B", "....WW.WW...", "....w...w..."];

// Hellhound: low, long, burning mane
const HOUND_PAL = { D: "#3a0d0d", d: "#1c0606", F: "#ff5a1f", f: "#ffb347", E: "#fff3a0", K: "#000000" };
const HOUND_A = [
  "..........FfF...",
  ".........FFDDF..",
  "..fF....FDDEDDK.",
  ".FFDDDDDDDDDDDDD",
  "FDDDDDDDDDDDDDd.",
  ".DDDDDDDDDDDDD..",
  ".dDD.dDD..DDd...",
  ".dD...dD..Dd....",
  ".d.....d..d....."
];
const HOUND_B = [
  "..........FfF...",
  ".........FFDDF..",
  "..fF....FDDEDDK.",
  ".FFDDDDDDDDDDDDD",
  "FDDDDDDDDDDDDDd.",
  ".DDDDDDDDDDDDD..",
  "..DDd.DDd.DDd...",
  "...Dd..Dd..Dd...",
  "....d...d...d..."
];

// Plague slime: wobbling gel with a floating skull inside
const SLIME_PAL = { G: "#8be04e", g: "#4e9a2a", H: "#d8ffb0", K: "#1a3a0c", W: "#e8f5d0" };
const SLIME_A = [
  "....GGGGGG....",
  "..GGHHGGGGGG..",
  ".GGHHGGGGGGGG.",
  ".GGGGWWWWGGGG.",
  "GGGGWKWWKWGGGG",
  "GGGGWWWWWWGGGG",
  "GGGGGWKKWGGGGg",
  "gGGGGGGGGGGGGg",
  ".gggGGGGGGggg.",
  "..gggggggggg.."
];
const SLIME_B = [
  "..............",
  "....GGGGGG....",
  "..GGHHGGGGGG..",
  ".GGHGGWWWWGGG.",
  "GGGGGWKWWKWGGG",
  "GGGGGWWWWWWGGG",
  "GGGGGGWKKWGGGg",
  "gGGGGGGGGGGGGg",
  "ggggGGGGGGgggg",
  ".gggggggggggg."
];

const SKEL_PAL = { W: "#ece6d6", w: "#a79f8c", K: "#120b0b", R: "#ff3b4a" };
const SKEL_A = [
  "...WWWWWW...",
  "..WWWWWWWW..",
  "..WKKWWKKW..",
  "..WKRWWKRW..",
  "..wWWKKWWw..",
  "...WKWKWK...",
  "....wWWw....",
  ".W.WwWWwW.W.",
  ".WWWwWWwWWW.",
  "..wWwWWwWw..",
  "....WWWW....",
  "....W..W....",
  "...WW..WW...",
  "...w....w..."
];
const SKEL_B = [...SKEL_A.slice(0, 11), "....W..W....", "....WW.WW...", "....w...w..."];

const GHOST_PAL = { P: "#c4a6ff", p: "#8b62f0", E: "#ffffff", K: "#1a0033" };
const GHOST_A = [
  "....PPPP....",
  "..PPPPPPPP..",
  ".PPPPPPPPPP.",
  ".PPEEPPEEPP.",
  ".PPEKPPEKPP.",
  "PPPPPPPPPPPP",
  "PPPPPKKPPPPP",
  "PPPPPKKPPPPP",
  "PPPPPPPPPPPP",
  "pPPPPPPPPPPp",
  "pPPPPPPPPPPp",
  "pPPpPPPpPPPp",
  "pP.pP.pPP.Pp",
  "p...p...p..."
];
const GHOST_B = [...GHOST_A.slice(0, 11), "pPPPpPPPpPPp", "Pp.PPp.pP.pP", ".p...p...p.p"];

const BLOAT_PAL = { G: "#66c93e", g: "#2f7a1f", Y: "#d8ff5c", K: "#0d1a06", r: "#b33d2e" };
const BLOAT_A = [
  ".....GGGG.....",
  "...GGGYGGGG...",
  "..GGGGGGGYGG..",
  ".GGYGGGGGGGGG.",
  ".GGGKKGGKKGGG.",
  "GGGGKKGGKKGGGY",
  "GGYGGGGGGGGGGG",
  "GGGGGrrrrrGGGG",
  "GGGGrKKKKKrGGG",
  ".GGGGrrrrrGYG.",
  ".gGGYGGGGGGGg.",
  "..gGGGGGGYGg..",
  "...ggGGGGgg...",
  ".....gggg....."
];
const BLOAT_B = [
  "....GGGGGG....",
  "..GGGGYGGGGG..",
  ".GGGGGGGGGYGG.",
  ".GGYGGGGGGGGG.",
  "GGGGKKGGGKKGGG",
  "GGGGKKGGGKKGGY",
  "GGYGGGGGGGGGGG",
  "GGGGGrrrrrrGGG",
  "GGGGrKKKKKKrGG",
  "GGGGGrrrrrrGYG",
  ".gGGYGGGGGGGg.",
  "..gGGGGGGYGg..",
  "...ggGGGGgg...",
  "....gggggg...."
];

const GOLEM_PAL = { S: "#8a93a3", s: "#555d6b", D: "#2c313a", Y: "#ffd24a", M: "#4d8a3f", L: "#b9c1cf" };
const GOLEM_A = [
  "....LSSSSSL.....",
  "...SSSSSSSSS....",
  "...SsDYYDsSS....",
  "...SSSSSSSSM....",
  ".SSSsSSSSSsSSS..",
  "SSMSSSsDsSSSSSS.",
  "SSSSSSSDSSSSMSS.",
  "SsSSSSSSSSSSSsS.",
  "SS.SSSMSSSSS.SS.",
  "Ss.SSSSSSsSS.sS.",
  "DD.SSsSSSSSS.DD.",
  "...SSSS.SSSS....",
  "...SsSS.SSsS....",
  "...SSSS.SSSS....",
  "..DDDD...DDDD...",
  "................"
];
const GOLEM_B = [...GOLEM_A.slice(0, 11), "...SSSS..SSSS...", "..SsSS...SSsS...", "..SSSS...SSSS...", ".DDDD.....DDDD..", "................"];

const NECRO_PAL = { R: "#2a0a3d", r: "#170420", V: "#b04cff", E: "#ff3bf0", K: "#07010a", W: "#e8e4d8", T: "#6b4a2b" };
const NECRO_A = [
  "......RRR.....W.",
  ".....RRRRR...WWW",
  "....RRKKKRR..WKW",
  "....RKEKEKR...T.",
  "....RKKKKKR...T.",
  "...RRRKKKRRR..T.",
  "..RRRRRRRRRRR.T.",
  "..RVRRRRRRRVRRT.",
  "..RRRRRRRRRRR.T.",
  "..RRRRRVRRRRR.T.",
  "..rRRRRRRRRRr.T.",
  "..rRRRRRRRRRr...",
  "..rrRRRRRRRrr...",
  "...rrrRRRrrr....",
  "....rr...rr.....",
  "................"
];
const NECRO_B = [...NECRO_A.slice(0, 13), "...rrRRRRRrr....", "...rr.....rr....", "................"];

// Bosses: a horned demon recoloured per boss, and the Red Death reaper
const DEMON = [
  "..H..............H..",
  "..HH............HH..",
  "...HH..MMMMMM..HH...",
  "....HMMMMMMMMMMH....",
  "....MMMMMMMMMMMM....",
  "...MMEEMMMMMMEEMM...",
  "...MMEYMMMMMMEYMM...",
  "...MMMMMMKKMMMMMM...",
  "....MMMKKKKKKMMM....",
  "..dMMMMKWKWKKMMMMd..",
  ".ddMMMMMMMMMMMMMMdd.",
  "dddMMMMMMMMMMMMMMddd",
  "dd.MMMMMmMMmMMMMM.dd",
  "d..MMMMMMMMMMMMMM..d",
  "...MMMmMMMMMMmMMM...",
  "...MMMMMMMMMMMMMM...",
  "....MMMMM..MMMMM....",
  "....MMMM....MMMM....",
  "...ddddd....ddddd...",
  "...................."
];
const REAPER_PAL = { K: "#140006", k: "#2a0010", R: "#ff0033", W: "#e8e4d8", B: "#b8c2cc", T: "#4a2a14" };
const REAPER = [
  "..BBBBBB............",
  ".B......BB..........",
  "..........B.........",
  "......KKKKK.B.......",
  ".....KKKKKKK.B......",
  "....KKWWWWWKK.T.....",
  "....KKWRWRWKK.T.....",
  "....KKWWWWWKK.T.....",
  "....KKKWWWKKK.T.....",
  "...KKKKKKKKKKKT.....",
  "..KKKkKKKKKkKKT.....",
  "..KKKKKKRKKKKKT.....",
  "..KKKKKKKKKKKKT.....",
  "..KkKKKKKKKKkKT.....",
  "..KKKKKKKKKKKKT.....",
  "..kKKKKKKKKKKK......",
  "..kkKKKKKKKKKk......",
  "...kkKKKKKKkk.......",
  "....kkkkkkkk........",
  "...................."
];

// ---------------------------------------------------------------- items
const GEM = ["..X..", ".XHX.", "XHXXX", "XXXXd", ".XXd.", "..d.."];
const CHICKEN = [
  "....bbbb...",
  "..bBBBBBb..",
  ".bBBYBBBBb.",
  ".bBBBBBBBb.",
  ".bBBBBBBb..",
  "..bBBBBb...",
  "...bbbWW...",
  "......WWW..",
  ".......WW.."
];
const CHICKEN_PAL = { b: "#8a4a17", B: "#d98a3a", Y: "#ffcf73", W: "#f4efe6" };
const MAGNET = [
  ".RRRR.BBBB.",
  ".RRRR.BBBB.",
  ".RR.....BB.",
  ".RR.....BB.",
  ".RR.....BB.",
  ".RRR...BBB.",
  "..RRRRRBB..",
  "...RRRBB..."
];
const MAGNET_PAL = { R: "#ff3b4a", B: "#4a8dff" };
const ROSARY = [
  "....YY....",
  "....YY....",
  "..YYYYYY..",
  "..YYYYYY..",
  "....YY....",
  "....YY....",
  "....YY....",
  "....YY....",
  ".y.....y..",
  "..y.y.y..."
];
const ROSARY_PAL = { Y: "#ffe27a", y: "#c89b3c" };
const CLOCK = [
  "..GGGGGG..",
  ".GWWWWWWG.",
  "GWWWKWWWWG",
  "GWWWKWWWWG",
  "GWWWKKKWWG",
  "GWWWWWWWWG",
  "GWWWWWWWWG",
  ".GWWWWWWG.",
  "..GGGGGG.."
];
const CLOCK_PAL = { G: "#8fe6ff", W: "#f4fbff", K: "#16324a" };
const CHEST = [
  "..YYYYYYYYYYYY..",
  ".YBBBBBBBBBBBBY.",
  "YBbBBBBBBBBBBbBY",
  "YBBBBBBBBBBBBBBY",
  "YYYYYYYGGYYYYYYY",
  "YBBBBBBGGBBBBBBY",
  "YBbBBBBKKBBBBbBY",
  "YBBBBBBBBBBBBBBY",
  "YBBBBBBBBBBBBBBY",
  ".YYYYYYYYYYYYYY."
];
const CHEST_PAL = { Y: "#ffd24a", B: "#8a4a17", b: "#5a2f0e", G: "#fff3b0", K: "#2a1606" };

const KNIFE = ["WWWWWWWggH", "wwwwwwwggH"];
const AXE = [
  "..SSS.....",
  ".SSSSS....",
  "SSSSSSTT..",
  "SSSSS..TT.",
  ".SSS....TT",
  "..........",
];
const CROSS = [
  "...YY...",
  "...YY...",
  "YYYYYYYY",
  "YYYYYYYY",
  "...YY...",
  "...YY...",
  "...YY...",
  "...YY..."
];
const SCYTHE = [
  "..RRRRR...",
  ".R.....RR.",
  "R........R",
  "........TR",
  ".......T..",
  "......T...",
  ".....T....",
  "....T....."
];
const BOOK = ["BBBBBBBB", "BWWWWWWB", "BWGGGGWB", "BWWGGWWB", "BWWGGWWB", "BWWWWWWB", "BWWWWWWB", "BBBBBBBB"];

// ---------------------------------------------------------------- build caches
export function buildArt() {
  const art = {
    wizard: [sprite(WIZ_A, WIZ_PAL, 3), sprite(WIZ_B, WIZ_PAL, 3)],
    wizardL: [sprite(WIZ_A, WIZ_PAL, 3, true), sprite(WIZ_B, WIZ_PAL, 3, true)],
    enemy: {
      bat: [sprite(BAT_A, BAT_PAL, S), sprite(BAT_B, BAT_PAL, S)],
      skeleton: [sprite(SKEL_A, SKEL_PAL, S), sprite(SKEL_B, SKEL_PAL, S)],
      ghost: [sprite(GHOST_A, GHOST_PAL, S), sprite(GHOST_B, GHOST_PAL, S)],
      bloater: [sprite(BLOAT_A, BLOAT_PAL, S), sprite(BLOAT_B, BLOAT_PAL, S)],
      golem: [sprite(GOLEM_A, GOLEM_PAL, S), sprite(GOLEM_B, GOLEM_PAL, S)],
      necromancer: [sprite(NECRO_A, NECRO_PAL, S), sprite(NECRO_B, NECRO_PAL, S)],
      archer: [sprite(ARCHER_A, ARCHER_PAL, S), sprite(ARCHER_B, ARCHER_PAL, S)],
      hound: [sprite(HOUND_A, HOUND_PAL, S), sprite(HOUND_B, HOUND_PAL, S)],
      slime: [sprite(SLIME_A, SLIME_PAL, S), sprite(SLIME_B, SLIME_PAL, S)],
      slimelet: [sprite(SLIME_A, SLIME_PAL, 1), sprite(SLIME_B, SLIME_PAL, 1)]
    },
    demonCache: new Map(),
    reaper: sprite(REAPER, REAPER_PAL, S),
    gemCache: new Map(),
    chicken: sprite(CHICKEN, CHICKEN_PAL, S),
    magnet: sprite(MAGNET, MAGNET_PAL, S),
    rosary: sprite(ROSARY, ROSARY_PAL, S),
    clock: sprite(CLOCK, CLOCK_PAL, S),
    chest: sprite(CHEST, CHEST_PAL, S),
    knife: sprite(KNIFE, { W: "#f1f5f9", w: "#9aa7b8", g: "#ffd24a", H: "#6b3a1a" }, S),
    knifeEvo: sprite(KNIFE, { W: "#ff7ab8", w: "#ff007f", g: "#ffd24a", H: "#6b0033" }, S),
    axe: sprite(AXE, { S: "#d9dee8", T: "#8b5a2b" }, S),
    cross: sprite(CROSS, { Y: "#ffd24a" }, S),
    crossEvo: sprite(CROSS, { Y: "#7df9ff" }, S + 1),
    scythe: sprite(SCYTHE, { R: "#ff2255", T: "#5a2f0e" }, S + 1),
    book: sprite(BOOK, { B: "#1f6fff", W: "#f4f1e6", G: "#ffd24a" }, S),
    bookEvo: sprite(BOOK, { B: "#b3001e", W: "#2a0008", G: "#ff4d6d" }, S),
    floor: buildFloorTile(),
    decorCache: new Map()
  };
  return art;
}

export function demonSprite(art, color) {
  let s = art.demonCache.get(color);
  if (!s) {
    s = sprite(DEMON, { M: color, m: shade(color, -0.35), d: shade(color, -0.6), H: "#f4ecd8", E: "#140006", Y: "#fff36b", K: "#12000a", W: "#f4ecd8" }, S);
    art.demonCache.set(color, s);
  }
  return s;
}

export function gemSprite(art, color) {
  let s = art.gemCache.get(color);
  if (!s) {
    s = sprite(GEM, { X: color, H: shade(color, 0.6), d: shade(color, -0.45) }, S);
    art.gemCache.set(color, s);
  }
  return s;
}

// ---------------------------------------------------------------- floor
// 192px tileable flagstone floor: irregular stones, mortar, moss, cracks and grime.
function buildFloorTile() {
  const N = 192;
  const { c, ctx } = makeCanvas(N, N);
  const rand = mulberry32(90210);
  ctx.fillStyle = "#08060b";
  ctx.fillRect(0, 0, N, N);
  const cell = 32;
  const used = new Set();
  const stones = [];
  for (let gy = 0; gy < N / cell; gy++) {
    for (let gx = 0; gx < N / cell; gx++) {
      if (used.has(`${gx},${gy}`)) continue;
      // Some stones span two cells
      let w = 1;
      let h = 1;
      if (rand() < 0.35 && gx + 1 < N / cell && !used.has(`${gx + 1},${gy}`)) w = 2;
      else if (rand() < 0.25 && gy + 1 < N / cell) h = 2;
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) used.add(`${gx + dx},${gy + dy}`);
      stones.push({ x: gx * cell, y: gy * cell, w: w * cell, h: h * cell });
    }
  }
  for (const s of stones) {
    const tone = 0.85 + rand() * 0.3;
    const base = shade("#1f1a26", (tone - 1) * 1.2);
    const x = s.x + 2;
    const y = s.y + 2;
    const w = s.w - 4;
    const h = s.h - 4;
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    // Grain speckles
    for (let i = 0; i < (w * h) / 9; i++) {
      ctx.fillStyle = rand() < 0.5 ? shade(base, 0.12) : shade(base, -0.18);
      ctx.fillRect(x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, 1);
    }
    // Bevel (top-left light, bottom-right shadow)
    ctx.fillStyle = shade(base, 0.22);
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = shade(base, -0.4);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
    // Crack
    if (rand() < 0.35) {
      ctx.strokeStyle = shade(base, -0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      let cx = x + rand() * w;
      let cy = y + rand() * h;
      ctx.moveTo(cx, cy);
      for (let k = 0; k < 5; k++) {
        cx = Math.min(x + w - 1, Math.max(x, cx + (rand() - 0.5) * 12));
        cy = Math.min(y + h - 1, Math.max(y, cy + (rand() - 0.5) * 12));
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    // Moss creeping from the mortar
    if (rand() < 0.3) {
      ctx.fillStyle = "rgba(70, 120, 60, 0.55)";
      const mx = x + (rand() < 0.5 ? 0 : w - 6);
      for (let i = 0; i < 14; i++) ctx.fillRect(mx + Math.floor(rand() * 6), y + Math.floor(rand() * h), 1 + Math.floor(rand() * 2), 1);
    }
  }
  // Grime blotches
  for (let i = 0; i < 10; i++) {
    const x = rand() * N;
    const y = rand() * N;
    const r = 18 + rand() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

// ---------------------------------------------------------------- crypt decor
// World is split into 220px cells; each cell deterministically hosts at most one prop.
export const DECOR_CELL = 220;

export function decorAt(cx, cy) {
  const r = hash2(cx, cy, 77);
  const ox = 30 + hash2(cx, cy, 5) * (DECOR_CELL - 60);
  const oy = 30 + hash2(cx, cy, 6) * (DECOR_CELL - 60);
  let kind = null;
  if (r < 0.07) kind = "brazier";
  else if (r < 0.15) kind = "bones";
  else if (r < 0.22) kind = "blood";
  else if (r < 0.27) kind = "grave";
  else if (r < 0.31) kind = "pillar";
  else if (r < 0.38) kind = "candles";
  else if (r < 0.42) kind = "rune";
  if (!kind) return null;
  return { kind, x: cx * DECOR_CELL + ox, y: cy * DECOR_CELL + oy, seed: Math.floor(hash2(cx, cy, 9) * 1e6) };
}

export function drawDecor(ctx, d, t) {
  const { x, y } = d;
  const rand = mulberry32(d.seed);
  switch (d.kind) {
    case "bones": {
      ctx.fillStyle = "#cfc6b0";
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 20);
        ctx.rotate(rand() * Math.PI);
        ctx.fillRect(-7, -1, 14, 3);
        ctx.fillRect(-9, -2, 3, 5);
        ctx.fillRect(6, -2, 3, 5);
        ctx.restore();
      }
      // skull
      ctx.fillStyle = "#e3dccb";
      ctx.fillRect(x - 5, y - 6, 10, 8);
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(x - 3, y - 4, 2, 2);
      ctx.fillRect(x + 1, y - 4, 2, 2);
      break;
    }
    case "blood": {
      ctx.fillStyle = "rgba(110, 8, 20, 0.55)";
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 26, 4 + rand() * 12, 3 + rand() * 7, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "grave": {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(x - 12, y + 14, 26, 5);
      ctx.fillStyle = "#4a4552";
      ctx.fillRect(x - 11, y - 14, 22, 30);
      ctx.fillRect(x - 8, y - 18, 16, 4);
      ctx.fillStyle = "#5f5a68";
      ctx.fillRect(x - 11, y - 14, 22, 2);
      ctx.fillStyle = "#2b2830";
      ctx.fillRect(x - 1, y - 10, 2, 12);
      ctx.fillRect(x - 5, y - 6, 10, 2);
      ctx.fillStyle = "rgba(70,120,60,0.6)";
      ctx.fillRect(x - 11, y + 10, 8, 6);
      break;
    }
    case "pillar": {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 20, 22, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3e3846";
      ctx.fillRect(x - 16, y + 8, 32, 12);
      ctx.fillStyle = "#57505f";
      ctx.fillRect(x - 12, y - 26, 24, 36);
      ctx.fillStyle = "#6b6474";
      ctx.fillRect(x - 12, y - 26, 5, 36);
      ctx.fillStyle = "#2f2a35";
      ctx.fillRect(x + 7, y - 26, 5, 36);
      // Broken jagged top
      ctx.fillStyle = "#57505f";
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 26);
      ctx.lineTo(x - 6, y - 34);
      ctx.lineTo(x, y - 28);
      ctx.lineTo(x + 5, y - 36);
      ctx.lineTo(x + 12, y - 26);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "candles": {
      for (let i = 0; i < 3; i++) {
        const cx = x + (i - 1) * 9;
        const h = 8 + i * 3;
        ctx.fillStyle = "#e9e1c8";
        ctx.fillRect(cx - 2, y - h, 4, h);
        ctx.fillStyle = "#c9bd9a";
        ctx.fillRect(cx + 1, y - h, 1, h);
        const f = Math.sin(t * 12 + i * 2) * 1;
        ctx.fillStyle = "#ffb347";
        ctx.fillRect(cx - 1, y - h - 4 + f, 2, 3);
        ctx.fillStyle = "#fff3b0";
        ctx.fillRect(cx - 0.5, y - h - 3 + f, 1, 2);
      }
      ctx.fillStyle = "rgba(233,225,200,0.5)";
      ctx.fillRect(x - 14, y, 28, 2);
      break;
    }
    case "rune": {
      const pulse = 0.35 + Math.sin(t * 2 + d.seed) * 0.2;
      ctx.strokeStyle = `rgba(255, 0, 127, ${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        const px = x + Math.cos(a) * 20;
        const py = y + Math.sin(a) * 20;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "brazier": {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a3440";
      ctx.fillRect(x - 3, y - 2, 6, 16);
      ctx.fillRect(x - 9, y + 11, 18, 3);
      ctx.fillStyle = "#5a5160";
      ctx.fillRect(x - 12, y - 8, 24, 7);
      ctx.fillStyle = "#77707f";
      ctx.fillRect(x - 12, y - 8, 24, 2);
      // Fire
      for (let i = 0; i < 5; i++) {
        const fx = x - 8 + i * 4;
        const fh = 8 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 9;
        ctx.fillStyle = "#ff5a1f";
        ctx.fillRect(fx - 2, y - 8 - fh, 4, fh);
        ctx.fillStyle = "#ffb347";
        ctx.fillRect(fx - 1, y - 8 - fh * 0.7, 2, fh * 0.7);
        ctx.fillStyle = "#fff3b0";
        ctx.fillRect(fx - 0.5, y - 8 - fh * 0.35, 1, fh * 0.35);
      }
      break;
    }
  }
}

// Light emitted by a prop (for the lighting pass) or null
export function decorLight(d, t) {
  if (d.kind === "brazier") return { x: d.x, y: d.y - 14, r: 190 + Math.sin(t * 7 + d.seed) * 12, color: "#ff8a3d" };
  if (d.kind === "candles") return { x: d.x, y: d.y - 12, r: 95 + Math.sin(t * 9 + d.seed) * 6, color: "#ffb347" };
  if (d.kind === "rune") return { x: d.x, y: d.y, r: 70, color: "#ff007f" };
  return null;
}

export { tinted, glow, rgba };
