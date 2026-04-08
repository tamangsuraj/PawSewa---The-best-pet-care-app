'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import { clearStoredAuth, getStoredToken } from '@/lib/authStorage';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  profilePicture?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Passwordless sign-in — POST /auth/send-otp with customer context. */
  sendLoginOtp: (email: string) => Promise<void>;
  /** Passwordless sign-in — POST /auth/verify-otp; persists session like password login. */
  verifyOtpLogin: (email: string, otp: string) => Promise<void>;
  loginWithToken: (userData: any) => void;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const baseUrl = String(process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    const healthUrl = `${baseUrl}/health`;
    const checkHealth = async () => {
      try {
        const res = await fetch(healthUrl);
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
      const savedToken = getStoredToken();
      
      if (savedToken) {
        try {
          const response = await api.get('/users/profile');
          if (response.data.success) {
            setUser(response.data.data);
            setToken(savedToken);
          }
        } catch (error) {
          clearStoredAuth();
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
        const { token: newToken, ...userData } = response.data.data;
        
        // Save to state
        setToken(newToken);
        setUser(userData);
        
        // Save to localStorage
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const sendLoginOtp = async (email: string) => {
    try {
      await api.post('/auth/send-otp', { email, appContext: 'customer' });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Could not send sign-in code');
    }
  };

  const verifyOtpLogin = async (email: string, otp: string) => {
    try {
      const response = await api.post('/auth/verify-otp', {
        email,
        otp,
        appContext: 'customer',
      });
      if (response.data.success) {
        const { token: newToken, ...userData } = response.data.data;
        if (userData.role !== 'pet_owner') {
          throw new Error(
            'This is the customer website. Only pet owner accounts can sign in here.',
          );
        }
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.startsWith('This is the customer')) throw error;
      throw new Error(error.response?.data?.message || 'Invalid or expired code');
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await api.post('/users', userData);
      
      if (response.data.success) {
        const { token: newToken, ...user } = response.data.data;
        
        // Save to state
        setToken(newToken);
        setUser(user);
        
        // Save to localStorage
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const loginWithToken = (userData: any) => {
    const { token: newToken, ...user } = userData;
    
    // Save to state
    setToken(newToken);
    setUser(user);
    
    // Save to localStorage
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearStoredAuth();
    window.location.href = '/';
  };

  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        sendLoginOtp,
        verifyOtpLogin,
        loginWithToken,
        register,
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
