'use client';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { MapCenterSync } from '@/components/MapCenterSync';

interface ServiceRequestMapProps {
  center: [number, number];
  onCenterChange: (lat: number, lng: number) => void;
  confirmedLatLng: [number, number] | null;
}

export function ServiceRequestMap({
  center,
  onCenterChange,
  confirmedLatLng,
}: ServiceRequestMapProps) {
  const props = {
    center,
    zoom: 13,
    scrollWheelZoom: true,
    className: 'h-full w-full',
  };
  return (
    <MapContainer {...props}>
      <MapCenterSync onCenterChange={onCenterChange} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {confirmedLatLng && <Marker position={confirmedLatLng} />}
    </MapContainer>
  );
}
