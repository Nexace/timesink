import { initShell, escapeHtml, toast, prefersReducedMotion } from "/shared/shell.js";
import { games, gameHref, liveGames } from "/shared/registry.js";
import { sfx } from "/shared/sound.js";
import { icon } from "/shared/icons.js";
import { getBestScore } from "/shared/scores.js";
import { motif } from "/shared/motifs.js";

const ACCENTS = {
  flare: "#eb4412",
  mars: "#eb4412",
  pink: "#ff5c9d",
  cyan: "#00f0ff",
  magenta: "#ff007f",
  teal: "#00bfa5",
  lime: "#00ff66",
  purple: "#9933ff",
  violet: "#9933ff",
  amber: "#ff9900",
  blue: "#0088ff",
  crimson: "#ff2233",
  gold: "#ffd700",
  rust: "#eb4412",
  red: "#dc2626",
  blood: "#dc2626",
  green: "#10b981",
  emerald: "#10b981",
  orange: "#f97316",
  copper: "#f97316",
  indigo: "#6366f1",
  doodle: "#a3e635",
  mint: "#a3e635",
  phosphor: "#00ff41",
  mono: "#f1f5f9",
  silver: "#f1f5f9",
};

initShell();

wireKonami();

initHeroScroll();

renderGrid();
wireGrid(document.getElementById("game-grid"));
renderScoresWall(document.getElementById("scores-grid"));

function visibleGames() {
  return games;
}

function renderGrid() {
  const host = document.getElementById("game-grid");
  if (!host) return;
  host.innerHTML = visibleGames().map((g, i) => renderCard(g, i)).join("");
}

function renderScoresWall(host) {
  if (!host) return;
  const rows = games.map((g) => {
    const rec = getBestScore(g.slug);
    const val = rec ? (rec.label || rec.score) : "NO RUNS";
    const dt = rec?.date ? ` (${rec.date})` : "";
    return `
      <div class="score-card">
        <span class="score-card__title">${escapeHtml(g.title)}</span>
        <span class="score-card__val">${escapeHtml(val)}${escapeHtml(dt)}</span>
      </div>
    `;
  }).join("");
  host.innerHTML = rows;
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
      return;
    }
    const active = event.target.closest(".card--active");
    if (active) {
      sfx.coin();
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
  const version = game.version ?? (live ? "1.0" : "0.1");
  const statusText = live ? `&lt; ${version} / ACTIVE BASE` : `&lt; ${version} / STANDBY`;
  const tagChips = tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
  const fx = live ? "" : `<div class="card__radar" aria-hidden="true"></div><div class="card__noise" aria-hidden="true"></div>`;

  const bestRecord = getBestScore(game.slug);
  const bestText = bestRecord ? `${escapeHtml(bestRecord.label || bestRecord.score)}` : "NO RUNS LOGGED";

  const metaHtml = `
    <div class="cartridge-specs">
      <div class="spec-row"><span class="spec-label">ID:</span> <span class="spec-val spec-val--id">${id}</span></div>
      <div class="spec-row"><span class="spec-label">TITLE:</span> <span class="spec-val spec-val--title">${escapeHtml(game.title)}</span></div>
      ${live ? `<div class="spec-row"><span class="spec-label">GENRE:</span> <span class="spec-val">${escapeHtml([game.kind, ...tags.slice(0, 2)].filter(Boolean).join(" / "))}</span></div>` : ""}
      <div class="spec-row"><span class="spec-label">SUMMARY:</span> <span class="spec-val spec-val--summary">${escapeHtml(game.tagline ?? "")}</span></div>
      <div class="spec-row"><span class="spec-label">RECORD:</span> <span class="spec-val spec-val--accent" style="color:${color}">${bestText}</span></div>
      <div class="cartridge-tags">${tagChips}</div>
    </div>
  `;

  const inner = `
    <div class="cartridge-chassis">
      <span class="cartridge-rivet tl" aria-hidden="true"></span>
      <span class="cartridge-rivet tr" aria-hidden="true"></span>
      <span class="cartridge-rivet bl" aria-hidden="true"></span>
      <span class="cartridge-rivet br" aria-hidden="true"></span>
      ${live ? `<span class="cartridge-hazard bl" aria-hidden="true"></span><span class="cartridge-hazard tr" aria-hidden="true"></span>` : ""}
      
      <div class="cartridge-inner">
        <div class="cartridge-header">
          <span class="cartridge-tab">${statusText}</span>
          <span class="cartridge-key" aria-hidden="true"></span>
        </div>

        <div class="cartridge-screen">
          <div class="cartridge-screen__bezel">
            <div class="card__thumb-inner">${motif(game.motif, color)}</div>
            ${fx}
          </div>
        </div>

        <div class="cartridge-console">
          ${metaHtml}
        </div>
      </div>
    </div>
  `;

  if (live) {
    return `<a class="card card--industrial card--active" href="${gameHref(game.slug)}" data-accent="${escapeHtml(game.accent ?? "cyan")}" style="--card-accent:${color}" aria-label="${escapeHtml(game.title)} — launch experiment">${inner}</a>`;
  }
  return `<div class="card card--industrial card--soon" data-accent="${escapeHtml(game.accent ?? "cyan")}" style="--card-accent:${color}" data-title="${escapeHtml(game.title)}" tabindex="0" role="button" aria-disabled="true" aria-label="${escapeHtml(game.title)} — coming soon">${inner}</div>`;
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
      const current = document.documentElement.dataset.phosphor;
      document.documentElement.dataset.phosphor = current === "amber" ? "full" : "amber";
      sfx.win();
      toast({
        title: "KONAMI PROTOCOL",
        body: `Phosphor shifted to ${document.documentElement.dataset.phosphor === "amber" ? "AMBER" : "GREEN"}.`,
        icon: "sparkle",
        duration: 4000
      });
    }
  });
}

