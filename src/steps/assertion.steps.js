import { Then } from '@cucumber/cucumber';
import { checkValue, isSubset, show } from '../assertions.js';
import { getPath } from '../path.js';
import { validateSchema } from '../schemas.js';

function bodySnippet(response) {
  const text = response.text ?? '';
  return text.length > 1000 ? `${text.slice(0, 1000)}…` : text;
}

Then('the response status is {int}', function (status) {
  const response = this.requireResponse();
  if (response.status !== status) {
    throw new Error(`Expected status ${status} but got ${response.status} for ${this.lastRequest.method} ${this.lastRequest.url}\nBody: ${bodySnippet(response)}`);
  }
});

Then('the response status is one of {string}', function (list) {
  const response = this.requireResponse();
  const allowed = list.split(',').map(s => Number(s.trim()));
  if (!allowed.includes(response.status)) {
    throw new Error(`Expected status in [${allowed.join(', ')}] but got ${response.status}\nBody: ${bodySnippet(response)}`);
  }
});

/**
 * | path        | value     | type    | condition |
 * | id          |           |         | exists    |
 * | name        | ${name}   |         |           |
 * | price       | 150       | number  |           |
 * | tags.length | 2         |         | >=        |
 * Columns: path (or objPath), value, type (string|number|boolean|json), condition (default: equals).
 */
Then('the response has the following values(:)', function (dataTable) {
  const body = this.requireResponse().body;
  const failures = [];

  for (const row of dataTable.hashes()) {
    const path = row.path ?? row.objPath ?? row.field ?? '';
    const raw = row.value ?? row.expected ?? '';
    try {
      checkValue({
        label: `Response value "${path || '(root)'}"`,
        actual: getPath(body, path),
        expected: this.resolve(raw, { strict: true }),
        type: (row.type ?? '').trim() || undefined,
        condition: row.condition ?? row.op ?? row.check,
      });
    } catch (err) {
      failures.push(err.message);
    }
  }

  if (failures.length) throw new Error(`${failures.length} response check(s) failed:\n\n${failures.join('\n\n')}`);
});

Then('the response value {string} is {string}', function (path, expected) {
  checkValue({ label: `Response value "${path}"`, actual: getPath(this.requireResponse().body, path), expected: this.resolve(expected, { strict: true }) });
});

Then('the response value {string} exists', function (path) {
  checkValue({ label: `Response value "${path}"`, actual: getPath(this.requireResponse().body, path), condition: 'exists' });
});

Then('the response value {string} does not exist', function (path) {
  checkValue({ label: `Response value "${path}"`, actual: getPath(this.requireResponse().body, path), condition: 'not exists' });
});

// Partial match: every field in the doc string must be in the body; other fields are ignored.
Then('the response body contains(:)', function (docString) {
  const body = this.requireResponse().body;
  const expected = this.resolve(JSON.parse(docString), { strict: true });
  if (!isSubset(body, expected)) {
    throw new Error(`Response body does not contain the expected fields\n  expected subset: ${show(expected)}\n  actual body:     ${show(body)}`);
  }
});

Then('the response matches the schema {string}', function (name) {
  validateSchema(name, this.requireResponse().body);
});

Then('the response header {string} is {string}', function (header, expected) {
  checkValue({ label: `Response header "${header}"`, actual: this.requireResponse().headers[header.toLowerCase()], expected: this.resolve(expected, { strict: true }), type: 'string' });
});

Then('the response header {string} contains {string}', function (header, expected) {
  checkValue({ label: `Response header "${header}"`, actual: this.requireResponse().headers[header.toLowerCase()], expected: this.resolve(expected, { strict: true }), condition: 'contains' });
});

Then('the response time is below {int} ms', function (limit) {
  const { durationMs } = this.requireResponse();
  if (durationMs >= limit) throw new Error(`Response took ${durationMs} ms, expected below ${limit} ms`);
});
