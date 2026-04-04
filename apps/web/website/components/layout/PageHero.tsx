import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeroProps = {
  /** Small label above the title */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
  /** e.g. back link — rendered above eyebrow */
  leading?: ReactNode;
  /** e.g. refresh — right side on md+ */
  actions?: ReactNode;
};

/**
 * Dark editorial band with teal glow; pairs with PageShell.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  className,
  leading,
  actions,
}: PageHeroProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-gradient-to-br from-paw-bark via-paw-ink to-paw-umber text-paw-cream py-14 md:py-16 px-4',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_80%_20%,rgba(13,148,136,0.2),transparent_50%)]"
        aria-hidden
      />
      <div className="container mx-auto relative">
        {leading ? <div className="mb-4">{leading}</div> : null}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow ? (
              <p className="paw-eyebrow text-paw-cream/75 mb-3">{eyebrow}</p>
            ) : null}
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight mb-3">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-lg text-paw-cream/85 max-w-2xl leading-relaxed">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 md:pb-1">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
