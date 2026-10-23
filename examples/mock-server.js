// A tiny in-memory API for the bundled examples. Not part of the template itself.
//
//   POST   /auth/login        { username, password } -> { token, user }
//   GET    /me                (bearer)
//   GET    /items             ?name= &tag= &limit=
//   GET    /items/:id
//   POST   /items             (bearer, admin)
//   PATCH  /items/:id         (bearer, admin)
//   DELETE /items/:id         (bearer, admin)
//   GET    /reports/summary   (x-api-key)
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const EXAMPLE_USERS = {
  admin: { id: 'usr_1', username: 'admin', password: 'admin-pass', role: 'admin' },
  viewer: { id: 'usr_2', username: 'viewer', password: 'viewer-pass', role: 'viewer' },
};
export const EXAMPLE_REPORTS_KEY = 'example-reports-key';

const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');

function makeToken(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id, role: user.role, exp })}.example`;
}

function readToken(req, tokens) {
  const [scheme, token] = String(req.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' ? tokens.get(token) : undefined;
}

export function startMockServer(port = 0) {
  const items = new Map();
  const tokens = new Map();
  let nextId = 1;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'X-Request-Id': randomUUID() });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    const error = (status, code, message) => send(status, { error: { code, message } });

    let body;
    try {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return error(400, 'BAD_JSON', 'Request body is not valid JSON');
    }

    const user = readToken(req, tokens);
    const requireAdmin = () => {
      if (!user) { error(401, 'UNAUTHENTICATED', 'Missing or invalid token'); return false; }
      if (user.role !== 'admin') { error(403, 'FORBIDDEN', 'Admins only'); return false; }
      return true;
    };
    const validate = (data, partial) => {
      if (!partial || 'name' in data) {
        if (typeof data.name !== 'string' || data.name.trim() === '') return 'name is required';
      }
      if (!partial || 'price' in data) {
        if (typeof data.price !== 'number' || data.price < 0) return 'price must be a number >= 0';
      }
      if ('tags' in data && !Array.isArray(data.tags)) return 'tags must be an array';
      return null;
    };

    const [, resource, id, extra] = url.pathname.split('/');

    if (req.method === 'POST' && url.pathname === '/auth/login') {
      if (!body.username || !body.password) return error(400, 'VALIDATION', 'username and password are required');
      const found = Object.values(EXAMPLE_USERS).find(u => u.username === body.username && u.password === body.password);
      if (!found) return error(401, 'INVALID_CREDENTIALS', 'Wrong username or password');
      const token = makeToken(found);
      tokens.set(token, found);
      return send(200, { token, user: { id: found.id, username: found.username, role: found.role } });
    }

    if (req.method === 'GET' && url.pathname === '/me') {
      if (!user) return error(401, 'UNAUTHENTICATED', 'Missing or invalid token');
      return send(200, { id: user.id, username: user.username, role: user.role });
    }

    if (req.method === 'GET' && url.pathname === '/reports/summary') {
      if (req.headers['x-api-key'] !== EXAMPLE_REPORTS_KEY) return error(401, 'UNAUTHENTICATED', 'Missing or invalid API key');
      return send(200, { totalItems: items.size, generatedAt: new Date().toISOString() });
    }

    if (resource !== 'items' || extra !== undefined) return error(404, 'NOT_FOUND', `No route for ${req.method} ${url.pathname}`);

    if (!id) {
      if (req.method === 'GET') {
        const name = url.searchParams.get('name');
        const tag = url.searchParams.get('tag');
        const limit = Number(url.searchParams.get('limit') ?? 50);
        const data = [...items.values()]
          .filter(i => !name || i.name.toLowerCase().includes(name.toLowerCase()))
          .filter(i => !tag || i.tags.includes(tag));
        return send(200, { data: data.slice(0, limit), total: data.length });
      }

      if (req.method === 'POST') {
        if (!requireAdmin()) return;
        const problem = validate(body, false);
        if (problem) return error(400, 'VALIDATION', problem);
        const item = {
          id: `itm_${nextId++}`,
          name: body.name,
          price: body.price,
          tags: body.tags ?? [],
          details: body.details ?? {},
          active: body.active ?? true,
          createdBy: user.id,
          createdAt: new Date().toISOString(),
        };
        items.set(item.id, item);
        return send(201, item);
      }
    } else {
      const item = items.get(id);

      if (req.method === 'GET') return item ? send(200, item) : error(404, 'NOT_FOUND', `Item ${id} not found`);

      if (req.method === 'PATCH') {
        if (!requireAdmin()) return;
        if (!item) return error(404, 'NOT_FOUND', `Item ${id} not found`);
        const problem = validate(body, true);
        if (problem) return error(400, 'VALIDATION', problem);
        const { id: _ignored, createdBy, createdAt, ...changes } = body;
        Object.assign(item, changes);
        return send(200, item);
      }

      if (req.method === 'DELETE') {
        if (!requireAdmin()) return;
        if (!item) return error(404, 'NOT_FOUND', `Item ${id} not found`);
        items.delete(id);
        return send(204);
      }
    }

    return error(405, 'METHOD_NOT_ALLOWED', `${req.method} not allowed on ${url.pathname}`);
  });

  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

// `pnpm example:server` runs it standalone on port 4010.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await startMockServer(Number(process.env.PORT ?? 4010));
  console.log(`Example API listening on ${url}`);
}
