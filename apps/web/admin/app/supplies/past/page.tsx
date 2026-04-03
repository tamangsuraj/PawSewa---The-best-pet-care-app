'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import {
  AlertCircle,
  CheckCircle,
  History,
  RefreshCw,
  Search,
  MapPin,
} from 'lucide-react';

interface Order {
  _id: string;
  user?: { _id: string; name: string; email?: string; phone?: string };
  items: Array<{ name: string; price: number; quantity: number }>;
  totalAmount: number;
  status: 'delivered';
  paymentStatus?: string;
  deliveryLocation?: { address: string };
  assignedRider?: { _id: string; name?: string };
  createdAt: string;
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month';

function getDateRange(filter: DateFilter): { start: Date; end: Date } | null {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (filter === 'today') {
    return { start, end };
  }
  if (filter === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
    return { start, end };
  }
  if (filter === 'week') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (filter === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

export default function PastSuppliesPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const handleSearch = () => setAppliedSearch(search.trim());

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get<{ success: boolean; data?: Order[] }>(
        '/orders',
        { params: { status: 'delivered' } }
      );
      const data = resp.data?.data ?? [];
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setItems(sorted);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to load past orders'
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let list = items;

    const q = appliedSearch.toLowerCase();
    if (q) {
      list = list.filter((order) => {
        const orderId = String(order._id ?? '');
        const email = order.user?.email ?? '';
        const phone = String(order.user?.phone ?? '');
        const productNames = (order.items ?? [])
          .map((i) => i.name ?? '')
          .join(' ')
          .toLowerCase();
        const riderName = order.assignedRider?.name ?? '';
        return (
          orderId.toLowerCase().includes(q) ||
          email.toLowerCase().includes(q) ||
          phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
          productNames.includes(q) ||
          riderName.toLowerCase().includes(q)
        );
      });
    }

    const range = getDateRange(dateFilter);
    if (range) {
      const { start, end } = range;
      list = list.filter((order) => {
        const d = new Date(order.createdAt).getTime();
        return d >= start.getTime() && d <= end.getTime();
      });
    }

    return list;
  }, [items, appliedSearch, dateFilter]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Past Pet Supplies
            </h1>
            <p className="text-gray-600 mt-1">
              Delivered orders. Search by order ID, customer email, phone, product
              name or rider name.
            </p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex flex-1 min-w-[200px] gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Order ID, email, phone, product name or rider..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'today', 'yesterday', 'week', 'month'] as DateFilter[]).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    dateFilter === f
                      ? 'bg-primary text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all'
                    ? 'All time'
                    : f === 'week'
                      ? 'This week'
                      : f === 'month'
                        ? 'This month'
                        : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              )
            )}
          </div>
        </div>
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
          <p className="mt-4 text-gray-600">Loading past orders...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            {items.length === 0
              ? 'No past orders found'
              : 'No search results found. Try a different search or date filter.'}
          </p>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    #{order._id.slice(-6)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {order.user?.name ?? 'Customer'}
                    </p>
                    {order.user?.email && (
                      <p className="text-xs text-gray-500">{order.user.email}</p>
                    )}
                    {order.user?.phone && (
                      <p className="text-xs text-gray-500">{order.user.phone}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <ul className="list-disc list-inside space-y-0.5">
                      {order.items.map((it, idx) => (
                        <li key={idx}>
                          {it.name} × {it.quantity}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    NPR {order.totalAmount.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span className="truncate">
                        {order.deliveryLocation?.address ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-300">
                      <CheckCircle className="w-4 h-4" />
                      DELIVERED
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}{' '}
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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
