import { isDeepStrictEqual } from 'node:util';
import { castValue } from './tables.js';

const ALIASES = {
  '': 'equals', eq: 'equals', is: 'equals', '=': 'equals', '==': 'equals', '===': 'equals',
  ne: 'not equals', 'is not': 'not equals', '!=': 'not equals', '!==': 'not equals',
  exist: 'exists', 'not exist': 'not exists', 'does not exist': 'not exists', absent: 'not exists',
  'not contain': 'not contains', 'does not contain': 'not contains', contain: 'contains',
  match: 'matches', 'one of': 'oneof', in: 'oneof',
  gt: '>', gte: '>=', lt: '<', lte: '<=',
  'length is': 'length', 'not empty': 'notempty', 'is empty': 'empty', 'is type': 'type',
};

const NO_VALUE = new Set(['exists', 'not exists', 'empty', 'notempty']);

export function normalizeCondition(condition) {
  const c = String(condition ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[c] ?? c;
}

export function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Without an explicit type, a string expected value is converted to the actual value's
 * type when it can be ("150" vs 150, "true" vs true, "null" vs null).
 * Give the type explicitly (e.g. `string`) to compare strictly.
 */
export function coerceExpected(expected, actual, type) {
  if (type && type !== 'auto') return castValue(expected, type);
  if (typeof expected !== 'string') return expected;

  if (typeof actual === 'number' && expected.trim() !== '' && !Number.isNaN(Number(expected))) return Number(expected);
  if (typeof actual === 'boolean' && /^(true|false)$/i.test(expected)) return expected.toLowerCase() === 'true';
  if (actual === null && expected === 'null') return null;
  return expected;
}

/** Every key/item in `expected` is present in `actual` (arrays: order does not matter). */
export function isSubset(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.every(e => actual.some(a => isSubset(a, e)));
  }
  if (expected && typeof expected === 'object') {
    return actual !== null && typeof actual === 'object' &&
      Object.entries(expected).every(([k, v]) => isSubset(actual[k], v));
  }
  return isDeepStrictEqual(actual, expected);
}

function contains(actual, expected) {
  if (typeof actual === 'string') return actual.includes(String(expected));
  if (Array.isArray(actual)) return actual.some(item => isSubset(item, expected));
  if (actual && typeof actual === 'object') {
    return typeof expected === 'object' ? isSubset(actual, expected) : Object.hasOwn(actual, String(expected));
  }
  return false;
}

function isEmpty(actual) {
  if (actual === undefined || actual === null || actual === '') return true;
  if (Array.isArray(actual) || typeof actual === 'string') return actual.length === 0;
  if (typeof actual === 'object') return Object.keys(actual).length === 0;
  return false;
}

function numeric(actual, expected, label) {
  const a = Number(actual);
  const e = Number(expected);
  if (typeof actual === 'boolean' || actual === null || actual === '' || Number.isNaN(a)) {
    throw new Error(`${label}: actual value ${show(actual)} is not a number`);
  }
  if (Number.isNaN(e)) throw new Error(`${label}: expected value ${show(expected)} is not a number`);
  return [a, e];
}

/**
 * Checks one value. Throws an Error with a readable message when the check fails.
 * @param {{ label: string, actual: *, expected?: *, type?: string, condition?: string }} check
 */
export function checkValue({ label, actual, expected, type, condition }) {
  const op = normalizeCondition(condition);
  const exp = NO_VALUE.has(op) || op === 'type' || op === 'matches' || op === 'oneof'
    ? expected
    : coerceExpected(expected, actual, type);

  let pass;

  switch (op) {
    case 'equals': pass = isDeepStrictEqual(actual, exp); break;
    case 'not equals': pass = !isDeepStrictEqual(actual, exp); break;
    case 'exists': pass = actual !== undefined; break;
    case 'not exists': pass = actual === undefined; break;
    case 'contains': pass = contains(actual, exp); break;
    case 'not contains': pass = !contains(actual, exp); break;
    case 'matches': pass = new RegExp(exp).test(typeof actual === 'string' ? actual : JSON.stringify(actual)); break;
    case 'oneof': pass = String(exp).split(',').map(s => s.trim()).includes(typeof actual === 'string' ? actual : JSON.stringify(actual)); break;
    case 'type': pass = typeOf(actual) === String(exp).trim().toLowerCase(); break;
    case 'empty': pass = isEmpty(actual); break;
    case 'notempty': pass = !isEmpty(actual); break;
    case 'length': pass = actual?.length === Number(exp); break;
    case '>': { const [a, e] = numeric(actual, exp, label); pass = a > e; break; }
    case '>=': { const [a, e] = numeric(actual, exp, label); pass = a >= e; break; }
    case '<': { const [a, e] = numeric(actual, exp, label); pass = a < e; break; }
    case '<=': { const [a, e] = numeric(actual, exp, label); pass = a <= e; break; }
    default:
      throw new Error(`Unknown condition "${condition}". Use one of: equals, not equals, exists, not exists, contains, not contains, matches, one of, type, empty, not empty, length, >, >=, <, <=`);
  }

  if (!pass) {
    const lines = [`${label} failed "${op}" check`];
    if (!NO_VALUE.has(op)) lines.push(`  expected: ${show(exp)}`);
    lines.push(`  actual:   ${show(actual)}`);
    throw new Error(lines.join('\n'));
  }
}

export function show(value) {
  if (value === undefined) return 'undefined';
  const s = JSON.stringify(value);
  return s.length > 500 ? `${s.slice(0, 500)}…` : s;
}
