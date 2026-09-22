// Hazard/weather events. minSol gates, weight = relative odds, warn = seconds of warning before it hits.
export const EVENTS = [
  { id: "dust-storm", name: "Dust Storm", kind: "bad", minSol: 4, weight: 3, warnSols: 1, durSols: [1, 2], desc: "Solar output drops to 30%, visibility collapses." },
  { id: "dust-devil", name: "Dust Devil", kind: "mixed", minSol: 2, weight: 2.5, desc: "Scours dust off panels — and may knock out a machine." },
  { id: "meteor", name: "Meteor Shower", kind: "bad", minSol: 8, weight: 1.1, warn: 45, desc: "Fragments can breach walls. Stay clear of the impact zone." },
  { id: "spe", name: "Solar Particle Event", kind: "bad", minSol: 8, weight: 1.1, warn: 60, dur: 90, desc: "Radiation storm. Get indoors or underground." },
  { id: "failure", name: "Equipment Failure", kind: "bad", minSol: 3, weight: 2, desc: "A machine breaks and needs a multitool repair." },
  { id: "ice-pocket", name: "Ice Pocket", kind: "good", minSol: 2, weight: 1.5, desc: "The orbiter spots shallow ice nearby." },
  { id: "orbiter-pass", name: "Orbiter Pass", kind: "good", minSol: 3, weight: 1.2, requiresComms: true, desc: "TETHYS maps a strip of terrain for you." },
];

const byId = new Map(EVENTS.map((e) => [e.id, e]));
export function eventById(id) {
  return byId.get(id) ?? null;
}

// Chance per sol-start that an event is rolled; ramps up with time.
export function eventsPerSol(sol) {
  if (sol < 5) return 0.45;
  if (sol < 20) return 0.8;
  if (sol < 50) return 1.1;
  return 1.4;
}
