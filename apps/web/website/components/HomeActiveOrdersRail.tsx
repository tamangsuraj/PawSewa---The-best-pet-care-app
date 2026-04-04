'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Package, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useChatHub } from '@/context/ChatHubContext';

type OrderRow = {
  _id: string;
  status: string;
  assignedRider?: unknown;
  deliveryLocation?: { address?: string; point?: { coordinates?: number[] } };
  location?: { lat?: number; lng?: number; address?: string };
  deliveryCoordinates?: { lat?: number; lng?: number };
};

export function HomeActiveOrdersRail() {
  const { isAuthenticated } = useAuth();
  const { openDeliveryForOrder } = useChatHub();
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/orders/my');
        const list = res.data?.data ?? [];
        if (!cancelled && Array.isArray(list)) {
          const active = list.filter((o: OrderRow) => {
            const s = String(o.status || '');
            return ['pending', 'processing', 'out_for_delivery', 'delivered'].includes(s);
          });
          setOrders(active.slice(0, 4));
        }
      } catch {
        if (!cancelled) setOrders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated || orders.length === 0) return null;

  return (
    <aside className="hidden xl:block fixed right-4 top-28 z-30 w-[17.5rem] max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="rounded-2xl border border-[#4B3621]/15 bg-[#FAF7F2]/95 backdrop-blur-md shadow-[0_20px_50px_rgba(75,54,33,0.14)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#4B3621]/70 mb-3">
          Active orders
        </p>
        <ul className="space-y-3">
          {orders.map((o) => {
            const lat =
              o.deliveryCoordinates?.lat ??
              o.location?.lat ??
              o.deliveryLocation?.point?.coordinates?.[1];
            const lng =
              o.deliveryCoordinates?.lng ??
              o.location?.lng ??
              o.deliveryLocation?.point?.coordinates?.[0];
            const addr =
              o.deliveryLocation?.address || o.location?.address || 'Delivery address on file';
            const hasRider = Boolean(o.assignedRider);
            return (
              <li
                key={o._id}
                className="rounded-xl bg-white border border-[#4B3621]/10 p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-[#4B3621] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-gray-500 truncate">{o._id}</p>
                    <p className="text-sm font-semibold text-[#4B3621] capitalize">
                      {String(o.status || '').replace(/_/g, ' ')}
                    </p>
                    {lat != null && lng != null && (
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {lat.toFixed(5)}, {lng.toFixed(5)}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-600 line-clamp-2 mt-1">{addr}</p>
                  </div>
                </div>
                {hasRider && ['processing', 'out_for_delivery', 'delivered'].includes(o.status) ? (
                  <button
                    type="button"
                    onClick={() => void openDeliveryForOrder(o._id)}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#0d9488] text-white text-xs font-semibold hover:bg-[#0f766e] transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Chat with Rider
                  </button>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-2">Rider chat when assigned</p>
                )}
              </li>
            );
          })}
        </ul>
        <Link
          href="/checkout"
          className="mt-3 block text-center text-xs font-medium text-[#0d9488] hover:underline"
        >
          View cart & checkout
        </Link>
      </div>
    </aside>
  );
}
