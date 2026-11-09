// Genera un .docx a partir del HTML del documento. Se carga solo cuando hace falta.
import { Document, Packer } from "docx";
import { htmlToContent } from "docx/html";
import { LETRAS } from "./colores.js";
import { propiedadesAtril } from "./datos-word.js";

/** Estilo de Word de los textos bíblicos pegados debajo de las citas (al volver a abrirlo, Atril lo reconoce). */
export const ESTILO_VERSICULO = { id: "TextoBiblico", nombre: "Texto bíblico" };

/**
 * title: título del documento · html: su contenido limpio
 * datos: lo de Atril que viaja dentro del Word (duración, ensayos, dónde lo has dado), o null
 */
export async function buildDocx(title, html, { datos = null } = {}) {
  const children = htmlToContent(html, {
    // Colores de resaltado de Word: amarillo, verde brillante, turquesa y rosa
    stylesheet:
      "mark { background-color: #FFFF00; } mark.c-verde { background-color: #00FF00; } " +
      "mark.c-azul { background-color: #00FFFF; } mark.c-rosa { background-color: #FF00FF; } " +
      // El versículo lleva su sangría en el estilo de Word, no como formato directo
      "blockquote.versiculo { margin: 0; } " +
      // Color de la letra
      LETRAS.map((l) => `span.${l.clase} { color: ${l.hex}; }`).join(" "),
    styleMap: { "blockquote.versiculo": ESTILO_VERSICULO.id, "blockquote.versiculo p": ESTILO_VERSICULO.id },
    maxImageWidth: 600,
  });
  const doc = new Document({
    creator: "Atril",
    title: title || "Documento",
    customProperties: datos ? propiedadesAtril(datos) : [],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 24 }, // 12 pt
          paragraph: { spacing: { after: 160, line: 300 } },
        },
      },
      paragraphStyles: [{
        id: ESTILO_VERSICULO.id,
        name: ESTILO_VERSICULO.nombre,
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 22, color: "3F3F46" }, // 11 pt, gris oscuro
        paragraph: {
          indent: { left: 567 }, // 1 cm
          spacing: { before: 0, after: 120, line: 280 },
          border: { left: { style: "single", size: 18, color: "E3A869", space: 8 } },
        },
      }],
    },
    sections: [{ properties: {}, children: [...children] }],
  });
  return Packer.toBlob(doc);
}
