import axios from 'axios';

/**
 * Admin REST client. Must target the same Node API as user_app / vet_app / website
 * (e.g. your shared ngrok URL + `/api/v1` or deployed backend URL).
 * Pets admin list: GET /pets/admin → `petController.getAllPets` → MongoDB `PawSewaDB.pets` (or DB_NAME).
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token and fix FormData uploads
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin-token');
    
    if (token) {
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
