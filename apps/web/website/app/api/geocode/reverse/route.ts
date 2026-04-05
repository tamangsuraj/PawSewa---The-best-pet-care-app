import { NextRequest, NextResponse } from 'next/server';

const UA = 'PawSewaWeb/1.0 (https://pawsewa.app; checkout geocode)';

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ address: null, error: 'Invalid coordinates' }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ address: null, error: 'Out of range' }, { status: 400 });
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ address: null }, { status: 502 });
    }

    const data = (await res.json()) as { display_name?: string };
    const address = typeof data.display_name === 'string' ? data.display_name.trim() : null;
    return NextResponse.json({ address: address || null });
  } catch {
    return NextResponse.json({ address: null }, { status: 502 });
  }
}
