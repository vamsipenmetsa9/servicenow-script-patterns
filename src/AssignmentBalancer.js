'use strict';
/**
 * AssignmentBalancer (Script Include pattern)
 *
 * Picks the group member with the fewest open tasks.
 * Pattern shown: one GlideAggregate query for the whole group instead of a
 * GlideRecord count per member (the usual N+1 mistake in assignment rules).
 *
 * On an instance this body sits inside Class.create(); here Glide APIs are
 * injected so the logic can be unit tested with plain Node.
 */
function AssignmentBalancer(glide) {
  this.GlideRecord = glide.GlideRecord;
  this.GlideAggregate = glide.GlideAggregate;
  this.gs = glide.gs;
}

AssignmentBalancer.prototype.getMembers = function (groupId) {
  var members = [];
  var gr = new this.GlideRecord('sys_user_grmember');
  gr.addQuery('group', groupId);
  gr.query();
  while (gr.next()) {
    members.push(gr.getValue('user'));
  }
  return members;
};

AssignmentBalancer.prototype.getOpenCounts = function (table, userIds) {
  var counts = {};
  userIds.forEach(function (id) { counts[id] = 0; });
  if (userIds.length === 0) {
    return counts;
  }
  var ga = new this.GlideAggregate(table);
  ga.addActiveQuery();
  ga.addQuery('assigned_to', 'IN', userIds.join(','));
  ga.addAggregate('COUNT');
  ga.groupBy('assigned_to');
  ga.query();
  while (ga.next()) {
    counts[ga.getValue('assigned_to')] = parseInt(ga.getAggregate('COUNT'), 10);
  }
  return counts;
};

/** @returns {string|null} sys_id of the least-loaded member, or null if the group is empty */
AssignmentBalancer.prototype.pickAssignee = function (table, groupId) {
  if (this.gs.nil(groupId)) {
    this.gs.warn('AssignmentBalancer: no group supplied');
    return null;
  }
  var members = this.getMembers(groupId);
  if (members.length === 0) {
    this.gs.warn('AssignmentBalancer: group ' + groupId + ' has no members');
    return null;
  }
  var counts = this.getOpenCounts(table, members);
  // Sort by load, then sys_id, so the result is deterministic when loads tie.
  members.sort(function (a, b) { return counts[a] - counts[b] || (a < b ? -1 : 1); });
  return members[0];
};

module.exports = AssignmentBalancer;
