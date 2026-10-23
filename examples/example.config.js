// Config for the bundled examples (see examples/run.js). Compare with config/test.config.js.
export default {
  defaultService: 'store',

  services: {
    store: {
      baseUrl: '${env:EXAMPLE_API_URL}',
      headers: { Accept: 'application/json' },
      idPath: 'id',
    },
    reports: {
      baseUrl: '${env:EXAMPLE_API_URL}/reports',
    },
  },

  auth: {
    admin: {
      type: 'login',
      services: ['store'],
      request: {
        method: 'POST',
        path: '/auth/login',
        body: { username: '${env:EXAMPLE_ADMIN_USER}', password: '${env:EXAMPLE_ADMIN_PASSWORD}' },
      },
      tokenPath: 'token',
      claims: { session_userId: 'sub', session_role: 'role' },
      capture: { session_username: 'user.username' },
    },
    viewer: {
      type: 'login',
      services: ['store'],
      request: {
        method: 'POST',
        path: '/auth/login',
        body: { username: '${env:EXAMPLE_VIEWER_USER}', password: '${env:EXAMPLE_VIEWER_PASSWORD}' },
      },
      tokenPath: 'token',
      claims: { session_userId: 'sub' },
    },
    reportsKey: {
      type: 'apiKey',
      name: 'x-api-key',
      value: '${env:EXAMPLE_REPORTS_KEY}',
      services: ['reports'],
    },
  },

  templates: {
    'POST /items': 'items/create',
  },

  functions: {
    sku: (prefix = 'SKU') => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  },

  paths: {
    payloads: 'examples/payloads',
    schemas: 'examples/schemas',
  },
};
