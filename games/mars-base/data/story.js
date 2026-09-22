// Campaign objectives in order. Completion checks live in sim/story.js keyed by id.
// journal: the commander's log line written when the objective completes.
export const ACTS = [
  { id: 1, name: "ACT I — STRANDED" },
  { id: 2, name: "ACT II — CONTACT" },
  { id: 3, name: "ACT III — COLONY" },
  { id: 4, name: "FINALE" },
];

export const OBJECTIVES = [
  { id: "eva", act: 1, text: "Step outside through the airlock", hint: "Walk over the airlock tile (the striped door) to go out.",
    journal: "Sol {sol}. The crew is gone. They left because they thought I was dead, and honestly the antenna through my suit made a good case. I have a hab, some rations, and a lot of red dirt. Let's go." },
  { id: "scrap", act: 1, text: "Salvage 6 scrap from the debris field", hint: "Hold left-click with the Hand Drill on wreckage (gray piles) near the hab.",
    journal: "Scrap: the official state bird of Mars. It's all over the place and every bit of it is useful." },
  { id: "patch", act: 1, text: "Seal the hab breach", hint: "A wall needs 1 metal + 1 sealant. Metal: 2 scrap, by hand [TAB]. Sealant: shovel some regolith, then craft it at the Workbench (hydrazine is in the hab crate). Then [B] → Hab Wall into the gap on the east side.",
    journal: "Breach sealed. Took two metal plates and a lot of swearing. The hab is holding pressure. So am I." },
  { id: "oxy", act: 1, text: "Repair the Oxygenator", hint: "Needs 1 circuit: at the Workbench craft Wire (1 scrap), then a Circuit (3 scrap + 1 wire). Then press [E] on the Oxygenator.",
    journal: "Oxygenator is humming. I can stop rationing breaths now. That was a weird sentence to write." },
  { id: "panels", act: 1, text: "Wipe the dust off the solar panels", hint: "Walk up to each solar panel and press [E].",
    journal: "Cleaned the solar farm by hand. Nobody at NASA put 'window washer' in the job description." },
  { id: "reclaimer", act: 1, text: "Repair the Water Reclaimer", hint: "Needs 1 circuit + 1 plastic (Workbench: hydrazine + scrap). Then [E] on the Reclaimer.",
    journal: "Water Reclaimer is back online. It recycles everything. EVERYTHING. We don't talk about it." },
  { id: "farm", act: 1, text: "Plant 3 seed potatoes", hint: "Collect compost from the Waste Recycler [E], craft Soil (regolith + compost), build Planter Beds under the skylights [B → Farming], then [E] on each to plant.",
    journal: "I am the first farmer on Mars. My crops are potatoes. My fertilizer is… let's say 'locally sourced.'" },
  { id: "water", act: 1, text: "Store 80 L of water", hint: "Mine ice (north) and drop it into the Water Tank with [E], or burn hydrazine at a Chem Station.",
    journal: "80 litres in the tank. Water is the one thing I can't improvise, so I'm going to improvise it anyway." },
  { id: "rover", act: 1, text: "Repair the rover", hint: "The rover is parked south of the hab. Repair it with the Multitool (needs 2 metal + 1 wire).",
    journal: "The rover runs. Top speed: disappointing. Range: also disappointing. Still, wheels!" },
  { id: "rtg", act: 1, text: "Dig up the RTG", hint: "The crew buried the RTG to the south-east (see the map [M]). Mine the marker to recover the core.",
    journal: "Recovered the RTG. It's a box of plutonium that stays warm forever. I named it Toasty. We're very close now." },
  { id: "harvest", act: 1, text: "Harvest your first potatoes", hint: "Crops need pressure, warmth, water and light. Under the skylights they grow by day; a grow lamp works around the clock. Survive until they ripen.",
    journal: "First harvest. I am the greatest botanist on this planet. Also the only one. Food math is looking a lot less terrifying." },
  { id: "lander", act: 2, text: "Reach the old Pathfinder-era lander", hint: "It's far out — see the map [M]. Charge the rover and bring O₂ canisters.",
    journal: "Found the old lander, right where history left it. It's older than the hab and in better shape than me." },
  { id: "antenna", act: 2, text: "Salvage the lander's antenna", hint: "Mine the lander with any drill to take the antenna.",
    journal: "Antenna salvaged. If this works, I get to talk to someone other than the potatoes." },
  { id: "comms", act: 2, text: "Build a Comms Dish at the hab", hint: "Build it from the Science tab [B]. It needs power.",
    journal: "CONTACT. Earth knows I'm alive. Their first message was 'WHAT.' Their second was a spreadsheet." },
  { id: "research", act: 3, text: "Complete a research project", hint: "Build a Research Lab, put rock samples in it [E], then pick a project [T].",
    journal: "Science! Turning rocks into knowledge, one sample at a time." },
  { id: "pad", act: 3, text: "Build a Landing Pad", hint: "Crew landers and supply drops need a pad. Sulfur concrete comes from the Smelter.",
    journal: "The pad is poured. Mission Control says the first crew lander is being fueled." },
  { id: "colonists4", act: 3, text: "Welcome 4 colonists", hint: "Landers arrive every few sols while you have free bunks, food and air.",
    journal: "Four new faces. One of them brought hot sauce. We're going to be fine." },
  { id: "colonists10", act: 3, text: "Grow the colony to 10", hint: "More bunks, more planters, more oxygen.",
    journal: "Ten people on Mars. It feels like a town now. We have a group chat." },
  { id: "sustain", act: 3, text: "Stay self-sustaining for 10 sols", hint: "No brownouts, O₂ and water holding steady, and a food surplus.",
    journal: "Ten sols without a crisis. The colony runs itself. That means it's decision time." },
  { id: "choice", act: 4, text: "Decide your fate", hint: "Go home, or stay and found the colony.",
    journal: "" },
  { id: "mav", act: 4, text: "Reach the MAV pad and launch", hint: "The ascent vehicle is waiting at Schiaparelli Basin — the furthest point on the map.",
    journal: "Strapped in. Mars, you tried your best. So did I. Going home." },
];

