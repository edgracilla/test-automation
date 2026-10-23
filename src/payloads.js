import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { config } from './config.js';

/** Reads payloads/<name>.json fresh each time, so one scenario's changes never leak into another. */
export function loadPayload(name) {
  const file = resolve(config.paths.payloads, extname(name) ? name : `${name}.json`);
  if (!existsSync(file)) throw new Error(`Payload template not found: ${file}`);

  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Payload template ${file} is not valid JSON: ${err.message}`);
  }
}

/**
 * Finds the template configured for a request in config.templates.
 * Keys are "METHOD path" (most specific) or just "path", written exactly as in the step,
 * e.g. 'POST /users' or 'PATCH /users/${userId}'.
 */
export function templateFor(method, rawPath) {
  const name = config.templates[`${method.toUpperCase()} ${rawPath}`] ?? config.templates[rawPath];
  return name ? loadPayload(name) : undefined;
}
