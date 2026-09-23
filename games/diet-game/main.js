import { initShell, escapeHtml, toast } from "/shared/shell.js";
import { sfx } from "/shared/sound.js";
import { saveScore } from "/shared/scores.js";
import { createRuleEngine } from "/shared/rule-engine.js";
import { ATOMIC_NUMBERS, parseRoman, getMoonPhaseName, calorieTotals, findNonVegan, stripPlantQualified, FOOD_EMOJI_RE, FOOD_EMOJI_ALL_RE } from "./engine.js";

initShell({ crumb: "The Diet Game" });

const mealInput = document.getElementById("meal-input");
const charStat = document.getElementById("char-stat");
const lineStat = document.getElementById("line-stat");
const activeTimersEl = document.getElementById("active-timers");
const ruleCountEl = document.getElementById("rule-count");
const absurdityFill = document.getElementById("absurdity-fill");
const rulesList = document.getElementById("rules-list");
const plateItems = document.getElementById("plate-items");
const failOverlay = document.getElementById("fail-overlay");
const failMsg = document.getElementById("fail-msg");
const winOverlay = document.getElementById("win-overlay");
const btnRestart = document.getElementById("btn-restart");
const btnWinRestart = document.getElementById("btn-win-restart");
const btnShareResult = document.getElementById("btn-share-result");

// State
let avocadoAddedTime = null;
let fireAddedTime = null;
let avocadoTimerInterval = null;
let fireTimerInterval = null;
let hasWon = false;

