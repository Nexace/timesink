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

  applyCrt(prefs.get("crt", true));
  applyPhosphor(prefs.get("phosphor", "full"));

  const skip = document.createElement("a");
  skip.className = "skip-link";
  skip.href = "#main";
  skip.textContent = "Skip to content";

  const crt = document.createElement("div");
  crt.className = "crt-overlay";
  crt.setAttribute("aria-hidden", "true");

  body.prepend(skip, crt);

  const online = String(liveGames().length).padStart(2, "0");
  const total = String(games.length).padStart(2, "0");

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
      <button class="hbtn" type="button" data-crt-toggle aria-pressed="false">CRT</button>
      <button class="hbtn" type="button" data-phosphor-toggle>PHOS:FULL</button>
      <button class="hbtn" type="button" data-sound-toggle aria-pressed="false">SFX:OFF</button>
      <a class="hbtn" href="${SITE.repo}" target="_blank" rel="noopener noreferrer" title="Source code" aria-label="Source code">${icon("github", { size: 14 })}</a>
    </nav>
  `;

  const main = body.querySelector("main") ?? body.firstElementChild;
  body.insertBefore(header, main);

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

function applyCrt(on) {
  document.documentElement.classList.toggle("crt-on", Boolean(on));
  document.querySelectorAll("[data-crt-toggle]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(Boolean(on)));
  });
}

function applyPhosphor(id) {
  const mode = PHOSPHORS.some((p) => p.id === id) ? id : "full";
  if (mode === "full") document.documentElement.removeAttribute("data-phosphor");
  else document.documentElement.dataset.phosphor = mode;
  document.querySelectorAll("[data-phosphor-toggle]").forEach((btn) => {
    btn.textContent = `PHOS:${PHOSPHORS.find((p) => p.id === mode).label}`;
  });
}

function wireToggles(header) {
  setSoundEnabled(prefs.get("sound", false));
  const soundBtn = header.querySelector("[data-sound-toggle]");
  const crtBtn = header.querySelector("[data-crt-toggle]");
  const phosBtn = header.querySelector("[data-phosphor-toggle]");

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

  crtBtn.setAttribute("aria-pressed", String(prefs.get("crt", true)));
  crtBtn.addEventListener("click", () => {
    const next = !document.documentElement.classList.contains("crt-on");
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

  const timer = setTimeout(dismiss, duration);
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
  activeModal?.close();

  const previouslyFocused = document.activeElement;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const buttons = actions
    .map(
      (a, i) =>
        `<button type="button" class="btn ${a.variant ? `btn--${a.variant}` : ""}" data-action="${i}">${escapeHtml(a.label)}</button>`
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
  document.body.style.overflow = "hidden";

  let resolveAction = null;
  const settled = new Promise((resolve) => {
    resolveAction = resolve;
  });

  function close(result = null) {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    document.body.style.overflow = "";
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
      action?.onClick?.();
      close(action.id ?? action.label);
    }
  });

  function onKeydown(event) {
    if (event.key === "Escape" && dismissible) {
      event.preventDefault();
      close(null);
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
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
    backdrop.querySelector('[data-action="0"]') ?? backdrop.querySelector("[data-close]") ?? backdrop.querySelector("button");
  primary?.focus();

  settled.finally(() => document.removeEventListener("keydown", onKeydown));
  return { close: wrapped, result: settled };
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
