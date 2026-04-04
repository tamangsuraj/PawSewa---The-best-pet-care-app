'use client';

import Image from 'next/image';

export const PAWSEWA_LOGO_ALT = 'PawSewa - Care and Commerce for Pets';

type Props = {
  variant?: 'nav' | 'hero';
  height?: number;
  className?: string;
  priority?: boolean;
};

export function PawSewaLogo({ variant = 'nav', height = 40, className = '', priority = false }: Props) {
  const src = '/brand/image_607767.png';
  const w =
    variant === 'nav' ? Math.round(height * 4) : Math.round(height * 3.2);

  return (
    <Image
      src={src}
      alt={PAWSEWA_LOGO_ALT}
      width={w}
      height={height}
      className={`w-auto max-w-[min(100%,280px)] object-contain object-left ${className}`}
      style={{ height, width: 'auto' }}
      priority={priority}
      sizes={variant === 'nav' ? `${w}px` : '(max-width:768px) 280px, 400px'}
    />
  );
}
