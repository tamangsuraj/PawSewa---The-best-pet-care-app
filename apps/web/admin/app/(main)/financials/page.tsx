'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { PawSewaLoader } from '@/components/PawSewaLoader';
import { FileText, Printer, RefreshCw } from 'lucide-react';

type TxRow = {
  id: string;
  orderId: string;
  date: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  status: string;
  method: string;
  transactionId: string;
  itemCount: number;
};

type ReceiptData = {
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
};

export default function FinancialsPage() {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ success: boolean; data?: TxRow[] }>('/admin/financials/transactions');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setRows(res.data.data);
      } else {
        setError('Invalid response');
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openReceipt = async (orderId: string) => {
    setReceiptLoading(true);
    try {
      const res = await api.get<{ success: boolean; data?: ReceiptData }>(
        `/admin/financials/receipt/${orderId}`,
      );
      if (res.data?.success && res.data.data) {
        setReceipt(res.data.data);
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || 'Could not load receipt');
    } finally {
      setReceiptLoading(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#171415]">Financials</h1>
          <p className="text-sm text-gray-600">
            Recent Khalti shop payments — view and print receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <PawSewaLoader width={120} />
          <p className="text-sm text-gray-600">Loading transactions…</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Khalti ID</th>
                <th className="px-4 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No Khalti transactions yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                      {new Date(r.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.customerName}</div>
                      {r.customerEmail ? (
                        <div className="text-xs text-gray-500">{r.customerEmail}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      NPR {Number(r.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.method}</td>
                    <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-gray-600">
                      {r.transactionId || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={receiptLoading}
                        onClick={() => void openReceipt(r.orderId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:bg-transparent">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl print:max-h-none print:shadow-none print:border print:border-gray-300"
            id="financials-receipt-print"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">PawSewa — Payment receipt</h2>
                <p className="text-xs text-gray-500">Receipt #{receipt.receiptNo}</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button
                  type="button"
                  onClick={printReceipt}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

            <dl className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Issued</dt>
                <dd className="text-gray-900">{new Date(receipt.issuedAt).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Order</dt>
                <dd className="font-mono text-xs text-gray-900">{receipt.orderId}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Khalti transaction</dt>
                <dd className="max-w-[60%] break-all font-mono text-xs text-gray-900">
                  {receipt.khaltiTransactionId || '—'}
                </dd>
              </div>
            </dl>

            <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-gray-500">Customer</p>
              <p className="font-medium text-gray-900">{receipt.customer.name || '—'}</p>
              <p className="text-gray-600">{receipt.customer.email || ''}</p>
              <p className="text-gray-600">{receipt.customer.phone || ''}</p>
              {receipt.deliveryAddress ? (
                <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">{receipt.deliveryAddress}</p>
              ) : null}
            </div>

            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Items</p>
            <ul className="mb-4 space-y-2 border-t border-gray-100 pt-2">
              {receipt.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{it.name}</span>
                    <span className="text-gray-500"> × {it.quantity}</span>
                    {it.productHint ? (
                      <p className="text-xs text-gray-500">{it.productHint}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-medium text-gray-900">
                    NPR {it.lineTotal.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
              <span>Total</span>
              <span>NPR {receipt.totalAmount.toFixed(2)}</span>
            </div>
            <p className="mt-4 text-center text-[10px] text-gray-400">
              Thank you for shopping with PawSewa.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
