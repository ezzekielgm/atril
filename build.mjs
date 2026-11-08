// Construye la app en dist/ (la carpeta que se sube a internet).
// Uso: npm run build
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SRC = "src";
const OUT = "dist";

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "vendor"), { recursive: true });

// 1. JavaScript: main.js + docx-export.js (este último se carga solo al exportar a Word)
await esbuild.build({
  entryPoints: [path.join(SRC, "main.js")],
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: path.join(OUT, "js"),
  minify: true,
  target: ["safari15", "chrome100"],
  chunkNames: "chunk-[hash]",
  legalComments: "none",
  logLevel: "warning",
});

// 2. Archivos estáticos
for (const f of ["index.html", "styles.css", "manifest.webmanifest"]) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
fs.cpSync(path.join(SRC, "icons"), path.join(OUT, "icons"), { recursive: true });
fs.cpSync(path.join(SRC, "fonts"), path.join(OUT, "fonts"), { recursive: true });
fs.copyFileSync("node_modules/mammoth/mammoth.browser.min.js", path.join(OUT, "vendor", "mammoth.browser.min.js"));
fs.writeFileSync(path.join(OUT, "_headers"), "/sw.js\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n");

// 3. Versión = huella del contenido (cambia sola con cada cambio)
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(path.relative(OUT, p).split(path.sep).join("/"));
  }
})(OUT);
const hash = crypto.createHash("sha256");
for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
const version = new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + hash.digest("hex").slice(0, 8);

// 4. Inserta la versión en main.js
const mainPath = path.join(OUT, "js", "main.js");
fs.writeFileSync(mainPath, fs.readFileSync(mainPath, "utf8").replace("__APP_VERSION__", version));

// 5. Service worker con la lista de archivos a guardar para usar sin conexión
const assets = ["./", ...files.filter((f) => f !== "_headers").map((f) => "./" + f)];
const sw = fs.readFileSync(path.join(SRC, "sw.js"), "utf8")
  .replace("__APP_VERSION__", version)
  .replace("__ASSETS__", JSON.stringify(assets, null, 2));
fs.writeFileSync(path.join(OUT, "sw.js"), sw);

const size = files.reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`Atril ${version} → ${OUT}/ (${files.length + 1} archivos, ${(size / 1024 / 1024).toFixed(2)} MB)`);
