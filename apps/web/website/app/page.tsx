'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  ArrowRight,
  ArrowUp,
  Bone,
  CalendarClock,
  ChevronRight,
  Headphones,
  Heart,
  LifeBuoy,
  MapPin,
  MessageCircle,
  ShoppingCart,
  Sparkles,
  Star,
  Stethoscope,
  Truck,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useChatHub } from '@/context/ChatHubContext';
import { HomeActiveOrdersRail } from '@/components/HomeActiveOrdersRail';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import {
  PAW_CAT_HERO,
  PAW_DECO_IMAGES,
  PAW_SHOWCASE_IMAGES,
} from '@/lib/pawImageAssets';
import { getWebsiteApiBase, ngrokBrowserBypassHeaders } from '@/lib/apiEnv';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Vet {
  _id: string;
  name: string;
  clinicName?: string;
  clinicLocation?: string;
  specialization?: string;
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

// ─── Static data ──────────────────────────────────────────────────────────────
const DESIGN_SUPPLY = [
  { title: 'Self-cleaning slicker brush', category: 'GROOMING', price: 890 },
  { title: 'LED nail grinder kit',        category: 'GROOMING', price: 2100 },
  { title: 'Stainless elevated feeder',   category: 'FEEDING',  price: 1650 },
  { title: 'Automatic water fountain',    category: 'SUPPLIES', price: 3200 },
] as const;

const SERVICES = [
  {
    icon: Stethoscope,
    title: 'Vet consultations',
    desc: 'Book verified clinicians — home visits or clinic appointments with real-time status tracking.',
    href: '/vets',
    accent: 'from-[#703418]/8 to-[#703418]/4',
    wide: false,
  },
  {
    icon: Truck,
    title: 'Shop & delivery',
    desc: 'Premium supplies shipped to your door from our curated catalogue.',
    href: '/shop',
    accent: 'from-[#0d9488]/8 to-[#0d9488]/4',
    wide: false,
  },
  {
    icon: CalendarClock,
    title: 'Book an appointment',
    desc: 'Schedule checkups, vaccinations, or consultations — same calendar as the PawSewa app.',
    href: '/book-appointment',
    accent: 'from-[#703418]/8 to-[#703418]/4',
    wide: true,
  },
  {
    icon: Sparkles,
    title: 'Pet Care+',
    desc: 'Hostel, grooming, training, spa and wash — facility bookings from verified partners.',
    href: '/pet-care-plus',
    accent: 'from-amber-500/8 to-amber-500/4',
    wide: false,
  },
  {
    icon: LifeBuoy,
    title: 'Emergency help',
    desc: 'Urgent assistance routed directly to available vets and support staff.',
    href: '/request-assistance',
    accent: 'from-rose-500/8 to-rose-500/4',
    wide: false,
  },
  {
    icon: Bone,
    title: 'Pet profiles',
    desc: 'Full health history, vaccine schedule, and reminders in one clean dashboard.',
    href: '/my-pets',
    accent: 'from-[#0d9488]/8 to-[#0d9488]/4',
    wide: false,
  },
] as const;

const STEPS = [
  {
    n: '01',
    icon: Heart,
    title: 'Create a pet profile',
    body: 'Add your companion with breed, age, and health history. We personalize every experience around them.',
  },
  {
    n: '02',
    icon: CalendarClock,
    title: 'Book or request a visit',
    body: 'Choose a vet, pick a time window, and confirm. Or raise an emergency — we handle assignment automatically.',
  },
  {
    n: '03',
    icon: Stethoscope,
    title: 'Track in real time',
    body: 'Follow your vet from assignment to arrival. Get push notifications and chat directly from the dashboard.',
  },
] as const;

const TESTIMONIALS = [
  {
    quote: "PawSewa got a vet to our home within two hours. The tracking and chat features made the whole experience stress-free.",
    name: 'Priya Shrestha',
    role: 'Dog owner, Kathmandu',
    rating: 5,
    initials: 'PS',
  },
  {
    quote: "The shop has genuinely good products and fast delivery. I love that I can message the seller directly before buying.",
    name: 'Rohan Karki',
    role: 'Cat owner, Lalitpur',
    rating: 5,
    initials: 'RK',
  },
  {
    quote: "Having all my pets' health records in one place — with vaccination reminders — has been a game changer.",
    name: 'Anita Maharjan',
    role: 'Rabbit owner, Bhaktapur',
    rating: 5,
    initials: 'AM',
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { isAuthenticated, token } = useAuth();
  const { addItem } = useCart();
  const router = useRouter();
  const { openSellerChat, openHubWithSupport } = useChatHub();

  const [vets, setVets] = useState<Vet[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [appointments, setAppointments] = useState<ServiceRequestRow[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // Scroll-to-top visibility
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 480);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // API: vets + products
  useEffect(() => {
    const base = getWebsiteApiBase();
    (async () => {
      try {
        const v = await axios.get(`${base}/vets/public`, { headers: ngrokBrowserBypassHeaders, timeout: 15000 });
        if (v.data?.success) setVets((v.data.data || []).slice(0, 6));
      } catch { setVets([]); }
      try {
        const p = await axios.get(`${base}/products`, {
          params: { limit: 24 },
          headers: ngrokBrowserBypassHeaders,
          timeout: 15000,
        });
        if (p.data?.success) setProducts(p.data.data || []);
      } catch { setProducts([]); }
    })();
  }, []);

  // API: appointments (authenticated)
  useEffect(() => {
    if (!isAuthenticated) { setAppointments([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const base = getWebsiteApiBase();
        const res = await axios.get(`${base}/service-requests/my/requests`, {
          headers: {
            ...ngrokBrowserBypassHeaders,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!cancelled && res.data?.success) setAppointments(res.data.data || []);
      } catch { if (!cancelled) setAppointments([]); }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, token]);

  // Product showcase
  const showcase = DESIGN_SUPPLY.map((slot, i) => {
    const apiProduct = products[i];
    const apiImg = apiProduct?.images?.[0]?.trim();
    return {
      ...slot,
      productId: apiProduct?._id,
      image: apiImg || PAW_SHOWCASE_IMAGES[i % PAW_SHOWCASE_IMAGES.length],
      price: apiProduct?.price ?? slot.price,
    };
  });

  const upcomingAppointments = appointments
    .filter((a) => a.status !== 'completed' && a.status !== 'cancelled')
    .slice(0, 3);

  const onSellerChat = async (productId: string | undefined) => {
    if (!productId) { router.push('/shop'); return; }
    if (!isAuthenticated) { router.push(`/login?next=${encodeURIComponent('/')}`); return; }
    await openSellerChat(productId);
  };

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes('@')) { setSubscribed(true); setEmail(''); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-transparent text-paw-ink relative">
      {/* Active orders rail */}
      <HomeActiveOrdersRail />

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-paw-bark/10 pb-24 pt-16 md:pb-32 md:pt-24">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute -left-40 top-1/4 h-[600px] w-[600px] rounded-full bg-paw-bark/[0.055] blur-[120px]" />
        <div className="pointer-events-none absolute -right-24 -top-20 h-[520px] w-[520px] rounded-full bg-paw-teal-mid/[0.07] blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-300/[0.06] blur-[80px]" />

        {/* Mesh gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-paw-haze/95 via-paw-cream/80 to-paw-sand/50" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">

            {/* Left column */}
            <div className="paw-hero-stagger flex flex-col space-y-7">
              {/* Eyebrow pill */}
              <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-paw-bark/15 bg-white/80 px-4 py-2 backdrop-blur-sm shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="paw-ping-ring absolute inline-flex h-full w-full rounded-full bg-paw-teal-mid opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-paw-teal-mid" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-paw-bark/70">Nepal's pet care platform</span>
              </div>

              <h1 className="font-display text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-paw-ink sm:text-5xl md:text-[3.5rem]">
                Your pet deserves the{' '}
                <span className="italic text-paw-bark">best care</span>,{' '}
                everywhere.
              </h1>

              <p className="max-w-xl text-lg leading-relaxed text-paw-bark/80">
                PawSewa connects pet owners with verified vets, supplies, and facility care — all in one calm, modern experience designed around your companion.
              </p>

              {/* Rating proof */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {['PS', 'RK', 'AM', 'SB'].map((init) => (
                    <div key={init} className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-paw-bark to-paw-ink flex items-center justify-center text-[10px] font-bold text-paw-cream shadow-sm">
                      {init}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-paw-bark/60 mt-0.5">Trusted by 1,200+ pet owners</p>
                </div>
              </div>

              {/* CTA row */}
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/book-appointment"
                  className="paw-cta-primary gap-2"
                >
                  Book a vet visit
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                </Link>
                <Link
                  href="/pet-care-plus"
                  className="paw-cta-secondary gap-2"
                >
                  Explore Pet Care+
                </Link>
              </div>
            </div>

            {/* Right column — hero image */}
            <div className="relative lg:pl-2">
              <div className="relative mx-auto aspect-[4/5] max-h-[min(520px,72vh)] overflow-hidden rounded-[2.2rem] border border-paw-bark/10 shadow-paw-lg transition-transform duration-700 lg:-rotate-[1.5deg] lg:hover:rotate-0">
                <Image
                  src={PAW_CAT_HERO}
                  alt="Tabby cat — PawSewa companion"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-paw-ink/30 via-transparent to-transparent" />
              </div>

              {/* Floating health card */}
              <div className="absolute -bottom-4 left-0 z-10 w-[240px] rounded-2xl border border-paw-bark/10 bg-white/92 p-4 shadow-paw-lg backdrop-blur-xl sm:w-[268px]">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="paw-ping-ring absolute h-full w-full rounded-full bg-paw-teal-mid opacity-70" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-paw-teal-mid" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-paw-bark/55">Status: healthy</span>
                </div>
                <p className="text-sm font-medium leading-snug text-paw-bark/80">Last checkup complete. Vaccine schedule on track.</p>
                <div className="mt-3 flex items-center gap-1.5">
                  {['Nutrition', 'Dental', 'Vitals'].map((tag) => (
                    <span key={tag} className="rounded-full bg-paw-teal-mid/10 px-2 py-0.5 text-[10px] font-semibold text-paw-teal">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Floating appointment badge */}
              <div className="absolute -right-2 top-10 z-10 hidden rounded-2xl border border-paw-bark/10 bg-white/90 p-3.5 shadow-paw backdrop-blur-lg sm:block paw-float" style={{ animationDelay: '0.8s' }}>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-paw-bark/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-4.5 w-4.5 text-paw-bark" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-paw-ink">Vet visit booked</p>
                    <p className="text-[10px] text-paw-bark/55 mt-0.5">Tomorrow, 10:00 AM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST / STATS BAR ────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="border-b border-paw-bark/10 bg-white/70 py-10 backdrop-blur-sm">
          <div className="container mx-auto max-w-5xl px-4">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {([
                { label: 'Verified vets',    to: 48,   suffix: '+' },
                { label: 'Pets served',      to: 1200, suffix: '+' },
                { label: 'Service types',    to: 12,   suffix: '' },
                { label: 'Districts covered', to: 7,  suffix: '' },
              ] as const).map(({ label, to, suffix }) => (
                <div key={label} className="flex flex-col items-center gap-1 text-center">
                  <AnimatedCounter
                    to={to}
                    suffix={suffix}
                    className="font-display text-4xl font-semibold text-paw-bark md:text-5xl"
                  />
                  <p className="text-sm text-paw-bark/60">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 3. HOW IT WORKS ─────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="px-4 py-20 md:py-28">
          <div className="container mx-auto max-w-5xl">
            <div className="mb-14 text-center">
              <p className="paw-eyebrow-center">Simple process</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-paw-ink md:text-4xl">
                How PawSewa works
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-paw-bark/70">
                From booking to bedside — every step is tracked, every message is saved.
              </p>
            </div>

            <div className="relative grid gap-8 lg:grid-cols-3 paw-stagger-children">
              {/* Connecting line */}
              <div className="pointer-events-none absolute top-7 left-[16.67%] hidden w-[66.66%] h-px bg-gradient-to-r from-paw-bark/20 via-paw-teal-mid/25 to-paw-bark/20 lg:block" />

              {STEPS.map(({ n, icon: Icon, title, body }) => (
                <div key={n} className="group relative flex flex-col items-center text-center">
                  <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-paw-bark/15 shadow-paw z-10 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-paw-lg">
                    <Icon className="h-6 w-6 text-paw-bark" strokeWidth={1.75} />
                    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-paw-bark text-[9px] font-bold text-paw-cream shadow-sm">
                      {n}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-paw-ink mb-2">{title}</h3>
                  <p className="text-sm leading-relaxed text-paw-bark/70 max-w-xs">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 4. SERVICES BENTO ───────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="px-4 pb-20 md:pb-28">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <p className="paw-eyebrow-center">Everything in one place</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-paw-ink md:text-4xl">
                Our services
              </h2>
            </div>

            {/* Bento grid: 3 col on desktop, wide card spans 2 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr paw-stagger-children">
              {SERVICES.map(({ icon: Icon, title, desc, href, accent, wide }) => (
                <Link
                  key={title}
                  href={href}
                  className={`bento-card group p-7 flex flex-col gap-4 ${wide ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} ring-1 ring-paw-bark/10 transition-transform duration-300 group-hover:scale-105`}>
                    <Icon className="h-6 w-6 text-paw-bark" strokeWidth={1.75} />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <h3 className="font-display text-lg font-semibold text-paw-ink">{title}</h3>
                    <p className="text-sm leading-relaxed text-paw-bark/70">{desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-paw-teal-mid opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 5. DASHBOARD STRIP (authenticated) ──────────────────────────────── */}
      {isAuthenticated && upcomingAppointments.length > 0 && (
        <ScrollReveal>
          <section className="px-4 pb-20">
            <div className="container mx-auto max-w-5xl">
              <div className="rounded-[1.8rem] border border-paw-bark/10 bg-white/90 p-6 shadow-paw backdrop-blur-sm md:p-8">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-display text-xl font-semibold text-paw-ink">Upcoming visits</h3>
                  <Link href="/my-service-requests" className="text-xs font-semibold text-paw-teal-mid hover:underline">
                    View all →
                  </Link>
                </div>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {upcomingAppointments.map((a) => (
                    <li key={a._id} className="flex flex-col gap-1.5 rounded-xl bg-paw-haze/60 p-4 border border-paw-bark/8">
                      <p className="font-semibold text-paw-ink text-sm">{a.serviceType || 'Visit'}</p>
                      <p className="text-xs text-paw-bark/60">
                        {a.pet?.name ? `${a.pet.name} · ` : ''}
                        {a.preferredDate
                          ? new Date(a.preferredDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                          : ''}
                      </p>
                      <span className="mt-1 inline-flex w-fit rounded-full bg-paw-teal-mid/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-paw-teal">
                        {a.status?.replace(/_/g, ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => void openHubWithSupport()}
                  className="mt-5 flex items-center gap-2 text-sm font-semibold text-paw-bark/70 hover:text-paw-ink transition-colors"
                >
                  <Headphones className="h-4 w-4" />
                  Message customer support
                </button>
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── 6. VETS SHOWCASE ────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="px-4 pb-24 bg-gradient-to-b from-white/0 to-paw-haze/40">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="paw-eyebrow mb-2">Our network</p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-paw-ink md:text-4xl">
                  Verified veterinarians
                </h2>
              </div>
              <Link href="/vets" className="hidden items-center gap-1.5 text-sm font-semibold text-paw-teal-mid hover:underline sm:flex">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {vets.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-[1.35rem] border border-paw-bark/10 bg-white/80 p-6 animate-pulse">
                    <div className="mb-4 h-12 w-12 rounded-2xl bg-paw-sand" />
                    <div className="h-4 w-3/4 rounded-lg bg-paw-sand mb-2" />
                    <div className="h-3 w-1/2 rounded-lg bg-paw-sand" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 paw-stagger-children">
                {vets.slice(0, 3).map((vet) => (
                  <div key={vet._id} className="bento-card group p-6 flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-paw-bark to-paw-ink flex items-center justify-center text-sm font-bold text-paw-cream shadow-sm shrink-0">
                        {vet.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-paw-ink truncate">{vet.name}</h3>
                        {vet.specialization && (
                          <p className="text-xs text-paw-teal-mid font-medium mt-0.5">{vet.specialization}</p>
                        )}
                      </div>
                    </div>
                    {vet.clinicName && (
                      <p className="text-sm text-paw-bark/65 font-medium">{vet.clinicName}</p>
                    )}
                    {vet.clinicLocation && (
                      <div className="flex items-center gap-1.5 text-xs text-paw-bark/55">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {vet.clinicLocation}
                      </div>
                    )}
                    <Link
                      href={`/vets/${vet._id}`}
                      className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-paw-bark hover:text-paw-ink transition-colors"
                    >
                      View profile <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 text-center sm:hidden">
              <Link href="/vets" className="text-sm font-semibold text-paw-teal-mid hover:underline">
                View all veterinarians →
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 7. ESSENTIAL SUPPLIES ───────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="border-y border-paw-bark/10 bg-white/60 px-4 py-20 backdrop-blur-sm">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-12 flex items-end justify-between">
              <div>
                <p className="paw-eyebrow mb-2">Shop</p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-paw-ink md:text-4xl">
                  Essential supplies
                </h2>
                <p className="mt-2 max-w-lg text-sm text-paw-bark/65">
                  Curated grooming tools, wellness picks, and daily essentials. Message sellers directly.
                </p>
              </div>
              <Link href="/shop" className="hidden items-center gap-1.5 text-sm font-semibold text-paw-teal-mid hover:underline sm:flex">
                Browse shop <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 paw-stagger-children">
              {showcase.map((item) => (
                <div
                  key={item.title}
                  className="bento-card group overflow-hidden flex flex-col"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-paw-haze">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 25vw"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-paw-teal backdrop-blur-sm">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-4 gap-2">
                    <h3 className="font-semibold leading-snug text-paw-ink text-sm">{item.title}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                      <span className="text-[10px] text-paw-bark/50 ml-1">(4.8)</span>
                    </div>
                    <p className="text-lg font-bold text-paw-bark mt-auto">
                      रू {Number(item.price).toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!item.productId) { router.push('/shop'); return; }
                          addItem({ productId: item.productId, name: item.title, price: item.price, quantity: 1 });
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-paw-bark py-2.5 text-xs font-bold text-paw-cream transition-colors hover:bg-paw-ink active:scale-[0.98]"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Add to cart
                      </button>
                      <button
                        type="button"
                        onClick={() => void onSellerChat(item.productId)}
                        className="flex items-center justify-center gap-1 rounded-xl border border-paw-bark/20 bg-paw-haze px-3 py-2.5 text-xs font-bold text-paw-bark transition-colors hover:bg-paw-sand/60"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Link href="/shop" className="text-sm font-semibold text-paw-teal-mid hover:underline">
                Browse full shop →
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 8. TESTIMONIALS ─────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="px-4 py-20 md:py-28">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="paw-eyebrow-center">What pet owners say</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-paw-ink md:text-4xl">
                Real stories, real care
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3 paw-stagger-children">
              {TESTIMONIALS.map(({ quote, name, role, rating, initials }) => (
                <div key={name} className="bento-card flex flex-col gap-5 p-7">
                  {/* Stars */}
                  <div className="flex gap-1">
                    {[...Array(rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  {/* Quote mark */}
                  <p className="font-display text-4xl leading-none text-paw-bark/15 select-none" aria-hidden>
                    "
                  </p>

                  <p className="text-sm leading-relaxed text-paw-bark/80 -mt-5 flex-1">
                    {quote}
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3 border-t border-paw-bark/8 pt-5">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-paw-bark to-paw-ink flex items-center justify-center text-xs font-bold text-paw-cream shrink-0 shadow-sm">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-paw-ink">{name}</p>
                      <p className="text-xs text-paw-bark/55">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 9. APP DOWNLOAD CTA ─────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="px-4 pb-24">
          <div className="container mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-paw-bark via-[#5c2c14] to-paw-ink p-8 shadow-paw-lg md:p-12">
              {/* Ambient glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-paw-teal-mid/20 blur-[80px]" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-60 w-60 rounded-full bg-paw-bark/40 blur-[60px]" />

              <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
                    <Zap className="h-3.5 w-3.5 text-amber-300" />
                    <span className="text-xs font-semibold text-white/90">Available now on iOS &amp; Android</span>
                  </div>
                  <h2 className="font-display text-3xl font-semibold text-white leading-tight md:text-4xl">
                    Full experience lives in the app.
                  </h2>
                  <p className="max-w-lg text-white/75 leading-relaxed">
                    Real-time tracking, socket-based chat, push notifications, and live vet maps — the mobile app brings it all together. The website gives you a taste.
                  </p>
                  <ul className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3 paw-stagger-children">
                    {[
                      'Live vet tracking',
                      'In-app chat',
                      'Push notifications',
                      'Pet health records',
                      'Order tracking',
                      'Offline-ready',
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-white/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-paw-teal-mid flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 backdrop-blur-sm opacity-60 cursor-not-allowed select-none" title="Coming soon to iOS">
                    <svg className="h-7 w-7 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/>
                    </svg>
                    <div>
                      <p className="text-[10px] text-white/60">Download on the</p>
                      <p className="text-sm font-bold text-white">App Store <span className="text-[10px] font-normal text-white/50 ml-1">Coming soon</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 backdrop-blur-sm opacity-60 cursor-not-allowed select-none" title="Coming soon on Android">
                    <svg className="h-7 w-7 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M3.18 23.76c.22.12.46.18.7.18.25 0 .5-.06.73-.19L14.25 18l-3.3-3.3-7.77 9.06zM20.1 10.24 16.5 8.1l-3.67 3.67 3.67 3.67 3.62-2.13c.67-.39 1.07-1.09 1.07-1.93s-.4-1.53-1.09-2.14zM1.54.4A1.5 1.5 0 0 0 1 1.5v21c0 .37.1.7.28.97l7.95-7.97L1.54.4zM14.25 6.01 4.62.43a1.5 1.5 0 0 0-.72-.19c-.24 0-.49.06-.7.18l7.74 7.74 3.31-3.15z"/>
                    </svg>
                    <div>
                      <p className="text-[10px] text-white/60">Get it on</p>
                      <p className="text-sm font-bold text-white">Google Play <span className="text-[10px] font-normal text-white/50 ml-1">Coming soon</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 10. RECENT ACTIVITY (pet images) ────────────────────────────────── */}
      <ScrollReveal>
        <section className="border-t border-paw-bark/10 px-4 py-16">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col items-center gap-2 text-center mb-8">
              <p className="paw-eyebrow-center">Pet moments</p>
              <h2 className="font-display text-2xl font-semibold text-paw-ink">Care in action</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 overflow-hidden rounded-[1.6rem] border border-paw-bark/10 shadow-paw">
              {PAW_DECO_IMAGES.map((src, idx) => (
                <div key={src} className="relative aspect-[5/4] bg-paw-haze overflow-hidden">
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-700 hover:scale-105"
                    sizes="33vw"
                    priority={idx === 0}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── 11. NEWSLETTER ──────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="px-4 py-16 pb-24">
          <div className="container mx-auto max-w-2xl text-center">
            <div className="rounded-[2rem] border border-paw-bark/10 bg-white/80 px-8 py-12 shadow-paw backdrop-blur-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paw-teal-mid/10">
                <Heart className="h-5 w-5 text-paw-teal-mid" strokeWidth={1.75} />
              </div>
              <h2 className="font-display text-2xl font-semibold text-paw-ink mb-2">Pet care tips, every week</h2>
              <p className="text-sm text-paw-bark/65 mb-8">
                Join 800+ pet owners who get our vet-backed care guides and PawSewa updates.
              </p>
              {subscribed ? (
                <p className="paw-success-in rounded-xl bg-paw-teal-mid/10 px-4 py-3 text-sm font-semibold text-paw-teal">
                  You're subscribed — check your inbox!
                </p>
              ) : (
                <form onSubmit={handleNewsletter} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="paw-input flex-1"
                    required
                  />
                  <button
                    type="submit"
                    className="paw-cta-primary whitespace-nowrap px-5 py-2.5 text-sm"
                  >
                    Subscribe
                  </button>
                </form>
              )}
              <p className="mt-3 text-[11px] text-paw-bark/40">No spam. Unsubscribe at any time.</p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── SCROLL TO TOP ────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`scroll-top-btn ${scrolled ? 'visible' : ''} flex h-11 w-11 items-center justify-center rounded-full bg-paw-bark text-paw-cream shadow-paw-lg hover:bg-paw-ink transition-colors`}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
