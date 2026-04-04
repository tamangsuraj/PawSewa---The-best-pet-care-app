'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Settings,
  Store,
  Home,
  Bike,
  ClipboardList,
  History,
  Tag,
  Package,
  CreditCard,
  FileText,
  ChevronDown,
  ChevronRight,
  DollarSign,
  UserPlus,
  CalendarCheck,
  BellRing,
  Megaphone,
  Calendar,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavLink {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Cases',
    icon: ClipboardList,
    children: [
      { name: 'Live Cases', href: '/cases', icon: ClipboardList, highlight: true },
      { name: 'Past Cases', href: '/cases/past', icon: History },
    ],
  },
  {
    label: 'Pet Supply Order',
    icon: Package,
    children: [
      { name: 'Live Orders', href: '/supplies', icon: Package },
      { name: 'Past Orders', href: '/supplies/past', icon: History },
    ],
  },
];

const appointmentsGroup: NavGroup = {
  label: 'Appointments',
  icon: Calendar,
  children: [{ name: 'Calendar', href: '/appointments', icon: Calendar }],
};

const careManagementGroup: NavGroup = {
  label: 'Care Management',
  icon: Home,
  children: [
    { name: 'Care Hostels', href: '/care/hostels', icon: Home },
    { name: 'Service Providers', href: '/care/service-providers', icon: UserCheck },
    { name: 'Provider Revenue', href: '/care/provider-revenue', icon: DollarSign },
    { name: 'Pending Approvals', href: '/care/pending-approvals', icon: UserPlus },
    { name: 'Care Bookings', href: '/care/bookings', icon: CalendarCheck },
  ],
};

const collapsibleNavGroups: NavGroup[] = [
  ...navGroups,
  appointmentsGroup,
  careManagementGroup,
];

const flatNavItems: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Reminders', href: '/reminders', icon: BellRing },
  { name: 'Communication Center', href: '/communication-center', icon: Megaphone },
  { name: 'Customer Chats', href: '/customer-chats', icon: MessageCircle },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Veterinarians', href: '/veterinarians', icon: UserCheck },
  { name: 'Shop Owners', href: '/shops', icon: Store },
  { name: 'Care Services', href: '/care-services', icon: Home },
  { name: 'Riders', href: '/riders', icon: Bike },
  { name: 'Promocodes', href: '/promocodes', icon: Tag },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Payment Logs', href: '/payment-logs', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.children.some((c) => pathname === c.href);
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.label] = isGroupActive(g, pathname);
    });
    return initial;
  });

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      navGroups.forEach((g) => {
        if (isGroupActive(g, pathname)) {
          next[g.label] = true;
        }
      });
      return next;
    });
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="w-64 bg-gradient-to-b from-white to-[#F7F4FC] min-h-screen fixed left-0 top-0 shadow-lg border-r border-white/60">
      {/* Logo */}
      <div className="p-6 border-b border-white/70">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 rounded-xl bg-white/80 p-1.5 border border-[#5CB0CC]/30 shadow-sm">
            <PawSewaLogo variant="nav" height={44} priority />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#171415] truncate">PawSewa</h1>
            <p className="text-xs text-gray-500">Control Room</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 overflow-y-auto">
        {/* Dashboard first */}
        {flatNavItems.slice(0, 1).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200',
                isActive ? 'bg-[#5CB0CC] text-white shadow-lg' : 'text-gray-700 hover:bg-white/70 hover:text-gray-900'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}

        {/* Collapsible groups: Cases, Pet Supply Order, Appointments, Care Management */}
        {collapsibleNavGroups.map((group) => {
          const GroupIcon = group.icon;
          const isExpanded = expandedGroups[group.label] ?? isGroupActive(group, pathname);
          const isActive = isGroupActive(group, pathname);

          return (
            <div key={group.label} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-left',
                  isActive ? 'bg-[#5CB0CC]/10 text-[#171415]' : 'text-gray-700 hover:bg-white/70 hover:text-gray-900'
                )}
              >
                <div className="flex items-center space-x-3">
                  <GroupIcon className="w-5 h-5" />
                  <span className="font-medium">{group.label}</span>
                  {group.children.some((c) => c.highlight) && (
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {isExpanded && (
                <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-1">
                  {group.children.map((child) => {
                    const ChildIcon = child.icon ?? ClipboardList;
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 relative',
                          isChildActive
                            ? 'bg-[#5CB0CC] text-white shadow-md'
                            : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
                        )}
                      >
                        <ChildIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">{child.name}</span>
                        {child.highlight && !isChildActive && (
                          <span className="absolute right-2 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Rest of flat items */}
        {flatNavItems.slice(1).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200',
                isActive ? 'bg-[#5CB0CC] text-white shadow-lg' : 'text-gray-700 hover:bg-white/70 hover:text-gray-900'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">Admin Portal v1.0</p>
      </div>
    </aside>
  );
};
