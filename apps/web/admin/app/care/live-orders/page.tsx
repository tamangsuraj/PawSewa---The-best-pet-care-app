'use client';

import { CareOrdersStreamTable } from '@/components/care/CareOrdersStreamTable';

export default function CareLiveOrdersPage() {
  return (
    <CareOrdersStreamTable
      scope="live"
      heading="Live Orders"
      subheading="Grooming, Training, and Hostel bookings that are still active (pending or in progress)."
    />
  );
}
