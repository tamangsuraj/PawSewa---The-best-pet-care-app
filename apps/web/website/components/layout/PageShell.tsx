import { cn } from '@/lib/utils';

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Extra bottom padding for floating UI */
  padBottom?: boolean;
};

/**
 * Shared page canvas: editorial gradient wash + readable ink text.
 * Pairs with global `.paw-noise` on `body` for grain.
 */
export function PageShell({ children, className, padBottom = false }: Props) {
  return (
    <div
      className={cn(
        'relative min-h-screen text-paw-ink',
        padBottom && 'pb-24',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_70%_at_0%_-15%,rgba(13,148,136,0.07),transparent_52%),radial-gradient(ellipse_60%_50%_at_100%_0%,rgba(91,67,48,0.05),transparent_45%),linear-gradient(180deg,rgba(253,249,244,0.97)_0%,rgba(250,246,240,0.55)_55%,rgba(245,237,228,0.35)_100%)]"
        aria-hidden
      />
      {children}
    </div>
  );
}
