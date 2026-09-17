import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { games, gameHref, liveGames } from "/shared/registry.js";
import { sfx } from "/shared/sound.js";
import { prefersReducedMotion } from "/shared/shell.js";

const ACCENTS = {
  flare: "#ff4900",
  cyan: "#00f0ff",
  magenta: "#ff0055",
  lime: "#00ff66",
  violet: "#b06bff",
  amber: "#ffb000",
  rust: "#ff4900",
};

const FILTERS = [
  { id: "all", label: "ALL_EXPERIMENTS", kinds: null },
  { id: "sim", label: "SIMULATIONS", kinds: ["tycoon", "sim"] },
  { id: "arcade", label: "RETRO_ARCADE", kinds: ["arcade"] },
  { id: "chaos", label: "CHAOS", kinds: ["toy", "quiz", "puzzle"] },
];

let activeFilter = "all";

initShell();

bootLog();
renderStats();
renderFilters();
renderGrid();

function bootLog() {
  const host = document.getElementById("boot-log");
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

function renderStats() {
  const host = document.getElementById("hero-stats");
  const live = liveGames().length;
  const kinds = new Set(games.map((g) => g.kind)).size;
  const stats = [
    { label: "EXPERIMENTS", value: String(games.length).padStart(2, "0") },
    { label: "ONLINE", value: String(live).padStart(2, "0") },
    { label: "GENRES", value: String(kinds).padStart(2, "0") },
  ];
  host.innerHTML = stats
    .map(
      (s) => `
      <div class="telegrid__cell">
        <dt>${escapeHtml(s.label)}</dt>
        <dd>${escapeHtml(s.value)}</dd>
      </div>`
    )
    .join("");
}

function renderFilters() {
  const host = document.getElementById("filterbar");
  host.innerHTML = FILTERS.map(
    (f) => `<button type="button" role="tab" class="fbtn" data-filter="${f.id}" aria-selected="${f.id === activeFilter}">[${escapeHtml(f.label)}]</button>`
  ).join("");
  host.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      sfx.click();
      host.querySelectorAll("[data-filter]").forEach((b) =>
        b.setAttribute("aria-selected", String(b === btn))
      );
      renderGrid();
    });
  });
}

function visibleGames() {
  const filter = FILTERS.find((f) => f.id === activeFilter);
  if (!filter || !filter.kinds) return games;
  return games.filter((g) => filter.kinds.includes(g.kind));
}

function isNew(game) {
  if (!game.added) return false;
  const age = Date.now() - new Date(`${game.added}T00:00:00Z`).getTime();
  return age < 30 * 24 * 3600 * 1000;
}

function renderGrid() {
  const host = document.getElementById("game-grid");
  host.innerHTML = visibleGames().map(renderCard).join("");

  host.addEventListener(
    "click",
    (event) => {
      const soon = event.target.closest(".card--soon");
      if (soon) {
        event.preventDefault();
        sfx.deny();
        toast({
          title: "CARTRIDGE MISSING",
          body: `${soon.dataset.title} is still on the workbench.`,
          icon: "lock",
        });
      }
    },
    { once: true }
  );

  host.addEventListener("pointerover", (event) => {
    if (event.target.closest(".card:not(.card--soon)")) sfx.hover();
  });
}

function renderCard(game) {
  const live = game.status === "live";
  const color = ACCENTS[game.accent] ?? ACCENTS.cyan;
  const status = live
    ? `<span class="badge badge--accent card__ver">v${escapeHtml(game.version ?? "1.0")} // ACTIVE</span>`
    : `<span class="badge card__ver">v${escapeHtml(game.version ?? "0.1")} // STANDBY</span>`;
  const fresh = live && isNew(game) ? `<span class="badge badge--ok card__new">NEW</span>` : "";
  const tags = game.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");

  const inner = `
    <div class="card__thumb">
      <div class="card__thumb-inner">${motif(game.motif, color)}</div>
      ${status}${fresh}
    </div>
    <div class="card__body">
      <span class="card__kind">${escapeHtml(game.kind)}</span>
      <span class="card__title">${escapeHtml(game.title)}</span>
      <p class="card__tagline">${escapeHtml(game.tagline)}</p>
      <div class="card__tags">${tags}</div>
      <span class="card__cta"><span>${live ? "LAUNCH" : "STANDBY"}</span><span aria-hidden="true">&gt;&gt;</span></span>
    </div>
  `;

  if (live) {
    return `<a class="card" href="${gameHref(game.slug)}" data-accent="${game.accent}" style="--card-accent:${color}">${inner}</a>`;
  }
  return `<div class="card card--soon" data-accent="${game.accent}" style="--card-accent:${color}" data-title="${escapeHtml(game.title)}" tabindex="0" role="button" aria-disabled="true">${inner}</div>`;
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
      <rect x="84" y="22" width="11" height="11" fill="#ff0055"/>
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
      <rect x="56" y="29" width="8" height="8" fill="#ff0055"/>
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
