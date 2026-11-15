// «Novedades» de Atril: lo que ha cambiado, para que nadie se lleve una sorpresa antes de un discurso.
// La más reciente primero. Cada grupo con un id que solo crece («AAAA-MM-DD» o «AAAA-MM-DD-2»).
// Al pasar algo de pruebas a la versión de todos (git push origin main:estable), añade aquí sus líneas.
// Cada línea: [icono, texto]. Iconos: los de ICONOS en main.js.
export const NOVEDADES = [
  {
    id: "2026-11-15",
    fecha: "15 de noviembre de 2026",
    lineas: [
      ["chispa", "Diseño nuevo: icono y cabecera nuevos, colores más claros y, en el inicio, la pestaña «Recientes» (discursos y notas juntos) con «+ Nuevo» al lado."],
      ["scroll", "Presentar: al poner en marcha el cronómetro, el texto sube solo a tu ritmo. Arriba tienes un interruptor para apagarlo, «−» y «+» para la velocidad y «A−» y «A+» para la letra."],
      ["outline", "En el iPad, la barra del lector va por grupos, como en Word, en dos filas que se deslizan de lado: Presentar, Practicar (Desplazar, Ensayos, Tarjetas), Leer, Documento, Guardar (Word y PDF) y Ayuda. Junto al cronómetro, la duración del discurso: tócala para cambiarla."],
      ["word", "El editor tiene la cinta de Word, con sus mismas pestañas y en su orden: Archivo, Inicio, Insertar, Disposición, Referencias, Revisar y Vista. Lo propio de Atril (partes, minutos y pausas) está en la pestaña «Discurso», al final. La cinta va en dos filas y se desliza de lado con el dedo."],
      ["edit", "Herramientas nuevas en el editor: pegar, cortar, copiar y copiar formato; tipo y tamaño de letra, agrandar y encoger, subíndice, superíndice y mayúsculas; sangría, alinear, interlineado y ordenar; Título 4 y Cita; tabla, imagen o foto, vínculos, línea, salto de página, fecha, hora, símbolos e índice; ortografía y leer en voz alta. Todo sale en el Word, y al abrir un Word se conservan la alineación y la sangría."],
      ["up", "La barra del lector y la cinta del editor se pueden minimizar con la flecha de arriba a la derecha."],
      ["pluma", "«Nota a mano» → «A texto»: escribe con el Apple Pencil y el iPad lo pasa a letra (cada línea, un párrafo). «A mano» se queda tal como lo escribes, nítido y fino, también en el Word y el PDF."],
      ["word", "Guardar como Word: elige «Guardar en Archivos» (ahí puedes escoger OneDrive) y queda como .docx."],
    ],
  },
  {
    id: "2026-11-13",
    fecha: "13 de noviembre de 2026",
    lineas: [
      ["lock", "Presentar: botón «Salir» arriba a la derecha, siempre a la vista. Al tocarlo aparece en el centro «Mantén pulsado para salir» y «Cronómetro a cero» (sin salir de Presentar)."],
      ["timer", "El cronómetro también está en el editor, aunque estés escribiendo un discurso nuevo."],
      ["scroll", "«Desplazar», al lado de Presentar: el texto sube solo, a tu ritmo."],
      ["plus", "«+» (Nuevo) en el lector y en el editor: discurso con plantilla, en blanco o nota."],
      ["back", "Si pasas del editor al modo lectura, la flecha «‹ Editar» te devuelve al editor."],
      ["chispa", "Compartir → «Para Claude»: copia tus notas o tu discurso con lo que le pides (ordenar, mejorar o resumir). Si escribiste a mano, en PDF."],
      ["next", "Presentar: al pasar página se ilumina un momento la línea por la que sigues."],
      ["chat", "Ajustes → «Contar un problema o una idea a Ezequiel»."],
    ],
  },
];

/** Los grupos que alguien con la versión `visto` aún no ha visto (todos si no hay `visto`). */
export function novedadesDesde(visto) {
  return visto ? NOVEDADES.filter((g) => g.id > visto) : NOVEDADES.slice();
}
