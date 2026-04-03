'use client';

import Link from 'next/link';
import { PawSewaLogo } from './PawSewaLogo';

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <div className="container mx-auto px-4 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <PawSewaLogo variant="nav" height={44} />
        </Link>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <Link href="/about" className="hover:text-primary">
            About
          </Link>
          <Link href="/shop" className="hover:text-primary">
            Shop
          </Link>
          <Link href="/terms" className="hover:text-primary">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-primary">
            Privacy
          </Link>
        </nav>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} PawSewa. Care and commerce for pets.
      </div>
    </footer>
  );
}
