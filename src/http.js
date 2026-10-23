const NO_BODY_METHODS = new Set(['GET', 'HEAD']);

export function joinUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path) return baseUrl;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function appendQuery(url, query = {}) {
  const u = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      u.searchParams.append(key, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
    }
  }
  return u.toString();
}

function findHeader(headers, name) {
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

function encodeBody(body, headers) {
  if (body === undefined) return undefined;

  const type = String(findHeader(headers, 'content-type') ?? '');

  if (typeof body === 'string' || body instanceof Uint8Array || body instanceof FormData || body instanceof URLSearchParams) {
    return body;
  }

  if (type.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(Object.entries(body).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]));
  }

  if (!type) headers['Content-Type'] = 'application/json';
  return JSON.stringify(body);
}

/**
 * Sends one HTTP request and returns a plain response object. Non-2xx statuses are returned,
 * not thrown; only network failures and timeouts throw.
 */
export async function sendRequest({ method, url, headers = {}, body, timeoutMs = 30_000 }) {
  const verb = method.toUpperCase();
  const sendHeaders = Object.fromEntries(Object.entries(headers).filter(([, v]) => v !== undefined && v !== null));

  if (body !== undefined && NO_BODY_METHODS.has(verb)) {
    throw new Error(`${verb} requests cannot have a body (${url}). Use query params instead.`);
  }

  const encoded = encodeBody(body, sendHeaders);
  const started = performance.now();
  let res;

  try {
    res = await fetch(url, { method: verb, headers: sendHeaders, body: encoded, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? `timed out after ${timeoutMs} ms` : (err.cause?.message ?? err.message);
    throw new Error(`${verb} ${url} failed: ${reason}`);
  }

  const text = await res.text();
  const durationMs = Math.round(performance.now() - started);
  const responseHeaders = Object.fromEntries(res.headers);
  let parsed = text === '' ? null : text;

  if (text !== '') {
    try { parsed = JSON.parse(text); } catch { /* not JSON, keep the text */ }
  }

  return {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
    setCookies: typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [],
    body: parsed,
    text,
    durationMs,
  };
}
