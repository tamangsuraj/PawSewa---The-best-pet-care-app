import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllBlogPosts, formatDate } from '@/lib/blog';
import { PageShell } from '@/components/layout/PageShell';

export const metadata: Metadata = {
  title: 'PawSewa Blog',
  description: 'Pet care tips, guides, and PawSewa updates.',
};

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <PageShell>
      <section className="relative overflow-hidden bg-gradient-to-br from-paw-bark via-paw-ink to-paw-umber text-paw-cream py-16 px-4">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_15%_40%,rgba(13,148,136,0.2),transparent_55%)]"
          aria-hidden
        />
        <div className="container mx-auto relative">
          <p className="paw-eyebrow text-paw-cream/75 mb-3">Editorial</p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            PawSewa blog
          </h1>
          <p className="text-paw-cream/85 text-lg md:text-xl max-w-3xl leading-relaxed">
            Guides, tips, and updates to help you care for your pets better.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        {posts.length === 0 ? (
          <div className="bg-paw-sand rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-inter">No blog posts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group paw-card-glass rounded-2xl border border-paw-bark/10 shadow-paw hover:shadow-paw-lg transition-all hover:-translate-y-0.5 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-semibold text-paw-bark bg-paw-sand px-3 py-1 rounded-full">
                      {formatDate(p.date)}
                    </span>
                    <span className="text-xs text-gray-500 font-inter">
                      {p.tags.slice(0, 2).join(' · ')}
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-semibold text-paw-ink group-hover:text-paw-bark transition-colors">
                    {p.title}
                  </h2>
                  {p.description ? (
                    <p className="text-gray-600 font-inter mt-2 line-clamp-3">
                      {p.description}
                    </p>
                  ) : null}
                  <div className="mt-5 text-paw-bark font-semibold">
                    Read more →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

