import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkValue, isSubset } from '../src/assertions.js';
import { builtinFunctions } from '../src/functions.js';
import { getPath, setPath } from '../src/path.js';
import { castValue, parseHeader, rowToObject } from '../src/tables.js';
import { interpolate, parseArgs } from '../src/template.js';

const ctx = (vars = {}, env = {}) => ({
  vars: new Map(Object.entries(vars)),
  env,
  functions: { ...builtinFunctions, twice: n => n * 2 },
});

describe('interpolate', () => {
  it('keeps the type of a whole-string placeholder', () => {
    assert.equal(interpolate('${price}', ctx({ price: 150 })), 150);
    assert.deepEqual(interpolate('${user}', ctx({ user: { id: 1 } })), { id: 1 });
  });

  it('replaces every placeholder inside a longer string', () => {
    assert.equal(interpolate('/shops/${shop}/items/${item}', ctx({ shop: 's1', item: 7 })), '/shops/s1/items/7');
  });

  it('reads env vars, dotted paths and functions', () => {
    const c = ctx({ user: { profile: { id: 'u1' } } }, { API: 'x' });
    assert.equal(interpolate('${env:API}', c), 'x');
    assert.equal(interpolate('${user.profile.id}', c), 'u1');
    assert.equal(interpolate('${$twice(21)}', c), 42);
    assert.match(interpolate("${__getRandom('string')}", c), /^test-[0-9a-f]{16}$/);
  });

  it('resolves nested objects and drops unset values', () => {
    const tpl = { name: '${name}', desc: '${desc}', tags: ['${t1}', '${t2}', 'fixed'], meta: { by: '${by}' } };
    assert.deepEqual(interpolate(tpl, ctx({ name: 'A', t1: 'x', t2: '', by: 'me' })), {
      name: 'A', tags: ['x', 'fixed'], meta: { by: 'me' },
    });
  });

  it('throws on unknown variables in a longer string, and in strict mode', () => {
    assert.throws(() => interpolate('/items/${missing}', ctx()), /Unknown variable "missing"/);
    assert.throws(() => interpolate('${missing}', ctx(), { strict: true }), /Unknown variable/);
    assert.throws(() => interpolate('${env:NOPE}', ctx(), { strict: true }), /Environment variable "NOPE" is not set/);
    assert.equal(interpolate('${missing}', ctx()), undefined);
  });

  it('parses function arguments', () => {
    assert.deepEqual(parseArgs(`8, 'a,b', "c", true, null, -1.5`), [8, 'a,b', 'c', true, null, -1.5]);
    assert.deepEqual(parseArgs(''), []);
  });
});

describe('paths', () => {
  it('gets values by dot, bracket and $ paths', () => {
    const obj = { data: { items: [{ id: 1 }, { id: 2 }] } };
    assert.equal(getPath(obj, 'data.items.1.id'), 2);
    assert.equal(getPath(obj, 'data.items[0].id'), 1);
    assert.equal(getPath(obj, '$.data.items.length'), 2);
    assert.equal(getPath(obj, ''), obj);
    assert.equal(getPath(obj, 'nope.deeper'), undefined);
  });

  it('builds nested objects and arrays', () => {
    const out = {};
    setPath(out, 'address.city', 'Manila');
    setPath(out, 'tags[]', 'a');
    setPath(out, 'tags[]', 'b');
    setPath(out, 'lines[0].sku', 'X');
    assert.deepEqual(out, { address: { city: 'Manila' }, tags: ['a', 'b'], lines: [{ sku: 'X' }] });
  });
});

describe('tables', () => {
  it('parses typed headers', () => {
    assert.deepEqual(parseHeader('price:number'), { key: 'price', type: 'number' });
    assert.deepEqual(parseHeader('urn:thing'), { key: 'urn:thing', type: undefined });
  });

  it('casts values', () => {
    assert.equal(castValue('12', 'number'), 12);
    assert.equal(castValue('false', 'boolean'), false);
    assert.deepEqual(castValue('[1,2]', 'json'), [1, 2]);
    assert.throws(() => castValue('abc', 'number'));
  });

  it('turns a row into a body, skipping empty cells and removing array holes', () => {
    const row = { name: '${n}', 'price:number': '10', 'items[0]': '', 'items[1]': 'b', 'meta.active:boolean': 'true', note: '' };
    assert.deepEqual(rowToObject(row, ctx({ n: 'Chair' })), { name: 'Chair', price: 10, items: ['b'], meta: { active: true } });
  });
});

describe('assertions', () => {
  it('coerces untyped expected values to the actual type', () => {
    checkValue({ label: 'x', actual: 150, expected: '150' });
    checkValue({ label: 'x', actual: true, expected: 'true' });
    assert.throws(() => checkValue({ label: 'x', actual: 150, expected: '150', type: 'string' }), /failed "equals"/);
  });

  it('supports the documented conditions', () => {
    checkValue({ label: 'x', actual: 'abc', condition: 'exists' });
    checkValue({ label: 'x', actual: undefined, condition: 'not exists' });
    checkValue({ label: 'x', actual: ['a', 'b'], expected: 'b', condition: 'contains' });
    checkValue({ label: 'x', actual: 'hello world', expected: '^hello', condition: 'matches' });
    checkValue({ label: 'x', actual: 5, expected: '3', condition: '>=' });
    checkValue({ label: 'x', actual: [], condition: 'empty' });
    checkValue({ label: 'x', actual: [1, 2, 3], expected: '3', condition: 'length' });
    checkValue({ label: 'x', actual: null, expected: 'null', condition: 'type' });
    checkValue({ label: 'x', actual: 'b', expected: 'a, b, c', condition: 'one of' });
    assert.throws(() => checkValue({ label: 'x', actual: 1, expected: '2', condition: '>' }), /failed ">"/);
    assert.throws(() => checkValue({ label: 'x', actual: 1, condition: 'bogus' }), /Unknown condition/);
  });

  it('matches subsets', () => {
    assert.ok(isSubset({ a: 1, b: { c: 2, d: 3 }, list: [1, 2, 3] }, { b: { c: 2 }, list: [3, 1] }));
    assert.ok(!isSubset({ a: 1 }, { a: 2 }));
  });
});
