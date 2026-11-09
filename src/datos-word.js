// Lo de Atril que viaja dentro del Word: la duración que hay que cumplir, los ensayos y dónde se ha dado.
// Va en propiedades personalizadas del documento (docProps/custom.xml), que Word conserva al editarlo y
// guardarlo. Word no deja más de 255 letras en cada una, así que el JSON se parte en «Atril 1», «Atril 2»…
// Así un mismo .docx abierto en Atril del ordenador, del iPad o de la web llega con sus tiempos.
// No lleva audio ni nada que no sea de ese discurso. Al compartir un Word con otros, no se pone.

const PREFIJO = "Atril ";
const TROZO = 240;

/** Datos del discurso -> JSON compacto (o "" si no hay nada que guardar). */
export function codificar({ target, ensayos, dado, guardado } = {}) {
  const o = { v: 1, g: Math.round(guardado || Date.now()) };
  const t = Number(target);
  if (t > 0 && t <= 240) o.o = t;
  if (Array.isArray(ensayos) && ensayos.length) {
    o.e = ensayos.slice(0, 30).map((e) => [
      String(e.id || ""), Math.round(e.fecha || 0), Math.round(e.seg || 0), e.objetivoSeg == null ? null : Math.round(e.objetivoSeg),
      (Array.isArray(e.partes) ? e.partes : []).slice(0, 40).map((p) => [String((p && p.t) || "").slice(0, 80), Math.round((p && p.s) || 0), p && p.o != null ? Math.round(p.o) : null]),
    ]);
  }
  if (Array.isArray(dado) && dado.length) {
    o.d = dado.slice(0, 100).map((d) => [String(d.id || ""), String(d.fecha || ""), String(d.lugar || "").slice(0, 120), String(d.notas || "").slice(0, 300)]);
  }
  return o.o || o.e || o.d ? JSON.stringify(o) : "";
}

/** JSON compacto -> {guardado, target, ensayos, dado} (sin validar: lo valida quien lo usa). */
export function decodificar(json) {
  const o = JSON.parse(json);
  if (!o || o.v !== 1) return null;
  return {
    guardado: Number(o.g) || 0,
    target: o.o,
    ensayos: Array.isArray(o.e) ? o.e.filter(Array.isArray).map(([id, fecha, seg, objetivoSeg, partes]) => ({
      id, fecha, seg, objetivoSeg,
      partes: Array.isArray(partes) ? partes.filter(Array.isArray).map(([t, s, oo]) => ({ t, s, o: oo })) : [],
    })) : undefined,
    dado: Array.isArray(o.d) ? o.d.filter(Array.isArray).map(([id, fecha, lugar, notas]) => ({ id, fecha, lugar, notas })) : undefined,
  };
}

/** Propiedades personalizadas para el Word ([{name, value}], para la opción customProperties de docx). */
export function propiedadesAtril(datos) {
  const json = codificar(datos);
  const res = [];
  for (let i = 0; i * TROZO < json.length; i++) res.push({ name: PREFIJO + (i + 1), value: json.slice(i * TROZO, (i + 1) * TROZO) });
  return res;
}

const desescapar = (t) => t
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Junta las propiedades «Atril N» de docProps/custom.xml (el texto del XML) y las descifra. null si no hay. */
export function datosDeCustomXml(xml) {
  const trozos = [];
  const re = /<(?:[\w-]+:)?property\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?property>/g;
  for (const m of String(xml || "").matchAll(re)) {
    const nombre = /\bname="Atril (\d{1,3})"/.exec(m[1]);
    if (!nombre) continue;
    const valor = /<(?:[\w-]+:)?lpwstr>([\s\S]*?)<\/(?:[\w-]+:)?lpwstr>/.exec(m[2]);
    trozos.push([Number(nombre[1]), valor ? desescapar(valor[1]) : ""]);
  }
  if (!trozos.length) return null;
  trozos.sort((a, b) => a[0] - b[0]);
  try { return decodificar(trozos.map((t) => t[1]).join("")); } catch { return null; }
}

/** Lee lo de Atril de un .docx (ArrayBuffer). null si no lo lleva o no se puede leer. */
export async function leerDatosAtril(arrayBuffer) {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(arrayBuffer);
    const f = zip.file("docProps/custom.xml");
    return f ? datosDeCustomXml(await f.async("string")) : null;
  } catch (e) {
    console.warn("Sin datos de Atril en el Word:", e);
    return null;
  }
}
