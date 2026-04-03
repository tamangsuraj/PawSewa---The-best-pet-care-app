'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/Button';
import { LogOut, User, PawPrint, Menu, X } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/vets', label: 'Vet Directory' },
  { href: '/services', label: 'Services' },
  { href: '/blog', label: 'Blog' },
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const { user, logout, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 min-w-0" onClick={closeMobile}>
            <PawSewaLogo variant="nav" height={40} priority />
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-gray-700 hover:text-primary transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>

          {!isLoading && (
            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <>
                  <Link href="/my-pets">
                    <Button variant="ghost" className="flex items-center space-x-2">
                      <PawPrint className="w-4 h-4" />
                      <span>My Pets</span>
                    </Button>
                  </Link>
                  <Link href="/my-cases">
                    <Button variant="ghost" className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>My Cases</span>
                    </Button>
                  </Link>
                  <Link href="/my-service-requests">
                    <Button variant="ghost" className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>My Appointments</span>
                    </Button>
                  </Link>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2 px-3 py-2 bg-secondary rounded-lg">
                      <User className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium text-primary">{user.name}</span>
                    </div>
                    <Button variant="ghost" onClick={logout} className="flex items-center space-x-2">
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost">Sign In</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="primary">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            className="md:hidden p-2 text-gray-600 hover:text-primary"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className="py-2 text-gray-700 hover:text-primary transition-colors font-medium"
              >
                {label}
              </Link>
            ))}
            {!isLoading && (
              <div className="border-t border-gray-200 pt-4 mt-2 flex flex-col gap-2">
                {user ? (
                  <>
                    <Link href="/my-pets" onClick={closeMobile} className="py-2 text-gray-700 hover:text-primary">
                      My Pets
                    </Link>
                    <Link href="/my-cases" onClick={closeMobile} className="py-2 text-gray-700 hover:text-primary">
                      My Cases
                    </Link>
                    <Link href="/my-service-requests" onClick={closeMobile} className="py-2 text-gray-700 hover:text-primary">
                      My Appointments
                    </Link>
                    <span className="py-2 text-sm text-gray-500">{user.name}</span>
                    <button
                      type="button"
                      onClick={() => { closeMobile(); logout(); }}
                      className="py-2 text-left text-gray-700 hover:text-primary"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={closeMobile} className="py-2 text-gray-700 hover:text-primary font-medium">
                      Sign In
                    </Link>
                    <Link href="/register" onClick={closeMobile} className="py-2 text-primary font-medium">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
