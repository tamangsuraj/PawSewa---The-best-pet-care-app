'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  formatLabel?: (n: number) => string;
};

export function PriceRangeDualSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  formatLabel = (n) => `Rs. ${n.toLocaleString('en-NP')}`,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const setFromClientX = useCallback(
    (clientX: number, which: 'min' | 'max') => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / 50) * 50;
      const v = clamp(stepped);
      if (which === 'min') {
        onChange(Math.min(v, valueMax - 50), valueMax);
      } else {
        onChange(valueMin, Math.max(v, valueMin + 50));
      }
    },
    [clamp, max, min, onChange, valueMin, valueMax]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setFromClientX(e.clientX, dragging);
    const up = () => setDragging(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, setFromClientX]);

  const minPct = ((valueMin - min) / (max - min)) * 100;
  const maxPct = ((valueMax - min) / (max - min)) * 100;

  return (
    <div className="pt-1">
      <div className="mb-3 flex justify-between text-xs font-medium text-[#4A2E1B]/70">
        <span>{formatLabel(valueMin)}</span>
        <span>{valueMax >= max ? `${formatLabel(max)}+` : formatLabel(valueMax)}</span>
      </div>
      <div
        ref={trackRef}
        className="relative mx-1 h-2 rounded-full bg-[#E5E0D8]"
        onPointerDown={(e) => {
          const el = trackRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const raw = min + ratio * (max - min);
          const v = clamp(Math.round(raw / 50) * 50);
          const distMin = Math.abs(v - valueMin);
          const distMax = Math.abs(v - valueMax);
          setDragging(distMin <= distMax ? 'min' : 'max');
          if (distMin <= distMax) {
            onChange(Math.min(v, valueMax - 50), valueMax);
          } else {
            onChange(valueMin, Math.max(v, valueMin + 50));
          }
        }}
      >
        <div
          className="absolute top-0 h-2 rounded-full bg-[#4A2E1B]"
          style={{
            left: `${minPct}%`,
            width: `${Math.max(0, maxPct - minPct)}%`,
          }}
        />
        <button
          type="button"
          aria-label="Minimum price"
          className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-[#4A2E1B] shadow-md active:cursor-grabbing"
          style={{ left: `${minPct}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            setDragging('min');
          }}
        />
        <button
          type="button"
          aria-label="Maximum price"
          className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-[#4A2E1B] shadow-md active:cursor-grabbing"
          style={{ left: `${maxPct}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            setDragging('max');
          }}
        />
      </div>
    </div>
  );
}
