'use client';

import Image from 'next/image';
import { PAWSEWA_LOGO_ALT } from './PawSewaLogo';

type Props = {
  size?: number;
  className?: string;
};

/** Loading indicator: spinning brand mark (decorative motion; status from aria-live parent). */
export function PawSewaLogoSpinner({ size = 56, className = '' }: Props) {
  return (
    <div
      className={`inline-flex items-center justify-center bg-transparent ${className}`}
      role="status"
      aria-label={`Loading — ${PAWSEWA_LOGO_ALT}`}
    >
      <Image
        src="/brand/image_607767.png"
        alt=""
        width={size}
        height={size}
        className="animate-spin object-contain !bg-transparent"
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
        aria-hidden
      />
    </div>
  );
}
