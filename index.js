import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { games, SITE, gameHref, liveGames } from "/shared/registry.js";
import { icon } from "/shared/icons.js";
import { sfx } from "/shared/sound.js";

const KIND_ICONS = {
  tycoon: "rocket",
  arcade: "gamepad",
  toy: "sparkle",
  quiz: "target",
  puzzle: "grid",
};

initShell({ crumb: null });

renderStats();
renderGrid();
wireHero();

function renderStats() {
  const host = document.getElementById("hero-stats");
  const live = games.filter((g) => g.status === "live").length;
  const stats = [
    { label: "Games", value: games.length },
    { label: "Playable now", value: live },
    { label: "Dependencies", value: 0 },
  ];
  host.innerHTML = stats
    .map(
      (s) => `
      <div class="hero__stat">
        <dt>${escapeHtml(s.label)}</dt>
        <dd>${s.value}</dd>
      </div>`
    )
    .join("");
}

function renderGrid() {
  const host = document.getElementById("game-grid");
  host.innerHTML = games.map(renderCard).join("");

  host.addEventListener("click", (event) => {
    const soon = event.target.closest(".card--soon");
    if (soon) {
      event.preventDefault();
      sfx.deny();
      toast({
        title: `${soon.dataset.title} is not built yet`,
        body: "It is on the list. Play something that exists.",
        icon: "lock",
      });
    }
  });

  host.addEventListener("pointerover", (event) => {
    if (event.target.closest(".card:not(.card--soon)")) sfx.hover();
  });
}

function renderCard(game) {
  const live = game.status === "live";
  const thumb = icon(KIND_ICONS[game.kind] ?? "gamepad", { size: 26, strokeWidth: 1.7 });
  const status = live
    ? `<span class="badge badge--accent card__status">${icon("star", { size: 11, strokeWidth: 2.4 })} Live</span>`
    : `<span class="badge card__status">${icon("lock", { size: 11, strokeWidth: 2.4 })} Soon</span>`;

  const tags = game.tags
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join("");

  const inner = `
    <div class="card__top">
      <span class="card__thumb">${thumb}</span>
      <span class="card__meta">
        <span class="card__kind">${escapeHtml(game.kind)}</span>
        <span class="card__title">${escapeHtml(game.title)}</span>
      </span>
      ${status}
    </div>
    <p class="card__tagline">${escapeHtml(game.tagline)}</p>
    <div class="card__tags">${tags}</div>
    <span class="card__cta">
      ${live ? "Play now" : "In development"}
      ${icon("next", { size: 15, strokeWidth: 2.4 })}
    </span>
  `;

  if (live) {
    return `<a class="card" href="${gameHref(game.slug)}" data-accent="${game.accent}">${inner}</a>`;
  }
  return `<div class="card card--soon" data-accent="${game.accent}" data-title="${escapeHtml(game.title)}" tabindex="0" role="button" aria-disabled="true">${inner}</div>`;
}

function wireHero() {
  const btn = document.getElementById("hero-random");
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    const live = liveGames();
    if (!live.length) {
      toast({ title: "Nothing playable yet", icon: "alert" });
      return;
    }
    const pick = live[Math.floor(Math.random() * live.length)];
    sfx.click();
    window.location.href = gameHref(pick.slug);
  });
}

document.title = `${SITE.name} — ${SITE.tagline}`;