export const ENDINGS = {
  homebound: { title: "HOMEBOUND", body: "The MAV clears the atmosphere. Behind you, the colony you built blinks its landing lights once, twice, and keeps going without you." },
  founder: { title: "FOUNDER", body: "You tell Earth you're staying. The colony gets a name, a flag, and a permanent resident. Mars is somebody's home now." },
};

// Mission Control messages unlocked after comms, keyed by trigger.
export const MISSION_CONTROL = {
  comms: [
    "MISSION CONTROL: Commander, we have no words. Well, we have a few. Please confirm you are actually alive.",
    "MISSION CONTROL: Supply drops are now available. Earn credits by transmitting research, and pick a manifest from the Comms Dish.",
    "MISSION CONTROL: Next step, build a landing pad. We're sending people.",
  ],
  pad: ["MISSION CONTROL: Pad detected from orbit. The first crew lander is fueling. Make sure you have bunks, food and air."],
  sustain: [
    "MISSION CONTROL: The colony is stable. The old HELIOS MAV is still fueled at Schiaparelli Basin.",
    "MISSION CONTROL: The choice is yours, Commander. Come home, or stay.",
  ],
};

// Supply drop manifests (cost in Earth credits).
export const MANIFESTS = [
  { id: "food", name: "Food Crate", cost: 20, items: { ration: 20, "seed-lettuce": 4 } },
  { id: "parts", name: "Parts Kit", cost: 30, items: { circuit: 6, wire: 8, plastic: 6 } },
  { id: "life", name: "Life Support Kit", cost: 45, items: { "o2-canister": 4, medkit: 3, "duct-tape": 6, "battery-cell": 3 } },
  { id: "build", name: "Construction Kit", cost: 40, items: { metal: 20, glass: 10, sealant: 10 } },
];

export const COLONIST_NAMES = [
  "Okafor", "Lindqvist", "Tanaka", "Reyes", "Novak", "Haddad", "Mbeki", "Sato", "Ferreira", "Kowalski",
  "Nair", "Olsen", "Duarte", "Ibarra", "Kim", "Moreau", "Achebe", "Petrov", "Quinn", "Varga",
  "Zhou", "Castillo", "Adeyemi", "Brandt", "Rossi", "Ueda", "Fonseca", "Halloran", "Mistry", "Sorensen",
];
