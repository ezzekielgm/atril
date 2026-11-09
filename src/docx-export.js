// Genera un .docx a partir del HTML del documento. Se carga solo cuando hace falta.
import { Document, Packer } from "docx";
import { htmlToContent } from "docx/html";
import { LETRAS } from "./colores.js";

export async function buildDocx(title, html) {
  const children = htmlToContent(html, {
    // Colores de resaltado de Word: amarillo, verde brillante, turquesa y rosa
    stylesheet:
      "mark { background-color: #FFFF00; } mark.c-verde { background-color: #00FF00; } " +
      "mark.c-azul { background-color: #00FFFF; } mark.c-rosa { background-color: #FF00FF; } " +
      // Color de la letra
      LETRAS.map((l) => `span.${l.clase} { color: ${l.hex}; }`).join(" "),
    maxImageWidth: 600,
  });
  const doc = new Document({
    creator: "Atril",
    title: title || "Documento",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 24 }, // 12 pt
          paragraph: { spacing: { after: 160, line: 300 } },
        },
      },
    },
    sections: [{ properties: {}, children: [...children] }],
  });
  return Packer.toBlob(doc);
}
