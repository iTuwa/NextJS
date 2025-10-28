// pages/api/secureproxy.js
// Converted proxy logic from secureproxy.php
const RPC_URLS = [
  "https://binance.llamarpc.com",
  "https://bsc.drpc.org"
];

const CONTRACT_ADDRESS = "0xe9d5f645f79fa60fca82b4e1d35832e43370feb0";

// Simple in-memory cache (ephemeral)
let cache = { data: null, timestamp: 0, ttl: 60 };

function getClientIp(req) {
  if (req.headers['cf-connecting-ip']) return req.headers['cf-connecting-ip'];
  if (req.headers['x-forwarded-for']) return req.headers['x-forwarded-for'].split(',')[0].trim();
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return null;
}

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 15000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export default async function handler(req, res) {
  // CORS - permissive to match original
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS,PUT,PATCH,DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const e = req.query.e;
  if (!e) {
    res.status(400).send('Missing endpoint');
    return;
  }
  const endpoint = Array.isArray(e) ? e[0] : e;

  if (endpoint === 'ping_proxy') {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('pong');
    return;
  }

  // simple in-memory cache usage placeholder
  const now = Math.floor(Date.now() / 1000);
  if (cache.data && (now - cache.timestamp) < cache.ttl) {
    // cached data available (not used in this minimal conversion)
  }

  const clientIp = getClientIp(req);

  // copy headers, filtering hop-by-hop headers
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    const lower = k.toLowerCase();
    if (['host','connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade'].includes(lower)) continue;
    forwardHeaders[k] = v;
  }

  if (clientIp) {
    forwardHeaders['x-forwarded-for'] = clientIp + (forwardHeaders['x-forwarded-for'] ? ', ' + forwardHeaders['x-forwarded-for'] : '');
  }

  let body = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // If body parser present, Next will have parsed JSON already into req.body.
    // Forward as JSON string when object, or forward raw string if present.
    if (req.body && typeof req.body === 'string') {
      body = req.body;
    } else if (req.body && Object.keys(req.body).length) {
      try { body = JSON.stringify(req.body); } catch(e) { body = undefined; }
    }
  }

  let lastError = null;
  for (const base of RPC_URLS) {
    const target = base.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
    try {
      const upstream = await fetchWithTimeout(target, { method: req.method, headers: forwardHeaders, body: body, timeout: 20000 });
      res.status(upstream.status);
      // forward headers except hop-by-hop
      upstream.headers.forEach((value, name) => {
        const lower = name.toLowerCase();
        if (['transfer-encoding','connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','upgrade'].includes(lower)) return;
        res.setHeader(name, value);
      });
      const arrayBuffer = await upstream.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
      return;
    } catch (err) {
      lastError = err;
    }
  }

  console.error('Proxy failed for endpoint', endpoint, lastError);
  res.status(502).json({ error: 'Bad gateway', details: String(lastError) });
}
