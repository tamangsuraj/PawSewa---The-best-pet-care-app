'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Inbox, ClipboardList, Building2, ArrowRight } from 'lucide-react';

const links = [
  {
    href: '/care-inbox',
    title: 'Care inbox',
    description: 'Operational care requests and partner coordination (live data from Atlas).',
    icon: Inbox,
  },
  {
    href: '/care/bookings',
    title: 'Care bookings',
    description: 'Bookings list, statuses, and facility-linked records.',
    icon: ClipboardList,
  },
  {
    href: '/care/pending-approvals',
    title: 'Pending approvals',
    description: 'Queue items awaiting admin or facility action.',
    icon: Calendar,
  },
  {
    href: '/care/hostels',
    title: 'Care centres & hostels',
    description: 'Manage listings tied to customer care bookings.',
    icon: Building2,
  },
] as const;

export default function AppointmentsPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Appointments & care</h1>
        <p className="text-gray-600">
          Veterinary clinic slots use the clinic queue and cases elsewhere; this hub links all care scheduling
          surfaces backed by the same MongoDB database as the mobile apps.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary">{title}</h2>
            <p className="mt-2 flex-1 text-sm text-gray-600">{description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
