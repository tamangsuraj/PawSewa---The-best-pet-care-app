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
  'rounded-[1.35rem] border border-paw-bark/10 bg-white/88 backdrop-blur-sm shadow-paw transition-all duration-500 ease-out hover:shadow-paw-lg hover:-translate-y-1';

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
    <div className="min-h-screen bg-transparent text-paw-ink relative">
      <HomeActiveOrdersRail />

      {/* Hero — asymmetric editorial + motion */}
      <section className="relative overflow-hidden border-b border-paw-bark/10">
        <div
          className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full blur-3xl paw-hero-orb"
          style={{ background: 'var(--paw-teal-glow)' }}
        />
        <div className="pointer-events-none absolute -right-20 top-0 h-[28rem] w-[28rem] rounded-full bg-paw-bark/[0.07] blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-paw-haze/90 via-paw-cream to-paw-sand/60" />
        <div className="container relative z-10 mx-auto px-4 py-16 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20">
            <div className="paw-hero-stagger flex flex-col space-y-6">
              <p className="paw-eyebrow">The compassionate guardian</p>
              <h1 className="font-display text-balance text-[2.5rem] font-semibold leading-[1.02] tracking-tight text-paw-ink sm:text-5xl md:text-[3.45rem]">
                For your Nepal&apos;s{' '}
                <span className="font-normal italic text-paw-bark">pets</span>.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-paw-bark/85">
                A premium ecosystem for Himalayan pet care — clinical precision, grounded warmth, and
                lifelong wellbeing in one deliberate experience.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/vets"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-paw-bark to-paw-ink px-8 py-3.5 text-sm font-semibold text-paw-cream shadow-[0_12px_36px_rgba(61,46,36,0.25)] transition-transform hover:-translate-y-0.5"
                >
                  Book a vet
                </Link>
                <Link
                  href="/services"
                  className={`inline-flex items-center justify-center gap-2 rounded-full border-2 border-paw-ink/20 bg-white/70 px-8 py-3.5 text-sm font-semibold text-paw-ink backdrop-blur-sm transition-transform hover:-translate-y-0.5 ${cardLift}`}
                >
                  Explore services
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                </Link>
              </div>
            </div>
            <div className="relative lg:pl-4">
              <div
                className="pointer-events-none absolute -right-6 top-12 hidden h-40 w-[1px] rotate-12 bg-gradient-to-b from-transparent via-paw-teal-mid/35 to-transparent lg:block"
                aria-hidden
              />
              <div
                className={`relative mx-auto aspect-[4/5] max-h-[min(520px,70vh)] rotate-0 overflow-hidden rounded-[2rem] border border-paw-bark/10 shadow-paw-lg transition-transform duration-700 lg:-rotate-[1.5deg] lg:hover:rotate-0 ${cardLift}`}
              >
                <Image
                  src={CAT_HERO}
                  alt="Portrait of a tabby cat — premium PawSewa companion"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-paw-ink/25 via-transparent to-transparent" />
              </div>
              <div
                className={`absolute -bottom-5 left-2 max-w-[260px] rounded-2xl border border-paw-bark/10 bg-white/92 p-4 shadow-paw-lg backdrop-blur-md md:left-6 ${cardLift}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-paw-teal-mid shadow-[0_0_12px_rgba(13,148,136,0.5)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-paw-bark/55">
                    Status: onsite &amp; healthy
                  </span>
                </div>
                <p className="text-sm leading-snug text-paw-bark/85">
                  Last checkup completed. Vitals stable; vaccination schedule on track.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Services */}
      <section className="px-4 py-20 md:py-24">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="paw-eyebrow-center">What we offer</p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-paw-ink md:text-4xl">
              Our services
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-paw-bark/75">
              One flow from vaccines to boarding — designed like a magazine spread, built for real pets.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/services/request"
              className={`group flex flex-col items-center bg-white/90 p-7 text-center ${cardLift}`}
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-paw-sand to-paw-haze ring-1 ring-paw-bark/10 transition-transform duration-300 group-hover:scale-105">
                <Syringe className="h-7 w-7 text-paw-ink" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-lg text-paw-ink">Vaccination</h3>
              <p className="mt-2 text-sm leading-relaxed text-paw-bark/70">
                Jabs and health records in one calm flow.
              </p>
            </Link>
            <Link
              href="/my-pets"
              className={`group flex flex-col items-center bg-white/90 p-7 text-center ${cardLift}`}
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-paw-sand to-paw-haze ring-1 ring-paw-bark/10 transition-transform duration-300 group-hover:scale-105">
                <Bone className="h-7 w-7 text-paw-ink" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-lg text-paw-ink">Pet profiles</h3>
              <p className="mt-2 text-sm leading-relaxed text-paw-bark/70">
                Paw IDs, photos, and notes synced everywhere.
              </p>
            </Link>
            <Link
              href="/vets"
              className={`group flex flex-col items-center bg-white/90 p-7 text-center ${cardLift}`}
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-paw-sand to-paw-haze ring-1 ring-paw-bark/10 transition-transform duration-300 group-hover:scale-105">
                <Home className="h-7 w-7 text-paw-ink" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-lg text-paw-ink">Clinics</h3>
              <p className="mt-2 text-sm leading-relaxed text-paw-bark/70">
                Verified veterinarians across the valley.
              </p>
            </Link>
            <div
              className={`relative flex flex-col items-center border border-paw-ink/20 bg-gradient-to-br from-paw-ink to-paw-bark p-7 text-center text-paw-cream shadow-paw-lg ${cardLift}`}
            >
              <span className="absolute right-3 top-3 rounded-full bg-paw-teal-mid px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
                NEW
              </span>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
                <Truck className="h-7 w-7 text-paw-cream" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-lg">Pet Care+</h3>
              <p className="mb-4 mt-2 text-sm text-paw-cream/80">Hostel, grooming, training &amp; more.</p>
              <Link
                href="/care/hostel"
                className="mb-3 text-sm font-semibold underline decoration-paw-teal-mid/60 underline-offset-4"
              >
                Explore more
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
                className="mt-auto inline-flex items-center gap-2 rounded-full bg-paw-teal-mid px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-paw-teal"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Chat with provider
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
