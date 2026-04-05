import { NextRequest, NextResponse } from 'next/server';

const UA = 'PawSewaWeb/1.0 (https://pawsewa.app; checkout geocode)';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ results: [], error: 'Geocode search failed' }, { status: 502 });
    }

    const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const results = (Array.isArray(data) ? data : [])
      .map((e) => {
        const lat = parseFloat(e.lat ?? '');
        const lon = parseFloat(e.lon ?? '');
        const displayName = (e.display_name ?? '').trim();
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !displayName) return null;
        return { lat, lon, displayName };
      })
      .filter(Boolean);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: 'Geocode search failed' }, { status: 502 });
  }
}
