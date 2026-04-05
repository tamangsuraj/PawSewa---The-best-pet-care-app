'use client';

import { useEffect, useMemo, useState } from 'react';
import nextDynamic from 'next/dynamic';
import api from '@/lib/api';
import { AlertCircle, MapPin, Stethoscope, PawPrint } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

const KathmanduBounds = {
  minLat: 27.55,
  maxLat: 27.82,
  minLng: 85.18,
  maxLng: 85.55,
};

const DEFAULT_CENTER: [number, number] = [27.7, 85.32];

export const dynamic = 'force-dynamic';

// Dynamically import map to avoid Leaflet SSR issues
const DynamicServiceRequestMap = nextDynamic(
  () =>
    import('@/components/ServiceRequestMap').then(
      (m) => m.ServiceRequestMap,
    ),
  { ssr: false },
);

interface Pet {
  _id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  photoUrl?: string;
}

const SERVICE_TYPE_OPTIONS = ['Appointment', 'Health Checkup', 'Vaccination'] as const;

const TIME_WINDOW_OPTIONS = [
  'Morning (9am-12pm)',
  'Afternoon (12pm-4pm)',
  'Evening (4pm-8pm)',
] as const;

export default function ServiceRequestPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [selectedPetId, setSelectedPetId] = useState('');
  const [serviceType, setServiceType] = useState<'Appointment' | 'Health Checkup' | 'Vaccination' | ''>('');
  const [preferredDate, setPreferredDate] = useState('');
  const [timeWindow, setTimeWindow] = useState<'Morning (9am-12pm)' | 'Afternoon (12pm-4pm)' | 'Evening (4pm-8pm)' | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash_on_delivery'>('online');
  const [notes, setNotes] = useState('');

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [confirmedLatLng, setConfirmedLatLng] = useState<[number, number] | null>(null);
  const [confirmedAddress, setConfirmedAddress] = useState('');
  const [geoWarning, setGeoWarning] = useState('');

  const isInsideKathmandu = useMemo(() => {
    const [lat, lng] = confirmedLatLng ?? center;
    return (
      lat >= KathmanduBounds.minLat &&
      lat <= KathmanduBounds.maxLat &&
      lng >= KathmanduBounds.minLng &&
      lng <= KathmanduBounds.maxLng
    );
  }, [center, confirmedLatLng]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchMyPets();
  }, []);

  const fetchMyPets = async () => {
    try {
      if (!localStorage.getItem('token')) {
        window.location.href = '/login';
        return;
      }
      const response = await api.get('/pets/my-pets');
      if (response.data.success) {
        setPets(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching pets:', err);
      setError('Failed to load pets');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLocation = async () => {
    setError('');
    const [lat, lng] = center;

    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'PawSewa Web App (pawsewa.app)' },
      });
      const data = await response.json();
      const address = data.display_name as string | undefined;
      setConfirmedLatLng([lat, lng]);
      setConfirmedAddress(address ?? '');

      if (!isInsideKathmandu) {
        setGeoWarning('Service restricted to Kathmandu Valley. Please choose a location inside the highlighted area.');
      } else {
        setGeoWarning('');
      }
    } catch (err) {
      console.error('Error reverse geocoding:', err);
      setError('Failed to fetch address for selected location. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPetId || !serviceType || !preferredDate || !timeWindow) {
      setError('Please complete all required fields.');
      return;
    }

    if (!confirmedLatLng || !confirmedAddress) {
      setError('Please confirm your location on the map.');
      return;
    }

    if (!isInsideKathmandu) {
      setError('Service is restricted to Kathmandu Valley.');
      return;
    }

    setSubmitting(true);

    try {
      const [lat, lng] = confirmedLatLng;
      const response = await api.post('/service-requests', {
        petId: selectedPetId,
        serviceType,
        preferredDate,
        timeWindow,
        paymentMethod,
        notes: notes.trim() || undefined,
        location: {
          address: confirmedAddress,
          coordinates: { lat, lng },
        },
      });

      if (response.data.success) {
        alert('✅ Request submitted! You can see it in My Appointments.');
        window.location.href = '/my-service-requests';
      }
    } catch (err: unknown) {
      console.error('Error submitting service request:', err);
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell className="flex min-h-screen items-center justify-center">
        <p className="text-paw-bark text-xl">Loading...</p>
      </PageShell>
    );
  }

  if (pets.length === 0) {
    return (
      <PageShell className="flex min-h-screen items-center justify-center p-6">
        <div className="paw-surface-card w-full max-w-xl p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-paw-sand text-paw-bark">
            <PawPrint className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="font-display text-3xl font-semibold text-paw-ink mb-2">No pets registered</h1>
          <p className="text-paw-bark/75 mb-6">Add a pet before booking a service.</p>
          <button
            type="button"
            onClick={() => (window.location.href = '/my-pets/add')}
            className="paw-cta-primary"
          >
            Add your first pet
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Scheduling"
        title="Book a service"
        subtitle="Appointment, health checkup, or vaccination — with map-based location in Kathmandu Valley."
      />

      <PageContent>
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Info card */}
          <div className="paw-surface-card flex items-start gap-4 border-2 border-paw-bark/15 p-6">
            <div className="bg-paw-bark/10 p-3 rounded-full">
              <Stethoscope className="w-6 h-6 text-paw-bark" />
            </div>
            <div>
              <h2 className="font-bold text-paw-ink text-lg mb-1">Open-source location (OSM)</h2>
              <p className="text-gray-800 text-sm">
                We use OpenStreetMap for location selection. Services are currently limited to the Kathmandu
                Valley boundary.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="paw-surface-card space-y-6 p-8">
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Pet selection */}
            <div>
              <label className="block text-sm font-semibold text-paw-ink mb-2">
                Select Pet *
              </label>
              <select
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-paw-teal-mid focus:outline-none"
              >
                <option value="">Choose your pet...</option>
                {pets.map((pet) => (
                  <option key={pet._id} value={pet._id}>
                    {pet.name} ({pet.species}{pet.breed ? ` · ${pet.breed}` : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* Service type */}
            <div>
              <label className="block text-sm font-semibold text-paw-ink mb-2">
                Service Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SERVICE_TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setServiceType(type)}
                    className={`rounded-2xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      serviceType === type
                        ? 'border-paw-bark bg-paw-bark text-white'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-paw-bark/60'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-sm font-semibold text-paw-ink mb-2">
                Payment *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                    paymentMethod === 'online'
                      ? 'border-paw-bark bg-paw-bark text-white'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-paw-bark/60'
                  }`}
                >
                  Pay online (Khalti) — pay now before vet is assigned
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash_on_delivery')}
                  className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                    paymentMethod === 'cash_on_delivery'
                      ? 'border-paw-bark bg-paw-bark text-white'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-paw-bark/60'
                  }`}
                >
                  Cash on delivery — pay the vet when they arrive
                </button>
              </div>
            </div>

            {/* Date & Time window */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-paw-ink mb-2">
                  Preferred Date *
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-paw-teal-mid focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-paw-ink mb-2">
                  Time Window *
                </label>
                <select
                  value={timeWindow}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = TIME_WINDOW_OPTIONS.find((t) => t === v);
                    setTimeWindow(next ?? '');
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-paw-teal-mid focus:outline-none"
                >
                  <option value="">Choose a time window...</option>
                  {TIME_WINDOW_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-paw-ink mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe any symptoms, previous history, or preferences."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-paw-teal-mid focus:outline-none"
              />
            </div>

            {/* Map */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-paw-ink">
                  Service Location (Kathmandu Valley) *
                </label>
                {!isInsideKathmandu && (
                  <span className="text-xs text-red-700 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Service restricted to Kathmandu Valley
                  </span>
                )}
              </div>
              <div className="relative rounded-[16px] overflow-hidden border-2 border-paw-bark bg-paw-sand/40 h-[320px]">
                <DynamicServiceRequestMap
                  center={center}
                  onCenterChange={(lat, lng) => setCenter([lat, lng])}
                  confirmedLatLng={confirmedLatLng}
                />

                {/* Fixed center pin */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="transform -translate-y-4 text-paw-bark drop-shadow">
                    <MapPin className="w-8 h-8" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-xs text-gray-700">
                  Pan the map to position the pin. Then confirm to lock the address.
                  {confirmedAddress && (
                    <div className="mt-1 text-[11px] text-gray-800">
                      <span className="font-semibold">Selected:</span> {confirmedAddress}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleConfirmLocation}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-paw-bark text-paw-cream text-sm font-semibold hover:bg-paw-ink transition-colors"
                >
                  Confirm Location
                </button>
              </div>
              {geoWarning && (
                <p className="text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {geoWarning}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !selectedPetId ||
                  !serviceType ||
                  !preferredDate ||
                  !timeWindow ||
                  !confirmedLatLng ||
                  !isInsideKathmandu
                }
                className={`paw-cta-primary flex items-center gap-2 text-sm ${
                  submitting || !isInsideKathmandu ? 'cursor-not-allowed opacity-50' : ''
                }`}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </PageContent>
    </PageShell>
  );
}

