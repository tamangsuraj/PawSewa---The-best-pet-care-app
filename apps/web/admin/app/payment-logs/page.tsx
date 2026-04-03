'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { FileText, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

interface PaymentLogEntry {
  _id: string;
  pidx: string;
  amount: number;
  amountPaisa?: number;
  status: string;
  purchaseOrderId?: string;
  type: string;
  gateway: string;
  createdAt: string;
}

export default function PaymentLogsPage() {
  const [logs, setLogs] = useState<PaymentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const resp = await api.get('/admin/payment-logs', { params });
      setLogs(resp.data?.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payment logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [statusFilter]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'failed':
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            {status || 'Pending'}
          </span>
        );
    }
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
                <div className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-[#703418] bg-[#703418]/5">
                  <FileText className="w-6 h-6 text-[#703418]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Payment Logs</h1>
                  <p className="text-gray-600 text-sm">pidx, amount, status for all test transactions</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#703418] focus:border-[#703418]"
                >
                  <option value="">All</option>
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                </select>
                <button
                  onClick={loadLogs}
                  className="flex items-center gap-2 px-4 py-2 bg-[#703418] text-white rounded-lg hover:bg-[#703418]/90"
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
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-[#703418] border-t-transparent" />
                <p className="mt-4 text-gray-600">Loading payment logs…</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No payment logs yet</p>
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
                          pidx
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount (NPR)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Order / Ref
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.map((log) => (
                        <tr key={log._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-gray-700 truncate max-w-[180px]" title={log.pidx}>
                            {log.pidx}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{log.type}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            Rs. {Number(log.amount).toFixed(0)}
                          </td>
                          <td className="px-6 py-4">{statusBadge(log.status)}</td>
                          <td className="px-6 py-4 text-sm font-mono text-gray-500 truncate max-w-[120px]">
                            {log.purchaseOrderId || '—'}
                          </td>
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
