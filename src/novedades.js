// «Novedades» de Atril: lo que ha cambiado, para que nadie se lleve una sorpresa antes de un discurso.
// La más reciente primero. Cada grupo con un id que solo crece («AAAA-MM-DD» o «AAAA-MM-DD-2»).
// Al pasar algo de pruebas a la versión de todos (git push origin main:estable), añade aquí sus líneas.
// Cada línea: [icono, texto]. Iconos: los de ICONOS en main.js.
export const NOVEDADES = [
  {
    id: "2026-11-15",
    fecha: "15 de noviembre de 2026",
    lineas: [
      ["pluma", "«Nota a mano» → «A texto»: escribe con el Apple Pencil y el iPad lo pasa a letra (cada línea, un párrafo). «A mano» se queda tal como lo escribes. Atril recuerda cuál usaste."],
      ["rotulador", "La escritura a mano se ve nítida y fina (si escribes suave, más fina todavía), y también sale nítida en el Word y el PDF."],
      ["word", "Guardar como Word: elige «Guardar en Archivos» (ahí puedes escoger OneDrive) y queda como .docx."],
      ["scroll", "Presentar: al poner en marcha el cronómetro, el texto sube solo a tu ritmo. Arriba tienes un interruptor para apagarlo, «−» y «+» para la velocidad y «A−» y «A+» para la letra."],
      ["outline", "En el iPad, la barra del lector es más grande y va por grupos, como en Word: Presentar, Practicar (Desplazar, Ensayos, Tarjetas), Leer (Esquema, Letra, Buscar) y Documento (Editar, Nuevo, Compartir, Más)."],
      ["clock", "Junto al cronómetro, la duración del discurso: tócala para cambiarla."],
      ["up", "La barra de herramientas del lector y la cinta del editor se pueden minimizar con la flecha de arriba a la derecha."],
      ["chispa", "Diseño nuevo: icono y cabecera nuevos, colores más claros, barras claras en el editor y el lector, y en el inicio la pestaña «Recientes» (discursos y notas juntos) con «+ Nuevo» al lado."],
      ["edit", "Editor como Word: Pegar, Cortar, Copiar y Copiar formato; tipo y tamaño de letra, subíndice, superíndice y mayúsculas; sangría y alinear (izquierda, centro, derecha, justificar); estilo Cita."],
      ["next", "Las barras de herramientas del lector y del editor van en dos filas y se deslizan de lado con el dedo para que quepa todo. En el lector, además: Voy por aquí, Pantalla completa, Dónde lo he dado, Word, PDF y Guía. En el editor, más herramientas: agrandar y encoger la letra, interlineado, ordenar, Título 4, reemplazar, seleccionar todo, foto con la cámara, vínculos, hora, índice, marcas de párrafo, modo concentración y zoom al 100 %."],
      ["template", "Insertar: tabla, imagen, línea, salto de página, fecha y símbolos. Revisar: ortografía y leer en voz alta. Todo sale en el Word, y al abrir un Word se conservan la alineación y la sangría."],
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