const FOOD_DICTIONARY = [
  // Plant-based proteins
  { pattern: /\b(?:soya?|soy)\s+chunks?\b/i, name: "Soya Chunks", emoji: "🌱", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:soya?|soy)\s+beans?\b/i, name: "Soybeans", emoji: "🫘", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:tofu)\b/i, name: "Tofu", emoji: "🧊", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:tempeh)\b/i, name: "Tempeh", emoji: "🥢", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:seitan)\b/i, name: "Seitan", emoji: "🌾", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:edamame)\b/i, name: "Edamame", emoji: "🫛", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:nutrela|tvp)\b/i, name: "Soya TVP", emoji: "🌱", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:paneer)\b/i, name: "Paneer", emoji: "🧀", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:dal|dhal|daal)\b/i, name: "Lentil Dal", emoji: "🍲", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:lentils?)\b/i, name: "Lentils", emoji: "🍲", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:chickpeas?|chana|chole|garbanzo)\b/i, name: "Chickpeas", emoji: "🧆", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:rajma|kidney\s+beans?)\b/i, name: "Rajma", emoji: "🫘", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:black\s+beans?|pinto\s+beans?|beans?)\b/i, name: "Beans", emoji: "🫘", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:quinoa)\b/i, name: "Quinoa", emoji: "🥣", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:protein\s+powder|whey|casein)\b/i, name: "Protein", emoji: "🥤", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:pea\s+protein|soy\s+protein|plant\s+protein)\b/i, name: "Plant Protein", emoji: "🥤", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:peanut\s+butter)\b/i, name: "Peanut Butter", emoji: "🥜", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:peanuts?)\b/i, name: "Peanuts", emoji: "🥜", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:almonds?)\b/i, name: "Almonds", emoji: "🌰", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:walnuts?|cashews?|pistachios?|nuts?)\b/i, name: "Nuts", emoji: "🌰", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:chia\s+seeds?|hemp\s+seeds?|flax\s*seeds?|seeds?)\b/i, name: "Seeds", emoji: "🌱", category: "protein", isProtein: true, isVegan: true },

  // Animal proteins
  { pattern: /\b(?:chicken|poultry)\b/i, name: "Chicken", emoji: "🍗", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:plant(?:\s*-\s*based)?\s+steak|vegan\s+steak|tofu\s+steak|seitan\s+steak)\b/i, name: "Plant Steak", emoji: "🥩", category: "protein", isProtein: true, isVegan: true },
  { pattern: /\b(?:steak|beef|bison|veal)\b/i, name: "Steak", emoji: "🥩", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:salmon)\b/i, name: "Salmon", emoji: "🐟", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:tuna|fish|cod|tilapia|trout|mackerel)\b/i, name: "Fish", emoji: "🐟", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:shrimp|prawns?|crab|lobster)\b/i, name: "Seafood", emoji: "🍤", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:eggs?|egg\s+whites?|omelette?)\b/i, name: "Egg", emoji: "🥚", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:turkey|duck|lamb|mutton|pork|bacon|ham|sausage)\b/i, name: "Meat", emoji: "🥓", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:greek\s+yogurt|yogurt|yoghurt|curd|dahi)\b/i, name: "Yogurt", emoji: "🥣", category: "protein", isProtein: true, isVegan: false },
  { pattern: /\b(?:cheese|cheddar|mozzarella)\b/i, name: "Cheese", emoji: "🧀", category: "protein", isProtein: true, isVegan: false },

  // Vegetables
  { pattern: /\b(?:carrots?)\b/i, name: "Carrot", emoji: "🥕", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:broccoli)\b/i, name: "Broccoli", emoji: "🥦", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:spinach|palak)\b/i, name: "Spinach", emoji: "🥬", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:kale|lettuce|arugula|greens?)\b/i, name: "Greens", emoji: "🥗", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:cabbage)\b/i, name: "Cabbage", emoji: "🥬", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:cucumbers?)\b/i, name: "Cucumber", emoji: "🥒", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:zucchini|courgette)\b/i, name: "Zucchini", emoji: "🥒", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:asparagus)\b/i, name: "Asparagus", emoji: "🌱", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:bell\s+peppers?|peppers?|capsicum)\b/i, name: "Bell Pepper", emoji: "🫑", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:onions?|shallots?|scallions?)\b/i, name: "Onion", emoji: "🧅", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:garlic)\b/i, name: "Garlic", emoji: "🧄", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:tomatoes?)\b/i, name: "Tomato", emoji: "🍅", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:potatoes?)\b/i, name: "Potato", emoji: "🥔", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:sweet\s+potatoes?)\b/i, name: "Sweet Potato", emoji: "🍠", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:mushrooms?)\b/i, name: "Mushroom", emoji: "🍄", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:eggplant|aubergine|brinjal)\b/i, name: "Eggplant", emoji: "🍆", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:corn|maize|sweetcorn)\b/i, name: "Corn", emoji: "🌽", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:peas?|green\s+peas?)\b/i, name: "Peas", emoji: "🫛", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:celery)\b/i, name: "Celery", emoji: "🥬", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:cauliflower)\b/i, name: "Cauliflower", emoji: "🥦", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:avocado)\b/i, name: "Avocado", emoji: "🥑", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:okra|bhindi|ladyfinger)\b/i, name: "Okra", emoji: "🌱", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:beets?|beetroot)\b/i, name: "Beetroot", emoji: "🟣", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:radish(?:es)?)\b/i, name: "Radish", emoji: "🌱", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:pumpkin|squash)\b/i, name: "Pumpkin", emoji: "🎃", category: "veg", isVeg: true, isVegan: true },

  // Fruits
  { pattern: /\b(?:apples?)\b/i, name: "Apple", emoji: "🍎", category: "fruit", isVegan: true },
  { pattern: /\b(?:bananas?)\b/i, name: "Banana", emoji: "🍌", category: "fruit", isVegan: true },
  { pattern: /\b(?:oranges?|citrus)\b/i, name: "Orange", emoji: "🍊", category: "fruit", isVegan: true },
  { pattern: /\b(?:strawberr(?:y|ies))\b/i, name: "Strawberry", emoji: "🍓", category: "fruit", isVegan: true },
  { pattern: /\b(?:blueberr(?:y|ies)|berries)\b/i, name: "Berries", emoji: "🫐", category: "fruit", isVegan: true },
  { pattern: /\b(?:mango(?:es)?)\b/i, name: "Mango", emoji: "🥭", category: "fruit", isVegan: true },
  { pattern: /\b(?:pineapples?)\b/i, name: "Pineapple", emoji: "🍍", category: "fruit", isVegan: true },
  { pattern: /\b(?:watermelons?|melons?)\b/i, name: "Melon", emoji: "🍉", category: "fruit", isVegan: true },
  { pattern: /\b(?:grapes?)\b/i, name: "Grapes", emoji: "🍇", category: "fruit", isVegan: true },
  { pattern: /\b(?:peaches?)\b/i, name: "Peach", emoji: "🍑", category: "fruit", isVegan: true },
  { pattern: /\b(?:cherries|cherry)\b/i, name: "Cherry", emoji: "🍒", category: "fruit", isVegan: true },
  { pattern: /\b(?:lemons?|limes?)\b/i, name: "Lemon", emoji: "🍋", category: "fruit", isVegan: true },

  // Grains, Fast Food, Prepared items
  { pattern: /\b(?:pizza)\b/i, name: "Pizza", emoji: "🍕", category: "grain", isVegan: false },
  { pattern: /\b(?:veggie|vegan|plant[\s-]?based|beyond|impossible|bean|mushroom)\s+burgers?\b/i, name: "Veggie Burger", emoji: "🍔", category: "grain", isVegan: true },
  { pattern: /\b(?:(?:ham|cheese)?burgers?)\b/i, name: "Burger", emoji: "🍔", category: "grain", isVegan: false },
  { pattern: /\b(?:sandwich(?:es)?|wrap)\b/i, name: "Sandwich", emoji: "🥪", category: "grain", isVegan: true },
  { pattern: /\b(?:tacos?|burritos?)\b/i, name: "Taco", emoji: "🌮", category: "grain", isVegan: false },
  { pattern: /\b(?:oatmeal|oats|porridge)\b/i, name: "Oatmeal", emoji: "🥣", category: "grain", isVegan: true },
  { pattern: /\b(?:rice|biryani|pulao|fried\s+rice)\b/i, name: "Rice", emoji: "🍚", category: "grain", isVegan: true },
  { pattern: /\b(?:pasta|spaghetti|noodles|ramen)\b/i, name: "Pasta", emoji: "🍝", category: "grain", isVegan: true },
  { pattern: /\b(?:bread|toast|bagel|sourdough)\b/i, name: "Bread", emoji: "🍞", category: "grain", isVegan: true },
  { pattern: /\b(?:roti|chapati|naan|paratha|flatbread)\b/i, name: "Roti", emoji: "🫓", category: "grain", isVegan: true },
  { pattern: /\b(?:fries|french\s+fries|chips)\b/i, name: "Fries", emoji: "🍟", category: "grain", isVegan: true },
  { pattern: /\b(?:samosas?)\b/i, name: "Samosa", emoji: "🥟", category: "grain", isVegan: true },
  { pattern: /\b(?:dosa|idli)\b/i, name: "Dosa", emoji: "🥞", category: "grain", isVegan: true },
  { pattern: /\b(?:salad)\b/i, name: "Salad", emoji: "🥗", category: "veg", isVeg: true, isVegan: true },
  { pattern: /\b(?:soup)\b/i, name: "Soup", emoji: "🥣", category: "veg", isVegan: true },
  { pattern: /\b(?:sushi)\b/i, name: "Sushi", emoji: "🍣", category: "protein", isProtein: true, isVegan: false },

  // Desserts
  { pattern: /\b(?:cakes?|cupcakes?)\b/i, name: "Cake", emoji: "🍰", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:cookies?|biscuits?)\b/i, name: "Cookie", emoji: "🍪", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:ice\s*cream|gelato)\b/i, name: "Ice Cream", emoji: "🍨", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:sorbet)\b/i, name: "Sorbet", emoji: "🍧", category: "dessert", isDessert: true, isVegan: true },
  { pattern: /\b(?:tiramisu)\b/i, name: "Tiramisu", emoji: "🍰", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:cheesecake)\b/i, name: "Cheesecake", emoji: "🍰", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:mousse)\b/i, name: "Mousse", emoji: "🍮", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:brownies?)\b/i, name: "Brownie", emoji: "🍫", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:chocolates?)\b/i, name: "Chocolate", emoji: "🍫", category: "dessert", isDessert: true, isVegan: true },
  { pattern: /\b(?:donuts?|doughnuts?)\b/i, name: "Donut", emoji: "🍩", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:puddings?|custard)\b/i, name: "Pudding", emoji: "🍮", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:pies?|tarts?)\b/i, name: "Pie", emoji: "🥧", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:pancakes?|waffles?)\b/i, name: "Pancakes", emoji: "🥞", category: "dessert", isDessert: true, isVegan: false },
  { pattern: /\b(?:halwa|gulab\s+jamun|jalebi|kheer|rasgulla|sweets?(?!\s+potato))\b/i, name: "Mithai", emoji: "🍯", category: "dessert", isDessert: true, isVegan: false }
];

