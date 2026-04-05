'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { createOrder, initiateKhaltiForOrder } from '@/lib/api';
import {
  buildDeliveryNotes,
  checkoutDetailsSchema,
  type CheckoutDetailsForm,
} from '@/lib/checkoutSchema';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import { CheckoutPaymentSelector, type ShopPaymentMethod } from '@/components/checkout/CheckoutPaymentSelector';
import { PageShell } from '@/components/layout/PageShell';
import { Loader2, ChevronRight, ShoppingCart, MapPin, User, ClipboardList } from 'lucide-react';
import clsx from 'clsx';

const K_FREE_DELIVERY_ABOVE = 1000;
const K_DELIVERY_FEE = 80;

const DeliveryMapSection = dynamic(
  () => import('@/components/checkout/DeliveryMapSection').then((m) => m.DeliveryMapSection),
  {
    ssr: false,
    loading: () => <div className="h-[min(52vh,320px)] animate-pulse rounded-2xl bg-[#f3ebe2]/90" />,
  }
);

function composeDeliveryAddress(mapAddress: string | null, details: CheckoutDetailsForm): string {
  const base = mapAddress?.trim() || '';
  const lines = [
    base,
    details.houseFlat.trim() ? `House/Flat: ${details.houseFlat.trim()}` : '',
    details.landmark?.trim() ? `Landmark: ${details.landmark.trim()}` : '',
  ].filter(Boolean);
  return lines.join('\n').trim();
}

