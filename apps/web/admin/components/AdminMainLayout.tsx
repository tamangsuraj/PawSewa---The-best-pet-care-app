'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { cn } from '@/lib/utils';

/** Fixed sidebar width — keep in sync with Header offset and `md:pl-[260px]`. */
export const ADMIN_SIDEBAR_WIDTH_PX = 260;

/**
 * Persistent shell for the admin app: sidebar + top bar + scrollable content.
 * Survives route changes (Next.js keeps layout mounted). Mobile: slide-over drawer + backdrop.
 */
export default function AdminMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex min-h-dvh w-full flex-col bg-gray-50">
        {/* Mobile overlay */}
        <button
          type="button"
          aria-label="Close navigation"
          className={cn(
            'fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden',
            mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={() => setMobileNavOpen(false)}
        />

        {/* Sidebar: off-canvas on small screens, fixed column on md+ */}
        <div
          className={cn(
            'fixed left-0 top-0 z-40 min-h-dvh max-h-dvh w-[260px] transition-transform duration-200 ease-out md:translate-x-0',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
        >
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </div>

        <div
          className="flex min-h-dvh flex-1 flex-col min-w-0 w-full md:pl-[260px]"
        >
          <Header onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-24 px-4 sm:px-6 pb-8">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
