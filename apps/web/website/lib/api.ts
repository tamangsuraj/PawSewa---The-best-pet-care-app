import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      // Token expired or invalid - clear auth state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Create order (for checkout). Body: { items: [{ productId, quantity }], deliveryLocation: { address, coordinates: [lng, lat] } }
export const createOrder = (data: {
  items: Array<{ productId: string; quantity: number }>;
  deliveryLocation: { address: string; coordinates: [number, number] };
  deliveryNotes?: string;
}) => api.post('/orders', data);

// Initiate Khalti payment. Body: { type: 'order', orderId } or { type: 'service', serviceRequestId, amount }
export const initiatePayment = (data: {
  type: string;
  orderId?: string;
  serviceRequestId?: string;
  amount?: number;
}) => api.post('/payments/initiate-payment', data);

// Verify payment with pidx
export const verifyPayment = (pidx: string) =>
  api.post('/payments/verify-payment', { pidx });

export default api;
