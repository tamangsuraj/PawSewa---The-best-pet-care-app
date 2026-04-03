'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import api from '@/lib/api';
import { Megaphone, Send, Search, RefreshCw } from 'lucide-react';

interface NotificationLog {
  _id: string;
  title: string;
  message: string;
  targetCount: number;
  createdAt: string;
}

export default function CommunicationCenterPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [search, setSearch] = useState('');

  const loadHistory = async (q?: string) => {
    try {
      setLoading(true);
      const resp = await api.get('/notifications/broadcast/history', {
        params: q && q.trim() ? { search: q.trim() } : undefined,
      });
      setLogs(resp.data?.data || []);
    } catch (e) {
      setLogs([]);
      // eslint-disable-next-line no-console
      console.error('Failed to load broadcast history', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filtered = useMemo(() => logs, [logs]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const t = title.trim();
    const m = message.trim();
    if (!t || !m) {
      setStatus('Title and Message are required.');
      return;
    }
    try {
      setSending(true);
      const resp = await api.post('/notifications/broadcast', { title: t, message: m });
      setStatus(resp.data?.message || '[SUCCESS] Notification broadcasted to all active devices.');
      setTitle('');
      setMessage('');
      await loadHistory();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Broadcast failed.';
      setStatus(msg);
    } finally {
      setSending(false);
    }
  };

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadHistory(search);
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-secondary">
        <Sidebar />

        <div className="flex-1 ml-64">
          <Header />

          <main className="pt-24 px-6 pb-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                <Megaphone className="w-8 h-8 text-primary" />
                Communication Center
              </h1>
              <p className="text-gray-600">
                Broadcast messages to all active devices and track the history of communications.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Notification</h2>

                {status && (
                  <div className="mb-4 text-sm border rounded-xl px-4 py-3 bg-gray-50 text-gray-900">
                    {status}
                  </div>
                )}

                <form onSubmit={onSend} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={120}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Maintenance notice"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      maxLength={1000}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="We will be performing maintenance at 10:00 PM."
                    />
                    <div className="mt-1 text-xs text-gray-500">{message.length}/1000</div>
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending…' : 'Send Broadcast'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Sent Notifications</h2>
                    <div className="text-xs text-gray-600">Sorted by most recent.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadHistory(search)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>

                <div className="px-6 py-4 border-b border-gray-100">
                  <form onSubmit={onSearch} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Search title or message"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-3 rounded-xl bg-gray-900 text-white hover:opacity-90"
                    >
                      Search
                    </button>
                  </form>
                </div>

                {loading ? (
                  <div className="p-6 text-sm text-gray-600">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-6 text-sm text-gray-600">No broadcasts found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-gray-600">
                        <tr className="border-b border-gray-100">
                          <th className="px-6 py-3 font-medium">Date/Time</th>
                          <th className="px-6 py-3 font-medium">Title</th>
                          <th className="px-6 py-3 font-medium">Message</th>
                          <th className="px-6 py-3 font-medium">Target Count</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-900">
                        {filtered.map((l) => (
                          <tr key={l._id} className="border-b border-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700">
                              {new Date(l.createdAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-semibold">{l.title}</td>
                            <td className="px-6 py-4 text-gray-800 max-w-[420px]">
                              <div className="line-clamp-3">{l.message}</div>
                            </td>
                            <td className="px-6 py-4">{l.targetCount ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

