import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { builtinFunctions } from './functions.js';

// ---------------------------------------------------------------------------
// Environment files
//   .env            shared defaults
//   .env.<TEST_ENV> environment-specific values (dev, staging, ...), wins over .env
//   shell variables win over both
// ---------------------------------------------------------------------------

function readEnvFile(file) {
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
}

const fromShell = new Set(Object.keys(process.env));
const baseEnv = readEnvFile('.env');
export const testEnv = process.env.TEST_ENV ?? baseEnv.TEST_ENV ?? '';
const layered = { ...baseEnv, ...(testEnv ? readEnvFile(`.env.${testEnv}`) : {}) };

for (const [key, value] of Object.entries(layered)) {
  if (!fromShell.has(key)) process.env[key] = value;
}

// ---------------------------------------------------------------------------
// Test config (config/test.config.js unless TEST_CONFIG points elsewhere)
// ---------------------------------------------------------------------------

export const configPath = resolve(process.env.TEST_CONFIG ?? 'config/test.config.js');

if (!existsSync(configPath)) {
  throw new Error(`Test config not found at ${configPath}. Set TEST_CONFIG or create config/test.config.js.`);
}

const loaded = (await import(pathToFileURL(configPath).href)).default;
const raw = typeof loaded === 'function' ? await loaded({ env: testEnv }) : loaded;

export const config = normalize(raw ?? {});

function normalize(cfg) {
  const services = {};

  for (const [name, svc] of Object.entries(cfg.services ?? {})) {
    services[name] = {
      headers: {},
      timeoutMs: cfg.timeoutMs ?? 30_000,
      idPath: 'id',
      ...(typeof svc === 'string' ? { baseUrl: svc } : svc),
    };
  }

  if (Object.keys(services).length === 0) {
    throw new Error(`${configPath} defines no services. Add at least one under "services".`);
  }

  return {
    defaultService: cfg.defaultService ?? Object.keys(services)[0],
    services,
    auth: cfg.auth ?? {},
    templates: cfg.templates ?? {},
    functions: { ...builtinFunctions, ...(cfg.functions ?? {}) },
    paths: { payloads: 'payloads', schemas: 'schemas', ...(cfg.paths ?? {}) },
    stepTimeoutMs: cfg.stepTimeoutMs ?? 60_000,
    redactHeaders: ['authorization', 'cookie', 'set-cookie', 'x-api-key', ...(cfg.redactHeaders ?? [])].map(h => h.toLowerCase()),
    logHttp: process.env.LOG_HTTP === '1' || process.env.LOG_HTTP === 'true' || Boolean(cfg.logHttp),
  };
}
