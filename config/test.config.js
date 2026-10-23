/**
 * Test configuration: everything API-specific lives here.
 *
 * Any string value may use placeholders, resolved when it is used:
 *   ${env:NAME}   environment variable (from the shell, .env or .env.<TEST_ENV>)
 *   ${name}       scenario variable
 *   ${$uuid}      generator function (see src/functions.js and `functions` below)
 *
 * You can also export a function: `export default ({ env }) => ({ ... })`, where `env` is TEST_ENV.
 */
export default {
  // Service used by steps unless a scenario says `Given I use the "<name>" service`.
  defaultService: 'api',

  // One entry per API (base URL). Add as many as your suites talk to.
  services: {
    api: {
      baseUrl: '${env:API_URL}',
      headers: { Accept: 'application/json' },
      timeoutMs: 30_000,
      idPath: 'id', // where "I store the response id as ..." finds the id, e.g. '_id' or 'data.id'
    },
    // payments: { baseUrl: '${env:PAYMENTS_URL}' },
  },

  // Identities used by `Given I am authenticated as "<profile>"`.
  // `services` limits where a profile's credentials are sent (default: every service).
  auth: {
    // Static token from the environment.
    // token: { type: 'bearer', token: '${env:API_TOKEN}' },

    // Log in through the API and use the returned token.
    // admin: {
    //   type: 'login',
    //   request: {
    //     method: 'POST',
    //     path: '/auth/login',
    //     body: { email: '${env:ADMIN_EMAIL}', password: '${env:ADMIN_PASSWORD}' },
    //   },
    //   tokenPath: 'data.accessToken',       // where the token is in the response body
    //   // tokenHeader: 'x-auth-token',       // ...or in a response header
    //   // cookies: true,                     // ...or a session cookie
    //   header: 'Authorization',             // default
    //   scheme: 'Bearer',                    // default; '' sends the bare token
    //   claims: { session_userId: 'sub' },   // copy JWT claims into variables
    //   capture: { session_user: 'data.user' }, // copy response values into variables
    // },

    // HTTP basic auth.
    // basicUser: { type: 'basic', username: '${env:BASIC_USER}', password: '${env:BASIC_PASS}' },

    // API key in a header (or `in: 'query'`).
    // partner: { type: 'apiKey', name: 'x-api-key', value: '${env:PARTNER_KEY}', services: ['api'] },

    // OAuth2 client credentials (token cached until expires_in).
    // machine: {
    //   type: 'oauth2',
    //   tokenUrl: '${env:OAUTH_TOKEN_URL}',
    //   clientId: '${env:OAUTH_CLIENT_ID}',
    //   clientSecret: '${env:OAUTH_CLIENT_SECRET}',
    //   scope: 'read write',
    // },

    // Anything else: return the headers/query/vars to use.
    // custom: {
    //   type: 'custom',
    //   async authenticate({ send, env, decodeJwt }) {
    //     const res = await send({ method: 'POST', path: '/session', body: { key: env.SESSION_KEY } });
    //     return { headers: { 'X-Session': res.body.session } };
    //   },
    // },
  },

  // Default request bodies for `When I send a POST request to "<path>"` (no body given in the step).
  // Keys are "METHOD path" or "path", written exactly as in the step; values are files under payloads/.
  templates: {
    // 'POST /users': 'users/create',
  },

  // Your own generators, used as ${$sku} or ${$sku('A')}.
  functions: {
    // sku: (prefix = 'SKU') => `${prefix}-${Date.now()}`,
  },

  paths: {
    payloads: 'payloads',
    schemas: 'schemas',
  },

  stepTimeoutMs: 60_000,
  // redactHeaders: ['x-session'], // masked in reports (Authorization, Cookie and X-API-Key always are)
};
