import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Clock,
  Heart,
  Leaf,
  Smartphone,
  Stethoscope,
  Target,
  UserRound,
  Zap,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PAW_DECO_IMAGES } from '@/lib/pawImageAssets';

const MISSION_STATS = [
  { value: '48+',  label: 'Verified vets'    },
  { value: '1.2k', label: 'Pets served'      },
  { value: '7',    label: 'Districts active'  },
  { value: '99%',  label: 'Positive outcomes' },
] as const;

const VALUES = [
  { icon: Zap,       title: 'Rapid response',       body: 'Centralized routing assigns the right vet in minutes, not days. Every request is tracked from submission to resolution.' },
  { icon: UserRound, title: 'Expert clinicians',     body: 'Every vet in our network is licensed, verified, and experienced. We vet the vets before they meet your pet.' },
  { icon: Clock,     title: 'Structured coverage',   body: 'Shift-based availability means help is predictable. No guessing whether a vet is free — if they\'re assigned, they\'re ready.' },
  { icon: Smartphone,title: 'Built for mobile',      body: 'The full experience lives in the app — real-time tracking, push notifications, in-app chat, and offline-ready records.' },
  { icon: Target,    title: 'Intelligent matching',  body: 'Zone-based assignment ensures the nearest available vet gets your case. Distance matters when minutes count.' },
  { icon: Leaf,      title: 'Compassionate by design', body: 'Every flow is built around one principle: reduce stress for the pet and the owner. Calm UX, clear communication.' },
] as const;

const STEPS = [
  { n: '01', title: 'Submit your request',  body: 'Open the app or website. Describe the issue, choose a time, and we handle matching. Less than 60 seconds.' },
  { n: '02', title: 'We assign a vet',      body: 'Our system matches your location and case type to the best available vet. You get notified immediately.' },
  { n: '03', title: 'Real-time tracking',   body: 'Follow your vet from acceptance to arrival on a live map. Chat directly and get instant status updates.' },
  { n: '04', title: 'Care & follow-up',     body: 'After the visit, notes and prescriptions are saved to your pet\'s profile. Reminders keep the next visit on schedule.' },
] as const;

