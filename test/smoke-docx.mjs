import { Document, Packer } from 'docx';
import { htmlToContent } from 'docx/html';
import fs from 'node:fs';
const html = '<h1>Título</h1><p>Texto <b>negrita</b>, <i>cursiva</i>, <u>subrayado</u> y <mark>resaltado</mark>.</p><ul><li>Uno</li><li>Dos</li></ul><ol><li>A</li></ol><h2>Sub</h2><p>Fin ñ á</p>';
const doc = new Document({ sections: [{ children: [...htmlToContent(html)] }] });
fs.writeFileSync('/tmp/smoke.docx', await Packer.toBuffer(doc));
console.log('ok');
