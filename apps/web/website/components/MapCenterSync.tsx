'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export function MapCenterSync({
  onCenterChange,
}: {
  onCenterChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const handler = () => {
      const c = map.getCenter();
      onCenterChange(c.lat, c.lng);
    };
    map.on('moveend', handler);
    return () => {
      map.off('moveend', handler);
    };
  }, [map, onCenterChange]);

  return null;
}
