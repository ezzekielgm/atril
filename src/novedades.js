// «Novedades» de Atril: lo que ha cambiado, para que nadie se lleve una sorpresa antes de un discurso.
// La más reciente primero. Cada grupo con un id que solo crece («AAAA-MM-DD» o «AAAA-MM-DD-2»).
// Al pasar algo de pruebas a la versión de todos (git push origin main:estable), añade aquí sus líneas.
// Cada línea: [icono, texto]. Iconos: los de ICONOS en main.js.
export const NOVEDADES = [
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
