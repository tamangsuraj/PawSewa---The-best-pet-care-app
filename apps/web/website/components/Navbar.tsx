'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Button } from './ui/Button';
import { LogOut, User, Menu, X, ShoppingCart, Bell } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { InboxDropdown } from '@/components/nav/InboxDropdown';
import { useChatHub } from '@/context/ChatHubContext';
import { ShopNavbarSearch } from '@/components/shop/ShopNavbarSearch';

const mainNav = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/shop', label: 'Shop' },
  { href: '/map', label: 'Map' },
];

export function Navbar() {
  const pathname = usePathname();
  const shopActive = pathname.startsWith('/shop');
  const mapActive = pathname === '/map';
  const myPetsActive = pathname.startsWith('/my-pets');
  const { user, logout, isLoading } = useAuth();
  const { totalItems } = useCart();
  const { openHub } = useChatHub();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

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
            className="flex items-center min-w-0 shrink-0 pr-2 -ml-0.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-paw-teal-mid/40 focus-visible:ring-offset-2"
            onClick={closeMobile}
          >
            <PawSewaLogo variant="nav" height={60} priority />
          </Link>

          <div className="hidden lg:flex items-center gap-1 xl:gap-1.5">
            {mainNav.map(({ href, label }) => {
              const active =
                href === '/shop'
                  ? shopActive
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

          <button
            type="button"
            className="lg:hidden p-2 text-paw-ink"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-paw-bark/10 bg-white/90 backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-0.5">
            {mainNav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className="py-3 px-3 rounded-xl text-paw-ink font-semibold hover:bg-paw-bark/[0.06]"
              >
                {label}
              </Link>
            ))}
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    openHub();
                  }}
                  className="py-2.5 text-left text-paw-ink font-medium w-full"
                >
                  Inbox / Messages
                </button>
                <Link
                  href="/my-pets"
                  onClick={closeMobile}
                  className={
                    myPetsActive
                      ? 'py-3 px-3 rounded-xl font-semibold text-paw-cream bg-gradient-to-br from-paw-bark to-paw-ink shadow-md'
                      : 'py-3 px-3 rounded-xl text-paw-ink font-semibold hover:bg-paw-bark/[0.06]'
                  }
                >
                  My Pets
                </Link>
              </>
            ) : null}
            <div className="py-3 border-t border-paw-bark/10 mt-2 flex items-center gap-4">
              <Link
                href="/checkout"
                onClick={closeMobile}
                className="flex items-center gap-2 text-paw-ink font-semibold"
              >
                <ShoppingCart className="w-5 h-5" />
                Cart {totalItems > 0 ? `(${totalItems})` : ''}
              </Link>
            </div>
            {!isLoading && !user && (
              <div className="flex gap-2 pt-2">
                <Link
                  href="/login"
                  onClick={closeMobile}
                  className="flex-1 text-center py-3 rounded-full border border-paw-bark/20 font-semibold text-paw-ink hover:bg-paw-bark/[0.05]"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={closeMobile}
                  className="flex-1 text-center py-3 rounded-full font-semibold bg-gradient-to-br from-paw-bark to-paw-ink text-paw-cream shadow-md"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
