'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { PageContent } from '@/components/layout/PageContent';
import { PawSewaLoader } from '@/components/PawSewaLoader';

export default function MarketplaceChatPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<{ _id: string; content?: string; productName?: string }[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/marketplace-chat/conversations/${params.conversationId}/messages`);
      setMessages(res.data?.data ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [params.conversationId]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [isAuthenticated, router, load]);

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
    <PageShell className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-paw-bark/10 bg-paw-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/shop" className="p-2 -ml-2 rounded-xl hover:bg-paw-sand/80 text-paw-bark transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="font-display text-lg font-semibold text-paw-ink">Chat</h1>
        </div>
      </header>
      <PageContent flush className="min-h-0 flex-1 overflow-y-auto py-4">
      <main className="space-y-2">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <PawSewaLoader width={120} />
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m._id}
              className="max-w-[85%] rounded-2xl border border-paw-bark/10 bg-white/90 px-3 py-2 text-sm text-paw-ink shadow-sm"
            >
              {m.productName ? (
                <p className="text-xs font-semibold text-paw-bark mb-1">Product: {m.productName}</p>
              ) : null}
              <p>{m.content}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>
      </PageContent>
      <div className="border-t border-paw-bark/10 bg-paw-cream/95 p-3">
        <div className="mx-auto flex max-w-6xl gap-2 px-4 sm:px-6">
        <input
          className="paw-input flex-1 rounded-full text-sm"
          placeholder="Message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button type="button" onClick={send} className="paw-cta-primary shrink-0 px-5 py-2 text-sm">
          Send
        </button>
        </div>
      </div>
    </PageShell>
  );
}
