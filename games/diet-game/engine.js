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

export const ROMAN_VALS = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

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

/**
 * Every calorie figure in the text, signed. "-900 cal", "minus 200 cal" and "burned 300 kcal" are
 * negative (burned); everything else is a food. A hyphen straight after a digit ("200-300 cal") is
 * a range, not a minus.
 */
export function calorieEntries(text) {
  const re = /(?:(?<![\w\d])([-−–])\s*|\b(minus|burn(?:ed|t|s)?|burning)\s+)?(\d+(?:\.\d+)?)\s*(?:kcal|calories|calorie|cals?)\b/gi;
  return [...String(text).matchAll(re)].map((m) => {
    const n = parseFloat(m[3]);
    return m[1] || m[2] ? -n : n;
  });
}

/** { food, burned, net } where food is the sum of positive entries and burned the sum of negatives (as a positive number). */
export function calorieTotals(text) {
  const entries = calorieEntries(text);
  const food = entries.filter((n) => n > 0).reduce((a, n) => a + n, 0);
  const burned = -entries.filter((n) => n < 0).reduce((a, n) => a + n, 0);
  return { entries, food, burned, net: food - burned };
}

// Words that make a food plant-based ("vegan cheese", "plant-based steak", "veggie burger")
const PLANT_QUALIFIER = /(?:vegan|veggie|vegetarian|plant[\s-]?based|plant|dairy[\s-]?free|egg[\s-]?less|soy|soya|almond|oat|coconut|cashew|rice|hemp|tofu|seitan|tempeh|jackfruit|mushroom|lentil|bean|chickpea|beyond|impossible|peanut|cocoa|shea)/.source;
const ANIMAL_FOODS = /(?:steaks?|burgers?|hamburgers?|cheeseburgers?|patty|patties|pizzas?|meat|meats|meatballs?|mince|chicken|beef|pork|bacon|ham|sausages?|salami|pepperoni|hot\s*dogs?|nuggets?|turkey|duck|lamb|mutton|goat|veal|venison|bison|eggs?|omelettes?|mayo|mayonnaise|dairy|milk|cheese|cheesecake|butter|ghee|cream|yogh?urt|curd|dahi|paneer|mascarpone|whey|casein|gelatin|honey|salmon|fish|tuna|cod|tilapia|trout|mackerel|sardines?|anchov(?:y|ies)|shrimp|prawns?|crab|lobster|scallops?|mussels?|oysters?|squid|calamari|octopus|sushi|tiramisu|custard|ice\s*cream|gelato|kulfi|kheer|mousse|milkshake)/.source;
const QUALIFIED_RE = new RegExp(String.raw`\b${PLANT_QUALIFIER}\s+${ANIMAL_FOODS}\b`, "gi");
const ANIMAL_RE = new RegExp(String.raw`\b${ANIMAL_FOODS}\b`, "i");

/**
 * First non-vegan food in the text (e.g. "steak", "tiramisu"), or null. Anything explicitly
 * qualified as plant-based ("vegan steak", "oat milk", "veggie burger") is allowed.
 */
export function findNonVegan(text) {
  const m = stripPlantQualified(text).match(ANIMAL_RE);
  return m ? m[0] : null;
}

/** The text with plant-based phrases ("tofu steak", "oat milk") blanked out. */
export function stripPlantQualified(text) {
  return String(text).replace(QUALIFIED_RE, " ");
}

// Food emoji: fruit, veg, dishes, sweets and drinks (U+1F32D–1F37F, 1F950–1F96F, 1F9C0–1F9CB, 1FAD0–1FADB)
export const FOOD_EMOJI_RE = /[\u{1F32D}-\u{1F37F}\u{1F950}-\u{1F96F}\u{1F9C0}-\u{1F9CB}\u{1FAD0}-\u{1FADB}]/u;
export const FOOD_EMOJI_ALL_RE = new RegExp(FOOD_EMOJI_RE.source, "gu");
