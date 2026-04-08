'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import { getAdminApiBaseUrl, getNgrokBrowserBypassHeaders } from '@/lib/apiConfig';
import toast from 'react-hot-toast';
import { clearStoredAdminAuth, getStoredAdminToken, getStoredAdminUser } from '@/lib/authStorage';

interface User {
  _id?: string;
  name: string;
  role: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  sendLoginOtp: (email: string) => Promise<void>;
  verifyOtpLogin: (email: string, otp: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Backend health check and auth verification on mount
  useEffect(() => {
    const baseUrl = getAdminApiBaseUrl().replace(/\/$/, '');
    const healthUrl = baseUrl ? `${baseUrl}/health` : '';

    const checkHealth = async () => {
      if (!healthUrl) return;
      try {
        const res = await fetch(healthUrl, { headers: getNgrokBrowserBypassHeaders() });
        const data = await res.json();
        const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
        console.log(`[${ts}] [INFO] Backend health: status=${data.status} database=${data.database} userCount=${data.userCount ?? 'n/a'}`);
      } catch (_) {
        const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
        console.log(`[${ts}] [INFO] Backend health: unreachable`);
      }
    };
    checkHealth();

    const checkAuth = async () => {
      const savedToken = getStoredAdminToken();
      const savedUser = getStoredAdminUser<User>();

      // Hydrate immediately to avoid logout-on-refresh when backend is temporarily unreachable.
      if (savedToken && savedUser) {
        setUser(savedUser);
      }

      // Verify in background; clear only on explicit 401 or role mismatch.
      if (savedToken) {
        try {
          const response = await api.get('/users/profile');
          const role = response.data?.data?.role;
          if (response.data?.success && (role === 'admin' || role === 'ADMIN')) {
            setUser(response.data.data);
          } else {
            clearStoredAdminAuth();
            setUser(null);
          }
        } catch (error: any) {
          if (error?.response?.status === 401) {
            clearStoredAdminAuth();
            setUser(null);
          }
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/users/login', { email, password });
      
      if (response.data.success) {
        const { token, ...userData } = response.data.data;
        
        const isAdmin = userData.role === 'admin' || userData.role === 'ADMIN';
        if (!isAdmin) {
          toast.error('Access Denied: Admin privileges required', { duration: 5000 });
          return Promise.reject(new Error('This account does not have admin privileges.'));
        }
        
        localStorage.setItem('admin-token', String(token).trim());
        localStorage.setItem('admin-user', JSON.stringify(userData));
        setUser(userData);
        
        toast.success(`Welcome, ${userData.name}`);
        return Promise.resolve();
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        const msg = error.response?.data?.message || 'Invalid email or password';
        toast.error(msg);
        return Promise.reject(new Error(msg));
      }
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
        return Promise.reject(new Error(error.response.data.message));
      }
      toast.error('Login failed. Check backend connectivity.');
      return Promise.reject(new Error('Unable to connect to backend. Please ensure backend is running on port 3000.'));
    }
  };

  const sendLoginOtp = async (email: string) => {
    try {
      await api.post('/auth/send-otp', { email, appContext: 'admin' });
    } catch (error: any) {
      const msg =
        error.response?.data?.message || 'Could not send admin sign-in code';
      toast.error(msg);
      return Promise.reject(new Error(msg));
    }
  };

  const verifyOtpLogin = async (email: string, otp: string) => {
    try {
      const response = await api.post('/auth/verify-otp', {
        email,
        otp,
        appContext: 'admin',
      });
      if (response.data.success) {
        const { token, ...userData } = response.data.data;
        const isAdmin = userData.role === 'admin' || userData.role === 'ADMIN';
        if (!isAdmin) {
          toast.error('Access Denied: Admin only', { duration: 5000 });
          return Promise.reject(
            new Error('Access Denied: This code is not for an administrator account.'),
          );
        }
        localStorage.setItem('admin-token', String(token).trim());
        localStorage.setItem('admin-user', JSON.stringify(userData));
        setUser(userData);
        toast.success(`Welcome, ${userData.name}`);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Invalid or expired code';
      toast.error(msg);
      return Promise.reject(new Error(msg));
    }
  };

  const logout = () => {
    setUser(null);
    clearStoredAdminAuth();
    toast.success('Logged out');
    window.location.href = '/login';
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        sendLoginOtp,
        verifyOtpLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
