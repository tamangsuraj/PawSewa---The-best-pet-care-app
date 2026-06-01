import Link from 'next/link';
import {
  ArrowRight,
  Bone,
  Building2,
  CalendarClock,
  ChevronRight,
  Droplets,
  GraduationCap,
  Heart,
  LifeBuoy,
  Sparkles,
  Stethoscope,
  Sun,
  Truck,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';

// ─── Service data ─────────────────────────────────────────────────────────────
const CLINICAL = [
  {
    icon: Stethoscope,
    title: 'Vet consultations',
    desc: 'Book verified clinicians for home visits or clinic appointments. Full calendar scheduling with preferred time windows.',
    features: ['Home visits', 'Clinic appointments', 'Real-time tracking', 'Post-visit notes'],
    href: '/services/request',
    cta: 'Book a vet visit',
    accent: 'from-[#703418] to-[#5c2c14]',
    badge: 'Most popular',
  },
  {
    icon: CalendarClock,
    title: 'Health checkup',
    desc: 'Comprehensive routine checkups — weight, vitals, dental, coat, and parasite screening with a written report.',
    features: ['Full physical exam', 'Parasite check', 'Nutrition advice', 'Written report'],
    href: '/services/request',
    cta: 'Schedule checkup',
    accent: 'from-sky-600 to-sky-800',
    badge: null,
  },
  {
    icon: Heart,
    title: 'Vaccination',
    desc: 'Core and optional vaccines administered by certified vets, recorded directly in your pet\'s health timeline.',
    features: ['Core vaccines', 'Optional boosters', 'Digital record', 'Reminder scheduling'],
    href: '/services/request',
    cta: 'Book vaccination',
    accent: 'from-violet-600 to-violet-900',
    badge: null,
  },
] as const;

const EMERGENCY = {
  icon: LifeBuoy,
  title: 'Emergency assistance',
  desc: 'Urgent help routed immediately to available vets and support staff. Available any day, prioritized above routine bookings.',
  href: '/request-assistance',
  cta: 'Get emergency help',
};

const DELIVERY = {
  icon: Truck,
  title: 'Shop & delivery',
  desc: 'Premium pet supplies delivered to your door — food, grooming tools, medications, and accessories from verified sellers.',
  href: '/shop',
  cta: 'Browse shop',
};

const CARE_PLUS = [
  { icon: Building2,      title: 'Pet hostel',  desc: 'Overnight boarding and daycare at certified facilities.',      href: '/care/hostel',   slug: 'hostel'   },
  { icon: Sparkles,       title: 'Grooming',    desc: 'Professional coat, nail, and spa care from verified partners.', href: '/care/grooming', slug: 'grooming' },
  { icon: GraduationCap,  title: 'Training',    desc: 'Obedience and behaviour programs from accredited centres.',     href: '/care/training', slug: 'training' },
  { icon: Sun,            title: 'Spa',          desc: 'Relaxation and premium coat treatment sessions.',               href: '/care/spa',      slug: 'spa'      },
  { icon: Droplets,       title: 'Wash & groom', desc: 'Quick hygiene washes and basic grooming packages.',             href: '/care/wash',     slug: 'wash'     },
  { icon: Bone,           title: 'Daycare',      desc: 'Supervised play and care during the day at partner facilities.',href: '/pet-care-plus', slug: 'daycare'  },
] as const;

const HOW_IT_WORKS = [
  { n: '01', title: 'Choose a service', body: 'Select from vet visits, care facilities, or the shop. Each flow mirrors the PawSewa mobile app.' },
  { n: '02', title: 'Pick date & time', body: 'Choose a preferred date and time window. For emergencies, skip ahead — we route immediately.' },
  { n: '03', title: 'Track in real time', body: 'Follow assignment, acceptance, travel, and arrival live. Get notifications at every step.' },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  return (
    <PageShell>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-paw-bark/10 bg-gradient-to-br from-paw-bark via-[#5c2c14] to-paw-ink px-4 py-16 text-paw-cream md:py-24">
        <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-paw-teal-mid/20 blur-[80px]" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-white/5 blur-[60px]" />
        <div className="container relative mx-auto max-w-4xl">
          <p className="paw-eyebrow text-paw-cream/70 mb-4">All services</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl mb-4">
            Care for every companion.
          </h1>
          <p className="max-w-xl text-lg text-paw-cream/75 leading-relaxed mb-8">
            Vet visits, facility care, emergency help, and everyday supplies — unified in one platform, synced with the PawSewa mobile app.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/services/request" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-paw-ink shadow-sm hover:bg-paw-cream transition-colors">
              Book a vet visit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/request-assistance" className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
              Emergency help
            </Link>
          </div>
        </div>
      </section>

      <PageContent>

        {/* ── How it works ────────────────────────────────────────────────── */}
        <div className="mb-16">
          <div className="mb-10 text-center">
            <p className="paw-eyebrow-center mb-2">How it works</p>
            <h2 className="font-display text-2xl font-semibold text-paw-ink md:text-3xl">Simple from start to finish</h2>
          </div>
          <div className="relative grid gap-8 lg:grid-cols-3">
            <div className="pointer-events-none absolute top-7 left-[16.67%] hidden w-[66.66%] h-px bg-gradient-to-r from-paw-bark/20 via-paw-teal-mid/25 to-paw-bark/20 lg:block" />
            {HOW_IT_WORKS.map(({ n, title, body }) => (
              <div key={n} className="flex flex-col items-center text-center">
                <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-paw-bark/15 bg-white shadow-paw z-10">
                  <span className="font-display text-lg font-bold text-paw-bark">{n}</span>
                  <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-paw-teal-mid text-[9px] font-bold text-white flex items-center justify-center">{n}</span>
                </div>
                <h3 className="font-display font-semibold text-paw-ink mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-paw-bark/65 max-w-xs">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Clinical services ────────────────────────────────────────────── */}
        <div className="mb-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="paw-eyebrow mb-1">Clinical</p>
              <h2 className="font-display text-2xl font-semibold text-paw-ink md:text-3xl">Veterinary services</h2>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {CLINICAL.map(({ icon: Icon, title, desc, features, href, cta, accent, badge }) => (
              <div key={title} className="paw-service-card">
                {/* Card banner */}
                <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${accent} px-6`}>
                  {badge && (
                    <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                      {badge}
                    </span>
                  )}
                  <Icon className="h-10 w-10 text-white" strokeWidth={1.5} />
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-paw-ink">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-paw-bark/65">{desc}</p>
                  </div>

                  <ul className="grid grid-cols-2 gap-1.5">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-paw-bark/70">
                        <span className="h-1 w-1 rounded-full bg-paw-teal-mid flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={href}
                    className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-paw-bark to-paw-ink py-3 text-sm font-bold text-paw-cream shadow-sm hover:shadow-paw transition-shadow"
                  >
                    {cta}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Emergency + Delivery (side by side) ─────────────────────────── */}
        <div className="mb-16 grid gap-5 md:grid-cols-2">
          {/* Emergency */}
          <div className="group relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-rose-600 to-rose-900 p-7 text-white shadow-paw">
            <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
                <EMERGENCY.icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-2xl font-semibold mb-2">{EMERGENCY.title}</h3>
              <p className="text-sm leading-relaxed text-white/80 mb-6">{EMERGENCY.desc}</p>
              <Link
                href={EMERGENCY.href}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 py-2.5 text-sm font-bold backdrop-blur-sm hover:bg-white/25 transition-colors"
              >
                {EMERGENCY.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Delivery */}
          <div className="group relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-amber-500 to-amber-700 p-7 text-white shadow-paw">
            <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15">
                <DELIVERY.icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-2xl font-semibold mb-2">{DELIVERY.title}</h3>
              <p className="text-sm leading-relaxed text-white/80 mb-6">{DELIVERY.desc}</p>
              <Link
                href={DELIVERY.href}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 py-2.5 text-sm font-bold backdrop-blur-sm hover:bg-white/25 transition-colors"
              >
                {DELIVERY.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Pet Care+ ────────────────────────────────────────────────────── */}
        <div className="mb-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="paw-eyebrow mb-1">Facilities</p>
              <h2 className="font-display text-2xl font-semibold text-paw-ink md:text-3xl">
                Pet Care+ <span className="text-paw-bark/50 font-normal text-xl">— hostel, grooming & more</span>
              </h2>
            </div>
            <Link href="/pet-care-plus" className="hidden items-center gap-1 text-sm font-semibold text-paw-teal-mid hover:underline sm:flex">
              View hub <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARE_PLUS.map(({ icon: Icon, title, desc, href }) => (
              <Link key={title} href={href} className="bento-card group p-5 flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-paw-bark/8 ring-1 ring-paw-bark/10 transition-transform duration-300 group-hover:scale-105">
                  <Icon className="h-5 w-5 text-paw-bark" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-paw-ink">{title}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-paw-bark/60">{desc}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-paw-teal-mid opacity-0 transition-opacity group-hover:opacity-100">
                    Explore <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 text-center sm:hidden">
            <Link href="/pet-care-plus" className="text-sm font-semibold text-paw-teal-mid hover:underline">
              View all Care+ facilities →
            </Link>
          </div>
        </div>

        {/* ── CTA banner ───────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-paw-bark to-paw-ink p-8 text-center text-paw-cream shadow-paw-lg sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(13,148,136,0.2),transparent_55%)]" />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold mb-3">Ready to get started?</h2>
            <p className="text-paw-cream/75 mb-8 max-w-md mx-auto text-sm leading-relaxed">
              Create an account in 2 minutes and book your first visit. Your pet's health journey begins here.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/services/request" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-paw-ink shadow-sm hover:bg-paw-cream transition-colors">
                Book a vet <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/register" className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-7 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                Create account
              </Link>
            </div>
          </div>
        </div>

      </PageContent>
    </PageShell>
  );
}
