'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { MapPin, RefreshCw, Package, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((m) => m.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((m) => m.Popup),
  { ssr: false }
);

/** Kathmandu — same reference area as customer app delivery pin */
const DEFAULT_CENTER: [number, number] = [27.7172, 85.324];
const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

interface StaffRow {
  _id: string;
  staffId?: string;
  name?: string;
  role?: string;
  phone?: string;
  coordinates?: { lat: number; lng: number };
}

interface RequestRow {
  _id: string;
  status?: string;
  serviceType?: string;
  coordinates?: { lat: number; lng: number };
}

interface CareRow {
  _id: string;
  status?: string;
  serviceType?: string;
  coordinates?: { lat: number; lng: number };
}

interface OrderPin {
  _id: string;
  status?: string;
  assignmentStatus?: string;
  coordinates?: { lat: number; lng: number };
}

interface CareBookingPin {
  _id: string;
  status?: string;
  serviceType?: string;
  hostelName?: string;
  careAssignmentStatus?: string;
  assignedPartner?: { name?: string; role?: string };
  coordinates?: { lat: number; lng: number };
}

interface LiveMapData {
  staff: StaffRow[];
  requests: RequestRow[];
  careRequests: CareRow[];
  orders: OrderPin[];
  careBookings?: CareBookingPin[];
}

