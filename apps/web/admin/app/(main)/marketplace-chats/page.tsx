'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { MessageCircle } from 'lucide-react';

export default function MarketplaceChatsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/marketplace-chat/admin/threads', { params: { limit: 80 } });
        const data = res.data?.data;
        setRows(Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []);
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        setErr(msg ?? 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Marketplace chats</h1>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Seller and delivery threads (support remains under Customer Chats).
      </p>
      {loading && <p className="text-gray-500">Loading…</p>}
      {err && <p className="text-red-600">{err}</p>}
      {!loading && !err && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Partner</th>
                <th className="p-3">Context</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = String(r['_id'] ?? '');
                const type = String(r['type'] ?? '');
                const customer = (r['customer'] ?? null) as Record<string, unknown> | null;
                const partner = (r['partner'] ?? null) as Record<string, unknown> | null;
                const lastProductName = r['lastProductName'];
                const order = r['order'];
                const updatedAt = r['updatedAt'];

                return (
                  <tr key={id} className="border-t border-gray-100">
                    <td className="p-3 font-medium">{type || '—'}</td>
                    <td className="p-3">
                      {String(customer?.['name'] ?? customer?.['email'] ?? '—')}
                    </td>
                    <td className="p-3">
                      {String(partner?.['name'] ?? '—')} ({String(partner?.['role'] ?? '?')})
                    </td>
                  <td className="p-3 max-w-xs truncate">
                    {type === 'SELLER'
                      ? String(lastProductName ?? '—') || '—'
                      : order
                        ? `Order ${String(order).slice(-6)}`
                        : '—'}
                  </td>
                  <td className="p-3 text-gray-500">
                    {updatedAt ? new Date(String(updatedAt)).toLocaleString() : '—'}
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-8 text-center text-gray-500">No marketplace threads yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
