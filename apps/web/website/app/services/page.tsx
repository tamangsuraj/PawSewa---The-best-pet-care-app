import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';

export default function ServicesPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="What we offer"
        title="Our services"
        subtitle="Comprehensive care, retail, and logistics — designed around your pet’s life."
      />

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              emoji: '🏥',
              title: 'Veterinary care',
              desc: 'Professional services with experienced clinicians — including emergency support.',
              items: ['Emergency care', 'Regular check-ups', 'Vaccinations', 'Surgery'],
            },
            {
              emoji: '✂️',
              title: 'Pet grooming',
              desc: 'Spa and hygiene sessions to keep coats, nails, and ears in top shape.',
              items: ['Bathing & styling', 'Nail trimming', 'Ear cleaning', 'Teeth cleaning'],
            },
            {
              emoji: '🏠',
              title: 'Pet boarding',
              desc: 'Safe, supervised stays when you are away from home.',
              items: ['Climate controlled', '24/7 supervision', 'Play areas', 'Special diets'],
            },
            {
              emoji: '🛒',
              title: 'Pet shop',
              desc: 'Food, toys, and wellness products curated for dogs, cats, and more.',
              items: ['Premium food', 'Toys & accessories', 'Supplements', 'Apparel'],
            },
            {
              emoji: '🎓',
              title: 'Pet training',
              desc: 'Structured programs for obedience, manners, and confidence.',
              items: ['Basic obedience', 'Behavior support', 'Socialization', 'Advanced skills'],
            },
            {
              emoji: '🚚',
              title: 'Home delivery',
              desc: 'Reliable delivery of supplies straight to your door.',
              items: ['Same-day options', 'Scheduled drops', 'Subscriptions', 'Fair shipping'],
            },
          ].map((card) => (
            <div
              key={card.title}
              className="paw-card-glass rounded-2xl border border-paw-bark/8 p-8 shadow-paw hover:shadow-paw-lg transition-shadow"
            >
              <div className="text-5xl mb-4" aria-hidden>
                {card.emoji}
              </div>
              <h2 className="font-display text-2xl font-semibold text-paw-ink mb-3">{card.title}</h2>
              <p className="text-paw-bark/75 mb-4 leading-relaxed">{card.desc}</p>
              <ul className="space-y-2 text-paw-bark/85 text-sm">
                {card.items.map((li) => (
                  <li key={li}>✓ {li}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-paw-bark via-paw-ink to-paw-umber text-paw-cream p-10 md:p-12 text-center shadow-paw-lg border border-white/10">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_100%,rgba(13,148,136,0.2),transparent_50%)]"
            aria-hidden
          />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold mb-4">Need help right now?</h2>
            <p className="text-lg text-paw-cream/85 mb-8 max-w-lg mx-auto">
              Request assistance and we will route your case to the best available veterinarian.
            </p>
            <Link
              href="/my-pets"
              className="inline-block px-8 py-4 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors text-lg shadow-paw"
            >
              Request assistance
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
