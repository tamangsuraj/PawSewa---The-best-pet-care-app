import { NextResponse } from 'next/server';
import { getAllBlogPosts, toMeta } from '@/lib/blog';

export const dynamic = 'force-static';

export function GET() {
  const posts = getAllBlogPosts().map(toMeta);
  return NextResponse.json({ success: true, data: posts });
}

