/**
 * Socket.IO handshake Origin check — aligned with Express CORS in server.js:
 * - Missing Origin (Flutter, native clients, some proxies): allow
 * - ALLOWED_ORIGINS unset or empty: allow any (same as cors({ origin: '*' }))
 * - ALLOWED_ORIGINS === '*': allow any
 * - Otherwise: allow if Origin matches a comma-separated entry (exact or same URL origin)
 * - Also allow localhost / RFC1918 LAN / ngrok for local + tunnel testing alongside a prod list
 */
function isSocketCorsOriginAllowed(origin) {
  if (!origin) return true;

  const raw = process.env.ALLOWED_ORIGINS;
  if (raw == null || !String(raw).trim()) {
    return true;
  }

  const trimmed = String(raw).trim();
  if (trimmed === '*') {
    return true;
  }

  const list = trimmed.split(',').map((o) => o.trim()).filter(Boolean);
  for (const entry of list) {
    if (origin === entry) return true;
    try {
      if (new URL(origin).origin === new URL(entry).origin) return true;
    } catch {
      /* ignore malformed entry */
    }
  }

  const localOrTunnel =
    origin.startsWith('http://localhost:') ||
    origin.startsWith('https://localhost:') ||
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/[\w.-]+\.ngrok(-free)?\.app(:\d+)?$/i.test(origin) ||
    /^https?:\/\/[\w.-]+\.ngrok\.io(:\d+)?$/i.test(origin);

  return Boolean(localOrTunnel);
}

module.exports = { isSocketCorsOriginAllowed };
