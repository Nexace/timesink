import { SITE, games, liveGames, getGame, getHowToPlay } from "./registry.js";
import { icon } from "./icons.js";
import { createPrefStore } from "./storage.js";
import { sfx, setSoundEnabled, isSoundEnabled, onSoundStateChange, setVolume, getVolume } from "./sound.js";
import { dailySeedKey, isStreakActive } from "./rng.js";

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

export function initShell({ crumb = null, showGameLinks = true, howToPlay = null } = {}) {
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
  if (body.dataset.page === "game") setupFullscreen();

  const online = String(liveGames().length).padStart(2, "0");
  const total = String(games.length).padStart(2, "0");
  const operator = (prefs.get("operator", "AAA") || "AAA").toUpperCase().slice(0, 3);

  const header = document.createElement("header");
  header.className = "shell";
  header.innerHTML = `
    <a class="shell__logo" href="/" aria-label="${escapeHtml(SITE.name)} home">SYS://TIMESINK.NET</a>
    <div class="shell__telemetry" aria-label="System telemetry">
      <span class="tele">GAMES_ONLINE: [<b data-tele-games>${online}</b>/${total}]</span>
      <span class="tele tele--ok"><span class="led led--green" aria-hidden="true"></span>SYS_STATUS: NOMINAL</span>
      <button class="tele tele--btn" type="button" data-streak-btn title="Operator Daily Streak Status" aria-label="Daily streak status">STREAK: [<b data-tele-streak>${pad2(getStreak())}</b>]</button>
      <span class="tele">TIME: <b data-tele-clock>00:00:00</b></span>
    </div>
    <nav class="shell__nav" aria-label="Terminal">
      ${showGameLinks ? `<a class="hbtn" href="/" title="All games" aria-label="All games">${icon("gamepad", { size: 14 })}</a>` : ""}
      <button class="hbtn hbtn--sound" type="button" data-sound-hud title="Toggle Audio (MUTE/UNMUTE)" aria-label="Toggle Sound">SFX: [<b data-sound-state>ON</b>]</button>
      <button class="hbtn hbtn--more" type="button" data-shell-more aria-expanded="false" aria-label="More options" title="More">&#8943;</button>
      <button class="hbtn hbtn--sysinfo" type="button" data-sysinfo>SYSINFO</button>
      <button class="hbtn hbtn--prof" type="button" data-user-prof>USER-PROF</button>
      <button class="hbtn hbtn--logout" type="button" data-logoff>LOGOFF</button>
      ${SITE.repo ? `<a class="hbtn" href="${SITE.repo}" target="_blank" rel="noopener noreferrer" title="Source code" aria-label="Source code">${icon("github", { size: 14 })}</a>` : ""}
    </nav>
  `;

  if (document.querySelector("header.shell")) return document.querySelector("header.shell");

  const main = body.querySelector("main");
  if (main) body.insertBefore(header, main);
  else body.appendChild(header);

  // Phones: SYSINFO / USER-PROF / LOGOFF fold into a ⋯ menu so the header stays one line
  const nav = header.querySelector(".shell__nav");
  const more = header.querySelector("[data-shell-more]");
  const setMore = (open) => {
    nav.classList.toggle("is-open", open);
    more.setAttribute("aria-expanded", String(open));
  };
  more.addEventListener("click", (e) => {
    e.stopPropagation();
    setMore(!nav.classList.contains("is-open"));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("[data-sysinfo], [data-user-prof], [data-logoff]")) setMore(false);
  });
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target)) setMore(false);
  });

  const isGamePage = window.location.pathname.includes("/games/") || crumb !== null;
  let game = null;
  if (crumb) {
    game = games.find((g) => g.title.toLowerCase() === crumb.toLowerCase() || g.slug === crumb.toLowerCase());
  }
  if (!game) {
    const match = window.location.pathname.match(/\/games\/([^/]+)/);
    if (match) game = getGame(match[1]);
  }
  const htp = howToPlay || getHowToPlay(game || crumb || "Game");

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
      <div class="footer__terminal" id="footer-terminal">
        <div class="terminal-log" id="terminal-log" hidden>
          <div class="terminal-log__header">
            <span>TERMINAL CONSOLE // SYS://TIMESINK.NET</span>
            <button type="button" class="terminal-log__close" id="terminal-log-close" title="Close console" aria-label="Close terminal">✕</button>
          </div>
          <div class="terminal-log__body" id="terminal-log-body"></div>
        </div>
        <div class="footer__prompt" id="footer-prompt-bar">
          <label for="footer-terminal-input" class="footer__prompt-label">&gt; guest@terminal:~$</label>
          <form class="footer__prompt-form" id="footer-terminal-form" action="javascript:void(0)">
            <input
              type="text"
              class="footer__prompt-input"
              id="footer-terminal-input"
              placeholder="Type /help for options..."
              aria-label="Terminal command input"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            />
          </form>
          <div class="footer__prompt-actions" id="footer-prompt-actions"></div>
        </div>
      </div>
    </div>
  `;
  body.appendChild(footer);

  const toastStack = document.createElement("div");
  toastStack.className = "toast-stack";
  toastStack.setAttribute("role", "status");
  toastStack.setAttribute("aria-live", "polite");
  body.appendChild(toastStack);

  let setHtpExpanded = null;
  if (isGamePage && !document.getElementById("how-to-play-widget")) {
    const footerTerminal = footer.querySelector("#footer-terminal");
    const htpResult = createHowToPlayWidget(game?.title || crumb || "This Game", htp, footerTerminal);
    footerTerminal.insertBefore(htpResult.container, footer.querySelector("#footer-prompt-bar"));
    setHtpExpanded = htpResult.setExpanded;
  }

  wireTerminal({ footer, game, htp, setHtpExpanded });

  wireSettings();
  wireHud(header);
  startClock();
  document.documentElement.classList.add("js");
  return { header, footer, toastStack };
}

function wireTerminal({ footer, game, htp, setHtpExpanded }) {
  const input = footer.querySelector("#footer-terminal-input");
  const form = footer.querySelector("#footer-terminal-form");
  const log = footer.querySelector("#terminal-log");
  const logBody = footer.querySelector("#terminal-log-body");
  const closeBtn = footer.querySelector("#terminal-log-close");

  if (!input || !form || !log || !logBody) return;

  // Prevent in-game controls from triggering while typing in terminal input
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      input.blur();
    }
  });
  input.addEventListener("keyup", (e) => e.stopPropagation());
  input.addEventListener("keypress", (e) => e.stopPropagation());

  closeBtn?.addEventListener("click", () => {
    sfx.click();
    log.hidden = true;
  });

  function printOutput(htmlContent) {
    logBody.innerHTML = htmlContent;
    log.hidden = false;
    log.scrollTop = log.scrollHeight;

    // Wire up any clickable command buttons inside terminal output
    logBody.querySelectorAll(".term-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cmd = btn.dataset.termCmd;
        if (cmd) executeCommand(cmd);
      });
    });
  }

  function executeCommand(rawCmd) {
    const cmd = rawCmd.trim().toLowerCase();
    sfx.click();

    if (cmd === "/clear" || cmd === "clear" || cmd === "cls") {
      logBody.innerHTML = "";
      log.hidden = true;
      return;
    }

    if (cmd === "/help" || cmd === "help" || cmd === "?") {
      const title = game?.title || "Active Game";
      printOutput(`
        <div class="term-line term-title">=== SYS://TIMESINK TERMINAL -- HELP &amp; COMMAND DIRECTORY ===</div>
        <div class="term-line term-subtitle">MODULE: <b>${escapeHtml(title.toUpperCase())}</b></div>
        <div class="term-line" style="margin-top:6px;color:var(--dim);">Select an option below or type a command:</div>
        <div class="term-options-grid">
          <button type="button" class="term-opt-btn" data-term-cmd="/tutorial">
            <b>1. /tutorial</b>
            <span>Step-by-step tutorial &amp; walkthrough</span>
          </button>
          <button type="button" class="term-opt-btn" data-term-cmd="/controls">
            <b>2. /controls</b>
            <span>Keybindings, touch zones, &amp; inputs</span>
          </button>
          <button type="button" class="term-opt-btn" data-term-cmd="/howtoplay">
            <b>3. /howtoplay</b>
            <span>Objective, scoring &amp; manual</span>
          </button>
          <button type="button" class="term-opt-btn" data-term-cmd="/info">
            <b>4. /info</b>
            <span>Game specifications, tags, &amp; version</span>
          </button>
          <button type="button" class="term-opt-btn" data-term-cmd="/restart">
            <b>5. /restart</b>
            <span>Restart active game run</span>
          </button>
          <button type="button" class="term-opt-btn" data-term-cmd="/clear">
            <b>6. /clear</b>
            <span>Clear terminal buffer</span>
          </button>
        </div>
      `);
      return;
    }

    if (cmd === "/restart" || cmd === "restart" || cmd === "/reset" || cmd === "reset") {
      printOutput(`
        <div class="term-line term-title">--- RESTARTING SESSION ---</div>
        <div class="term-line" style="color:var(--green,#00ff66);">Reinitializing game state...</div>
      `);
      window.dispatchEvent(new CustomEvent("arcade:restart"));
      if (typeof window.restartGame === "function") {
        window.restartGame();
      } else if (typeof window.game?.restart === "function") {
        window.game.restart();
      } else {
        setTimeout(() => window.location.reload(), 300);
      }
      return;
    }

    if (cmd === "/tutorial" || cmd === "tutorial") {
      const title = game?.title || "Game";
      const steps = (htp?.steps || []).map((s, i) => `<div class="term-line"><b>${i + 1}.</b> ${escapeHtml(s)}</div>`).join("");
      const tip = htp?.tip ? `<div class="term-line term-tip" style="margin-top:6px;color:var(--accent);"><b>💡 PRO TIP:</b> ${escapeHtml(htp.tip)}</div>` : "";
      printOutput(`
        <div class="term-line term-title">--- ${escapeHtml(title.toUpperCase())} TUTORIAL ---</div>
        ${steps || "<div class='term-line'>No tutorial steps available.</div>"}
        ${tip}
      `);
      return;
    }

    if (cmd === "/controls" || cmd === "controls") {
      const title = game?.title || "Game";
      const controlsText = htp?.controls || "Arrow Keys / WASD, Space, Escape (Pause)";
      printOutput(`
        <div class="term-line term-title">--- ${escapeHtml(title.toUpperCase())} CONTROLS ---</div>
        <div class="term-line" style="margin-top:4px;">${escapeHtml(controlsText)}</div>
        <div class="term-line" style="margin-top:6px;color:var(--dim);">ESC: Pause Game | Touch / Virtual buttons available on mobile</div>
      `);
      return;
    }

    if (cmd === "/howtoplay" || cmd === "howtoplay" || cmd === "/howto" || cmd === "howto") {
      const title = game?.title || "Game";
      printOutput(`
        <div class="term-line term-title">--- HOW TO PLAY: ${escapeHtml(title.toUpperCase())} ---</div>
        <div class="term-line" style="margin-top:4px;"><b>OBJECTIVE:</b> ${escapeHtml(htp?.goal || "")}</div>
        <div class="term-line" style="margin-top:4px;color:var(--green);">Opening full How To Play manual...</div>
      `);
      if (setHtpExpanded) setHtpExpanded(true);
      return;
    }

    if (cmd === "/info" || cmd === "info") {
      const title = game?.title || "Arcade Game";
      printOutput(`
        <div class="term-line term-title">--- ${escapeHtml(title.toUpperCase())} INFORMATION ---</div>
        <div class="term-line"><b>TITLE:</b> ${escapeHtml(title)}</div>
        <div class="term-line"><b>SLUG:</b> ${escapeHtml(game?.slug || "N/A")}</div>
        <div class="term-line"><b>GENRE:</b> ${escapeHtml((game?.kind || "arcade").toUpperCase())}</div>
        <div class="term-line"><b>TAGS:</b> ${escapeHtml((game?.tags || []).join(", ") || "arcade, retro")}</div>
        <div class="term-line"><b>VERSION:</b> ${escapeHtml(game?.version || "1.0.0")}</div>
        <div class="term-line"><b>STATUS:</b> ${escapeHtml(game?.status || "LIVE")}</div>
        <div class="term-line" style="margin-top:4px;"><b>SUMMARY:</b> ${escapeHtml(game?.tagline || htp?.goal || "")}</div>
      `);
      return;
    }

    if (cmd === "/games" || cmd === "games") {
      const list = games.map(g => `<span style="color:var(--accent);">${escapeHtml(g.title)}</span> (${escapeHtml(g.slug)})`).join(" • ");
      printOutput(`
        <div class="term-line term-title">--- TIMESINK.NET CATALOG (18 GAMES) ---</div>
        <div class="term-line" style="margin-top:4px;line-height:1.6;">${list}</div>
      `);
      return;
    }

    // Unrecognized command
    printOutput(`
      <div class="term-line" style="color:var(--red,#ff4444);">Command not recognized: "${escapeHtml(rawCmd)}"</div>
      <div class="term-line" style="color:var(--dim);">Type <b>/help</b> to view tutorial, controls, how to play, and game info options.</div>
    `);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    executeCommand(val);
    input.value = "";
  });
}

function createHowToPlayWidget(title, htp, footerTerminal) {
  const container = document.createElement("div");
  container.className = "how-to-play-widget";
  container.id = "how-to-play-widget";

  let isCollapsed = true;
  try {
    const saved = localStorage.getItem("timesink:htp-collapsed");
    if (saved !== null) {
      isCollapsed = saved === "1";
    } else {
      isCollapsed = true;
    }
  } catch {}

  if (isCollapsed) {
    container.classList.add("is-collapsed");
  }

  const stepsList = (htp.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("");

  container.innerHTML = `
    <aside class="htp-panel" id="htp-panel" role="region" aria-label="How to play instructions" ${isCollapsed ? 'hidden style="display:none;"' : ""}>
      <div class="htp-header">
        <span class="htp-title"><span class="htp-icon" aria-hidden="true">🕹️</span> HOW TO PLAY: ${escapeHtml(title.toUpperCase())}</span>
        <button class="htp-close-btn" type="button" aria-label="Minimize instructions" title="Minimize instructions">✕</button>
      </div>
      <div class="htp-body">
        <div class="htp-section htp-goal">
          <span class="htp-tag">OBJECTIVE</span>
          <p class="htp-text">${escapeHtml(htp.goal || "")}</p>
        </div>
        <div class="htp-section htp-steps">
          <span class="htp-tag">HOW TO PLAY</span>
          <ol class="htp-list">
            ${stepsList}
          </ol>
        </div>
        ${htp.controls ? `
        <div class="htp-section htp-controls">
          <span class="htp-tag">CONTROLS</span>
          <p class="htp-controls-text">${escapeHtml(htp.controls)}</p>
        </div>` : ""}
        ${htp.tip ? `
        <div class="htp-section htp-tip">
          <span class="htp-tip-label">💡 PRO TIP:</span>
          <span class="htp-tip-text">${escapeHtml(htp.tip)}</span>
        </div>` : ""}
      </div>
    </aside>
  `;

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "htp-toggle-btn";
  toggleBtn.type = "button";
  toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
  toggleBtn.setAttribute("aria-controls", "htp-panel");
  toggleBtn.setAttribute("title", "Toggle How to Play");
  toggleBtn.innerHTML = `
    <span class="htp-badge-icon" aria-hidden="true">?</span>
    <span class="htp-toggle-label">HOW TO PLAY</span>
    <span class="htp-toggle-indicator" aria-hidden="true">${isCollapsed ? "▲" : "▼"}</span>
  `;

  // Place toggle button directly inside the footer prompt actions (the bottom text box)!
  const promptActions = footerTerminal?.querySelector("#footer-prompt-actions");
  if (promptActions) {
    promptActions.appendChild(toggleBtn);
  } else {
    container.prepend(toggleBtn);
  }

  const closeBtn = container.querySelector(".htp-close-btn");
  const panel = container.querySelector(".htp-panel");
  const indicator = toggleBtn.querySelector(".htp-toggle-indicator");

  function setExpanded(expanded) {
    if (expanded) {
      container.classList.remove("is-collapsed");
      panel.removeAttribute("hidden");
      panel.style.display = "block";
      toggleBtn.setAttribute("aria-expanded", "true");
      indicator.textContent = "▼";
      try { localStorage.removeItem("timesink:htp-collapsed"); } catch {}
    } else {
      container.classList.add("is-collapsed");
      panel.setAttribute("hidden", "");
      panel.style.display = "none";
      toggleBtn.setAttribute("aria-expanded", "false");
      indicator.textContent = "▲";
      try { localStorage.setItem("timesink:htp-collapsed", "1"); } catch {}
    }
  }

  toggleBtn.addEventListener("click", () => {
    sfx.click();
    const currentlyCollapsed = container.classList.contains("is-collapsed");
    setExpanded(currentlyCollapsed);
  });

  closeBtn.addEventListener("click", () => {
    sfx.click();
    setExpanded(false);
  });

  return { container, setExpanded };
}

function pad2(n) {
  return String(Math.max(0, Math.min(99, n))).padStart(2, "0");
}

export function setStreak(n) {
  prefs.set("streak", n);
  const best = Math.max(n, Number(prefs.get("streakBest", 0)) || 0);
  prefs.set("streakBest", best);
  document.querySelectorAll("[data-tele-streak]").forEach((el) => {
    el.textContent = pad2(n);
  });
}

export function getStreak() {
  const raw = Number(prefs.get("streak", 0)) || 0;
  if (raw <= 0) return 0;
  const last = prefs.get("mars-base:lastDaily", "");
  if (!isStreakActive(last)) {
    prefs.set("streak", 0);
    return 0;
  }
  return raw;
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
  setSoundEnabled(prefs.get("sound", true) === true);
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
    sfx.click();
    const on = crtBtn.getAttribute("aria-checked") === "true";
    prefs.set("crt", on ? "off" : "lite");
    applyCrt(on ? "off" : "lite");
  });
  scanBtn.addEventListener("click", () => {
    sfx.click();
    const heavy = scanBtn.getAttribute("aria-checked") === "true";
    prefs.set("scan", heavy ? "lite" : "full");
    applyScan(heavy ? "lite" : "full");
  });
  phosBtn.addEventListener("click", () => {
    sfx.click();
    const on = phosBtn.getAttribute("aria-checked") === "true";
    prefs.set("phosphor", on ? "full" : "amber");
    applyPhosphor(on ? "full" : "amber");
  });
  soundBtn.addEventListener("click", () => {
    const next = !isSoundEnabled();
    prefs.set("sound", setSoundEnabled(next));
    setSwitch("[data-sound-toggle]", next);
    if (next) sfx.good();
    else sfx.click();
  });
  if (volSlider) {
    volSlider.value = String(Math.round(getVolume() * 100));
    volSlider.addEventListener("input", () => {
      prefs.set("volume", setVolume(Number(volSlider.value) / 100));
    });
  }
}

function wireHud(header) {
  const streakBtn = header.querySelector("[data-streak-btn]");
  const sysinfoBtn = header.querySelector("[data-sysinfo]");
  const userBtn = header.querySelector("[data-user-prof]");
  const logoffBtn = header.querySelector("[data-logoff]");
  const soundHudBtn = header.querySelector("[data-sound-hud]");

  const syncSoundHud = (on) => {
    const el = header.querySelector("[data-sound-state]");
    if (el) el.textContent = on ? "ON" : "OFF";
    soundHudBtn?.classList.toggle("hbtn--sound-on", on);
    soundHudBtn?.setAttribute("aria-pressed", on ? "true" : "false");
  };
  syncSoundHud(isSoundEnabled());
  onSoundStateChange(syncSoundHud);

  soundHudBtn?.addEventListener("click", () => {
    const next = !isSoundEnabled();
    prefs.set("sound", setSoundEnabled(next));
    setSwitch("[data-sound-toggle]", next);
    syncSoundHud(next);
    if (next) sfx.coin();
    else sfx.click();
  });

  streakBtn?.addEventListener("click", () => { sfx.click(); streakModal(); });
  sysinfoBtn?.addEventListener("click", () => { sfx.click(); sysinfoModal(); });
  userBtn?.addEventListener("click", () => { sfx.click(); userProfModal(); });
  logoffBtn?.addEventListener("click", () => { sfx.click(); logoff(); });

  header.addEventListener("pointerover", (e) => {
    if (e.target.closest("button.hbtn, a.hbtn, button.tele--btn")) {
      sfx.hover();
    }
  });
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

export function streakModal() {
  const currentStreak = getStreak();
  const bestStreak = Math.max(currentStreak, Number(prefs.get("streakBest", 0)) || 0);
  const lastDaily = prefs.get("mars-base:lastDaily", "");
  const today = dailySeedKey();
  const isCompletedToday = lastDaily === today;

  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const msRemaining = Math.max(0, nextReset.getTime() - now.getTime());
  const hours = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const resetStr = `${hours}H ${minutes}M`;

  const statusTone = isCompletedToday ? "ok" : "warn";
  const statusLabel = isCompletedToday ? "LOGGED // COMPLETED" : "PENDING // DUE TODAY";

  openModal({
    title: "OPERATOR DAILY STREAK",
    tone: isCompletedToday ? "ok" : null,
    body: `
      <p>Daily missions test your colony survival against a shared deterministic cosmic seed.</p>
      <dl class="recap">
        <div><dt>CURRENT STREAK</dt><dd><strong>${currentStreak} DAY${currentStreak === 1 ? "" : "S"}</strong></dd></div>
        <div><dt>BEST RECORD</dt><dd>${bestStreak} DAY${bestStreak === 1 ? "" : "S"}</dd></div>
        <div><dt>TODAY'S MISSION</dt><dd><span class="tele tele--${statusTone}">${statusLabel}</span></dd></div>
        <div><dt>NEXT RESET (UTC)</dt><dd>${resetStr}</dd></div>
      </dl>
      <p class="modal__hint">
        ${isCompletedToday
          ? "Today's Daily Sol is logged in terminal records. Your streak is secured. Next seed unlocks at 00:00 UTC."
          : "Complete and win today's Daily Sol in <strong>Mars Base</strong> to increment your streak. Skipping a day resets your streak to zero."}
      </p>
    `,
    actions: [
      ...(!isCompletedToday
        ? [
            {
              id: "play",
              label: "Launch Daily Sol",
              variant: "primary",
              onClick: () => {
                if (window.location.pathname.includes("mars-base")) {
                  const btn = document.querySelector("#btn-daily");
                  if (btn) btn.click();
                  else window.location.search = "?mode=daily";
                } else {
                  window.location.href = "/games/mars-base?mode=daily";
                }
              },
            },
          ]
        : []),
      { id: "close", label: "Close", variant: isCompletedToday ? "primary" : "ghost" },
    ],
  });
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
          <tr><th scope="row">STREAK</th><td>${pad2(getStreak())} DAYS</td></tr>
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
      const raw = localStorage.getItem("timesink:mars-base-fame-v2:save");
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
        <div><dt>FAME ENTRIES</dt><dd>${fameCount}</dd></div>
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
  const tick = () => {
    if (document.hidden) return;
    const s = Math.floor((Date.now() - sessionStarted) / 1000);
    const text = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
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

export function toast(input = {}) {
  let title = "";
  let body = "";
  let iconName = "sparkle";
  let duration = 3400;

  if (typeof input === "string") {
    title = input;
  } else if (input && typeof input === "object") {
    title = input.title ?? "";
    body = input.body ?? "";
    iconName = input.icon ?? "sparkle";
    duration = input.duration ?? 3400;
  }

  const stack = document.querySelector(".toast-stack");
  if (!stack) return null;

  // The same message already on screen just gets its timer refreshed instead of stacking again
  const key = `${title} ${body}`;
  const existing = [...stack.children].find((c) => c.dataset.toastKey === key);
  if (existing && typeof existing._restart === "function") return existing._restart(duration);

  // Keep the stack short (games fire lots of these): the oldest message makes room
  const maxVisible = document.body?.dataset.page === "game" ? 3 : 5;
  while (stack.children.length >= maxVisible) stack.firstElementChild.remove();

  const el = document.createElement("div");
  el.className = "toast";
  el.dataset.toastKey = key;
  el.innerHTML = `
    <span class="toast__icon">${icon(iconName)}</span>
    <span>
      <span class="toast__title">${escapeHtml(title)}</span>
      ${body ? `<span class="toast__body">${escapeHtml(body)}</span>` : ""}
    </span>
  `;
  stack.appendChild(el);

  const toMs = (d) => (Number.isFinite(d) ? Math.min(Math.max(0, d), 2 ** 31 - 1) : 3400);
  let timer = setTimeout(dismiss, toMs(duration));
  function dismiss() {
    clearTimeout(timer);
    if (el.isConnected) el.remove();
  }
  el._restart = (d) => {
    clearTimeout(timer);
    timer = setTimeout(dismiss, toMs(d));
    return dismiss;
  };

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


// Every game page gets a FULLSCREEN toggle in its stage bar. It fullscreens the game's <main> (canvas,
// HUD and controls together); Esc or the button leaves again. Pages with their own toggle keep it.
// ── Fullscreen ──
// One immersive mode for every device: the game fills the screen (on desktop and Android the browser
// also goes truly fullscreen; iPhone has no fullscreen for web pages, so there the layout alone does it),
// the site header / footer / title bar are hidden, the game's canvas area is sized to the screen
// ([data-stage], keeping its shape), its touch controls spread over the whole screen
// ([data-touch-frame]) and its in-game menus open full screen ([data-stage-menu]). Where the browser
// allows it (Android) the browser bars are hidden too.
const coarsePointer = () => !!window.matchMedia?.("(pointer: coarse)").matches;
let immersive = false;
let immersiveBar = null;
let savedScroll = 0;
let rotateHinted = false;

export const isImmersive = () => immersive;

function syncOrientation() {
  document.documentElement.classList.toggle("is-portrait", window.innerHeight > window.innerWidth);
}

export function setImmersive(on) {
  on = !!on;
  if (on === immersive) return;
  immersive = on;
  const html = document.documentElement;
  if (on) {
    savedScroll = window.scrollY;
    // Each stage keeps its game's shape, just bigger: the canvas's own proportions (the page layout
    // may letterbox it), falling back to the stage box
    document.querySelectorAll("[data-stage]").forEach((stage) => {
      const c = stage.querySelector("canvas");
      const r = stage.getBoundingClientRect();
      const ar = c && c.width > 0 && c.height > 0 ? c.width / c.height : r.height > 0 ? r.width / r.height : 0;
      if (ar > 0) stage.style.setProperty("--stage-ar", ar.toFixed(4));
    });
    html.classList.add("is-immersive");
    const req = html.requestFullscreen || html.webkitRequestFullscreen;
    if (req && !(document.fullscreenElement || document.webkitFullscreenElement)) {
      try {
        req.call(html)?.catch?.(() => {});
      } catch {
        /* not allowed here: the immersive layout still applies */
      }
    }
    immersiveBar = document.createElement("div");
    immersiveBar.className = "immersive-bar";
    const move = document.querySelector("[data-touch-layout-btn]");
    immersiveBar.innerHTML = `${move ? '<button type="button" class="hbtn" data-imm-move aria-label="Move controls">&#10021; CONTROLS</button>' : ""}<button type="button" class="hbtn" data-imm-exit aria-label="Exit fullscreen">&#10005; EXIT</button>`;
    immersiveBar.querySelector("[data-imm-exit]").addEventListener("click", () => setImmersive(false));
    immersiveBar.querySelector("[data-imm-move]")?.addEventListener("click", () => document.querySelector("[data-touch-layout-btn]")?.click());
    document.body.append(immersiveBar);
  } else {
    html.classList.remove("is-immersive");
    immersiveBar?.remove();
    immersiveBar = null;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs === html) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
  }
  syncOrientation();
  document.querySelectorAll("[data-fullscreen-toggle]").forEach((b) => {
    b.setAttribute("aria-pressed", String(on));
    if (b.dataset.fullscreenToggle === "shell") b.textContent = on ? "EXIT FULLSCREEN" : "⛶ FULLSCREEN";
  });
  window.dispatchEvent(new CustomEvent("immersivechange", { detail: { on } }));
  // Canvas games size themselves from the page: let them re-measure
  window.dispatchEvent(new Event("resize"));
  if (!on) window.scrollTo(0, savedScroll);
  else maybeRotateHint();
}

