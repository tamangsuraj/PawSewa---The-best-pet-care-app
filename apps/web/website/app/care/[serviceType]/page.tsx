'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, MapPin, Star } from 'lucide-react';
import api from '@/lib/api';
import { PageShell } from '@/components/layout/PageShell';

const SERVICE_LABELS: Record<string, string> = {
  hostel: 'Hostel',
  grooming: 'Grooming',
  spa: 'Spa',
  wash: 'Wash',
  training: 'Training',
};

interface Facility {
  _id: string;
  name: string;
  description?: string;
  location?: { address: string };
  pricePerSession?: number;
  pricePerNight?: number;
  images?: string[];
  rating?: number;
  reviewCount?: number;
}

export default function CareDiscoveryPage({ params }: { params: { serviceType: string } }) {
  const type = String(params.serviceType || '').toLowerCase();
  const label = SERVICE_LABELS[type] || type;
  const [list, setList] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const serviceType = type === 'hostel' ? 'Hostel' : type.charAt(0).toUpperCase() + type.slice(1);
    const fetchList = async () => {
      try {
        const res = await api.get('/hostels', { params: { serviceType } });
        if (res.data?.success && Array.isArray(res.data.data)) setList(res.data.data);
      } catch (e) {
        console.error('Failed to fetch', e);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [type]);

  return (
    <PageShell>
      <header className="sticky top-0 z-10 border-b border-paw-bark/10 bg-paw-cream/85 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 -ml-2 rounded-xl hover:bg-paw-sand/80 text-paw-bark transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-paw-bark/50">Care</p>
            <h1 className="font-display text-xl font-semibold text-paw-ink">{label}</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12 text-paw-bark">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p className="mb-4">No {label.toLowerCase()} listings yet.</p>
            <Link href="/" className="text-paw-bark font-semibold">Back to home</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {list.map((item) => (
              <Link key={item._id} href={`/care/${type}/${item._id}`}>
                <article className="rounded-2xl overflow-hidden border border-paw-bark/10 bg-white/90 shadow-paw hover:shadow-paw-lg transition-all">
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {item.images?.[0] ? (
                      <Image src={item.images[0]} alt={item.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 600px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">🐾</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold text-paw-bark text-lg mb-1">{item.name}</h2>
                    {item.location?.address && (
                      <p className="flex items-center gap-1 text-gray-600 text-sm mb-2">
                        <MapPin className="w-4 h-4 text-paw-bark shrink-0" />
                        {item.location.address}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium text-gray-700">
                          {(item.rating ?? 0).toFixed(1)} ({(item.reviewCount ?? 0)} reviews)
                        </span>
                      </div>
                      <span className="font-bold text-paw-bark">
                        NPR {(item.pricePerSession ?? item.pricePerNight ?? 0).toLocaleString()}
                        {type === 'hostel' ? ' / night' : ' / session'}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </PageShell>
  );
}
