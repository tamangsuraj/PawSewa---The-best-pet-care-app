'use client';

import { useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { AdminPaymentSocketListener } from '@/components/AdminPaymentSocketListener';

/** Fixed sidebar width — keep in sync with the aside column below. */
export const ADMIN_SIDEBAR_WIDTH_PX = 260;

/**
 * Persistent admin shell: fixed left sidebar + top bar + scrollable content.
 * Main column uses a horizontal scroll region so wide tables stay readable; sidebar stays fixed.
 */
export default function AdminMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    console.log('[INFO] Admin Layout updated for horizontal accessibility');
  }, []);

  return (
    <ProtectedRoute>
      <AdminPaymentSocketListener />
      <div className="flex min-h-dvh w-full min-w-0 bg-gray-50">
        <aside className="sticky top-0 z-30 min-h-dvh w-[260px] min-w-[260px] shrink-0 self-stretch overflow-y-auto overflow-x-hidden border-r border-gray-200">
          <Sidebar />
        </aside>
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col self-stretch">
          <Header />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="admin-table-scroll min-h-0 w-full min-w-0 flex-1 overflow-x-auto overflow-y-auto px-4 pb-8 pt-6 sm:px-6">
              <div className="min-w-0 max-w-none">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
