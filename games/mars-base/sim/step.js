import { TICK_RATE, DT, DAILY_SCORE_SOL, FOOD_VALUE } from "../data/balance.js";
import { solOf, pushLog, alert } from "./state.js";
import { tickPlayer, tickVitals } from "./player.js";
import { tickRover } from "./rover.js";
import { tickCrafting } from "./building.js";
import { updateSystems, ensureDerived, waterTotal, crewCount } from "./systems.js";
import { colonistNeeds, tickColonists, maybeLander, aliveColonists } from "./colonists.js";
import { tickStory } from "./story.js";
import { rollSolEvents, tickEvents } from "./events.js";
import { isNight, daylight } from "./env.js";
import { countIn } from "./inventory.js";

export const EMPTY_INPUT = { mx: 0, my: 0, use: false, aim: null };

// Advance the simulation by exactly one fixed tick.
export function step(g, input = EMPTY_INPUT) {
  const s = g.s;
  if (s.status !== "playing") return;
  if (g.dirtyRooms || g.dirtyGrids) ensureDerived(g);

  const p = s.player;
  if (p.sleeping) tickSleep(g);
  tickPlayer(g, p.sleeping ? EMPTY_INPUT : input, DT);
  tickRover(g, p.sleeping ? EMPTY_INPUT : input, DT);
  tickVitals(g, DT);
  tickCrafting(g, DT);
  tickColonists(g, DT);
  tickEvents(g);

  s.tick += 1;
  if (s.tick % TICK_RATE === 0) {
    updateSystems(g, 1);
    colonistNeeds(g, 1);
    tickStory(g);
    s.stats.maxColonists = Math.max(s.stats.maxColonists, aliveColonists(g).length);
  }

  const sol = solOf(s.tick);
  if (sol !== s.events.lastSol) onNewSol(g, sol);
}

function tickSleep(g) {
  const s = g.s;
  const p = s.player;
  p.health = Math.min(100, p.health + 0.02);
  const slept = s.tick - (p.sleepStart ?? s.tick);
  const morning = !isNight(s.tick) && daylight(s.tick) > 0.15 && slept > TICK_RATE * 20;
  const danger = p.o2 < 30 || p.health < 20 || s.events.scheduled.some((e) => e.warned && e.at > s.tick);
  if (morning || danger || (!isNight(s.tick) && p.health >= 100 && slept > TICK_RATE * 20)) {
    p.sleeping = false;
    g.fx.push({ kind: "wake", danger });
  }
}

function foodValue(g) {
  let v = 0;
  const pools = [g.s.inv, ...[...g.structs.values()].filter((st) => st.id === "crate").map((st) => st.items)];
  for (const slots of pools) for (const [id, val] of Object.entries(FOOD_VALUE)) v += countIn(slots, id) * val;
  return v;
}

function onNewSol(g, sol) {
  const s = g.s;
  const first = s.events.lastSol === 0;
  s.events.lastSol = sol;
  if (!first) {
    // Sustain streak: no crisis during the last sol, plus reserves for the crew.
    const crew = crewCount(g);
    const reserves = waterTotal(g).total >= crew * 3 && foodValue(g) >= crew * 100;
    if (!s.sustain.badSol && reserves) s.sustain.streak += 1;
    else s.sustain.streak = 0;
    s.sustain.badSol = false;
    g.fx.push({ kind: "dawn", sol });
    maybeLander(g, sol);
  }
  rollSolEvents(g, sol);
  s.score = computeScore(g);
  if (s.mode === "daily" && sol > DAILY_SCORE_SOL) {
    s.status = "won";
    s.ending = "daily";
    pushLog(g, `Daily Sol complete. Final score ${s.score}.`, "good");
    alert(g, "DAILY COMPLETE", "good");
  }
}

export function computeScore(g) {
  const s = g.s;
  const sols = Math.max(0, solOf(s.tick) - 1);
  return Math.round(
    sols * 10 + aliveColonists(g).length * 40 + s.research.done.length * 25 + (s.stats.harvested ?? 0) * 2 + (s.stats.built ?? 0) + s.sustain.streak * 5,
  );
}

export function runTicks(g, n, input = EMPTY_INPUT) {
  for (let i = 0; i < n; i += 1) step(g, input);
}
