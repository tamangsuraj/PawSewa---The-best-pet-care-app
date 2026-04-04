'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { MessageCircle, RefreshCw, Send } from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface ConvRow {
  _id: string;
  customer?: { _id: string; name?: string; email?: string; phone?: string; profilePicture?: string };
  careAdmin?: { _id: string; name?: string };
  lastMessagePreview?: string;
  lastMessageAt?: string;
}

interface ChatMessage {
  _id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

export default function CustomerChatsPage() {
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<ConvRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listBottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const msgHandlerRef = useRef<((data: Record<string, unknown>) => void) | null>(null);
  const typingHandlerRef = useRef<((data: Record<string, unknown>) => void) | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoadingList(true);
      const resp = await api.get<{ data: ConvRow[] }>('/customer-care/conversations');
      setConversations(resp.data?.data || []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      const resp = await api.get<{ data: ChatMessage[] }>(`/customer-care/conversations/${conversationId}/messages`);
      const rows = resp.data?.data || [];
      setMessages(
        rows.map((m) => ({
          ...m,
          timestamp:
            typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp as unknown as Date).toISOString(),
        }))
      );
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    getAdminSocket();
  }, [loadConversations]);

  useEffect(() => {
    if (!selected?._id) return;
    loadMessages(selected._id);
  }, [selected?._id, loadMessages]);

  useEffect(() => {
    if (!selected?._id) return;
    const s = getAdminSocket();
    if (!s) return;
    socketRef.current = s;

    const cid = selected._id;

    const onMsg = (data: Record<string, unknown>) => {
      if (data?.conversationId !== cid) return;
      const mid = String(data.messageId || '');
      setMessages((prev) => {
        if (prev.some((p) => p._id === mid)) return prev;
        return [
          ...prev,
          {
            _id: mid || `tmp-${Date.now()}`,
            senderId: String(data.senderId || ''),
            receiverId: String(data.receiverId || ''),
            text: String(data.text || ''),
            timestamp: String(data.timestamp || new Date().toISOString()),
          },
        ];
      });
    };

    const onTyping = (data: Record<string, unknown>) => {
      if (data?.conversationId !== cid) return;
      if (data?.isTyping) {
        setTypingName((data.userName as string) || 'Customer');
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingName(null), 2500);
      } else {
        setTypingName(null);
      }
    };

    msgHandlerRef.current = onMsg;
    typingHandlerRef.current = onTyping;

    s.on('customer_care_new_message', onMsg);
    s.on('customer_care_is_typing', onTyping);

    const tryJoin = () => {
      s.emit('join_customer_care_room', cid, (ack: { success?: boolean }) => {
        if (!ack?.success) {
          // eslint-disable-next-line no-console
          console.warn('[Customer Chats] join_customer_care_room failed', ack);
        }
      });
    };

    if (s.connected) tryJoin();
    else s.once('connect', tryJoin);

    return () => {
      s.off('customer_care_new_message', onMsg);
      s.off('customer_care_is_typing', onTyping);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [selected?._id]);

  useEffect(() => {
    listBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingName]);

  const emitTyping = (isTyping: boolean) => {
    const s = socketRef.current || getAdminSocket();
    if (!s?.connected || !selected?._id) return;
    s.emit('customer_care_typing', { conversationId: selected._id, isTyping });
  };

  const onDraftChange = (v: string) => {
    setDraft(v);
    emitTyping(v.trim().length > 0);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t || !selected?._id) return;
    const s = getAdminSocket();
    setSending(true);
    emitTyping(false);
    try {
      if (s?.connected) {
        await new Promise<void>((resolve, reject) => {
          s.emit(
            'send_customer_care_message',
            { conversationId: selected._id, text: t },
            (ack: { success?: boolean; message?: string }) => {
              if (ack?.success) resolve();
              else reject(new Error(ack?.message || 'Send failed'));
            }
          );
        });
      } else {
        await api.post(`/customer-care/conversations/${selected._id}/messages`, { text: t });
        await loadMessages(selected._id);
      }
      setDraft('');
      await loadConversations();
    } catch {
      try {
        await api.post(`/customer-care/conversations/${selected._id}/messages`, { text: t });
        setDraft('');
        await loadMessages(selected._id);
        await loadConversations();
      } catch {
        // keep draft
      }
    } finally {
      setSending(false);
    }
  };

  const adminUser =
    typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('admin-user') || 'null') : null;
  const adminId = adminUser?._id ? String(adminUser._id) : '';

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-secondary">
        <Sidebar />
        <div className="flex-1 ml-64">
          <Header />
          <main className="pt-24 px-6 pb-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                  <MessageCircle className="w-8 h-8 text-primary" />
                  Customer Chats
                </h1>
                <p className="text-gray-600">Support Center — reply to pet owners in real time.</p>
              </div>
              <button
                type="button"
                onClick={() => loadConversations()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[calc(100vh-220px)]">
              <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">Inbox</div>
                <div className="flex-1 overflow-y-auto">
                  {loadingList ? (
                    <div className="p-4 text-sm text-gray-600">Loading…</div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600">No conversations yet.</div>
                  ) : (
                    conversations.map((c) => {
                      const active = selected?._id === c._id;
                      const name = c.customer?.name || 'Customer';
                      const preview = c.lastMessagePreview || '—';
                      const at = c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : '';
                      return (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setSelected(c)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                            active ? 'bg-[#5CB0CC]/10 border-l-4 border-l-[#5CB0CC]' : ''
                          }`}
                        >
                          <div className="font-medium text-gray-900 truncate">{name}</div>
                          <div className="text-xs text-gray-500 truncate">{c.customer?.email || c.customer?.phone}</div>
                          <div className="text-sm text-gray-600 line-clamp-2 mt-1">{preview}</div>
                          <div className="text-xs text-gray-400 mt-1">{at}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                {!selected ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 p-8">
                    Select a customer to open the chat.
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="font-semibold text-gray-900">{selected.customer?.name || 'Customer'}</div>
                      <div className="text-xs text-gray-500">{selected.customer?.email}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F4FC]/50">
                      {loadingMessages ? (
                        <div className="text-sm text-gray-600">Loading messages…</div>
                      ) : (
                        messages.map((m) => {
                          const mine = Boolean(adminId) && String(m.senderId) === adminId;
                          return (
                            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                  mine ? 'bg-[#5CB0CC] text-white' : 'bg-white border border-gray-200 text-gray-900'
                                }`}
                              >
                                {m.text}
                                <div
                                  className={`text-[10px] mt-1 ${mine ? 'text-white/80' : 'text-gray-400'}`}
                                >
                                  {new Date(m.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      {typingName ? (
                        <div className="text-xs text-gray-500 italic">{typingName} is typing…</div>
                      ) : null}
                      <div ref={listBottomRef} />
                    </div>
                    <form onSubmit={send} className="p-3 border-t border-gray-100 flex gap-2 bg-white">
                      <input
                        value={draft}
                        onChange={(e) => onDraftChange(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Type a reply…"
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        Send
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
