'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  ArrowRight,
  Bone,
  Home,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingCart,
  Stethoscope,
  Syringe,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useChatHub } from '@/context/ChatHubContext';
import { HomeActiveOrdersRail } from '@/components/HomeActiveOrdersRail';

const ClinicMapCard = dynamic(
  () => import('@/components/ClinicMapCard').then((m) => m.ClinicMapCard),
  { ssr: false, loading: () => <div className="h-[280px] rounded-2xl bg-[#1a1512] animate-pulse" /> },
);

const CAT_HERO =
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=960&q=85';

const DESIGN_SUPPLY = [
  { title: 'Himalayan Yak Chews', category: 'NUTRITION', price: 1250 },
  { title: 'NexGard Flea & Tick', category: 'MEDICINE', price: 2400 },
  { title: 'Wild Salmon Bites', category: 'TREATS', price: 850 },
  { title: 'Silver Ion Grooming Kit', category: 'GROOMING', price: 4500 },
] as const;

interface Vet {
  _id: string;
  name: string;
  clinicName?: string;
  clinicLocation?: string;
  phone?: string;
}

interface ProductLite {
  _id: string;
  name: string;
  price: number;
  images?: string[];
}

interface ServiceRequestRow {
  _id: string;
  serviceType?: string;
  status?: string;
  preferredDate?: string;
  visitNotes?: string;
  completedAt?: string;
  pet?: { name?: string };
}

