/**
 * Website → Node API wiring (same backend as admin + mobile).
 *
 * Every API call is routed through the Next.js server proxy defined in
 * next.config.mjs (source: /api/v1/:path* → backend/api/v1/:path*).
 * This makes ALL environments work without browser CORS issues:
 *   - localhost dev    → proxy → http://127.0.0.1:3000
 *   - ngrok tunnel     → proxy → https://xxx.ngrok-free.app
 *   - deployed domain  → proxy → https://api.yourdomain.com
 *
 * The browser never talks directly to the Node backend; it only talks to
 * the Next.js server on the same origin.
 */

function trimSlash(s: string) {
  return s.replace(/\/+$/, '');
}

const DEFAULT_DEV_API = 'http://127.0.0.1:3000/api/v1';

function devApiFallback(): string {
  return (process.env.NEXT_PUBLIC_DEV_API_BASE_URL || '').trim();
}

function devSocketFallback(): string {
  return (process.env.NEXT_PUBLIC_DEV_SOCKET_URL || '').trim();
}

function originFromApiBase(base: string): string {
  const raw = base.trim();
  if (!raw) return '';
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

/**
 * Returns '/api/v1' (relative path) in all cases where a backend is configured.
 * The Next.js proxy in next.config.mjs forwards the request to the real backend,
 * server-to-server, with no browser CORS involved.
 *
 * Returns '' only when no backend URL is configured anywhere (broken deployment).
 */
export function getWebsiteApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  // Any configured URL → use the proxy (relative path).
  if (raw) return '/api/v1';

  if (process.env.NODE_ENV === 'development') {
    // Dev proxy falls back to NEXT_PUBLIC_DEV_API_BASE_URL or 127.0.0.1:3000.
    return '/api/v1';
  }

  // No backend configured at all — return empty string so axios fails immediately.
  return '';
}

export const ngrokBrowserBypassHeaders: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
};

/** Socket.io origin (no /api/v1). Unchanged — sockets connect directly to the Node server. */
export function getWebsiteSocketUrl(): string {
  const socketEnv = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (socketEnv) return trimSlash(socketEnv);

  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api && /ngrok/i.test(api)) {
    return trimSlash(devSocketFallback() || originFromApiBase(devApiFallback() || DEFAULT_DEV_API));
  }
  if (api) {
    const fromApi = originFromApiBase(api);
    if (fromApi) return fromApi;
  }
  if (process.env.NODE_ENV === 'development') {
    const ds = devSocketFallback();
    if (ds) return trimSlash(ds);
    const da = devApiFallback() || DEFAULT_DEV_API;
    const fromDa = originFromApiBase(da);
    if (fromDa) return fromDa;
  }
  return '';
}

export function websiteApiEnvPointsLocalOrUnset(): boolean {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
  const dev = process.env.NEXT_PUBLIC_DEV_API_BASE_URL?.trim() || '';
  const primary = raw || (process.env.NODE_ENV === 'development' ? dev || DEFAULT_DEV_API : '');
  if (!primary || primary === '/api/v1') return !raw;
  const lower = primary.toLowerCase();
  return lower.includes('localhost') || lower.includes('127.0.0.1');
}

export function websiteApiUsesNgrokProxy(): boolean {
  // All URLs now use the Next.js proxy, but this flag remains for backward compat.
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
  return /ngrok/i.test(raw);
}
