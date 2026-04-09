/**
 * REST API CORS: combines explicit tunnel/local dev origins with the shared Socket.IO policy
 * (LAN, ngrok patterns, ALLOWED_ORIGINS).
 */
const { isSocketCorsOriginAllowed } = require('./socketCorsOrigin');

/** Defaults requested for Admin + Ngrok tunnel (override via CORS_EXTRA_ORIGINS / NGROK_TUNNEL_ORIGIN). */
const BUILTIN_EXTRA_ORIGINS = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'https://foveal-gummatous-karyn.ngrok-free.dev',
];

function parseExplicitOrigins() {
  const fromEnv = (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const tunnel = (process.env.NGROK_TUNNEL_ORIGIN || '').trim();
  const list = [...BUILTIN_EXTRA_ORIGINS];
  if (tunnel) list.push(tunnel);
  return [...new Set([...list, ...fromEnv])];
}

function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return a === b;
  }
}

function isExplicitListedOrigin(origin) {
  if (!origin) return false;
  return parseExplicitOrigins().some((entry) => sameOrigin(origin, entry));
}

function isRestCorsOriginAllowed(origin) {
  if (!origin) return true;
  if (isExplicitListedOrigin(origin)) return true;
  return isSocketCorsOriginAllowed(origin);
}

module.exports = {
  isRestCorsOriginAllowed,
  parseExplicitOrigins,
};