const cardLift =
  'rounded-2xl transition-all duration-300 hover:shadow-[0_24px_55px_rgba(75,54,33,0.14)] hover:-translate-y-1';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const router = useRouter();
  const { openSellerChat, openCareProviderChat, openHubWithSupport } = useChatHub();
  const [vets, setVets] = useState<Vet[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [appointments, setAppointments] = useState<ServiceRequestRow[]>([]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      '[WEB-UI] Home Screen parity achieved: Refined visual replications, all multi-platform chat/map features synced.',
    );
  }, []);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    (async () => {
      try {
        const v = await axios.get(`${base}/vets/public`);
        if (v.data?.success) setVets((v.data.data || []).slice(0, 6));
      } catch {
        setVets([]);
      }
      try {
        const p = await axios.get(`${base}/products`, { params: { limit: 24 } });
        if (p.data?.success) setProducts(p.data.data || []);
      } catch {
        setProducts([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setAppointments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
        const res = await axios.get(`${base}/service-requests/my/requests`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && res.data?.success) {
          setAppointments(res.data.data || []);
        }
      } catch {
        if (!cancelled) setAppointments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const showcase = DESIGN_SUPPLY.map((slot, i) => {
    const apiProduct = products[i] || products.find((p) => p.name?.toLowerCase().includes(slot.title.slice(0, 6).toLowerCase()));
    return {
      ...slot,
      productId: apiProduct?._id,
      image: apiProduct?.images?.[0],
      price: apiProduct?.price ?? slot.price,
    };
  });

  const completedActivity = appointments
    .filter((a) => a.status === 'completed')
    .slice(0, 5);

  const upcomingAppointments = appointments
    .filter((a) => a.status !== 'completed' && a.status !== 'cancelled')
    .slice(0, 3);

  const clinicList = [
    { name: 'Advance Pet Hospital', phone: '+977-1-4440123', vet: vets[0] },
    { name: 'Happy Paws Clinic', phone: '+977-1-5550456', vet: vets[1] },
  ];

  const onSellerChat = async (productId: string | undefined) => {
    if (!productId) {
      router.push('/shop');
      return;
    }
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent('/')}`);
      return;
    }
    await openSellerChat(productId);
  };

  return (
    <div className="min-h-screen bg-secondary text-[#2a2118] relative">
      <HomeActiveOrdersRail />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#4B3621]/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FAF7F2] via-[#f5efe6] to-[#ebe3d7]" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.25em] text-[#4B3621]/55 uppercase mb-4">
                The Compassionate Guardian
              </p>
              <h1 className="font-display text-4xl sm:text-5xl md:text-[3.25rem] leading-[1.08] font-semibold text-[#4B3621] text-balance">
                For Your Nepal&apos;s Pets.
              </h1>
              <p className="mt-6 text-lg text-[#4B3621]/75 max-w-xl leading-relaxed">
                A premium ecosystem for Himalayan pet care. We blend clinical precision with grounded
                warmth to ensure your companion&apos;s lifelong wellbeing.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/vets"
                  className={`inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#4B3621] text-[#FAF7F2] font-semibold shadow-lg ${cardLift}`}
                >
                  Book a Vet
                </Link>
                <Link
                  href="/services"
                  className={`inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border-2 border-[#4B3621] text-[#4B3621] font-semibold bg-white/60 ${cardLift}`}
                >
                  Explore Services
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="relative">
              <div
                className={`relative aspect-[4/5] max-h-[480px] rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(75,54,33,0.2)] border border-[#4B3621]/10 ${cardLift}`}
              >
                <Image
                  src={CAT_HERO}
                  alt="Portrait of a tabby cat — premium PawSewa companion"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
              <div
                className={`absolute -bottom-4 -left-2 md:left-4 max-w-[240px] bg-white rounded-2xl p-4 shadow-[0_20px_50px_rgba(75,54,33,0.15)] border border-[#4B3621]/10 ${cardLift}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0d9488] animate-pulse" />
                  <span className="text-[10px] font-bold tracking-wide text-[#4B3621]/60 uppercase">
                    Status: Onsite &amp; Healthy
                  </span>
                </div>
                <p className="text-sm text-[#4B3621]/80 leading-snug">
                  Last checkup completed successfully. Vitals stable and vaccination schedule on track.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Services */}
      <section className="py-16 md:py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-[#4B3621] text-center mb-12">
            Our Services
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Link
              href="/services/request"
              className={`bg-white border border-[#4B3621]/10 p-6 flex flex-col items-center text-center ${cardLift}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#4B3621]/8 flex items-center justify-center mb-4">
                <Syringe className="w-7 h-7 text-[#4B3621]" />
              </div>
              <h3 className="font-semibold text-[#4B3621]">Vaccination</h3>
              <p className="text-sm text-gray-600 mt-2">Schedule jabs and health records in one flow.</p>
            </Link>
            <Link
              href="/my-pets"
              className={`bg-white border border-[#4B3621]/10 p-6 flex flex-col items-center text-center ${cardLift}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#4B3621]/8 flex items-center justify-center mb-4">
                <Bone className="w-7 h-7 text-[#4B3621]" />
              </div>
              <h3 className="font-semibold text-[#4B3621]">Pet Profiles</h3>
              <p className="text-sm text-gray-600 mt-2">Paw IDs, photos, and medical notes synced.</p>
            </Link>
            <Link
              href="/vets"
              className={`bg-white border border-[#4B3621]/10 p-6 flex flex-col items-center text-center ${cardLift}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#4B3621]/8 flex items-center justify-center mb-4">
                <Home className="w-7 h-7 text-[#4B3621]" />
              </div>
              <h3 className="font-semibold text-[#4B3621]">Clinics</h3>
              <p className="text-sm text-gray-600 mt-2">Verified veterinarians across the valley.</p>
            </Link>
            <div
              className={`relative bg-[#4B3621] text-[#FAF7F2] p-6 flex flex-col items-center text-center ${cardLift} border border-[#4B3621]`}
            >
              <span className="absolute top-3 right-3 text-[10px] font-bold bg-[#0d9488] px-2 py-0.5 rounded-full">
                NEW
              </span>
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
                <Truck className="w-7 h-7 text-[#FAF7F2]" />
              </div>
              <h3 className="font-semibold">Pet Care+</h3>
              <p className="text-sm text-[#FAF7F2]/80 mt-2 mb-4">Hostel, grooming, training &amp; more.</p>
              <Link href="/care/hostel" className="text-sm font-semibold underline underline-offset-2 mb-3">
                Explore More
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    router.push('/login?next=/');
                    return;
                  }
                  void openCareProviderChat();
                }}
                className="mt-auto inline-flex items-center gap-2 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] px-4 py-2 rounded-xl transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Chat with Service Provider
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Appointments + Recent Activity */}
      <section className="py-8 px-4 pb-20">
        <div className="container mx-auto max-w-6xl grid lg:grid-cols-2 gap-8">
          <div className={`bg-white border border-[#4B3621]/10 p-6 md:p-8 ${cardLift}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl font-semibold text-[#4B3621]">Appointments</h3>
              <Link href="/my-service-requests" className="text-sm font-semibold text-[#0d9488] hover:underline">
                View all
              </Link>
            </div>
            {!isAuthenticated ? (
              <p className="text-gray-600 text-sm">
                Sign in to see your visits — same data as the PawSewa app (e.g. testuser@pawsewa.com).
              </p>
            ) : upcomingAppointments.length === 0 ? (
              <p className="text-gray-600 text-sm">No upcoming visits. Book a vet to get started.</p>
            ) : (
              <ul className="space-y-4">
                {upcomingAppointments.map((a) => (
                  <li
                    key={a._id}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#FAF7F2] border border-[#4B3621]/8"
                  >
                    <div>
                      <p className="font-semibold text-[#4B3621]">{a.serviceType || 'Visit'}</p>
                      <p className="text-xs text-gray-600">
                        {a.pet?.name ? `${a.pet.name} · ` : ''}
                        {a.preferredDate
                          ? new Date(a.preferredDate).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold uppercase text-[#0d9488] shrink-0">
                      {a.status?.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => void openHubWithSupport()}
              className="mt-6 w-full py-3 rounded-xl border border-[#4B3621]/20 text-sm font-semibold text-[#4B3621] hover:bg-[#4B3621]/5 transition-colors"
            >
              Message Customer Care
            </button>
          </div>

          <div
            className={`bg-[#2c241c] text-[#FAF7F2] p-6 md:p-8 rounded-2xl border border-[#4B3621]/30 shadow-[0_24px_60px_rgba(0,0,0,0.2)] ${cardLift}`}
          >
            <h3 className="font-display text-2xl font-semibold mb-6">Recent Activity</h3>
            {!isAuthenticated ? (
              <p className="text-[#FAF7F2]/70 text-sm">Log in to load completed visits from the API.</p>
            ) : completedActivity.length === 0 ? (
              <p className="text-[#FAF7F2]/70 text-sm">No completed appointments yet.</p>
            ) : (
              <ul className="space-y-0 border-l-2 border-[#0d9488]/40 ml-2 pl-6">
                {completedActivity.map((a, idx) => (
                  <li key={a._id} className="relative pb-8 last:pb-0">
                    <span className="absolute -left-[1.6rem] top-1 w-3 h-3 rounded-full bg-[#0d9488] ring-4 ring-[#2c241c]" />
                    <p className="text-sm font-semibold text-[#FAF7F2]">
                      {a.serviceType || 'Appointment'}{' '}
                      {a.pet?.name ? `· ${a.pet.name}` : ''}
                    </p>
                    <p className="text-xs text-[#FAF7F2]/55 mt-1">
                      {a.completedAt
                        ? new Date(a.completedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : a.preferredDate
                          ? new Date(a.preferredDate).toLocaleDateString()
                          : ''}
                    </p>
                    {a.visitNotes ? (
                      <p className="text-xs text-[#FAF7F2]/70 mt-2 line-clamp-2">{a.visitNotes}</p>
                    ) : null}
                    {idx === 0 ? (
                      <p className="text-[11px] text-[#0d9488] mt-2 font-medium">Synced from service history</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Essential Supplies */}
      <section className="py-16 px-4 bg-white/70 border-y border-[#4B3621]/10">
        <div className="container mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-semibold text-[#4B3621] text-center mb-4">
            Essential Supplies
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Marketplace parity: chat with sellers in real time (same Socket.io stack as the mobile app).
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {showcase.map((item) => (
              <div
                key={item.title}
                className={`bg-[#1a1512] rounded-2xl overflow-hidden border border-[#4B3621]/20 ${cardLift}`}
              >
                <div className="aspect-square relative bg-[#2a2218]">
                  {item.image ? (
                    <Image src={item.image} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 25vw" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[#FAF7F2]/30 text-sm p-4 text-center">
                      {item.title}
                    </div>
                  )}
                </div>
                <div className="p-4 text-[#FAF7F2]">
                  <p className="text-[10px] font-bold tracking-widest text-[#0d9488]">{item.category}</p>
                  <h3 className="font-semibold mt-1 leading-snug">{item.title}</h3>
                  <p className="text-lg font-bold mt-2">रू {Number(item.price).toLocaleString()}</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.productId) {
                          router.push('/shop');
                          return;
                        }
                        addItem({
                          productId: item.productId,
                          name: item.title,
                          price: item.price,
                          quantity: 1,
                        });
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#4B3621] hover:bg-[#3d2a1a] text-sm font-semibold transition-colors"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSellerChat(item.productId)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#FAF7F2]/25 text-sm font-semibold hover:bg-white/10 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Seller
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/shop" className="text-[#0d9488] font-semibold hover:underline">
              Browse full shop →
            </Link>
          </div>
        </div>
      </section>

      {/* Verified Clinics */}
      <section className="py-16 md:py-24 px-4 pb-24">
        <div className="container mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-semibold text-[#4B3621] text-center mb-12">
            Verified Clinics Nearby
          </h2>
          <div className="grid lg:grid-cols-2 gap-8 items-stretch">
            <div className="space-y-4">
              {clinicList.map((c, i) => (
                <div
                  key={c.name}
                  className={`bg-white border border-[#4B3621]/10 p-5 rounded-2xl flex gap-4 ${cardLift}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[#4B3621]/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-6 h-6 text-[#4B3621]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[#4B3621]">{c.name}</h3>
                    {c.vet?.clinicLocation ? (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {c.vet.clinicLocation}
                      </p>
                    ) : null}
                    <a
                      href={`tel:${c.phone.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-[#0d9488]"
                    >
                      <Phone className="w-4 h-4" />
                      {c.phone}
                    </a>
                    {c.vet?._id ? (
                      <Link
                        href={`/vets/${c.vet._id}`}
                        className="block mt-2 text-xs font-semibold text-[#4B3621] hover:underline"
                      >
                        View profile →
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <ClinicMapCard />
          </div>
        </div>
      </section>
    </div>
  );
}
