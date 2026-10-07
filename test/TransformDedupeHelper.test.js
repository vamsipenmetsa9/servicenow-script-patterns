'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGlide } = require('./glide-mock');
const TransformDedupeHelper = require('../src/TransformDedupeHelper');

function helper() {
  const glide = createGlide({
    alm_hardware: [
      { sys_id: 'a1', serial_number: 'SYN-100', name: 'lt-001' },
      { sys_id: 'a2', serial_number: 'SYN-200', name: 'lt-002' },
      { sys_id: 'a3', serial_number: 'SYN-200', name: 'lt-002-old' },
      { sys_id: 'a4', serial_number: '', name: 'kiosk-07' },
    ],
  });
  return { glide, helper: new TransformDedupeHelper(glide, 'alm_hardware') };
}

test('cleans whitespace and case before matching', () => {
  const { helper: h } = helper();
  assert.deepEqual(h.decide({ serial_number: '  syn-100 ', name: 'LT-001' }), {
    action: 'update', sysId: 'a1', data: { serial_number: 'SYN-100', name: 'lt-001', asset_tag: '' },
  });
});

test('unknown serial is an insert', () => {
  const { helper: h } = helper();
  assert.equal(h.decide({ serial_number: 'SYN-999', name: 'lt-999' }).action, 'insert');
});

test('falls back to name when serial is blank', () => {
  const { helper: h } = helper();
  assert.equal(h.decide({ serial_number: '', name: 'Kiosk-07' }).sysId, 'a4');
});

test('ambiguous match is skipped and logged, not updated', () => {
  const { glide, helper: h } = helper();
  const decision = h.decide({ serial_number: 'SYN-200' });
  assert.deepEqual(decision, { action: 'skip', reason: 'ambiguous match on serial_number' });
  assert.match(glide.logs[0], /ERROR .*multiple alm_hardware/);
});

test('row with nothing to match on is skipped without a query', () => {
  const { glide, helper: h } = helper();
  assert.equal(h.decide({ serial_number: ' ', name: null }).action, 'skip');
  assert.equal(glide.queryCount.value, 0);
});
