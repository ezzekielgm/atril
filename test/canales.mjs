// Dos canales en la misma dirección: la versión de siempre (/) y la de pruebas (/pruebas/).
// Construye las dos en una carpeta temporal y las sirve juntas, como en GitHub Pages.
// Comprueba: cada una con su service worker y su caché, que la de siempre no se coma pruebas/,
// que comparten los discursos (mismo origen) y que siguen funcionando sin conexión.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };

const site = fs.mkdtempSync(path.join(os.tmpdir(), "atril-canales-"));
const build = (canal, out) => execFileSync(process.execPath, ["build.mjs"], { env: { ...process.env, CANAL: canal, OUT: out }, stdio: "pipe" });
build("estable", site);
build("pruebas", path.join(site, "pruebas"));
ok("Se construyen los dos canales", fs.existsSync(path.join(site, "sw.js")) && fs.existsSync(path.join(site, "pruebas", "sw.js")));
const man = JSON.parse(fs.readFileSync(path.join(site, "pruebas", "manifest.webmanifest"), "utf8"));
ok("La de pruebas se llama distinto en la pantalla de inicio", man.short_name === "Atril pruebas" && fs.readFileSync(path.join(site, "pruebas", "index.html"), "utf8").includes('content="Atril pruebas"'));

const tipos = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff" };
let caido = false;
const srv = http.createServer((req, res) => {
  if (caido) { req.socket.destroy(); return; }
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(site, p);
  if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": tipos[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${srv.address().port}/`;

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, locale: "es-ES" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const listo = async () => { await page.waitForSelector("#view-home:not([hidden])", { timeout: 15000 }); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {}); };

// 1. La de siempre
await page.goto(BASE);
await listo();
await page.reload(); await listo();
const est = await page.evaluate(() => ({ marca: getComputedStyle(document.querySelector(".marca-pruebas")).display, ctrl: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL }));
ok("La de siempre: sin la etiqueta «pruebas» y con su service worker", est.marca === "none" && est.ctrl === BASE + "sw.js", JSON.stringify(est));
await page.evaluate(async () => { await window.__atril.store.put("docs", { id: "comun", title: "Discurso de las dos", html: "<p>Hola</p>", created: Date.now(), updated: Date.now() }); });

// 2. La de pruebas, con el service worker de la de siempre ya instalado
await page.goto(BASE + "pruebas/");
await listo();
await page.reload(); await listo();
const pru = await page.evaluate(() => ({ marca: getComputedStyle(document.querySelector(".marca-pruebas")).display, ctrl: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL, html: document.documentElement.dataset.version }));
ok("Pruebas: con su etiqueta y su propio service worker (la de siempre no se la come)", pru.marca !== "none" && pru.ctrl === BASE + "pruebas/sw.js", JSON.stringify(pru));
ok("Pruebas ve los mismos discursos (mismo sitio, mismos datos)", await page.evaluate(async () => !!(await window.__atril.store.get("docs", "comun"))));
await page.click('button:has-text("Ajustes")');
ok("Ajustes dice que es la versión de pruebas", (await page.textContent("#version-txt")).includes("versión de pruebas"));
const cachés = await page.evaluate(() => caches.keys());
ok("Cada canal tiene su caché", cachés.some((k) => k.startsWith("atril-estable-")) && cachés.some((k) => k.startsWith("atril-pruebas-")), cachés.join(", "));

// 3. Sin conexión, las dos siguen abriendo
caido = true;
await page.goto(BASE).catch(() => {});
await listo();
ok("Sin conexión: abre la de siempre", (await page.evaluate(() => getComputedStyle(document.querySelector(".marca-pruebas")).display)) === "none");
await page.goto(BASE + "pruebas/").catch(() => {});
await listo();
ok("Sin conexión: abre la de pruebas", (await page.evaluate(() => getComputedStyle(document.querySelector(".marca-pruebas")).display)) !== "none");
caido = false;

// 4. Una versión nueva de la de siempre no borra la caché de pruebas
fs.appendFileSync(path.join(site, "styles.css"), "\n/* cambio */\n");
const swTxt = fs.readFileSync(path.join(site, "sw.js"), "utf8").replace(/const VERSION = "([^"]+)"/, 'const VERSION = "$1-b"');
fs.writeFileSync(path.join(site, "sw.js"), swTxt);
await page.goto(BASE);
await listo();
await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
await page.waitForTimeout(2500);
const cachés2 = await page.evaluate(() => caches.keys());
ok("Al actualizarse la de siempre, la caché de pruebas sigue", cachés2.some((k) => k.startsWith("atril-pruebas-")) && cachés2.some((k) => /^atril-estable-.*-b$/.test(k)), cachés2.join(", "));

await browser.close();
srv.close();
fs.rmSync(site, { recursive: true, force: true });
ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
const fallos = results.filter((r) => !r.pass);
console.log(`\n${results.length - fallos.length}/${results.length} pruebas superadas`);
process.exit(fallos.length ? 1 : 0);
