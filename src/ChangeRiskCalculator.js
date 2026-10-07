'use strict';
/**
 * ChangeRiskCalculator (Script Include called from a before Business Rule on change_request)
 *
 * Pure function: no Glide calls, so it is cheap to test. The Business Rule reads
 * the fields, calls calculate(), and writes the result. The thresholds are sample
 * values; a real instance would hold them in system properties or a Decision Table.
 */
var BUSINESS_HOURS = { start: 8, end: 18 };

function calculate(change) {
  var reasons = [];
  var score = 0;
  var ciCount = Number(change.affectedCiCount) || 0;

  if (change.environment === 'production') { score += 3; reasons.push('production'); }
  if (ciCount > 10) { score += 3; reasons.push('more than 10 CIs'); }
  else if (ciCount > 1) { score += 1; reasons.push('multiple CIs'); }
  if (!change.hasBackoutPlan) { score += 3; reasons.push('no backout plan'); }
  if (!change.testedInSubProd) { score += 2; reasons.push('not tested in sub-production'); }
  if (change.businessCritical) { score += 2; reasons.push('business-critical service'); }
  var hour = Number(change.startHour);
  if (hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end) { score += 1; reasons.push('inside business hours'); }

  var risk = score >= 8 ? 'high' : score >= 4 ? 'moderate' : 'low';
  return { score: score, risk: risk, reasons: reasons, requiresCab: risk === 'high' };
}

module.exports = { calculate: calculate };
