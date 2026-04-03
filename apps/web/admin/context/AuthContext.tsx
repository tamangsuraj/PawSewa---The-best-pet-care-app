'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

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
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Backend health check and auth verification on mount
  useEffect(() => {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
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
      const savedToken = localStorage.getItem('admin-token');
      const savedUser = localStorage.getItem('admin-user');
      
      if (savedToken && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          
          try {
            const response = await api.get('/users/profile');
            const role = response.data.data.role;
            if (response.data.success && (role === 'admin' || role === 'ADMIN')) {
              setUser(response.data.data);
            } else {
              localStorage.removeItem('admin-token');
              localStorage.removeItem('admin-user');
            }
          } catch (error) {
            localStorage.removeItem('admin-token');
            localStorage.removeItem('admin-user');
          }
        } catch (error) {
          localStorage.removeItem('admin-token');
          localStorage.removeItem('admin-user');
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
        
        localStorage.setItem('admin-token', token);
        localStorage.setItem('admin-user', JSON.stringify(userData));
        setUser(userData);
        
        toast.success(`Welcome, ${userData.name}!`);
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
      toast.error('Login failed - check backend connection');
      return Promise.reject(new Error('Unable to connect to backend. Please ensure backend is running on port 3000.'));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('admin-token');
    localStorage.removeItem('admin-user');
    toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
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
