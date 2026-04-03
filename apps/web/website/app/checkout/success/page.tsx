'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export const dynamic = 'force-dynamic';

export default function CheckoutSuccessPage() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { clearCart } = useCart();

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

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful</h1>
        <p className="text-gray-600 mb-6">
          Thank you for your order. Your payment has been completed successfully.
        </p>
        {orderId && (
          <p className="text-sm text-gray-500 font-mono mb-6">Order ID: {orderId}</p>
        )}
        <Link
          href="/shop"
          className="inline-block px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}
