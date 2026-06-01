'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Package, CheckCircle, Clock, Truck, XCircle, MapPin } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';

interface OrderItem { name?: string; quantity?: number; price?: number }
interface OrderRow {
  _id?: string;
  status?: string;
  totalAmount?: number;
  createdAt?: string;
  items?: OrderItem[];
  deliveryLocation?: { address?: string };
  paymentMethod?: string;
  paymentStatus?: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:           { label: 'Processing',       color: 'bg-amber-100 text-amber-800',   icon: Clock    },
  pending_confirmation: { label: 'Awaiting Shop', color: 'bg-amber-100 text-amber-800',   icon: Clock    },
  processing:        { label: 'Processing',       color: 'bg-amber-100 text-amber-800',   icon: Clock    },
  confirmed:         { label: 'Confirmed',        color: 'bg-blue-100 text-blue-800',     icon: CheckCircle },
  packed:            { label: 'Packed',           color: 'bg-sky-100 text-sky-800',       icon: Package  },
  ready_for_pickup:  { label: 'Ready for Pickup', color: 'bg-indigo-100 text-indigo-800', icon: Package  },
  assigned_to_rider: { label: 'Rider Assigned',   color: 'bg-violet-100 text-violet-800', icon: Truck    },
  out_for_delivery:  { label: 'Out for Delivery', color: 'bg-purple-100 text-purple-800', icon: Truck    },
  delivered:         { label: 'Delivered',        color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  cancelled:         { label: 'Cancelled',        color: 'bg-red-100 text-red-700',       icon: XCircle  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function shortId(id: string) {
  return id.length >= 6 ? id.slice(-6).toUpperCase() : id.toUpperCase();
}

function OrderCard({ order }: { order: OrderRow }) {
  const id = order._id ?? '';
  const st = order.status ?? 'pending';
  const meta = STATUS_META[st] ?? { label: st.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-700', icon: Package };
  const Icon = meta.icon;
  const items = order.items ?? [];
  const address = order.deliveryLocation?.address;
  const total = order.totalAmount;
  const date = order.createdAt ? fmtDate(order.createdAt) : null;

  return (
    <div className="rounded-2xl border border-[#703418]/10 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-bold text-[#703418]/50">#{shortId(id)}</p>
          {date && <p className="mt-0.5 text-xs text-[#2c241c]/50">{date}</p>}
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.color}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          {meta.label}
        </span>
      </div>

      {items.length > 0 && (
        <div className="mb-3 space-y-1">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-[#2c241c]">
                {item.name ?? 'Item'} <span className="text-[#2c241c]/50">× {item.quantity ?? 1}</span>
              </span>
              {item.price != null && (
                <span className="text-xs text-[#2c241c]/60">
                  Rs. {(item.price * (item.quantity ?? 1)).toFixed(0)}
                </span>
              )}
            </div>
          ))}
          {items.length > 3 && (
            <p className="text-xs text-[#2c241c]/50">+{items.length - 3} more items</p>
          )}
        </div>
      )}

      {address && (
        <div className="mb-3 flex items-start gap-1.5 text-xs text-[#2c241c]/60">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#703418]/50" strokeWidth={1.75} />
          <span className="line-clamp-2">{address}</span>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[#703418]/8 pt-3">
        {total != null ? (
          <p className="font-bold text-[#703418]">Rs. {Number(total).toLocaleString('en-NP')}</p>
        ) : (
          <span />
        )}
        {order.paymentStatus && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            order.paymentStatus === 'paid'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {order.paymentStatus}
          </span>
        )}
      </div>
    </div>
  );
}

function MyOrdersBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') ?? 'all';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [list, setList] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await api.get('/orders/my');
        const data = res.data?.data;
        if (!cancelled) setList(Array.isArray(data) ? (data as OrderRow[]) : []);
      } catch {
        if (!cancelled) setErr('Could not load orders. Please refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated, router]);

  const visible = useMemo(() => {
    if (filter === 'active') return list.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
    if (filter === 'history') return list.filter((o) => o.status === 'delivered' || o.status === 'cancelled');
    return list;
  }, [list, filter]);

  const title = filter === 'active' ? 'Active orders' : filter === 'history' ? 'Order history' : 'My orders';

  if (authLoading || loading) {
    return (
      <PageShell className="flex min-h-dvh items-center justify-center">
        <PawSewaLogoSpinner size={56} className="mx-auto" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageContent className="max-w-2xl py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-[#703418]">{title}</h1>
          <Link href="/shop" className="self-start text-sm font-semibold text-[#0d9488] hover:underline">
            Continue shopping →
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex gap-2 rounded-xl bg-[#f3ebe2]/80 p-1">
          {(['all', 'active', 'history'] as const).map((f) => (
            <Link
              key={f}
              href={`/my-orders${f !== 'all' ? `?filter=${f}` : ''}`}
              className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
                filter === f
                  ? 'bg-white text-[#703418] shadow-sm'
                  : 'text-[#703418]/60 hover:text-[#703418]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'History'}
            </Link>
          ))}
        </div>

        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#703418]/15 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3ebe2]">
              <Package className="h-7 w-7 text-[#703418]/40" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-[#2c241c]">
                {filter === 'all' ? 'No orders yet' : `No ${filter} orders`}
              </p>
              <p className="mt-1 text-sm text-[#2c241c]/55">
                {filter === 'all' ? 'Your orders will appear here.' : 'Nothing in this view yet.'}
              </p>
            </div>
            <Link
              href="/shop"
              className="rounded-full bg-[#703418] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5c2c14] transition-colors"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((o, i) => (
              <OrderCard key={o._id ?? `o-${i}`} order={o} />
            ))}
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}

export default function MyOrdersPage() {
  return (
    <Suspense
      fallback={
        <PageShell className="flex min-h-dvh items-center justify-center">
          <PawSewaLogoSpinner size={56} />
        </PageShell>
      }
    >
      <MyOrdersBody />
    </Suspense>
  );
}
