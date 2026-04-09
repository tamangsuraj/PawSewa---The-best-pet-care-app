'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { FileText, RefreshCw, CheckCircle, XCircle, Clock, Receipt } from 'lucide-react';

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

interface ReceiptPayload {
  log: PaymentLogEntry;
  khaltiTransactionId: string;
  order: {
    receiptNo: string;
    issuedAt: string;
    customer: { name?: string; email?: string; phone?: string };
    deliveryAddress?: string;
    paymentMethod: string;
    khaltiTransactionId: string;
    items: {
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      productHint?: string;
    }[];
    totalAmount: number;
    orderId: string;
  } | null;
}

export default function PaymentLogsPage() {
  const [logs, setLogs] = useState<PaymentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const resp = await api.get('/admin/payment-logs', { params });
      setLogs(resp.data?.data ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to load payment logs');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const openReceipt = useCallback(async (logId: string) => {
    setReceiptOpen(true);
    setReceipt(null);
    setReceiptError('');
    setReceiptLoading(true);
    try {
      const resp = await api.get<{ data: ReceiptPayload }>(`/admin/payment-logs/${logId}/receipt`);
      setReceipt(resp.data?.data ?? null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setReceiptError(e.response?.data?.message || 'Could not load receipt');
    } finally {
      setReceiptLoading(false);
    }
  }, []);

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
    <>
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Receipt
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
                          <td className="px-6 py-4">
                            {log.status === 'Completed' ? (
                              <button
                                type="button"
                                onClick={() => openReceipt(log._id)}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#703418] hover:underline"
                              >
                                <Receipt className="w-4 h-4" />
                                View
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {receiptOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
                role="dialog"
                aria-modal="true"
                onClick={() => setReceiptOpen(false)}
              >
                <div
                  className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Digital receipt</h2>
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-800 text-sm"
                      onClick={() => setReceiptOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="px-6 py-5 space-y-4 text-sm text-gray-700">
                    {receiptLoading && (
                      <p className="text-gray-500">Loading receipt…</p>
                    )}
                    {receiptError && (
                      <p className="text-red-600">{receiptError}</p>
                    )}
                    {!receiptLoading && receipt && (
                      <>
                        <div>
                          <p className="text-xs uppercase text-gray-500">Khalti transaction</p>
                          <p className="font-mono break-all">
                            {receipt.khaltiTransactionId || receipt.log.pidx}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-gray-500">pidx</p>
                          <p className="font-mono break-all">{receipt.log.pidx}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-gray-500">Amount</p>
                          <p className="font-semibold">Rs. {Number(receipt.log.amount).toFixed(0)}</p>
                        </div>
                        {receipt.order ? (
                          <>
                            <div className="border-t border-gray-100 pt-4">
                              <p className="text-xs uppercase text-gray-500 mb-2">Customer</p>
                              <p>{receipt.order.customer.name || '—'}</p>
                              <p className="text-gray-500">{receipt.order.customer.email}</p>
                              <p className="text-gray-500">{receipt.order.customer.phone}</p>
                            </div>
                            {receipt.order.items.length > 0 && (
                              <div>
                                <p className="text-xs uppercase text-gray-500 mb-2">Items (pet hints)</p>
                                <ul className="space-y-2">
                                  {receipt.order.items.map((it, i) => (
                                    <li key={i} className="border border-gray-100 rounded-lg p-2">
                                      <span className="font-medium">{it.name}</span>
                                      <span className="text-gray-500"> × {it.quantity}</span>
                                      {it.productHint ? (
                                        <p className="text-xs text-gray-500 mt-0.5">{it.productHint}</p>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <p className="text-xs text-gray-500">
                              Order ID: <span className="font-mono">{receipt.order.orderId}</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-gray-500 italic">
                            No linked shop order for this log (service/care payments show Khalti ids only).
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
    </>
  );
}
