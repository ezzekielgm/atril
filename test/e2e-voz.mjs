// «Seguir mi voz» (prototipo) de punta a punta: Chromium con un micrófono falso que «lee» el discurso con voz
// sintética (espeak-ng), el reconocedor y el modelo de verdad (Vosk, español). Construye la app con VOZ=1 en una
// carpeta temporal y la sirve aparte. Si falta el modelo (voz/…tar.gz), espeak-ng o ffmpeg, se salta.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }
const OUTDIR = fileURLToPath(new globalThis.URL("./out", import.meta.url));
fs.mkdirSync(OUTDIR, { recursive: true });
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };
const hay = (cmd) => { try { execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }); return true; } catch { return false; } };

if (!fs.existsSync("voz/vosk-model-small-es-0.3.tar.gz") || !hay("espeak-ng") || !hay("ffmpeg")) {
  console.log("— Se salta: falta el modelo de voz (voz/), espeak-ng o ffmpeg.\n\n0/0 pruebas superadas");
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atril-voz-"));
const site = path.join(tmp, "site");
execFileSync(process.execPath, ["build.mjs"], { env: { ...process.env, VOZ: "1", OUT: site }, stdio: "pipe" });

const P1 = "La paciencia es una cualidad que todos necesitamos.";
const P2 = "Cuando las cosas no salen como esperamos, la paciencia nos ayuda a mantener la calma.";
const P3 = "Pensemos en un agricultor que siembra la semilla y espera la lluvia.";
fs.writeFileSync(path.join(tmp, "texto.txt"), `${P1} ${P2} ${P3}`);
const wav = path.join(tmp, "voz.wav");
execFileSync("espeak-ng", ["-v", "es", "-s", "140", "-w", path.join(tmp, "crudo.wav"), "-f", path.join(tmp, "texto.txt")]);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-t", "2", "-i", "anullsrc=r=16000:cl=mono", "-i", path.join(tmp, "crudo.wav"),
  "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1,aresample=16000,aformat=sample_fmts=s16:channel_layouts=mono", wav]);

const tipos = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".gz": "application/gzip" };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(site, p);
  if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": tipos[path.extname(f)] || "application/octet-stream", "Content-Length": fs.statSync(f).size });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${srv.address().port}/`;

const browser = await pw.chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1080, height: 810 }, hasTouch: true, isMobile: true, locale: "es-ES" });
await ctx.grantPermissions(["microphone"], { origin: BASE.slice(0, -1) });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(BASE);
await page.waitForSelector("#view-home:not([hidden])");
await page.evaluate(async ([a, b, c]) => {
  const s = window.__atril.settings(); s.labVoz = true; localStorage.setItem("atril.settings", JSON.stringify(s));
  await window.__atril.store.put("docs", { id: "voz1", title: "La paciencia", html: `<h2>Introducción</h2><p>${a}</p><p>${b}</p><p>${c}</p>`, created: Date.now(), updated: Date.now() });
  location.hash = "#/leer/docs/voz1";
}, [P1, P2, P3]);
await page.waitForSelector("#view-reader:not([hidden])");

// En «Más» → Practicar
await page.click("#reader-more");
ok("«Más» tiene «Seguir mi voz (prueba)»", await page.isVisible(".sheet >> text=Seguir mi voz (prueba)"));
await page.click(".sheet >> text=Seguir mi voz (prueba)");
await page.waitForSelector(".sheet >> text=Seguir tu voz (prueba)");
const aviso = await page.textContent(".sheet");
ok("Antes de descargar, avisa del tamaño y de que la voz no sale del iPad", /\d+ MB/.test(aviso) && aviso.includes("no sale del iPad"));
await page.click(".sheet >> text=Descargar");
await page.waitForSelector("#voz-chip:not([hidden])", { timeout: 60000 });
ok("Descarga y se pone en marcha (aviso abajo con «Parar»)", await page.isVisible("#voz-chip .voz-parar"));
const enCache = await page.evaluate(async () => (await (await caches.open("atril-voz")).keys()).map((r) => r.url.split("/").pop()));
ok("El reconocedor queda guardado para la próxima vez (sin internet)", enCache.includes("vosk.js") && enCache.some((u) => u.endsWith(".tar.gz")), enCache.join(", "));

