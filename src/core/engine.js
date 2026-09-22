/**
 * SYS://TIMESINK.NET — Core Game Engine
 * Delta-time game loop, keyboard/mouse input, mobile virtual touch stick & buttons,
 * AABB/Circle collisions, and grid A* pathfinding.
 */

export function createGameLoop({ update, render, canvas, targetFps = 60, onPause = null }) {
  let lastTime = performance.now();
  let running = false;
  let paused = false;
  let animId = null;
  let frameCount = 0;
  let fpsTimer = performance.now();
  let currentFps = targetFps;

  function togglePause() {
    paused = !paused;
    if (onPause) onPause(paused);
    if (!paused) {
      lastTime = performance.now();
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      togglePause();
    }
  });

  function tick(now) {
    if (!running) return;

    // Delta time in seconds, clamped to max 0.1s to prevent spiral of death
    const rawDt = (now - lastTime) / 1000;
    const dt = Math.min(rawDt, 0.1);
    lastTime = now;

    // FPS estimation
    frameCount++;
    if (now - fpsTimer >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      fpsTimer = now;
    }

    if (!paused) {
      update(dt);
    }

    render(dt, { paused, fps: currentFps });

    if (paused && canvas) {
      renderPauseOverlay(canvas);
    }

    animId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    animId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
  }

  return {
    start,
    stop,
    togglePause,
    isPaused: () => paused,
    setPaused: (p) => {
      paused = p;
      if (onPause) onPause(paused);
      if (!paused) lastTime = performance.now();
    },
    getFps: () => currentFps,
  };
}

function renderPauseOverlay(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.fillStyle = "rgba(3, 5, 8, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#00f0ff";
  ctx.shadowColor = "#00f0ff";
  ctx.shadowBlur = 12;
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAUSED // SYS HOLD", canvas.width / 2, canvas.height / 2 - 14);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#8a97b1";
  ctx.font = '11px "VT323", monospace';
  ctx.fillText("PRESS [ESC] OR TAP SCREEN TO RESUME", canvas.width / 2, canvas.height / 2 + 16);
  ctx.restore();
}

export function createInputManager({ canvas, buttons = [] } = {}) {
  const keys = {};
  const justPressed = new Set();
  const mouse = {
    x: 0,
    y: 0,
    down: false,
    rightDown: false,
    clicked: false,
    rightClicked: false,
  };

  const stick = {
    active: false,
    x: 0,
    y: 0,
    angle: 0,
    distance: 0,
  };

  const buttonStates = {};
  buttons.forEach((b) => {
    buttonStates[b.id] = false;
  });

  window.addEventListener("keydown", (e) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
      }
    }
    if (!keys[e.code]) {
      justPressed.add(e.code);
    }
    keys[e.code] = true;
    keys[e.key] = true;
  });

  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
    keys[e.key] = false;
  });

  if (canvas) {
    function updateMousePos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mouse.x = Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX));
      mouse.y = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY));
    }

    canvas.addEventListener("mousemove", updateMousePos);

    canvas.addEventListener("mousedown", (e) => {
      updateMousePos(e);
      if (e.button === 0) {
        mouse.down = true;
        mouse.clicked = true;
      } else if (e.button === 2) {
        mouse.rightDown = true;
        mouse.rightClicked = true;
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) mouse.down = false;
      if (e.button === 2) mouse.rightDown = false;
    });

    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  // Setup Mobile Virtual Controls
  setupMobileTouchUI(canvas, stick, buttonStates, buttons);

  return {
    isDown: (codeOrId) => Boolean(keys[codeOrId]) || Boolean(buttonStates[codeOrId]),
    wasPressed: (code) => {
      const has = justPressed.has(code);
      if (has) justPressed.delete(code);
      return has;
    },
    isPressed: (codeOrId) => {
      if (buttonStates[codeOrId]) return true;
      const has = justPressed.has(codeOrId);
      if (has) justPressed.delete(codeOrId);
      return has;
    },
    mouse,
    stick,
    button: (id) => Boolean(buttonStates[id]),
    clearJustPressed: () => {
      justPressed.clear();
      mouse.clicked = false;
      mouse.rightClicked = false;
    },
  };
}

