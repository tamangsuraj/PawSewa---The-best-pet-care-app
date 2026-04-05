'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Stethoscope, 
  Building2, 
  Calendar,
  ArrowLeft,
  Star,
  Download
} from 'lucide-react';
import axios from 'axios';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

interface Vet {
  _id: string;
  name: string;
  email: string;
  specialization?: string;
  specialty?: string;
  clinicName?: string;
  clinicLocation?: string;
  clinicAddress?: string;
  phone?: string;
  location?: string;
  bio?: string;
  profilePicture?: string;
  workingHours?: {
    open?: string;
    close?: string;
    days?: string[];
  };
  createdAt?: string;
}

export default function VetProfileClient({ vetId }: { vetId: string }) {
  const [vet, setVet] = useState<Vet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchVet = useCallback(async () => {
    try {
      setLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.get(`${apiBase}/vets/public/${vetId}`);
      if (response.data.success) {
        setVet(response.data.data);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to load veterinarian profile');
    } finally {
      setLoading(false);
    }
  }, [vetId]);

  useEffect(() => {
    void fetchVet();
  }, [fetchVet]);

  if (loading) {
    return (
      <PageShell className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-paw-bark border-t-transparent" />
          <p className="mt-4 text-paw-bark/70">Loading profile...</p>
        </div>
      </PageShell>
    );
  }

  if (error || !vet) {
    return (
      <PageShell className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Stethoscope className="mx-auto mb-4 h-16 w-16 text-paw-bark/25" />
          <h2 className="font-display text-2xl font-semibold text-paw-ink mb-2">Profile not found</h2>
          <p className="mb-6 text-paw-bark/70">{error || 'This veterinarian profile does not exist'}</p>
          <Link href="/vets" className="paw-cta-primary inline-block">
            Back to directory
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        leading={
          <Link
            href="/vets"
            className="inline-flex items-center gap-2 text-sm font-medium text-paw-cream/90 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to directory
          </Link>
        }
        eyebrow="Veterinarian"
        title={`Dr. ${vet.name}`}
        subtitle={vet.specialty || vet.specialization || 'General practitioner'}
      />

      <PageContent>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="paw-surface-card overflow-hidden p-0">
              <div className="bg-gradient-to-br from-paw-bark via-paw-ink to-paw-teal-mid p-8 text-paw-cream">
                <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-xl">
                    {vet.profilePicture ? (
                      <Image
                        src={vet.profilePicture}
                        alt={vet.name}
                        width={128}
                        height={128}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl font-bold text-paw-bark">{vet.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-lg text-paw-cream/90">
                      {vet.specialty || vet.specialization || 'General practitioner'}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-0.5 text-amber-300 md:justify-start">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className="h-5 w-5 fill-current" />
                      ))}
                      <span className="ml-2 text-sm text-paw-cream/90">5.0 (verified)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <h2 className="font-display text-2xl font-semibold text-paw-ink">About Dr. {vet.name}</h2>
                <p className="mt-4 leading-relaxed text-paw-bark/85">
                  {vet.bio || (
                    <>
                      Dr. {vet.name} is a dedicated{' '}
                      {(vet.specialty || vet.specialization)?.toLowerCase() || 'veterinary professional'}
                      {vet.clinicName && ` practicing at ${vet.clinicName}`}
                      {(vet.clinicLocation || vet.clinicAddress) && ` in ${vet.clinicLocation || vet.clinicAddress}`}.
                      Comprehensive care including check-ups, vaccinations, diagnostics, and treatment.
                    </>
                  )}
                </p>

                <h3 className="font-display mt-8 text-xl font-semibold text-paw-ink">Specialization</h3>
                <div className="mt-3 rounded-xl border border-paw-bark/10 bg-paw-haze/60 p-4">
                  <p className="text-paw-bark/90">
                    <strong>{vet.specialty || vet.specialization || 'General veterinary medicine'}</strong>
                    <br />
                    Diagnosis, treatment, and preventive care for companion animals.
                  </p>
                </div>

                {vet.workingHours && (vet.workingHours.open || vet.workingHours.close || vet.workingHours.days) && (
                  <>
                    <h3 className="font-display mt-8 text-xl font-semibold text-paw-ink">Working hours</h3>
                    <div className="mt-3 rounded-xl border border-paw-teal-mid/20 bg-paw-teal/5 p-4 text-paw-bark/90">
                      {vet.workingHours.open && vet.workingHours.close && (
                        <p>
                          <strong className="text-paw-ink">Hours:</strong> {vet.workingHours.open} –{' '}
                          {vet.workingHours.close}
                        </p>
                      )}
                      {vet.workingHours.days && vet.workingHours.days.length > 0 && (
                        <p className="mt-1">
                          <strong className="text-paw-ink">Days:</strong> {vet.workingHours.days.join(', ')}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <h3 className="font-display mt-8 text-xl font-semibold text-paw-ink">Services offered</h3>
                <ul className="mt-3 grid grid-cols-1 gap-2 text-paw-bark/90 md:grid-cols-2">
                  {[
                    'Routine health check-ups',
                    'Vaccinations',
                    'Diagnostics',
                    'Emergency care',
                    'Surgery',
                    'Wellness consultations',
                  ].map((s) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-paw-bark" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="paw-surface-card sticky top-24 p-6">
              <h3 className="font-display text-xl font-semibold text-paw-ink">Contact</h3>

              <div className="mt-6 space-y-4">
                {vet.clinicName && (
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-1 h-5 w-5 shrink-0 text-paw-bark" />
                    <div>
                      <p className="text-xs text-paw-bark/55">Clinic</p>
                      <p className="font-medium text-paw-ink">{vet.clinicName}</p>
                    </div>
                  </div>
                )}

                {(vet.clinicLocation || vet.clinicAddress || vet.location) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 h-5 w-5 shrink-0 text-paw-bark" />
                    <div>
                      <p className="text-xs text-paw-bark/55">Location</p>
                      <p className="font-medium text-paw-ink">
                        {vet.clinicAddress || vet.clinicLocation || vet.location}
                      </p>
                    </div>
                  </div>
                )}

                {vet.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-1 h-5 w-5 shrink-0 text-paw-bark" />
                    <div>
                      <p className="text-xs text-paw-bark/55">Phone</p>
                      <a href={`tel:${vet.phone}`} className="font-medium text-paw-ink hover:text-paw-bark">
                        {vet.phone}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-5 w-5 shrink-0 text-paw-bark" />
                  <div>
                    <p className="text-xs text-paw-bark/55">Email</p>
                    <a
                      href={`mailto:${vet.email}`}
                      className="break-all font-medium text-paw-ink hover:text-paw-bark"
                    >
                      {vet.email}
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  className="paw-cta-primary flex w-full items-center justify-center gap-2"
                >
                  <Calendar className="h-5 w-5" />
                  Book appointment
                </button>

                <a
                  href="https://play.google.com/store"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="paw-cta-secondary flex w-full items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download PawSewa app
                </a>
              </div>

              <p className="mt-6 rounded-xl border border-paw-bark/10 bg-paw-haze/50 p-4 text-center text-sm text-paw-bark/75">
                Use the mobile app for bookings and health tracking on the go.
              </p>
            </div>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
