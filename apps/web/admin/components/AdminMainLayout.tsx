'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

/** Fixed sidebar width — keep in sync with the aside column below. */
export const ADMIN_SIDEBAR_WIDTH_PX = 260;

/**
 * Persistent admin shell: fixed left sidebar + top bar + scrollable content.
 * No mobile slide-over drawer; navigation stays in the left rail on all breakpoints.
 */
export default function AdminMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-dvh w-full min-w-0 bg-gray-50">
        <aside className="sticky top-0 z-30 h-dvh min-h-dvh w-[260px] min-w-[260px] shrink-0 overflow-y-auto overflow-x-hidden border-r border-gray-200">
          <Sidebar />
        </aside>
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <Header />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
