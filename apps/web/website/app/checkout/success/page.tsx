'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, MessageCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useChatHub } from '@/context/ChatHubContext';
import api from '@/lib/api';
import { PageShell } from '@/components/layout/PageShell';

export const dynamic = 'force-dynamic';

export default function CheckoutSuccessPage() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [hasRider, setHasRider] = useState(false);
  const { clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { openDeliveryForOrder } = useChatHub();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('orderId');
    setOrderId(id);
  }, [mounted]);

  useEffect(() => {
    if (mounted && orderId) {
      clearCart(); // Clear cart after successful payment
    }
  }, [mounted, orderId, clearCart]);

  useEffect(() => {
    if (!mounted || !orderId || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/orders/my');
        const list = res.data?.data ?? [];
        const o = Array.isArray(list)
          ? list.find((x: { _id?: string }) => String(x._id) === orderId)
          : null;
        if (!cancelled && o) {
          setOrderStatus(typeof o.status === 'string' ? o.status : null);
          setHasRider(Boolean(o.assignedRider));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, orderId, isAuthenticated]);

  if (!mounted) {
    return (
      <PageShell className="flex min-h-screen items-center justify-center">
        <p className="text-paw-bark/60">Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full paw-card-glass rounded-[1.75rem] border border-paw-bark/10 shadow-paw-lg p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-paw-ink mb-2">Payment successful</h1>
        <p className="text-paw-bark/75 mb-6">
          Thank you for your order. Your payment has been completed successfully.
        </p>
        {orderId && (
          <p className="text-sm text-gray-500 font-mono mb-4">Order ID: {orderId}</p>
        )}
        {orderId && isAuthenticated && (
          <div className="w-full text-left mb-6 rounded-xl border border-paw-bark/15 bg-paw-sand/50 p-4">
            <p className="text-xs font-semibold text-paw-bark uppercase tracking-wide mb-2">
              Order tracking
            </p>
            {orderStatus && (
              <p className="text-sm text-gray-700 mb-3">
                Status: <span className="font-medium capitalize">{orderStatus.replace(/_/g, ' ')}</span>
              </p>
            )}
            {hasRider ? (
              <button
                type="button"
                onClick={() => void openDeliveryForOrder(orderId)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0d9488] text-white text-sm font-semibold hover:bg-[#0f766e] w-full justify-center"
              >
                <MessageCircle className="w-4 h-4" />
                Chat with Rider
              </button>
            ) : (
              <p className="text-xs text-gray-500">
                Rider chat appears when a rider is assigned and the order is being fulfilled.
              </p>
            )}
          </div>
        )}
        <Link
          href="/shop"
          className="inline-block px-6 py-3 rounded-full bg-paw-bark text-paw-cream font-medium hover:bg-paw-ink transition-colors shadow-paw"
        >
          Continue Shopping
        </Link>
      </div>
    </PageShell>
  );
}