function setupMobileTouchUI(canvas, stick, buttonStates, buttonDefs) {
  if (typeof window === "undefined" || !document.body) return;

  const container = document.createElement("div");
  container.className = "arcade-touch-controls";
  container.innerHTML = `
    <div class="touch-stick-zone" id="touch-stick-zone">
      <div class="touch-stick-base">
        <div class="touch-stick-knob" id="touch-stick-knob"></div>
      </div>
    </div>
    <div class="touch-actions-zone" id="touch-actions-zone"></div>
  `;

  // Append touch buttons
  const actionsZone = container.querySelector("#touch-actions-zone");
  const defaultButtons = buttonDefs.length > 0 ? buttonDefs : [
    { id: "actionA", label: "A", key: "Space" },
    { id: "actionB", label: "B", key: "KeyE" }
  ];

  defaultButtons.forEach((b) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `touch-btn touch-btn--${b.id}`;
    btn.dataset.btnId = b.id;
    btn.textContent = b.label || b.id;
    actionsZone.appendChild(btn);

    const press = (e) => {
      e.preventDefault();
      buttonStates[b.id] = true;
      btn.classList.add("is-pressed");
    };
    const release = (e) => {
      e.preventDefault();
      buttonStates[b.id] = false;
      btn.classList.remove("is-pressed");
    };

    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    btn.addEventListener("mousedown", press);
    btn.addEventListener("mouseup", release);
  });

  // Wire virtual stick touch events
  const stickZone = container.querySelector("#touch-stick-zone");
  const knob = container.querySelector("#touch-stick-knob");
  let touchId = null;
  let originX = 0;
  let originY = 0;
  const maxRadius = 40;

  function handleStart(e) {
    if (touchId !== null) return;
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    touchId = touch.identifier ?? "mouse";
    const rect = stickZone.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
    handleMove(e);
  }

  function handleMove(e) {
    let touch = null;
    if (e.changedTouches) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          touch = e.changedTouches[i];
          break;
        }
      }
    } else if (touchId === "mouse") {
      touch = e;
    }
    if (!touch) return;
    e.preventDefault();

    const dx = touch.clientX - originX;
    const dy = touch.clientY - originY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);

    stick.active = true;
    stick.x = (clampedDist / maxRadius) * Math.cos(angle);
    stick.y = (clampedDist / maxRadius) * Math.sin(angle);
    stick.angle = angle;
    stick.distance = clampedDist / maxRadius;

    if (knob) {
      const kx = Math.cos(angle) * clampedDist;
      const ky = Math.sin(angle) * clampedDist;
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
    }
  }

  function handleEnd(e) {
    if (touchId === null) return;
    let ended = false;
    if (e.changedTouches) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          ended = true;
          break;
        }
      }
    } else {
      ended = true;
    }
    if (!ended) return;

    touchId = null;
    stick.active = false;
    stick.x = 0;
    stick.y = 0;
    stick.distance = 0;
    if (knob) knob.style.transform = "translate(0px, 0px)";
  }

  stickZone.addEventListener("touchstart", handleStart, { passive: false });
  window.addEventListener("touchmove", handleMove, { passive: false });
  window.addEventListener("touchend", handleEnd, { passive: false });
  window.addEventListener("touchcancel", handleEnd, { passive: false });

  document.body.appendChild(container);
}

// ==========================================
// MATH & COLLISION HELPERS
// ==========================================
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function distSq(x1, y1, x2, y2) {
  return (x2 - x1) ** 2 + (y2 - y1) ** 2;
}

export function angleDiff(target, current) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

export function intersectAABB(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function pointInAABB(px, py, box) {
  return px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h;
}

export function circleIntersect(c1, c2) {
  return distSq(c1.x, c1.y, c2.x, c2.y) <= (c1.r + c2.r) ** 2;
}

export function pointInCircle(px, py, cx, cy, r) {
  return distSq(px, py, cx, cy) <= r ** 2;
}

// ==========================================
// GRID A* PATHFINDING ALGORITHM
// ==========================================
export function aStar(gridColsOrOpts, gridRows, start, end, isBlocked) {
  let cols, rows, s, e, blockedFn;
  if (typeof gridColsOrOpts === "object" && gridColsOrOpts !== null && !("x" in gridColsOrOpts)) {
    const opts = gridColsOrOpts;
    cols = opts.cols ?? opts.gridCols ?? opts.width;
    rows = opts.rows ?? opts.gridRows ?? opts.height;
    s = opts.start;
    e = opts.goal ?? opts.end;
    blockedFn = opts.isBlocked ?? ((x, y) => (opts.isWalkable ? !opts.isWalkable(x, y) : false));
  } else {
    cols = gridColsOrOpts;
    rows = gridRows;
    s = start;
    e = end;
    blockedFn = isBlocked;
  }

  if (!s || !e) return null;

  const startKey = `${s.x},${s.y}`;
  const endKey = `${e.x},${e.y}`;
  if (startKey === endKey) return [s];
  if (blockedFn(e.x, e.y)) return null;

  const openSet = [s];
  const cameFrom = new Map();

  const gScore = new Map();
  gScore.set(startKey, 0);

  const fScore = new Map();
  fScore.set(startKey, Math.abs(e.x - s.x) + Math.abs(e.y - s.y));

  const closedSet = new Set();

  while (openSet.length > 0) {
    // Find node in openSet with lowest fScore
    let currentIdx = 0;
    let lowestF = fScore.get(`${openSet[0].x},${openSet[0].y}`) ?? Infinity;
    for (let i = 1; i < openSet.length; i++) {
      const score = fScore.get(`${openSet[i].x},${openSet[i].y}`) ?? Infinity;
      if (score < lowestF) {
        lowestF = score;
        currentIdx = i;
      }
    }

    const current = openSet.splice(currentIdx, 1)[0];
    const currentKey = `${current.x},${current.y}`;

    if (current.x === e.x && current.y === e.y) {
      // Reconstruct path
      const path = [];
      let curr = currentKey;
      while (cameFrom.has(curr)) {
        const [x, y] = curr.split(",").map(Number);
        path.unshift({ x, y });
        curr = cameFrom.get(curr);
      }
      return path;
    }

    closedSet.add(currentKey);

    // 4-directional neighbors
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const nb of neighbors) {
      if (nb.x < 0 || nb.x >= cols || nb.y < 0 || nb.y >= rows) continue;
      const nbKey = `${nb.x},${nb.y}`;
      if (closedSet.has(nbKey)) continue;
      if (blockedFn(nb.x, nb.y) && !(nb.x === e.x && nb.y === e.y)) continue;

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentativeG < (gScore.get(nbKey) ?? Infinity)) {
        cameFrom.set(nbKey, currentKey);
        gScore.set(nbKey, tentativeG);
        const h = Math.abs(e.x - nb.x) + Math.abs(e.y - nb.y);
        fScore.set(nbKey, tentativeG + h);

        if (!openSet.some((n) => n.x === nb.x && n.y === nb.y)) {
          openSet.push(nb);
        }
      }
    }
  }

  return null; // No path found
}
