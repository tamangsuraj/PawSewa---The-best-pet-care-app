import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllBlogPosts, formatDate } from '@/lib/blog';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

export const metadata: Metadata = {
  title: 'PawSewa Blog',
  description: 'Pet care tips, guides, and PawSewa updates.',
};

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <PageShell>
      <PageHero
        eyebrow="Editorial"
        title="PawSewa blog"
        subtitle="Guides, tips, and updates to help you care for your pets better."
      />

      <PageContent>
        {posts.length === 0 ? (
          <div className="paw-surface-card rounded-2xl p-10 text-center">
            <p className="text-paw-bark/80">No blog posts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group paw-surface-card overflow-hidden rounded-[1.35rem]"
              >
                <div className="p-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-paw-sand px-3 py-1 text-xs font-semibold text-paw-bark">
                      {formatDate(p.date)}
                    </span>
                    <span className="text-xs text-paw-bark/55">{p.tags.slice(0, 2).join(' · ')}</span>
                  </div>
                  <h2 className="font-display text-xl font-semibold text-paw-ink transition-colors group-hover:text-paw-bark">
                    {p.title}
                  </h2>
                  {p.description ? (
                    <p className="mt-2 line-clamp-3 text-paw-bark/75">{p.description}</p>
                  ) : null}
                  <div className="mt-5 font-semibold text-[#0d9488]">Read more →</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}

