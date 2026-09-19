import { SITE, games, liveGames } from "./registry.js";
import { icon } from "./icons.js";
import { createPrefStore } from "./storage.js";
import { setSoundEnabled, isSoundEnabled, onSoundStateChange, setVolume, getVolume } from "./sound.js";

const prefs = createPrefStore("prefs");
const BUILD = "2.2.0";

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
    <div class="cosmos__warm"></div>
    <div class="cosmos__scrim"></div>
    <div class="cosmos__grain"></div>`;

  const crt = document.createElement("div");
  crt.className = "crt-overlay";
  crt.setAttribute("aria-hidden", "true");

  body.prepend(skip, cosmos, crt);

  const corner = document.createElement("span");
  corner.className = "corner-note corner-note--tr-top";
  corner.setAttribute("aria-hidden", "true");
  corner.innerHTML = `CORE TEMP: <b data-core-temp>312K</b><br>DISK IO: 1.2MB/S`;
  body.appendChild(corner);

  const online = String(liveGames().length).padStart(2, "0");
  const total = String(games.length).padStart(2, "0");
  const operator = (prefs.get("operator", "AAA") || "AAA").toUpperCase().slice(0, 3);

  const header = document.createElement("header");
  header.className = "shell";
  header.innerHTML = `
    <a class="shell__logo" href="/" aria-label="${escapeHtml(SITE.name)} home">SYS://ARCADE.NET<span class="cursor" aria-hidden="true"></span></a>
    <span class="shell__sys" aria-hidden="true">CORE TEMP: <b data-core-temp>312K</b><br>DISK IO: 1.2MB/S</span>
    <div class="shell__telemetry" aria-label="System telemetry">
      <span class="tele">GAMES ONLINE: [<b data-tele-games>${online}</b>/${total}]</span>
      <span class="tele tele--ok">SYS STATUS: NOMINAL</span>
      <span class="tele">STREAK: [<b data-tele-streak>${pad2(prefs.get("streak", 0))}</b>]</span>
      <span class="tele" data-tele-clock>--:--:--</span>
    </div>
    <nav class="shell__nav" aria-label="Terminal">
      ${showGameLinks ? `<a class="hbtn" href="/" title="All games" aria-label="All games">${icon("gamepad", { size: 14 })}</a>` : ""}
      <button class="hbtn" type="button" data-user-prof>OP:${escapeHtml(operator)}</button>
      <button class="hbtn" type="button" data-sysinfo>SYSINFO</button>
      <button class="hbtn hbtn--logout" type="button" data-logoff>LOGOFF</button>
      ${SITE.repo ? `<a class="hbtn" href="${SITE.repo}" target="_blank" rel="noopener noreferrer" title="Source code" aria-label="Source code">${icon("github", { size: 14 })}</a>` : ""}
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
          <a href="/#about">ABOUT</a>
          ${SITE.repo ? `<a href="${SITE.repo}" target="_blank" rel="noopener noreferrer">SOURCE</a>` : ""}
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

  wireSettings();
  wireHud(header);
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

function crtPref() {
  const raw = prefs.get("crt", "lite");
  if (raw === true) return "lite";
  if (raw === false || raw === "off") return "off";
  if (raw === "full") {
    prefs.set("scan", "full");
    prefs.set("crt", "lite");
    return "lite";
  }
  return "lite";
}

function scanPref() {
  return prefs.get("scan", "lite") === "full" ? "full" : "lite";
}

function setSwitch(selector, on) {
  document.querySelectorAll(selector).forEach((el) => {
    el.setAttribute("aria-checked", String(on));
    el.classList.toggle("is-on", on);
  });
}

function applyCrt(mode) {
  const on = mode !== "off";
  document.documentElement.classList.toggle("crt-lite", on);
  setSwitch("[data-crt-toggle]", on);
}

function applyScan(mode) {
  const heavy = mode === "full";
  document.documentElement.classList.toggle("crt-full", heavy);
  setSwitch("[data-scan-toggle]", heavy);
}

function applyPhosphor(mode) {
  const on = mode === "amber" || mode === "green" || mode === "cyan";
  if (on) document.documentElement.dataset.phosphor = mode;
  else document.documentElement.removeAttribute("data-phosphor");
  setSwitch("[data-phosphor-toggle]", on);
}

