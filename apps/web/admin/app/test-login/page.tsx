'use client';

import React, { useState } from 'react';
import api from '@/lib/api';
import { getAdminApiBaseUrl, getNgrokBrowserBypassHeaders } from '@/lib/apiConfig';

export default function TestLoginPage() {
  const [result, setResult] = useState<{ type: string; data: unknown } | null>(null);
  const [error, setError] = useState<string>('');

  const testBackendConnection = async () => {
    try {
      const baseUrl = getAdminApiBaseUrl().replace(/\/$/, '');
      if (!baseUrl) {
        setError(
          'NEXT_PUBLIC_API_URL is not set (production). In development, default is http://localhost:3000/api/v1.',
        );
        setResult(null);
        return;
      }
      const response = await fetch(`${baseUrl}/health`, {
        headers: getNgrokBrowserBypassHeaders(),
      });
      const data = await response.json();
      setResult({ type: 'Backend Health', data });
      setError('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError('Backend not reachable: ' + message);
    }
  };

  const testLogin = async () => {
    try {
      const response = await api.post('/users/login', {
        email: 'admin@pawsewa.com',
        password: '1Support'
      });
      setResult({ type: 'Login Success', data: response.data });
      setError('');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err instanceof Error ? err.message : String(err));
      setError('Login failed: ' + message);
      setResult({
        type: 'Login Error',
        data: (err as { response?: { data?: unknown } })?.response?.data,
      });
    }
  };

  const checkLocalStorage = () => {
    const token = localStorage.getItem('admin-token')?.trim();
    const user = localStorage.getItem('admin-user');
    setResult({
      type: 'LocalStorage',
      data: { token, user: user ? JSON.parse(user) : null }
    });
  };

  return (
    <div className="min-h-dvh bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Login Diagnostics</h1>
        
        <div className="space-y-4 mb-8">
          <button
            onClick={testBackendConnection}
            className="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90"
          >
            Test Backend Connection
          </button>
          
          <button
            onClick={testLogin}
            className="w-full bg-success text-white px-6 py-3 rounded-lg hover:bg-success/90"
          >
            Test Login API
          </button>
          
          <button
            onClick={checkLocalStorage}
            className="w-full bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent/90"
          >
            Check LocalStorage
          </button>
        </div>

        {error && (
          <div className="bg-danger/20 border border-danger text-danger p-4 rounded-lg mb-4">
            <h3 className="font-bold mb-2">Error:</h3>
            <pre className="text-sm overflow-auto">{error}</pre>
          </div>
        )}

        {result && (
          <div className="bg-secondary border border-slate-700 p-6 rounded-lg">
            <h3 className="text-white font-bold mb-4">{result.type}</h3>
            <pre className="text-gray-300 text-sm overflow-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-8 bg-secondary border border-slate-700 p-6 rounded-lg">
          <h3 className="text-white font-bold mb-4">Instructions:</h3>
          <ol className="text-gray-300 space-y-2 list-decimal list-inside">
            <li>
              Click &quot;Test Backend Connection&quot; — should show{' '}
              <code className="text-primary">status: &quot;ok&quot;</code> when MongoDB is connected
            </li>
            <li>Click &quot;Test Login API&quot; - Should return user data with token</li>
            <li>If login fails with 401, you need to create the admin user</li>
            <li>If login succeeds but role is not &quot;admin&quot;, change it in MongoDB</li>
          </ol>
        </div>

        <div className="mt-4">
          <a href="/login" className="text-primary hover:underline">
            ← Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
