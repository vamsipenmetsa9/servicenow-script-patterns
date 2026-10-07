'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGlide } = require('./glide-mock');
const AssignmentBalancer = require('../src/AssignmentBalancer');

function setup() {
  return createGlide({
    sys_user_grmember: [
      { group: 'g1', user: 'u_cara' }, { group: 'g1', user: 'u_ana' }, { group: 'g1', user: 'u_ben' },
      { group: 'g2', user: 'u_dev' },
    ],
    incident: [
      { assigned_to: 'u_ana', active: true }, { assigned_to: 'u_ana', active: true },
      { assigned_to: 'u_ben', active: true }, { assigned_to: 'u_ben', active: false },
      { assigned_to: 'u_cara', active: true },
      { assigned_to: 'u_dev', active: true },
    ],
  });
}

test('picks the member with the fewest active tasks, ties broken by sys_id', () => {
  const glide = setup();
  assert.equal(new AssignmentBalancer(glide).pickAssignee('incident', 'g1'), 'u_ben');
});

test('members with no open work count as zero', () => {
  const balancer = new AssignmentBalancer(createGlide({
    sys_user_grmember: [{ group: 'g1', user: 'u_ana' }, { group: 'g1', user: 'u_new' }],
    incident: [{ assigned_to: 'u_ana', active: true }],
  }));
  assert.equal(balancer.pickAssignee('incident', 'g1'), 'u_new');
});

test('uses two queries regardless of group size', () => {
  const glide = setup();
  new AssignmentBalancer(glide).pickAssignee('incident', 'g1');
  assert.equal(glide.queryCount.value, 2);
});

test('empty group returns null and logs a warning', () => {
  const glide = setup();
  assert.equal(new AssignmentBalancer(glide).pickAssignee('incident', 'missing'), null);
  assert.match(glide.logs[0], /WARN .*no members/);
});

test('missing group id returns null without querying', () => {
  const glide = setup();
  assert.equal(new AssignmentBalancer(glide).pickAssignee('incident', ''), null);
  assert.equal(glide.queryCount.value, 0);
});
