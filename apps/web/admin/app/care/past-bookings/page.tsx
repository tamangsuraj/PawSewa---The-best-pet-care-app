'use client';

import { CareOrdersStreamTable } from '@/components/care/CareOrdersStreamTable';

export default function CarePastBookingsPage() {
  return (
    <CareOrdersStreamTable
      scope="past"
      heading="Past Orders"
      subheading="Completed, cancelled, declined, or rejected bookings for Grooming, Training, and Hostel."
    />
  );
}
