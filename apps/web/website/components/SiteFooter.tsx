'use client';

import Link from 'next/link';
import { PawSewaLogo } from './PawSewaLogo';

export function SiteFooter() {
  return (
    <footer className="relative z-[1] mt-auto border-t border-paw-ink/10 bg-gradient-to-b from-paw-umber via-[#231a14] to-paw-umber text-paw-cream/95">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_0%,rgba(13,148,136,0.12),transparent)] pointer-events-none" />
      <div className="container relative mx-auto flex flex-col gap-8 px-4 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-4">
          <Link href="/" className="inline-flex rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-paw-teal-mid/50">
            <PawSewaLogo variant="nav" height={52} className="brightness-0 invert opacity-90" />
          </Link>
          <p className="text-sm leading-relaxed text-paw-cream/65">
            PawSewa — pet care, vets, and supplies in one place. Clear, kind, and built around your companion.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-10 gap-y-3 text-sm font-medium tracking-wide">
          <Link href="/about" className="text-paw-cream/80 transition-colors hover:text-paw-teal-mid">
            About
          </Link>
          <Link href="/shop" className="text-paw-cream/80 transition-colors hover:text-paw-teal-mid">
            Shop
          </Link>
          <Link href="/terms" className="text-paw-cream/80 transition-colors hover:text-paw-teal-mid">
            Terms
          </Link>
          <Link href="/privacy" className="text-paw-cream/80 transition-colors hover:text-paw-teal-mid">
            Privacy
          </Link>
        </nav>
      </div>
      <div className="relative border-t border-white/[0.06] py-5 text-center text-xs text-paw-cream/45 tracking-[0.12em] uppercase">
        © {new Date().getFullYear()} PawSewa
      </div>
    </footer>
  );
}
