import Link from 'next/link';
import {
  Building2,
  Sparkles,
  GraduationCap,
  Droplets,
  Sun,
  ChevronRight,
} from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLogo } from '@/components/PawSewaLogo';

const CARE_HUBS: {
  slug: string;
  title: string;
  blurb: string;
  icon: typeof Building2;
}[] = [
  {
    slug: 'hostel',
    title: 'Pet hostel',
    blurb: 'Overnight stays and boarding — same listings as the PawSewa app Care tab.',
    icon: Building2,
  },
  {
    slug: 'grooming',
    title: 'Grooming',
    blurb: 'Coats, nails, and spa-style care from verified providers.',
    icon: Sparkles,
  },
  {
    slug: 'training',
    title: 'Training',
    blurb: 'Obedience and behaviour support from training centres.',
    icon: GraduationCap,
  },
  {
    slug: 'spa',
    title: 'Spa',
    blurb: 'Relaxation and premium coat treatments.',
    icon: Sun,
  },
  {
    slug: 'wash',
    title: 'Wash',
    blurb: 'Quick washes and hygiene sessions.',
    icon: Droplets,
  },
];

export default function PetCarePlusPage() {
  return (
    <PageShell>
      <header className="border-b border-[#703418]/10 bg-[#faf6f0]/95 backdrop-blur-md">
        <div className="container mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PawSewaLogo variant="nav" height={48} className="!bg-transparent" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#703418]/75">PawSewa</p>
              <h1 className="font-display text-2xl font-semibold text-[#2c241c]">Pet Care+</h1>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-[#703418] underline-offset-2 hover:underline"
          >
            ← Home
          </Link>
        </div>
      </header>

      <PageContent compact className="max-w-4xl pb-20 pt-8">
        <p className="mb-10 text-center text-sm leading-relaxed text-[#2c241c]/75">
          Facility services — hostel, grooming, training, and more — in one place. Bookings use the same{' '}
          <code className="rounded bg-[#f3ebe2] px-1.5 py-0.5 text-xs">/hostels</code> and care APIs as the mobile
          app, so admin and provider apps stay in sync.
        </p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {CARE_HUBS.map(({ slug, title, blurb, icon: Icon }) => (
            <li key={slug}>
              <Link
                href={`/care/${slug}`}
                className="group flex h-full flex-col rounded-2xl border-2 border-[#703418]/12 bg-white p-6 shadow-sm transition-all hover:border-[#703418]/35 hover:shadow-[0_12px_36px_rgba(112,52,24,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#703418]/10 text-[#703418]">
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h2 className="font-display text-lg font-semibold text-[#703418]">{title}</h2>
                <p className="mt-2 flex-1 text-sm text-[#2c241c]/70">{blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#703418]">
                  Browse listings
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-12 rounded-2xl border-2 border-dashed border-[#703418]/20 bg-[#faf6f0]/80 p-6 text-center">
          <p className="text-sm text-[#2c241c]/75">
            Daycare uses the same API with <span className="font-semibold text-[#703418]">serviceType=Daycare</span>.
          </p>
          <Link
            href="/care/daycare"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#703418] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#5c2c14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2"
          >
            View daycare
          </Link>
        </div>
      </PageContent>
    </PageShell>
  );
}