const steps = [
  { n: 1, label: 'Location', icon: MapPin },
  { n: 2, label: 'Details', icon: User },
  { n: 3, label: 'Review & pay', icon: ClipboardList },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, hydrated, clearCart } = useCart();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [mapLat, setMapLat] = useState(27.7172);
  const [mapLng, setMapLng] = useState(85.324);
  const [mapAddress, setMapAddress] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [payment, setPayment] = useState<ShopPaymentMethod>('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<CheckoutDetailsForm>({
    resolver: zodResolver(checkoutDetailsSchema),
    defaultValues: {
      addressTitle: '',
      recipientName: '',
      recipientPhone: '',
      houseFlat: '',
      landmark: '',
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?next=' + encodeURIComponent('/checkout'));
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (hydrated && items.length === 0 && !authLoading) {
      router.push('/shop');
    }
  }, [items.length, hydrated, authLoading, router]);

  const deliveryFee = subtotal >= K_FREE_DELIVERY_ABOVE ? 0 : K_DELIVERY_FEE;
  const grandTotal = subtotal + deliveryFee;

  const canAdvanceFromStep1 = useMemo(() => {
    return Boolean(!mapLoading && mapAddress && mapAddress.trim().length > 0);
  }, [mapLoading, mapAddress]);

  const goNext = async () => {
    setError('');
    if (step === 1) {
      if (!canAdvanceFromStep1) {
        setError('Place the pin and wait for the address to load.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await form.trigger();
      if (!ok) return;
      setStep(3);
    }
  };

  const mapPayMethod = (m: ShopPaymentMethod): 'cod' | 'fonepay' | null => {
    if (m === 'cod') return 'cod';
    if (m === 'fonepay') return 'fonepay';
    return null;
  };

  const onSubmit = form.handleSubmit(async (details) => {
    setError('');
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!canAdvanceFromStep1) {
      setError('Delivery location is incomplete.');
      return;
    }
    if (payment === 'esewa' || payment === 'card') {
      setError('This payment method is not available for shop checkout yet. Choose COD, Fonepay, or Khalti.');
      return;
    }

    const addressBlock = composeDeliveryAddress(mapAddress, details);
    if (!addressBlock) {
      setError('Delivery address is required.');
      return;
    }

    const coordinates: [number, number] = [mapLng, mapLat];
    const deliveryNotes = buildDeliveryNotes(details);
    const payloadBase = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      deliveryLocation: {
        address: addressBlock,
        coordinates,
      },
      location: {
        lat: mapLat,
        lng: mapLng,
        address: addressBlock,
      },
      deliveryNotes,
    };

    setLoading(true);
    try {
      if (payment === 'khalti') {
        const orderResp = await createOrder(payloadBase);
        const orderData = orderResp.data?.data;
        const orderId = orderData?._id ? String(orderData._id) : '';
        if (!orderId) {
          throw new Error('Server did not return order ID. Please try again.');
        }
        const khaltiResp = await initiateKhaltiForOrder(orderId);
        const payUrl = khaltiResp.data?.data?.paymentUrl as string | undefined;
        if (!payUrl) {
          throw new Error('Could not get Khalti payment URL. Please try again.');
        }
        window.location.href = payUrl;
        return;
      }

      const pm = mapPayMethod(payment);
      if (!pm) {
        throw new Error('Invalid payment selection.');
      }
      const orderResp = await createOrder({
        ...payloadBase,
        paymentMethod: pm,
      });
      const orderData = orderResp.data?.data;
      const orderId = orderData?._id ? String(orderData._id) : '';
      if (!orderId) {
        throw new Error('Server did not return order ID. Please try again.');
      }
      clearCart();
      router.push(`/checkout/success?orderId=${encodeURIComponent(orderId)}`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        ax.response?.data?.message ??
          ax.message ??
          'Checkout failed. Please check your connection and try again.'
      );
      setLoading(false);
    }
  });

  if (authLoading || !hydrated || items.length === 0) {
    return (
      <PageShell className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#703418]" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="border-b border-[#703418]/10 bg-[#faf6f0]/90 backdrop-blur-md">
        <div className="container mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <PawSewaLogo variant="nav" height={44} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#703418]/80">Shop</p>
              <h1 className="font-display text-xl font-semibold text-[#2c241c]">Checkout</h1>
            </div>
          </div>
          <Link
            href="/shop"
            className="text-sm font-semibold text-[#703418] underline-offset-2 hover:underline"
          >
            ← Back to shop
          </Link>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-8 pb-24">
        <nav className="mb-10 flex items-center justify-between gap-2" aria-label="Checkout steps">
          {steps.map(({ n, label, icon: Icon }) => {
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                    active && 'border-[#703418] bg-[#703418] text-white shadow-[0_4px_14px_rgba(112,52,24,0.25)]',
                    done && !active && 'border-[#703418] bg-[#703418]/15 text-[#703418]',
                    !active && !done && 'border-[#703418]/25 bg-white text-[#703418]/40'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <span
                  className={clsx(
                    'hidden text-center text-[11px] font-semibold sm:block',
                    active ? 'text-[#703418]' : 'text-[#2c241c]/45'
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </nav>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-8">
          {step === 1 ? (
            <section className="rounded-2xl border-2 border-[#703418]/15 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[#703418]">
                <MapPin className="h-5 w-5" />
                Delivery location
              </h2>
              <p className="mb-5 text-sm text-[#2c241c]/65">
                Drag the pin or tap the map — same OpenStreetMap search and reverse geocoding as the mobile app.
              </p>
              <DeliveryMapSection
                lat={mapLat}
                lng={mapLng}
                address={mapAddress}
                loadingAddress={mapLoading}
                onLatLng={(la, ln) => {
                  setMapLat(la);
                  setMapLng(ln);
                }}
                onAddress={setMapAddress}
                onLoadingAddress={setMapLoading}
              />
              <button
                type="button"
                onClick={() => void goNext()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#703418] py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#5c2c14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2"
              >
                Continue to details
                <ChevronRight className="h-4 w-4" />
              </button>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="rounded-2xl border-2 border-[#703418]/15 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[#703418]">
                <User className="h-5 w-5" />
                Recipient & address details
              </h2>
              <p className="mb-5 text-sm text-[#2c241c]/65">
                Matches the mobile &quot;Add address&quot; sheet: title, name, phone, and delivery details.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2c241c]">Address title e.g. Home, Clinic *</label>
                  <input
                    {...form.register('addressTitle')}
                    className="w-full rounded-xl border-2 border-transparent bg-[#faf6f0] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-[#703418] focus:ring-2 focus:ring-[#703418]/25"
                    placeholder="Home"
                  />
                  {form.formState.errors.addressTitle ? (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.addressTitle.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2c241c]">Full name *</label>
                  <input
                    {...form.register('recipientName')}
                    className="w-full rounded-xl border-2 border-transparent bg-[#faf6f0] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-[#703418] focus:ring-2 focus:ring-[#703418]/25"
                  />
                  {form.formState.errors.recipientName ? (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.recipientName.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2c241c]">Mobile number *</label>
                  <input
                    {...form.register('recipientPhone')}
                    type="tel"
                    inputMode="tel"
                    className="w-full rounded-xl border-2 border-transparent bg-[#faf6f0] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-[#703418] focus:ring-2 focus:ring-[#703418]/25"
                    placeholder="98xxxxxxxx"
                  />
                  {form.formState.errors.recipientPhone ? (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.recipientPhone.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2c241c]">House / flat no. *</label>
                  <input
                    {...form.register('houseFlat')}
                    className="w-full rounded-xl border-2 border-transparent bg-[#faf6f0] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-[#703418] focus:ring-2 focus:ring-[#703418]/25"
                    placeholder="Ward 12, Building B, Floor 3"
                  />
                  {form.formState.errors.houseFlat ? (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.houseFlat.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2c241c]">Landmark (optional)</label>
                  <input
                    {...form.register('landmark')}
                    className="w-full rounded-xl border-2 border-transparent bg-[#faf6f0] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-[#703418] focus:ring-2 focus:ring-[#703418]/25"
                    placeholder="Near the pet clinic gate"
                  />
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-xl border-2 border-[#703418]/25 py-3.5 text-sm font-semibold text-[#703418] transition-colors hover:bg-[#703418]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2 sm:w-auto sm:px-6"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void goNext()}
                  className="flex w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#703418] py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#5c2c14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2"
                >
                  Review order
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <>
              <section className="rounded-2xl border-2 border-[#703418] bg-gradient-to-b from-white to-[#faf6f0] p-5 shadow-[0_12px_40px_rgba(112,52,24,0.08)] sm:p-7">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#703418]">
                  <ShoppingCart className="h-5 w-5" />
                  Order summary
                </h2>
                <ul className="mb-4 space-y-2 border-b border-[#703418]/15 pb-4">
                  {items.map((i) => (
                    <li key={i.productId} className="flex justify-between text-sm text-[#2c241c]">
                      <span>
                        {i.name} × {i.quantity}
                      </span>
                      <span className="font-medium tabular-nums">Rs. {(i.price * i.quantity).toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[#2c241c]/85">
                    <span>Subtotal</span>
                    <span className="font-semibold tabular-nums">Rs. {subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-[#2c241c]/85">
                    <span>Delivery</span>
                    <span className="font-semibold tabular-nums text-emerald-700">
                      {deliveryFee === 0 ? 'FREE' : `Rs. ${deliveryFee.toFixed(0)}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#703418]/70">
                    Free delivery on orders above Rs. {K_FREE_DELIVERY_ABOVE.toLocaleString('en-NP')} (same as the app).
                  </p>
                  <div className="flex justify-between border-t border-[#703418]/20 pt-3 text-base font-bold text-[#703418]">
                    <span>Total</span>
                    <span className="tabular-nums">Rs. {grandTotal.toFixed(0)}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border-2 border-[#703418]/15 bg-white p-5 shadow-sm sm:p-7">
                <CheckoutPaymentSelector value={payment} onChange={setPayment} />
              </section>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full rounded-xl border-2 border-[#703418]/25 py-3.5 text-sm font-semibold text-[#703418] transition-colors hover:bg-[#703418]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2 sm:w-auto sm:px-6"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#703418] py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#5c2c14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#703418] focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing…
                    </>
                  ) : payment === 'khalti' ? (
                    'Pay with Khalti'
                  ) : (
                    'Place order'
                  )}
                </button>
              </div>
              {payment === 'khalti' ? (
                <p className="text-center text-xs text-[#2c241c]/50">
                  You will leave this site to complete Khalti. Your cart stays until payment succeeds (same as the app).
                </p>
              ) : null}
            </>
          ) : null}
        </form>
      </div>
    </PageShell>
  );
}
