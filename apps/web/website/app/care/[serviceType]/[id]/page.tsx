'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Droplets, Scissors, Hand, Ear, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { Reviews } from '@/components/Reviews';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';

const SERVICE_LABELS: Record<string, string> = {
  hostel: 'Hostel',
  grooming: 'Grooming',
  spa: 'Spa',
  wash: 'Wash',
  training: 'Training',
};

const INCLUDED_ICONS = [
  { label: 'Bath & Blow Dry', icon: Droplets },
  { label: 'Full Haircut', icon: Scissors },
  { label: 'Nail Trimming', icon: Hand },
  { label: 'Ear Cleaning', icon: Ear },
  { label: 'Sanitary Trim', icon: Sparkles },
];

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
  amenities?: string[];
  ownerId?: { name?: string };
}

export default function CareDetailPage({ params }: { params: { serviceType: string; id: string } }) {
  const serviceType = String(params.serviceType || '').toLowerCase();
  const label = SERVICE_LABELS[serviceType] || serviceType;
  const [center, setCenter] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const fetchCenter = async () => {
      try {
        const res = await api.get(`/hostels/${params.id}`);
        if (res.data?.success) setCenter(res.data.data);
      } catch (e) {
        console.error('Failed to fetch', e);
      } finally {
        setLoading(false);
      }
    };
    fetchCenter();
  }, [params.id]);

  const images = center?.images?.length ? center.images : [];
  const displayImages = images.length ? images : [''];

  if (loading) {
    return (
      <PageShell className="flex min-h-screen items-center justify-center">
        <p className="text-paw-bark">Loading...</p>
      </PageShell>
    );
  }
  if (!center) {
    return (
      <PageShell className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-paw-bark/75">Not found.</p>
        <Link href={`/care/${serviceType}`} className="text-paw-teal-mid font-semibold hover:underline">
          Back to {label}
        </Link>
      </PageShell>
    );
  }

  const price = center.pricePerSession ?? center.pricePerNight ?? 0;
  const isGrooming = serviceType === 'grooming';

  return (
    <PageShell>
    <div className="pb-24">
      <header className="sticky top-0 z-20 border-b border-paw-bark/10 bg-paw-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href={`/care/${serviceType}`}
            className="p-2 -ml-2 rounded-xl hover:bg-paw-sand/80 text-paw-bark transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-semibold text-paw-ink font-display">{label} details</h1>
        </div>
      </header>

      <main>
        <PageContent compact className="pb-28">
        <div className="relative mt-2 aspect-[4/3] max-h-[320px] overflow-hidden rounded-[1.35rem] border border-paw-bark/10 bg-paw-haze/50">
          {displayImages[0] && displayImages[0].trim() !== '' ? (
            <Image src={displayImages[selectedImageIndex] || displayImages[0]} alt={center.name} fill className="object-cover" sizes="100vw" priority />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl">🐾</div>
          )}
        </div>
        {displayImages.length > 1 && displayImages[0] && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-3">
            {displayImages.map((src, i) => (
              <button key={i} type="button" onClick={() => setSelectedImageIndex(i)} className={`shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 ${selectedImageIndex === i ? 'border-paw-bark' : 'border-gray-200'}`}>
                <Image src={src} alt="" width={48} height={48} className="object-cover w-full h-full" />
              </button>
            ))}
          </div>
        )}

        <section className="paw-surface-card mt-6 p-5 md:p-6">
          <h2 className="font-display text-xl font-semibold text-paw-ink mb-2">
            {isGrooming ? 'Professional Spa & Hygiene' : 'About'}
          </h2>
          <p className="text-paw-bark/85 leading-relaxed">
            {center.description || 'Quality care for your pet. Book a session with us.'}
          </p>
        </section>

        {isGrooming && (
          <>
            <section className="mt-8">
              <h2 className="text-lg font-bold text-paw-bark mb-3">Included Services</h2>
              <div className="grid grid-cols-2 gap-3">
                {INCLUDED_ICONS.map(({ label: l, icon: Icon }) => (
                  <div key={l} className="flex items-center gap-3 rounded-xl border border-paw-bark/10 bg-paw-haze/50 p-3">
                    <div className="w-10 h-10 rounded-lg bg-paw-bark/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-paw-bark" />
                    </div>
                    <span className="text-sm font-medium text-gray-800">{l}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="mt-8">
              <h2 className="text-lg font-bold text-paw-bark mb-3">Our Groomers</h2>
              <div className="flex gap-4">
                <div className="flex flex-1 items-center gap-3 rounded-xl border border-paw-bark/10 bg-paw-haze/50 p-4">
                  <div className="w-12 h-12 rounded-full bg-paw-bark/20 flex items-center justify-center text-paw-bark font-bold">
                    {(center.ownerId as { name?: string })?.name?.charAt(0) ?? 'A'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{(center.ownerId as { name?: string })?.name ?? 'Lead Groomer'}</p>
                    <p className="text-sm text-gray-600">Experienced</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        <Reviews
          targetType="hostel"
          targetId={center._id}
          averageRating={center.rating}
          reviewCount={center.reviewCount}
          title="Ratings & Reviews"
        />
        </PageContent>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-paw-bark/10 bg-paw-cream/95 backdrop-blur-md p-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div>
            <p className="text-sm text-paw-bark/65">From</p>
            <p className="text-xl font-bold text-paw-bark">
              Rs. {price.toLocaleString()} {serviceType === 'hostel' ? '/ night' : '/ session'}
            </p>
          </div>
          <Link
            href={`/care/${serviceType}/${center._id}/book`}
            className="paw-cta-primary max-w-[220px] flex-1 text-center"
          >
            Book now
          </Link>
        </div>
      </div>
    </div>
    </PageShell>
  );
}