export default function AdminLiveMapPage() {
  const [data, setData] = useState<LiveMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const resp = await api.get<{ success: boolean; data?: LiveMapData }>(
        '/admin/live-map'
      );
      if (resp.data?.success && resp.data.data) {
        setData(resp.data.data);
      } else {
        setErr('Invalid response');
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Failed to load live map';
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const socket = getAdminSocket();
    if (!socket) return;
    const bump = () => {
      void load();
    };
    socket.on('orderUpdate', bump);
    socket.on('new:order', bump);
    socket.on('order:paid', bump);
    socket.on('order:assigned_seller', bump);
    socket.on('order:assigned_rider', bump);
    socket.on('care_booking:update', bump);
    socket.on('care_booking:new', bump);
    return () => {
      socket.off('orderUpdate', bump);
      socket.off('new:order', bump);
      socket.off('order:paid', bump);
      socket.off('order:assigned_seller', bump);
      socket.off('order:assigned_rider', bump);
      socket.off('care_booking:update', bump);
      socket.off('care_booking:new', bump);
    };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load(), 45000);
    return () => clearInterval(t);
  }, [load]);

  const staff = data?.staff ?? [];
  const requests = data?.requests ?? [];
  const care = data?.careRequests ?? [];
  const orders = data?.orders ?? [];
  const careBookings = data?.careBookings ?? [];

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64">
          <Header />
          <main className="pt-24 px-6 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-8 h-8 text-primary" />
                  Live operations map
                </h1>
                <p className="text-gray-600 mt-1">
                  Staff positions (TTL), service requests, Care+ requests, and active
                  shop deliveries — OpenStreetMap tiles (aligned with customer app).
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50"
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Rider
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Vet / other staff
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Service request
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-900 border border-teal-200">
                <span className="w-2 h-2 rounded-full bg-teal-600" />
                Care+ request
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#703418]/10 text-[#703418] border border-[#703418]/25">
                <Package className="w-3.5 h-3.5" />
                Product delivery
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-900 border border-violet-200">
                <Building2 className="w-3.5 h-3.5" />
                Care booking (facility)
              </span>
            </div>

            {err && !data ? (
              <p className="text-red-600">{err}</p>
            ) : (
              <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white h-[min(720px,calc(100vh-14rem))]">
                <MapContainer
                  center={DEFAULT_CENTER}
                  zoom={12}
                  scrollWheelZoom
                  className="h-full w-full z-0"
                  style={{ height: '100%', minHeight: 480 }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url={OSM_TILE}
                  />
                  {staff.map((s) => {
                    const lat = s.coordinates?.lat;
                    const lng = s.coordinates?.lng;
                    if (
                      typeof lat !== 'number' ||
                      typeof lng !== 'number' ||
                      !Number.isFinite(lat) ||
                      !Number.isFinite(lng)
                    ) {
                      return null;
                    }
                    const isRider = s.role === 'rider';
                    return (
                      <CircleMarker
                        key={`st-${s._id}`}
                        center={[lat, lng]}
                        radius={isRider ? 9 : 8}
                        pathOptions={{
                          color: isRider ? '#15803d' : '#1d4ed8',
                          fillColor: isRider ? '#22c55e' : '#3b82f6',
                          fillOpacity: 0.85,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-semibold">{s.name ?? 'Staff'}</p>
                            <p className="text-gray-600">{s.role ?? '—'}</p>
                            {s.phone ? (
                              <p className="text-gray-500">{s.phone}</p>
                            ) : null}
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                  {requests.map((r) => {
                    const c = r.coordinates;
                    if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') {
                      return null;
                    }
                    return (
                      <CircleMarker
                        key={`rq-${r._id}`}
                        center={[c.lat, c.lng]}
                        radius={7}
                        pathOptions={{
                          color: '#b45309',
                          fillColor: '#f59e0b',
                          fillOpacity: 0.9,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="text-sm max-w-[200px]">
                            <p className="font-semibold">Service request</p>
                            <p>{r.serviceType ?? '—'}</p>
                            <p className="text-gray-500">{r.status}</p>
                            <Link
                              href="/service-requests"
                              className="text-primary text-xs font-medium underline"
                            >
                              Open queue
                            </Link>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                  {care.map((c) => {
                    const p = c.coordinates;
                    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
                      return null;
                    }
                    return (
                      <CircleMarker
                        key={`cr-${c._id}`}
                        center={[p.lat, p.lng]}
                        radius={7}
                        pathOptions={{
                          color: '#0f766e',
                          fillColor: '#14b8a6',
                          fillOpacity: 0.9,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="text-sm max-w-[200px]">
                            <p className="font-semibold">Care+</p>
                            <p>{c.serviceType ?? '—'}</p>
                            <p className="text-gray-500">{c.status}</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                  {orders.map((o) => {
                    const p = o.coordinates;
                    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
                      return null;
                    }
                    return (
                      <CircleMarker
                        key={`ord-${o._id}`}
                        center={[p.lat, p.lng]}
                        radius={8}
                        pathOptions={{
                          color: '#4e2410',
                          fillColor: '#703418',
                          fillOpacity: 0.92,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="text-sm max-w-[200px]">
                            <p className="font-semibold">Product order</p>
                            <p className="text-gray-600">{o.status}</p>
                            {o.assignmentStatus ? (
                              <p className="text-gray-500 text-xs">{o.assignmentStatus.replace(/_/g, ' ')}</p>
                            ) : null}
                            <Link
                              href="/supplies"
                              className="text-primary text-xs font-medium underline"
                            >
                              Live supplies
                            </Link>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                  {careBookings.map((b) => {
                    const p = b.coordinates;
                    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
                      return null;
                    }
                    return (
                      <CircleMarker
                        key={`cb-${b._id}`}
                        center={[p.lat, p.lng]}
                        radius={7}
                        pathOptions={{
                          color: '#5b21b6',
                          fillColor: '#8b5cf6',
                          fillOpacity: 0.9,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="text-sm max-w-[220px]">
                            <p className="font-semibold">Care booking</p>
                            <p>{b.hostelName ?? 'Facility'}</p>
                            <p className="text-gray-600">{b.serviceType ?? '—'}</p>
                            <p className="text-gray-500 text-xs">{b.status}</p>
                            {b.assignedPartner?.name ? (
                              <p className="text-primary text-xs mt-1">
                                Partner: {b.assignedPartner.name}
                              </p>
                            ) : null}
                            <Link
                              href="/care/bookings"
                              className="text-primary text-xs font-medium underline mt-1 inline-block"
                            >
                              Open bookings
                            </Link>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
