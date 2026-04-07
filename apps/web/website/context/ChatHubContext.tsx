'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import { X, ChevronLeft, Send } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';
import {
  disconnectChatSocket,
  getOrCreateChatSocket,
  joinRoom,
} from '@/lib/pawsewaChatSocket';
import type { Socket } from 'socket.io-client';

type ThreadKind = 'support' | 'seller' | 'delivery';

export type HubThread = {
  id: string;
  kind: ThreadKind;
  title: string;
  subtitle?: string;
  peerId: string;
  peerPicture?: string | null;
  lastAt?: string;
};

type ChatMsg = {
  _id: string;
  text: string;
  mine: boolean;
  productName?: string;
  at: string;
};

type ChatHubContextValue = {
  openHub: () => void;
  openSellerChat: (productId: string) => Promise<void>;
  openDeliveryForOrder: (orderId: string) => Promise<void>;
  /** Opens floating hub on Customer Care (support uses CUSTOMER_CARE_ADMIN_ID on server). */
  openHubWithSupport: () => Promise<void>;
  /** Pet Care+ / service questions — same as support funnel for parity. */
  openCareProviderChat: () => Promise<void>;
  inboxThreads: HubThread[];
  inboxLoading: boolean;
  refreshInboxPreview: () => Promise<HubThread[]>;
  /** Open floating hub on a thread already in inbox (seller / delivery / support). */
  openKnownThread: (thread: HubThread) => void;
  hubOpen: boolean;
  /** Server-backed total unread (all chat threads). */
  chatUnreadTotal: number;
};

const ChatHubContext = createContext<ChatHubContextValue | null>(null);

export function useChatHub(): ChatHubContextValue {
  const v = useContext(ChatHubContext);
  if (!v) {
    return {
      openHub: () => {},
      openSellerChat: async () => {},
      openDeliveryForOrder: async () => {},
      openHubWithSupport: async () => {},
      openCareProviderChat: async () => {},
      inboxThreads: [],
      inboxLoading: false,
      refreshInboxPreview: async () => [],
      openKnownThread: () => {},
      hubOpen: false,
      chatUnreadTotal: 0,
    };
  }
  return v;
}

