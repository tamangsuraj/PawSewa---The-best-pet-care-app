'use client';

import Image from 'next/image';

export const PAWSEWA_LOGO_ALT = 'PawSewa - Care and Commerce for Pets';

type Props = {
  variant?: 'nav' | 'hero';
  height?: number;
  className?: string;
  priority?: boolean;
  /**
   * Renders the mark as light/white for dark backgrounds (e.g. footer).
   * Does not affect other surfaces unless set.
   */
  invertOnDark?: boolean;
};

/** Corporate PawSewa mark (#703418 transparent PNG) for headers and marketing surfaces. */
export function PawSewaLogo({
  variant = 'nav',
  height = 40,
  className = '',
  priority = false,
  invertOnDark = false,
}: Props) {
  const src = '/brand/image_607767.png';
  const nav = variant === 'nav';
  const aspect = nav ? 4.6 : 3.2;
  const w = Math.round(height * aspect);

  return (
    <span
      className={`inline-flex items-center justify-start bg-transparent ${nav ? 'leading-none' : ''}`}
    >
      <Image
        src={src}
        alt={PAWSEWA_LOGO_ALT}
        width={w}
        height={height}
        className={[
          'w-auto object-contain object-left !bg-transparent',
          nav ? 'max-w-[min(100vw-8rem,420px)]' : 'max-w-[min(100%,280px)]',
          invertOnDark ? 'brightness-0 invert' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ height, width: 'auto', maxHeight: height, backgroundColor: 'transparent' }}
        priority={priority}
        sizes={nav ? `(max-width: 640px) 240px, ${Math.min(w, 420)}px` : '(max-width:768px) 280px, 400px'}
      />
    </span>
  );
}
