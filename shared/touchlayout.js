// Movable on-screen controls for touch devices.
//
// A game registers its touch controls once:
//   enableTouchLayout({ id: "ghost-lap", frame, items: [...buttons] })
// On a touch screen a "MOVE CONTROLS" button appears in the stage bar. It switches the controls into
// an edit mode where each button / joystick can be dragged anywhere inside `frame`, resized with the
// size buttons, or reset to the game's own layout. The layout is saved per game (positions are
// fractions of the frame, so it survives rotation and resizing).
//
// Items keep their own event handlers. While editing, a capture listener on the frame swallows the
// touches so dragging a button never fires it.

// One layout per screen shape: the normal page, fullscreen portrait and fullscreen landscape
const layoutMode = () => {
  if (typeof document === "undefined" || !document.documentElement.classList.contains("is-immersive")) return "";
  return window.innerHeight > window.innerWidth ? ":fs-portrait" : ":fs-landscape";
};
const STORE = (id) => `timesink:touch-layout:${id}${layoutMode()}`;
let currentMode = null;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.6;
const layouts = [];
let editing = false;
let toolbar = null;
let toggleBtn = null;

const load = (id) => {
  try {
    const v = JSON.parse(localStorage.getItem(STORE(id)) || "null");
    return v && typeof v === "object" && v.pos ? v : null;
  } catch {
    return null;
  }
};
const save = (id, v) => {
  try {
    if (v) localStorage.setItem(STORE(id), JSON.stringify(v));
    else localStorage.removeItem(STORE(id));
  } catch {
    /* private mode: the layout just won't persist */
  }
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const isTouchScreen = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/**
 * @param {{ id: string, frame: HTMLElement, items: HTMLElement[] }} opts
 * Each item gets a stable key from data-touch-id, then its id, then its position in the list.
 */
export function enableTouchLayout({ id, frame, items }) {
  if (!frame || !items?.length) return null;
  const entry = {
    id,
    frame,
    items: items.map((el, k) => ({ el, key: el.dataset.touchId || el.id || `item${k}` })),
    state: load(id)
  };
  for (const it of entry.items) it.el.dataset.touchMove = "";
  frame.classList.add("touch-layout-frame");
  layouts.push(entry);
  if (currentMode === null) {
    currentMode = layoutMode();
    // Entering / leaving fullscreen or turning the phone: switch to that shape's saved layout
    const onShape = () => {
      const mode = layoutMode();
      if (mode === currentMode) return;
      currentMode = mode;
      for (const e of layouts) {
        e.state = load(e.id);
        apply(e);
      }
    };
    window.addEventListener("immersivechange", onShape);
    window.addEventListener("resize", onShape);
  }
  apply(entry);
  guard(entry);
  addToggle();
  return entry;
}

// Place every item: saved position (fraction of the frame, centre of the item) and size, or the
// game's own CSS layout when nothing has been saved.
function apply(entry) {
  const s = entry.state;
  for (const it of entry.items) {
    const p = s?.pos[it.key];
    const st = it.el.style;
    if (p) {
      st.position = "absolute";
      st.left = `${p[0] * 100}%`;
      st.top = `${p[1] * 100}%`;
      st.right = "auto";
      st.bottom = "auto";
      st.margin = "0";
      st.transform = `translate(-50%, -50%) scale(${s.scale || 1})`;
    } else {
      for (const k of ["position", "left", "top", "right", "bottom", "margin", "transform"]) st[k] = "";
      if (s?.scale && s.scale !== 1) st.transform = `scale(${s.scale})`;
    }
  }
}

// Freeze the current on-screen positions so moving one control doesn't reflow the others
function freeze(entry) {
  const f = entry.frame.getBoundingClientRect();
  if (!f.width || !f.height) return;
  const scale = entry.state?.scale || 1;
  const pos = {};
  for (const it of entry.items) {
    const r = it.el.getBoundingClientRect();
    if (!r.width) continue;
    pos[it.key] = [(r.left + r.width / 2 - f.left) / f.width, (r.top + r.height / 2 - f.top) / f.height];
  }
  entry.state = { pos, scale };
}

function guard(entry) {
  const stop = (e) => {
    if (!editing) return;
    if (!e.target.closest?.("[data-touch-move]")) return;
    e.stopPropagation();
    if (e.type !== "pointerdown" && e.cancelable) e.preventDefault();
  };
  for (const type of ["touchstart", "touchmove", "touchend", "mousedown", "mouseup", "click", "contextmenu"]) {
    entry.frame.addEventListener(type, stop, { capture: true, passive: false });
  }
  entry.frame.addEventListener(
    "pointerdown",
    (e) => {
      if (!editing) return;
      const el = e.target.closest?.("[data-touch-move]");
      const it = el && entry.items.find((x) => x.el === el);
      if (!it) return;
      e.stopPropagation();
      e.preventDefault();
      if (!entry.state) freeze(entry);
      const f = entry.frame.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const grab = [e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)];
      el.classList.add("is-dragging");
      el.setPointerCapture?.(e.pointerId);
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        ev.preventDefault();
        ev.stopPropagation();
        // Keep the whole control inside the frame
        const hw = r.width / 2 / f.width;
        const hh = r.height / 2 / f.height;
        const x = clamp((ev.clientX - grab[0] - f.left) / f.width, hw, 1 - hw);
        const y = clamp((ev.clientY - grab[1] - f.top) / f.height, hh, 1 - hh);
        entry.state.pos[it.key] = [x, y];
        apply(entry);
      };
      const end = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        el.classList.remove("is-dragging");
        el.removeEventListener("pointermove", move, true);
        el.removeEventListener("pointerup", end, true);
        el.removeEventListener("pointercancel", end, true);
        save(entry.id, entry.state);
      };
      el.addEventListener("pointermove", move, true);
      el.addEventListener("pointerup", end, true);
      el.addEventListener("pointercancel", end, true);
    },
    { capture: true }
  );
}

