import { OBJECTIVES, MISSION_CONTROL, ENDINGS } from "../data/story.js";
import { roomAtTile, isBreathable } from "./rooms.js";
import { waterTotal } from "./systems.js";
import { aliveColonists } from "./colonists.js";
import { pushLog, alert, solOf } from "./state.js";

function hab(g) {
  const { x, y } = g.world.start;
  return roomAtTile(g, x, y);
}

function anyStruct(g, pred) {
  for (const st of g.structs.values()) if (pred(st)) return true;
  return false;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const CHECKS = {
  eva: (g) => Boolean(g.s.story.flags.evaDone),
  scrap: (g) => (g.s.story.flags.scrapTotal ?? 0) >= 6,
  patch: (g) => Boolean(hab(g)?.sealed),
  oxy: (g) => anyStruct(g, (st) => st.id === "oxygenator" && !st.broken && st.powered),
  panels: (g) => {
    const sol = [...g.structs.values()].filter((st) => st.id === "solar");
    return sol.length > 0 && sol.every((st) => (st.dust ?? 0) < 0.3);
  },
  reclaimer: (g) => anyStruct(g, (st) => st.id === "reclaimer" && !st.broken),
  farm: (g) => [...g.structs.values()].filter((st) => st.id === "planter" && st.crop && !st.crop.dead).length >= 3 || (g.s.stats.harvested ?? 0) > 0,
  water: (g) => waterTotal(g).total >= 80,
  rover: (g) => !g.s.rover.broken,
  rtg: (g) => Boolean(g.s.story.flags.rtg),
  harvest: (g) => (g.s.stats.harvested ?? 0) > 0,
  lander: (g) => {
    const l = g.world.pois.find((p) => p.kind === "lander");
    return Boolean(l && dist(g.s.player, { x: l.x + 0.5, y: l.y + 0.5 }) < 4);
  },
  antenna: (g) => Boolean(g.s.story.flags.antenna),
  comms: (g) => Boolean(g.s.story.flags.comms),
  research: (g) => g.s.research.done.length > 0,
  pad: (g) => anyStruct(g, (st) => st.id === "pad"),
  colonists4: (g) => aliveColonists(g).length >= 4,
  colonists10: (g) => aliveColonists(g).length >= 10,
  sustain: (g) => g.s.sustain.streak >= 10,
  choice: (g) => Boolean(g.s.story.flags.choice),
  mav: (g) => g.s.status === "won",
};

export function currentObjective(g) {
  if (g.s.mode !== "campaign") return null;
  return OBJECTIVES[g.s.story.idx] ?? null;
}

// Runs once per second.
export function tickStory(g) {
  const s = g.s;
  if (s.mode !== "campaign" || s.status !== "playing") return;
  // Several objectives can complete in the same second (e.g. rover fixed before being asked).
  for (let guard = 0; guard < 4; guard += 1) {
    const obj = OBJECTIVES[s.story.idx];
    if (!obj) return;
    if (obj.id === "mav") return;
    const check = CHECKS[obj.id];
    if (!check || !check(g)) return;
    completeObjective(g, obj);
  }
}

function completeObjective(g, obj) {
  const s = g.s;
  s.story.done.push(obj.id);
  s.story.idx += 1;
  if (obj.journal) pushLog(g, obj.journal.replace("{sol}", String(solOf(s.tick))), "journal");
  g.fx.push({ kind: "objective", id: obj.id, text: obj.text });
  const next = OBJECTIVES[s.story.idx];
  if (next && next.act !== obj.act) {
    g.fx.push({ kind: "act", act: next.act });
  }
  const mc = MISSION_CONTROL[obj.id];
  if (mc) for (const line of mc) s.story.messages.push({ sol: solOf(s.tick), text: line, read: false });
  if (mc) g.fx.push({ kind: "comms-message" });
  if (obj.id === "sustain") g.fx.push({ kind: "choice" });
}

// Finale choice from the UI.
export function chooseEnding(g, which) {
  const s = g.s;
  if (which === "founder") {
    s.story.flags.choice = true;
    s.ending = "founder";
    s.status = "won";
    pushLog(g, ENDINGS.founder.body, "journal");
    return;
  }
  s.story.flags.choice = true;
  s.story.flags.homebound = true;
  pushLog(g, "Decision made. I'm going home. Now I just have to drive across half of Mars.", "journal");
  alert(g, "OBJECTIVE — REACH THE MAV PAD", "good");
}

// At the MAV node.
export function tryLaunch(g) {
  const s = g.s;
  if (s.mode !== "campaign") return { msg: "The MAV's fuel was vented years ago. It's a monument now." };
  const obj = currentObjective(g);
  if (!obj || obj.id !== "mav") return { msg: "The HELIOS MAV. Fueled, waiting — but you're not done here yet." };
  s.status = "won";
  s.ending = "homebound";
  s.story.done.push("mav");
  s.story.idx += 1;
  pushLog(g, OBJECTIVES.find((o) => o.id === "mav").journal, "journal");
  return { ui: "ending" };
}

export function objectiveProgress(g) {
  const s = g.s;
  const obj = currentObjective(g);
  if (!obj) return null;
  switch (obj.id) {
    case "scrap":
      return `${Math.min(6, s.story.flags.scrapTotal ?? 0)}/6`;
    case "panels": {
      const sol = [...g.structs.values()].filter((st) => st.id === "solar");
      return `${sol.filter((st) => (st.dust ?? 0) < 0.3).length}/${sol.length}`;
    }
    case "farm":
      return `${Math.min(3, [...g.structs.values()].filter((st) => st.id === "planter" && st.crop && !st.crop.dead).length)}/3`;
    case "water":
      return `${Math.floor(waterTotal(g).total)}/80 L`;
    case "colonists4":
      return `${aliveColonists(g).length}/4`;
    case "colonists10":
      return `${aliveColonists(g).length}/10`;
    case "sustain":
      return `${s.sustain.streak}/10 sols`;
    default:
      return null;
  }
}

export { isBreathable };
