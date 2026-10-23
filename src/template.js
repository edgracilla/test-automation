import { getPath } from './path.js';

const PLACEHOLDER = /\$\{([^{}]+)\}/g;
const WHOLE = /^\$\{([^{}]+)\}$/;
const FUNCTION_CALL = /^(?:\$|__)([A-Za-z_]\w*)(?:\((.*)\))?$/s;

/**
 * Resolves placeholders anywhere in a value (string, array, object; nested).
 *
 *   ${name}              scenario variable (dotted paths reach into stored objects: ${user.id})
 *   ${env:NAME}          environment variable
 *   ${$fn} / ${$fn(1,'a')} generator function (built-ins + config.functions)
 *
 * A string that is exactly one placeholder keeps the value's type (number, object, ...).
 * Placeholders embedded in longer strings are stringified.
 *
 * Unknown values:
 *   - embedded in a longer string: always an error
 *   - whole-string, strict mode: error
 *   - whole-string, default: undefined, so the key is left out of objects and the item out of arrays
 *     (array items that resolve to '' are left out too, which keeps optional list entries tidy)
 *
 * @param {*} value
 * @param {{ vars: Map<string, *>, env: Record<string, string|undefined>, functions: Record<string, Function> }} ctx
 * @param {{ strict?: boolean }} [opts]
 */
export function interpolate(value, ctx, opts = {}) {
  if (typeof value === 'string') return interpolateString(value, ctx, opts);

  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      const resolved = interpolate(item, ctx, opts);
      const wasPlaceholder = typeof item === 'string' && item.includes('${');
      if (resolved === undefined) continue;
      if (wasPlaceholder && resolved === '') continue;
      out.push(resolved);
    }
    return out;
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const resolved = interpolate(item, ctx, opts);
      if (resolved !== undefined) out[key] = resolved;
    }
    return out;
  }

  return value;
}

export function interpolateString(str, ctx, { strict = false } = {}) {
  const whole = str.match(WHOLE);

  if (whole) {
    const value = resolveExpression(whole[1], ctx);
    if (value === undefined && strict) throw unknown(whole[1], str);
    return value;
  }

  return str.replace(PLACEHOLDER, (_, expr) => {
    const value = resolveExpression(expr, ctx);
    if (value === undefined) throw unknown(expr, str);
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

export function resolveExpression(rawExpr, ctx) {
  const expr = rawExpr.trim();

  if (expr.startsWith('env:')) return ctx.env[expr.slice(4).trim()];

  const call = expr.match(FUNCTION_CALL);
  if (call) {
    const [, name, args] = call;
    const fn = ctx.functions[name];
    if (typeof fn !== 'function') {
      throw new Error(`Unknown function "${name}" in \${${rawExpr}}. Available: ${Object.keys(ctx.functions).join(', ')}`);
    }
    return fn(...parseArgs(args ?? ''));
  }

  return lookupVariable(expr, ctx.vars);
}

function lookupVariable(name, vars) {
  if (vars.has(name)) return vars.get(name);

  const split = name.search(/[.[]/);
  if (split > 0) {
    const base = name.slice(0, split);
    if (vars.has(base)) return getPath(vars.get(base), name.slice(split).replace(/^\./, ''));
  }

  return undefined;
}

/** "8, 'abc', true" -> [8, 'abc', true] */
export function parseArgs(str) {
  const args = [];
  let current = '';
  let quote = null;

  for (const ch of str) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      args.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '' || args.length > 0) args.push(current);

  return args.map(parseArg);
}

function parseArg(raw) {
  const arg = raw.trim();
  const quoted = arg.match(/^(['"])(.*)\1$/s);
  if (quoted) return quoted[2];
  if (arg === 'true') return true;
  if (arg === 'false') return false;
  if (arg === 'null') return null;
  if (arg === '') return undefined;
  if (!Number.isNaN(Number(arg))) return Number(arg);
  return arg;
}

function unknown(expr, source) {
  const what = expr.trim().startsWith('env:')
    ? `Environment variable "${expr.trim().slice(4).trim()}" is not set`
    : `Unknown variable "${expr.trim()}"`;
  return new Error(`${what} (in "${source}")`);
}
