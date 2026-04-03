'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CreditCard, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

interface Transaction {
  _id: string;
  type: string;
  amount: number;
  status: string;
  gateway: string;
  user?: { name: string; email: string; phone?: string };
  createdAt: string;
  orderId?: string;
  serviceRequest?: { serviceType: string };
  careRequest?: { serviceType: string };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const resp = await api.get('/admin/transactions', { params });
      setTransactions(resp.data?.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [statusFilter]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      case 'pending':
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            {status === 'unpaid' ? 'Unpaid' : 'Pending'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const typeLabel = (t: Transaction) => {
    if (t.type === 'order') return 'Shop Order';
    if (t.type === 'service') return t.serviceRequest?.serviceType || 'Service';
    if (t.type === 'care') return t.careRequest?.serviceType || 'Care';
    return t.type;
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64">
          <Header />
          <main className="pt-24 px-6 pb-6">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
                  <p className="text-gray-600 text-sm">All payments (Success/Failed)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
                <button
                  onClick={loadTransactions}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                {error}
              </div>
            )}

            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
                <p className="mt-4 text-gray-600">Loading transactions…</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No transactions found</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Gateway
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.map((t) => (
                        <tr key={t._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(t.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {typeLabel(t)}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{t.user?.name ?? '—'}</p>
                            <p className="text-xs text-gray-500">{t.user?.email}</p>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            Rs. {Number(t.amount).toFixed(0)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {(t.gateway || 'khalti').toUpperCase()}
                          </td>
                          <td className="px-6 py-4">{statusBadge(t.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