const DIET_RULES = [
  {
    id: "r1",
    label: "Include at least 3 distinct food items (separated by commas or lines).",
    test: (t) => {
      // Distinct items: "rice, rice, rice" is one food, not three
      const items = new Set(t.split(/[\n,]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 2));
      return { pass: items.size >= 3, note: `Distinct items: ${items.size}` };
    },
  },
  {
    id: "r2",
    label: "Must include at least one vegetable.",
    test: (t) => {
      const vegPattern = /\b(carrot|carrots|broccoli|spinach|kale|lettuce|cabbage|cucumber|cucumbers|zucchini|asparagus|onion|onions|garlic|pea|peas|celery|cauliflower|bell pepper|bell peppers|pepper|peppers|tomato|tomatoes|potato|potatoes|sweet potato|sweet potatoes|mushroom|mushrooms|eggplant|aubergine|brinjal|okra|bhindi|ladyfinger|beet|beets|beetroot|radish|radishes|corn|sweetcorn|maize|green beans|string beans|snap peas|artichoke|artichokes|leek|leeks|scallion|scallions|spring onion|spring onions|brussels sprouts|sprout|sprouts|arugula|rocket|bok choy|pak choi|chard|swiss chard|squash|butternut|pumpkin|bitter gourd|karela|bottle gourd|lauki|palak|methi|fenugreek|coriander|cilantro|ginger|turnip|turnips|parsnip|parsnips|yam|yams|cassava|fennel|shallot|shallots|jalapeno|jalapenos|chili|chilies|chilli|chillies)\b/i;
      const emojiVeg = /[\u{1F96C}\u{1F966}\u{1F955}\u{1F33D}\u{1F336}\u{1FAD1}\u{1F952}\u{1F9C4}\u{1F9C5}\u{1F344}\u{1F954}\u{1F958}\u{1F345}\u{1F951}\u{1FAD8}]/u;
      return vegPattern.test(t) || emojiVeg.test(t);
    },
  },
  {
    id: "r3",
    label: "Total calories must be listed and under 600 cal.",
    test: (t) => {
      const c = calorieTotals(t);
      if (!c.entries.length) return { pass: false, note: "Specify calories, e.g. '450 cal'" };
      return { pass: c.net < 600, note: `Current total: ${c.net} cal` };
    },
  },
  {
    id: "r4",
    label: "Must include a recognized protein source.",
    test: (t) => {
      const proteinPattern = /\b(soya?\s*chunks?|soy\s*chunks?|soya?\s*beans?|soybeans?|soya?|soy|edamame|tofu|tempeh|seitan|tvp|nutrela|paneer|cottage\s*cheese|dal|dhal|daal|chana|chole|rajma|chickpeas?|garbanzo|lentils?|beans?|black\s*beans?|kidney\s*beans?|pinto\s*beans?|cannellini|mung|moong|urad|masoor|quinoa|hemp\s*seeds?|chia\s*seeds?|flax\s*seeds?|nutritional\s*yeast|protein\s*powder|whey|casein|pea\s*protein|soy\s*protein|plant\s*protein|peanut\s*butter|almond\s*butter|peanuts?|almonds?|walnuts?|cashews?|pistachios?|nuts?|seeds?|chicken|beef|pork|turkey|duck|lamb|mutton|goat|venison|bison|veal|bacon|ham|sausage|meatballs?|steak|patty|patties|salmon|tuna|fish|cod|tilapia|trout|sardines?|anchov(?:y|ies)|mackerel|halibut|shrimp|prawns?|crab|lobster|scallops?|mussels?|oysters?|squid|calamari|octopus|eggs?|egg\s*whites?|greek\s*yogurt|yogurt|yoghurt|cheese|ricotta|milk)\b/i;
      const emojiProtein = /[\u{1F969}\u{1F357}\u{1F356}\u{1F953}\u{1F373}\u{1F95A}\u{1F9C0}\u{1F364}\u{1F990}\u{1F980}\u{1F99E}\u{1F41F}\u{1F363}\u{1FAD8}]/u;
      return proteinPattern.test(t) || emojiProtein.test(t);
    },
  },
  {
    id: "r5",
    label: "Include a colour word (e.g. red, green, golden).",
    test: (t) => /\b(red|green|blue|yellow|orange|purple|golden|black|white|brown|emerald|violet)\b/i.test(t),
  },
  {
    id: "r6",
    label: "Must be 100% vegan (no meat, eggs, dairy, poultry, or fish).",
    test: (t) => {
      // Plant-based versions ("tofu steak", "oat milk", "veggie burger") are fine
      const found = findNonVegan(t);
      if (found) return { pass: false, note: `Not vegan: ${found} (try a plant-based version)` };
      return true;
    },
  },
  {
    id: "r7",
    label: "Must include steak (hint: plant-based steaks count).",
    test: (t) => /\bsteaks?\b/i.test(t),
  },
  {
    id: "r8",
    label: "The food calories (positive amounts) must now sum to exactly 1000.",
    test: (t) => {
      const c = calorieTotals(t);
      if (!c.entries.length) return { pass: false, note: "Include calorie amounts" };
      return { pass: c.food === 1000, note: `Food calories: ${c.food} / 1000` };
    },
  },
  {
    id: "r9",
    label: "Include a dessert item.",
    test: (t) => /\b(cake|cakes|cupcake|cupcakes|cookie|cookies|biscuit|biscuits|pudding|sorbet|ice cream|gelato|kulfi|brownie|brownies|pie|pies|tart|tarts|parfait|chocolate|chocolates|donut|donuts|doughnut|doughnuts|pastry|pastries|mousse|cheesecake|pancake|pancakes|waffle|waffles|halwa|gulab jamun|jalebi|kheer|rasgulla|barfi|laddoo|ladoo|custard|sundae|fudge|macaron|macarons|churro|churros|baklava|tiramisu|candy|candies|sweets?(?!\s+potato)|dessert|desserts|truffle|truffles)\b/i.test(t) || /[\u{1F370}\u{1F36A}\u{1F366}\u{1F368}\u{1F369}\u{1F36B}\u{1F36E}\u{1F967}\u{1F95E}]/u.test(t),
  },
  {
    id: "r10",
    label: "Contradiction! Net calories must now be under 400 cal (hint: add negative/burned calories).",
    test: (t) => {
      // Net = food calories minus anything negative or burned ("-800 cal workout", "burned 300 cal")
      const c = calorieTotals(t);
      return { pass: c.net < 400, note: `Net: ${c.food} − ${c.burned} = ${c.net} cal (try adding '-800 cal workout')` };
    },
  },
  {
    id: "r11",
    label: "Include a locally grown ingredient (must contain 'local', 'garden', or 'backyard').",
    test: (t) => /\b(local|locally|garden|backyard|farm-to-table)\b/i.test(t),
  },
  {
    id: "r12",
    label: "Include at least one food emoji (🍎, 🥦, 🥑, 🥕, etc.).",
    test: (t) => FOOD_EMOJI_RE.test(t),
  },
  {
    id: "r13",
    label: "AVOCADO PROTOCOL: An avocado 🥑 rots in 60s. Replace it with fresh produce!",
    test: (t) => {
      if (/🥑/.test(t)) {
        if (!avocadoAddedTime) avocadoAddedTime = Date.now();
        const elapsed = (Date.now() - avocadoAddedTime) / 1000;
        if (elapsed > 60) return { pass: false, note: "AVOCADO ROTTEN!" };
        return { pass: true, note: `Fresh for ${Math.max(0, Math.round(60 - elapsed))}s` };
      }
      return { pass: true, note: "No avocado at risk" };
    },
    failCheck: () => {
      if (avocadoAddedTime) {
        const elapsed = (Date.now() - avocadoAddedTime) / 1000;
        if (elapsed > 60) return "The avocado emoji rotted into toxic grey paste. Rule 13 violation.";
      }
      return null;
    },
  },
  {
    id: "r14",
    label: "Include a valid chemical element symbol (e.g. Ca, Fe, Na, K, Mg).",
    test: (t) => /\b(H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|Zr)\b/.test(t),
  },
  {
    id: "r15",
    label: "Element atomic numbers in the text must sum to exactly 40 (e.g. Ca + Ca, or Zr, or Ar + Ti).",
    test: (t) => {
      const matches = t.match(/\b(H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|Zr)\b/g) || [];
      const sum = matches.reduce((acc, sym) => acc + (ATOMIC_NUMBERS[sym.toUpperCase()] || 0), 0);
      return { pass: sum === 40, note: `Elements found: [${matches.join(", ")}] Sum: ${sum} / 40` };
    },
  },
  {
    id: "r16",
    label: `Include today's astronomical moon phase as a word (Today: "${getMoonPhaseName()}").`,
    test: (t) => {
      const phase = getMoonPhaseName();
      return t.toLowerCase().includes(phase);
    },
  },
  {
    id: "r17",
    label: "Roman numerals in your text must multiply to exactly 12 (e.g. III × IV, or II × VI).",
    test: (t) => {
      const romans = (t.match(/\b[IVXLCDM]+\b/g) || []).map(parseRoman).filter((n) => n > 0 && n <= 100);
      if (romans.length < 2) return { pass: false, note: "Include Roman numerals, e.g. III and IV" };
      const prod = romans.reduce((a, b) => a * b, 1);
      return { pass: prod === 12, note: `Current product: ${prod}` };
    },
  },
  {
    id: "r18",
    label: "Must declare: gluten-free, keto, halal, and kosher simultaneously.",
    test: (t) => /gluten-?free/i.test(t) && /\bketo\b/i.test(t) && /\bhalal\b/i.test(t) && /\bkosher\b/i.test(t),
  },
  {
    id: "r19",
    label: "Include exactly one deliberate typo tagged as [typo:word].",
    test: (t) => {
      const m = t.match(/\[typo:[^\]]+\]/g);
      return m && m.length === 1;
    },
  },
  {
    id: "r20",
    label: "FIRE HAZARD: If fire 🔥 appears, extinguish it within 20s!",
    test: (t) => {
      if (/🔥/.test(t)) {
        if (!fireAddedTime) fireAddedTime = Date.now();
        const elapsed = (Date.now() - fireAddedTime) / 1000;
        if (elapsed > 20) return { pass: false, note: "KITCHEN BURNT DOWN!" };
        return { pass: true, note: `Extinguish in ${Math.max(0, Math.round(20 - elapsed))}s` };
      }
      return { pass: true, note: "No active fire" };
    },
    failCheck: () => {
      if (fireAddedTime) {
        const elapsed = (Date.now() - fireAddedTime) / 1000;
        if (elapsed > 20) return "A grease fire consumed the entire kitchen. Rule 20 violation.";
      }
      return null;
    },
  },
  {
    id: "r21",
    label: "Include a price formatted in Indian Rupees (e.g. ₹250, Rs 250 or 500 rupees).",
    test: (t) => /₹\s*\d+|\b(?:rs\.?|inr)\s*\d+|\b\d+\s*(?:rs|inr|rupees?)\b/i.test(t),
  },
  {
    id: "r22",
    label: "Include at least one 5-letter word.",
    test: (t) => /\b[a-zA-Z]{5}\b/.test(t),
  },
  {
    id: "r23",
    label: "The last two words of your plan must rhyme (e.g. bean and clean, or rice and spice).",
    test: (t) => {
      // Ignore the sign-off token, typo tags and calorie units so this rule can coexist with the others.
      const cleaned = t.replace(/DIET_APPROVED_2026/g, " ").replace(/\[typo:[^\]]*\]/gi, " ");
      const words = (cleaned.match(/[a-zA-Z]{3,}/g) || []).filter((w) => !/^(cal|kcal|calories|rupees)$/i.test(w));
      if (words.length < 2) return { pass: false, note: "Add two rhyming food words near the end" };
      const w1 = words[words.length - 2].toLowerCase();
      const w2 = words[words.length - 1].toLowerCase();
      // Last two letters must match (bean/clean, rice/spice)
      return { pass: w1.slice(-2) === w2.slice(-2) && w1 !== w2, note: `Last two words: "${w1}" / "${w2}"` };
    },
  },
  {
    id: "r24",
    label: "The entire meal plan must fit on exactly ONE line (no line breaks).",
    test: (t) => !t.includes("\n") && t.trim().length > 0,
  },
  {
    id: "r25",
    label: "Final submission: End your plan with 'DIET_APPROVED_2026'.",
    test: (t) => t.trimEnd().endsWith("DIET_APPROVED_2026"),
  },
];

