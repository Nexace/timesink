// Binary-heap A* on the tile grid with a node budget. 4-directional.
// blocked(x, y) -> boolean. Returns an array of {x, y} steps (excluding start) or null.
export function findPath(w, h, sx, sy, gx, gy, blocked, { maxNodes = 4000, goalAdjacent = false } = {}) {
  if (sx === gx && sy === gy) return [];
  const startK = sy * w + sx;
  const isGoal = goalAdjacent
    ? (x, y) => Math.abs(x - gx) + Math.abs(y - gy) === 1
    : (x, y) => x === gx && y === gy;
  const gScore = new Map([[startK, 0]]);
  const came = new Map();
  const closed = new Set();
  const heap = [];
  const push = (k, f) => {
    heap.push([f, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const hfn = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
  push(startK, hfn(sx, sy));
  let expanded = 0;
  while (heap.length) {
    const [, k] = pop();
    if (closed.has(k)) continue;
    closed.add(k);
    const x = k % w;
    const y = (k - x) / w;
    if (isGoal(x, y)) {
      const out = [];
      let c = k;
      while (c !== startK) {
        const cx = c % w;
        out.push({ x: cx, y: (c - cx) / w });
        c = came.get(c);
      }
      return out.reverse();
    }
    if (++expanded > maxNodes) return null;
    const gk = gScore.get(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx;
      if (closed.has(nk)) continue;
      if (blocked(nx, ny) && !(nx === gx && ny === gy && !goalAdjacent)) continue;
      const ng = gk + 1;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, k);
        push(nk, ng + hfn(nx, ny));
      }
    }
  }
  return null;
}