// Escucha la lectura y avanza por el texto
await page.waitForFunction(() => window.__atril.voz.motor && window.__atril.voz.motor.idx, null, { timeout: 30000 });
ok("Avisa de que ya escucha", /Te escucho|Te sigo/.test(await page.textContent("#voz-chip .voz-txt")), await page.textContent("#voz-chip .voz-txt"));
const idx = (w) => page.evaluate((w) => window.__atril.voz.motor.idx.palabras.indexOf(w), w);
const iAgricultor = await idx("agricultor");
const t0 = Date.now();
let pos = -1, vista = [];
while (Date.now() - t0 < 30000) {
  pos = await page.evaluate(() => window.__atril.voz.motor.pos);
  if (!vista.length || vista[vista.length - 1] !== pos) vista.push(pos);
  if (pos >= iAgricultor) break;
  await page.waitForTimeout(400);
}
ok("Sigue la lectura hasta «agricultor» (tercer párrafo)", pos >= iAgricultor, `posiciones: ${vista.join(" → ")} (agricultor = ${iAgricultor})`);
const avanza = vista.filter((p) => p >= 0).every((p, i, a) => i === 0 || p >= a[i - 1] - 2);
ok("Avanza sin dar saltos hacia atrás", avanza);
ok("Resalta la frase y la palabra", await page.evaluate(() => CSS.highlights.has("voz-frase") && CSS.highlights.has("voz-palabra")));
ok("El aviso dice que te sigue", (await page.textContent("#voz-chip .voz-txt")).startsWith("Te sigo"), await page.textContent("#voz-chip .voz-txt"));
await page.screenshot({ path: `${OUTDIR}/voz-siguiendo.png` });

// Tocar una palabra = «voy por aquí»
const punto = await page.evaluate(() => {
  const m = window.__atril.voz.motor; const k = m.idx.palabras.indexOf("cualidad"); const s = m.idx.sitios[k];
  const r = document.createRange(); r.setStart(s[0], s[1]); r.setEnd(s[0], s[2]); const b = r.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, k };
});
// (el micrófono falso sigue «leyendo», así que se mira justo después del toque, en el mismo paso)
const trasTocar = await page.evaluate(({ x, y }) => {
  document.querySelector("#reader-content").dispatchEvent(new MouseEvent("click", { clientX: x, clientY: y, bubbles: true, cancelable: true }));
  return window.__atril.voz.motor.pos;
}, punto);
ok("Tocar una palabra la marca como «voy por aquí»", trasTocar === punto.k, `${trasTocar} / ${punto.k}`);

// Parar
await page.click("#voz-chip .voz-parar");
await page.waitForTimeout(300);
const parado = await page.evaluate(() => ({ activo: window.__atril.voz.activo, hl: CSS.highlights.has("voz-frase"), chip: document.querySelector("#voz-chip").hidden }));
ok("«Parar» lo apaga, quita el resaltado y el aviso", !parado.activo && !parado.hl && parado.chip, JSON.stringify(parado));

// Segunda vez: sin preguntar ni descargar
await page.click("#reader-more");
await page.click(".sheet >> text=Seguir mi voz (prueba)");
await page.waitForSelector("#voz-chip:not([hidden])", { timeout: 20000 });
ok("La segunda vez no vuelve a descargar ni a preguntar", !(await page.isVisible(".sheet >> text=Seguir tu voz (prueba)")));
// Presentar lo para (de momento el prototipo es para ensayar)
await page.evaluate(() => { localStorage.setItem("atril.consejoAcceso", "1"); window.__atril.presentar.entrar({ consejo: false }); });
await page.waitForTimeout(200);
ok("Al presentar se para (de momento es para ensayar)", !(await page.evaluate(() => window.__atril.voz.activo)));
await page.evaluate(() => window.__atril.presentar.salir({ quitarPaso: true }));

// En la versión de siempre, sin el ajuste, no aparece
await page.evaluate(() => { const s = window.__atril.settings(); s.labVoz = false; });
await page.click("#reader-more");
ok("Sin el ajuste del laboratorio (y fuera de pruebas) no aparece", !(await page.isVisible(".sheet >> text=Seguir mi voz (prueba)")));

await browser.close();
srv.close();
fs.rmSync(tmp, { recursive: true, force: true });
ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
const fallos = results.filter((r) => !r.pass);
console.log(`\n${results.length - fallos.length}/${results.length} pruebas superadas`);
process.exit(fallos.length ? 1 : 0);
