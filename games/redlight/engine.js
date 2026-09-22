/**
 * REDLIGHT — Pro Drag Racing Christmas Tree Physics & Reaction Timing Engine
 */

export const TREE_CONFIGS = {
  pro: {
    name: "Pro Tree",
    amberDelayMs: 0,
    amberCount: 1, // all 3 amber rows fire simultaneously
    greenDelayMs: 400,
  },
  sportsman: {
    name: "Sportsman Tree",
    amberDelayMs: 500,
    amberCount: 3, // ambers fire sequentially every 500ms
    greenDelayMs: 1500,
  }
};

export const STAGE_TIMEOUT_MS = 7000;

export const RANKS = [
  { maxRt: 0.060, label: "TOP FUEL (GODLIKE)" },
  { maxRt: 0.120, label: "PRO STOCK (EXCELLENT)" },
  { maxRt: 0.250, label: "SPORTSMAN (GOOD)" },
  { maxRt: 0.450, label: "STREET (AVERAGE)" },
  { maxRt: Infinity, label: "FLAGMAN (TOO SLOW)" }
];

export function classifyReaction(rtSeconds) {
  if (rtSeconds <= 0) return "FOUL";
  for (const rank of RANKS) {
    if (rtSeconds < rank.maxRt) {
      return rank.label;
    }
  }
  return "FLAGMAN (TOO SLOW)";
}

export function calculateTimeslip(rtSeconds) {
  if (rtSeconds <= 0) {
    return {
      rt: "-.000",
      et60: "---",
      et330: "---",
      et660: "---",
      et1320: "---",
      trapMph: "0.00",
      rank: "RANK: FOUL",
      disqualified: true
    };
  }

  const et60 = (0.820 + rtSeconds * 0.15).toFixed(3);
  const et330 = (2.110 + rtSeconds * 0.4).toFixed(3);
  const et660 = (2.980 + rtSeconds * 0.7).toFixed(3);
  const et1320 = (3.850 + rtSeconds).toFixed(3);
  const trapMph = (332.5 - Math.min(rtSeconds * 20, 40)).toFixed(2);
  const rank = classifyReaction(rtSeconds);

  return {
    rt: `.${(rtSeconds * 1000).toFixed(0).padStart(3, "0")}`,
    et60,
    et330,
    et660,
    et1320,
    trapMph: `${trapMph} MPH`,
    rank: `RANK: ${rank}`,
    disqualified: false
  };
}

export function calculateVersusOutcome(p1Rt, p2Rt) {
  if (p1Rt <= 0 && p2Rt <= 0) {
    return { winner: null, doubleFoul: true, marginMs: 0 };
  }
  if (p1Rt <= 0) {
    return { winner: "p2", foul: "p1", marginMs: 0 };
  }
  if (p2Rt <= 0) {
    return { winner: "p1", foul: "p2", marginMs: 0 };
  }

  const diffMs = Math.round(Math.abs(p1Rt - p2Rt) * 1000);
  if (p1Rt < p2Rt) {
    return { winner: "p1", marginMs: diffMs, winnerRt: p1Rt, loserRt: p2Rt };
  } else if (p2Rt < p1Rt) {
    return { winner: "p2", marginMs: diffMs, winnerRt: p2Rt, loserRt: p1Rt };
  }
  return { winner: "tie", marginMs: 0, winnerRt: p1Rt, loserRt: p2Rt };
}

export function updateRollingAverage(history, newRt, windowSize = 10) {
  const next = [...history, newRt];
  if (next.length > windowSize) {
    next.shift();
  }
  const sum = next.reduce((a, b) => a + b, 0);
  const avg = sum / next.length;
  return {
    history: next,
    average: Number(avg.toFixed(3))
  };
}
