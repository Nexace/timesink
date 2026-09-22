import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TREE_CONFIGS,
  STAGE_TIMEOUT_MS,
  classifyReaction,
  calculateTimeslip,
  calculateVersusOutcome,
  updateRollingAverage
} from './engine.js';

describe('Redlight Drag Racing Engine', () => {
  it('correctly configures Pro and Sportsman Christmas tree timing intervals', () => {
    assert.equal(TREE_CONFIGS.pro.greenDelayMs, 400);
    assert.equal(TREE_CONFIGS.pro.amberCount, 1);
    assert.equal(TREE_CONFIGS.sportsman.greenDelayMs, 1500);
    assert.equal(TREE_CONFIGS.sportsman.amberDelayMs, 500);
    assert.equal(STAGE_TIMEOUT_MS, 7000);
  });

  it('classifies reaction times into official drag racing brackets', () => {
    assert.equal(classifyReaction(0.045), 'TOP FUEL (GODLIKE)');
    assert.equal(classifyReaction(0.095), 'PRO STOCK (EXCELLENT)');
    assert.equal(classifyReaction(0.180), 'SPORTSMAN (GOOD)');
    assert.equal(classifyReaction(0.320), 'STREET (AVERAGE)');
    assert.equal(classifyReaction(0.550), 'FLAGMAN (TOO SLOW)');
    assert.equal(classifyReaction(-0.010), 'FOUL');
  });

  it('computes realistic 1/4-mile timeslips with split intervals and trap speed', () => {
    const slip = calculateTimeslip(0.100);
    assert.equal(slip.disqualified, false);
    assert.equal(slip.rt, '.100');
    assert.equal(slip.et60, '0.835');
    assert.equal(slip.et330, '2.150');
    assert.equal(slip.et660, '3.050');
    assert.equal(slip.et1320, '3.950');
    assert.equal(slip.trapMph, '330.50 MPH');
    assert.equal(slip.rank, 'RANK: PRO STOCK (EXCELLENT)');

    // Foul test
    const foulSlip = calculateTimeslip(-0.025);
    assert.equal(foulSlip.disqualified, true);
    assert.equal(foulSlip.rt, '-.000');
    assert.equal(foulSlip.et1320, '---');
  });

  it('determines versus winner with exact reaction margin of victory in milliseconds', () => {
    const res = calculateVersusOutcome(0.125, 0.160);
    assert.equal(res.winner, 'p1');
    assert.equal(res.marginMs, 35);

    const foulRes = calculateVersusOutcome(-0.010, 0.150);
    assert.equal(foulRes.winner, 'p2');
    assert.equal(foulRes.foul, 'p1');
  });

  it('maintains a bounded 10-run rolling average', () => {
    let state = { history: [], average: 0 };
    for (let i = 1; i <= 10; i++) {
      state = updateRollingAverage(state.history, 0.100);
    }
    assert.equal(state.history.length, 10);
    assert.equal(state.average, 0.100);

    // Push 11th run
    state = updateRollingAverage(state.history, 0.200);
    assert.equal(state.history.length, 10);
    assert.equal(state.average, 0.110);
  });
});
