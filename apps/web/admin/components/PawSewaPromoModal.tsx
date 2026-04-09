'use client';

import Image, { type StaticImageData } from 'next/image';

type Props = {
  open: boolean;
  title: string;
  offerText: string;
  subtitle?: string;
  promoCode?: string;
  promoHint?: string;
  ctaText: string;
  imageSrc: string | StaticImageData;
  onClose: () => void;
  onCta?: () => void;
};

export function PawSewaPromoModal(props: Props) {
  const {
    open,
    title,
    offerText,
    subtitle,
    promoCode,
    promoHint,
    ctaText,
    imageSrc,
    onClose,
    onCta,
  } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[5px]" />

      <div className="absolute inset-0 grid place-items-center px-4">
        <div className="w-full max-w-[420px] translate-y-4">
          <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={imageSrc}
                alt={title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-transparent" />
            </div>

            <div className="px-5 pt-4 pb-5 text-center">
              <p className="text-[13px] font-semibold text-[#5c2d12]/75">
                {title}
              </p>
              <p className="mt-2 text-[34px] leading-[1.02] font-extrabold text-[#2c1810]">
                {offerText}
              </p>
              {subtitle ? (
                <p className="mt-2 text-[13px] font-medium text-[#5c2d12]/65">
                  {subtitle}
                </p>
              ) : null}

              {promoCode ? (
                <div className="mt-4 rounded-[14px] border border-[#703418]/35 bg-[#faf8f5] px-4 py-3">
                  <p className="text-[12px] font-semibold text-[#2c1810]/70">
                    Use code
                  </p>
                  <div className="mt-2 inline-flex items-center justify-center rounded-full border border-[#703418]/45 bg-white px-4 py-2">
                    <span className="text-[14px] font-extrabold tracking-[0.12em] text-[#703418]">
                      {promoCode}
                    </span>
                  </div>
                  {promoHint ? (
                    <p className="mt-2 text-[11.5px] font-medium text-[#2c1810]/60">
                      {promoHint}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={onCta}
                className="mt-4 w-full h-12 rounded-[14px] border border-[#2c1810]/25 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.10)] inline-flex items-center justify-center gap-3"
              >
                <span className="text-[14.5px] font-bold text-[#2c1810]">
                  {ctaText}
                </span>
                <span className="h-8 w-8 rounded-full bg-[#703418]/10 inline-flex items-center justify-center text-[#703418]">
                  →
                </span>
              </button>
            </div>
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-[46px] w-[46px] rounded-full bg-white border border-black/10 shadow-[0_16px_40px_rgba(0,0,0,0.28)] inline-flex items-center justify-center text-[#2c1810]/80"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

