'use client';

import React from 'react';
import { Calendar } from 'lucide-react';

export default function AppointmentsPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Appointment Calendar</h1>
        <p className="text-gray-600">Manage all veterinary appointments</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <Calendar className="w-20 h-20 text-primary/20 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-primary mb-4">Coming Soon</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Appointment calendar and scheduling features will be available here.
          You&apos;ll be able to view, manage, and track all veterinary appointments.
        </p>
      </div>
    </>
  );
}
