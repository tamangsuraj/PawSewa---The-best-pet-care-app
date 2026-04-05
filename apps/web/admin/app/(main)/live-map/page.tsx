'use client';

import dynamic from 'next/dynamic';

const LiveMapBoard = dynamic(
  () => import('@/components/live-map/LiveMapBoard'),
  { ssr: false, loading: () => <p className="text-gray-500 text-sm py-8">Loading map…</p> }
);

export default function AdminLiveMapPage() {
  return <LiveMapBoard />;
}
