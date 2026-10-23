import { When } from '@cucumber/cucumber';
import { loadPayload, templateFor } from '../payloads.js';
import { getPath } from '../path.js';
import { tableToBody } from '../tables.js';

// Paths may contain ${...} placeholders (/users/${userId}) or be full URLs.
// The method is any HTTP verb, case-insensitive: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.

function verb(method) {
  const m = method.toUpperCase();
  if (!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(m)) throw new Error(`Unsupported HTTP method "${method}"`);
  return m;
}

function parseDocString(world, text) {
  try {
    return world.resolve(JSON.parse(text));
  } catch {
    // Not valid JSON before interpolation (e.g. an unquoted ${price}): interpolate the text first.
    const resolved = world.resolve(text, { strict: true });
    try { return JSON.parse(resolved); } catch { return resolved; }
  }
}

// No body, or the template configured for this request in config.templates.
When('I send a(n) {word} request to {string}', async function (method, path) {
  const m = verb(method);
  const template = templateFor(m, path);
  await this.send({ method: m, path, body: template === undefined ? undefined : this.resolve(template) });
});

// Body from payloads/<name>.json, with ${...} resolved from the scenario's variables.
When('I send a(n) {word} request to {string} with payload {string}', async function (method, path, name) {
  await this.send({ method: verb(method), path, body: this.resolve(loadPayload(name)) });
});

// Body written inline as a doc string (JSON or plain text).
When('I send a(n) {word} request to {string} with body(:)', async function (method, path, docString) {
  await this.send({ method: verb(method), path, body: parseDocString(this, docString) });
});

// Body built from a table: headers are paths (address.city, tags[]) with optional :type.
When('I send a(n) {word} request to {string} with the following details(:)', async function (method, path, dataTable) {
  await this.send({ method: verb(method), path, body: tableToBody(dataTable, this.ctx) });
});

// Query string from a table; empty cells are left out.
When('I send a(n) {word} request to {string} with query params(:)', async function (method, path, dataTable) {
  const query = tableToBody(dataTable, this.ctx);
  if (Array.isArray(query)) throw new Error('Query params table must have a single data row');
  await this.send({ method: verb(method), path, query });
});

// Storing values for later steps ----------------------------------------------------

When('I store the response value {string} as {string}', function (path, name) {
  this.vars.set(name, getPath(this.requireResponse().body, path));
});

When('I store the response id as {string}', function (name) {
  const idPath = this.getService(this.lastRequest.service).idPath;
  const id = getPath(this.requireResponse().body, idPath);
  if (id === undefined) throw new Error(`Response has no id at "${idPath}" (set idPath on the service to change it)`);
  this.vars.set(name, id);
});

When('I store the response header {string} as {string}', function (header, name) {
  this.vars.set(name, this.requireResponse().headers[header.toLowerCase()]);
});

// Cleanup: runs after the scenario, even if it fails, with the identity active right now.

When('after the scenario, I send a(n) {word} request to {string}', function (method, path) {
  this.cleanups.push({
    request: { method: verb(method), path: this.resolve(path, { strict: true }), service: this.service },
    identities: new Map(this.identities),
  });
});
