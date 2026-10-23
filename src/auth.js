import { config } from './config.js';
import { getPath } from './path.js';

// Credentials are cached per profile for the whole run (per worker with --parallel),
// so logging in once serves every scenario. "I force log in as ..." bypasses the cache.
const cache = new Map();
const EXPIRY_MARGIN_MS = 30_000;

export function getProfile(name) {
  const profile = config.auth[name];
  if (!profile) {
    const known = Object.keys(config.auth);
    throw new Error(`Unknown auth profile "${name}". ${known.length ? `Defined: ${known.join(', ')}` : 'No profiles are defined under "auth" in the test config.'}`);
  }
  return profile;
}

/**
 * Obtains (or reuses) credentials for a profile.
 * @returns {Promise<{ headers: object, query: object, vars: object, expiresAt?: number }>}
 */
export async function getCredentials(world, name, { fresh = false } = {}) {
  const profile = getProfile(name);
  const cached = cache.get(name);

  if (!fresh && profile.reuse !== false && cached && (!cached.expiresAt || cached.expiresAt - EXPIRY_MARGIN_MS > Date.now())) {
    return cached;
  }

  const creds = await obtain(world, profile, name);
  const normalized = { headers: {}, query: {}, vars: {}, ...creds };
  cache.set(name, normalized);
  return normalized;
}

async function obtain(world, profile, name) {
  const type = String(profile.type ?? 'none').toLowerCase();

  switch (type) {
    case 'none':
      return {};

    case 'bearer': {
      const token = world.resolve(profile.token, { strict: true });
      return withToken(profile, token);
    }

    case 'basic': {
      const user = world.resolve(profile.username, { strict: true });
      const pass = world.resolve(profile.password, { strict: true });
      return { headers: { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` } };
    }

    case 'apikey': {
      const keyName = profile.name ?? 'x-api-key';
      const value = world.resolve(profile.value, { strict: true });
      return profile.in === 'query' ? { query: { [keyName]: value } } : { headers: { [keyName]: value } };
    }

    case 'login':
      return login(world, profile, name);

    case 'oauth2':
      return oauth2(world, profile, name);

    case 'custom': {
      if (typeof profile.authenticate !== 'function') {
        throw new Error(`Auth profile "${name}" is type "custom" but has no authenticate() function`);
      }
      return profile.authenticate({
        send: opts => world.send({ ...opts, auth: false, record: false }),
        resolve: (value, opts) => world.resolve(value, opts),
        env: process.env,
        vars: world.vars,
        decodeJwt,
      });
    }

    default:
      throw new Error(`Auth profile "${name}" has unknown type "${profile.type}". Use none, bearer, basic, apiKey, login, oauth2 or custom.`);
  }
}

async function login(world, profile, name) {
  const req = profile.request ?? {};
  if (!req.path) throw new Error(`Auth profile "${name}" (login) needs request.path`);

  const response = await world.send({
    method: req.method ?? 'POST',
    path: req.path,
    service: req.service ?? profile.service,
    body: req.body === undefined ? undefined : world.resolve(req.body, { strict: true }),
    query: req.query === undefined ? undefined : world.resolve(req.query, { strict: true }),
    headers: req.headers === undefined ? undefined : world.resolve(req.headers, { strict: true }),
    auth: false,
    record: false,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Login for auth profile "${name}" failed with ${response.status}: ${response.text.slice(0, 500)}`);
  }

  const creds = { headers: {}, vars: {} };

  if (profile.tokenPath || profile.tokenHeader || !profile.cookies) {
    const token = profile.tokenHeader
      ? response.headers[profile.tokenHeader.toLowerCase()]
      : getPath(response.body, profile.tokenPath ?? 'token');

    if (!token) {
      throw new Error(`Login for auth profile "${name}" returned no token at ${profile.tokenHeader ? `header "${profile.tokenHeader}"` : `"${profile.tokenPath ?? 'token'}"`}. Response: ${response.text.slice(0, 500)}`);
    }

    Object.assign(creds, withToken(profile, token));
  }

  if (profile.cookies) {
    const cookie = response.setCookies.map(c => c.split(';')[0]).join('; ');
    if (cookie) creds.headers.Cookie = cookie;
  }

  for (const [varName, path] of Object.entries(profile.capture ?? {})) {
    creds.vars[varName] = getPath(response.body, path);
  }

  return creds;
}

async function oauth2(world, profile, name) {
  const params = {
    grant_type: profile.grantType ?? 'client_credentials',
    client_id: profile.clientId,
    client_secret: profile.clientSecret,
    scope: profile.scope,
    audience: profile.audience,
    username: profile.username,
    password: profile.password,
    ...(profile.params ?? {}),
  };

  const response = await world.send({
    method: 'POST',
    path: world.resolve(profile.tokenUrl, { strict: true }),
    service: profile.service,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: world.resolve(params),
    auth: false,
    record: false,
  });

  const token = response.body?.access_token;
  if (response.status >= 300 || !token) {
    throw new Error(`OAuth2 token request for auth profile "${name}" failed with ${response.status}: ${response.text.slice(0, 500)}`);
  }

  const creds = withToken(profile, token);
  if (response.body.expires_in) creds.expiresAt = Date.now() + Number(response.body.expires_in) * 1000;
  return creds;
}

/** Builds the auth header for a token and, if configured, copies JWT claims into variables. */
function withToken(profile, token) {
  const header = profile.header ?? 'Authorization';
  const scheme = profile.scheme === undefined ? 'Bearer' : profile.scheme;
  const creds = { headers: { [header]: scheme ? `${scheme} ${token}` : token }, vars: {} };

  const claims = profile.claims ? decodeJwt(token) : tryDecodeJwt(token);

  if (profile.claims) {
    for (const [varName, claim] of Object.entries(profile.claims)) {
      creds.vars[varName] = getPath(claims, claim);
    }
  }

  if (claims?.exp) creds.expiresAt = claims.exp * 1000;
  return creds;
}

/** Decodes a JWT payload without verifying it: tests only need to read the claims. */
export function decodeJwt(token) {
  const part = String(token).split('.')[1];
  if (!part) throw new Error('Token is not a JWT, so its claims cannot be read');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function tryDecodeJwt(token) {
  try { return decodeJwt(token); } catch { return undefined; }
}
