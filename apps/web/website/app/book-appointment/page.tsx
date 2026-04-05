import { redirect } from 'next/navigation';

/** Same flow as mobile “Book Appointment” → BookServiceScreen → POST /service-requests */
export default function BookAppointmentPage() {
  redirect('/services/request');
}