const engine = createRuleEngine(DIET_RULES, {
  onFail: (reason) => {
    sfx.bad();
    failMsg.textContent = reason;
    failOverlay.style.display = "flex";
  },
  onPassRule: (count) => {
    sfx.good();
    toast({ title: `RULE ${count - 1} SECURED`, body: `Directive unlocked.`, icon: "check" });
  },
});

function extractPlatedFoods(text) {
  const plated = [];
  const seen = new Set();

  // 1. Scan for dictionary items ("tofu steak" plates a Plant Steak, not a beef one)
  const animalText = stripPlantQualified(text);
  for (const item of FOOD_DICTIONARY) {
    if (item.pattern.test(item.isVegan === false ? animalText : text)) {
      if (!seen.has(item.name)) {
        seen.add(item.name);
        seen.add(item.emoji);
        plated.push(item);
      }
    }
  }

  // 2. Food emojis typed on their own (🔥 and other non-food emoji stay off the plate)
  const rawEmojis = text.match(FOOD_EMOJI_ALL_RE) || [];
  for (const em of rawEmojis) {
    if (!seen.has(em)) {
      seen.add(em);
      plated.push({
        name: "Item",
        emoji: em,
        category: "fruit",
        isProtein: false,
        isVegan: true,
      });
    }
  }

  return plated;
}

