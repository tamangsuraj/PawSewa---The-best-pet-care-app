'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

interface RevenueData {
  totalPlatformFee: number;
  totalSubscriptionRevenue: number;
  totalProviderRevenue: number;
  byServiceType: Record<string, { count: number; platformFee: number }>;
  bookingCount: number;
  subscriptionCount: number;
}

export default function ProviderRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/admin/provider-revenue');
      setData(resp.data?.data ?? null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load revenue data';
      const is404 = err.response?.status === 404;
      setError(is404
        ? `${msg}. Ensure the backend is running (cd backend && npm run dev) and has been restarted with the latest code.`
        : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64">
          <Header />
          <main className="pt-24 px-6 pb-6">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#703418]/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-[#703418]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Provider Revenue</h1>
                  <p className="text-gray-600 text-sm">Platform fees from care bookings and subscriptions</p>
                </div>
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#703418] text-white rounded-lg hover:bg-[#5a2a12] disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                {error}
              </div>
            )}

            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-[#703418] border-t-transparent" />
                <p className="mt-4 text-gray-600">Loading…</p>
              </div>
            ) : data ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Platform Fees</p>
                        <p className="text-xl font-bold text-gray-900">Rs. {Number(data.totalPlatformFee).toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Subscription Revenue</p>
                        <p className="text-xl font-bold text-gray-900">Rs. {Number(data.totalSubscriptionRevenue).toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#703418]/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-[#703418]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Provider Revenue</p>
                        <p className="text-xl font-bold text-[#703418]">Rs. {Number(data.totalProviderRevenue).toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">By Service Type</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Service Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bookings
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Platform Fee
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(data.byServiceType || {}).map(([type, v]) => (
                          <tr key={type} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{type}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{v.count}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">Rs. {Number(v.platformFee).toFixed(0)}</td>
                          </tr>
                        ))}
                        {Object.keys(data.byServiceType || {}).length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                              No data yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No revenue data</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
