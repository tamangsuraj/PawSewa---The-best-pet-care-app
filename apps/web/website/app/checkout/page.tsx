'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { createOrder, initiatePayment } from '@/lib/api';
import { ShoppingCart, MapPin, Loader2 } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, hydrated } = useCart();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (items.length === 0 && !authLoading) {
      router.push('/shop');
    }
  }, [items.length, authLoading, router]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!address.trim()) {
      setError('Please enter your delivery address');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Kathmandu center as default coordinates (backend may validate geofence)
      const coordinates: [number, number] = [85.324, 27.717];
      const orderResp = await createOrder({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        deliveryLocation: { address: address.trim(), coordinates },
      });
      const orderData = orderResp.data?.data;
      const orderId = orderData?._id;
      if (!orderId) {
        throw new Error('Server did not return order ID. Please try again.');
      }

      const payResp = await initiatePayment({ type: 'order', orderId });
      const payData = payResp.data?.data;
      const paymentUrl = payData?.paymentUrl;
      if (!paymentUrl) {
        throw new Error('Could not get payment URL. Please try again.');
      }

      // Window redirect to Khalti payment
      window.location.href = paymentUrl;
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Checkout failed. Please check your connection and try again.';
      setError(msg);
      setLoading(false);
    }
  };

  if (authLoading || !hydrated || items.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  const deliveryFee = subtotal >= 1000 ? 0 : 80;
  const grandTotal = subtotal + deliveryFee;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleCheckout} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Delivery Address
            </h2>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your full delivery address (street, area, city)"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Order Summary
            </h2>
            <ul className="space-y-2 mb-4">
              {items.map((i) => (
                <li
                  key={i.productId}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <span>Rs. {(i.price * i.quantity).toFixed(0)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-200 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Delivery</span>
                <span>Rs. {deliveryFee.toFixed(0)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2">
                <span>Total</span>
                <span>Rs. {grandTotal.toFixed(0)}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing…
              </>
            ) : (
              'Pay with Khalti'
            )}
          </button>
          <p className="text-center text-sm text-gray-500">
            You will be redirected to Khalti to pay. If you cancel, you can return to the shop or try again from checkout.
          </p>
        </form>
      </div>
    </main>
  );
}
