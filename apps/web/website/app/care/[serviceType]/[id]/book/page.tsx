'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, Phone, Clock, Home, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';

const SERVICE_LABELS: Record<string, string> = {
  hostel: 'Hostel',
  grooming: 'Pet Grooming',
  spa: 'Spa',
  wash: 'Wash',
  training: 'Training',
};

interface Pet {
  _id: string;
  name: string;
  pawId?: string;
}

interface Facility {
  _id: string;
  name: string;
  location?: { address: string };
  pricePerSession?: number;
  pricePerNight?: number;
  serviceType?: string;
  roomTypes?: { name: string; pricePerNight: number }[];
}

const PACKAGES = [
  { id: 'essential', name: 'Essential Clean', price: 1500, services: 'Bath, Brush, Nails', duration: 45 },
  { id: 'full', name: 'Full Spa', price: 2800, services: 'Essential + Haircut', duration: 90 },
];

const ADDONS = [
  { id: 'tick', name: 'Tick & Flea Wash', price: 200 },
  { id: 'ear', name: 'Ear Cleaning', price: 150 },
  { id: 'shampoo', name: 'Special Shampoo', price: 300 },
];

const TIME_SLOTS = ['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM'];

function getNextDays(count: number): { day: string; date: number; full: Date }[] {
  const out: { day: string; date: number; full: Date }[] = [];
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({ day: days[d.getDay()], date: d.getDate(), full: new Date(d) });
  }
  return out;
}

