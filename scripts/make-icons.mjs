// Genera los PNG de los iconos a partir de scripts/icon.svg (necesita Playwright con Chromium).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }
const svg = fs.readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
const maskable = svg.replace('<g id="art">', '<g id="art" transform="translate(51.2 51.2) scale(0.8)">');
const browser = await pw.chromium.launch();
const page = await browser.newPage();
async function render(src, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${src.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size } });
}
fs.mkdirSync("src/icons", { recursive: true });
await render(svg, 192, "src/icons/icon-192.png");
await render(svg, 512, "src/icons/icon-512.png");
await render(maskable, 512, "src/icons/icon-maskable-512.png");
await render(svg, 180, "src/icons/apple-touch-icon.png");
await browser.close();
console.log("iconos generados");
