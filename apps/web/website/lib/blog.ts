import fs from 'fs';
import path from 'path';

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  tags: string[];
  content: string;
};

export type BlogPostMeta = Omit<BlogPost, 'content'>;

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

function safeReadDir(dir: string) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const trimmed = raw.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---')) return { data: {}, content: raw };

  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) return { data: {}, content: raw };

  const fmBlock = trimmed.slice(3, end).trim();
  const content = trimmed.slice(end + '\n---'.length).trimStart();

  const data: Record<string, unknown> = {};
  for (const line of fmBlock.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (!key) continue;

    // Arrays: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      const parts = inner
        ? inner.split(',').map((p) => p.trim()).filter(Boolean)
        : [];
      data[key] = parts.map((p) => p.replace(/^['"]|['"]$/g, ''));
      continue;
    }

    // Strings
    data[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return { data, content };
}

export function getAllBlogPosts(): BlogPost[] {
  const files = safeReadDir(BLOG_DIR).filter((f) => f.endsWith('.md'));
  const posts: BlogPost[] = [];

  for (const file of files) {
    const full = path.join(BLOG_DIR, file);
    const raw = fs.readFileSync(full, 'utf8');
    const { data, content } = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, '');
    const title = String(data.title ?? slug);
    const description = String(data.description ?? '');
    const date = String(data.date ?? '');
    const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];

    posts.push({ slug, title, description, date, tags, content });
  }

  // Newest first
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts;
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  const full = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ''),
    date: String(data.date ?? ''),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    content,
  };
}

export function toMeta(post: BlogPost): BlogPostMeta {
  // Avoid leaking raw markdown where not needed
  const { content: _content, ...meta } = post;
  return meta;
}

export function formatDate(date: string) {
  // Keep stable and SSR-friendly.
  // Input expected YYYY-MM-DD
  const [y, m, d] = date.split('-').map((x) => Number(x));
  if (!y || !m || !d) return date;
  return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
}

