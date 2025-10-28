# Next.js Secure Proxy (converted from PHP)

This is a minimal Next.js project that reproduces the behavior of the original `secureproxy.php` and serves the original `index.html` from `/public`.

## What is included
- `pages/api/secureproxy.js` — API route that proxies requests to configured RPC URLs and supports `?e=...` and `?e=ping_proxy`.
- `public/index.html` and `public/jquery-3.7.1.min.js` — original frontend files (served statically).
- Minimal `pages/index.js` which loads `public/index.html` in an iframe for immediate parity.

## Deployment
1. Install dependencies: `npm install`
2. Run locally: `npm run dev`
3. Push to a Git repo and import into Vercel — Vercel will detect Next.js and deploy automatically.

## Notes
- The API uses in-memory (ephemeral) caching; for production use, configure an external cache (Redis/Upstash) if persistence is required across cold starts.
- Set or override RPC URLs by editing `pages/api/secureproxy.js` or using environment variables if desired.
