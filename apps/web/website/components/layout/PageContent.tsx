import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
  /** Shop / dense grids — matches home wide sections */
  wide?: boolean;
  /** Less vertical padding (e.g. under a hero) */
  compact?: boolean;
  /** No vertical padding — page handles its own (e.g. shop grid) */
  flush?: boolean;
};

/**
 * Standard inner width + padding for marketing pages (matches home `max-w-6xl` rhythm).
 */
export function PageContent({ children, className, wide, compact, flush }: Props) {
  return (
    <div
      className={cn(
        'mx-auto px-4 sm:px-6',
        wide ? 'max-w-[1600px]' : 'container max-w-6xl',
        flush ? 'py-0' : compact ? 'py-8' : 'py-12 md:py-14',
        className,
      )}
    >
      {children}
    </div>
  );
}
