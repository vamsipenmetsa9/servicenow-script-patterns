'use strict';
/**
 * Minimal in-memory stand-ins for GlideRecord, GlideAggregate and gs.
 * They cover only the calls the scripts in src/ make. They are test doubles,
 * not a ServiceNow emulator: encoded queries, ACLs and business rules do not run.
 */
function createGlide(tables) {
  const logs = [];
  const queryCount = { value: 0 };

  class GlideRecord {
    constructor(table) {
      this._table = table;
      this._conditions = [];
      this._rows = [];
      this._index = -1;
      this._limit = Infinity;
      this._current = null;
      this._new = null;
    }
    addQuery(field, opOrValue, value) {
      const hasOp = arguments.length === 3;
      this._conditions.push({ field, op: hasOp ? opOrValue : '=', value: hasOp ? value : opOrValue });
    }
    addActiveQuery() { this.addQuery('active', true); }
    setLimit(n) { this._limit = n; }
    _matches(row) {
      return this._conditions.every((c) => {
        const actual = row[c.field];
        if (c.op === '=') return String(actual) === String(c.value);
        if (c.op === '!=') return String(actual) !== String(c.value);
        if (c.op === 'IN') return String(c.value).split(',').includes(String(actual));
        throw new Error('glide-mock: unsupported operator ' + c.op);
      });
    }
    query() {
      queryCount.value += 1;
      this._rows = (tables[this._table] || []).filter((r) => this._matches(r)).slice(0, this._limit);
      this._index = -1;
    }
    next() {
      this._index += 1;
      this._current = this._rows[this._index] || null;
      return this._current !== null;
    }
    get(sysId) {
      queryCount.value += 1;
      this._current = (tables[this._table] || []).find((r) => r.sys_id === sysId) || null;
      return this._current !== null;
    }
    getValue(field) {
      const row = this._current || this._new;
      const value = row ? row[field] : null;
      return value === undefined || value === null || value === '' ? null : String(value);
    }
    setValue(field, value) { (this._current || this._new)[field] = value; }
    getUniqueValue() { return this.getValue('sys_id'); }
    initialize() { this._current = null; this._new = {}; }
    insert() {
      const row = Object.assign({ sys_id: 'new' + ((tables[this._table] || []).length + 1) }, this._new);
      (tables[this._table] = tables[this._table] || []).push(row);
      return row.sys_id;
    }
    update() { return this.getUniqueValue(); }
  }

  class GlideAggregate extends GlideRecord {
    addAggregate() {}
    groupBy(field) { this._groupBy = field; }
    query() {
      queryCount.value += 1;
      const counts = {};
      (tables[this._table] || []).filter((r) => this._matches(r)).forEach((r) => {
        counts[r[this._groupBy]] = (counts[r[this._groupBy]] || 0) + 1;
      });
      this._rows = Object.keys(counts).map((k) => ({ [this._groupBy]: k, _count: counts[k] }));
      this._index = -1;
    }
    getAggregate() { return String(this._current._count); }
  }

  const gs = {
    info: (m) => logs.push('INFO ' + m),
    warn: (m) => logs.push('WARN ' + m),
    error: (m) => logs.push('ERROR ' + m),
    nil: (v) => v === null || v === undefined || v === '',
  };
  return { GlideRecord, GlideAggregate, gs, logs, queryCount };
}

module.exports = { createGlide };