function updatePlateVisual(text) {
  const platedFoods = extractPlatedFoods(text);
  const plateBadge = document.getElementById("plate-badge");
  const ptItemsVal = document.getElementById("pt-items-val");
  const ptCalVal = document.getElementById("pt-cal-val");
  const ptProteinVal = document.getElementById("pt-protein-val");
  const ptVeganVal = document.getElementById("pt-vegan-val");

  if (!platedFoods.length) {
    plateItems.innerHTML = `<span class="plate-empty">&gt; PLATE EMPTY</span>`;
    if (plateBadge) {
      plateBadge.textContent = "STATUS: WAITING";
      plateBadge.classList.remove("is-active");
    }
  } else {
    const displayFoods = platedFoods.slice(0, 10);
    plateItems.innerHTML = displayFoods
      .map(
        (f) =>
          `<span class="plate-food-badge is-${f.category}"><span>${f.emoji}</span><span>${escapeHtml(f.name)}</span></span>`
      )
      .join("");
    if (plateBadge) {
      plateBadge.textContent = `STATUS: PLATED (${platedFoods.length})`;
      plateBadge.classList.add("is-active");
    }
  }

  // Telemetry updates
  if (ptItemsVal) {
    ptItemsVal.textContent = platedFoods.length.toString();
  }

  const cal = calorieTotals(text);
  if (ptCalVal) {
    ptCalVal.textContent = cal.burned ? `${cal.net} CAL NET (${cal.food} − ${cal.burned})` : `${cal.net} CAL`;
  }

  const detectedProteins = platedFoods.filter((f) => f.isProtein).map((f) => f.name.toUpperCase());
  if (ptProteinVal) {
    if (detectedProteins.length) {
      ptProteinVal.textContent = detectedProteins.slice(0, 2).join(", ");
      ptProteinVal.style.color = "#00ff66";
    } else {
      ptProteinVal.textContent = "NONE";
      ptProteinVal.style.color = "var(--dim)";
    }
  }

  if (ptVeganVal) {
    if (!findNonVegan(text)) {
      ptVeganVal.textContent = "YES";
      ptVeganVal.style.color = "#00ff66";
    } else {
      ptVeganVal.textContent = "NO (ANIMAL)";
      ptVeganVal.style.color = "var(--danger, #ff3b30)";
    }
  }
}

