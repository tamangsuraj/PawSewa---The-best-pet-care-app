/* eslint-disable no-console */
/**
 * Generates optimized brand assets from assets/mainlogo.png.
 * Run from repo root: npm install && node scripts/generate-brand-assets.js
 */
const fs = require('fs');
const path = require('path');

const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const ROOT = path.join(__dirname, '..');
const SRC = fs.existsSync(path.join(ROOT, 'assets', 'image_9.png'))
  ? path.join(ROOT, 'assets', 'image_9.png')
  : path.join(ROOT, 'assets', 'mainlogo.png');

const ALT_NOTE = 'PawSewa - Care and Commerce for Pets';

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

/** Square launcher / icon on white (store-safe). */
async function squareIconWhite(input, size, outPath) {
  await sharp(input)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      position: 'centre',
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function makeSplash(input, w, h, outPath) {
  const logoMax = Math.round(Math.min(w, h) * 0.28);
  const logoBuf = await sharp(input)
    .resize(logoMax, logoMax, { fit: 'inside' })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: logoBuf, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function writeWebSvg(publicBrandDir) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 320 96" role="img" aria-labelledby="pawsewaLogoTitle">
  <title id="pawsewaLogoTitle">${ALT_NOTE}</title>
  <image xlink:href="/brand/pawsewa-logo-nav.png" href="/brand/pawsewa-logo-nav.png" x="0" y="8" width="320" height="80" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
  await fs.promises.writeFile(path.join(publicBrandDir, 'pawsewa-logo.svg'), svg, 'utf8');
}

/** iOS AppIcon — unique filenames from Contents.json */
const IOS_APP_ICONS = [
  ['Icon-App-20x20@2x.png', 40],
  ['Icon-App-20x20@3x.png', 60],
  ['Icon-App-29x29@1x.png', 29],
  ['Icon-App-29x29@2x.png', 58],
  ['Icon-App-29x29@3x.png', 87],
  ['Icon-App-40x40@2x.png', 80],
  ['Icon-App-40x40@3x.png', 120],
  ['Icon-App-60x60@2x.png', 120],
  ['Icon-App-60x60@3x.png', 180],
  ['Icon-App-20x20@1x.png', 20],
  ['Icon-App-40x40@1x.png', 40],
  ['Icon-App-76x76@1x.png', 76],
  ['Icon-App-76x76@2x.png', 152],
  ['Icon-App-83.5x83.5@2x.png', 167],
  ['Icon-App-1024x1024@1x.png', 1024],
];

const MOBILE_APPS = ['user_app', 'vet_app'];

const ANDROID_MIPMAPS = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];

