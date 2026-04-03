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
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-label={`Loading — ${PAWSEWA_LOGO_ALT}`}
    >
      <Image
        src="/brand/pawsewa-logo.png"
        alt=""
        width={size}
        height={size}
        className="animate-spin object-contain"
        style={{ width: size, height: size }}
        aria-hidden
      />
    </div>
  );
}
