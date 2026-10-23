import { Given } from '@cucumber/cucumber';
import { castValue, parseHeader } from '../tables.js';

// Variables ------------------------------------------------------------------

/**
 * | name                     | price:number | shop              |
 * | ${$randomString(8)}      | 150          | ${session_shopId} |
 * Each column becomes a variable. An empty cell removes the variable.
 */
Given('I have the following details(:)', function (dataTable) {
  const rows = dataTable.hashes();
  if (rows.length !== 1) throw new Error(`"I have the following details" expects exactly one data row, got ${rows.length}`);

  for (const [header, cell] of Object.entries(rows[0])) {
    const { key, type } = parseHeader(header);
    if (cell === '') {
      this.vars.delete(key);
      continue;
    }
    this.vars.set(key, castValue(this.resolve(cell), type));
  }
});

Given('I set {string} to {string}', function (name, value) {
  this.vars.set(name, this.resolve(value));
});

// Services and headers ---------------------------------------------------------

Given('I use the {string} service', function (name) {
  this.getService(name);
  this.service = name;
});

Given('I set the header {string} to {string}', function (name, value) {
  this.headers[name] = this.resolve(value, { strict: true });
});

Given('I have the following headers(:)', function (dataTable) {
  for (const [name, value] of dataTable.raw()) {
    this.headers[name] = this.resolve(value, { strict: true });
  }
});

Given('I remove the header {string}', function (name) {
  for (const key of Object.keys(this.headers)) {
    if (key.toLowerCase() === name.toLowerCase()) delete this.headers[key];
  }
});

// Utilities ---------------------------------------------------------------------

Given('I wait {float} second(s)', async function (seconds) {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
});

Given('I print the response', function () {
  this.log(JSON.stringify(this.describeExchange(), null, 2));
});

Given('I print the variables', function () {
  this.log(JSON.stringify(Object.fromEntries(this.vars), null, 2));
});
