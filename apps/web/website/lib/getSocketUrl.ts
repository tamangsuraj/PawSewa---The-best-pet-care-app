/** Socket.io origin: same host as REST, without `/api/v1` (matches mobile ApiConfig socket URL). */
export function getSocketUrlFromApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const u = raw.replace(/\/$/, '');
  return u.replace(/\/api\/v1$/i, '');
}

export function apiBaseIncludesNgrok(): boolean {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').toLowerCase();
  return raw.includes('ngrok');
}
