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
import ScrollableTableWrapper from '@/components/ui/ScrollableTableWrapper';

interface Order {
  _id: string;
  user?: { _id: string; name: string; email?: string; phone?: string };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    product?: { _id?: string; images?: string[] };
  }>;
  totalAmount: number;
  status: 'delivered';
  paymentStatus?: string;
  deliveryLocation?: { address: string };
  assignedRider?: { _id: string; name?: string };
  proofOfDelivery?: {
    otp?: string;
    photoUrl?: string;
    notes?: string;
    submittedAt?: string | null;
  };
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
  const [selectedProof, setSelectedProof] = useState<Order | null>(null);

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
    <div className="p-8 bg-gray-50 min-h-dvh">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <ScrollableTableWrapper>
          <table className="w-full min-w-[1100px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[90px]">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[130px]">
                  Date
                </th>
                <th className="sticky right-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                  Proof
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
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
                    <ul className="space-y-1">
                      {order.items.map((it, idx) => {
                        const thumb = it.product?.images?.[0];
                        return (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt=""
                                className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0 bg-gray-50"
                              />
                            ) : (
                              <span
                                className="w-8 h-8 rounded bg-gray-100 shrink-0 inline-block"
                                aria-hidden
                              />
                            )}
                            <span>
                              {it.name} × {it.quantity}
                            </span>
                          </li>
                        );
                      })}
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
                  <td className="sticky right-0 z-10 bg-white px-6 py-4 whitespace-nowrap text-sm">
                    {order.proofOfDelivery?.otp ||
                    order.proofOfDelivery?.photoUrl ||
                    order.proofOfDelivery?.notes ? (
                      <button
                        onClick={() => setSelectedProof(order)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-white text-gray-700"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollableTableWrapper>
        </div>
      )}

      {selectedProof ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Proof for #{selectedProof._id.slice(-6)}
                </h2>
                {selectedProof.proofOfDelivery?.submittedAt ? (
                  <p className="text-xs text-gray-600 mt-1">
                    Submitted{' '}
                    {new Date(
                      selectedProof.proofOfDelivery.submittedAt
                    ).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => setSelectedProof(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="Close"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {selectedProof.proofOfDelivery?.otp ? (
                <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      OTP
                    </p>
                    <p className="font-mono text-gray-900">
                      {selectedProof.proofOfDelivery.otp}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        selectedProof.proofOfDelivery?.otp || ''
                      );
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white"
                  >
                    Copy
                  </button>
                </div>
              ) : null}

              {selectedProof.proofOfDelivery?.notes ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Notes
                  </p>
                  <p className="text-sm text-gray-800 mt-1">
                    {selectedProof.proofOfDelivery.notes}
                  </p>
                </div>
              ) : null}

              {selectedProof.proofOfDelivery?.photoUrl ? (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Photo
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedProof.proofOfDelivery.photoUrl}
                    alt="Proof of delivery"
                    className="w-full max-h-80 object-cover rounded-lg border border-gray-200"
                  />
                  <a
                    href={selectedProof.proofOfDelivery.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    Open full image
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
