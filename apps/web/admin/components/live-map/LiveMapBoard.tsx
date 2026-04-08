'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { PawSewaLoader } from '@/components/PawSewaLoader';
import { MapPin, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_CENTER: [number, number] = [27.7172, 85.324];
const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function makeLabelIcon(label: string, variant: string): L.DivIcon {
  return L.divIcon({
    className: 'lm-div-icon-root',
    html: `<div class="lm-emoji lm-emoji--${variant}" aria-hidden="true">${label}</div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -22],
  });
}

const ICONS = {
  rider: makeLabelIcon('R', 'rider'),
  vet: makeLabelIcon('V', 'vet'),
  shop: makeLabelIcon('S', 'shop'),
  careCenter: makeLabelIcon('C', 'carecenter'),
  sos: makeLabelIcon('SR', 'sos'),
  carePlus: makeLabelIcon('C+', 'careplus'),
  delivery: makeLabelIcon('D', 'delivery'),
  booking: makeLabelIcon('B', 'booking'),
  staffOther: makeLabelIcon('U', 'staffother'),
};

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
  liveGps?: boolean;
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
  liveGps?: boolean;
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

export interface LiveLocationPin {
  _id: string;
  key?: string;
  category: string;
  name: string;
  status?: string;
  isDynamic?: boolean;
  detailPath?: string;
  coordinates: { lat: number; lng: number };
}

interface LiveMapData {
  staff: StaffRow[];
  requests: RequestRow[];
  careRequests: CareRow[];
  orders: OrderPin[];
  careBookings?: CareBookingPin[];
  liveLocations?: LiveLocationPin[];
}

function statusLabel(s?: string) {
  if (!s) return 'Active';
  const x = s.toLowerCase();
  if (x === 'busy') return 'Busy';
  return 'Active';
}

function AnimatedMarker(props: {
  position: [number, number];
  icon: L.DivIcon;
  children: ReactNode;
}) {
  const { position: target, icon, children } = props;
  const [pos, setPos] = useState<[number, number]>(() => [...target] as [number, number]);
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    const from = posRef.current;
    const to = target;
    if (Math.abs(from[0] - to[0]) < 1e-9 && Math.abs(from[1] - to[1]) < 1e-9) {
      return undefined;
    }
    const start = performance.now();
    const duration = 750;
    let raf = 0;
    const easeOut = (t: number) => t * (2 - t);
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / duration);
      const e = easeOut(u);
      setPos([
        from[0] + (to[0] - from[0]) * e,
        from[1] + (to[1] - from[1]) * e,
      ]);
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target[0], target[1]]);

  return (
    <Marker position={pos} icon={icon}>
      {children}
    </Marker>
  );
}

function MapFlyTo({
  nonce,
  query,
  points,
}: {
  nonce: number;
  query: string;
  points: { label: string; pos: [number, number] }[];
}) {
  const map = useMap();
  useEffect(() => {
    if (!nonce || !query.trim()) return;
    const q = query.trim().toLowerCase();
    const hits = points.filter((p) => p.label.toLowerCase().includes(q));
    if (hits.length >= 1) {
      map.flyTo(hits[0].pos, hits.length === 1 ? 15 : 13, { duration: 0.8 });
    }
  }, [nonce, query, points, map]);
  return null;
}

export default function LiveMapBoard() {
  const [data, setData] = useState<LiveMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [flyNonce, setFlyNonce] = useState(0);
  const [dynamicLive, setDynamicLive] = useState<
    Record<string, { lat: number; lng: number }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const resp = await api.get<{ success: boolean; data?: LiveMapData }>(
        '/admin/live-map'
      );
      if (resp.data?.success && resp.data.data) {
        setData(resp.data.data);
        const next: Record<string, { lat: number; lng: number }> = {};
        for (const p of resp.data.data.liveLocations ?? []) {
          if (p.isDynamic && p._id) {
            next[p._id] = {
              lat: p.coordinates.lat,
              lng: p.coordinates.lng,
            };
          }
        }
        setDynamicLive(next);
      } else {
        setErr('Invalid response');
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      const base =
        ax.response?.data?.message ||
        ax.message ||
        'Failed to load live map';
      const apiUrl = String(process.env.NEXT_PUBLIC_API_URL || '').trim();
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const tunnelBrowse = host.includes('ngrok') || host.includes('vercel.app');
      const apiPointsLocal = !apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');
      const hint =
        tunnelBrowse && apiPointsLocal
          ? ' If you opened the admin via a public URL, set NEXT_PUBLIC_API_URL in apps/web/admin/.env.local to that same backend (ngrok or deployed API + /api/v1) and restart npm run dev.'
          : !apiUrl
            ? ' Set NEXT_PUBLIC_API_URL in apps/web/admin/.env.local (e.g. http://localhost:3000/api/v1 or your ngrok URL).'
            : '';
      const msg = `${base}${hint}`;
      setErr(msg);
      toast.error(msg, { duration: 9000 });
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
    const bump = () => void load();
    const onTick = (payload: {
      updates?: { id: string; lat: number; lng: number }[];
    }) => {
      const u = payload?.updates;
      if (!Array.isArray(u) || !u.length) return;
      setDynamicLive((prev) => {
        const n = { ...prev };
        for (const row of u) {
          n[row.id] = { lat: row.lat, lng: row.lng };
        }
        return n;
      });
    };
    socket.on('orderUpdate', bump);
    socket.on('new:order', bump);
    socket.on('order:paid', bump);
    socket.on('order:assigned_seller', bump);
    socket.on('order:assigned_rider', bump);
    socket.on('care_booking:update', bump);
    socket.on('care_booking:new', bump);
    socket.on('staff:location', bump);
    socket.on('live_map:tick', onTick);
    return () => {
      socket.off('orderUpdate', bump);
      socket.off('new:order', bump);
      socket.off('order:paid', bump);
      socket.off('order:assigned_seller', bump);
      socket.off('order:assigned_rider', bump);
      socket.off('care_booking:update', bump);
      socket.off('care_booking:new', bump);
      socket.off('staff:location', bump);
      socket.off('live_map:tick', onTick);
    };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load(), 45000);
    return () => clearInterval(t);
  }, [load]);

  const q = search.trim().toLowerCase();
  const matches = useCallback(
    (name?: string) => !q || (name || '').toLowerCase().includes(q),
    [q]
  );

  const flyPoints = useMemo(() => {
    if (!data) return [];
    const pts: { label: string; pos: [number, number] }[] = [];
    for (const s of data.staff ?? []) {
      const lat = s.coordinates?.lat;
      const lng = s.coordinates?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        pts.push({ label: s.name || 'Staff', pos: [lat, lng] });
      }
    }
    for (const r of data.requests ?? []) {
      const lat = r.coordinates?.lat;
      const lng = r.coordinates?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        pts.push({
          label: `Service ${r.serviceType || 'request'}`,
          pos: [lat, lng],
        });
      }
    }
    for (const c of data.careRequests ?? []) {
      const lat = c.coordinates?.lat;
      const lng = c.coordinates?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        pts.push({
          label: `Care+ ${c.serviceType || ''}`,
          pos: [lat, lng],
        });
      }
    }
    for (const b of data.careBookings ?? []) {
      const lat = b.coordinates?.lat;
      const lng = b.coordinates?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        pts.push({
          label: b.hostelName || 'Care booking',
          pos: [lat, lng],
        });
      }
    }
    for (const p of data.liveLocations ?? []) {
      const d = dynamicLive[p._id];
      const lat = d?.lat ?? p.coordinates.lat;
      const lng = d?.lng ?? p.coordinates.lng;
      pts.push({ label: p.name, pos: [lat, lng] });
    }
    return pts;
  }, [data, dynamicLive]);

  const staff = (data?.staff ?? []).filter(
    (s) => matches(s.name) || matches(s.role) || matches(s.phone)
  );
  const requests = (data?.requests ?? []).filter(
    (r) =>
      matches(r.serviceType) ||
      matches(r.status) ||
      matches(`service ${r.serviceType}`)
  );
  const care = (data?.careRequests ?? []).filter(
    (c) =>
      matches(c.serviceType) ||
      matches(c.status) ||
      matches('care')
  );
  const orders = (data?.orders ?? []).filter(
    (o) => matches(o.status) || matches(o.assignmentStatus) || matches('delivery')
  );
  const careBookings = (data?.careBookings ?? []).filter(
    (b) =>
      matches(b.hostelName) ||
      matches(b.serviceType) ||
      matches(b.status)
  );
  const liveLocs = (data?.liveLocations ?? []).filter((p) => matches(p.name));

  const staffIcon = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'rider') return ICONS.rider;
    if (r === 'veterinarian' || r === 'vet') return ICONS.vet;
    if (r === 'shop_owner') return ICONS.shop;
    if (r === 'care_service') return ICONS.careCenter;
    return ICONS.staffOther;
  };

  const animateStaff = (role?: string) => {
    const r = (role || '').toLowerCase();
    return r === 'rider' || r === 'veterinarian' || r === 'vet';
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-8 h-8 text-primary" />
            Dynamic live operations map
          </h1>
          <p className="text-gray-600 mt-1 max-w-2xl">
            Kathmandu valley — real-time fleet simulation, venues, and active
            requests. Reference layout: operational legend, custom markers, and
            socket-driven updates for simulated riders and vets.
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

      <div className="flex flex-col gap-4 mb-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white/90 backdrop-blur-sm shadow-sm px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="lm-legend lm-legend--rider">R Rider</span>
            <span className="lm-legend lm-legend--vet">V Vet</span>
            <span className="lm-legend lm-legend--sos">SR Service req.</span>
            <span className="lm-legend lm-legend--careplus">C+ Care+ req.</span>
            <span className="lm-legend lm-legend--delivery">D Delivery</span>
            <span className="lm-legend lm-legend--booking">B Care booking</span>
            <span className="lm-legend lm-legend--shop">S Shop</span>
            <span className="lm-legend lm-legend--carecenter">C Care centre</span>
          </div>
          <p className="text-[11px] text-gray-500 max-w-md">
            Customer home addresses are never shown — only dispatch, venue, and
            service-point coordinates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 min-w-[200px] max-w-md items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setFlyNonce((n) => n + 1);
              }}
              placeholder="Search rider, vet, shop, care centre…"
              className="flex-1 min-w-0 text-sm outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
              aria-label="Search map entities"
            />
            <button
              type="button"
              onClick={() => setFlyNonce((n) => n + 1)}
              className="text-xs font-semibold text-primary hover:underline shrink-0"
            >
              Find on map
            </button>
          </div>
        </div>
      </div>

      {err && !data ? (
        <p className="text-red-600">{err}</p>
      ) : (
        <div className="relative rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white h-[min(720px,calc(100vh-14rem))]">
          {loading && !data ? (
            <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-3 bg-white/80 text-gray-600 text-sm">
              <PawSewaLoader width={140} />
              <span>Loading map…</span>
            </div>
          ) : null}
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={12}
            scrollWheelZoom
            className="h-full w-full z-0"
            style={{ height: '100%', minHeight: 480 }}
          >
            <MapFlyTo nonce={flyNonce} query={search} points={flyPoints} />
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
              const ic = staffIcon(s.role);
              const pop = (
                <Popup>
                  <div className="text-sm min-w-[160px]">
                    <p className="font-semibold">{s.name ?? 'Staff'}</p>
                    <p className="text-gray-600 text-xs">Status: Active</p>
                    <p className="text-gray-500 text-xs">{s.role ?? '—'}</p>
                    {s.phone ? (
                      <p className="text-gray-500 text-xs">{s.phone}</p>
                    ) : null}
                    <Link
                      href={
                        s.role === 'rider'
                          ? '/riders'
                          : s.role === 'shop_owner'
                            ? '/shops'
                            : '/veterinarians'
                      }
                      className="text-primary text-xs font-semibold underline mt-2 inline-block"
                    >
                      View details
                    </Link>
                  </div>
                </Popup>
              );
              if (animateStaff(s.role)) {
                return (
                  <AnimatedMarker
                    key={`st-${s._id}`}
                    position={[lat, lng]}
                    icon={ic}
                  >
                    {pop}
                  </AnimatedMarker>
                );
              }
              return (
                <Marker key={`st-${s._id}`} position={[lat, lng]} icon={ic}>
                  {pop}
                </Marker>
              );
            })}

            {requests.map((r) => {
              const c = r.coordinates;
              if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') {
                return null;
              }
              return (
                <Marker
                  key={`rq-${r._id}`}
                  position={[c.lat, c.lng]}
                  icon={ICONS.sos}
                >
                  <Popup>
                    <div className="text-sm max-w-[200px]">
                      <p className="font-semibold">Service request</p>
                      {r.liveGps ? (
                        <p className="text-primary text-xs font-semibold">
                          Live GPS pin
                        </p>
                      ) : null}
                      <p>{r.serviceType ?? '—'}</p>
                      <p className="text-gray-600 text-xs">
                        {statusLabel(r.status)}
                      </p>
                      <Link
                        href="/service-requests"
                        className="text-primary text-xs font-semibold underline mt-2 inline-block"
                      >
                        View details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {care.map((cr) => {
              const p = cr.coordinates;
              if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
                return null;
              }
              return (
                <Marker
                  key={`cr-${cr._id}`}
                  position={[p.lat, p.lng]}
                  icon={ICONS.carePlus}
                >
                  <Popup>
                    <div className="text-sm max-w-[200px]">
                      <p className="font-semibold">Care+ request</p>
                      <p>{cr.serviceType ?? '—'}</p>
                      <p className="text-gray-600 text-xs">
                        {statusLabel(cr.status)}
                      </p>
                      <Link
                        href="/care/pending-approvals"
                        className="text-primary text-xs font-semibold underline mt-2 inline-block"
                      >
                        View details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {orders.map((o) => {
              const p = o.coordinates;
              if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
                return null;
              }
              return (
                <Marker
                  key={`ord-${o._id}`}
                  position={[p.lat, p.lng]}
                  icon={ICONS.delivery}
                >
                  <Popup>
                    <div className="text-sm max-w-[200px]">
                      <p className="font-semibold">Product delivery</p>
                      {o.liveGps ? (
                        <p className="text-primary text-xs font-semibold">
                          Live GPS pin
                        </p>
                      ) : null}
                      <p className="text-gray-600 text-xs">
                        {statusLabel(o.status)}
                      </p>
                      {o.assignmentStatus ? (
                        <p className="text-gray-500 text-xs">
                          {o.assignmentStatus.replace(/_/g, ' ')}
                        </p>
                      ) : null}
                      <Link
                        href="/supplies"
                        className="text-primary text-xs font-semibold underline mt-2 inline-block"
                      >
                        View details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {careBookings.map((b) => {
              const p = b.coordinates;
              if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
                return null;
              }
              return (
                <Marker
                  key={`cb-${b._id}`}
                  position={[p.lat, p.lng]}
                  icon={ICONS.booking}
                >
                  <Popup>
                    <div className="text-sm max-w-[220px]">
                      <p className="font-semibold">Care booking</p>
                      <p>{b.hostelName ?? 'Facility'}</p>
                      <p className="text-gray-600 text-xs">
                        {b.serviceType ?? '—'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {statusLabel(b.status)}
                      </p>
                      {b.assignedPartner?.name ? (
                        <p className="text-primary text-xs mt-1">
                          Partner: {b.assignedPartner.name}
                        </p>
                      ) : null}
                      <Link
                        href="/care/bookings"
                        className="text-primary text-xs font-semibold underline mt-2 inline-block"
                      >
                        View details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {liveLocs.map((p) => {
              const dyn = dynamicLive[p._id];
              const lat = dyn?.lat ?? p.coordinates.lat;
              const lng = dyn?.lng ?? p.coordinates.lng;
              let icon = ICONS.shop;
              if (p.category === 'care_center') icon = ICONS.careCenter;
              else if (p.category === 'sim_rider') icon = ICONS.rider;
              else if (p.category === 'sim_vet') icon = ICONS.vet;

              const pop = (
                <Popup>
                  <div className="text-sm min-w-[170px]">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-gray-600 text-xs capitalize">
                      {p.status === 'busy' ? 'Busy' : 'Active'}
                    </p>
                    <Link
                      href={p.detailPath || '/'}
                      className="text-primary text-xs font-semibold underline mt-2 inline-block"
                    >
                      View details
                    </Link>
                  </div>
                </Popup>
              );

              if (p.isDynamic) {
                return (
                  <AnimatedMarker
                    key={`lv-${p._id}`}
                    position={[lat, lng]}
                    icon={icon}
                  >
                    {pop}
                  </AnimatedMarker>
                );
              }
              return (
                <Marker key={`lv-${p._id}`} position={[lat, lng]} icon={icon}>
                  {pop}
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </>
  );
}
