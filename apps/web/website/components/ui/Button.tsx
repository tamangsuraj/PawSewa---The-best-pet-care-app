import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  className,
  children,
  ...props
}) => {
  const baseStyles =
    'px-6 py-3 rounded-full font-semibold tracking-tight transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0';

  const variants = {
    primary:
      'bg-gradient-to-br from-paw-bark to-paw-ink text-paw-cream shadow-paw hover:shadow-paw-lg hover:-translate-y-0.5 active:scale-[0.98]',
    secondary:
      'bg-white/90 text-paw-ink border border-paw-bark/15 shadow-sm backdrop-blur-sm hover:bg-white hover:shadow-paw active:scale-[0.98]',
    ghost: 'text-paw-ink hover:bg-paw-bark/[0.07] active:scale-[0.98]',
  };

  return (
    <button className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </button>
  );
};
