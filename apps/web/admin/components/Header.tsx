'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAdminChatUnread } from '@/context/AdminChatUnreadContext';
import { LogOut, User, MessageCircle } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { totalUnread } = useAdminChatUnread();

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-white/70 bg-[#F7F4FC]/80 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden shrink-0 rounded-xl border border-primary/20 bg-transparent p-1.5 sm:block">
            <PawSewaLogo variant="nav" height={40} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-[#171415]">Control Room</h2>
            <p className="text-sm text-gray-600">System Administration</p>
          </div>
        </div>

        {/* Admin Info & Logout */}
        <div className="flex items-center space-x-4">
          <Link
            href="/customer-chats"
            className="relative p-2.5 rounded-xl text-primary hover:bg-primary/10 transition-colors border border-primary/15"
            aria-label="Messages"
          >
            <MessageCircle className="w-6 h-6" />
            {totalUnread > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            ) : null}
          </Link>
          {user && (
            <div className="flex items-center space-x-3 px-4 py-2 bg-white/80 rounded-xl border border-white/70 shadow-sm">
              <User className="w-5 h-5 text-[#4facfe]" />
              <div>
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-600">{user.email}</p>
              </div>
            </div>
          )}
          
          <button
            onClick={logout}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-lg transition-colors border border-gray-300"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
