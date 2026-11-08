// Comprueba que los resaltados de colores salen bien en el Word exportado. Uso: node test/docx-colores.test.mjs
import JSZip from "jszip";
import { buildDocx } from "../src/docx-export.js";
const html = `<h2>Parte</h2><p>A <mark>amarillo</mark> B <mark class="c-verde">verde</mark> C <mark class="c-azul">azul</mark> D <mark class="c-rosa">rosa</mark></p>`;
const blob = await buildDocx("Prueba", html);
const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
const xml = await zip.file("word/document.xml").async("string");
const colores = [...xml.matchAll(/<w:highlight w:val="(\w+)"\/>/g)].map((m) => m[1]);
const esperado = ["yellow", "green", "cyan", "magenta"];
const bien = JSON.stringify(colores) === JSON.stringify(esperado);
console.log(`${bien ? "✔" : "✘"} Resaltados de colores en el Word — ${colores.join(", ")}`);
process.exit(bien ? 0 : 1);
