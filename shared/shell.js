import { SITE, games, liveGames } from "./registry.js";
import { icon } from "./icons.js";
import { createPrefStore } from "./storage.js";
import { setSoundEnabled, isSoundEnabled, onSoundStateChange } from "./sound.js";

const prefs = createPrefStore("prefs");

const PHOSPHORS = [
  { id: "full", label: "FULL" },
  { id: "green", label: "GRN" },
  { id: "amber", label: "AMB" },
  { id: "cyan", label: "CYN" },
];

let clockStarted = false;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function initShell({ crumb = null, showGameLinks = true } = {}) {
  const body = document.body;
  const accent = body.dataset.accent;
  if (accent) document.documentElement.dataset.accent = accent;

  applyCrt(crtPref());
  applyPhosphor(prefs.get("phosphor", "full"));

  const skip = document.querySelector("a.skip-link") ?? document.createElement("a");
  if (!skip.isConnected) {
    skip.className = "skip-link";
    skip.href = "#main";
    skip.textContent = "Skip to content";
  }

  const cosmos = document.createElement("div");
  cosmos.className = "cosmos";
  cosmos.setAttribute("aria-hidden", "true");
  cosmos.innerHTML = `
    <div class="cosmos__beams"></div>
    <div class="cosmos__stars"></div>
    <div class="cosmos__sparkles"></div>
    <div class="cosmos__grain"></div>
    <div class="cosmos__grid"></div>
    <svg class="cosmos__planet" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ts-planet" cx="38%" cy="34%" r="72%">
          <stop offset="0%" stop-color="#ff7a2e"/>
          <stop offset="34%" stop-color="#c22e6d"/>
          <stop offset="62%" stop-color="#3b1a5e"/>
          <stop offset="100%" stop-color="#0b0e14"/>
        </radialGradient>
        <linearGradient id="ts-ring1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ff007f"/>
          <stop offset="55%" stop-color="#00f0ff"/>
          <stop offset="100%" stop-color="#7b2ff7"/>
        </linearGradient>
        <linearGradient id="ts-ring2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#00f0ff"/>
          <stop offset="100%" stop-color="#ff007f"/>
        </linearGradient>
        <radialGradient id="ts-halo" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stop-color="#ff007f" stop-opacity="0"/>
          <stop offset="88%" stop-color="#ff007f" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#ff007f" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="150" cy="150" r="146" fill="url(#ts-halo)"/>
      <ellipse cx="150" cy="168" rx="128" ry="30" fill="none" stroke="url(#ts-ring2)" stroke-width="3" opacity="0.55" transform="rotate(-14 150 168)"/>
      <circle cx="150" cy="150" r="72" fill="url(#ts-planet)"/>
      <ellipse cx="150" cy="150" rx="118" ry="26" fill="none" stroke="url(#ts-ring1)" stroke-width="7" transform="rotate(-14 150 150)"/>
      <ellipse cx="150" cy="150" rx="104" ry="22" fill="none" stroke="#0b0e14" stroke-width="10" opacity="0.85" transform="rotate(-14 150 150)"/>
      <ellipse cx="150" cy="150" rx="118" ry="26" fill="none" stroke="url(#ts-ring1)" stroke-width="2" opacity="0.9" transform="rotate(-14 150 150)"/>
      <circle cx="252" cy="66" r="9" fill="#f0f4fc" opacity="0.9"/>
      <circle cx="249" cy="63" r="9" fill="#0b0e14" opacity="0.35"/>
    </svg>`;

  const crt = document.createElement("div");
  crt.className = "crt-overlay";
  crt.setAttribute("aria-hidden", "true");

  body.prepend(skip, cosmos, crt);

  const online = String(liveGames().length).padStart(2, "0");
  const total = String(games.length).padStart(2, "0");
  const phosLabel = `PHOS:${PHOSPHORS.find((p) => p.id === prefs.get("phosphor", "full"))?.label ?? "FULL"}`;
  const crtOn = prefs.get("crt", true);

  const header = document.createElement("header");
  header.className = "shell";
  header.innerHTML = `
    <a class="shell__logo" href="/" aria-label="${escapeHtml(SITE.name)} home">SYS://ARCADE.NET<span class="cursor" aria-hidden="true"></span></a>
    <div class="shell__telemetry" aria-label="System telemetry">
      <span class="tele">GAMES ONLINE: [<b data-tele-games>${online}</b>/${total}]</span>
      <span class="tele tele--ok">SYS STATUS: NOMINAL</span>
      <span class="tele">STREAK: [<b data-tele-streak>${pad2(prefs.get("streak", 0))}</b>]</span>
      <span class="tele" data-tele-clock>--:--:--</span>
    </div>
    <nav class="shell__nav" aria-label="Site">
      ${showGameLinks ? `<a class="hbtn" href="/" title="All games" aria-label="All games">${icon("gamepad", { size: 14 })}</a>` : ""}
      <button class="hbtn" type="button" data-crt-toggle aria-pressed="${crtOn}">CRT</button>
      <button class="hbtn" type="button" data-phosphor-toggle aria-pressed="${prefs.get("phosphor", "full") !== "full"}">${phosLabel}</button>
      <button class="hbtn" type="button" data-sound-toggle aria-pressed="false">SFX:OFF</button>
      <a class="hbtn" href="${SITE.repo}" target="_blank" rel="noopener noreferrer" title="Source code" aria-label="Source code">${icon("github", { size: 14 })}</a>
    </nav>
  `;

  if (document.querySelector("header.shell")) return document.querySelector("header.shell");

  const main = body.querySelector("main");
  if (main) body.insertBefore(header, main);
  else body.appendChild(header);

  const footer = document.createElement("footer");
  footer.className = "footer";
  footer.innerHTML = `
    <div class="footer__inner">
      <div class="footer__sys">
        <span>MEM 640K OK</span>
        <span>VID TERMINAL-80</span>
        <span class="footer__links">
          <a href="/">DIRECTORY</a>
          <a href="#about">ABOUT</a>
          <a href="${SITE.repo}" target="_blank" rel="noopener noreferrer">SOURCE</a>
        </span>
      </div>
      <p class="footer__prompt">&gt; guest@terminal:~$ <span class="cursor" aria-hidden="true"></span></p>
    </div>
  `;
  body.appendChild(footer);

  const toastStack = document.createElement("div");
  toastStack.className = "toast-stack";
  toastStack.setAttribute("role", "status");
  toastStack.setAttribute("aria-live", "polite");
  body.appendChild(toastStack);

  wireToggles(header);
  startClock();
  document.documentElement.classList.add("js");
  return { header, footer, toastStack };
}

