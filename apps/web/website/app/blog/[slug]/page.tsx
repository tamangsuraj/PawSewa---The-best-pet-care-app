import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllBlogPosts, getBlogPostBySlug, formatDate } from '@/lib/blog';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';

type Props = {
  params: { slug: string };
};

export function generateStaticParams() {
  return getAllBlogPosts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getBlogPostBySlug(params.slug);
  if (!post) {
    return {
      title: 'Blog post not found · PawSewa',
      description: 'This post does not exist.',
    };
  }
  return {
    title: `${post.title} · PawSewa Blog`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      type: 'article',
    },
  };
}

function renderMarkdown(md: string) {
  // Lightweight markdown renderer (no dependencies).
  // Supports headings, paragraphs, bullet lists, and emphasis.
  const lines = md.split(/\r?\n/);
  const blocks: JSX.Element[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc pl-6 space-y-2">
        {list.map((t, i) => (
          <li key={`${key}-${i}`} className="text-paw-bark/90">
            {t}
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  const inline = (text: string) => {
    // **bold** and _italic_
    const parts: (string | { b?: string; i?: string })[] = [];
    let rest = text;
    while (rest.length) {
      const bStart = rest.indexOf('**');
      const iStart = rest.indexOf('_');
      const next = [bStart >= 0 ? bStart : Infinity, iStart >= 0 ? iStart : Infinity].reduce((a, b) => Math.min(a, b), Infinity);
      if (next === Infinity) {
        parts.push(rest);
        break;
      }
      if (next > 0) {
        parts.push(rest.slice(0, next));
        rest = rest.slice(next);
      }
      if (rest.startsWith('**')) {
        const end = rest.indexOf('**', 2);
        if (end > 1) {
          parts.push({ b: rest.slice(2, end) });
          rest = rest.slice(end + 2);
          continue;
        }
      }
      if (rest.startsWith('_')) {
        const end = rest.indexOf('_', 1);
        if (end > 0) {
          parts.push({ i: rest.slice(1, end) });
          rest = rest.slice(end + 1);
          continue;
        }
      }
      // Fallback: consume one char to avoid infinite loop
      parts.push(rest[0]);
      rest = rest.slice(1);
    }
    return parts.map((p, idx) => {
      if (typeof p === 'string') return <span key={idx}>{p}</span>;
      if (p.b) return <strong key={idx}>{p.b}</strong>;
      if (p.i) return <em key={idx}>{p.i}</em>;
      return <span key={idx} />;
    });
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const key = `b-${idx}`;
    if (!line.trim()) {
      flushList(`l-${idx}`);
      return;
    }

    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      flushList(`l-${idx}`);
      blocks.push(
        <h2 key={key} className="font-display text-2xl font-semibold text-paw-ink mt-8">
          {inline(h2[1])}
        </h2>
      );
      return;
    }
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) {
      flushList(`l-${idx}`);
      blocks.push(
        <h1 key={key} className="font-display text-3xl font-semibold text-paw-ink mt-8">
          {inline(h1[1])}
        </h1>
      );
      return;
    }
    const li = line.match(/^\-\s+(.*)$/);
    if (li) {
      list.push(li[1]);
      return;
    }

    flushList(`l-${idx}`);
    blocks.push(
      <p key={key} className="text-paw-bark/85 leading-7 mt-4">
        {inline(line)}
      </p>
    );
  });

  flushList('l-end');
  return blocks;
}

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPostBySlug(params.slug);
  if (!post) {
    return (
      <PageShell>
        <div className="container mx-auto px-4 py-16">
          <h1 className="font-display text-3xl font-semibold text-paw-ink mb-3">Post not found</h1>
          <Link href="/blog" className="text-paw-teal-mid font-semibold hover:underline">
            ← Back to blog
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Article"
        title={post.title}
        subtitle={post.description || undefined}
      />

      <article className="container mx-auto px-4 pb-16 -mt-4">
        <header className="paw-card-glass rounded-2xl border border-paw-bark/10 p-6 md:p-8 shadow-paw mb-10">
          <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
            <span className="text-xs font-semibold text-paw-bark bg-paw-cream/80 px-3 py-1 rounded-full border border-paw-bark/10">
              {formatDate(post.date)}
            </span>
            {post.tags.map((t) => (
              <span
                key={t}
                className="text-xs font-semibold text-paw-bark/80 bg-white/80 px-3 py-1 rounded-full border border-paw-bark/8"
              >
                {t}
              </span>
            ))}
          </div>
          <Link href="/blog" className="text-sm font-semibold text-paw-teal-mid hover:underline">
            ← Back to blog
          </Link>
        </header>

        <div className="prose max-w-none">
          <div className="max-w-3xl text-paw-bark/90">
            {renderMarkdown(post.content)}
          </div>
        </div>
      </article>
    </PageShell>
  );
}

