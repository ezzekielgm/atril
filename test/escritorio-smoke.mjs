// Prueba de Atril para el ordenador (Tauri) en Linux, con WebDriver. No está en `npm test`: necesita
// el programa compilado y un servidor gráfico. Uso (Linux con webkit2gtk-driver, Xvfb y tauri-driver):
//   npm run build && npx tauri build --debug --no-bundle && node test/escritorio-smoke.mjs
// Comprueba: la ventana carga, el Word que se le pasa al abrir llega solo (como «Abrir con»), se guarda
// encima del mismo archivo con los datos de Atril dentro, el aviso si el Word cambió fuera, la versión y
// que un segundo «Abrir con» con Atril ya abierto va a la misma ventana.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildDocx } from "../src/docx-export.js";
import { leerDatosAtril } from "../src/datos-word.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(RAIZ, "src-tauri", "target", "debug", "Atril");
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atril-escritorio-"));
const word = path.join(dir, "Mi discurso del PC.docx");
const otro = path.join(dir, "Otro discurso.docx");
const datos = { target: 20, guardado: Date.now() - 5000, ensayos: [{ id: "pc1", fecha: Date.now() - 86400000, seg: 1210, objetivoSeg: 1200, partes: [] }], dado: [] };
fs.writeFileSync(word, Buffer.from(await (await buildDocx("Mi discurso del PC", "<h1>Mi discurso del PC</h1><p>Lea Filipenses 4:4.</p>", { datos })).arrayBuffer()));
fs.writeFileSync(otro, Buffer.from(await (await buildDocx("Otro discurso", "<h1>Otro discurso</h1><p>Texto.</p>")).arrayBuffer()));
const viejo = new Date(Date.now() - 3600 * 1000);
fs.utimesSync(word, viejo, viejo);

const display = ":97";
const procesos = [];
const lanzar = (cmd, args, env = {}) => { const p = spawn(cmd, args, { env: { ...process.env, DISPLAY: display, ...env }, stdio: "ignore" }); procesos.push(p); return p; };
lanzar("Xvfb", [display, "-screen", "0", "1280x900x24"]);
await espera(800);
// Un bus de sesión propio (lo usa «una sola ventana» en Linux)
const bus = execFileSync("dbus-launch", ["--sh-syntax"], { env: { ...process.env, DISPLAY: display } }).toString();
const DBUS = /DBUS_SESSION_BUS_ADDRESS='([^']+)'/.exec(bus)[1];
const PID_BUS = Number(/DBUS_SESSION_BUS_PID=(\d+)/.exec(bus)[1]);
lanzar("tauri-driver", ["--port", "4455", "--native-port", "4456"], { DBUS_SESSION_BUS_ADDRESS: DBUS });
await espera(1500);

const W = "http://127.0.0.1:4455";
const pedir = async (metodo, ruta, cuerpo) => {
  const r = await fetch(W + ruta, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(j.value.error + ": " + j.value.message);
  return j.value;
};
let sid;
try {
  const s = await pedir("POST", "/session", { capabilities: { alwaysMatch: { "tauri:options": { application: APP, args: [word] } } } });
  sid = s.sessionId;
  const js = (codigo, args = []) => pedir("POST", `/session/${sid}/execute/sync`, { script: codigo, args });
  const jsAsync = (codigo, args = []) => pedir("POST", `/session/${sid}/execute/async`, { script: codigo, args });
  const hasta = async (codigo, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(codigo).catch(() => false)) return true; await espera(250); } return false; };

  ok("La ventana de Atril carga", await hasta("return !!(window.__atril && document.querySelector('#view-home, #view-reader'))"));
  ok("Sabe que es la versión del ordenador", await js("return !!window.__TAURI_INTERNALS__ && document.documentElement.classList.contains('escritorio')"));
  ok("El Word del «Abrir con» se abre solo", await hasta("return !document.querySelector('#view-reader').hidden && document.querySelector('#reader-title').textContent === 'Mi discurso del PC'"));
  const item = await js("return window.__atril.store.get('docs', window.__atril.reader.id)");
  ok("Recuerda dónde está el Word", item.rutaPC === word, item.rutaPC);
  ok("Trae la duración y los ensayos del Word", item.target === 20 && item.ensayos && item.ensayos[0].id === "pc1");
  ok("La ventana lleva el título del discurso", await hasta("return document.title === 'Mi discurso del PC · Atril'"));
  const version = await jsAsync("const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke('version_app').then(done, (e) => done('ERR ' + e));");
  ok("Versión del programa", /^\d+\.\d+\.\d+$/.test(version), version);

  // Guardar encima del mismo Word
  const antes = fs.statSync(word).mtimeMs;
  await js("window.__atril.store.get('docs', window.__atril.reader.id).then((it) => { it.target = 22; it.html += '<p>Añadido en Atril.</p>'; it.updated = Date.now(); return window.__atril.store.put('docs', it).then(() => window.__atril.exportWord('docs', it)); });");
  ok("«Guardar como Word» lo guarda encima", await hasta("const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent.includes('Guardado en «Mi discurso del PC.docx»')"));
  const despues = fs.statSync(word).mtimeMs;
  ok("El archivo del ordenador ha cambiado", despues > antes);
  const leidos = await leerDatosAtril(fs.readFileSync(word));
  ok("Y lleva dentro la duración nueva", leidos && leidos.target === 22, JSON.stringify(leidos && leidos.target));
  ok("No deja archivos temporales", !fs.readdirSync(dir).some((f) => f.endsWith(".atril-tmp")));

  // Si el Word se cambia fuera de Atril, avisa antes de sustituirlo
  await espera(2500);
  const ahora = new Date();
  fs.utimesSync(word, ahora, ahora);
  await js("window.__atril.store.get('docs', window.__atril.reader.id).then((it) => window.__atril.exportWord('docs', it));");
  ok("Avisa si el Word ha cambiado fuera", await hasta("const h = document.querySelector('#overlay:not([hidden]) .sheet h2'); return h && h.textContent === 'El Word ha cambiado en el ordenador'"));
  await js("[...document.querySelectorAll('#overlay .sheet button')].find((b) => b.textContent === 'Sustituirlo igualmente').click();");
  ok("Y lo sustituye si se le dice", await hasta("const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent.includes('Guardado en')"));

  // Segundo «Abrir con» con Atril ya abierto: a la misma ventana
  lanzar(APP, [otro], { DBUS_SESSION_BUS_ADDRESS: DBUS });
  ok("Otro Word con Atril abierto va a la misma ventana", await hasta("return document.querySelector('#reader-title').textContent === 'Otro discurso'", 20000));
  ok("Sigue habiendo una sola ventana", (await pedir("GET", `/session/${sid}/window/handles`)).length === 1);
} catch (e) {
  ok("Sin errores", false, String(e));
} finally {
  if (sid) await pedir("DELETE", `/session/${sid}`).catch(() => {});
  for (const p of procesos.reverse()) { try { p.kill(); } catch {} }
  try { process.kill(PID_BUS); } catch {}
  try { execFileSync("pkill", ["-f", APP]); } catch {}
}
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos} de ${results.length} bien`);
process.exit(fallos ? 1 : 0);
