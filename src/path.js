const APPEND = Symbol('append');

/**
 * "data.items[0].name" -> ['data', 'items', 0, 'name']
 * "tags[]"             -> ['tags', APPEND]   (setPath only: push onto the array)
 * "" or "$"            -> []                 (the root)
 * Dot segments stay strings, so "items.0" reads index 0 of an array too.
 */
export function parsePath(path) {
  const clean = String(path ?? '').trim().replace(/^\$\.?/, '');
  const tokens = [];

  for (const m of clean.matchAll(/([^.[\]]+)|\[(\d*)\]/g)) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else tokens.push(m[2] === '' ? APPEND : Number(m[2]));
  }

  return tokens;
}

export function getPath(obj, path) {
  let cur = obj;

  for (const token of parsePath(path)) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[token];
  }

  return cur;
}

export function setPath(obj, path, value) {
  const tokens = parsePath(path);
  if (tokens.length === 0) throw new Error('setPath needs a non-empty path');

  let cur = obj;

  tokens.forEach((token, i) => {
    const last = i === tokens.length - 1;
    const key = token === APPEND ? cur.length : token;

    if (last) {
      cur[key] = value;
      return;
    }

    if (cur[key] === null || typeof cur[key] !== 'object') {
      const next = tokens[i + 1];
      cur[key] = typeof next === 'number' || next === APPEND ? [] : {};
    }

    cur = cur[key];
  });

  return obj;
}

/** Removes holes left by sparse indexes such as items[0] (empty) + items[1]. */
export function compact(value) {
  if (Array.isArray(value)) return value.filter((_, i) => i in value).map(compact);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = compact(value[key]);
  }
  return value;
}
