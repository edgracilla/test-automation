import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import Ajv from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { config } from './config.js';

const instances = {};
const compiled = new Map();

function ajvFor(schema) {
  const draft = String(schema.$schema ?? '');
  const key = draft.includes('2020-12') ? '2020' : draft.includes('2019-09') ? '2019' : '07';

  if (!instances[key]) {
    const Ctor = { 2020: Ajv2020, 2019: Ajv2019, '07': Ajv }[key];
    instances[key] = new Ctor({ allErrors: true, strict: false });
    addFormats(instances[key]);
  }

  return instances[key];
}

/** Validates data against schemas/<name>.json. Throws with every validation error listed. */
export function validateSchema(name, data) {
  const file = resolve(config.paths.schemas, extname(name) ? name : `${name}.json`);

  if (!compiled.has(file)) {
    if (!existsSync(file)) throw new Error(`JSON schema not found: ${file}`);
    const schema = JSON.parse(readFileSync(file, 'utf8'));
    compiled.set(file, ajvFor(schema).compile(schema));
  }

  const validate = compiled.get(file);

  if (!validate(data)) {
    const errors = validate.errors.map(e => `  ${e.instancePath || '(root)'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`);
    throw new Error(`Response does not match schema "${name}":\n${errors.join('\n')}`);
  }
}
