import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllBlogPosts, formatDate } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'PawSewa Blog',
  description: 'Pet care tips, guides, and PawSewa updates.',
};

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-r from-primary to-accent text-white py-16 px-4">
        <div className="container mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 font-poppins">
            PawSewa Blog
          </h1>
          <p className="text-secondary text-lg md:text-xl font-inter max-w-3xl">
            Guides, tips, and updates to help you care for your pets better.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        {posts.length === 0 ? (
          <div className="bg-secondary rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-inter">No blog posts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-semibold text-primary bg-secondary px-3 py-1 rounded-full">
                      {formatDate(p.date)}
                    </span>
                    <span className="text-xs text-gray-500 font-inter">
                      {p.tags.slice(0, 2).join(' · ')}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 font-poppins group-hover:text-primary transition-colors">
                    {p.title}
                  </h2>
                  {p.description ? (
                    <p className="text-gray-600 font-inter mt-2 line-clamp-3">
                      {p.description}
                    </p>
                  ) : null}
                  <div className="mt-5 text-primary font-semibold">
                    Read more →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

