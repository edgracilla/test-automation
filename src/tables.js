import { compact, setPath } from './path.js';
import { interpolate } from './template.js';

const TYPES = new Set(['string', 'number', 'int', 'boolean', 'bool', 'json', 'auto']);

/** "price:number" -> { key: 'price', type: 'number' }; "a:b" (unknown type) stays a plain key. */
export function parseHeader(header) {
  const i = header.lastIndexOf(':');
  if (i > 0) {
    const type = header.slice(i + 1).trim().toLowerCase();
    if (TYPES.has(type)) return { key: header.slice(0, i).trim(), type };
  }
  return { key: header.trim(), type: undefined };
}

export function castValue(value, type) {
  if (!type || type === 'auto' || value === undefined || value === null) return value;

  switch (type) {
    case 'string':
      return typeof value === 'string' ? value : JSON.stringify(value);

    case 'number': {
      const n = Number(value);
      if (value === '' || Number.isNaN(n)) throw new Error(`Cannot convert "${value}" to a number`);
      return n;
    }

    case 'int': {
      const n = Number(value);
      if (value === '' || !Number.isInteger(n)) throw new Error(`Cannot convert "${value}" to an integer`);
      return n;
    }

    case 'boolean':
    case 'bool': {
      if (typeof value === 'boolean') return value;
      const s = String(value).trim().toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
      throw new Error(`Cannot convert "${value}" to a boolean`);
    }

    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;

    default:
      throw new Error(`Unknown type "${type}"`);
  }
}

/**
 * One table row -> object. Headers are paths (`address.city`, `tags[]`, `items[0].sku`)
 * with an optional type suffix (`price:number`). Empty cells are left out.
 */
export function rowToObject(row, ctx) {
  const out = {};

  for (const [header, cell] of Object.entries(row)) {
    if (cell === '') continue;
    const { key, type } = parseHeader(header);
    const value = castValue(interpolate(cell, ctx), type);
    if (value !== undefined) setPath(out, key, value);
  }

  return compact(out);
}

/** A table with one data row becomes an object; several rows become an array of objects. */
export function tableToBody(dataTable, ctx) {
  const rows = dataTable.hashes().map(row => rowToObject(row, ctx));
  return rows.length === 1 ? rows[0] : rows;
}