function pad2(n) {
  return String(Math.max(0, Math.min(99, n))).padStart(2, "0");
}

export function setStreak(n) {
  prefs.set("streak", n);
  document.querySelectorAll("[data-tele-streak]").forEach((el) => {
    el.textContent = pad2(n);
  });
}

export function getStreak() {
  return prefs.get("streak", 0);
}

const CRT_MODES = ["lite", "full", "off"];

function crtPref() {
  const raw = prefs.get("crt", "lite");
  if (raw === true) return "lite";
  if (raw === false) return "off";
  return CRT_MODES.includes(raw) ? raw : "lite";
}

function applyCrt(mode) {
  const next = CRT_MODES.includes(mode) ? mode : "lite";
  document.documentElement.classList.remove("crt-on");
  document.documentElement.classList.toggle("crt-lite", next === "lite");
  document.documentElement.classList.toggle("crt-full", next === "full");
  document.querySelectorAll("[data-crt-toggle]").forEach((btn) => {
    btn.textContent = `CRT:${next.toUpperCase()}`;
    btn.setAttribute("aria-pressed", String(next !== "off"));
  });
}

function applyPhosphor(id) {
  const mode = PHOSPHORS.some((p) => p.id === id) ? id : "full";
  if (mode === "full") document.documentElement.removeAttribute("data-phosphor");
  else document.documentElement.dataset.phosphor = mode;
  document.querySelectorAll("[data-phosphor-toggle]").forEach((btn) => {
    btn.textContent = `PHOS:${PHOSPHORS.find((p) => p.id === mode).label}`;
    btn.setAttribute("aria-pressed", String(mode !== "full"));
  });
}

function wireToggles(header) {
  setSoundEnabled(prefs.get("sound", false) === true);
  const soundBtn = header.querySelector("[data-sound-toggle]");
  const crtBtn = header.querySelector("[data-crt-toggle]");
  const phosBtn = header.querySelector("[data-phosphor-toggle]");
  if (!soundBtn || !crtBtn || !phosBtn) return;

  function syncSound() {
    const on = isSoundEnabled();
    soundBtn.textContent = on ? "SFX:ON" : "SFX:OFF";
    soundBtn.setAttribute("aria-pressed", String(on));
  }
  syncSound();
  onSoundStateChange(syncSound);
  soundBtn.addEventListener("click", () => {
    prefs.set("sound", setSoundEnabled(!isSoundEnabled()));
    syncSound();
  });

  crtBtn.textContent = `CRT:${crtPref().toUpperCase()}`;
  crtBtn.setAttribute("aria-pressed", String(crtPref() !== "off"));
  crtBtn.addEventListener("click", () => {
    const current = crtPref();
    const next = CRT_MODES[(CRT_MODES.indexOf(current) + 1) % CRT_MODES.length];
    prefs.set("crt", next);
    applyCrt(next);
  });

  phosBtn.addEventListener("click", () => {
    const current = prefs.get("phosphor", "full");
    const next = PHOSPHORS[(PHOSPHORS.findIndex((p) => p.id === current) + 1) % PHOSPHORS.length].id;
    prefs.set("phosphor", next);
    applyPhosphor(next);
  });
}

