import { randomBytes, randomInt as cryptoRandomInt, randomUUID } from 'node:crypto';

/**
 * Generators usable inside any value as `${$name}` or `${$name(arg1, 'arg2')}`.
 * Add your own under `functions` in the test config.
 */
export const builtinFunctions = {
  uuid: () => randomUUID(),

  randomString: (length = 8, prefix = 'test-') =>
    prefix + randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length),

  randomInt: (min = 0, max = 1_000_000) => cryptoRandomInt(min, max + 1),

  randomFloat: (min = 0, max = 1, decimals = 2) =>
    Number((Math.random() * (max - min) + min).toFixed(decimals)),

  randomBool: () => Math.random() < 0.5,

  randomEmail: (domain = 'example.com') => `test-${randomBytes(5).toString('hex')}@${domain}`,

  randomPhone: (prefix = '+1', digits = 10) =>
    prefix + Array.from({ length: digits }, () => cryptoRandomInt(0, 10)).join(''),

  pick: (...items) => items[cryptoRandomInt(0, items.length)],

  now: () => new Date().toISOString(),

  timestamp: () => Date.now(),

  /** YYYY-MM-DD, optionally shifted by a number of days. */
  date: (offsetDays = 0) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  },

  /** Empty table cells mean "leave out"; use these to send an explicit '' or null. */
  empty: () => '',
  null: () => null,

  /** Compatibility with suites written as ${__getRandom('string')}. */
  getRandom(type, min = 0, max = 8) {
    switch (String(type).toLowerCase()) {
      case 'string': return `test-${randomBytes(max).toString('hex')}`;
      case 'number': return cryptoRandomInt(min, max + 1);
      case 'numbertostring': return String(cryptoRandomInt(min, max + 1));
      case 'boolean': return Math.random() < 0.5;
      case 'email': return builtinFunctions.randomEmail();
      case 'phone':
      case 'mobile': return builtinFunctions.randomPhone();
      default: throw new Error(`getRandom: unknown type "${type}"`);
    }
  },
};
