'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

/** Dhankuta — precise pin for “Verified Clinics Nearby” */
const DHANKUTA: [number, number] = [26.98345, 87.32118];

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
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  return (
    <div className="relative h-[280px] md:h-[320px] rounded-2xl overflow-hidden border border-[#4B3621]/15 shadow-[0_20px_50px_rgba(75,54,33,0.12)] bg-[#1a1512]">
      <div className="absolute top-4 left-4 z-[500] pointer-events-none">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
          SAFE WORK WORK
        </p>
        <p className="text-sm font-medium text-white/90 mt-1">Interactive Map</p>
      </div>
      <MapContainer
        center={DHANKUTA}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full z-0 grayscale contrast-125 brightness-90"
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <Marker position={DHANKUTA}>
          <Popup>
            <span className="text-sm font-medium">Dhankuta</span>
            <br />
            <span className="text-xs text-gray-600">
              {DHANKUTA[0].toFixed(5)}, {DHANKUTA[1].toFixed(5)}
            </span>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
