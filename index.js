import { initShell, escapeHtml, toast, prefersReducedMotion } from "/shared/shell.js";
import { games, gameHref, liveGames } from "/shared/registry.js";
import { sfx } from "/shared/sound.js";
import { icon } from "/shared/icons.js";

const ACCENTS = {
  flare: "#ff5500",
  cyan: "#00f0ff",
  magenta: "#ff007f",
  lime: "#00ff66",
  violet: "#7b2ff7",
  purple: "#7b2ff7",
  amber: "#ffb700",
  rust: "#ff5500",
};

const MOTIF_ICONS = { dome: "dome", snake: "gamepad", cards: "grid", target: "target" };

initShell();

wireKonami();

bootLog();
renderGrid();
wireGrid(document.getElementById("game-grid"));

function bootLog() {
  const host = document.getElementById("boot-log");
  if (!host) return;
  const live = liveGames().length;
  const lines = [
    "> SYS://ARCADE.NET BIOS v2.1",
    "> MEM CHECK ............ 640K OK",
    `> LOADING CABINET ...... [${live}] ONLINE`,
    "> INSERT COIN_",
  ];
  if (prefersReducedMotion()) {
    host.textContent = lines.join("\n");
    return;
  }
  const full = lines.join("\n");
  let i = 0;
  const timer = setInterval(() => {
    i += 3;
    host.textContent = full.slice(0, i);
    if (i >= full.length) clearInterval(timer);
  }, 24);
}

function visibleGames() {
  return games;
}

function isNew(game) {
  if (!game.added) return false;
  const age = Date.now() - new Date(`${game.added}T00:00:00Z`).getTime();
  return age < 30 * 24 * 3600 * 1000;
}

function renderGrid() {
  const host = document.getElementById("game-grid");
  if (!host) return;
  host.innerHTML = visibleGames().map((g, i) => renderCard(g, i)).join("");
}

function denySoon(soon) {
  sfx.deny();
  toast({
    title: "CARTRIDGE MISSING",
    body: `${soon.dataset.title} is still on the workbench.`,
    icon: "lock",
  });
}

function wireGrid(host) {
  if (!host) return;
  host.addEventListener("click", (event) => {
    const soon = event.target.closest(".card--soon");
    if (soon) {
      event.preventDefault();
      denySoon(soon);
    }
  });

  host.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const soon = event.target.closest(".card--soon");
    if (soon) {
      event.preventDefault();
      denySoon(soon);
    }
  });

  let lastHover = 0;
  host.addEventListener("pointerover", (event) => {
    const now = Date.now();
    if (now - lastHover < 120) return;
    if (event.target.closest(".card:not(.card--soon)")) {
      lastHover = now;
      sfx.hover();
    }
  });
}

function renderCard(game, index) {
  const live = game.status === "live";
  const color = ACCENTS[game.accent] ?? ACCENTS.cyan;
  const tags = Array.isArray(game.tags) ? game.tags : [];
  const id = `CF-${String(index + 1).padStart(3, "0")}`;
  const status = live
    ? `v${escapeHtml(game.version ?? "1.0")} // ACTIVE${game.featured ? " // FLAGSHIP" : ""}`
    : `v${escapeHtml(game.version ?? "0.1")} // STANDBY`;
  const fresh = live && isNew(game) ? `<span class="badge card__new">NEW</span>` : "";
  const tagChips = tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
  const fx = live ? "" : `<div class="card__radar" aria-hidden="true"></div><div class="card__noise" aria-hidden="true"></div>`;

  const meta = `
    <dl class="card__meta">
      <div class="card__meta-row"><dt>ID</dt><dd>${id}</dd></div>
      <div class="card__meta-row"><dt>TITLE</dt><dd>${escapeHtml(game.title)}</dd></div>
      ${live && game.featured ? `<div class="card__meta-row"><dt>GENRE</dt><dd>${escapeHtml([game.kind, ...tags.slice(0, 2)].filter(Boolean).join(" / "))}</dd></div>` : ""}
      <div class="card__meta-row"><dt>SUMMARY</dt><dd>${escapeHtml(game.tagline ?? "")}</dd></div>
    </dl>`;

  const inner = `
    <div class="card__banner"><span>${status}</span><span class="card__sigil">${icon(MOTIF_ICONS[game.motif] ?? "grid", { size: 14 })}</span>${fresh}</div>
    <div class="card__thumb">
      <div class="card__thumb-inner">${motif(game.motif, color)}</div>
      ${fx}
    </div>
    <div class="card__body">
      ${meta}
      <div class="card__tags">${tagChips}</div>
      <span class="card__cta"><span>${live ? "LAUNCH" : "IN PRODUCTION"}</span><span aria-hidden="true">&gt;&gt;</span></span>
    </div>
  `;

  if (live) {
    return `<a class="card" href="${gameHref(game.slug)}" data-accent="${escapeHtml(game.accent ?? "cyan")}" style="--card-accent:${color}">${inner}</a>`;
  }
  return `<div class="card card--soon" data-accent="${escapeHtml(game.accent ?? "cyan")}" style="--card-accent:${color}" data-title="${escapeHtml(game.title)}" tabindex="0" role="button" aria-disabled="true" aria-label="${escapeHtml(game.title)} — coming soon">${inner}</div>`;
}

