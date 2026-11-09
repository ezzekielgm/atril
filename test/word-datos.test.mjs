// El Word que guarda Atril lleva dentro la duración, los ensayos y dónde se ha dado, y los textos bíblicos
// con su estilo; al volver a abrirlo, se recupera todo. Sin navegador. Uso: node test/word-datos.test.mjs
import JSZip from "jszip";
import mammoth from "mammoth";
import { buildDocx } from "../src/docx-export.js";
import { leerDatosAtril, datosDeCustomXml, propiedadesAtril, codificar } from "../src/datos-word.js";
import { buscarCitas, citaCompleta, esDeLaCita, limpiarVersiculo } from "../src/biblia.js";

let fallos = 0;
const prueba = (nombre, ok, detalle = "") => {
  if (!ok) fallos++;
  console.log(`${ok ? "✔" : "✘"} ${nombre}${detalle ? " — " + detalle : ""}`);
};

// --- Citas y versículos ---
const [c] = buscarCitas("Lea Filip. 4:4 con atención");
prueba("Cita completa", citaCompleta(c) === "Filipenses 4:4", citaCompleta(c));
prueba("Cita completa de un salmo con rango", citaCompleta(buscarCitas("Sal 37:4-7")[0]) === "Salmo 37:4-7");
prueba("Cita de libro de un capítulo", citaCompleta(buscarCitas("Judas 9")[0]) === "Judas 9");
prueba("El versículo pegado es de la cita", esDeLaCita("Estén siempre alegres en el Señor. (Filipenses 4:4)", c));
prueba("Otro versículo no es de la cita", !esDeLaCita("Texto (Filipenses 4:6)", c));
prueba("Un rango que incluye el versículo cuenta", esDeLaCita("… (Filipenses 4:4-7)", c));
const limpio = limpiarVersiculo("  Estén siempre alegres+ en el Señor.*  \r\n\r\n\r\n Lo diré otra vez: ¡estén alegres! ");
prueba("Limpia el texto copiado de jw.org", limpio === "Estén siempre alegres en el Señor.\n\nLo diré otra vez: ¡estén alegres!", JSON.stringify(limpio));

// --- Word con datos de Atril ---
const ensayos = Array.from({ length: 12 }, (_, i) => ({
  id: "e" + i, fecha: 1_780_000_000_000 + i * 86400000, seg: 1450 + i * 7, objetivoSeg: 1500,
  partes: [{ t: "Introducción (2 min)", s: 130, o: 120 }, { t: "Por qué vale la pena «alegría» & más (10 min)", s: 610, o: 600 }, { t: "Conclusión (2 min)", s: 115, o: 120 }],
  audio: i < 2,
}));
const dado = [{ id: "d1", fecha: "2026-10-05", lugar: "Congregación Norte", notas: "Salió bien; \"bajar\" ritmo <al final>" }];
const datos = { target: 25, ensayos, dado, guardado: 1_790_000_000_000 };
const html = `<h1>La alegría</h1><p>Lea Filipenses 4:4.</p><blockquote class="versiculo"><p>Estén siempre alegres en el Señor. (Filipenses 4:4)</p></blockquote><p>Otro párrafo.</p>`;
const blob = await buildDocx("La alegría", html, { datos });
const buf = Buffer.from(await blob.arrayBuffer());
const zip = await JSZip.loadAsync(buf);
const custom = zip.file("docProps/custom.xml");
prueba("El Word lleva propiedades personalizadas", !!custom);
const xmlCustom = custom ? await custom.async("string") : "";
const valores = [...xmlCustom.matchAll(/<vt:lpwstr>([\s\S]*?)<\/vt:lpwstr>/g)].map((m) => m[1]);
const nombres = [...xmlCustom.matchAll(/name="(Atril \d+)"/g)].map((m) => m[1]);
prueba("Partidas en trozos de menos de 255 letras", nombres.length > 1 && propiedadesAtril(datos).every((p) => p.value.length <= 255), `${nombres.length} propiedades`);
prueba("Nada de audio en el Word", !codificar(datos).includes("audio") && valores.length > 0);
const leidos = await leerDatosAtril(buf);
prueba("Se recupera la duración", leidos && leidos.target === 25);
prueba("Se recuperan los ensayos con sus partes", leidos && leidos.ensayos.length === 12 && leidos.ensayos[3].partes[1].t === "Por qué vale la pena «alegría» & más (10 min)" && leidos.ensayos[3].seg === 1471);
prueba("Se recupera dónde se ha dado (con comillas y < >)", leidos && leidos.dado[0].notas === dado[0].notas && leidos.dado[0].lugar === "Congregación Norte");
prueba("Fecha de guardado", leidos && leidos.guardado === 1_790_000_000_000);
prueba("Con el prefijo de Word (op:property) también se lee", !!datosDeCustomXml(xmlCustom.replace(/<property/g, "<op:property").replace(/<\/property>/g, "</op:property>")));
prueba("Un Word sin datos de Atril", (await leerDatosAtril(Buffer.from(await (await buildDocx("x", "<p>x</p>")).arrayBuffer()))) === null);

// --- El versículo sale con su estilo y vuelve a ser un versículo ---
const doc = await zip.file("word/document.xml").async("string");
const estilos = await zip.file("word/styles.xml").async("string");
prueba("Estilo «Texto bíblico» en el Word", /w:styleId="TextoBiblico"/.test(estilos) && /Texto bíblico/.test(estilos));
prueba("El párrafo del versículo usa ese estilo", /<w:pStyle w:val="TextoBiblico"\/>[\s\S]*?Estén siempre alegres/.test(doc));
const STYLE_MAP = ["p[style-name='Texto bíblico'] => blockquote.versiculo > p:fresh"];
const vuelta = await mammoth.convertToHtml({ buffer: buf }, { styleMap: STYLE_MAP });
prueba("Al abrirlo otra vez, vuelve a ser un versículo", /<blockquote class="versiculo"><p>Estén siempre alegres en el Señor\. \(Filipenses 4:4\)<\/p><\/blockquote>/.test(vuelta.value), vuelta.value.slice(0, 200));

process.exit(fallos ? 1 : 0);
