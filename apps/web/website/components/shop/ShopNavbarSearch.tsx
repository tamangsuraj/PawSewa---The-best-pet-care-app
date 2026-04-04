'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

function ShopNavbarSearchInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const [val, setVal] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVal(q);
  }, [q]);

  const pushQuery = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const t = next.trim();
      if (t) params.set('q', t);
      else params.delete('q');
      const qs = params.toString();
      router.replace(qs ? `/shop?${qs}` : '/shop', { scroll: false });
    },
    [router, searchParams]
  );

  const schedulePush = useCallback(
    (raw: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => pushQuery(raw), 380);
    },
    [pushQuery]
  );

  if (pathname !== '/shop') return null;

  return (
    <div className="relative mx-2 min-w-0 max-w-[min(100%,280px)] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paw-foreground/35" />
      <input
        type="search"
        placeholder="Search essentials..."
        value={val}
        onChange={(e) => {
          const v = e.target.value;
          setVal(v);
          schedulePush(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            pushQuery(val);
          }
        }}
        className="w-full rounded-full border border-paw-foreground/12 bg-white py-2 pl-9 pr-3 text-sm text-paw-foreground shadow-sm placeholder:text-paw-foreground/40 focus:border-paw-foreground/30 focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/12"
        aria-label="Search shop products"
      />
    </div>
  );
}

export function ShopNavbarSearch() {
  return (
    <Suspense fallback={null}>
      <ShopNavbarSearchInner />
    </Suspense>
  );
}
