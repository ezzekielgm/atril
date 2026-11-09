// Comprueba que los resaltados y el color de la letra salen bien en el Word exportado. Uso: node test/docx-colores.test.mjs
import JSZip from "jszip";
import { buildDocx } from "../src/docx-export.js";
const html = `<h2>Parte</h2><p>A <mark>amarillo</mark> B <mark class="c-verde">verde</mark> C <mark class="c-azul">azul</mark> D <mark class="c-rosa">rosa</mark></p>` +
  `<p>E <span class="t-rojo">rojo</span> F <strong><span class="t-azul">azul</span></strong> G <span class="t-verde">verde</span> H <span class="t-naranja">naranja</span></p>`;
const blob = await buildDocx("Prueba", html);
const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
const xml = await zip.file("word/document.xml").async("string");
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? "✔" : "✘"} ${nombre} — ${obtenido.join(", ")}`);
};
prueba("Resaltados de colores en el Word", [...xml.matchAll(/<w:highlight w:val="(\w+)"\/>/g)].map((m) => m[1]), ["yellow", "green", "cyan", "magenta"]);
prueba("Color de la letra en el Word", [...xml.matchAll(/<w:color w:val="(\w+)"\/>/g)].map((m) => m[1]), ["C00000", "0070C0", "00873C", "D86400"]);
process.exit(fallos ? 1 : 0);
