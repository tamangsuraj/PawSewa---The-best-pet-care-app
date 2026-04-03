'use client';

import { useEffect, useMemo, useState } from 'react';
import nextDynamic from 'next/dynamic';
import api from '@/lib/api';
import { AlertCircle, MapPin, Stethoscope } from 'lucide-react';

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
    } catch (err: any) {
      console.error('Error submitting service request:', err);
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5E6CA] flex items-center justify-center">
        <div className="text-[#703418] text-xl">Loading...</div>
      </div>
    );
  }

  if (pets.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5E6CA] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-xl text-center">
          <div className="text-6xl mb-4">🐾</div>
          <h1 className="text-3xl font-bold text-[#703418] mb-2">No Pets Registered</h1>
          <p className="text-gray-700 mb-6">
            You need to add a pet before creating a service request.
          </p>
          <button
            onClick={() => (window.location.href = '/my-pets/add')}
            className="px-6 py-3 bg-[#703418] text-white rounded-xl font-semibold hover:bg-[#8B4513] transition-colors"
          >
            + Add Your First Pet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5E6CA]">
      <div className="bg-[#703418] text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">Book a Service</h1>
          <p className="text-[#F5E6CA]">Appointment, health checkup, or vaccination</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Info card */}
          <div className="bg-white border-2 border-[#703418] rounded-2xl p-6 flex gap-4 items-start">
            <div className="bg-[#703418]/10 p-3 rounded-full">
              <Stethoscope className="w-6 h-6 text-[#703418]" />
            </div>
            <div>
              <h2 className="font-bold text-[#703418] text-lg mb-1">
                Open-Source Location with OSM
              </h2>
              <p className="text-gray-800 text-sm">
                We use OpenStreetMap for location selection. Services are currently limited to the Kathmandu
                Valley boundary.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Pet selection */}
            <div>
              <label className="block text-sm font-semibold text-[#703418] mb-2">
                Select Pet *
              </label>
              <select
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-[#703418] focus:outline-none"
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
              <label className="block text-sm font-semibold text-[#703418] mb-2">
                Service Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Appointment', 'Health Checkup', 'Vaccination'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setServiceType(type as any)}
                    className={`rounded-2xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      serviceType === type
                        ? 'border-[#703418] bg-[#703418] text-white'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-[#703418]/60'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-sm font-semibold text-[#703418] mb-2">
                Payment *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                    paymentMethod === 'online'
                      ? 'border-[#703418] bg-[#703418] text-white'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-[#703418]/60'
                  }`}
                >
                  Pay online (Khalti) — pay now before vet is assigned
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash_on_delivery')}
                  className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                    paymentMethod === 'cash_on_delivery'
                      ? 'border-[#703418] bg-[#703418] text-white'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-[#703418]/60'
                  }`}
                >
                  Cash on delivery — pay the vet when they arrive
                </button>
              </div>
            </div>

            {/* Date & Time window */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#703418] mb-2">
                  Preferred Date *
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-[#703418] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#703418] mb-2">
                  Time Window *
                </label>
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value as any)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-[#703418] focus:outline-none"
                >
                  <option value="">Choose a time window...</option>
                  <option value="Morning (9am-12pm)">Morning (9am-12pm)</option>
                  <option value="Afternoon (12pm-4pm)">Afternoon (12pm-4pm)</option>
                  <option value="Evening (4pm-8pm)">Evening (4pm-8pm)</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-[#703418] mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe any symptoms, previous history, or preferences."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:border-[#703418] focus:outline-none"
              />
            </div>

            {/* Map */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-[#703418]">
                  Service Location (Kathmandu Valley) *
                </label>
                {!isInsideKathmandu && (
                  <span className="text-xs text-red-700 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Service restricted to Kathmandu Valley
                  </span>
                )}
              </div>
              <div className="relative rounded-[16px] overflow-hidden border-2 border-[#703418] bg-gray-100 h-[320px]">
                <DynamicServiceRequestMap
                  center={center}
                  onCenterChange={(lat, lng) => setCenter([lat, lng])}
                  confirmedLatLng={confirmedLatLng}
                />

                {/* Fixed center pin */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="transform -translate-y-4 text-[#703418] drop-shadow">
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
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#703418] text-white text-sm font-semibold hover:bg-[#8B4513] transition-colors"
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
                className={`px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 ${
                  submitting || !isInsideKathmandu
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-[#703418] text-white hover:bg-[#8B4513]'
                }`}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

