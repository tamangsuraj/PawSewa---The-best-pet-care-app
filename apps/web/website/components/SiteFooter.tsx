'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Heart, Mail, MapPin, Phone } from 'lucide-react';
import { PAW_FOOTER_STRIP_IMAGES } from '@/lib/pawImageAssets';
import { PawSewaLogo } from './PawSewaLogo';

const FOOTER_NAV = {
  Services: [
    { label: 'Book a vet',          href: '/book-appointment'     },
    { label: 'Pet Care+',           href: '/pet-care-plus'        },
    { label: 'Emergency help',      href: '/request-assistance'   },
    { label: 'Shop supplies',       href: '/shop'                 },
    { label: 'Find vets',           href: '/vets'                 },
    { label: 'Clinic map',          href: '/map'                  },
  ],
  'My Account': [
    { label: 'Dashboard',           href: '/dashboard'            },
    { label: 'My Pets',             href: '/my-pets'              },
    { label: 'My Orders',           href: '/my-orders'            },
    { label: 'My Appointments',     href: '/my-service-requests'  },
    { label: 'Care Bookings',       href: '/care/bookings'        },
  ],
  Company: [
    { label: 'About PawSewa',       href: '/about'                },
    { label: 'Blog',                href: '/blog'                 },
    { label: 'For Partners',        href: '/register'             },
    { label: 'Privacy Policy',      href: '/privacy'              },
    { label: 'Terms of Service',    href: '/terms'                },
  ],
};

// Social icon components (inline SVG to avoid dependency)
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

export function SiteFooter() {
  const [email, setEmail] = useState('');
  const [subbed, setSubbed] = useState(false);

  const handleSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes('@')) { setSubbed(true); setEmail(''); }
  };

  return (
    <footer className="relative z-[1] mt-auto border-t border-white/10 bg-gradient-to-b from-[#1c1612] via-[#14100d] to-[#0f0c0a] text-[#f5efe8]">
      {/* Ambient teal glow */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(13,148,136,0.15),transparent_55%)]"
        aria-hidden
      />

      {/* ── Main columns ──────────────────────────────────────────────────── */}
      <div className="container relative mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr_1fr_1fr]">

          {/* Brand column */}
          <div className="space-y-6 max-w-sm">
            <Link href="/" className="inline-flex rounded-lg focus-visible:ring-2 focus-visible:ring-[#5eead4]/50 focus:outline-none">
              <PawSewaLogo variant="nav" height={52} invertOnDark />
            </Link>
            <p className="text-[15px] leading-relaxed text-[#c4bcb4]">
              Nepal's integrated pet-care platform — vets, supplies, facility care, and real-time tracking in one calm experience.
            </p>

            {/* Contact info */}
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2.5 text-sm text-[#a89f94]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-paw-teal-mid" />
                Kathmandu, Nepal
              </li>
              <li>
                <a href="mailto:hello@pawsewa.com" className="flex items-center gap-2.5 text-sm text-[#a89f94] hover:text-[#5eead4] transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-paw-teal-mid" />
                  hello@pawsewa.com
                </a>
              </li>
              <li>
                <a href="tel:+977-1-4440000" className="flex items-center gap-2.5 text-sm text-[#a89f94] hover:text-[#5eead4] transition-colors">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-paw-teal-mid" />
                  +977-1-444-0000
                </a>
              </li>
            </ul>

            {/* Social icons */}
            <div className="flex items-center gap-2">
              {[
                { Icon: FacebookIcon,  label: 'Facebook',  href: '#' },
                { Icon: InstagramIcon, label: 'Instagram', href: '#' },
                { Icon: XIcon,        label: 'X',         href: '#' },
              ].map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#a89f94] hover:border-[#5eead4]/40 hover:bg-[#5eead4]/10 hover:text-[#5eead4] transition-all"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(FOOTER_NAV).map(([section, links]) => (
            <div key={section}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a89f94]">{section}</p>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-[14px] text-[#c4bcb4] transition-colors hover:text-white underline-offset-2 hover:underline"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Newsletter ──────────────────────────────────────────────────── */}
        <div className="mt-14 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-6 py-6 backdrop-blur-sm sm:px-8 sm:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-400" strokeWidth={2} />
                <p className="text-[15px] font-semibold text-white">Pet care tips, weekly</p>
              </div>
              <p className="text-sm text-[#a89f94]">Vet-backed guides and PawSewa updates. No spam.</p>
            </div>
            {subbed ? (
              <p className="paw-success-in rounded-xl bg-paw-teal-mid/15 px-4 py-2.5 text-sm font-semibold text-[#5eead4]">
                You're subscribed!
              </p>
            ) : (
              <form onSubmit={handleSub} className="flex min-w-0 gap-2 sm:max-w-sm sm:flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-[#a89f94] outline-none focus:border-[#5eead4]/40 focus:ring-1 focus:ring-[#5eead4]/20 transition"
                />
                <button
                  type="submit"
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-paw-teal-mid px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-paw-teal"
                >
                  Subscribe <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Pet photo strip ─────────────────────────────────────────────── */}
        <div className="mt-12 border-t border-white/[0.07] pt-10">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a89f94]">Pet moments</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {PAW_FOOTER_STRIP_IMAGES.map(({ src, alt }, i) => (
              <div
                key={src}
                className="paw-item-in relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 ring-1 ring-white/5 transition-transform duration-300 hover:-translate-y-0.5"
                style={{ animationDelay: `${0.05 + i * 0.07}s` }}
              >
                <Image src={src} alt={alt} fill className="object-cover transition-transform duration-500 hover:scale-105" sizes="(max-width: 640px) 50vw, 180px" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <div className="relative border-t border-white/[0.08] bg-black/20 py-5">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#7a7068]">
              © {new Date().getFullYear()} PawSewa. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-[#7a7068]">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms"   className="hover:text-white transition-colors">Terms</Link>
              <Link href="/about"   className="hover:text-white transition-colors">About</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
