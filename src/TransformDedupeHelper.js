'use strict';
/**
 * TransformDedupeHelper (Script Include called from a Transform Map onBefore script)
 *
 * Cleans an import row and decides insert / update / skip before the row reaches
 * the target table. Pattern shown: validate and match in one place, return a
 * decision object, and let the onBefore script set `ignore = true` on "skip".
 */
function TransformDedupeHelper(glide, targetTable) {
  this.GlideRecord = glide.GlideRecord;
  this.gs = glide.gs;
  this.targetTable = targetTable;
}

TransformDedupeHelper.prototype.clean = function (row) {
  return {
    serial_number: String(row.serial_number || '').trim().toUpperCase(),
    name: String(row.name || '').trim().toLowerCase(),
    asset_tag: String(row.asset_tag || '').trim(),
  };
};

/** @returns {{action: 'insert'|'update'|'skip', sysId?: string, reason?: string, data?: object}} */
TransformDedupeHelper.prototype.decide = function (row) {
  var data = this.clean(row);
  if (!data.serial_number && !data.name) {
    return { action: 'skip', reason: 'no serial_number or name to match on' };
  }
  var field = data.serial_number ? 'serial_number' : 'name';
  var gr = new this.GlideRecord(this.targetTable);
  gr.addQuery(field, data[field]);
  gr.setLimit(2);
  gr.query();
  var matches = [];
  while (gr.next()) {
    matches.push(gr.getUniqueValue());
  }
  if (matches.length > 1) {
    // Updating one of several matches hides a data problem. Log it and leave both alone.
    this.gs.error('TransformDedupeHelper: multiple ' + this.targetTable + ' records for ' + field + '=' + data[field]);
    return { action: 'skip', reason: 'ambiguous match on ' + field };
  }
  if (matches.length === 1) {
    return { action: 'update', sysId: matches[0], data: data };
  }
  return { action: 'insert', data: data };
};

module.exports = TransformDedupeHelper;
