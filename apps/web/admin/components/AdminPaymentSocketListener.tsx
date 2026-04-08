'use client';

import { useEffect } from 'react';
import { getAdminSocket } from '@/lib/socket';
import toast from 'react-hot-toast';

/**
 * Global toast when a Khalti shop payment finalizes (admin_room).
 */
export function AdminPaymentSocketListener() {
  useEffect(() => {
    const socket = getAdminSocket();
    if (!socket) return;

    const onPayment = (payload: {
      message?: string;
      orderId?: string;
      amount?: number;
      gateway?: string;
    }) => {
      const amt =
        typeof payload.amount === 'number' ? ` NPR ${payload.amount.toFixed(2)}` : '';
      toast.success(
        `${payload.message || 'New payment received'}${amt}${payload.orderId ? ` · Order ${String(payload.orderId).slice(-6)}` : ''}`,
        { duration: 6000 },
      );
    };

    socket.on('admin:payment_received', onPayment);
    return () => {
      socket.off('admin:payment_received', onPayment);
    };
  }, []);

  return null;
}
