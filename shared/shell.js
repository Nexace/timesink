import { SITE } from "./registry.js";
import { icon } from "./icons.js";
import { createPrefStore } from "./storage.js";
import { setSoundEnabled, isSoundEnabled, onSoundStateChange } from "./sound.js";

const prefs = createPrefStore("prefs");

const LOGO_MARK = `<svg class="shell__mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-6.5 8v7.6L9.5 22v-10L3 4Z"/></svg>`;

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

  body.classList.add("shell-mounted");

  const starfield = document.createElement("div");
  starfield.className = "starfield";
  starfield.setAttribute("aria-hidden", "true");

  const scanlines = document.createElement("div");
  scanlines.className = "scanlines";
  scanlines.setAttribute("aria-hidden", "true");

  const skip = document.createElement("a");
  skip.className = "skip-link";
  skip.href = "#main";
  skip.textContent = "Skip to content";

  body.prepend(skip, starfield, scanlines);

  const header = document.createElement("header");
  header.className = "shell";
  header.innerHTML = `
    <a class="shell__logo" href="/" aria-label="${escapeHtml(SITE.name)} home">
      ${LOGO_MARK}
      <span>${escapeHtml(SITE.name)}</span>
    </a>
    ${crumb ? renderCrumb(crumb) : ""}
    <nav class="shell__nav" aria-label="Site">
      ${showGameLinks ? `<a class="btn btn--ghost btn--icon" href="/" title="All games" aria-label="All games">${icon("gamepad")}</a>` : ""}
      <button class="btn btn--ghost btn--icon" type="button" data-sound-toggle title="Toggle sound" aria-label="Toggle sound" aria-pressed="false"></button>
      <a class="btn btn--ghost btn--icon" href="${SITE.repo}" target="_blank" rel="noopener noreferrer" title="Source code" aria-label="Source code">${icon("github")}</a>
    </nav>
  `;

  const main = body.querySelector("main") ?? body.firstElementChild;
  body.insertBefore(header, main);

  const footer = document.createElement("footer");
  footer.className = "footer";
  footer.innerHTML = `
    <div class="footer__inner">
      <div class="footer__links">
        <a href="/">All games</a>
        <a href="#about">About</a>
        <a href="${SITE.repo}" target="_blank" rel="noopener noreferrer">Source</a>
      </div>
      <p>${escapeHtml(SITE.tagline)}</p>
      <p>Hand-built with plain HTML, CSS, and JavaScript. No frameworks, no trackers.</p>
    </div>
  `;
  body.appendChild(footer);

  const toastStack = document.createElement("div");
  toastStack.className = "toast-stack";
  toastStack.setAttribute("role", "status");
  toastStack.setAttribute("aria-live", "polite");
  body.appendChild(toastStack);

  setSoundEnabled(prefs.get("sound", false));
  const soundBtn = header.querySelector("[data-sound-toggle]");

  function syncSoundButton() {
    const on = isSoundEnabled();
    soundBtn.innerHTML = on ? icon("volume-on") : icon("volume-off");
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.title = on ? "Sound on" : "Sound off";
  }
  syncSoundButton();
  onSoundStateChange(syncSoundButton);

  soundBtn.addEventListener("click", () => {
    const next = setSoundEnabled(!isSoundEnabled());
    prefs.set("sound", next);
    syncSoundButton();
  });

  document.documentElement.classList.add("js");
  return { header, footer, toastStack };
}

function renderCrumb(crumb) {
  if (typeof crumb === "string") {
    return `<span class="shell__crumb"><span class="shell__crumb-sep">/</span><span class="shell__crumb-current">${escapeHtml(crumb)}</span></span>`;
  }
  const parts = crumb
    .map((part) =>
      part.href
        ? `<a href="${escapeHtml(part.href)}">${escapeHtml(part.label)}</a>`
        : `<span class="shell__crumb-current">${escapeHtml(part.label)}</span>`
    )
    .join('<span class="shell__crumb-sep">/</span>');
  return `<span class="shell__crumb">${parts}</span>`;
}

export function toast({ title, body = "", icon: iconName = "sparkle", duration = 3400, tone = null } = {}) {
  const stack = document.querySelector(".toast-stack");
  if (!stack) return null;

  const el = document.createElement("div");
  el.className = "toast";
  if (tone) el.dataset.tone = tone;
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
    if (!el.isConnected) return;
    el.classList.add("toast--out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
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
        ${dismissible ? `<button type="button" class="btn btn--ghost btn--icon modal__close" data-close aria-label="Close">${icon("close")}</button>` : ""}
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
  const originalClose = close;
  const wrapped = (result) => {
    document.removeEventListener("keydown", onKeydown);
    originalClose(result);
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
