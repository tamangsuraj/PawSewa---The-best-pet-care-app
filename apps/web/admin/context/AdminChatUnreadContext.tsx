'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';

type AdminChatUnreadContextType = {
  totalUnread: number;
};

const AdminChatUnreadContext = createContext<AdminChatUnreadContextType>({
  totalUnread: 0,
});

export function useAdminChatUnread(): AdminChatUnreadContextType {
  return useContext(AdminChatUnreadContext);
}

export function AdminChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setTotalUnread(0);
      return;
    }

    const s = getAdminSocket();
    if (!s) return;

    const onNotify = (p: Record<string, unknown>) => {
      if (typeof p.totalUnread === 'number') {
        setTotalUnread(p.totalUnread);
      }
      const hidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const onChatPage = path.includes('customer-chats') || path.includes('marketplace-chats');
      if (hidden || !onChatPage) {
        try {
          const a = new Audio('/notification.mp3');
          void a.play().catch(() => {});
        } catch {
          /* ignore */
        }
      }
    };

    const onSync = (p: Record<string, unknown>) => {
      if (typeof p.totalUnread === 'number') {
        setTotalUnread(p.totalUnread);
      }
    };

    s.on('new_message_notification', onNotify);
    s.on('unread_sync', onSync);

    let cancelled = false;
    void api
      .get('/chats/unread-summary')
      .then((r) => {
        if (cancelled) return;
        const n = r.data?.data?.totalUnread;
        if (typeof n === 'number') {
          setTotalUnread(n);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      s.off('new_message_notification', onNotify);
      s.off('unread_sync', onSync);
    };
  }, [user]);

  return (
    <AdminChatUnreadContext.Provider value={{ totalUnread }}>{children}</AdminChatUnreadContext.Provider>
  );
}
