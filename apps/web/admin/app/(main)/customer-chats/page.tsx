'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { getAdminSocket } from '@/lib/socket';
import { getStoredAdminUser } from '@/lib/authStorage';
import { MessageCircle, RefreshCw, Search, Send } from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface ConvRow {
  _id: string;
  threadLabel?: string;
  customerRole?: string;
  customerRoleLabel?: string;
  customer?: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    profilePicture?: string;
    role?: string;
  };
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

interface LookupUser {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  roleLabel?: string;
  phone?: string;
  profilePicture?: string;
  clinicName?: string;
  specialization?: string;
}

function formatSupportRoleLabel(role: string | undefined): string {
  if (!role) return 'User';
  const m: Record<string, string> = {
    pet_owner: 'Customer',
    customer: 'Customer',
    veterinarian: 'Vet',
    vet: 'Vet',
    rider: 'Rider',
    shop_owner: 'Seller',
    admin: 'Admin',
    groomer: 'Groomer',
    trainer: 'Trainer',
    hostel_owner: 'Hostel',
    care_service: 'Care provider',
    service_provider: 'Service provider',
    facility_owner: 'Facility',
  };
  return m[role] || role;
}

function displayThreadTitle(c: ConvRow): string {
  if (c.threadLabel) return c.threadLabel;
  const name = c.customer?.name || 'User';
  const rl = c.customerRoleLabel || formatSupportRoleLabel(c.customer?.role);
  return `${name} — ${rl}`;
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

  const [searchEmail, setSearchEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupUser, setLookupUser] = useState<LookupUser | null>(null);
  const [lookupStats, setLookupStats] = useState<Record<string, number>>({});
  const [lookupSupportId, setLookupSupportId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [ensureLoading, setEnsureLoading] = useState(false);

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
      const resp = await api.get<{ data: ChatMessage[] }>(
        `/customer-care/conversations/${conversationId}/messages`
      );
      const rows = resp.data?.data || [];
      setMessages(
        rows.map((m) => ({
          ...m,
          timestamp:
            typeof m.timestamp === 'string'
              ? m.timestamp
              : new Date(m.timestamp as unknown as Date).toISOString(),
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
    const s = getAdminSocket();
    if (!s) return;
    const onBump = (raw: Record<string, unknown>) => {
      const conversationId = String(raw.conversationId || '');
      if (!conversationId) return;
      const lastMessageAt = String(raw.lastMessageAt || new Date().toISOString());
      const lastMessagePreview = String(raw.lastMessagePreview || '');
      const customerName = String(raw.customerName || 'User');
      const customerEmail = String(raw.customerEmail || '');
      const customerId = String(raw.customerId || '');
      const customerRole = String(raw.customerRole || '');
      const roleLabel = formatSupportRoleLabel(customerRole);
      const threadLabel = `${customerName} — ${roleLabel}`;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === conversationId);
        const existing = idx >= 0 ? prev[idx] : null;
        const customer = existing?.customer || {
          _id: customerId,
          name: customerName,
          email: customerEmail,
          role: customerRole || undefined,
        };
        const row: ConvRow = {
          _id: conversationId,
          threadLabel,
          customerRole: customerRole || existing?.customerRole,
          customerRoleLabel: roleLabel,
          customer: { ...customer, name: customerName || customer.name, email: customerEmail || customer.email },
          lastMessagePreview,
          lastMessageAt,
          careAdmin: existing?.careAdmin,
        };
        const rest = prev.filter((c) => c._id !== conversationId);
        return [row, ...rest];
      });
    };
    s.on('support_inbox_bump', onBump);
    return () => {
      s.off('support_inbox_bump', onBump);
    };
  }, []);

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
          console.warn('[Support Hub] join_customer_care_room failed', ack);
        } else {
          s.emit('mark_read', { conversationId: cid });
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

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
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

  const runLookup = async () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email) {
      setLookupError('Enter an exact email address');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupUser(null);
    setLookupStats({});
    setLookupSupportId(null);
    try {
      const resp = await api.get<{
        success: boolean;
        data?: { user: LookupUser; stats: Record<string, number>; supportConversationId: string | null };
        message?: string;
      }>('/admin/support/user-lookup', { params: { email } });
      if (!resp.data?.success || !resp.data.data) {
        throw new Error(resp.data?.message || 'Lookup failed');
      }
      const d = resp.data.data;
      setLookupUser(d.user);
      setLookupStats(d.stats || {});
      setLookupSupportId(d.supportConversationId);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setLookupError(ax.response?.data?.message || 'No user found');
    } finally {
      setLookupLoading(false);
    }
  };

  const openThreadForLookup = async () => {
    const email = searchEmail.trim().toLowerCase();
    if (!lookupUser && !email) return;
    setEnsureLoading(true);
    try {
      const body = lookupUser?._id ? { userId: lookupUser._id } : { email };
      const resp = await api.post<{
        success: boolean;
        data?: {
          conversation: { _id: string };
          threadLabel?: string;
          customer?: ConvRow['customer'];
        };
      }>('/admin/support/ensure-thread', body);
      if (!resp.data?.success || !resp.data.data?.conversation?._id) {
        throw new Error('Could not open thread');
      }
      const { conversation, threadLabel, customer } = resp.data.data;
      const id = conversation._id;
      const roleLabel =
        formatSupportRoleLabel(customer?.role) ||
        (threadLabel?.includes('—') ? threadLabel.split('—').pop()?.trim() : undefined);
      const row: ConvRow = {
        _id: id,
        threadLabel,
        customer,
        customerRole: customer?.role,
        customerRoleLabel: roleLabel,
      };
      setConversations((prev) => {
        const rest = prev.filter((c) => c._id !== id);
        return [row, ...rest];
      });
      setSelected(row);
      setLookupSupportId(id);
    } catch {
      /* snack optional */
    } finally {
      setEnsureLoading(false);
    }
  };

  const adminUser = getStoredAdminUser<{ _id?: string }>();
  const adminId = adminUser?._id ? String(adminUser._id) : '';

  const statLines: string[] = [];
  if (lookupStats.petCount != null) statLines.push(`${lookupStats.petCount} pet(s)`);
  if (lookupStats.deliveredOrderCount != null)
    statLines.push(`${lookupStats.deliveredOrderCount} delivered orders`);
  if (lookupStats.activeDeliveryCount != null)
    statLines.push(`${lookupStats.activeDeliveryCount} active deliveries`);
  if (lookupStats.yearsOnPlatform != null)
    statLines.push(`${lookupStats.yearsOnPlatform} year(s) on platform`);

  return (
    <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                  <Send className="w-8 h-8 text-primary" />
                  Support Hub
                </h1>
                <p className="text-gray-600">
                  Search by email, view profiles, and reply to PawSewa support threads in real time.
                </p>
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
                <div className="px-4 py-3 border-b border-gray-100 space-y-3">
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    Inbox
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="search"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runLookup()}
                      placeholder="Exact user email…"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                    <button
                      type="button"
                      onClick={() => runLookup()}
                      disabled={lookupLoading}
                      className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-50"
                      aria-label="Search user by email"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                  {lookupError ? <p className="text-sm text-red-600">{lookupError}</p> : null}
                  {lookupUser ? (
                    <div className="rounded-xl border border-gray-100 bg-[#F7F4FC]/60 p-3 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Quick view
                      </div>
                      <div className="font-semibold text-gray-900">{lookupUser.name || '—'}</div>
                      <div className="text-sm text-gray-600">{lookupUser.email}</div>
                      <div className="text-sm text-primary font-medium">
                        {lookupUser.roleLabel || formatSupportRoleLabel(lookupUser.role)}
                      </div>
                      {lookupUser.clinicName ? (
                        <div className="text-xs text-gray-500">{lookupUser.clinicName}</div>
                      ) : null}
                      {statLines.length > 0 ? (
                        <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
                          {statLines.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">No extra stats for this role.</p>
                      )}
                      <button
                        type="button"
                        onClick={() => openThreadForLookup()}
                        disabled={ensureLoading}
                        className="w-full mt-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {ensureLoading ? 'Opening…' : 'Message'}
                      </button>
                      {lookupSupportId ? (
                        <p className="text-[11px] text-gray-400">Existing support thread found.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {loadingList ? (
                    <div className="p-4 text-sm text-gray-600">Loading…</div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600">No conversations yet.</div>
                  ) : (
                    conversations.map((c) => {
                      const active = selected?._id === c._id;
                      const title = displayThreadTitle(c);
                      const preview = c.lastMessagePreview || '—';
                      const at = c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : '';
                      return (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setSelected(c)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                            active ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                          }`}
                        >
                          <div className="font-medium text-gray-900 truncate">{title}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {c.customer?.email || c.customer?.phone || ''}
                          </div>
                          <div className="text-sm text-gray-600 line-clamp-2 mt-1">{preview}</div>
                          <div className="text-xs text-gray-400 mt-1">{at}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[420px]">
                {!selected ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 p-8">
                    Select a thread or use Message from a user lookup.
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-gray-100 bg-primary text-white">
                      <div className="font-semibold">{displayThreadTitle(selected)}</div>
                      <div className="text-xs text-white/85">{selected.customer?.email}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F4FC]/50 min-h-0">
                      {loadingMessages ? (
                        <div className="text-sm text-gray-600">Loading messages…</div>
                      ) : (
                        messages.map((m) => {
                          const mine = Boolean(adminId) && String(m.senderId) === adminId;
                          return (
                            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                  mine
                                    ? 'bg-[#703418] text-white'
                                    : 'bg-white border border-gray-200 text-gray-900'
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            void send();
                          }
                        }}
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
    </>
  );
}
