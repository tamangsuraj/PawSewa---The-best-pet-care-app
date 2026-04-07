'use client';

import { PawSewaLoader } from './PawSewaLoader';
import { PAWSEWA_LOGO_ALT } from './PawSewaLogo';

type Props = {
  size?: number;
  className?: string;
};

/** Loading indicator — same dog Lottie as mobile apps (replaces spinning logo). */
export function PawSewaLogoSpinner({ size = 56, className = '' }: Props) {
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-label={`Loading — ${PAWSEWA_LOGO_ALT}`}
    >
      <PawSewaLoader width={size} />
    </div>
  );
}
