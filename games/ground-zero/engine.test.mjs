import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcPhysics,
  sliderToYield,
  yieldToSlider,
  getDistanceFromLatLonInKm,
  findClosestCity,
  MAJOR_CITIES
} from './engine.js';

describe('Ground Zero Nuclear Blast Physics Engine', () => {
  it('accurately calculates Glasstone & Dolan scaling laws for 15kt (Hiroshima)', () => {
    const res = calcPhysics(15);
    assert.equal(res.hiroshimaEquiv, 1.0);

    // Fireball radius ~ 0.20 km (200m)
    assert.ok(res.fireballKm > 0.18 && res.fireballKm < 0.25);

    // 20 PSI heavy blast (complete structural destruction) ~ 0.37 km
    assert.ok(res.psi20Km > 0.35 && res.psi20Km < 0.45);

    // 5 PSI moderate blast (residential collapse) ~ 0.69 km
    assert.ok(res.psi5Km > 0.60 && res.psi5Km < 0.80);

    // 3rd degree burn radius ~ 1.15 km
    assert.ok(res.burns3rdKm > 1.0 && res.burns3rdKm < 1.4);
  });

  it('accurately scales blast effects for Megaton-class weapons (1Mt = 1000kt)', () => {
    const res = calcPhysics(1000);
    assert.ok(res.hiroshimaEquiv > 66);
    // Cube-root blast scaling: 1000kt has ~10x greater distance than 1kt
    assert.ok(res.psi5Km > 2.5 && res.psi5Km < 3.2);
    // Thermal radiation scales with Y^0.41: significantly broader than blast
    assert.ok(res.burns3rdKm > 6.0 && res.burns3rdKm < 7.0);
  });

  it('correctly maps between slider position and logarithmic yield', () => {
    // 0 on slider = minimum (0.01 kt = 10 tons)
    const minYield = sliderToYield(0);
    assert.ok(Math.abs(minYield - 0.01) < 0.001);

    // 1000 on slider = maximum (100,000 kt = 100 Mt)
    const maxYield = sliderToYield(1000);
    assert.ok(Math.abs(maxYield - 100000) < 1.0);

    // Round-trip conversion
    const testYield = 15; // 15kt
    const sliderPos = yieldToSlider(testYield);
    const restored = sliderToYield(sliderPos);
    assert.ok(Math.abs(restored - testYield) / testYield < 0.05);
  });

  it('calculates great-circle Haversine distances and nearest city lookup', () => {
    // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ~ 343 km
    const dist = getDistanceFromLatLonInKm(51.5074, -0.1278, 48.8566, 2.3522);
    assert.ok(dist > 330 && dist < 360, `Distance should be ~343km, got ${dist}`);

    // Nearest city to 40.71, -74.00 should be New York City
    const nearest = findClosestCity(40.71, -74.00);
    assert.equal(nearest.city.name, 'New York City, USA');
    assert.ok(nearest.distKm < 5);
  });
});
