// Renders Tab Placement's icons and Chrome Web Store images with Playwright's Chromium, so the
// artwork is reproducible from source. Run from the repository root: bun run store:render
//
// Outputs:
//   extension/icons/icon-{16,32,48,128}.png   packaged with the extension
//   store/images/screenshot-1280x800.png      store listing screenshot
//   store/images/promo-tile-440x280.png       store small promo tile

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dir, "..");
const ICON_DIR = path.join(ROOT, "extension/icons");
const IMAGE_DIR = path.join(ROOT, "store/images");

const BLUE = "#2563eb";
const GROUP = "#16a34a";
// Single quotes only: this string is embedded in double-quoted style attributes.
const FONT = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

// A tab strip with the current tab (white), a new tab inserted right after it (green, part of the
// group bar), and the rest of the strip (faded). Drawn on a 128 grid with the Chrome Web Store's
// recommended 16 px transparent padding around 96 px of artwork.
function iconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
    <rect x="16" y="16" width="96" height="96" rx="22" fill="${BLUE}"/>
    <rect x="26" y="48" width="24" height="30" rx="5" fill="#ffffff"/>
    <rect x="54" y="48" width="24" height="30" rx="5" fill="#bbf7d0"/>
    <path d="M66 55v16M58 63h16" stroke="${GROUP}" stroke-width="5" stroke-linecap="round"/>
    <rect x="82" y="48" width="20" height="30" rx="5" fill="#ffffff" opacity="0.45"/>
    <rect x="26" y="84" width="52" height="6" rx="3" fill="#4ade80"/>
  </svg>`;
}

function tab(label, { active = false, added = false, grouped = false, faded = false } = {}) {
  const background = added ? "#dcfce7" : active ? "#ffffff" : "#e5e7eb";
  const border = added ? `2px solid ${GROUP}` : "2px solid transparent";
  return `<div style="position:relative;box-sizing:border-box;flex:0 0 200px;height:56px;margin-right:6px;border-radius:10px 10px 0 0;
      background:${background};border:${border};border-bottom:none;opacity:${faded ? 0.55 : 1};
      display:flex;align-items:center;padding:0 18px;font:600 21px ${FONT};color:#111827;">
      ${added ? `<span style="color:${GROUP};margin-right:8px;font-size:22px;">+</span>` : ""}${label}
      ${grouped ? `<div style="position:absolute;left:-2px;right:-8px;bottom:-8px;height:5px;background:${GROUP};"></div>` : ""}
    </div>`;
}

function strip(title, caption, tabs) {
  return `<section style="margin-top:56px;">
      <div style="font:700 28px ${FONT};color:#111827;margin-bottom:8px;">${title}</div>
      <div style="font:400 22px ${FONT};color:#4b5563;margin-bottom:18px;">${caption}</div>
      <div style="display:flex;align-items:flex-end;background:#d1d5db;padding:14px 14px 0;border-radius:14px;height:86px;">${tabs.join("")}</div>
    </section>`;
}

function screenshotHtml() {
  const before = [
    tab("Docs", { faded: true }),
    tab("Ticket", { active: true, grouped: true }),
    tab("Review", { grouped: true }),
    tab("Mail", { faded: true }),
    tab("New tab", { added: true }),
  ];
  const after = [
    tab("Docs", { faded: true }),
    tab("Ticket", { active: true, grouped: true }),
    tab("New tab", { added: true, grouped: true }),
    tab("Review", { grouped: true }),
    tab("Mail", { faded: true }),
  ];
  return `<body style="margin:0;width:1280px;height:800px;background:#f8fafc;box-sizing:border-box;padding:0 70px;
      display:flex;flex-direction:column;justify-content:center;">
      <div style="display:flex;align-items:center;">
        ${iconSvg(96)}
        <div style="margin-left:14px;">
          <div style="font:800 44px ${FONT};color:#111827;">Tab Placement</div>
          <div style="font:400 24px ${FONT};color:#4b5563;">New tabs open next to the tab you are on, inside its tab group.</div>
        </div>
      </div>
      ${strip("Without Tab Placement", "Cmd/Ctrl+T adds the new tab at the far end of the window, outside the group.", before)}
      ${strip("With Tab Placement", "The new tab opens right after the current tab and joins its group. Restored tabs keep their order.", after)}
    </body>`;
}

function promoTileHtml() {
  return `<body style="margin:0;width:440px;height:280px;background:${BLUE};display:flex;flex-direction:column;
      align-items:center;justify-content:center;color:#ffffff;">
      ${iconSvg(120)}
      <div style="font:800 34px ${FONT};margin-top:2px;">Tab Placement</div>
      <div style="font:400 17px ${FONT};opacity:0.9;margin-top:6px;">New tabs next to the current one</div>
    </body>`;
}

async function render(page, html, { width, height, file, transparent = false }) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent;}</style></head>${html}</html>`);
  await page.screenshot({ path: file, omitBackground: transparent });
  console.log(path.relative(process.cwd(), file));
}

mkdirSync(ICON_DIR, { recursive: true });
mkdirSync(IMAGE_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [16, 32, 48, 128]) {
    const html = `<body style="width:${size}px;height:${size}px;">${iconSvg(size)}</body>`;
    await render(page, html, { width: size, height: size, file: path.join(ICON_DIR, `icon-${size}.png`), transparent: true });
  }
  await render(page, screenshotHtml(), { width: 1280, height: 800, file: path.join(IMAGE_DIR, "screenshot-1280x800.png") });
  await render(page, promoTileHtml(), { width: 440, height: 280, file: path.join(IMAGE_DIR, "promo-tile-440x280.png") });
} finally {
  await browser.close();
}
