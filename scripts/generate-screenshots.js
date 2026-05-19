// Generates App Store marketing images from raw iPhone screenshots.
//
//   1. Put your raw iPhone screenshots in  mobile/assets/screenshots/
//      Name them so they sort in capture order, e.g.
//        1-login.png   2-home.png   3-capture.png
//   2. Run:  node scripts/generate-screenshots.js
//   3. Finished 1284x2778 images land in  mobile/assets/store-screenshots/
//
// Each output: a green gradient background, the screenshot set in a white
// rounded iPhone frame, and a bold white caption above. Captions are paired
// to screenshots by sort order. Uses sharp for all image compositing.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC_DIR = path.join(__dirname, '..', 'mobile', 'assets', 'screenshots');
const OUT_DIR = path.join(__dirname, '..', 'mobile', 'assets', 'store-screenshots');

// App Store screenshot size for the 6.7" iPhone slot.
const OUT_W = 1284;
const OUT_H = 2778;

const CAPTIONS = [
  'Quick & Simple Driver Login',
  'Track Every Pop-Up',
  'Snap. Submit. Done.',
];

const GRADIENT_TOP = '#2D7D46';
const GRADIENT_BOTTOM = '#1a5c30';

// Layout constants (pixels on the 1284x2778 canvas).
const CAPTION_BASELINE_Y = 285;
const CAPTION_FONT_SIZE = 74;
const PHONE_TOP = 400;
const BOTTOM_MARGIN = 140;
const TARGET_INNER_W = 980; // screenshot width inside the frame
const BORDER = 22; // white frame thickness
const INNER_RADIUS = 58; // screenshot corner radius
const OUTER_RADIUS = INNER_RADIUS + BORDER;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function gradientBackground() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${GRADIENT_TOP}"/>
          <stop offset="100%" stop-color="${GRADIENT_BOTTOM}"/>
        </linearGradient>
      </defs>
      <rect width="${OUT_W}" height="${OUT_H}" fill="url(#bg)"/>
    </svg>`,
  );
}

function captionOverlay(text) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">
      <text x="${OUT_W / 2}" y="${CAPTION_BASELINE_Y}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-weight="700"
        font-size="${CAPTION_FONT_SIZE}" fill="#ffffff">${escapeXml(text)}</text>
    </svg>`,
  );
}

// Resize a screenshot, round its corners, and set it in a white rounded frame.
async function buildPhone(srcPath) {
  const meta = await sharp(srcPath).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Could not read image dimensions: ${srcPath}`);
  }
  const ratio = meta.height / meta.width;

  // Fit within both the target width and the available canvas height.
  const maxInnerH = OUT_H - PHONE_TOP - BOTTOM_MARGIN - 2 * BORDER;
  const innerW = Math.min(TARGET_INNER_W, Math.round(maxInnerH / ratio));
  const innerH = Math.round(innerW * ratio);

  const shot = await sharp(srcPath)
    .resize(innerW, innerH, { fit: 'fill' })
    .toBuffer();

  // Round the screenshot's corners (dest-in keeps pixels under the mask).
  const cornerMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${innerW}" height="${innerH}">` +
      `<rect width="${innerW}" height="${innerH}" rx="${INNER_RADIUS}" ry="${INNER_RADIUS}"/></svg>`,
  );
  const roundedShot = await sharp(shot)
    .composite([{ input: cornerMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // White rounded frame, with the screenshot inset by the border width.
  const frameW = innerW + 2 * BORDER;
  const frameH = innerH + 2 * BORDER;
  const frameSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frameW}" height="${frameH}">` +
      `<rect width="${frameW}" height="${frameH}" rx="${OUTER_RADIUS}" ry="${OUTER_RADIUS}" fill="#ffffff"/></svg>`,
  );
  const frame = await sharp(frameSvg)
    .composite([{ input: roundedShot, top: BORDER, left: BORDER }])
    .png()
    .toBuffer();

  return { frame, frameW, frameH };
}

async function generate(srcPath, caption, outPath) {
  const { frame, frameW } = await buildPhone(srcPath);
  const left = Math.round((OUT_W - frameW) / 2);

  const composited = await sharp(gradientBackground())
    .composite([
      { input: frame, top: PHONE_TOP, left },
      { input: captionOverlay(caption), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  // Second pass: flatten so the PNG has no alpha channel — App Store
  // screenshots must not contain transparency.
  await sharp(composited)
    .flatten({ background: GRADIENT_BOTTOM })
    .png()
    .toFile(outPath);
}

async function main() {
  fs.mkdirSync(SRC_DIR, { recursive: true });

  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log(
      `\nNo screenshots found. Put your raw iPhone screenshots in:\n` +
        `  ${SRC_DIR}\n` +
        `Name them so they sort in order (e.g. 1-login.png, 2-home.png, ` +
        `3-capture.png),\nthen re-run: node scripts/generate-screenshots.js\n`,
    );
    return;
  }
  if (files.length !== CAPTIONS.length) {
    console.log(
      `\nNote: found ${files.length} screenshot(s); ${CAPTIONS.length} captions ` +
        `are defined. Pairing in filename order.`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\nGenerating App Store marketing images...\n');
  for (let i = 0; i < files.length; i += 1) {
    const caption = CAPTIONS[i] || CAPTIONS[CAPTIONS.length - 1];
    const srcPath = path.join(SRC_DIR, files[i]);
    const outName = files[i].replace(/\.(png|jpe?g)$/i, '.png');
    await generate(srcPath, caption, path.join(OUT_DIR, outName));
    console.log(
      `  ${files[i]}  ->  store-screenshots/${outName}   "${caption}"`,
    );
  }
  console.log(
    `\nDone — ${files.length} image(s) (${OUT_W}x${OUT_H}) in ` +
      `mobile/assets/store-screenshots/\n`,
  );
}

main().catch((e) => {
  console.error('\nFailed:', e.message || e, '\n');
  process.exit(1);
});
