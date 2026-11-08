// Genera un .docx a partir del HTML del documento. Se carga solo cuando hace falta.
import { Document, Packer } from "docx";
import { htmlToContent } from "docx/html";

export async function buildDocx(title, html) {
  const children = htmlToContent(html, {
    stylesheet: "mark { background-color: yellow; }",
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
