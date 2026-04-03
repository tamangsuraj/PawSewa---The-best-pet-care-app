'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Order {
  _id: string;
  user?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{ name: string; price: number; quantity: number }>;
  totalAmount: number;
  status: 'pending' | 'processing' | 'out_for_delivery' | 'delivered';
  deliveryLocation?: {
    address: string;
  };
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/orders', { params: { status: 'pending' } });
      const data = resp.data?.data ?? [];
      setOrders(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Orders</h1>
          <p className="text-gray-600 mt-1">
            Product orders awaiting processing and delivery assignment.
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-gray-600">Loading orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No new orders</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    #{o._id.slice(-6)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {o.user?.name ?? 'Customer'}
                    </p>
                    <p className="text-xs text-gray-500">{o.user?.phone}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <ul className="list-disc list-inside space-y-0.5">
                      {o.items.map((it, idx) => (
                        <li key={idx}>
                          {it.name} × {it.quantity}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    NPR {o.totalAmount.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                    {o.deliveryLocation?.address ?? '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-yellow-800">
                    {o.status.replace(/_/g, ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

