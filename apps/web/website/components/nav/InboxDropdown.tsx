'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Inbox, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChatHub, type HubThread } from '@/context/ChatHubContext';

export function InboxDropdown() {
  const { isAuthenticated } = useAuth();
  const {
    inboxThreads,
    inboxLoading,
    refreshInboxPreview,
    openHub,
    openKnownThread,
    hubOpen,
  } = useChatHub();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    if (open && isAuthenticated) {
      void refreshInboxPreview();
    }
  }, [open, isAuthenticated, refreshInboxPreview]);

  if (!isAuthenticated) {
    return (
      <a
        href="/login?next=/"
        className="text-[#4B3621]/88 hover:text-[#2e2118] text-sm font-semibold px-3.5 py-2 rounded-full hover:bg-[#4B3621]/[0.07] transition-colors"
      >
        Inbox
      </a>
    );
  }

  const openThreadFromPreview = async (t: HubThread) => {
    setOpen(false);
    await refreshInboxPreview();
    openKnownThread(t);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-full transition-all border ${
          open || hubOpen
            ? 'text-[#FAF7F2] bg-gradient-to-br from-[#5c4330] to-[#3d2a1c] border-[#4B3621]/25 shadow-[0_4px_14px_rgba(75,54,33,0.2)]'
            : 'text-[#4B3621]/88 border-transparent hover:bg-[#4B3621]/[0.07]'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Inbox className="w-4 h-4" />
        Inbox
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[min(70vh,24rem)] overflow-y-auto rounded-2xl border border-[#4B3621]/15 bg-[#FAF7F2] shadow-[0_24px_60px_rgba(75,54,33,0.18)] z-[60] py-2">
          <div className="px-3 pb-2 border-b border-[#4B3621]/10 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#4B3621]/70">
              Messages
            </span>
            <span className="text-[10px] text-[#0d9488]">Socket.io · realtime</span>
          </div>
          {inboxLoading ? (
            <p className="p-4 text-sm text-gray-500">Loading…</p>
          ) : inboxThreads.length === 0 ? (
            <p className="p-4 text-sm text-gray-600">No threads yet. Open the chat bubble to start.</p>
          ) : (
            <ul className="py-1">
              {inboxThreads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => void openThreadFromPreview(t)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/80 transition-colors"
                  >
                    {t.kind === 'support' ? (
                      <Image
                        src="/brand/image_607767.png"
                        alt=""
                        width={36}
                        height={36}
                        className="rounded-full object-cover border border-[#4B3621]/15"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#0d9488]/15 flex items-center justify-center text-[#4B3621] text-xs font-bold shrink-0">
                        {(t.title || '?')[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#4B3621] truncate">{t.title}</p>
                      {t.subtitle ? (
                        <p className="text-xs text-gray-500 truncate">{t.subtitle}</p>
                      ) : null}
                    </div>
                    <MessageCircle className="w-4 h-4 text-[#0d9488] shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-[#4B3621]/10 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openHub();
              }}
              className="w-full text-center text-sm font-semibold text-[#0d9488] hover:underline"
            >
              Open full inbox
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
