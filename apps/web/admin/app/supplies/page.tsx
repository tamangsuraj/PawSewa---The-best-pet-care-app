'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import {
  AlertCircle,
  Check,
  Package,
  RefreshCw,
  Truck,
  MapPin,
  Clock,
  User,
  Mail,
  Phone,
  Map as MapIcon,
  X,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((m) => m.Marker),
  { ssr: false }
);

interface Rider {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

interface Order {
  _id: string;
  assignmentStatus?: string;
  user?: { _id: string; name: string; email?: string; phone?: string };
  items: Array<{ name: string; price: number; quantity: number }>;
  totalAmount: number;
  status: 'pending' | 'processing' | 'out_for_delivery' | 'delivered';
  paymentStatus?: string;
  paymentMethod?: string;
  deliveryLocation?: {
    address: string;
    point?: { type: string; coordinates: [number, number] };
  };
  location?: { lat: number; lng: number; address?: string };
  assignedRider?: { _id: string; name?: string; email?: string; phone?: string };
  assignedSeller?: { _id: string; name?: string; email?: string; phone?: string };
  sellerConfirmedAt?: string | null;
  proofOfDelivery?: {
    otp?: string;
    photoUrl?: string;
    notes?: string;
    submittedAt?: string | null;
    submittedBy?: string | null;
  };
  createdAt: string;
}

function orderHasProof(o: Order): boolean {
  const p = o.proofOfDelivery;
  if (!p) return false;
  return Boolean((p.otp && p.otp.trim()) || (p.photoUrl && p.photoUrl.trim()) || (p.notes && p.notes.trim()));
}

function ProofMiniBadges({ order }: { order: Order }) {
  const p = order.proofOfDelivery;
  const hasOtp = Boolean(p?.otp && p.otp.trim());
  const hasPhoto = Boolean(p?.photoUrl && p.photoUrl.trim());
  const hasNotes = Boolean(p?.notes && p.notes.trim());

  if (order.status !== 'delivered') return null;

  if (!orderHasProof(order)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border bg-red-50 text-red-700 border-red-200">
        <AlertCircle className="w-3.5 h-3.5" />
        Proof missing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {hasOtp ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <Check className="w-3.5 h-3.5" />
          OTP
        </span>
      ) : null}
      {hasPhoto ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <Check className="w-3.5 h-3.5" />
          Photo
        </span>
      ) : null}
      {hasNotes ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <Check className="w-3.5 h-3.5" />
          Notes
        </span>
      ) : null}
    </span>
  );
}

