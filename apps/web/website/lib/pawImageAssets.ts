/**
 * Canonical Unsplash URLs for the marketing site and fallbacks.
 *
 * Do not add one-off `photo-*` IDs here without verifying the image still exists
 * (removed photos cause Next/Image “upstream image response failed” / 404).
 */
function unsplash(photoId: string, w: number, q: number = 80): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&q=${q}`;
}

/** Default product / grid fallback (dog) — same id used across shop + seeds. */
export const PAW_DEFAULT_PRODUCT_IMAGE = unsplash('photo-1587300003388-59208cc962cb', 900, 80);

export const PAW_CAT_HERO = unsplash('photo-1514888286974-6c03e2ca1dba', 960, 85);

/** Home “Essential supplies” / showcase strip (4 tiles). */
export const PAW_SHOWCASE_IMAGES = [
  unsplash('photo-1587300003388-59208cc962cb', 800),
  unsplash('photo-1517849845537-4d257902454a', 800),
  unsplash('photo-1601758228041-f3b2795255f1', 800),
  unsplash('photo-1548199973-03cce0bbc87b', 800),
] as const;

/** Small deco thumbs (recent activity, etc.). */
export const PAW_DECO_IMAGES = [
  unsplash('photo-1587300003388-59208cc962cb', 400, 75),
  unsplash('photo-1450778869180-41d0601e046e', 400, 75),
  unsplash('photo-1517849845537-4d257902454a', 400, 75),
] as const;

/** Footer pet strip — order matches previous layout. */
export const PAW_FOOTER_STRIP_IMAGES = [
  { alt: 'Dog portrait', src: unsplash('photo-1587300003388-59208cc962cb', 400, 75) },
  { alt: 'Cat relaxing', src: unsplash('photo-1514888286974-6c03e2ca1dba', 400, 75) },
  { alt: 'Dog running', src: unsplash('photo-1601758228041-f3b2795255f1', 400, 75) },
  { alt: 'Dogs playing', src: unsplash('photo-1548199973-03cce0bbc87b', 400, 75) },
] as const;
