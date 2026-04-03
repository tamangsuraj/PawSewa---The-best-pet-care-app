'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Droplets, Scissors, Hand, Ear, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { Reviews } from '@/components/Reviews';

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
      <div className="min-h-screen bg-white flex items-center justify-center text-primary">
        Loading...
      </div>
    );
  }
  if (!center) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600">Not found.</p>
        <Link href={`/care/${serviceType}`} className="text-primary font-semibold">Back to {label}</Link>
      </div>
    );
  }

  const price = center.pricePerSession ?? center.pricePerNight ?? 0;
  const isGrooming = serviceType === 'grooming';

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="sticky top-0 z-20 bg-white/95 border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href={`/care/${serviceType}`} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-primary">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-bold text-primary">{label} Details</h1>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <div className="relative aspect-[4/3] max-h-[320px] rounded-2xl overflow-hidden bg-gray-100 -mx-4 mt-2">
          {displayImages[0] && displayImages[0].trim() !== '' ? (
            <Image src={displayImages[selectedImageIndex] || displayImages[0]} alt={center.name} fill className="object-cover" sizes="100vw" priority />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl">🐾</div>
          )}
        </div>
        {displayImages.length > 1 && displayImages[0] && (
          <div className="flex gap-2 overflow-x-auto py-3 -mx-4 px-4">
            {displayImages.map((src, i) => (
              <button key={i} type="button" onClick={() => setSelectedImageIndex(i)} className={`shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 ${selectedImageIndex === i ? 'border-primary' : 'border-gray-200'}`}>
                <Image src={src} alt="" width={48} height={48} className="object-cover w-full h-full" />
              </button>
            ))}
          </div>
        )}

        <section className="mt-6">
          <h2 className="text-xl font-bold text-primary mb-2">{isGrooming ? 'Professional Spa & Hygiene' : 'About'}</h2>
          <p className="text-gray-700 leading-relaxed">
            {center.description || 'Quality care for your pet. Book a session with us.'}
          </p>
        </section>

        {isGrooming && (
          <>
            <section className="mt-8">
              <h2 className="text-lg font-bold text-primary mb-3">Included Services</h2>
              <div className="grid grid-cols-2 gap-3">
                {INCLUDED_ICONS.map(({ label: l, icon: Icon }) => (
                  <div key={l} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-gray-800">{l}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="mt-8">
              <h2 className="text-lg font-bold text-primary mb-3">Our Groomers</h2>
              <div className="flex gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 flex-1">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
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
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">From</p>
            <p className="text-xl font-bold text-primary">NPR {price.toLocaleString()} {serviceType === 'hostel' ? '/ night' : '/ session'}</p>
          </div>
          <Link href={`/care/${serviceType}/${center._id}/book`} className="flex-1 max-w-[200px] py-3 rounded-xl bg-primary text-white font-semibold text-center hover:bg-primary/90 transition-colors">
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}