function wireSettings() {
  setSoundEnabled(prefs.get("sound", false) === true);
  setVolume(prefs.get("volume", 1));
  applyCrt(crtPref());
  applyScan(scanPref());
  applyPhosphor(prefs.get("phosphor", "full"));
}

function wireModalSettings(modalEl) {
  if (!modalEl) return;
  setSwitch("[data-crt-toggle]", crtPref() !== "off");
  setSwitch("[data-scan-toggle]", scanPref() === "full");
  setSwitch("[data-phosphor-toggle]", document.documentElement.hasAttribute("data-phosphor"));
  setSwitch("[data-sound-toggle]", isSoundEnabled());

  const crtBtn = modalEl.querySelector("[data-crt-toggle]");
  const scanBtn = modalEl.querySelector("[data-scan-toggle]");
  const phosBtn = modalEl.querySelector("[data-phosphor-toggle]");
  const soundBtn = modalEl.querySelector("[data-sound-toggle]");
  const volSlider = modalEl.querySelector("[data-volume]");
  if (!crtBtn || !scanBtn || !phosBtn || !soundBtn) return;

  crtBtn.addEventListener("click", () => {
    const on = crtBtn.getAttribute("aria-checked") === "true";
    prefs.set("crt", on ? "off" : "lite");
    applyCrt(on ? "off" : "lite");
  });
  scanBtn.addEventListener("click", () => {
    const heavy = scanBtn.getAttribute("aria-checked") === "true";
    prefs.set("scan", heavy ? "lite" : "full");
    applyScan(heavy ? "lite" : "full");
  });
  phosBtn.addEventListener("click", () => {
    const on = phosBtn.getAttribute("aria-checked") === "true";
    prefs.set("phosphor", on ? "full" : "amber");
    applyPhosphor(on ? "full" : "amber");
  });
  soundBtn.addEventListener("click", () => {
    prefs.set("sound", setSoundEnabled(!isSoundEnabled()));
    setSwitch("[data-sound-toggle]", isSoundEnabled());
  });
  if (volSlider) {
    volSlider.value = String(Math.round(getVolume() * 100));
    volSlider.addEventListener("input", () => {
      prefs.set("volume", setVolume(Number(volSlider.value) / 100));
    });
  }
}

function wireHud(header) {
  const sysinfoBtn = header.querySelector("[data-sysinfo]");
  const userBtn = header.querySelector("[data-user-prof]");
  const logoffBtn = header.querySelector("[data-logoff]");

  sysinfoBtn?.addEventListener("click", sysinfoModal);
  userBtn?.addEventListener("click", userProfModal);
  logoffBtn?.addEventListener("click", logoff);
}

export function getOperator() {
  return (prefs.get("operator", "AAA") || "AAA").toUpperCase().slice(0, 3);
}

export function setOperator(value) {
  const op = String(value || "AAA").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "A");
  prefs.set("operator", op);
  document.querySelectorAll("[data-user-prof]").forEach((el) => {
    el.textContent = `OP:${op}`;
  });
  return op;
}

function storageBytes() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) ?? "";
      const v = localStorage.getItem(k) ?? "";
      bytes += (k.length + v.length) * 2;
    }
  } catch {
    bytes = 0;
  }
  return bytes;
}

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sysinfoModal() {
  const kb = fmtBytes(storageBytes());
  const { el: modalEl } = openModal({
    title: "SYSINFO",
    body: `
      <table class="hs-table">
        <tbody>
          <tr><th scope="row">BUILD</th><td>${escapeHtml(BUILD)}</td></tr>
          <tr><th scope="row">GAMES ONLINE</th><td>${liveGames().length}/${games.length}</td></tr>
          <tr><th scope="row">OPERATOR</th><td>${escapeHtml(getOperator())}</td></tr>
          <tr><th scope="row">STREAK</th><td>${pad2(prefs.get("streak", 0))} DAYS</td></tr>
          <tr><th scope="row">LOCAL STORAGE</th><td>${escapeHtml(kb)}</td></tr>
        </tbody>
      </table>
      <h3 class="modal__sub">DISPLAY + SOUND</h3>
      <div class="settings-grid">
        <button class="setrow" type="button" data-crt-toggle role="switch" aria-checked="false" aria-label="Toggle scanlines"><span class="setrow__sw"><span></span></span><span>SCANLINES</span></button>
        <button class="setrow" type="button" data-scan-toggle role="switch" aria-checked="false" aria-label="Toggle heavy scanlines"><span class="setrow__sw"><span></span></span><span>HEAVY SCAN</span></button>
        <button class="setrow" type="button" data-phosphor-toggle role="switch" aria-checked="false" aria-label="Toggle phosphor tint"><span class="setrow__sw"><span></span></span><span>PHOSPHOR</span></button>
        <button class="setrow" type="button" data-sound-toggle role="switch" aria-checked="false" aria-label="Toggle sound"><span class="setrow__sw"><span></span></span><span>SOUND</span></button>
        <label class="setrow setrow--slider">VOLUME <input type="range" data-volume min="0" max="100" value="100" aria-label="Sound volume" /></label>
      </div>
      <p class="modal__hint">Everything runs in this browser. No data leaves the terminal.</p>
    `,
    actions: [{ id: "close", label: "Close", variant: "primary" }],
  });
  wireModalSettings(modalEl);
}

