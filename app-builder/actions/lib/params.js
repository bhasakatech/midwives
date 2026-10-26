/*
 * Query parameter validation against an API's params schema (see proxy/apis.js).
 * Only parameters in the schema are returned; invalid values fall back to the
 * default, or are dropped when there is none.
 */

function parseInteger(value, rule) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || String(n) !== String(value).trim()) return undefined;
  if (rule.min !== undefined && n < rule.min) return undefined;
  return rule.max !== undefined ? Math.min(n, rule.max) : n;
}

function parseEnum(value, rule) {
  return rule.values.includes(value) ? value : undefined;
}

function parseString(value, rule) {
  const s = String(value);
  if (rule.maxLength !== undefined && s.length > rule.maxLength) return undefined;
  if (rule.pattern && !rule.pattern.test(s)) return undefined;
  return s;
}

const PARSERS = { int: parseInteger, enum: parseEnum, string: parseString };

/**
 * @param {Object} params action params (query parameters included)
 * @param {Object} schema the API's params schema
 * @returns {Object} validated name/value pairs to forward upstream
 */
function readParams(params, schema = {}) {
  return Object.entries(schema).reduce((out, [name, rule]) => {
    const parse = PARSERS[rule.type];
    if (!parse) throw new Error(`unknown param type "${rule.type}" for "${name}"`);
    const raw = params[name];
    const value = raw === undefined || raw === '' ? undefined : parse(raw, rule);
    const result = value !== undefined ? value : rule.default;
    if (result !== undefined) out[name] = result;
    return out;
  }, {});
}

module.exports = { readParams };
