'use client';

import Image from 'next/image';

export const PAWSEWA_LOGO_ALT = 'PawSewa - Care and Commerce for Pets';

type Props = {
  variant?: 'nav' | 'hero';
  height?: number;
  className?: string;
  priority?: boolean;
  /**
   * When the PNG has a white matte, multiply blend lets the page show through
   * so the mark reads “floating” with no box. Prefer false for fully transparent PNGs.
   */
  blendWhiteMatte?: boolean;
};

/** Corporate PawSewa mark for headers and marketing surfaces. */
export function PawSewaLogo({
  variant = 'nav',
  height = 40,
  className = '',
  priority = false,
  blendWhiteMatte = false,
}: Props) {
  const src = '/brand/image_607767.png';
  const nav = variant === 'nav';
  const useMatte = blendWhiteMatte;
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
          'w-auto object-contain object-left bg-transparent',
          nav ? 'max-w-[min(100vw-8rem,420px)]' : 'max-w-[min(100%,280px)]',
          useMatte ? 'mix-blend-multiply' : '',
          nav
            ? 'drop-shadow-[0_2px_12px_rgba(112,52,24,0.12)]'
            : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ height, width: 'auto', maxHeight: height }}
        priority={priority}
        sizes={nav ? `(max-width: 640px) 240px, ${Math.min(w, 420)}px` : '(max-width:768px) 280px, 400px'}
      />
    </span>
  );
}