export default function AboutPage() {
  return (
    <PageShell>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-paw-bark/10">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-paw-bark/[0.05] blur-[100px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-paw-teal-mid/[0.06] blur-[80px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-paw-haze/95 via-paw-cream/80 to-paw-sand/40" />

        <div className="container relative mx-auto max-w-5xl px-4 py-20 md:py-28">
          <div className="paw-hero-stagger max-w-2xl space-y-6">
            <p className="paw-eyebrow">Our story</p>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-paw-ink md:text-5xl">
              Built for pets, by people who understand them.
            </h1>
            <p className="text-lg leading-relaxed text-paw-bark/75 max-w-xl">
              PawSewa started with a simple question: why is it so hard to get a vet when your pet needs one? We built the answer — a platform that connects owners, vets, and supply partners in one calm, modern experience.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/services/request" className="paw-cta-primary gap-2">
                Book a visit <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/vets" className="paw-cta-secondary">
                Our vet network
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PageContent>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="mb-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {MISSION_STATS.map(({ value, label }) => (
            <div key={label} className="paw-stat-chip">
              <span className="font-display text-4xl font-semibold text-paw-bark">{value}</span>
              <p className="text-xs text-paw-bark/55">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Mission ───────────────────────────────────────────────────────── */}
        <div className="mb-16 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="space-y-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paw-teal-mid/10">
              <Heart className="h-6 w-6 text-paw-teal-mid" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-paw-ink">
              Our mission
            </h2>
            <p className="text-lg leading-relaxed text-paw-bark/80">
              To make quality pet healthcare accessible, transparent, and stress-free for every family in Nepal.
            </p>
            <p className="leading-relaxed text-paw-bark/65">
              We connect pet owners with veterinarians through a centralized dispatcher model — combining professional clinical expertise with the responsiveness of a modern platform. Every pet deserves timely, expert care. Every owner deserves to feel supported through it.
            </p>
            <p className="leading-relaxed text-paw-bark/65">
              Beyond clinical care, PawSewa integrates a curated supply marketplace and facility network — hostel, grooming, training, and spa — so the full lifecycle of pet ownership happens in one trusted space.
            </p>
          </div>

          {/* Image grid */}
          <div className="grid grid-cols-2 gap-3 overflow-hidden rounded-[1.75rem] border border-paw-bark/10 shadow-paw">
            {PAW_DECO_IMAGES.slice(0, 2).map((src, i) => (
              <div key={src} className="relative aspect-[4/3] bg-paw-haze overflow-hidden">
                <Image src={src} alt="" fill className="object-cover" sizes="25vw" priority={i === 0} />
              </div>
            ))}
            <div className="relative col-span-2 aspect-[16/7] bg-paw-haze overflow-hidden">
              <Image src={PAW_DECO_IMAGES[2]} alt="" fill className="object-cover" sizes="50vw" />
              <div className="absolute inset-0 flex items-end p-5">
                <div className="rounded-xl border border-white/20 bg-paw-ink/70 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-semibold text-white/90">Nepal's integrated pet care platform</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <div className="mb-16">
          <div className="mb-10 text-center">
            <p className="paw-eyebrow-center mb-2">The experience</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-paw-ink">How PawSewa works</h2>
            <p className="mt-2 text-paw-bark/60 max-w-md mx-auto text-sm">Four steps from problem to resolution — each one tracked, every one smooth.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="bento-card p-5 flex flex-col gap-3">
                <span className="font-display text-3xl font-semibold text-paw-bark/20">{n}</span>
                <h3 className="font-display font-semibold text-paw-ink">{title}</h3>
                <p className="text-sm leading-relaxed text-paw-bark/65">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Values grid ───────────────────────────────────────────────────── */}
        <div className="mb-16">
          <div className="mb-10 text-center">
            <p className="paw-eyebrow-center mb-2">Our values</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-paw-ink">Why PawSewa</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bento-card p-6 flex flex-col gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-paw-bark/8">
                  <Icon className="h-5 w-5 text-paw-bark" strokeWidth={1.75} />
                </div>
                <h3 className="font-display font-semibold text-paw-ink">{title}</h3>
                <p className="text-sm leading-relaxed text-paw-bark/65">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Team ─────────────────────────────────────────────────────────── */}
        <div className="mb-16 rounded-[2rem] border border-paw-bark/10 bg-white/80 p-8 shadow-paw md:p-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paw-teal-mid/10">
              <Stethoscope className="h-7 w-7 text-paw-teal-mid" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-2xl font-semibold text-paw-ink md:text-3xl">Our team</h2>
            <p className="max-w-2xl text-paw-bark/70 leading-relaxed">
              PawSewa is built by veterinary professionals, software engineers, and pet-care specialists working as one team for your companions. Our vets cover surgery, dentistry, emergency care, and general practice — united by one goal: your pet's health and your peace of mind.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {['General practice', 'Surgery', 'Dentistry', 'Emergency care', 'Dermatology', 'Nutrition'].map((spec) => (
                <span key={spec} className="rounded-full border border-paw-bark/12 bg-paw-haze px-3.5 py-1.5 text-xs font-semibold text-paw-bark/70">
                  {spec}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-paw-bark to-paw-ink p-8 text-center text-paw-cream shadow-paw-lg md:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(13,148,136,0.18),transparent_50%)]" />
          <div className="relative space-y-5">
            <h2 className="font-display text-3xl font-semibold">Ready for better pet care?</h2>
            <p className="text-paw-cream/75 max-w-xl mx-auto leading-relaxed">
              Join 1,200+ pet owners who rely on PawSewa for health, shop, and services — all in one calm experience.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-paw-ink shadow-sm hover:bg-paw-cream transition-colors">
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/vets" className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                Browse veterinarians
              </Link>
            </div>
          </div>
        </div>

      </PageContent>
    </PageShell>
  );
}