const MACOS_ICON_FILES = [
  ['app_icon_16.png', 16],
  ['app_icon_32.png', 32],
  ['app_icon_64.png', 64],
  ['app_icon_128.png', 128],
  ['app_icon_256.png', 256],
  ['app_icon_512.png', 512],
  ['app_icon_1024.png', 1024],
];

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Missing source:', SRC);
    process.exit(1);
  }

  const websiteBrand = path.join(ROOT, 'apps', 'web', 'website', 'public', 'brand');
  const adminBrand = path.join(ROOT, 'apps', 'web', 'admin', 'public', 'brand');
  await ensureDir(websiteBrand);
  await ensureDir(adminBrand);

  await sharp(SRC)
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(websiteBrand, 'pawsewa-logo.png'));
  await sharp(SRC)
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(websiteBrand, 'pawsewa-logo.webp'));

  await sharp(SRC)
    .resize({ height: 48, width: 280, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(websiteBrand, 'pawsewa-logo-nav.png'));

  for (const f of ['pawsewa-logo.png', 'pawsewa-logo.webp', 'pawsewa-logo-nav.png']) {
    await fs.promises.copyFile(path.join(websiteBrand, f), path.join(adminBrand, f));
  }

  await writeWebSvg(websiteBrand);
  await writeWebSvg(adminBrand);

  const fav32 = await sharp(SRC).resize(32, 32, { fit: 'cover', position: 'centre' }).png().toBuffer();
  const fav48 = await sharp(SRC).resize(48, 48, { fit: 'cover', position: 'centre' }).png().toBuffer();
  const icoBuf = await pngToIco([fav32, fav48]);
  await fs.promises.writeFile(path.join(websiteBrand, 'favicon.ico'), icoBuf);
  await fs.promises.writeFile(path.join(adminBrand, 'favicon.ico'), icoBuf);

  await squareIconWhite(SRC, 180, path.join(websiteBrand, 'apple-touch-icon.png'));
  await fs.promises.copyFile(
    path.join(websiteBrand, 'apple-touch-icon.png'),
    path.join(adminBrand, 'apple-touch-icon.png'),
  );

  // Flutter: 1x / 2.0x / 3.0x resolution-aware assets
  for (const app of MOBILE_APPS) {
    const d = path.join(ROOT, 'apps', 'mobile', app, 'assets', 'brand');
    await ensureDir(d);
    await ensureDir(path.join(d, '2.0x'));
    await ensureDir(path.join(d, '3.0x'));
    await squareIconWhite(SRC, 128, path.join(d, 'pawsewa_logo.png'));
    await squareIconWhite(SRC, 256, path.join(d, '2.0x', 'pawsewa_logo.png'));
    await squareIconWhite(SRC, 384, path.join(d, '3.0x', 'pawsewa_logo.png'));
  }

  for (const app of MOBILE_APPS) {
    const base = path.join(ROOT, 'apps', 'mobile', app, 'android', 'app', 'src', 'main', 'res');
    for (const [folder, size] of ANDROID_MIPMAPS) {
      await squareIconWhite(SRC, size, path.join(base, folder, 'ic_launcher.png'));
    }
    await ensureDir(path.join(base, 'drawable'));
    await squareIconWhite(SRC, 512, path.join(base, 'drawable', 'splash_logo.png'));
  }

  const launchXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/white" />
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_logo" />
    </item>
</layer-list>
`;
  for (const app of MOBILE_APPS) {
    const p = path.join(
      ROOT,
      'apps',
      'mobile',
      app,
      'android',
      'app',
      'src',
      'main',
      'res',
      'drawable',
      'launch_background.xml',
    );
    await fs.promises.writeFile(p, launchXml, 'utf8');
  }

  for (const app of MOBILE_APPS) {
    const iconDir = path.join(
      ROOT,
      'apps',
      'mobile',
      app,
      'ios',
      'Runner',
      'Assets.xcassets',
      'AppIcon.appiconset',
    );
    for (const [name, size] of IOS_APP_ICONS) {
      await squareIconWhite(SRC, size, path.join(iconDir, name));
    }
    const launchDir = path.join(
      ROOT,
      'apps',
      'mobile',
      app,
      'ios',
      'Runner',
      'Assets.xcassets',
      'LaunchImage.imageset',
    );
    await makeSplash(SRC, 390, 844, path.join(launchDir, 'LaunchImage.png'));
    await makeSplash(SRC, 780, 1688, path.join(launchDir, 'LaunchImage@2x.png'));
    await makeSplash(SRC, 1170, 2532, path.join(launchDir, 'LaunchImage@3x.png'));
  }

  for (const app of MOBILE_APPS) {
    const macIconDir = path.join(
      ROOT,
      'apps',
      'mobile',
      app,
      'macos',
      'Runner',
      'Assets.xcassets',
      'AppIcon.appiconset',
    );
    if (fs.existsSync(macIconDir)) {
      for (const [fname, size] of MACOS_ICON_FILES) {
        await squareIconWhite(SRC, size, path.join(macIconDir, fname));
      }
    }
  }

  const userWebIcons = path.join(ROOT, 'apps', 'mobile', 'user_app', 'web', 'icons');
  await squareIconWhite(SRC, 192, path.join(userWebIcons, 'Icon-192.png'));
  await squareIconWhite(SRC, 512, path.join(userWebIcons, 'Icon-512.png'));
  await fs.promises.copyFile(path.join(userWebIcons, 'Icon-192.png'), path.join(userWebIcons, 'Icon-maskable-192.png'));
  await fs.promises.copyFile(path.join(userWebIcons, 'Icon-512.png'), path.join(userWebIcons, 'Icon-maskable-512.png'));
  await fs.promises.copyFile(path.join(userWebIcons, 'Icon-192.png'), path.join(ROOT, 'apps', 'mobile', 'user_app', 'web', 'favicon.png'));

  const vetWebIcons = path.join(ROOT, 'apps', 'mobile', 'vet_app', 'web', 'icons');
  if (fs.existsSync(vetWebIcons)) {
    await squareIconWhite(SRC, 192, path.join(vetWebIcons, 'Icon-192.png'));
    await squareIconWhite(SRC, 512, path.join(vetWebIcons, 'Icon-512.png'));
    await fs.promises.copyFile(path.join(vetWebIcons, 'Icon-192.png'), path.join(vetWebIcons, 'Icon-maskable-192.png'));
    await fs.promises.copyFile(path.join(vetWebIcons, 'Icon-512.png'), path.join(vetWebIcons, 'Icon-maskable-512.png'));
    await fs.promises.copyFile(path.join(vetWebIcons, 'Icon-192.png'), path.join(ROOT, 'apps', 'mobile', 'vet_app', 'web', 'favicon.png'));
  }

  const w256 = await sharp(SRC).resize(256, 256, { fit: 'cover', position: 'centre' }).png().toBuffer();
  const w64 = await sharp(SRC).resize(64, 64, { fit: 'cover', position: 'centre' }).png().toBuffer();
  const w32b = await sharp(SRC).resize(32, 32, { fit: 'cover', position: 'centre' }).png().toBuffer();
  const winIco = await pngToIco([w32b, w64, w256]);
  await fs.promises.writeFile(
    path.join(ROOT, 'apps', 'mobile', 'user_app', 'windows', 'runner', 'resources', 'app_icon.ico'),
    winIco,
  );
  const vetWinIco = path.join(ROOT, 'apps', 'mobile', 'vet_app', 'windows', 'runner', 'resources', 'app_icon.ico');
  if (fs.existsSync(path.dirname(vetWinIco))) {
    await fs.promises.writeFile(vetWinIco, winIco);
  }

  // macOS .icns (optional bundle artifact; Xcode also uses PNGs in AppIcon.appiconset)
  try {
    const png2icons = require('png2icons');
    for (const app of MOBILE_APPS) {
      const p1024 = path.join(
        ROOT,
        'apps',
        'mobile',
        app,
        'ios',
        'Runner',
        'Assets.xcassets',
        'AppIcon.appiconset',
        'Icon-App-1024x1024@1x.png',
      );
      const macSet = path.join(
        ROOT,
        'apps',
        'mobile',
        app,
        'macos',
        'Runner',
        'Assets.xcassets',
        'AppIcon.appiconset',
      );
      if (fs.existsSync(p1024) && fs.existsSync(macSet)) {
        const buf = await fs.promises.readFile(p1024);
        const icns = png2icons.createICNS(buf, png2icons.BILINEAR, 0);
        if (icns) {
          await fs.promises.writeFile(path.join(macSet, 'AppIcon.icns'), icns);
        }
      }
    }
  } catch (e) {
    console.warn('ICNS generation skipped:', e?.message || e);
  }

  console.log('[SUCCESS] Brand Assets Updated: New PawSewa Logo implemented across 4 platforms.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
