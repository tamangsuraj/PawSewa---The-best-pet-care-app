'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

/** Kamalpokhari, Kathmandu — same tile source pattern as the customer Flutter app (OpenStreetMap). */
const KAMALPOKHARI: [number, number] = [27.71685, 85.32375];

const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

export function ClinicMapCard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    fixLeafletIcons();
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative h-[280px] md:h-[320px] rounded-2xl overflow-hidden border border-[#703418]/15 bg-[#ebe3d6] animate-pulse" />
    );
  }

  return (
    <div className="relative h-[280px] md:h-[320px] rounded-2xl overflow-hidden border border-[#703418]/15 shadow-[0_20px_50px_rgba(112,52,24,0.12)] bg-[#f3ebe2]">
      <div className="absolute top-4 left-4 z-[500] pointer-events-none max-w-[min(100%,220px)]">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[#703418]/70 uppercase">
          PawSewa
        </p>
        <p className="text-sm font-medium text-[#5c2c14] mt-1">Kamalpokhari area</p>
      </div>
      <MapContainer
        center={KAMALPOKHARI}
        zoom={15}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
        style={{ height: '100%', width: '100%', minHeight: 280 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={OSM_TILE}
        />
        <Marker position={KAMALPOKHARI}>
          <Popup>
            <span className="text-sm font-medium">Kamalpokhari</span>
            <br />
            <span className="text-xs text-gray-600">
              {KAMALPOKHARI[0].toFixed(5)}, {KAMALPOKHARI[1].toFixed(5)}
            </span>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
