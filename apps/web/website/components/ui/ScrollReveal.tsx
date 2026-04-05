"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  delay?: number;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  as: Component = "div",
  delay = 0,
  className,
  children,
  ...rest
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const target = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setVisible(true), delay);
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [delay]);

  return (
    <Component
      ref={ref as React.Ref<HTMLElement>}
      className={cn(
        "paw-section",
        visible && "paw-section-visible",
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
};