function startClock() {
  const tick = () => {
    const now = new Date();
    const text = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((v) => String(v).padStart(2, "0"))
      .join(":");
    document.querySelectorAll("[data-tele-clock]").forEach((el) => {
      el.textContent = text;
    });
  };
  tick();
  if (clockStarted) return;
  clockStarted = true;
  setInterval(tick, 1000);
}

export function toast({ title, body = "", icon: iconName = "sparkle", duration = 3400 } = {}) {
  const stack = document.querySelector(".toast-stack");
  if (!stack) return null;

  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `
    <span class="toast__icon">${icon(iconName)}</span>
    <span>
      <span class="toast__title">${escapeHtml(title)}</span>
      ${body ? `<span class="toast__body">${escapeHtml(body)}</span>` : ""}
    </span>
  `;
  stack.appendChild(el);

  const ms = Number.isFinite(duration) ? Math.min(Math.max(0, duration), 2 ** 31 - 1) : 3400;
  const timer = setTimeout(dismiss, ms);
  function dismiss() {
    clearTimeout(timer);
    if (el.isConnected) el.remove();
  }

  return dismiss;
}

let activeModal = null;

export function openModal({
  title,
  body = "",
  actions = [],
  dismissible = true,
  onClose = null,
}) {
  if (activeModal) activeModal.close(null);

  const previouslyFocused = document.activeElement;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const VARIANTS = new Set(["primary", "ghost", "danger"]);
  const buttons = actions
    .map(
      (a, i) =>
        `<button type="button" class="btn ${VARIANTS.has(a.variant) ? `btn--${a.variant}` : ""}" data-action="${i}">${escapeHtml(a.label)}</button>`
    )
    .join("");

  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal__head">
        <h2 class="modal__title">${escapeHtml(title)}</h2>
        ${dismissible ? `<button type="button" class="btn btn--ghost btn--sm modal__close" data-close aria-label="Close">${icon("close", { size: 14 })}</button>` : ""}
      </div>
      <div class="modal__body">${body}</div>
      ${buttons ? `<div class="modal__foot">${buttons}</div>` : ""}
    </div>
  `;

  document.body.appendChild(backdrop);
  const priorOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  let resolveAction = null;
  const settled = new Promise((resolve) => {
    resolveAction = resolve;
  });

  function close(result = null) {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    document.body.style.overflow = priorOverflow;
    activeModal = null;
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
    resolveAction(result);
    onClose?.(result);
  }

  backdrop.addEventListener("click", (event) => {
    if (event.target !== backdrop) return;
    if (dismissible) close(null);
  });

  backdrop.addEventListener("click", (event) => {
    const closeBtn = event.target.closest("[data-close]");
    if (closeBtn && dismissible) close(null);

    const actionBtn = event.target.closest("[data-action]");
    if (actionBtn) {
      const action = actions[Number(actionBtn.dataset.action)];
      if (!action) return;
      let veto = false;
      try {
        veto = action.onClick?.() === false;
      } finally {
        if (!veto) close(action.id ?? action.label);
      }
    }
  });

  function onKeydown(event) {
    if (event.key === "Escape" && dismissible) {
      event.preventDefault();
      close(null);
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = [...backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
      (n) => !n.disabled && n.offsetParent !== null
    );
    if (!focusables.length) {
      event.preventDefault();
      return;
    }
    const list = [...focusables];
    const first = list[0];
    const last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", onKeydown);
  const wrapped = (result) => {
    document.removeEventListener("keydown", onKeydown);
    close(result);
  };

  activeModal = { close: wrapped, el: backdrop };

  const primary =
    backdrop.querySelector("input,textarea,select") ??
    backdrop.querySelector('[data-action="0"]') ??
    backdrop.querySelector("[data-close]") ??
    backdrop.querySelector("button");
  primary?.focus();

  settled.finally(() => document.removeEventListener("keydown", onKeydown));
  return { close: wrapped, el: backdrop, result: settled };
}

export function confirmDialog({
  title,
  body = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
}) {
  const { result } = openModal({
    title,
    body,
    actions: [
      { id: true, label: confirmLabel, variant: danger ? "danger" : "primary" },
      { id: false, label: cancelLabel, variant: "ghost" },
    ],
  });
  return result.then((value) => value === true);
}
