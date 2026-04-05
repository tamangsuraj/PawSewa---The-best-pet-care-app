'use client';

import Image from 'next/image';
import Link from 'next/link';
import { PAW_FOOTER_STRIP_IMAGES } from '@/lib/pawImageAssets';
import { PawSewaLogo } from './PawSewaLogo';

const FOOTER_PET_STRIP = [...PAW_FOOTER_STRIP_IMAGES];

export function SiteFooter() {
  return (
    <footer className="relative z-[1] mt-auto border-t border-white/10 bg-gradient-to-b from-[#1c1612] via-[#14100d] to-[#0f0c0a] text-[#f5efe8]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-20%,rgba(13,148,136,0.18),transparent_55%)]"
        aria-hidden
      />
      <div className="container relative mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="max-w-lg space-y-5">
            <div className="inline-flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-5 backdrop-blur-sm sm:px-6 sm:py-6">
              <Link
                href="/"
                className="inline-flex w-fit rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5eead4]/50"
              >
                <PawSewaLogo variant="nav" height={54} invertOnDark />
              </Link>
              <p className="text-base leading-relaxed text-[#ebe3d9] sm:text-[17px]">
                PawSewa — pet care, vets, and supplies in one place. Clear, kind, and built around your
                companion.
              </p>
            </div>
          </div>

          <nav
            className="flex flex-wrap gap-x-8 gap-y-4 text-[15px] font-semibold tracking-wide sm:gap-x-10 lg:pt-2 lg:text-base"
            aria-label="Footer"
          >
            <Link
              href="/about"
              className="text-[#f8f4ef] underline-offset-4 transition-colors hover:text-[#5eead4] hover:underline"
            >
              About
            </Link>
            <Link
              href="/shop"
              className="text-[#f8f4ef] underline-offset-4 transition-colors hover:text-[#5eead4] hover:underline"
            >
              Shop
            </Link>
            <Link
              href="/terms"
              className="text-[#f8f4ef] underline-offset-4 transition-colors hover:text-[#5eead4] hover:underline"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-[#f8f4ef] underline-offset-4 transition-colors hover:text-[#5eead4] hover:underline"
            >
              Privacy
            </Link>
          </nav>
        </div>

        <div className="mt-12 border-t border-white/[0.07] pt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a89f94]">
            Pet moments
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {FOOTER_PET_STRIP.map(({ src, alt }) => (
              <div
                key={src}
                className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/5"
              >
                <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width:640px) 50vw, 180px" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/[0.08] bg-black/20 py-7 text-center">
        <p className="text-sm font-medium tracking-wide text-[#d4cbc0]">
          © {new Date().getFullYear()} PawSewa
        </p>
      </div>
    </footer>
  );
}
