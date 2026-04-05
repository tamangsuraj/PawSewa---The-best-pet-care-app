'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { AlertCircle, RefreshCw, Truck, Store } from 'lucide-react';
import Link from 'next/link';

interface OpUser {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface Order {
  _id: string;
  assignmentStatus?: string;
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
  deliveryCoordinates?: { lat?: number; lng?: number };
  location?: { lat?: number; lng?: number; address?: string };
  assignedRider?: OpUser | string | null;
  assignedSeller?: OpUser | string | null;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [riders, setRiders] = useState<OpUser[]>([]);
  const [sellers, setSellers] = useState<OpUser[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  const loadOperators = async () => {
    try {
      const resp = await api.get('/admin/dispatch-operators');
      const d = resp.data?.data;
      if (d) {
        setRiders(d.riders ?? []);
        setSellers(d.sellers ?? []);
      }
    } catch {
      /* non-fatal */
    }
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/orders', {
        params: { liveOnly: 1, limit: 100, page: 1 },
      });
      const data = resp.data?.data ?? [];
      setOrders(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to load orders';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadOperators();
  }, [loadOrders]);

  useEffect(() => {
    const socket = getAdminSocket();
    if (!socket) return;
    const bump = () => void loadOrders();
    socket.on('orderUpdate', bump);
    socket.on('new:order', bump);
    socket.on('order:paid', bump);
    socket.on('order:assigned_seller', bump);
    socket.on('order:assigned_rider', bump);
    socket.on('order:seller_confirmed', bump);
    return () => {
      socket.off('orderUpdate', bump);
      socket.off('new:order', bump);
      socket.off('order:paid', bump);
      socket.off('order:assigned_seller', bump);
      socket.off('order:assigned_rider', bump);
      socket.off('order:seller_confirmed', bump);
    };
  }, [loadOrders]);

  const assignRider = async (orderId: string, riderId: string) => {
    if (!riderId) return;
    setAssigning(orderId + '-r');
    try {
      await api.patch(`/orders/${orderId}/assign`, { riderId });
      await loadOrders();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Assign rider failed';
      setError(msg);
    } finally {
      setAssigning(null);
    }
  };

  const assignSeller = async (orderId: string, sellerId: string) => {
    if (!sellerId) return;
    setAssigning(orderId + '-s');
    try {
      await api.patch(`/orders/${orderId}/assign-seller`, { sellerId });
      await loadOrders();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Assign seller failed';
      setError(msg);
    } finally {
      setAssigning(null);
    }
  };

  const coordsFor = (o: Order) => {
    const loc = o.location;
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { lat: loc.lat, lng: loc.lng };
    }
    const dc = o.deliveryCoordinates;
    if (dc && typeof dc.lat === 'number' && typeof dc.lng === 'number') {
      return { lat: dc.lat, lng: dc.lng };
    }
    return null;
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shop orders & dispatch</h1>
          <p className="text-gray-600 mt-1">
            Live queue — assign a seller for picking, then a rider for delivery. Updates push to the
            Partner app over Socket.io.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            <Link href="/live-map" className="text-primary font-medium underline">
              Open live map
            </Link>{' '}
            for GPS tracking (same coordinates as customer checkout).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadOrders();
            void loadOperators();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
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
          <p className="text-gray-600 text-lg">No active orders</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Items / Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Address / Map
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Assign seller
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Assign rider
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((o) => {
                  const riderId =
                    o.assignedRider && typeof o.assignedRider === 'object'
                      ? o.assignedRider._id
                      : (o.assignedRider as string) || '';
                  const sellerId =
                    o.assignedSeller && typeof o.assignedSeller === 'object'
                      ? o.assignedSeller._id
                      : (o.assignedSeller as string) || '';
                  const c = coordsFor(o);
                  const osm =
                    c != null
                      ? `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=16/${c.lat}/${c.lng}`
                      : null;
                  return (
                    <tr key={o._id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        #{o._id.slice(-6)}
                        <div className="text-[10px] text-gray-400 mt-1 font-sans normal-case">
                          {o.assignmentStatus?.replace(/_/g, ' ') ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {o.user?.name ?? 'Customer'}
                        </p>
                        <p className="text-xs text-gray-500">{o.user?.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <ul className="list-disc list-inside space-y-0.5 max-w-[200px]">
                          {o.items.map((it, idx) => (
                            <li key={idx}>
                              {it.name} × {it.quantity}
                            </li>
                          ))}
                        </ul>
                        <p className="font-semibold mt-1">NPR {o.totalAmount.toFixed(0)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[220px]">
                        {o.deliveryLocation?.address ?? o.location?.address ?? '—'}
                        {osm ? (
                          <a
                            href={osm}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary font-medium underline"
                          >
                            <Truck className="w-3 h-3" />
                            OSM
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-amber-900">
                        {o.status.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        {sellerId ? (
                          <span className="text-xs text-gray-700">
                            <Store className="w-3.5 h-3.5 inline mr-1" />
                            {typeof o.assignedSeller === 'object'
                              ? o.assignedSeller?.name
                              : 'Assigned'}
                          </span>
                        ) : null}
                        <select
                          className="mt-1 block w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary focus:border-primary"
                          defaultValue=""
                          disabled={assigning === o._id + '-s'}
                          onChange={(e) => {
                            const v = e.target.value;
                            e.target.value = '';
                            if (v) void assignSeller(o._id, v);
                          }}
                        >
                          <option value="">{sellerId ? 'Change seller…' : 'Select seller…'}</option>
                          {sellers.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name ?? s.email}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {riderId ? (
                          <span className="text-xs text-gray-700">
                            <Truck className="w-3.5 h-3.5 inline mr-1" />
                            {typeof o.assignedRider === 'object'
                              ? o.assignedRider?.name
                              : 'Assigned'}
                          </span>
                        ) : null}
                        <select
                          className="mt-1 block w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary focus:border-primary"
                          defaultValue=""
                          disabled={assigning === o._id + '-r'}
                          onChange={(e) => {
                            const v = e.target.value;
                            e.target.value = '';
                            if (v) void assignRider(o._id, v);
                          }}
                        >
                          <option value="">{riderId ? 'Change rider…' : 'Select rider…'}</option>
                          {riders.map((r) => (
                            <option key={r._id} value={r._id}>
                              {r.name ?? r.email}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
