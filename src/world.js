import { setWorldConstructor, World } from '@cucumber/cucumber';
import { getCredentials, getProfile } from './auth.js';
import { config } from './config.js';
import { appendQuery, joinUrl, sendRequest } from './http.js';
import { interpolate } from './template.js';

/**
 * Per-scenario state. Every scenario gets a fresh World, so variables, headers and
 * identities never leak between scenarios.
 */
export class ApiWorld extends World {
  constructor(options) {
    super(options);
    this.vars = new Map();
    this.headers = {};
    this.service = config.defaultService;
    this.identities = new Map(); // service name (or '*') -> { profile, headers, query }
    this.response = undefined;
    this.lastRequest = undefined;
    this.history = [];
    this.cleanups = [];
  }

  get ctx() {
    return { vars: this.vars, env: process.env, functions: config.functions };
  }

  resolve(value, opts) {
    return interpolate(value, this.ctx, opts);
  }

  getService(name = this.service) {
    const svc = config.services[name];
    if (!svc) throw new Error(`Unknown service "${name}". Defined: ${Object.keys(config.services).join(', ')}`);
    return svc;
  }

  /** Signs in with an auth profile for the services it applies to (all services by default). */
  async authenticate(profileName, { fresh = false } = {}) {
    const profile = getProfile(profileName);
    const creds = await getCredentials(this, profileName, { fresh });
    const scopes = profile.services ?? ['*'];

    if (scopes.includes('*')) this.identities.clear();
    for (const scope of scopes) {
      this.identities.set(scope, { profile: profileName, headers: creds.headers, query: creds.query });
    }

    for (const [key, value] of Object.entries(creds.vars ?? {})) this.vars.set(key, value);
  }

  logout() {
    this.identities.clear();
  }

  /**
   * Sends a request through a configured service.
   * `path` may contain ${...} placeholders, or be a full URL to bypass the service's baseUrl.
   */
  async send({ method, path, service, body, query, headers, auth = true, record = true }) {
    const serviceName = service ?? this.service;
    const svc = this.getService(serviceName);
    const baseUrl = this.resolve(svc.baseUrl);

    if (!baseUrl && !/^https?:\/\//i.test(path)) {
      throw new Error(`Service "${serviceName}" has no baseUrl. Set it in the test config (check the env variable it reads).`);
    }

    const identity = auth ? (this.identities.get(serviceName) ?? this.identities.get('*')) : undefined;
    const url = appendQuery(
      joinUrl(baseUrl ?? '', this.resolve(path, { strict: true })),
      { ...(identity?.query ?? {}), ...(query ?? {}) },
    );

    const request = {
      method: method.toUpperCase(),
      url,
      service: serviceName,
      headers: {
        ...this.resolve(svc.headers ?? {}),
        ...(identity?.headers ?? {}),
        ...this.headers,
        ...(headers ?? {}),
      },
      body,
    };

    if (config.logHttp) console.log(`→ ${request.method} ${request.url}`);

    const response = await sendRequest({ ...request, timeoutMs: svc.timeoutMs });

    if (config.logHttp) console.log(`← ${response.status} ${request.method} ${request.url} (${response.durationMs} ms)`);

    this.history.push({ request, response });
    if (record) {
      this.response = response;
      this.lastRequest = request;
    }

    return response;
  }

  requireResponse() {
    if (!this.response) throw new Error('No request has been sent yet in this scenario');
    return this.response;
  }

  /** Request/response pair with secret headers masked, for logs and reports. */
  describeExchange({ request, response } = { request: this.lastRequest, response: this.response }) {
    const mask = headers => Object.fromEntries(Object.entries(headers ?? {}).map(([k, v]) =>
      [k, config.redactHeaders.includes(k.toLowerCase()) ? '***' : v]));

    return {
      request: request && { ...request, headers: mask(request.headers) },
      response: response && {
        status: response.status,
        durationMs: response.durationMs,
        headers: mask(response.headers),
        body: response.body,
      },
    };
  }
}

setWorldConstructor(ApiWorld);
