'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { ArrowLeft, MessageSquare } from 'lucide-react';

interface ConvRow {
  _id: string;
  lastMessageAt?: string;
  customer?: { name?: string; email?: string; phone?: string };
  partner?: { name?: string; email?: string; phone?: string; role?: string };
  lastProductName?: string;
}

interface MsgRow {
  _id: string;
  content?: string;
  mediaUrl?: string;
  createdAt?: string;
  sender?: { name?: string; role?: string };
}

export default function ShopChatsAuditPage() {
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get<{ success: boolean; data?: { conversations?: ConvRow[] } }>(
        '/admin/shop-chat/threads',
        { params: { limit: 100 } }
      );
      setRows(r.data?.data?.conversations ?? []);
    } catch (e: unknown) {
      setErr(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to load threads'
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openTranscript = async (id: string) => {
    setOpenId(id);
    setMsgLoading(true);
    setMsgs([]);
    try {
      const r = await api.get<{ success: boolean; data?: { messages?: MsgRow[] } }>(
        `/admin/shop-chat/${id}/messages`
      );
      setMsgs(r.data?.data?.messages ?? []);
    } catch {
      setMsgs([]);
    } finally {
      setMsgLoading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-dvh">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/supplies"
          className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to logistics
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Shop chat audit</h1>
      <p className="text-gray-600 mb-6 max-w-2xl">
        Super-view of customer to shop_owner marketplace threads. Open a row to read the full
        transcript for disputes or quality control.
      </p>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Shop</th>
                <th className="px-4 py-3 font-semibold">Last product</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No seller threads yet.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c._id} className="border-t border-gray-100 hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      {c.customer?.name ?? '—'}
                      {c.customer?.phone ? (
                        <span className="block text-xs text-gray-500">{c.customer.phone}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {c.partner?.name ?? '—'}
                      {c.partner?.role ? (
                        <span className="block text-xs text-gray-500">{c.partner.role}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.lastProductName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openTranscript(c._id)}
                        className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Transcript
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold text-gray-900">Transcript</h2>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800"
                onClick={() => {
                  setOpenId(null);
                  setMsgs([]);
                }}
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 text-sm">
              {msgLoading ? (
                <p className="text-gray-500">Loading…</p>
              ) : msgs.length === 0 ? (
                <p className="text-gray-500">No messages.</p>
              ) : (
                <ul className="space-y-3">
                  {msgs.map((m) => (
                    <li key={m._id} className="border-b border-gray-100 pb-2">
                      <p className="text-xs text-gray-500">
                        {m.sender?.name ?? 'User'} ·{' '}
                        {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                      </p>
                      {m.content ? <p className="text-gray-900 mt-1">{m.content}</p> : null}
                      {m.mediaUrl ? (
                        <a
                          href={m.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-xs underline mt-1 inline-block"
                        >
                          Media
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
