'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Button } from './ui/Button';
import { LogOut, User, ShoppingCart, Bell } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { InboxDropdown } from '@/components/nav/InboxDropdown';
import { useChatHub } from '@/context/ChatHubContext';
import { ShopNavbarSearch } from '@/components/shop/ShopNavbarSearch';

const mainNav = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/pet-care-plus', label: 'Pet Care+' },
  { href: '/shop', label: 'Shop' },
  { href: '/map', label: 'Map' },
];

export function Navbar() {
  const pathname = usePathname();
  const shopActive = pathname.startsWith('/shop');
  const petCarePlusActive = pathname.startsWith('/pet-care-plus') || pathname.startsWith('/care');
  const mapActive = pathname === '/map';
  const myPetsActive = pathname.startsWith('/my-pets');
  const { user, logout, isLoading } = useAuth();
  const { totalItems } = useCart();
  const { openHub } = useChatHub();

  const linkBase =
    'text-sm font-semibold tracking-tight px-3.5 py-2 rounded-full transition-all duration-200';
  const linkIdle =
    'text-paw-bark/90 hover:text-paw-ink hover:bg-paw-bark/[0.07]';
  const linkActive =
    'text-paw-cream bg-gradient-to-br from-paw-bark to-paw-ink shadow-[0_4px_18px_rgba(112,52,24,0.22)] ring-1 ring-paw-ink/15';

  return (
    <nav className="sticky top-0 z-50 border-b border-paw-bark/10 bg-white/80 backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_20px_56px_rgba(112,52,24,0.07)]">
      <div className="container mx-auto px-4 sm:px-5">
        <div className="flex items-center justify-between min-h-[4.75rem] py-2 sm:min-h-[5.125rem] sm:py-2.5">
          <Link
            href="/"
            className="-ml-0.5 flex min-w-0 shrink-0 items-center rounded-xl pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-paw-teal-mid/40 focus-visible:ring-offset-2"
          >
            <PawSewaLogo variant="nav" height={60} priority />
          </Link>

          <div className="hidden lg:flex items-center gap-1 xl:gap-1.5">
            {mainNav.map(({ href, label }) => {
              const active =
                href === '/shop'
                  ? shopActive
                  : href === '/pet-care-plus'
                    ? petCarePlusActive
                    : href === '/map'
                      ? mapActive
                      : pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`${linkBase} ${active ? linkActive : linkIdle}`}
                >
                  {label}
                </Link>
              );
            })}
            {user ? (
              <Link
                href="/my-pets"
                className={`${linkBase} ${myPetsActive ? linkActive : linkIdle}`}
              >
                My Pets
              </Link>
            ) : null}
            <InboxDropdown />
          </div>

          <ShopNavbarSearch />

          {!isLoading && (
            <div className="hidden lg:flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="p-2.5 rounded-full text-paw-ink hover:bg-paw-bark/[0.08] transition-colors relative border border-transparent hover:border-paw-bark/12"
                aria-label="Notifications"
              >
                <Bell className="w-[1.15rem] h-[1.15rem]" strokeWidth={2} />
              </button>
              <Link
                href="/checkout"
                className="p-2.5 rounded-full text-paw-ink hover:bg-paw-bark/[0.08] transition-colors relative border border-transparent hover:border-paw-bark/12"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="w-[1.15rem] h-[1.15rem]" strokeWidth={2} />
                {totalItems > 0 ? (
                  <span className="absolute top-0.5 right-0.5 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center text-[10px] font-bold bg-paw-teal-mid text-white rounded-full shadow-sm ring-2 ring-white">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                ) : null}
              </Link>
              {user ? (
                <>
                  <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-paw-bark/12">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-paw-bark to-paw-ink text-paw-cream flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-white/80">
                      {user.name?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-semibold text-paw-ink max-w-[7rem] truncate hidden xl:inline">
                      {user.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={logout}
                    className="flex items-center gap-1.5 text-paw-ink ml-0.5 rounded-full hover:bg-paw-bark/[0.06]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden xl:inline font-medium">Logout</span>
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 pl-2">
                  <Link href="/login">
                    <Button
                      variant="ghost"
                      className="text-paw-ink rounded-full font-semibold hover:bg-paw-bark/[0.07]"
                    >
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
            </div>
          )}

        </div>
      </div>

      {/* Mobile / tablet: persistent top-rail links (no hamburger drawer). */}
      <div className="border-t border-paw-bark/10 bg-white/75 backdrop-blur-lg lg:hidden">
        <div className="container mx-auto px-3 pb-3 pt-1">
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {mainNav.map(({ href, label }) => {
              const active =
                href === '/shop'
                  ? shopActive
                  : href === '/pet-care-plus'
                    ? petCarePlusActive
                    : href === '/map'
                      ? mapActive
                      : pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold tracking-tight transition-colors ${
                    active ? linkActive : linkIdle
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    openHub();
                  }}
                  className="shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold tracking-tight text-paw-bark/90 hover:bg-paw-bark/[0.07]"
                >
                  Message Center
                </button>
                <Link
                  href="/my-pets"
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold tracking-tight ${
                    myPetsActive ? linkActive : linkIdle
                  }`}
                >
                  My Pets
                </Link>
              </>
            ) : null}
            <Link
              href="/checkout"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold text-paw-ink hover:bg-paw-bark/[0.06]"
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={2} />
              Cart{totalItems > 0 ? ` (${totalItems})` : ''}
            </Link>
            {!isLoading && !user ? (
              <>
                <Link
                  href="/login"
                  className="shrink-0 whitespace-nowrap rounded-full border border-paw-bark/18 px-3.5 py-2 text-xs font-semibold text-paw-ink"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="shrink-0 whitespace-nowrap rounded-full bg-gradient-to-br from-paw-bark to-paw-ink px-3.5 py-2 text-xs font-semibold text-paw-cream shadow-sm"
                >
                  Register
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
