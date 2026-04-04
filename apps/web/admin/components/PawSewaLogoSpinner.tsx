'use client';

import Image from 'next/image';
import { PAWSEWA_LOGO_ALT } from './PawSewaLogo';

type Props = { size?: number; className?: string; imageClassName?: string };

export function PawSewaLogoSpinner({ size = 56, className = '', imageClassName = '' }: Props) {
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-label={`Loading — ${PAWSEWA_LOGO_ALT}`}
    >
      <Image
        src="/brand/image_607767.png"
        alt=""
        width={size}
        height={size}
        className={`animate-spin object-contain ${imageClassName}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    </div>
  );
}
