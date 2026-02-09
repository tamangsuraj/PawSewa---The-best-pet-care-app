/**
 * API Client for Next.js Web Applications
 * Handles HTTP requests with Bearer token authentication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface RequestOptions extends RequestInit {
  token?: string;
}

/**
 * Generic API request handler
 * @param endpoint - API endpoint (e.g., '/users/login')
 * @param options - Fetch options including token
 * @returns Promise with response data
 */
export const apiRequest = async <T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> => {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Add Bearer token if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...fetchOptions,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

/**
 * User Authentication API
 */
export const authAPI = {
  /**
   * Register a new user
   */
  register: async (userData: {
    name: string;
    email: string;
    password: string;
    role?: string;
    phone?: string;
  }) => {
    return apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Login user
   */
  login: async (credentials: { email: string; password: string }) => {
    return apiRequest('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Get user profile (requires token)
   */
  getProfile: async (token: string) => {
    return apiRequest('/users/profile', {
      method: 'GET',
      token,
    });
  },

  /**
   * Update user profile (requires token)
   */
  updateProfile: async (
    token: string,
    userData: {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
    }
  ) => {
    return apiRequest('/users/profile', {
      method: 'PUT',
      token,
      body: JSON.stringify(userData),
    });
  },
};

/**
 * Health Check API
 */
export const healthAPI = {
  check: async () => {
    return apiRequest('/health', {
      method: 'GET',
    });
  },
};

export default apiRequest;
