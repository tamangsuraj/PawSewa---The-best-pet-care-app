'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useChatHub } from '@/context/ChatHubContext';
import {
  Bell,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PawPrint,
  Settings,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { InboxDropdown } from '@/components/nav/InboxDropdown';
import { ShopNavbarSearch } from '@/components/shop/ShopNavbarSearch';
import { Button } from './ui/Button';

// ─── Nav items ────────────────────────────────────────────────────────────────
const MAIN_NAV = [
  { href: '/',             label: 'Home'      },
  { href: '/services',     label: 'Services'  },
  { href: '/pet-care-plus', label: 'Pet Care+' },
  { href: '/shop',         label: 'Shop'      },
  { href: '/vets',         label: 'Vets'      },
  { href: '/map',          label: 'Map'       },
];

const USER_MENU = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/my-pets',   label: 'My Pets',      icon: PawPrint        },
  { href: '/my-orders', label: 'Orders',       icon: ShoppingCart    },
  { href: '/my-service-requests', label: 'My Visits', icon: Heart    },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function Navbar() {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();
  const { totalItems } = useCart();
  const { openHub } = useChatHub();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Navbar bg change on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // ── helpers ─────────────────────────────────────────────────────────────
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const linkBase = 'text-sm font-semibold tracking-tight px-3.5 py-2 rounded-full transition-all duration-200';
  const linkIdle = 'text-paw-bark/90 hover:text-paw-ink hover:bg-paw-bark/[0.07]';
  const linkActive = 'text-paw-cream bg-gradient-to-br from-paw-bark to-paw-ink shadow-[0_4px_18px_rgba(112,52,24,0.22)] ring-1 ring-paw-ink/15';

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <>
      <nav
        className={`sticky top-0 z-50 border-b border-paw-bark/10 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 shadow-[0_4px_32px_rgba(112,52,24,0.09)] backdrop-blur-2xl'
            : 'bg-white/80 backdrop-blur-2xl'
        }`}
      >
        <div className="container mx-auto px-4 sm:px-5">
          <div className="flex items-center justify-between min-h-[4.75rem] py-2 sm:min-h-[5.125rem] sm:py-2.5">

            {/* Logo */}
            <Link
              href="/"
              className="-ml-0.5 flex min-w-0 shrink-0 items-center rounded-xl pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-paw-teal-mid/40 focus-visible:ring-offset-2"
            >
              <PawSewaLogo variant="nav" height={60} priority />
            </Link>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-0.5 xl:gap-1">
              {MAIN_NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`${linkBase} ${isActive(href) ? linkActive : linkIdle}`}
                >
                  {label}
                </Link>
              ))}
              {user && (
                <Link
                  href="/my-pets"
                  className={`${linkBase} ${isActive('/my-pets') ? linkActive : linkIdle}`}
                >
                  My Pets
                </Link>
              )}
            </div>

            {/* Desktop right actions */}
            <div className="flex items-center gap-1.5">
              {/* Search (shop pages) */}
              <ShopNavbarSearch />

              {!isLoading && (
                <>
                  {/* Inbox */}
                  <div className="hidden lg:block">
                    <InboxDropdown />
                  </div>

                  {/* Chat (mobile) */}
                  {user && (
                    <button
                      type="button"
                      onClick={openHub}
                      className="relative p-2.5 rounded-full text-paw-ink hover:bg-paw-bark/[0.08] transition-colors lg:hidden border border-transparent hover:border-paw-bark/12"
                      aria-label="Open inbox"
                    >
                      <MessageCircle className="w-[1.1rem] h-[1.1rem]" strokeWidth={2} />
                    </button>
                  )}

                  {/* Notifications bell */}
                  <button
                    type="button"
                    className="relative hidden lg:flex p-2.5 rounded-full text-paw-ink hover:bg-paw-bark/[0.08] transition-colors border border-transparent hover:border-paw-bark/12"
                    aria-label="Notifications"
                  >
                    <Bell className="w-[1.1rem] h-[1.1rem]" strokeWidth={2} />
                  </button>

                  {/* Cart */}
                  <Link
                    href="/checkout"
                    className="relative p-2.5 rounded-full text-paw-ink hover:bg-paw-bark/[0.08] transition-colors border border-transparent hover:border-paw-bark/12"
                    aria-label="Shopping cart"
                  >
                    <ShoppingCart className="w-[1.1rem] h-[1.1rem]" strokeWidth={2} />
                    {totalItems > 0 && (
                      <span key={totalItems} className="absolute top-0.5 right-0.5 min-w-[1.05rem] h-[1.05rem] flex items-center justify-center text-[9px] font-bold bg-paw-teal-mid text-white rounded-full ring-2 ring-white paw-pop">
                        {totalItems > 9 ? '9+' : totalItems}
                      </span>
                    )}
                  </Link>

                  {/* User: desktop */}
                  {user ? (
                    <div ref={profileRef} className="relative hidden lg:block">
                      <button
                        type="button"
                        onClick={() => setProfileOpen((o) => !o)}
                        className="flex items-center gap-2 rounded-full border border-paw-bark/12 bg-paw-haze/60 pl-1 pr-3 py-1 transition-colors hover:bg-paw-sand/60"
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-paw-bark to-paw-ink text-paw-cream flex items-center justify-center text-xs font-bold shadow-sm">
                          {user.name?.charAt(0)?.toUpperCase() ?? <User className="w-4 h-4" />}
                        </div>
                        <span className="max-w-[7rem] truncate text-sm font-semibold text-paw-ink hidden xl:block">
                          {user.name}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 text-paw-bark/60 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Profile dropdown */}
                      {profileOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-paw-bark/10 bg-white shadow-paw-lg overflow-hidden z-50 paw-dropdown-enter">
                          <div className="px-4 py-3.5 border-b border-paw-bark/8">
                            <p className="text-sm font-bold text-paw-ink truncate">{user.name}</p>
                            <p className="text-xs text-paw-bark/55 truncate">{user.email}</p>
                          </div>
                          <div className="py-1.5">
                            {USER_MENU.map(({ href, label, icon: Icon }) => (
                              <Link
                                key={href}
                                href={href}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-paw-ink hover:bg-paw-haze/60 transition-colors"
                                onClick={() => setProfileOpen(false)}
                              >
                                <Icon className="h-4 w-4 text-paw-bark/60 shrink-0" strokeWidth={1.75} />
                                {label}
                              </Link>
                            ))}
                          </div>
                          <div className="border-t border-paw-bark/8 py-1.5">
                            <button
                              type="button"
                              onClick={() => { logout(); setProfileOpen(false); }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                              Sign out
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="hidden lg:flex items-center gap-2 pl-1">
                      <Link href="/login">
                        <Button variant="ghost" className="text-paw-ink rounded-full font-semibold hover:bg-paw-bark/[0.07]">
                          Sign In
                        </Button>
                      </Link>
                      <Link href="/register">
                        <Button
                          variant="primary"
                          className="rounded-full px-5 font-semibold shadow-[0_6px_22px_rgba(112,52,24,0.2)] bg-gradient-to-br from-paw-bark to-paw-ink hover:from-[#5c2c14] hover:to-[#4a2310] text-paw-cream border border-paw-ink/12"
                        >
                          Get Started
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Hamburger — mobile/tablet only */}
                  <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-paw-bark/12 text-paw-ink hover:bg-paw-bark/[0.08] transition-colors lg:hidden"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile menu ─────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="paw-mobile-overlay"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />

          {/* Panel */}
          <div className="paw-mobile-panel flex flex-col overflow-y-auto">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-paw-bark/10 px-5 py-4">
              <PawSewaLogo variant="nav" height={48} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-paw-bark/12 text-paw-ink hover:bg-paw-bark/[0.08] transition-colors"
                aria-label="Close menu"
              >
                <X className="h-4.5 w-4.5" strokeWidth={2.25} />
              </button>
            </div>

            {/* User info */}
            {user && (
              <div className="border-b border-paw-bark/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-paw-bark to-paw-ink flex items-center justify-center text-sm font-bold text-paw-cream shadow-sm shrink-0">
                    {user.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-paw-ink truncate">{user.name}</p>
                    <p className="text-xs text-paw-bark/55 truncate">{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nav links */}
            <nav className="flex flex-col gap-0.5 px-3 py-4">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-paw-bark/40">Navigation</p>
              {MAIN_NAV.map(({ href, label }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={`paw-item-in flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    isActive(href)
                      ? 'bg-paw-bark text-paw-cream'
                      : 'text-paw-ink hover:bg-paw-haze'
                  }`}
                  style={{ animationDelay: `${0.06 + i * 0.055}s` }}
                >
                  {label}
                </Link>
              ))}
              {user && (
                <>
                  <p className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-paw-bark/40">My Account</p>
                  {USER_MENU.map(({ href, label, icon: Icon }, i) => (
                    <Link
                      key={href}
                      href={href}
                      className={`paw-item-in flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                        isActive(href)
                          ? 'bg-paw-bark text-paw-cream'
                          : 'text-paw-ink hover:bg-paw-haze'
                      }`}
                      style={{ animationDelay: `${0.38 + i * 0.055}s` }}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-60" strokeWidth={1.75} />
                      {label}
                    </Link>
                  ))}
                  <Link
                    href="/checkout"
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                      isActive('/checkout') ? 'bg-paw-bark text-paw-cream' : 'text-paw-ink hover:bg-paw-haze'
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4 shrink-0 opacity-60" strokeWidth={1.75} />
                    Cart {totalItems > 0 ? `(${totalItems})` : ''}
                  </Link>
                </>
              )}
            </nav>

            {/* Bottom actions */}
            <div className="mt-auto border-t border-paw-bark/10 px-4 py-5">
              {user ? (
                <button
                  type="button"
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" strokeWidth={2} />
                  Sign out
                </button>
              ) : (
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className="flex flex-1 items-center justify-center rounded-xl border border-paw-bark/20 py-3 text-sm font-semibold text-paw-ink hover:bg-paw-haze transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="flex flex-1 items-center justify-center rounded-xl bg-gradient-to-br from-paw-bark to-paw-ink py-3 text-sm font-semibold text-paw-cream shadow-sm transition-colors hover:from-[#5c2c14]"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
