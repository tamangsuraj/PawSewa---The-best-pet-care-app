'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function MarketplaceChatPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await api.get(`/marketplace-chat/conversations/${params.conversationId}/messages`);
      setMessages(res.data?.data ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [isAuthenticated, params.conversationId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    try {
      await api.post(`/marketplace-chat/conversations/${params.conversationId}/messages`, { text: v });
      await load();
    } catch {
      setText(v);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/shop" className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-primary">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-lg font-bold text-primary">Chat</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          messages.map((m) => (
            <div
              key={m._id}
              className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-gray-100 text-gray-900"
            >
              {m.productName ? (
                <p className="text-xs font-semibold text-primary mb-1">Product: {m.productName}</p>
              ) : null}
              <p>{m.content}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>
      <div className="border-t border-gray-200 p-3 flex gap-2 bg-white">
        <input
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm"
          placeholder="Message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button
          type="button"
          onClick={send}
          className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
}
