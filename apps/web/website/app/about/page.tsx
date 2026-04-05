import Link from 'next/link';
import { Heart, Zap, UserRound, Clock, Smartphone, Target, Leaf } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';

export default function AboutPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Our story"
        title="About PawSewa"
        subtitle="Your trusted partner in pet care — from dispatch to shop and clinic."
      />

      <div className="container mx-auto px-4 py-12">
        <div className="paw-card-glass rounded-[1.75rem] border border-paw-bark/10 shadow-paw p-10 md:p-12 mb-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-paw-teal/10 text-paw-teal-mid">
              <Heart className="h-8 w-8" strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className="font-display text-3xl font-semibold text-paw-ink mb-6">Our mission</h2>
            <p className="text-xl text-paw-bark/85 leading-relaxed mb-6">
              At PawSewa, we connect pet owners with veterinarians and services through a centralized
              dispatcher model — so your companion gets timely, professional attention.
            </p>
            <p className="text-lg text-paw-bark/70 leading-relaxed">
              We aim to make quality pet healthcare accessible, efficient, and calm for every family that
              trusts PawSewa.
            </p>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="font-display text-3xl font-semibold text-paw-ink text-center mb-10">
            How PawSewa works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Request assistance',
                body: 'Submit your pet’s issue through the app or site. We handle vet matching — you focus on your pet.',
              },
              {
                step: '2',
                title: 'We assign a vet',
                body: 'Our team reviews your case and assigns the best available veterinarian for the shift and specialty.',
              },
              {
                step: '3',
                title: 'Get expert care',
                body: 'The assigned vet reaches out and provides care. Track status in real time from your dashboard.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="paw-card-glass rounded-2xl border border-paw-bark/8 p-8 text-center shadow-paw"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-paw-bark to-paw-ink text-paw-cream rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-paw-glow">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-paw-ink mb-3">{item.title}</h3>
                <p className="text-paw-bark/75 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-paw-bark via-paw-ink to-paw-umber text-paw-cream p-10 md:p-12 mb-12 shadow-paw-lg border border-white/10">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_10%_90%,rgba(13,148,136,0.18),transparent_55%)]"
            aria-hidden
          />
          <h2 className="font-display text-3xl font-semibold text-center mb-10 relative">
            Why choose PawSewa?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto relative">
            {[
              { icon: Zap, title: 'Fast response', body: 'Centralized routing for quicker assignment and follow-up.' },
              { icon: UserRound, title: 'Expert veterinarians', body: 'Licensed professionals with deep clinical experience.' },
              { icon: Clock, title: 'Shift-based coverage', body: 'Structured availability so help is there when it matters.' },
              { icon: Smartphone, title: 'Simple to use', body: 'Clear flows on web and mobile — less friction, more care.' },
              { icon: Target, title: 'Smart matching', body: 'We align your pet’s needs with the right clinician.' },
              { icon: Leaf, title: 'Compassionate care', body: 'Every animal is treated with patience and respect.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="shrink-0 rounded-xl bg-white/10 p-2.5 border border-white/15">
                  <Icon className="h-6 w-6 text-paw-cream" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{title}</h3>
                  <p className="text-paw-cream/85 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="font-display text-3xl font-semibold text-paw-ink text-center mb-8">Our team</h2>
          <div className="paw-card-glass rounded-[1.75rem] border border-paw-bark/8 p-10 md:p-12 shadow-paw">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-lg text-paw-bark/80 leading-relaxed mb-6">
                PawSewa is built by veterinary professionals, dispatchers, and pet-care specialists
                working as one crew for your companions.
              </p>
              <p className="text-lg text-paw-bark/80 leading-relaxed">
                Our vets cover surgery, dentistry, emergency care, and general practice — united by
                one goal: your pet’s health and peace of mind.
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-paw-bark to-paw-umber text-paw-cream p-10 md:p-12 text-center shadow-paw-lg border border-white/10">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(13,148,136,0.2),transparent_50%)]"
            aria-hidden
          />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold mb-4">Ready for better pet care?</h2>
            <p className="text-xl text-paw-cream/85 mb-8 max-w-xl mx-auto">
              Join pet owners who rely on PawSewa for health, shop, and services in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-block px-8 py-4 rounded-full bg-paw-cream text-paw-ink font-semibold hover:bg-white transition-colors text-lg shadow-paw"
              >
                Get started
              </Link>
              <Link
                href="/vets"
                className="inline-block px-8 py-4 rounded-full bg-white/10 border border-white/25 text-paw-cream font-semibold hover:bg-white/15 transition-colors text-lg"
              >
                Browse veterinarians
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
