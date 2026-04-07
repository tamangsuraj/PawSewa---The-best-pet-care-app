import axios from 'axios';
import { getAdminApiBaseUrl, getNgrokBrowserBypassHeaders } from './apiConfig';

const baseURL = getAdminApiBaseUrl();

if (typeof window !== 'undefined' && !baseURL) {
  console.error(
    '[PawSewa Admin] NEXT_PUBLIC_API_URL is missing. Set it to your API base (e.g. http://localhost:3000/api/v1).',
  );
}

/**
 * Admin REST client. Must target the same Node API as user_app / vet_app / website
 * (e.g. ngrok URL + `/api/v1`). Default in development: http://localhost:3000/api/v1
 */
const api = axios.create({
  baseURL: baseURL || undefined,
  headers: {
    'Content-Type': 'application/json',
    ...getNgrokBrowserBypassHeaders(),
  },
});

// Request interceptor to attach JWT token and fix FormData uploads
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin-token')?.trim();
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }

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

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('login');
      // Do not redirect if this 401 was from the login call (let the login page show the error)
      if (!isLoginRequest) {
        localStorage.removeItem('admin-token');
        localStorage.removeItem('admin-user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
