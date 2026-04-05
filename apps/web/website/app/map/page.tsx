'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

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

const DEFAULT_CENTER: [number, number] = [27.7172, 85.324];
const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function vetPin(vet: Record<string, unknown>): { lat: number; lng: number } | null {
  const live = vet['liveLocation'];
  if (live && typeof live === 'object') {
    const coords = (live as { coordinates?: { lat?: number; lng?: number } })
      .coordinates;
    if (
      coords &&
      typeof coords.lat === 'number' &&
      typeof coords.lng === 'number'
    ) {
      return { lat: coords.lat, lng: coords.lng };
    }
  }
  const addresses = vet['addresses'];
  if (Array.isArray(addresses) && addresses.length > 0) {
    const a = addresses[0] as { lat?: number; lng?: number };
    if (typeof a.lat === 'number' && typeof a.lng === 'number') {
      return { lat: a.lat, lng: a.lng };
    }
  }
  return null;
}

export default function NearbyVetsMapPage() {
  const [vets, setVets] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const base =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const resp = await axios.get<{ success?: boolean; data?: unknown[] }>(
        `${base}/vets/public`
      );
      const list = Array.isArray(resp.data?.data) ? resp.data!.data! : [];
      setVets(list.filter((v) => v && typeof v === 'object') as Record<
        string,
        unknown
      >[]);
    } catch {
      setErr('Could not load veterinarians.');
      setVets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pinned = vets
    .map((v) => {
      const p = vetPin(v);
      const id = String(v['_id'] ?? '');
      const name = String(v['name'] ?? 'Vet');
      const clinic = String(v['clinicName'] ?? v['clinicLocation'] ?? '');
      return p ? { id, name, clinic, ...p } : null;
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    clinic: string;
    lat: number;
    lng: number;
  }>;

  return (
    <PageShell>
      <PageHero
        eyebrow="PawSewa"
        title="Vet map"
        subtitle="Same OpenStreetMap stack as the mobile app. Pins use clinic and live coordinates when available; open a profile for full details."
      />

      <PageContent compact className="max-w-5xl">
        {loading ? (
          <p className="text-paw-bark/75">Loading map…</p>
        ) : err ? (
          <div className="paw-surface-card rounded-2xl p-6 text-red-800">{err}</div>
        ) : (
          <>
            <div className="paw-surface-card h-[min(560px,70vh)] overflow-hidden rounded-[1.35rem] border-paw-bark/10 p-0">
              <MapContainer
                center={DEFAULT_CENTER}
                zoom={12}
                scrollWheelZoom
                className="h-full w-full z-0"
                style={{ height: '100%', minHeight: 400 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url={OSM_TILE}
                />
                {pinned.map((v) => (
                  <CircleMarker
                    key={v.id}
                    center={[v.lat, v.lng]}
                    radius={9}
                    pathOptions={{
                      color: '#4e2410',
                      fillColor: '#703418',
                      fillOpacity: 0.9,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-sm min-w-[160px]">
                        <p className="font-semibold text-[#5c2c14]">{v.name}</p>
                        {v.clinic ? (
                          <p className="text-gray-600 text-xs mt-1">{v.clinic}</p>
                        ) : null}
                        <Link
                          href={v.id ? `/vets/${v.id}` : '/vets'}
                          className="inline-block mt-2 text-sm font-semibold text-[#0d9488] hover:underline"
                        >
                          View profile
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
            <p className="text-xs text-paw-bark/55 mt-3">
              {pinned.length} vet(s) with map coordinates ·{' '}
              <Link href="/vets" className="text-[#0d9488] font-medium hover:underline">
                Browse all vets
              </Link>
            </p>
          </>
        )}
      </PageContent>
    </PageShell>
  );
}