interface Seller {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

function orderPreciseCoords(order: Order): { lat: number; lng: number } | null {
  const loc = order.location;
  if (
    loc &&
    typeof loc.lat === 'number' &&
    typeof loc.lng === 'number' &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  ) {
    return { lat: loc.lat, lng: loc.lng };
  }
  const c = order.deliveryLocation?.point?.coordinates;
  if (c && c.length >= 2) {
    const lng = c[0];
    const lat = c[1];
    if (typeof lat === 'number' && typeof lng === 'number') {
      return { lat, lng };
    }
  }
  return null;
}

interface OrdersResponse {
  success: boolean;
  data?: Order[];
  pagination?: { page: number; limit: number; total: number; pages: number };
}

const ORDER_STATUSES: Order['status'][] = [
  'pending',
  'processing',
  'out_for_delivery',
  'delivered',
];

function OrderDetailModal({
  order,
  riders,
  sellers,
  onClose,
  onUpdated,
}: {
  order: Order;
  riders: Rider[];
  sellers: Seller[];
  onClose: () => void;
  onUpdated: (updatedOrder?: Order) => void;
}) {
  const [selectedRiderId, setSelectedRiderId] = useState<string>(
    order.assignedRider?._id ?? ''
  );
  const [selectedSellerId, setSelectedSellerId] = useState<string>(
    order.assignedSeller?._id ?? ''
  );
  const [selectedStatus, setSelectedStatus] = useState<Order['status']>(
    order.status
  );
  const [assigning, setAssigning] = useState(false);
  const [assigningSeller, setAssigningSeller] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    setSelectedSellerId(order.assignedSeller?._id ?? '');
    setSelectedRiderId(order.assignedRider?._id ?? '');
    setSelectedStatus(order.status);
  }, [order._id, order.assignedSeller?._id, order.assignedRider?._id, order.status]);

  const precise = orderPreciseCoords(order);
  const mapsSearchUrl = precise
    ? `https://www.google.com/maps/search/?api=1&query=${precise.lat},${precise.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        order.deliveryLocation?.address ?? ''
      )}`;
  const osmUrl = precise
    ? `https://www.openstreetmap.org/?mlat=${precise.lat}&mlon=${precise.lng}#map=16/${precise.lat}/${precise.lng}`
    : null;

  const handleAssignSeller = async () => {
    if (!selectedSellerId) {
      toast.error('Select a seller');
      return;
    }
    setAssigningSeller(true);
    try {
      const resp = await api.patch<{ success: boolean; data?: Order }>(
        `/orders/${order._id}/assign-seller`,
        { sellerId: selectedSellerId }
      );
      toast.success('Seller assigned — partner app notified');
      onUpdated(resp.data?.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to assign seller';
      toast.error(msg);
    } finally {
      setAssigningSeller(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedRiderId) {
      toast.error('Select a rider');
      return;
    }
    setAssigning(true);
    try {
      const resp = await api.patch<{ success: boolean; data?: Order }>(
        `/orders/${order._id}/assign`,
        { riderId: selectedRiderId }
      );
      toast.success('Rider assigned');
      onUpdated(resp.data?.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to assign rider';
      toast.error(msg);
    } finally {
      setAssigning(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (selectedStatus === order.status) {
      toast('Status unchanged', { icon: 'ℹ️' });
      return;
    }
    setUpdatingStatus(true);
    try {
      const resp = await api.patch<{ success: boolean; data?: Order }>(
        `/orders/${order._id}/assign`,
        { status: selectedStatus }
      );
      toast.success('Status updated');
      onUpdated(resp.data?.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to update status';
      toast.error(msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Order #{order._id.slice(-6)}
            </h2>
            {order.assignmentStatus ? (
              <p className="text-xs text-primary font-medium mt-1">
                {order.assignmentStatus.replace(/_/g, ' ')}
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="font-medium text-gray-900">
                {order.user?.name ?? '—'}
              </p>
              {order.user?.email && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  {order.user.email}
                </p>
              )}
              {order.user?.phone && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  {order.user.phone}
                </p>
              )}
              {!order.user?.phone && !order.user?.email && (
                <p className="text-sm text-gray-500">No contact details</p>
              )}
            </div>
          </div>

          {/* Proof of delivery */}
          {order.status === 'delivered' ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Proof of delivery
              </h3>
              {!orderHasProof(order) ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-700" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Proof missing
                    </p>
                    <p className="text-xs text-red-700 mt-0.5">
                      This order is delivered but has no OTP/photo/notes recorded.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {order.proofOfDelivery?.submittedAt ? (
                    <p className="text-xs text-gray-600">
                      Submitted:{' '}
                      {new Date(
                        order.proofOfDelivery.submittedAt
                      ).toLocaleString()}
                    </p>
                  ) : null}
                  {order.proofOfDelivery?.otp ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">
                        OTP
                      </p>
                      <p className="font-mono text-gray-900">
                        {order.proofOfDelivery.otp}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(order.proofOfDelivery?.otp || '');
                        toast.success('OTP copied');
                      }}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white"
                    >
                      Copy
                    </button>
                  </div>
                ) : null}
                {order.proofOfDelivery?.notes ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Notes
                    </p>
                    <p className="text-sm text-gray-800">
                      {order.proofOfDelivery.notes}
                    </p>
                  </div>
                ) : null}
                {order.proofOfDelivery?.photoUrl ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      Photo
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.proofOfDelivery.photoUrl}
                      alt="Proof of delivery"
                      className="w-full max-h-72 object-cover rounded-lg border border-gray-200"
                    />
                    <a
                      href={order.proofOfDelivery.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      Open full image
                    </a>
                  </div>
                ) : null}
                </div>
              )}
            </div>
          ) : null}

          {/* Delivery address & map */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Delivery location
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-gray-900">
                {order.deliveryLocation?.address ?? '—'}
              </p>
              {precise ? (
                <div className="rounded-lg border border-gray-200 overflow-hidden h-40 bg-gray-100">
                  <MapContainer
                    center={[precise.lat, precise.lng]}
                    zoom={14}
                    scrollWheelZoom={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    />
                    <Marker position={[precise.lat, precise.lng]} />
                  </MapContainer>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <a
                  href={mapsSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
                >
                  <MapIcon className="w-4 h-4" aria-hidden />
                  Google Maps
                </a>
                {osmUrl ? (
                  <a
                    href={osmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
                  >
                    OpenStreetMap
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* Order items & total */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Items
            </h3>
            <ul className="space-y-1 text-sm text-gray-700">
              {order.items.map((it, idx) => (
                <li key={idx}>
                  {it.name} × {it.quantity} — NPR {(it.price * it.quantity).toFixed(0)}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-semibold text-gray-900">
              Total: NPR {order.totalAmount.toFixed(0)}
            </p>
          </div>

          {/* Assign seller (Care+ shop chain) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Assign seller
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              Shop owner confirms stock before rider pickup. Partner app receives a real-time ping.
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">Select seller</option>
                  {sellers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAssignSeller}
                disabled={assigningSeller || !selectedSellerId}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium"
              >
                {assigningSeller ? 'Assigning…' : 'Assign seller'}
              </button>
            </div>
            {order.assignedSeller && (
              <p className="mt-2 text-sm text-gray-600">
                Current seller: {order.assignedSeller.name}
                {order.sellerConfirmedAt ? ' · Stock confirmed' : ' · Awaiting confirmation'}
              </p>
            )}
          </div>

          {/* Assign rider */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Assign rider
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              Once assigned, this order will appear in that rider&apos;s delivery app (socket:
              job:available).
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <select
                  value={selectedRiderId}
                  onChange={(e) => setSelectedRiderId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">Select rider</option>
                  {riders.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name} {r.phone ? `(${r.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedRiderId}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
            {order.assignedRider && (
              <p className="mt-2 text-sm text-gray-600">
                Current: {order.assignedRider.name}
                {order.assignedRider.phone && ` • ${order.assignedRider.phone}`}
              </p>
            )}
          </div>

          {/* Update status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Status
            </h3>
            <div className="flex flex-wrap gap-2 items-end">
              <select
                value={selectedStatus}
                onChange={(e) =>
                  setSelectedStatus(e.target.value as Order['status'])
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary min-w-[180px]"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <button
                onClick={handleUpdateStatus}
                disabled={updatingStatus}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium"
              >
                {updatingStatus ? 'Updating…' : 'Update status'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function LiveSuppliesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRiderId, setBulkRiderId] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params: {
        status?: string;
        liveOnly?: number;
        limit: number;
        page: number;
      } = { limit: PAGE_SIZE, page, liveOnly: 1 };
      if (filterStatus !== 'all') params.status = filterStatus;
      const resp = await api.get<OrdersResponse>('/orders', { params });
      const data = resp.data?.data ?? [];
      setOrders(data);
      setPagination(resp.data?.pagination ?? null);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to load orders'
      );
      setOrders([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, page]);

  const loadRiders = async () => {
    try {
      const resp = await api.get<{ success: boolean; data?: Rider[] }>(
        '/users',
        { params: { role: 'rider' } }
      );
      setRiders(resp.data?.data ?? []);
    } catch {
      setRiders([]);
    }
  };

  const loadSellers = async () => {
    try {
      const resp = await api.get<{ success: boolean; data?: Seller[] }>(
        '/users',
        { params: { role: 'shop_owner' } }
      );
      setSellers(resp.data?.data ?? []);
    } catch {
      setSellers([]);
    }
  };

  const mergeOrder = useCallback((updated: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o))
    );
    if (detailOrder?._id === updated._id) {
      setDetailOrder((prev) => (prev ? { ...prev, ...updated } : null));
    }
  }, [detailOrder?._id]);

  useEffect(() => {
    loadOrders();
  }, [filterStatus, page, loadOrders]);

  useEffect(() => {
    loadRiders();
    loadSellers();
  }, []);

  useEffect(() => {
    const socket = getAdminSocket();
    if (!socket) return;
    const handler = (payload: { order?: Order }) => {
      if (payload?.order) {
        mergeOrder(payload.order);
      }
    };
    socket.on('orderUpdate', handler);
    const onNew = (payload: { order?: Order }) => {
      if (payload?.order) mergeOrder(payload.order);
      toast.success('New shop order');
      void loadOrders();
    };
    const onPaid = (payload: { order?: Order }) => {
      if (payload?.order) mergeOrder(payload.order);
      toast.success('Order payment received');
      void loadOrders();
    };
    const onSellerOk = (payload: { order?: Order }) => {
      if (payload?.order) mergeOrder(payload.order);
      toast.success('Seller confirmed stock');
    };
    socket.on('new:order', onNew);
    socket.on('order:paid', onPaid);
    socket.on('order:seller_confirmed', onSellerOk);
    const onSellerAssigned = (payload: { order?: Order }) => {
      if (payload?.order) mergeOrder(payload.order);
      toast.success('Care+ seller assignment synced');
      void loadOrders();
    };
    socket.on('order:assigned_seller', onSellerAssigned);
    const onRiderAssigned = (payload: { order?: Order }) => {
      if (payload?.order) mergeOrder(payload.order);
      toast.success('Rider assignment updated');
      void loadOrders();
    };
    socket.on('order:assigned_rider', onRiderAssigned);
    return () => {
      socket.off('orderUpdate', handler);
      socket.off('new:order', onNew);
      socket.off('order:paid', onPaid);
      socket.off('order:seller_confirmed', onSellerOk);
      socket.off('order:assigned_seller', onSellerAssigned);
      socket.off('order:assigned_rider', onRiderAssigned);
    };
  }, [mergeOrder, loadOrders]);

  useEffect(() => {
    if (detailOrder) loadRiders();
  }, [detailOrder]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o._id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkRiderId || selectedIds.size === 0) {
      toast.error('Select orders and a rider');
      return;
    }
    setBulkAssigning(true);
    try {
      await api.post('/orders/bulk-assign', {
        orderIds: Array.from(selectedIds),
        riderId: bulkRiderId,
      });
      toast.success(`Rider assigned to ${selectedIds.size} order(s)`);
      setSelectedIds(new Set());
      setBulkRiderId('');
      loadOrders();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Bulk assign failed';
      toast.error(msg);
    } finally {
      setBulkAssigning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      processing: 'bg-blue-100 text-blue-800 border-blue-300',
      out_for_delivery: 'bg-orange-100 text-orange-800 border-orange-300',
    };
    const icons: Record<string, JSX.Element> = {
      pending: <Clock className="w-4 h-4" />,
      processing: <Package className="w-4 h-4" />,
      out_for_delivery: <Truck className="w-4 h-4" />,
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
          styles[status] || 'bg-gray-100 text-gray-800 border-gray-300'
        }`}
      >
        {icons[status]}
        {status.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const processingCount = orders.filter((o) => o.status === 'processing').length;
  const outForDeliveryCount = orders.filter(
    (o) => o.status === 'out_for_delivery'
  ).length;

  return (
    <div className="p-8 bg-gray-50 min-h-dvh">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Live Pet Supplies
            </h1>
            <p className="text-gray-600 mt-1">
              New orders appear here first. Assign a rider to send the order to
              their delivery app — it will then show in that rider&apos;s app only.
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-2 border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-700 text-sm font-medium">Pending</p>
                <p className="text-3xl font-bold text-yellow-800">
                  {pendingCount}
                </p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-700 text-sm font-medium">Processing</p>
                <p className="text-3xl font-bold text-blue-800">
                  {processingCount}
                </p>
              </div>
              <Package className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <div className="bg-white border-2 border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-700 text-sm font-medium">
                  Out for Delivery
                </p>
                <p className="text-3xl font-bold text-orange-800">
                  {outForDeliveryCount}
                </p>
              </div>
              <Truck className="w-10 h-10 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 bg-white rounded-t-lg px-2 pt-2">
          {['all', 'pending', 'processing', 'out_for_delivery'].map(
            (status) => (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status);
                  setPage(1);
                }}
                className={`px-4 py-2 font-medium transition-colors ${
                  filterStatus === status
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {status === 'all'
                  ? 'All'
                  : status.replace(/_/g, ' ').toUpperCase()}
              </button>
            )
          )}
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
          <p className="mt-4 text-gray-600">Loading live orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No live orders found</p>
        </div>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <span className="font-medium text-gray-900">
                {selectedIds.size} selected
              </span>
              <select
                value={bulkRiderId}
                onChange={(e) => setBulkRiderId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[180px]"
              >
                <option value="">Select rider</option>
                {riders.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} {r.phone ? `(${r.phone})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={bulkAssigning || !bulkRiderId}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                {bulkAssigning ? 'Assigning…' : 'Assign rider to selected'}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-2 text-gray-600 hover:text-gray-900 text-sm"
              >
                Clear
              </button>
            </div>
          )}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        orders.length > 0 &&
                        selectedIds.size === orders.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o._id)}
                        onChange={() => toggleSelect(o._id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                      #{o._id.slice(-6)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">
                        {o.user?.name ?? 'Customer'}
                      </p>
                      {o.user?.email && (
                        <p className="text-xs text-gray-500">{o.user.email}</p>
                      )}
                      {o.user?.phone && (
                        <p className="text-xs text-gray-500">{o.user.phone}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {o.assignedRider?.name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                          <Truck className="w-3.5 h-3.5" />
                          {o.assignedRider.name}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">
                          No rider
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {o.paymentStatus === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {o.paymentMethod === 'khalti'
                            ? 'Paid (Khalti)'
                            : 'Paid'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600 font-medium">
                          Unpaid
                        </span>
                      )}
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
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
                        <span className="truncate min-w-0 flex-1">
                          {o.deliveryLocation?.address ?? '—'}
                        </span>
                        {(() => {
                          const p = orderPreciseCoords(o);
                          if (!p) return null;
                          return (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`House-level pin: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`}
                              className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-primary border border-primary/30 hover:bg-primary/10"
                              aria-label="View on Map — opens Google Maps at exact coordinates"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              View on Map
                            </a>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        {getStatusBadge(o.status)}
                        <ProofMiniBadges order={o} />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(o.createdAt).toLocaleDateString()}{' '}
                      {new Date(o.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDetailOrder(o)}
                        className="text-primary font-medium text-sm hover:underline"
                      >
                        View & assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination && pagination.pages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <p className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages} ({pagination.total}{' '}
                  orders)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 hover:bg-gray-100"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) =>
                        Math.min(pagination.pages, p + 1)
                      )
                    }
                    disabled={pagination.page >= pagination.pages}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 hover:bg-gray-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          riders={riders}
          sellers={sellers}
          onClose={() => setDetailOrder(null)}
          onUpdated={(updatedOrder) => {
            if (updatedOrder) {
              mergeOrder(updatedOrder);
              setDetailOrder(updatedOrder);
            } else {
              void loadOrders();
            }
          }}
        />
      )}
    </div>
  );
}
