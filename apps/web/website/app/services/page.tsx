import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

export default function ServicesPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="What we offer"
        title="Our services"
        subtitle="Clinical visits, facility care (Pet Care+), shop delivery, and emergency help — aligned with the PawSewa app."
      />

      <PageContent>
        <div className="mb-12 flex flex-wrap justify-center gap-3">
          <Link
            href="/book-appointment"
            className="inline-flex items-center justify-center rounded-full bg-[#703418] px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#5c2c14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2"
          >
            Book an appointment
          </Link>
          <Link
            href="/request-assistance"
            className="inline-flex items-center justify-center rounded-full border-2 border-[#703418] bg-white px-6 py-3 text-sm font-bold text-[#703418] transition-colors hover:bg-[#703418]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2"
          >
            Request assistance
          </Link>
          <Link
            href="/pet-care-plus"
            className="inline-flex items-center justify-center rounded-full border-2 border-[#703418]/30 bg-[#faf6f0] px-6 py-3 text-sm font-bold text-[#703418] transition-colors hover:border-[#703418]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2"
          >
            Pet Care+ facilities
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              emoji: '🏥',
              title: 'Veterinary care',
              desc: 'Book appointments (checkup, vaccination, consultation) with the same calendar and time windows as the mobile app.',
              items: ['Book via web', 'Emergency assistance', 'Vaccinations', 'Follow-ups in My appointments'],
              href: '/book-appointment',
              cta: 'Book now',
            },
            {
              emoji: '✂️',
              title: 'Pet grooming & spa',
              desc: 'Listed under Pet Care+ with the same /hostels APIs as the app.',
              items: ['Grooming', 'Spa', 'Wash'],
              href: '/pet-care-plus',
              cta: 'Open Pet Care+',
            },
            {
              emoji: '🏠',
              title: 'Hostel & daycare',
              desc: 'Boarding and daytime care — bookings sync to admin and provider tools.',
              items: ['Overnight hostel', 'Daycare centres'],
              href: '/care/hostel',
              cta: 'Browse hostel',
            },
            {
              emoji: '🛒',
              title: 'Pet shop',
              desc: 'Food, toys, and wellness products — home delivery logistics stay on Shop.',
              items: ['Premium food', 'Toys & accessories', 'Checkout with map pin'],
              href: '/shop',
              cta: 'Go to shop',
            },
            {
              emoji: '🎓',
              title: 'Pet training',
              desc: 'Training centres under Pet Care+.',
              items: ['Obedience', 'Behaviour support', 'Socialisation'],
              href: '/care/training',
              cta: 'Find training',
            },
            {
              emoji: '💉',
              title: 'Reminders',
              desc: 'Vaccination and care reminders live on your pet profiles.',
              items: ['Timeline in My Pets', 'Synced with clinical dashboard'],
              href: '/my-pets',
              cta: 'My Pets',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-[1.35rem] border-2 border-[#703418]/10 bg-white p-8 shadow-sm">
              <div className="mb-4 text-5xl" aria-hidden>
                {card.emoji}
              </div>
              <h2 className="font-display mb-3 text-2xl font-semibold text-[#703418]">{card.title}</h2>
              <p className="mb-4 leading-relaxed text-paw-bark/75">{card.desc}</p>
              <ul className="mb-6 space-y-2 text-sm text-paw-bark/85">
                {card.items.map((li) => (
                  <li key={li}>✓ {li}</li>
                ))}
              </ul>
              <Link
                href={card.href}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#703418] py-3 text-sm font-bold text-white transition-colors hover:bg-[#5c2c14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2"
              >
                {card.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="relative mt-16 overflow-hidden rounded-[1.75rem] border-2 border-[#703418]/20 bg-gradient-to-br from-[#703418] via-[#5c2c14] to-[#2c241c] p-10 text-center text-paw-cream shadow-paw-lg md:p-12">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_100%,rgba(13,148,136,0.2),transparent_50%)]"
            aria-hidden
          />
          <div className="relative">
            <h2 className="font-display mb-4 text-3xl font-semibold">Need help right now?</h2>
            <p className="mx-auto mb-8 max-w-lg text-lg text-paw-cream/85">
              Request assistance and we will route your case to the best available veterinarian.
            </p>
            <Link
              href="/request-assistance"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-bold text-[#703418] shadow-md transition-colors hover:bg-[#faf6f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#703418]"
            >
              Request assistance
            </Link>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
