'use client';

import { useRef, useEffect, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a <table> in a horizontally-scrollable container.
 *
 * Features:
 *  - overflow-x: auto  → native horizontal scrollbar always available
 *  - Shift + MouseWheel → translates vertical scroll to horizontal (desktop UX)
 *  - Thin, styled scrollbar (webkit + Firefox)
 */
export default function ScrollableTableWrapper({ children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    // passive: false so we can call preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={ref}
      className={[
        'overflow-x-auto',
        // Thin scrollbar — webkit
        '[&::-webkit-scrollbar]:h-1.5',
        '[&::-webkit-scrollbar-track]:bg-gray-100',
        '[&::-webkit-scrollbar-thumb]:bg-gray-300',
        '[&::-webkit-scrollbar-thumb]:rounded-full',
        '[&::-webkit-scrollbar-thumb:hover]:bg-gray-400',
        className,
      ].join(' ')}
      // Firefox thin scrollbar
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}
    >
      {children}
    </div>
  );
}
