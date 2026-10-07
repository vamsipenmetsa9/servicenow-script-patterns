'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../src/ChangeRiskCalculator');

const safe = { environment: 'test', affectedCiCount: 1, hasBackoutPlan: true, testedInSubProd: true, businessCritical: false, startHour: 22 };

test('well-prepared non-production change is low risk', () => {
  assert.deepEqual(calculate(safe), { score: 0, risk: 'low', reasons: [], requiresCab: false });
});

test('production change, tested, off hours is low risk', () => {
  assert.equal(calculate({ ...safe, environment: 'production' }).risk, 'low');
});

test('production change without a backout plan is moderate', () => {
  const result = calculate({ ...safe, environment: 'production', hasBackoutPlan: false });
  assert.equal(result.score, 6);
  assert.equal(result.risk, 'moderate');
});

test('untested production change on a critical service needs CAB', () => {
  const result = calculate({ ...safe, environment: 'production', testedInSubProd: false, businessCritical: true, startHour: 10 });
  assert.equal(result.score, 8);
  assert.equal(result.requiresCab, true);
  assert.deepEqual(result.reasons, ['production', 'not tested in sub-production', 'business-critical service', 'inside business hours']);
});

test('CI count thresholds', () => {
  assert.equal(calculate({ ...safe, affectedCiCount: 2 }).score, 1);
  assert.equal(calculate({ ...safe, affectedCiCount: 10 }).score, 1);
  assert.equal(calculate({ ...safe, affectedCiCount: 11 }).score, 3);
});

test('business hours boundary is 08:00 inclusive to 18:00 exclusive', () => {
  assert.equal(calculate({ ...safe, startHour: 8 }).score, 1);
  assert.equal(calculate({ ...safe, startHour: 18 }).score, 0);
});

test('missing fields are treated as the risky answer', () => {
  const result = calculate({ environment: 'production' });
  assert.ok(result.reasons.includes('no backout plan'));
  assert.ok(result.reasons.includes('not tested in sub-production'));
});
