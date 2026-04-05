'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search } from 'lucide-react';
import clsx from 'clsx';

const KTM_LAT = 27.7172;
const KTM_LNG = 85.324;

function fixLeafletDefaultIcons() {
  const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function MapViewSync({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef({ lat: KTM_LAT, lng: KTM_LNG });
  useEffect(() => {
    const delta = Math.abs(prev.current.lat - lat) + Math.abs(prev.current.lng - lng);
    prev.current = { lat, lng };
    if (delta > 0.002) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export type GeocodeHit = { lat: number; lon: number; displayName: string };

type Props = {
  lat: number;
  lng: number;
  address: string | null;
  loadingAddress: boolean;
  onLatLng: (lat: number, lng: number) => void;
  onAddress: (addr: string | null) => void;
  onLoadingAddress: (v: boolean) => void;
  className?: string;
};

export function DeliveryMapSection({
  lat,
  lng,
  address,
  loadingAddress,
  onLatLng,
  onAddress,
  onLoadingAddress,
  className,
}: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    fixLeafletDefaultIcons();
    return () => {
      mounted.current = false;
    };
  }, []);

  const runReverse = useCallback(
    async (la: number, ln: number) => {
      onLoadingAddress(true);
      onAddress(null);
      try {
        const res = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}`
        );
        const data = (await res.json()) as { address?: string | null };
        const a = typeof data.address === 'string' && data.address.trim() ? data.address.trim() : null;
        if (mounted.current) {
          onAddress(a);
        }
      } catch {
        if (mounted.current) onAddress(null);
      } finally {
        if (mounted.current) onLoadingAddress(false);
      }
    },
    [onAddress, onLoadingAddress]
  );

  useEffect(() => {
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => {
      void runReverse(lat, lng);
    }, 450);
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, [lat, lng, runReverse]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results?: GeocodeHit[] };
        const raw = data.results ?? [];
        const mapped: GeocodeHit[] = raw.map((r) => ({
          lat: r.lat,
          lon: r.lon,
          displayName: r.displayName,
        }));
        if (mounted.current) setSuggestions(mapped);
      } catch {
        if (mounted.current) setSuggestions([]);
      } finally {
        if (mounted.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const pickSuggestion = (hit: GeocodeHit) => {
    onLatLng(hit.lat, hit.lon);
    onAddress(hit.displayName);
    onLoadingAddress(false);
    setSuggestions([]);
    setQuery('');
  };

  return (
    <div className={clsx('space-y-3', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#703418]/50" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search e.g. Putalisadak, Kathmandu"
          className="w-full rounded-xl border-2 border-transparent bg-[#f3ebe2]/80 py-3 pl-10 pr-10 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-[#703418]/40 focus:border-[#703418] focus:ring-2 focus:ring-[#703418]/25"
          autoComplete="off"
        />
        {searching ? (
          <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-pulse rounded-full bg-[#703418]/30" />
        ) : null}
        {suggestions.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-48 overflow-auto rounded-xl border border-[#703418]/15 bg-white py-1 shadow-lg">
            {suggestions.map((s) => (
              <li key={`${s.lat}-${s.lon}-${s.displayName.slice(0, 24)}`}>
                <button
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-[#2c241c] hover:bg-[#faf6f0]"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#703418]" />
                  <span className="line-clamp-2">{s.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-[#703418]/15 shadow-sm">
        <MapContainer
          center={[lat, lng]}
          zoom={14}
          className="h-[min(52vh,320px)] w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
            subdomains={['a', 'b', 'c', 'd']}
          />
          <MapViewSync lat={lat} lng={lng} />
          <MapClickHandler onPick={onLatLng} />
          <Marker
            position={[lat, lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                onLatLng(p.lat, p.lng);
              },
            }}
          />
        </MapContainer>
      </div>

      <p className="text-xs leading-relaxed text-[#2c241c]/80">
        {loadingAddress ? (
          <span className="text-[#703418]">Fetching address…</span>
        ) : address ? (
          address
        ) : (
          <span className="text-[#703418]/70">Tap the map or drag the pin — we&apos;ll resolve the address.</span>
        )}
      </p>
    </div>
  );
}
