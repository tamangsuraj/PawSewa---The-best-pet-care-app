/**
 * Single source of truth for admin → Node API wiring.
 * Backend default port is 3000; REST prefix is /api/v1 (not :5000, not /api alone).
 *
 * Set NEXT_PUBLIC_API_URL to your stable backend (e.g. ngrok https://….ngrok-free.app/api/v1).
 * For local-only dev without NEXT_PUBLIC_API_URL, set NEXT_PUBLIC_DEV_API_BASE_URL and
 * optionally NEXT_PUBLIC_DEV_SOCKET_URL (no hardcoded localhost in source).
 */
function trimSlash(s: string) {
  return s.replace(/\/+$/, '');
}

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
 * REST base URL, e.g. https://xxx.ngrok-free.app/api/v1
 * If NEXT_PUBLIC_API_URL is an ngrok URL, the browser uses same-origin `/api/v1` and Next.js
 * rewrites proxy to that tunnel (avoids CORS preflight hitting ngrok without bypass header).
 */
export function getAdminApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    if (/ngrok/i.test(raw)) {
      return '/api/v1';
    }
    return trimSlash(raw);
  }
  if (process.env.NODE_ENV === 'development') {
    const fb = devApiFallback();
    if (fb) return trimSlash(fb);
  }
  return '';
}

/**
 * Always send ngrok bypass on outbound axios calls (harmless when not using ngrok).
 * Preflight OPTIONS from the browser cannot attach this header; same-origin API proxy covers that.
 */
export function getNgrokBrowserBypassHeaders(): Record<string, string> {
  return { 'ngrok-skip-browser-warning': 'true' };
}

/**
 * Socket.io origin (no /api/v1 path). When REST is ngrok-proxied via Next, connect sockets to the
 * real Node server unless NEXT_PUBLIC_SOCKET_URL or dev fallbacks override — avoids browser→ngrok socket preflight.
 */
/**
 * True when env points at loopback or no API URL is configured (helps tunnel / public-host hints).
 */
export function adminApiEnvPointsLocalOrUnset(): boolean {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
  const dev = process.env.NEXT_PUBLIC_DEV_API_BASE_URL?.trim() || '';
  const primary = raw || (process.env.NODE_ENV === 'development' ? dev : '');
  if (!primary) return true;
  const lower = primary.toLowerCase();
  return lower.includes('localhost') || lower.includes('127.0.0.1');
}

export function getAdminSocketUrl(): string {
  const socketEnv = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (socketEnv) return trimSlash(socketEnv);

  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api && /ngrok/i.test(api)) {
    return trimSlash(devSocketFallback() || originFromApiBase(devApiFallback()) || '');
  }
  if (api) {
    try {
      const u = new URL(api);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  if (process.env.NODE_ENV === 'development') {
    const ds = devSocketFallback();
    if (ds) return trimSlash(ds);
    const da = devApiFallback();
    const fromDa = originFromApiBase(da);
    if (fromDa) return fromDa;
  }
  return '';
}