function maybeRotateHint() {
  if (rotateHinted || window.innerHeight <= window.innerWidth) return;
  const wide = [...document.querySelectorAll("[data-stage]")].some((s) => parseFloat(s.style.getPropertyValue("--stage-ar")) > 1.3);
  if (!wide) return;
  rotateHinted = true;
  toast({ title: "TIP", body: "Turn your phone sideways for a bigger view.", icon: "sparkle", duration: 3500 });
}

function setupFullscreen() {
  const target = document.getElementById("main") || document.querySelector("main");
  if (!target) return;
  syncOrientation();
  window.addEventListener("resize", syncOrientation);
  // Leaving the browser's fullscreen (Esc, Android back gesture) leaves immersive mode too
  const onFsChange = () => {
    if (immersive && !(document.fullscreenElement || document.webkitFullscreenElement)) setImmersive(false);
  };
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  // A game that wires its own fullscreen button (Mars Base) calls setImmersive itself on phones
  if (document.querySelector("[data-fullscreen-toggle]")) return;
  const el = document.documentElement;
  const canFs = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  if (!canFs && !coarsePointer()) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hbtn hbtn--fullscreen";
  btn.dataset.fullscreenToggle = "shell";
  btn.title = "Fullscreen (Esc to exit)";
  btn.addEventListener("click", () => {
    btn.blur();
    setImmersive(!immersive);
  });
  btn.textContent = "⛶ FULLSCREEN";
  btn.setAttribute("aria-pressed", "false");
  const meta = document.querySelector(".stage-bar__meta");
  if (meta) meta.append(btn);
  else {
    btn.classList.add("hbtn--fullscreen-float");
    target.prepend(btn);
  }
}
