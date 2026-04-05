#!/usr/bin/env python3
"""
Remove white/near-white matte from PawSewa logo PNGs and snap logo ink to #703418
while preserving anti-aliased edges (alpha from distance to white).
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install: pip install pillow", file=sys.stderr)
    sys.exit(1)

# Brand deep brown
R0, G0, B0 = 0x70, 0x34, 0x18


def process_image(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    out = Image.new("RGBA", (w, h))
    opx = out.load()
    px = im.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # Very light pixels = paper white background
            if r >= 248 and g >= 248 and b >= 248:
                opx[x, y] = (0, 0, 0, 0)
                continue

            # Near-white: soft edge / anti-alias from white matte
            maxc = max(r, g, b)
            minc = min(r, g, b)
            lum = (r + g + b) / 3.0

            # Strong white-ish background
            if lum >= 245 and (maxc - minc) < 12:
                opx[x, y] = (0, 0, 0, 0)
                continue

            # Transition pixels (light gray between white and brown)
            if lum > 200 and r > 180 and g > 175 and b > 170:
                # How much "ink" vs white (0 = white, 1 = solid brown)
                t = max(0.0, min(1.0, (255.0 - lum) / 55.0))
                if t < 0.04:
                    opx[x, y] = (0, 0, 0, 0)
                else:
                    alpha = int(round(255 * t * (a / 255.0)))
                    opx[x, y] = (R0, G0, B0, alpha)
                continue

            # Logo body: normalize to brand brown, keep full alpha unless image had transparency
            alpha = a if a < 255 else 255
            opx[x, y] = (R0, G0, B0, alpha)

    return out


def main() -> None:
    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        print("Usage: process_pawsewa_logo_png.py <png> [png...]", file=sys.stderr)
        sys.exit(1)
    for p in paths:
        if not p.is_file():
            print(f"Skip missing: {p}", file=sys.stderr)
            continue
        im = Image.open(p)
        out = process_image(im)
        out.save(p, format="PNG", optimize=True)
        print(f"OK {p}")


if __name__ == "__main__":
    main()
