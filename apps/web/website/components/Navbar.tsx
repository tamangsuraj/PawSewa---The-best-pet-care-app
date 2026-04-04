'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Button } from './ui/Button';
import { LogOut, User, Menu, X, ShoppingCart, Bell } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { InboxDropdown } from '@/components/nav/InboxDropdown';
import { useChatHub } from '@/context/ChatHubContext';

const mainNav = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/shop', label: 'Shop' },
];

export function Navbar() {
  const { user, logout, isLoading } = useAuth();
  const { totalItems } = useCart();
  const { openHub } = useChatHub();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[#4B3621]/10 bg-[#FAF7F2]/95 backdrop-blur-md shadow-[0_8px_30px_rgba(75,54,33,0.06)]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-[4.25rem]">
          <Link href="/" className="flex items-center gap-2 min-w-0 shrink-0" onClick={closeMobile}>
            <PawSewaLogo variant="nav" height={36} priority />
          </Link>

          <div className="hidden lg:flex items-center gap-1 xl:gap-2">
            {mainNav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-[#4B3621] hover:text-[#2a1d14] text-sm font-medium px-3 py-2 rounded-xl hover:bg-[#4B3621]/6 transition-colors"
              >
                {label}
              </Link>
            ))}
            {user ? (
              <Link
                href="/my-pets"
                className="text-[#4B3621] hover:text-[#2a1d14] text-sm font-medium px-3 py-2 rounded-xl hover:bg-[#4B3621]/6 transition-colors"
              >
                My Pets
              </Link>
            ) : null}
            <InboxDropdown />
          </div>

          {!isLoading && (
            <div className="hidden lg:flex items-center gap-1">
              <button
                type="button"
                className="p-2.5 rounded-xl text-[#4B3621] hover:bg-[#4B3621]/8 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
              </button>
              <Link
                href="/checkout"
                className="p-2.5 rounded-xl text-[#4B3621] hover:bg-[#4B3621]/8 transition-colors relative"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 ? (
                  <span className="absolute top-1 right-1 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center text-[10px] font-bold bg-[#0d9488] text-white rounded-full">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                ) : null}
              </Link>
              {user ? (
                <>
                  <div className="flex items-center gap-2 pl-2 ml-1 border-l border-[#4B3621]/15">
                    <div className="w-9 h-9 rounded-full bg-[#4B3621] text-[#FAF7F2] flex items-center justify-center text-sm font-bold">
                      {user.name?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-medium text-[#4B3621] max-w-[7rem] truncate hidden xl:inline">
                      {user.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={logout}
                    className="flex items-center gap-1.5 text-[#4B3621] ml-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden xl:inline">Logout</span>
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 pl-2">
                  <Link href="/login">
                    <Button variant="ghost" className="text-[#4B3621]">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="primary" className="bg-[#4B3621] hover:bg-[#3d2a1a] text-[#FAF7F2] rounded-xl">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="lg:hidden p-2 text-[#4B3621]"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-[#4B3621]/10 bg-[#FAF7F2]">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {mainNav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className="py-2.5 text-[#4B3621] font-medium"
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
                  className="py-2.5 text-left text-[#4B3621] font-medium w-full"
                >
                  Inbox / Messages
                </button>
                <Link href="/my-pets" onClick={closeMobile} className="py-2.5 text-[#4B3621] font-medium">
                  My Pets
                </Link>
              </>
            ) : null}
            <div className="py-2 border-t border-[#4B3621]/10 mt-2 flex items-center gap-4">
              <Link href="/checkout" onClick={closeMobile} className="flex items-center gap-2 text-[#4B3621]">
                <ShoppingCart className="w-5 h-5" />
                Cart {totalItems > 0 ? `(${totalItems})` : ''}
              </Link>
            </div>
            {!isLoading && !user && (
              <div className="flex gap-2 pt-2">
                <Link href="/login" onClick={closeMobile} className="flex-1 text-center py-2 rounded-xl border border-[#4B3621]/20">
                  Sign In
                </Link>
                <Link href="/register" onClick={closeMobile} className="flex-1 text-center py-2 rounded-xl bg-[#4B3621] text-[#FAF7F2]">
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
