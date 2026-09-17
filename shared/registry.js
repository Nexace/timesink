export const SITE = {
  name: "Time Sink",
  tagline: "Small games that eat your time politely.",
  url: "https://timesink.vercel.app",
  repo: "https://github.com/amoghkhairate/timesink",
};

export const games = [
  {
    slug: "mars-base",
    title: "Mars Base",
    tagline: "Build a colony one sol at a time. Oxygen is a suggestion until it isn't.",
    kind: "tycoon",
    tags: ["sim", "strategy", "turn-based"],
    accent: "rust",
    status: "live",
    added: "2026-09-16",
  },
  {
    slug: "null-snake",
    title: "Null Snake",
    tagline: "Snake, except every apple deletes a tile of the grid behind you.",
    kind: "arcade",
    tags: ["arcade", "one-more-run"],
    accent: "lime",
    status: "soon",
  },
  {
    slug: "pixel-auction",
    title: "Pixel Auction",
    tagline: "Bid on worthless objects with money you do not have.",
    kind: "toy",
    tags: ["absurd", "clicker"],
    accent: "magenta",
    status: "soon",
  },
  {
    slug: "price-of-nothing",
    title: "Price of Nothing",
    tagline: "Guess what ordinary things cost. Most answers will upset you.",
    kind: "quiz",
    tags: ["quiz", "data"],
    accent: "violet",
    status: "soon",
  },
];

export function getGame(slug) {
  return games.find((g) => g.slug === slug) ?? null;
}

export function gameHref(slug) {
  return `/games/${slug}`;
}

export function liveGames() {
  return games.filter((g) => g.status === "live");
}

export function soonGames() {
  return games.filter((g) => g.status !== "live");
}
