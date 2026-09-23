import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRoman,
  getMoonPhaseName,
  BASIC_DIET_RULES,
  ATOMIC_NUMBERS,
  ROMAN_VALS,
  calorieTotals,
  calorieEntries,
  findNonVegan,
  FOOD_EMOJI_RE
} from './engine.js';

describe('The Diet Game Rule Engine', () => {
  it('correctly parses additive and subtractive Roman numerals', () => {
    assert.equal(parseRoman('I'), 1);
    assert.equal(parseRoman('IV'), 4);
    assert.equal(parseRoman('V'), 5);
    assert.equal(parseRoman('IX'), 9);
    assert.equal(parseRoman('X'), 10);
    assert.equal(parseRoman('XL'), 40);
    assert.equal(parseRoman('L'), 50);
    assert.equal(parseRoman('XC'), 90);
    assert.equal(parseRoman('C'), 100);
  });

  it('determines valid moon phase names given a calendar date', () => {
    const validPhases = [
      'new moon', 'waxing crescent', 'first quarter', 'waxing gibbous',
      'full moon', 'waning gibbous', 'last quarter', 'waning crescent'
    ];
    const phase = getMoonPhaseName(new Date('2026-09-22T12:00:00Z'));
    assert.ok(validPhases.includes(phase), `Expected phase to be one of valid phases, got: ${phase}`);
  });

  it('validates basic diet rules: items count, vegetable, calories, protein, and roman numerals', () => {
    const r1 = BASIC_DIET_RULES.find(r => r.id === 'r1');
    const r2 = BASIC_DIET_RULES.find(r => r.id === 'r2');
    const r3 = BASIC_DIET_RULES.find(r => r.id === 'r3');
    const r4 = BASIC_DIET_RULES.find(r => r.id === 'r4');
    const r5 = BASIC_DIET_RULES.find(r => r.id === 'r5');

    // Passing text: 3 items (Spinach, Chicken breast, Brown rice), 450 cal, Roman numerals totaling 50 (e.g. XL X)
    const validText = `
      Spinach,
      Grilled chicken,
      Brown rice
      Calories: 450 cal
      Portion XL X
    `;

    assert.equal(r1.test(validText), true, 'Rule 1: at least 3 items');
    assert.equal(r2.test(validText), true, 'Rule 2: contains vegetable (spinach)');
    assert.equal(r3.test(validText), true, 'Rule 3: under 600 cal');
    assert.equal(r4.test(validText), true, 'Rule 4: contains protein (chicken)');
    assert.equal(r5.test(validText), true, 'Rule 5: Roman numerals XL (40) + X (10) = 50');

    // Failing cases
    assert.equal(r3.test('Calories: 750 cal'), false, 'Calorie cap 600 violated');
    assert.equal(r2.test('Burger, Fries, Soda'), false, 'No vegetable');
    assert.equal(r4.test('Carrot, Apple, Pear'), false, 'No protein');
    assert.equal(r5.test('Portion V'), false, 'Roman total does not equal 50');
  });

  it('contains periodic table atomic numbers for advanced diet rules', () => {
    assert.equal(ATOMIC_NUMBERS.H, 1);
    assert.equal(ATOMIC_NUMBERS.C, 6);
    assert.equal(ATOMIC_NUMBERS.N, 7);
    assert.equal(ATOMIC_NUMBERS.O, 8);
    assert.equal(ATOMIC_NUMBERS.NA, 11);
    assert.equal(ATOMIC_NUMBERS.FE, 26);
  });
});

describe('Calories, vegan check and food emoji', () => {
  it('treats minus / burned amounts as negative and sums food separately', () => {
    const t = 'pizza 50 cal\nburger 50 cal\ncarrot 200 cal\ntofu 500 cal\norange 100 cal\nsteak 900 cal\ntiramisu -900 cal';
    const c = calorieTotals(t);
    assert.equal(c.food, 1800);
    assert.equal(c.burned, 900);
    assert.equal(c.net, 900);
    assert.deepEqual(calorieEntries('burned 300 kcal, minus 50 cal, rice 200 calories'), [-300, -50, 200]);
    // A hyphen straight after a digit is a range, not a minus
    assert.deepEqual(calorieEntries('200-300 cal'), [300]);
  });

  it('flags animal foods but allows plant-based versions', () => {
    for (const t of ['steak', 'pizza', 'burger', 'hamburger', 'tiramisu', 'ice cream', 'paneer', 'egg']) assert.ok(findNonVegan(t), t);
    for (const t of ['tofu steak', 'plant-based steak', 'plant based steak', 'veggie burger', 'oat milk', 'vegan cheesecake', 'peanut butter', 'sorbet', 'sweet potato'])
      assert.equal(findNonVegan(t), null, t);
  });

  it('parses D and M in Roman numerals', () => {
    assert.equal(parseRoman('MIX'), 1009);
    assert.equal(parseRoman('CD'), 400);
    assert.equal(parseRoman('MCMXC'), 1990);
  });

  it('recognises fruit and veg emoji but not fire', () => {
    for (const e of ['🍎', '🍇', '🍊', '🍌', '🥑', '🥦', '🌽', '🍄', '🫐']) assert.ok(FOOD_EMOJI_RE.test(e), e);
    assert.equal(FOOD_EMOJI_RE.test('🔥'), false);
  });
});
