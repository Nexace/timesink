/**
 * Shared High Score Store
 * Persists high scores across all arcade games in localStorage
 */

const STORAGE_PREFIX = "timesink:scores";

export function getBestScore(slug) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${slug}`);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    // Older builds stored object scores as "[object Object]"; treat those as no record.
    if (!rec || rec.score === "[object Object]" || rec.label === "[object Object]") return null;
    return rec;
  } catch {
    return null;
  }
}

export function saveScore(slug, score, label = "", meta = {}) {
  try {
    const current = getBestScore(slug);
    const isNumeric = typeof score === "number" || (!isNaN(Number(score)) && score !== "");
    const lowerIsBetter = Boolean(meta.lowerIsBetter);

    let isNewBest = false;
    let storedScore = score;

    if (isNumeric) {
      const numScore = Number(score);
      storedScore = numScore;
      if (!current || typeof current.score !== "number" || isNaN(current.score)) {
        isNewBest = true;
      } else {
        const prev = Number(current.score);
        isNewBest = lowerIsBetter ? numScore < prev : numScore > prev;
      }
    } else {
      // Non-numeric score: always record latest run
      isNewBest = true;
      storedScore = String(score);
    }

    if (isNewBest) {
      const record = {
        score: storedScore,
        label: String(label || storedScore),
        date: new Date().toISOString().slice(0, 10),
        ...meta,
      };
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`${STORAGE_PREFIX}:${slug}`, JSON.stringify(record));
      }
      return { isNewBest: true, record };
    }
    return { isNewBest: false, record: current };
  } catch {
    return { isNewBest: false, record: null };
  }
}

export function getAllScores(gamesList = []) {
  const map = {};
  for (const game of gamesList) {
    map[game.slug] = getBestScore(game.slug);
  }
  return map;
}
