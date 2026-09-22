/**
 * THE DIET GAME — Pure Rule & Food Verification Engine
 */

export const ATOMIC_NUMBERS = {
  H: 1, HE: 2, LI: 3, BE: 4, B: 5, C: 6, N: 7, O: 8, F: 9, NE: 10,
  NA: 11, MG: 12, AL: 13, SI: 14, P: 15, S: 16, CL: 17, AR: 18,
  K: 19, CA: 20, SC: 21, TI: 22, V: 23, CR: 24, MN: 25, FE: 26,
  CO: 27, NI: 28, CU: 29, ZN: 30, GA: 31, GE: 32, AS: 33, SE: 34,
  BR: 35, KR: 36, RB: 37, SR: 38, Y: 39, ZR: 40
};

export const ROMAN_VALS = { I: 1, V: 5, X: 10, L: 50, C: 100 };

export function parseRoman(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    const curr = ROMAN_VALS[str[i]] || 0;
    const next = ROMAN_VALS[str[i + 1]] || 0;
    if (curr < next) {
      sum += next - curr;
      i++;
    } else {
      sum += curr;
    }
  }
  return sum;
}

export function getMoonPhaseName(date = new Date()) {
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();
  if (month < 3) {
    year--;
    month += 12;
  }
  const c = 365.25 * year;
  const e = 30.6 * month;
  let jd = c + e + day - 694039.09;
  jd /= 29.5305882;
  const b = parseInt(jd, 10);
  jd -= b;
  const phase = Math.round(jd * 8) % 8;
  const names = [
    "new moon", "waxing crescent", "first quarter", "waxing gibbous",
    "full moon", "waning gibbous", "last quarter", "waning crescent"
  ];
  return names[phase];
}

export const BASIC_DIET_RULES = [
  {
    id: "r1",
    label: "Include at least 3 distinct food items.",
    test: (t) => {
      const items = t.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length > 2);
      return items.length >= 3;
    }
  },
  {
    id: "r2",
    label: "Must include at least one vegetable.",
    test: (t) => {
      const vegPattern = /\b(carrot|broccoli|spinach|kale|lettuce|cabbage|cucumber|zucchini|asparagus|onion|garlic|pea|peas|celery|cauliflower|bell pepper|tomato|potato|mushroom|eggplant|okra|beet|radish|corn)\b/i;
      return vegPattern.test(t);
    }
  },
  {
    id: "r3",
    label: "Total calories must be listed and under 600 cal.",
    test: (t) => {
      const m = t.match(/(\d+)\s*(?:cal|calories|kcal)/i);
      if (!m) return false;
      const cal = parseInt(m[1], 10);
      return cal < 600;
    }
  },
  {
    id: "r4",
    label: "Must include a source of protein.",
    test: (t) => {
      const proteinPattern = /\b(chicken|beef|steak|fish|salmon|tuna|tofu|tempeh|paneer|beans|lentils|eggs|egg|dal|soya|protein|turkey|shrimp|yogurt)\b/i;
      return proteinPattern.test(t);
    }
  },
  {
    id: "r5",
    label: "Roman numeral total in text must equal exactly 50 (L).",
    test: (t) => {
      const romanMatches = t.toUpperCase().match(/\b[IVXLCDM]+\b/g);
      if (!romanMatches) return false;
      const total = romanMatches.reduce((acc, r) => acc + parseRoman(r), 0);
      return total === 50;
    }
  }
];
