import { redirect } from 'next/navigation';

/** Shop dispatch lives on Live supplies (`/supplies`) with map + assign seller/rider. */
export default function OrdersRedirectPage() {
  redirect('/supplies');
}
