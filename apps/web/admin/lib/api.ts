import axios from 'axios';
import { getAdminApiBaseUrl, getNgrokBrowserBypassHeaders } from './apiConfig';
import { clearStoredAdminAuth, getStoredAdminToken } from './authStorage';

const baseURL = getAdminApiBaseUrl();

if (typeof window !== 'undefined' && !baseURL) {
  console.error(
    '[PawSewa Admin] API base URL is missing. Set NEXT_PUBLIC_API_URL (e.g. your ngrok URL + /api/v1) or NEXT_PUBLIC_DEV_API_BASE_URL for local dev. See apps/web/admin/.env.example.',
  );
}

/**
 * Admin REST client. Must target the same Node API as user_app / vet_app / website.
 * CRITICAL: `ngrok-skip-browser-warning` on every request avoids the ngrok HTML interstitial.
 */
const api = axios.create({
  baseURL: baseURL || undefined,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...getNgrokBrowserBypassHeaders(),
  },
});

// Request interceptor to attach JWT token, fix FormData uploads, and inject ngrok bypass header
api.interceptors.request.use(
  (config) => {
    const token = getStoredAdminToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Always inject the ngrok bypass header so requests are never intercepted by
    // the Ngrok browser-warning interstitial page (which returns HTML instead of JSON).
    config.headers['ngrok-skip-browser-warning'] = 'true';

    // When sending FormData (e.g. product with images), remove Content-Type so axios
    // sets multipart/form-data with boundary. Default application/json would break parsing.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: detect HTML bodies (missing bypass on some code paths / tunnel issues)
api.interceptors.response.use(
  (response) => {
    const d = response.data;
    if (typeof d === 'string' && d.trim().startsWith('<')) {
      console.warn(
        '[Admin API] Response looks like HTML, not JSON — ngrok-skip-browser-warning may be missing for this request or the tunnel returned an error page.',
        response.config?.method,
        response.config?.url,
      );
    }
    return response;
  },
  (error) => {
    const method = (error.config?.method || 'GET').toUpperCase();
    const url = error.config?.url || '';
    const status = error.response?.status;
    if (status != null) {
      console.error(`[Admin API] ${method} ${url} → HTTP ${status}`);
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error(
        `[Admin API] ${method} ${url} → no response (network/CORS/tunnel). If using ngrok, ensure NEXT_PUBLIC_API_URL matches the live tunnel and the backend is running.`
      );
    } else {
      console.error(`[Admin API] ${method} ${url} →`, error.message);
    }

    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('login');
      // Do not redirect if this 401 was from the login call (let the login page show the error)
      if (!isLoginRequest) {
        clearStoredAdminAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