function setEditing(on) {
  editing = on;
  document.documentElement.classList.toggle("touch-layout-editing", on);
  // Let go of anything the game thinks is held
  window.dispatchEvent(new Event("blur"));
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-pressed", String(on));
    toggleBtn.textContent = on ? "✓ DONE" : "✥ MOVE CONTROLS";
  }
  if (on) showToolbar();
  else toolbar?.remove();
}

function showToolbar() {
  toolbar?.remove();
  toolbar = document.createElement("div");
  toolbar.className = "touch-layout-bar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Move controls");
  toolbar.innerHTML = `
    <span class="touch-layout-bar__hint">Drag the controls where you want them</span>
    <button type="button" data-tl="smaller" aria-label="Smaller controls">A−</button>
    <button type="button" data-tl="bigger" aria-label="Bigger controls">A+</button>
    <button type="button" data-tl="reset">RESET</button>
    <button type="button" data-tl="done" class="is-primary">DONE</button>`;
  toolbar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.tl;
    if (act === "done") return setEditing(false);
    for (const entry of layouts) {
      if (act === "reset") {
        entry.state = null;
        save(entry.id, null);
      } else {
        if (!entry.state) freeze(entry);
        entry.state.scale = clamp((entry.state.scale || 1) + (act === "bigger" ? 0.1 : -0.1), MIN_SCALE, MAX_SCALE);
        save(entry.id, entry.state);
      }
      apply(entry);
    }
  });
  (document.fullscreenElement || document.body).append(toolbar);
}

function addToggle() {
  if (toggleBtn || !isTouchScreen()) return;
  toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "hbtn hbtn--touch-layout";
  toggleBtn.dataset.touchLayoutBtn = "";
  toggleBtn.setAttribute("aria-pressed", "false");
  toggleBtn.textContent = "✥ MOVE CONTROLS";
  toggleBtn.addEventListener("click", () => setEditing(!editing));
  const place = () => {
    const meta = document.querySelector(".stage-bar__meta");
    const main = document.getElementById("main") || document.querySelector("main");
    if (meta) meta.append(toggleBtn);
    else if (main) {
      toggleBtn.classList.add("hbtn--touch-layout-float");
      main.prepend(toggleBtn);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", place, { once: true });
  else place();
}