function userProfModal() {
  const current = getOperator();
  const streak = Number(getStreak()) || 0;
  const fameCount = (() => {
    try {
      const raw = localStorage.getItem("timesink:mars-base-fame:save");
      const list = raw ? JSON.parse(raw)?.data : [];
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  })();
  openModal({
    title: "OPERATOR PROFILE",
    body: `
      <p>Enter your three-letter operator call sign. It is stored locally and pre-fills the halls of fame.</p>
      <dl class="recap">
        <div><dt>CALL SIGN</dt><dd>${escapeHtml(current)}</dd></div>
        <div><dt>DAILY STREAK</dt><dd>${streak} DAY${streak === 1 ? "" : "S"}</dd></div>
        <div><dt>FAME ENTRIES</dt><dd>${fameCount}/5</dd></div>
      </dl>
      <div class="hs-entry">
        <input id="operator-input" maxlength="3" value="${escapeHtml(current)}" aria-label="Operator call sign" />
      </div>
    `,
    actions: [
      {
        id: "save",
        label: "Save call sign",
        variant: "primary",
        onClick: () => {
          const input = document.querySelector("#operator-input");
          setOperator(input?.value ?? "AAA");
        },
      },
      { id: "close", label: "Cancel", variant: "ghost" },
    ],
  });
}

function logoff() {
  if (document.querySelector(".logoff")) return;
  const overlay = document.createElement("div");
  overlay.className = "logoff";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Session ended");
  overlay.setAttribute("tabindex", "-1");
  overlay.innerHTML = `
    <p class="logoff__eyebrow">SESSION ENDED</p>
    <p class="logoff__line">LOG OFF COMPLETE — TERMINAL DETACHED</p>
    <p class="logoff__hint">PRESS ANY KEY TO RE-INITIALIZE<span class="cursor" aria-hidden="true"></span></p>
  `;
  document.body.appendChild(overlay);
  overlay.focus();

  function dismiss() {
    window.removeEventListener("keydown", onKey);
    overlay.remove();
  }
  function onKey() {
    dismiss();
  }
  overlay.addEventListener("click", dismiss);
  window.addEventListener("keydown", onKey);
}

const sessionStarted = Date.now();

function startClock() {
  let temp = 312;
  const tick = () => {
    if (document.hidden) return;
    const s = Math.floor((Date.now() - sessionStarted) / 1000);
    const text = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map((v) => String(v).padStart(2, "0"))
      .join(":");
    document.querySelectorAll("[data-tele-clock]").forEach((el) => {
      el.textContent = text;
    });
    temp = Math.min(318, Math.max(306, temp + (Math.random() < 0.5 ? -1 : 1)));
    document.querySelectorAll("[data-core-temp]").forEach((el) => {
      el.textContent = `${temp}K`;
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
  tone = null,
  onClose = null,
}) {
  if (activeModal) {
    if (activeModal.dismissible === false) return { close: () => {}, el: null, result: Promise.resolve(null) };
    activeModal.close(null);
  }

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
    <div class="modal${tone === "danger" ? " modal--danger" : tone === "ok" ? " modal--ok" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
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
    document.querySelector(".deck")?.removeAttribute("inert");
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

  activeModal = { close: wrapped, el: backdrop, dismissible, result: settled };
  document.querySelector(".deck")?.setAttribute("inert", "");

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
    tone: danger ? "danger" : null,
    actions: [
      { id: true, label: confirmLabel, variant: danger ? "danger" : "primary" },
      { id: false, label: cancelLabel, variant: "ghost" },
    ],
  });
  return result.then((value) => value === true);
}