function motif(kind, color) {
  const open = `<svg viewBox="0 0 120 66" shape-rendering="crispEdges" aria-hidden="true">`;
  const bg = `<rect width="120" height="66" fill="#050508"/>`;
  const grid = `<path d="M0 11h120M0 22h120M0 33h120M0 44h120M0 55h120M12 0v66M24 0v66M36 0v66M48 0v66M60 0v66M72 0v66M84 0v66M96 0v66M108 0v66" stroke="#1e2638" stroke-width="1"/>`;
  const close = `</svg>`;

  if (kind === "snake") {
    return `${open}${bg}${grid}
      <rect x="24" y="33" width="11" height="11" fill="${color}"/>
      <rect x="36" y="33" width="11" height="11" fill="${color}"/>
      <rect x="48" y="33" width="11" height="11" fill="${color}"/>
      <rect x="48" y="22" width="11" height="11" fill="${color}"/>
      <rect x="60" y="22" width="11" height="11" fill="${color}"/>
      <rect x="84" y="22" width="11" height="11" fill="#ff007f"/>
      ${close}`;
  }
  if (kind === "cards") {
    return `${open}${bg}${grid}
      <rect x="30" y="16" width="24" height="34" fill="#10141d" stroke="${color}" stroke-width="2"/>
      <rect x="48" y="16" width="24" height="34" fill="#10141d" stroke="#f0f4fc" stroke-width="2"/>
      <rect x="66" y="16" width="24" height="34" fill="${color}"/>
      <rect x="54" y="26" width="12" height="12" fill="#050508"/>
      ${close}`;
  }
  if (kind === "target") {
    return `${open}${bg}${grid}
      <rect x="38" y="11" width="44" height="44" fill="none" stroke="${color}" stroke-width="3"/>
      <rect x="48" y="21" width="24" height="24" fill="none" stroke="${color}" stroke-width="3"/>
      <rect x="56" y="29" width="8" height="8" fill="#ff007f"/>
      ${close}`;
  }
  return `${open}${bg}${grid}
    <rect x="0" y="50" width="120" height="2" fill="${color}"/>
    <rect x="10" y="44" width="4" height="6" fill="#f0f4fc"/>
    <rect x="102" y="40" width="4" height="10" fill="#f0f4fc"/>
    <path d="M40 50V38a20 20 0 0 1 40 0v12" fill="none" stroke="${color}" stroke-width="3"/>
    <rect x="56" y="26" width="8" height="8" fill="${color}"/>
    <rect x="24" y="8" width="2" height="2" fill="#f0f4fc"/>
    <rect x="90" y="12" width="2" height="2" fill="#f0f4fc"/>
    ${close}`;
}

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

function wireKonami() {
  let progress = 0;
  let timer = 0;
  document.addEventListener("keydown", (event) => {
    if (event.target instanceof Element && event.target.matches("input, textarea, select")) {
      progress = 0;
      return;
    }
    const want = KONAMI[progress];
    const got = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (got === want) {
      progress += 1;
      clearTimeout(timer);
      timer = setTimeout(() => {
        progress = 0;
      }, 2500);
    } else {
      progress = got === KONAMI[0] ? 1 : 0;
    }
    if (progress === KONAMI.length) {
      progress = 0;
      document.body.classList.add("konami");
      sfx.win();
      toast({ title: "CHEAT ACCEPTED", body: "Cabinet overdrive engaged for 10 sols of glory.", icon: "sparkle", duration: 5000 });
      setTimeout(() => document.body.classList.remove("konami"), 10000);
    }
  });
}
