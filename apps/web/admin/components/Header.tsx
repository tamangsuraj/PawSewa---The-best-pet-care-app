'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, User } from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-[#F7F4FC]/80 border-b border-white/70 backdrop-blur-md shadow-sm fixed top-0 right-0 left-64 z-40">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="shrink-0 rounded-xl bg-white/90 p-1.5 border border-[#5CB0CC]/25 shadow-sm hidden sm:block">
            <PawSewaLogo variant="nav" height={40} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-[#171415]">Control Room</h2>
            <p className="text-sm text-gray-600">System Administration</p>
          </div>
        </div>

        {/* Admin Info & Logout */}
        <div className="flex items-center space-x-4">
          {user && (
            <div className="flex items-center space-x-3 px-4 py-2 bg-white/80 rounded-xl border border-white/70 shadow-sm">
              <User className="w-5 h-5 text-[#5CB0CC]" />
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