export function ChatHubProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated } = useAuth();
  const [hubOpen, setHubOpen] = useState(false);
  const hubOpenRef = useRef(false);
  hubOpenRef.current = hubOpen;
  const [chatUnreadTotal, setChatUnreadTotal] = useState(0);
  const [view, setView] = useState<'list' | 'thread'>('list');
  const [threads, setThreads] = useState<HubThread[]>([]);
  const [active, setActive] = useState<HubThread | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [typingRemote, setTypingRemote] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [seenByPeer, setSeenByPeer] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const parityLogged = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productIdForFirstSellerMsg = useRef<string | null>(null);

  const userId = user?._id ?? '';

  const refreshInbox = useCallback(async (): Promise<HubThread[]> => {
    if (!isAuthenticated || !token) return [];
    setLoadingList(true);
    const rows: HubThread[] = [];
    try {
      try {
        const mine = await api.get('/customer-care/mine');
        const conv = mine.data?.data?.conversation;
        const pid = conv?.partner?._id ?? conv?.careAdmin?._id ?? conv?.partner;
        if (conv?._id && pid) {
          rows.push({
            id: String(conv._id),
            kind: 'support',
            title: 'Customer Care',
            subtitle: 'We are here to help',
            peerId: String(pid),
            peerPicture: conv?.partner?.profilePicture ?? null,
            lastAt: conv?.lastMessageAt,
          });
        }
      } catch {
        /* not pet_owner or care unavailable */
      }

      const inbox = await api.get('/marketplace-chat/inbox');
      const data = inbox.data?.data ?? {};
      const sellers = Array.isArray(data.sellers) ? data.sellers : [];
      const delivery = Array.isArray(data.delivery) ? data.delivery : [];

      for (const s of sellers) {
        const p = s.partner;
        rows.push({
          id: String(s._id),
          kind: 'seller',
          title: p?.name ? `Seller: ${p.name}` : 'Seller chat',
          subtitle: s.lastProductName || 'Product chat',
          peerId: String(p?._id || p),
          peerPicture: p?.profilePicture ?? null,
          lastAt: s.lastMessageAt,
        });
      }
      for (const d of delivery) {
        const p = d.partner;
        rows.push({
          id: String(d._id),
          kind: 'delivery',
          title: p?.name ? `Rider: ${p.name}` : 'Delivery',
          subtitle: 'Order delivery',
          peerId: String(p?._id || p),
          peerPicture: p?.profilePicture ?? null,
          lastAt: d.lastMessageAt,
        });
      }

      setThreads(rows);
      if (!parityLogged.current) {
        parityLogged.current = true;
        // eslint-disable-next-line no-console
        console.log('[SUCCESS] Chat parity achieved between Web and Mobile platforms.');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ChatHub] inbox load failed', e);
    } finally {
      setLoadingList(false);
    }
    return rows;
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || !userId) {
      setChatUnreadTotal(0);
      disconnectChatSocket();
      socketRef.current = null;
      return;
    }
    const s = getOrCreateChatSocket(token);
    socketRef.current = s;

    const onNotify = (p: Record<string, unknown>) => {
      if (typeof p.totalUnread === 'number') {
        setChatUnreadTotal(p.totalUnread);
      }
      const tabHidden =
        typeof document !== 'undefined' && document.visibilityState !== 'visible';
      const hubClosed = !hubOpenRef.current;
      if (tabHidden || hubClosed) {
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
        setChatUnreadTotal(p.totalUnread);
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
          setChatUnreadTotal(n);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      s.off('new_message_notification', onNotify);
      s.off('unread_sync', onSync);
    };
  }, [isAuthenticated, token, userId]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectChatSocket();
      socketRef.current = null;
      parityLogged.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && token) {
      void refreshInbox();
    }
  }, [isAuthenticated, token, refreshInbox]);

  const fetchPresence = useCallback(
    (peerId: string) => {
      const s = socketRef.current;
      if (!s?.connected || !peerId) return;
      s.emit('query_presence', [peerId], (map: Record<string, boolean>) => {
        setPeerOnline(map?.[peerId] === true);
      });
    },
    [],
  );

  const loadMessages = useCallback(
    async (thread: HubThread) => {
      setLoadingThread(true);
      setSeenByPeer(false);
      try {
        if (thread.kind === 'support') {
          const res = await api.get(`/customer-care/conversations/${thread.id}/messages`);
          const raw = res.data?.data ?? [];
          setMessages(
            raw.map((m: Record<string, unknown>) => ({
              _id: String(m._id),
              text: String(m.text ?? ''),
              mine: String(m.senderId) === userId,
              at: String(m.timestamp ?? ''),
            })),
          );
        } else {
          const res = await api.get(`/marketplace-chat/conversations/${thread.id}/messages`);
          const raw = res.data?.data ?? [];
          setMessages(
            raw.map((m: Record<string, unknown>) => ({
              _id: String(m._id),
              text: String(m.content ?? ''),
              mine: String((m.sender as { _id?: string })?._id ?? m.sender) === userId,
              productName: m.productName ? String(m.productName) : undefined,
              at: String(m.createdAt ?? ''),
            })),
          );
        }
      } catch {
        setMessages([]);
      } finally {
        setLoadingThread(false);
      }
    },
    [userId],
  );

  const attachThreadSocket = useCallback(
    (thread: HubThread) => {
      const s = socketRef.current;
      if (!s) return () => {};

      const onRecv = (data: Record<string, unknown>) => {
        if (String(data.conversationId) !== thread.id) return;
        const mid = String(data.messageId ?? '');
        const txt = String(data.text ?? data.content ?? '');
        const sid = String(data.senderId ?? '');
        setMessages((prev) => {
          if (prev.some((p) => p._id === mid)) return prev;
          return [
            ...prev,
            {
              _id: mid || `tmp-${Date.now()}`,
              text: txt,
              mine: sid === userId,
              productName: data.productName ? String(data.productName) : undefined,
              at: String(data.timestamp ?? new Date().toISOString()),
            },
          ];
        });
      };

      const onTyping = (data: Record<string, unknown>) => {
        if (String(data.conversationId) !== thread.id) return;
        if (String(data.userId) === userId) return;
        if (data.isTyping === true) {
          setTypingRemote(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingRemote(false), 2500);
        } else {
          setTypingRemote(false);
        }
      };

      const onSeen = (data: Record<string, unknown>) => {
        if (String(data.conversationId) !== thread.id) return;
        if (String(data.readerId) === thread.peerId) {
          setSeenByPeer(true);
        }
      };

      s.on('receive_message', onRecv);
      s.on('typing_status', onTyping);
      s.on('seen_receipt', onSeen);

      const run = async () => {
        if (!s.connected) {
          await new Promise<void>((r) => {
            s.once('connect', () => r());
          });
        }
        await joinRoom(s, thread.id, userId);
        s.emit('mark_read', { conversationId: thread.id });
        fetchPresence(thread.peerId);
      };
      void run();

      return () => {
        s.off('receive_message', onRecv);
        s.off('typing_status', onTyping);
        s.off('seen_receipt', onSeen);
        if (typingTimer.current) clearTimeout(typingTimer.current);
      };
    },
    [userId, fetchPresence],
  );

  useEffect(() => {
    if (!active || view !== 'thread') return undefined;
    const cleanup = attachThreadSocket(active);
    const iv = setInterval(() => fetchPresence(active.peerId), 25_000);
    return () => {
      clearInterval(iv);
      cleanup?.();
    };
  }, [active, view, attachThreadSocket, fetchPresence]);

  const openThread = useCallback(
    (thread: HubThread) => {
      setActive(thread);
      setView('thread');
      setHubOpen(true);
      void loadMessages(thread);
    },
    [loadMessages],
  );

  const openHub = useCallback(() => {
    setHubOpen(true);
    setView('list');
    setActive(null);
    void refreshInbox();
  }, [refreshInbox]);

  const openHubWithSupport = useCallback(async () => {
    const rows = await refreshInbox();
    setHubOpen(true);
    const sup = rows.find((r) => r.kind === 'support');
    if (sup) {
      setActive(sup);
      setView('thread');
      void loadMessages(sup);
    } else {
      setView('list');
      setActive(null);
    }
  }, [refreshInbox, loadMessages]);

  const openCareProviderChat = useCallback(async () => {
    await openHubWithSupport();
  }, [openHubWithSupport]);

  const openKnownThread = useCallback(
    (thread: HubThread) => {
      setHubOpen(true);
      setActive(thread);
      setView('thread');
      void loadMessages(thread);
    },
    [loadMessages],
  );

  const openSellerChat = useCallback(
    async (productId: string) => {
      if (!isAuthenticated || !token) return;
      productIdForFirstSellerMsg.current = productId;
      try {
        const res = await api.post('/marketplace-chat/seller/open', { productId });
        const conv = res.data?.data;
        const id = conv?._id;
        const p = conv?.partner;
        if (!id || !p) return;
        const thread: HubThread = {
          id: String(id),
          kind: 'seller',
          title: p?.name ? `Seller: ${p.name}` : 'Seller chat',
          subtitle: conv?.lastProductName || 'Product chat',
          peerId: String(p._id || p),
          peerPicture: p?.profilePicture ?? null,
        };
        openThread(thread);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        alert('Could not open seller chat.');
      }
    },
    [isAuthenticated, token, openThread],
  );

  const openDeliveryForOrder = useCallback(
    async (orderId: string) => {
      if (!isAuthenticated || !token) return;
      try {
        const res = await api.get(`/marketplace-chat/delivery/by-order/${orderId}`);
        const conv = res.data?.data;
        const id = conv?._id;
        const p = conv?.partner;
        if (!id || !p) return;
        const thread: HubThread = {
          id: String(id),
          kind: 'delivery',
          title: p?.name ? `Rider: ${p.name}` : 'Delivery',
          subtitle: 'Order delivery',
          peerId: String(p._id || p),
          peerPicture: p?.profilePicture ?? null,
        };
        openThread(thread);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        alert('Delivery chat is not available for this order yet.');
      }
    },
    [isAuthenticated, token, openThread],
  );

  const send = useCallback(async () => {
    const v = text.trim();
    const thread = active;
    const s = socketRef.current;
    if (!v || !thread || !s?.connected) return;
    setText('');
    const productId =
      thread.kind === 'seller' ? productIdForFirstSellerMsg.current : null;
    if (productId) productIdForFirstSellerMsg.current = null;

    s.emit('typing_status', { conversationId: thread.id, isTyping: false });
    s.emit(
      'send_message',
      {
        conversationId: thread.id,
        text: v,
        ...(productId ? { productId } : {}),
      },
      (ack: { success?: boolean }) => {
        if (!ack?.success) {
          setText(v);
        }
      },
    );
  }, [active, text]);

  const onTextChange = (v: string) => {
    setText(v);
    const thread = active;
    const s = socketRef.current;
    if (!thread || !s?.connected) return;
    s.emit('typing_status', {
      conversationId: thread.id,
      isTyping: v.trim().length > 0,
    });
  };

  const ctx = useMemo<ChatHubContextValue>(
    () => ({
      openHub,
      openSellerChat,
      openDeliveryForOrder,
      openHubWithSupport,
      openCareProviderChat,
      inboxThreads: threads,
      inboxLoading: loadingList,
      refreshInboxPreview: refreshInbox,
      openKnownThread,
      hubOpen,
      chatUnreadTotal,
    }),
    [
      openHub,
      openSellerChat,
      openDeliveryForOrder,
      openHubWithSupport,
      openCareProviderChat,
      threads,
      loadingList,
      refreshInbox,
      openKnownThread,
      hubOpen,
      chatUnreadTotal,
    ],
  );

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <ChatHubContext.Provider value={ctx}>
      {children}
      {hubOpen ? (
        <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2">
          <div
            className="w-[min(100vw-1.5rem,22rem)] max-h-[min(70vh,32rem)] flex flex-col rounded-2xl border border-[#703418]/20 bg-[#fdf8f5] shadow-2xl overflow-hidden font-sans"
          >
            <div className="flex items-center justify-between px-3 py-2.5 bg-[#703418] text-white">
              {view === 'thread' && active ? (
                <button
                  type="button"
                  onClick={() => {
                    setView('list');
                    setActive(null);
                    void refreshInbox();
                  }}
                  className="p-1 rounded-lg hover:bg-white/10"
                  aria-label="Back"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              ) : (
                <span className="w-7" />
              )}
              <span className="font-semibold text-sm truncate flex-1 text-center">
                {view === 'thread' && active ? active.title : 'Messages'}
              </span>
              <button
                type="button"
                onClick={() => setHubOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {view === 'list' && (
              <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[320px]">
                {loadingList ? (
                  <div className="flex flex-col items-center gap-2 p-6">
                    <PawSewaLogoSpinner size={48} />
                    <p className="text-sm text-gray-600">Loading…</p>
                  </div>
                ) : threads.length === 0 ? (
                  <p className="p-4 text-sm text-gray-600">No conversations yet.</p>
                ) : (
                  <ul className="divide-y divide-[#0d9488]/15">
                    {threads.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openThread(t)}
                          className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-[#0d9488]/10 transition-colors"
                        >
                          <div className="relative shrink-0">
                            {t.kind === 'support' ? (
                              <Image
                                src="/brand/image_607767.png"
                                alt=""
                                width={40}
                                height={40}
                                className="object-contain !bg-transparent border border-[#703418]/20 rounded-lg"
                                style={{ backgroundColor: 'transparent' }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#0d9488]/20 flex items-center justify-center text-[#703418] text-sm font-bold">
                                {(t.title || '?')[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-[#703418] truncate">
                              {t.title}
                            </p>
                            {t.subtitle ? (
                              <p className="text-xs text-gray-600 truncate">{t.subtitle}</p>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {view === 'thread' && active && (
              <>
                <div className="px-3 py-1.5 flex items-center gap-2 border-b border-[#703418]/10 bg-white/80">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      peerOnline ? 'bg-[#0d9488]' : 'bg-gray-300'
                    }`}
                    title={peerOnline ? 'Online' : 'Offline'}
                  />
                  <span className="text-xs text-gray-600">
                    {peerOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[260px] bg-white/60">
                  {loadingThread ? (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <PawSewaLogoSpinner size={44} />
                      <p className="text-sm text-gray-500">Loading messages…</p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m._id}
                        className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}
                      >
                        {m.productName ? (
                          <p className="text-[10px] font-semibold text-[#0d9488] mb-0.5">
                            Product: {m.productName}
                          </p>
                        ) : null}
                        <div
                          className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                            m.mine
                              ? 'bg-[#703418] text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {m.text}
                        </div>
                        {m.mine && seenByPeer ? (
                          <span className="text-[10px] text-gray-400 mt-0.5">Seen</span>
                        ) : null}
                      </div>
                    ))
                  )}
                  {typingRemote && (
                    <p className="text-xs text-gray-500 italic">Typing…</p>
                  )}
                </div>
                <div className="flex gap-2 p-2 border-t border-[#703418]/10 bg-white">
                  <input
                    className="flex-1 rounded-full border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Message…"
                    value={text}
                    onChange={(e) => onTextChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    className="rounded-full p-2.5 bg-[#703418] text-white hover:bg-[#5c2c14]"
                    aria-label="Send"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </ChatHubContext.Provider>
  );
}