function renderUI() {
  const text = mealInput.value;
  charStat.textContent = `CHARS: ${text.length}`;
  lineStat.textContent = `LINES: ${text.split("\n").length}`;

  // Timed hazards only tick while the emoji is actually on the plate.
  if (!/🥑/u.test(text)) avocadoAddedTime = null;
  if (!/🔥/u.test(text)) fireAddedTime = null;

  const res = engine.evaluate(text, {});
  if (res.failed) {
    ruleCountEl.textContent = `${res.unlockedCount} / ${res.total}`;
    return;
  }

  ruleCountEl.textContent = `${res.unlockedCount} / ${res.total}`;
  const pct = Math.round((res.unlockedCount / res.total) * 100);
  absurdityFill.style.width = `${pct}%`;

  // Render rules
  rulesList.innerHTML = res.results
    .map((r) => {
      const cls = r.passed ? "rule-card--pass" : "rule-card--fail";
      const icon = r.passed ? "[OK]" : "[FAIL]";
      return `
      <div class="rule-card ${cls}">
        <div class="rule-card__head">
          <span>RULE ${r.order}</span>
          <span>${icon}</span>
        </div>
        <div class="rule-card__desc">${escapeHtml(r.label)}</div>
        ${r.note ? `<div class="rule-card__note">&gt; ${escapeHtml(r.note)}</div>` : ""}
      </div>
    `;
    })
    .join("");

  updatePlateVisual(text);

  // Save score
  saveScore("diet-game", res.passedCount, `${res.passedCount}/25 Rules`);

  if (res.completedAll && !hasWon) {
    hasWon = true;
    sfx.win();
    winOverlay.style.display = "flex";
  }
}

mealInput.addEventListener("input", renderUI);
mealInput.addEventListener("keydown", (e) => {
  if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
    sfx.type();
  }
});

btnRestart.addEventListener("click", () => {
  sfx.click();
  avocadoAddedTime = null;
  fireAddedTime = null;
  hasWon = false;
  engine.reset();
  failOverlay.style.display = "none";
  mealInput.value = "";
  renderUI();
});

btnWinRestart.addEventListener("click", () => {
  sfx.click();
  winOverlay.style.display = "none";
  avocadoAddedTime = null;
  fireAddedTime = null;
  hasWon = false;
  engine.reset();
  mealInput.value = "";
  renderUI();
});

btnShareResult.addEventListener("click", () => {
  const cert = `[THE DIET GAME // SYS:TIMESINK.NET]\n25/25 Rules Solved. Absurdity 100%.\nMeal Plan Certified.`;
  navigator.clipboard?.writeText?.(cert);
  toast({ title: "COPIED TO CLIPBOARD", body: cert, icon: "check" });
});

// Live ticker for timed rules
setInterval(() => {
  if (avocadoAddedTime || fireAddedTime) {
    renderUI();
  }
}, 1000);

renderUI();
