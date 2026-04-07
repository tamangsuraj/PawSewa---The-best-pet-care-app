'use client';

import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

type PawSewaLoaderProps = {
  /** Display width in px (height matches for square viewport). */
  width?: number;
  className?: string;
};

/**
 * Same dog-running Lottie as Flutter apps and admin (`dog_running.json`).
 */
export function PawSewaLoader({ width = 150, className }: PawSewaLoaderProps) {
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/animations/dog_running.json')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <div
        className={className}
        style={{ width, height: width }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={`flex justify-center items-center ${className ?? ''}`}
      role="status"
      aria-label="Loading"
    >
      <Lottie animationData={data} loop style={{ width, height: width }} />
    </div>
  );
}