function initHeroScroll() {
  const scrollCue = document.querySelector("[data-scroll-cue]");
  const gamesSection = document.getElementById("games");

  if (scrollCue && gamesSection) {
    const scrollToGames = () => {
      try {
        sfx.nav();
      } catch {}
      gamesSection.scrollIntoView({ behavior: "smooth" });
    };
    scrollCue.addEventListener("click", scrollToGames);
    scrollCue.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        scrollToGames();
      }
    });
  }

  // Cross-browser fallback for engines without native CSS animation-timeline: scroll()
  const hasNativeScrollTimeline =
    typeof CSS !== "undefined" &&
    CSS.supports &&
    CSS.supports("(animation-timeline: scroll()) and (animation-range: 0% 100%)");

  if (!hasNativeScrollTimeline && !prefersReducedMotion()) {
    const boot = document.querySelector(".boot");
    const bootContent = document.querySelector(".boot__content");
    const games = document.querySelector(".games");
    const scrollDistance = 320;
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY || 0;
          const p = Math.min(1, Math.max(0, y / scrollDistance));
          if (boot) {
            boot.style.minHeight = `calc((100dvh - var(--header-h)) * ${1 - p} + 240px * ${p})`;
            boot.style.paddingBottom = `calc(var(--s-8) * ${1 - p} + var(--s-2) * ${p})`;
          }
          if (bootContent) {
            bootContent.style.transform = `scale(${1 - 0.08 * p}) translateY(${-10 * p}px)`;
          }
          if (scrollCue) {
            scrollCue.style.opacity = String(Math.max(0, 1 - p * 2.2));
            scrollCue.style.pointerEvents = p > 0.4 ? "none" : "auto";
          }
          if (games) {
            games.style.transform = `translateY(${40 * (1 - p)}px)`;
            games.style.opacity = String(0.85 + 0.15 * p);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
}

