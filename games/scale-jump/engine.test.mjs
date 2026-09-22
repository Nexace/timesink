import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKPOINTS, CATEGORIES, COMPARE_PRESETS, formatMetricExponent, formatScientificNotation, calculateScaleRatio } from './data.js';

describe('Scale Jump Checkpoint Database', () => {
  it('has at least 60 detailed checkpoints', () => {
    assert.ok(CHECKPOINTS.length >= 60, `Expected >= 60 checkpoints, got ${CHECKPOINTS.length}`);
  });

  it('spans the full range from Planck length (-35) to the Observable Universe (27)', () => {
    const minLog = Math.min(...CHECKPOINTS.map(c => c.log));
    const maxLog = Math.max(...CHECKPOINTS.map(c => c.log));
    assert.equal(minLog, -35, 'Minimum log scale must be -35');
    assert.equal(maxLog, 27, 'Maximum log scale must be 27');
  });

  it('has no scale gaps larger than 2 orders of magnitude between consecutive unique orders', () => {
    const sortedLogs = [...new Set(CHECKPOINTS.map(c => c.log))].sort((a, b) => a - b);
    for (let i = 0; i < sortedLogs.length - 1; i++) {
      const gap = sortedLogs[i + 1] - sortedLogs[i];
      assert.ok(gap <= 2, `Gap between log ${sortedLogs[i]} and ${sortedLogs[i+1]} is ${gap}, expected <= 2`);
    }
  });

  it('each checkpoint has valid id, name, category, log, exactM, metric, imperial, fact, analogy, and draw', () => {
    const ids = new Set();
    for (const c of CHECKPOINTS) {
      assert.ok(c.id && typeof c.id === 'string', `Checkpoint must have id string: ${c.name}`);
      assert.ok(!ids.has(c.id), `Duplicate checkpoint id: ${c.id}`);
      ids.add(c.id);

      assert.ok(c.name && typeof c.name === 'string', `Missing name for ${c.id}`);
      assert.ok(typeof c.log === 'number' && c.log >= -35 && c.log <= 27, `Invalid log ${c.log} for ${c.id}`);
      assert.ok(typeof c.exactM === 'number' && c.exactM > 0, `Invalid exactM for ${c.id}`);
      assert.ok(c.metric && typeof c.metric === 'string', `Missing metric string for ${c.id}`);
      assert.ok(c.imperial && typeof c.imperial === 'string', `Missing imperial string for ${c.id}`);
      assert.ok(c.fact && c.fact.length > 20, `Fact must be detailed for ${c.id}`);
      assert.ok(c.analogy && c.analogy.length > 20, `Analogy must be detailed for ${c.id}`);
      assert.ok(typeof c.draw === 'function', `draw must be a function for ${c.id}`);

      // Verify draw function produces non-empty SVG string
      const svg = c.draw('#00f0ff');
      assert.ok(typeof svg === 'string' && svg.length > 10, `draw() did not produce SVG for ${c.id}`);
    }
  });

  it('all categories are properly defined and referenced by checkpoints', () => {
    const categoryIds = new Set(CATEGORIES.map(cat => cat.id));
    assert.equal(CATEGORIES.length, 9, 'Must have 9 scale categories');
    for (const c of CHECKPOINTS) {
      assert.ok(categoryIds.has(c.category), `Unknown category ${c.category} in checkpoint ${c.id}`);
    }
  });

  it('all comparison presets reference valid checkpoint ids', () => {
    const checkpointIds = new Set(CHECKPOINTS.map(c => c.id));
    for (const preset of COMPARE_PRESETS) {
      assert.ok(checkpointIds.has(preset.a), `Preset '${preset.name}' references invalid checkpoint a: ${preset.a}`);
      assert.ok(checkpointIds.has(preset.b), `Preset '${preset.name}' references invalid checkpoint b: ${preset.b}`);
      assert.ok(preset.note && preset.note.length > 10, `Preset must have a descriptive note`);
    }
  });
});

describe('Scale Jump Math and Conversion Functions', () => {
  it('formats metric exponents accurately', () => {
    assert.equal(formatMetricExponent(0), '1.00 METRE (10⁰ m)');
    assert.equal(formatMetricExponent(-35), '10⁻³⁵ METRES');
    assert.equal(formatMetricExponent(7), '10⁷ METRES');
    assert.equal(formatMetricExponent(27), '10²⁷ METRES');
  });

  it('formats scientific notation accurately', () => {
    assert.equal(formatScientificNotation(1.27e7), '1.27 × 10⁷ m');
    assert.equal(formatScientificNotation(1.0e-10), '1.00 × 10⁻¹⁰ m');
  });

  it('calculates true-size scale ratios properly', () => {
    const human = CHECKPOINTS.find(c => c.id === 'human');
    const earth = CHECKPOINTS.find(c => c.id === 'earth');
    const res = calculateScaleRatio(human, earth);
    assert.equal(res.bigger.id, 'earth');
    assert.equal(res.smaller.id, 'human');
    assert.equal(res.logDiff, 7);
    assert.equal(res.ratio, 1e7);
  });
});
