// A restricted Mars palette. Index 0 = transparent.
export const PAL = [
  null,
  "#0b0608", // 1 near-black
  "#e8483a", // 2 alert red
  "#3a2a2e", // 3 basalt
  "#5a3a22", // 4 soil
  "#8a4a2e", // 5 rust
  "#b85a32", // 6 mars orange
  "#d9824a", // 7 sand
  "#f0b27a", // 8 pale dust
  "#e8cfa0", // 9 silica cream
  "#ffcf4a", // 10 yellow
  "#c8e04a", // 11 hydrazine yellow-green
  "#9ee6ff", // 12 ice
  "#58c070", // 13 plant green
  "#a8a8b0", // 14 metal
  "#f4f4f0", // 15 white
  "#b06adf", // 16 rare purple
  "#1c1214", // 17 chasm dark
  "#5b5f6a", // 18 dark metal
  "#2f6fa8", // 19 visor blue
  "#ff7a1a", // 20 suit orange
  "#74402a", // 21 dark sand
  "#c86a3a", // 22 mid orange
  "#6ec8f0", // 23 ice mid
  "#2a1a1e", // 24 very dark rock
  "#8e2e22", // 25 volcanic red
  "#44484f", // 26 steel dark
  "#7e848e", // 27 steel mid
  "#cfd3da", // 28 steel light
  "#2e7a40", // 29 leaf dark
  "#ffe9a8", // 30 lamp glow
  "#3d6a8a", // 31 blue steel
];

export function hex(i) {
  return PAL[i] ?? "#ff00ff";
}

// Terrain base colors [base, light, dark] indexes by terrain id.
export const TERRAIN_COLORS = [
  [6, 7, 22], // plains
  [7, 8, 6], // dune
  [22, 6, 5], // crater
  [23, 12, 31], // ice
  [3, 18, 24], // basalt
  [17, 24, 1], // chasm
  [25, 5, 24], // volcanic
  [21, 6, 5], // ramp
  [5, 22, 21], // dug
  [24, 3, 17], // tube
];

// Minimap colors per terrain.
export const MINI = ["#b85a32", "#d9824a", "#9a4c2a", "#9ee6ff", "#3a2a2e", "#1c1214", "#8e2e22", "#74402a", "#8a4a2e", "#2a1a1e"];