export default function CareBookPage({ params }: { params: { serviceType: string; id: string } }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const serviceType = String(params.serviceType || '').toLowerCase();
  const label = SERVICE_LABELS[serviceType] || serviceType;
  const [center, setCenter] = useState<Facility | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<(typeof PACKAGES)[0]>(PACKAGES[0]);
  const [delivery, setDelivery] = useState<'home' | 'center'>('home');
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [roomType, setRoomType] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'esewa' | 'khalti' | 'cod'>('khalti');

  const days = getNextDays(14);
  const isHostel = serviceType === 'hostel';

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const fetchData = async () => {
      try {
        const [resHostel, resPets] = await Promise.all([
          api.get(`/hostels/${params.id}`),
          api.get('/pets/my-pets'),
        ]);
        if (resHostel.data?.success) setCenter(resHostel.data.data);
        if (resPets.data?.success && Array.isArray(resPets.data.data)) {
          setPets(resPets.data.data);
          if (resPets.data.data.length) setSelectedPetId(resPets.data.data[0]._id);
        }
        if (user?.phone) setContactNumber(user.phone);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id, isAuthenticated, router, user?.phone]);

  const addonTotal = addonIds.reduce((sum, id) => sum + (ADDONS.find((x) => x.id === id)?.price ?? 0), 0);
  const sessionFee = selectedPackage.price + addonTotal;
  const nights = checkInDate && checkOutDate
    ? Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const pricePerNight = roomType && center?.roomTypes?.length
    ? (center.roomTypes.find((r) => r.name === roomType)?.pricePerNight ?? center.pricePerNight ?? 0)
    : (center?.pricePerNight ?? 0);
  const hostelSubtotal = nights * pricePerNight;
  const totalAmount = isHostel ? hostelSubtotal : sessionFee;

  const handleConfirm = async () => {
    if (!selectedPetId || !center) return;
    if (isHostel) {
      if (!checkInDate || !checkOutDate || new Date(checkOutDate) <= new Date(checkInDate)) {
        alert('Please select check-in and check-out dates (check-out must be after check-in).');
        return;
      }
    } else {
      if (!selectedDate || !selectedTime) return;
    }
    setSubmitting(true);
    try {
      let checkIn: Date;
      let checkOut: Date;
      if (isHostel) {
        checkIn = new Date(checkInDate);
        checkIn.setHours(14, 0, 0, 0);
        checkOut = new Date(checkOutDate);
        checkOut.setHours(11, 0, 0, 0);
      } else {
        const [hours] = selectedTime.replace(/\s*AM|PM/i, '').split(':');
        const hour = selectedTime.toUpperCase().includes('PM') && parseInt(hours, 10) !== 12 ? parseInt(hours, 10) + 12 : parseInt(hours, 10);
        checkIn = new Date(selectedDate!);
        checkIn.setHours(hour, 0, 0, 0);
        checkOut = new Date(checkIn);
        checkOut.setMinutes(checkOut.getMinutes() + selectedPackage.duration);
      }

      const res = await api.post('/care-bookings', {
        hostelId: center._id,
        petId: selectedPetId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        roomType: isHostel ? roomType || undefined : undefined,
        paymentMethod: paymentMethod === 'cod' ? 'cash_on_delivery' : 'online',
        ownerNotes: isHostel
          ? `Address: ${address}. Contact: ${contactNumber}.`
          : `Delivery: ${delivery}. Add-ons: ${addonIds.join(', ') || 'None'}. Address: ${address}. Contact: ${contactNumber}.`,
      });
      if (res.data?.success && res.data?.data) {
        const booking = res.data.data;
        if (paymentMethod === 'khalti' && booking.totalAmount > 0) {
          const payRes = await api.post('/payments/initiate-payment', {
            type: 'care_booking',
            careBookingId: booking._id,
          });
          const url = payRes.data?.data?.paymentUrl;
          if (url) {
            window.location.href = url;
            return;
          }
        }
        router.push(`/care/bookings?success=1&id=${booking._id}`);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !center) {
    return (
      <PageShell className="flex min-h-dvh items-center justify-center">
        <p className="text-paw-bark">Loading...</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
    <div className="pb-32">
      <header className="sticky top-0 z-10 border-b border-paw-bark/10 bg-paw-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href={`/care/${serviceType}/${params.id}`}
            className="p-2 -ml-2 rounded-xl hover:bg-paw-sand/80 text-paw-bark transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-semibold text-paw-ink font-display">{label}</h1>
        </div>
      </header>

      <main>
        <PageContent compact className="space-y-6 pb-36">
        <section>
          <h2 className="text-sm font-bold text-paw-bark mb-2">SELECT PET</h2>
          <select
            value={selectedPetId}
            onChange={(e) => setSelectedPetId(e.target.value)}
            className="paw-input"
          >
            {pets.map((p) => (
              <option key={p._id} value={p._id}>{p.name} {p.pawId ? `(ID: ${p.pawId})` : ''}</option>
            ))}
          </select>
        </section>

        {isHostel ? (
          <>
            <section>
              <h2 className="text-sm font-bold text-paw-bark mb-2">CHECK-IN / CHECK-OUT</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Check-in</label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="paw-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Check-out</label>
                  <input
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    min={checkInDate || new Date().toISOString().slice(0, 10)}
                    className="paw-input"
                  />
                </div>
              </div>
              {nights > 0 && <p className="text-sm text-gray-600 mt-2">{nights} night(s) · NPR {pricePerNight.toLocaleString()}/night</p>}
            </section>
            {center.roomTypes?.length ? (
              <section>
                <h2 className="text-sm font-bold text-paw-bark mb-2">ROOM TYPE</h2>
                <div className="flex flex-wrap gap-2">
                  {center.roomTypes.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => setRoomType(r.name)}
                      className={`px-4 py-2 rounded-xl border-2 text-sm ${roomType === r.name ? 'border-paw-bark bg-paw-bark/10 text-paw-bark' : 'border-gray-200'}`}
                    >
                      {r.name} — NPR {r.pricePerNight.toLocaleString()}/night
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-bold text-paw-bark mb-2">CHOOSE GROOMING PACKAGE</h2>
              <div className="grid grid-cols-2 gap-3">
                {PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackage(pkg)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${selectedPackage.id === pkg.id ? 'border-paw-bark bg-paw-bark/5' : 'border-gray-200 bg-white'}`}
                  >
                    <p className="font-semibold text-paw-bark">{pkg.name}</p>
                    <p className="text-sm text-gray-600 mt-1">NPR {pkg.price.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{pkg.services}</p>
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-2"><Clock className="w-3 h-3" /> {pkg.duration} mins</p>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-sm font-bold text-paw-bark mb-2">SERVICE DELIVERY</h2>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setDelivery('home')} className={`p-4 rounded-xl border-2 flex items-center gap-3 ${delivery === 'home' ? 'border-paw-bark bg-paw-bark/5' : 'border-gray-200'}`}>
                  <Home className="w-6 h-6 text-paw-bark" />
                  <div className="text-left">
                    <p className="font-semibold text-paw-bark">Home Visit</p>
                    <p className="text-xs text-gray-600">Groomer comes to your location</p>
                  </div>
                </button>
                <button type="button" onClick={() => setDelivery('center')} className={`p-4 rounded-xl border-2 flex items-center gap-3 ${delivery === 'center' ? 'border-paw-bark bg-paw-bark/5' : 'border-gray-200'}`}>
                  <Building2 className="w-6 h-6 text-paw-bark" />
                  <div className="text-left">
                    <p className="font-semibold text-paw-bark">Visit Center</p>
                    <p className="text-xs text-gray-600">Bring your pet to our care center</p>
                  </div>
                </button>
              </div>
            </section>
            <section>
              <h2 className="text-sm font-bold text-paw-bark mb-2">ADD-ONS</h2>
              <div className="flex flex-wrap gap-2">
                {ADDONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAddonIds((prev) => prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id])}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium ${addonIds.includes(a.id) ? 'border-paw-bark bg-paw-bark text-white' : 'border-gray-200'}`}
                  >
                    {a.name} (+NPR {a.price})
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-sm font-bold text-paw-bark mb-2">SELECT DATE & TIME</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((d) => (
                  <button key={d.full.toISOString()} type="button" onClick={() => setSelectedDate(d.full)} className={`shrink-0 w-14 py-2 rounded-xl border-2 text-center ${selectedDate?.getDate() === d.date ? 'border-paw-bark bg-paw-bark text-white' : 'border-gray-200'}`}>
                    <p className="text-xs">{d.day}</p>
                    <p className="font-bold">{d.date}</p>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {TIME_SLOTS.map((t) => (
                  <button key={t} type="button" onClick={() => setSelectedTime(t)} className={`px-4 py-2 rounded-xl border-2 ${selectedTime === t ? 'border-paw-bark bg-paw-bark text-white' : 'border-gray-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <section>
          <h2 className="text-sm font-bold text-paw-bark mb-2">LOCATION & CONTACT</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
              <MapPin className="w-5 h-5 text-paw-bark shrink-0" />
              <input type="text" placeholder="Home Address" value={address} onChange={(e) => setAddress(e.target.value)} className="flex-1 outline-none" />
              <span className="text-paw-bark text-sm font-medium">Edit</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
              <Phone className="w-5 h-5 text-paw-bark shrink-0" />
              <input type="tel" placeholder="Contact Number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="flex-1 outline-none" />
              <span className="text-paw-bark text-sm font-medium">Edit</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-paw-bark mb-2">PAYMENT & SUMMARY</h2>
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="Promo Code" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl outline-none focus:border-paw-bark" />
            <button type="button" className="px-4 py-2 bg-paw-bark text-white rounded-xl font-medium">Apply</button>
          </div>
          <div className="flex gap-2 mb-3">
            {(['esewa', 'khalti', 'cod'] as const).map((method) => (
              <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`flex-1 py-2 rounded-xl border-2 font-medium uppercase ${paymentMethod === method ? 'border-paw-bark bg-paw-bark/10 text-paw-bark' : 'border-gray-200'}`}>
                {method === 'cod' ? 'COD' : method === 'khalti' ? 'Khalti' : 'eSewa'}
              </button>
            ))}
          </div>
          <div className="p-4 rounded-xl bg-gray-50 space-y-1 text-sm">
            {isHostel ? (
              <>
                <p className="flex justify-between"><span>Nights</span><span>{nights} × NPR {pricePerNight.toLocaleString()}</span></p>
                <p className="flex justify-between font-bold text-paw-bark text-base pt-2"><span>Total Amount</span><span>NPR {totalAmount.toLocaleString()}</span></p>
              </>
            ) : (
              <>
                <p className="flex justify-between"><span>Service Fee</span><span>NPR {selectedPackage.price.toLocaleString()}</span></p>
                {addonTotal > 0 && <p className="flex justify-between"><span>Add-ons</span><span>NPR {addonTotal.toLocaleString()}</span></p>}
                <p className="flex justify-between font-bold text-paw-bark text-base pt-2"><span>Total Amount</span><span>NPR {totalAmount.toLocaleString()}</span></p>
              </>
            )}
          </div>
        </section>
        </PageContent>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-paw-bark/10 bg-paw-cream/95 backdrop-blur-md p-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || !selectedPetId || (isHostel ? !checkInDate || !checkOutDate || nights < 1 : (!selectedDate || !selectedTime))}
          className="paw-cta-primary w-full disabled:opacity-50"
        >
          {submitting ? 'Processing...' : isHostel ? 'Confirm Hostel Booking' : 'Confirm Grooming Appointment'}
        </button>
        </div>
      </div>
    </div>
    </PageShell>
  );
}
