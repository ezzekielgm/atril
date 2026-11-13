/* Guía de Atril: qué hace cada función y dónde está. Se carga solo al abrirla.
   Pensada para quien la estrena: frases cortas, cada cosa con su «Dónde». */

const SECCIONES = (p) => [
  {
    id: "empezar", icon: "open", titulo: "Empezar",
    intro: "Atril sirve para leer tus discursos con letra grande, presentarlos con cronómetro, retocarlos y tomar notas. Funciona sin internet y todo se queda en tu dispositivo: no hay cuentas.",
    items: [
      ["share", "Instálala como una app", p.android
        ? "En Chrome, menú ⋮ → «Instalar aplicación» (o «Añadir a pantalla de inicio»). Así se abre a pantalla completa y funciona sin conexión."
        : "En Safari, toca Compartir → «Añadir a pantalla de inicio». Así se abre a pantalla completa y funciona sin conexión. (En Android: Chrome → menú ⋮ → «Instalar aplicación».)",
        p.android ? "Chrome" : "Safari"],
      ["open", "Abre tu Word", "Elige un .docx de Archivos, iCloud, OneDrive o el correo. Se conservan los títulos, las negritas, los colores y los resaltados. Si luego lo cambias en el PC y lo vuelves a abrir, Atril te ofrece sustituirlo sin perder nada.", "Inicio → Abrir Word"],
      ["plus", "Escribe uno nuevo", "En blanco o con plantilla: pones el título, los minutos y los puntos, y Atril prepara la introducción, los puntos y la conclusión con el tiempo repartido.", "Inicio → Nuevo discurso"],
      ["template", "Atril en el ordenador", p.escritorio
        ? "Arriba, los menús (Archivo, Editar, Ver, Discurso, Ayuda); a la izquierda, todos tus discursos y notas (un clic abre uno, doble clic lo edita); a la derecha, el panel del discurso: tiempo por partes, esquema, ensayos, citas y dónde lo has dado. Ctrl+K busca en todo, Ctrl+E pasa de leer a editar y F5 presenta. Abre un Word con Ctrl+O, arrastrándolo o con clic derecho → «Abrir con» → Atril; «Guardar como Word» lo guarda encima del mismo archivo. Tus Word del trabajo siguen abriéndose con Word."
        : "Hay versión para Windows y Mac, con menús, tus discursos a la izquierda y el panel del discurso a la derecha; abre tus Word con «Abrir con» o arrastrándolos, y los guarda encima del mismo archivo. La web en el ordenador también se ve así (se puede quitar en Ajustes) y deja arrastrar un Word a la ventana.",
        p.escritorio ? "Inicio → Abrir Word" : "github.com/ezzekielgm/atril/releases"],
      ["pin", "Tu lista", "Arriba sale «Seguir donde lo dejaste». Con ⋯ puedes fijar un discurso arriba, renombrarlo, compartirlo, pasarlo a Notas o eliminarlo. El buscador encuentra por título, por texto o por el lugar donde lo diste.", "Inicio → ⋯ de cada discurso"],
    ],
  },
  {
    id: "leer", icon: "book", titulo: "Leer",
    intro: "Toca un discurso para abrirlo en modo lectura.",
    items: [
      ["aa", "Letra más grande o más pequeña", "Separa dos dedos sobre el texto para agrandar la letra y pellízcalo para achicarla. La página no se amplía: el texto se recoloca solo."],
      ["aa", "Letra, tema y duración", "Cambia el tamaño, el tema (claro, sepia u oscuro), el tipo de letra y el interlineado. Ahí también pones cuántos minutos tienes para el discurso.", "Lector → Letra"],
      ["outline", "Esquema", "Los títulos y lo que has resaltado; toca uno para ir allí. Con el iPad en horizontal se queda al lado del texto y marca por dónde vas.", "Lector → Esquema"],
      ["bookmark", "Voy por aquí", "Dos toques en un párrafo lo marcan con una raya azul y se recuerda al volver. Un toque en el texto oculta las barras para tener toda la pantalla."],
      ["timer", "Cronómetro y ritmo", "Tócalo para empezar o pararlo. Con una duración puesta verás si vas adelantado o retrasado. Si un título termina en «(5 min)», el ritmo se calcula por partes. Abajo ves en qué parte vas y cuánto queda.", "Lector o editor → arriba"],
      ["search", "Buscar, tarjetas y desplazamiento automático", "Busca una palabra (da igual tildes y mayúsculas), ve una parte por pantalla en tarjetas o deja que el texto suba solo a tu ritmo. «Más» está ordenado en Practicar, Documento, Compartir y guardar, y Ayuda.", "Lector → Más"],
      ["book", "Citas bíblicas", "Las citas como «Sal 37:4» salen subrayadas: tócalas para abrir el versículo en JW Library o en jw.org.", "Toca la cita · Ajustes → Citas bíblicas"],
      ["paste", "El versículo debajo de la cita", "Abre la cita, copia el versículo y vuelve a Atril: te ofrece pegarlo debajo (o toca la cita → «Pegar el versículo copiado»). Queda en el discurso, en otro color, y sale en el Word. Atril no lo descarga solo: lo copias tú.", "Toca la cita"],
    ],
  },
  {
    id: "presentar", icon: "play", titulo: "Presentar",
    intro: "Para dar el discurso: pantalla limpia, cronómetro grande y nada que se toque sin querer.",
    items: [
      ["play", "Empezar", "Antes sale una comprobación rápida: el tiempo, la letra, si empiezas desde el principio o desde donde estás y que la pantalla no se apague. Toca «Presentar ahora». Verás el cronómetro, cuánto queda, la hora, en qué parte vas y cuál sigue.", "Lector → Presentar (el botón azul)"],
      ["timer", "El cronómetro, como un semáforo", "Tócalo para empezar; para pausarlo, mantenlo pulsado. Verde mientras hay tiempo, ámbar en el último minuto y rojo si te pasas."],
      ["down", "Pasar página", "Toca la parte de abajo de la pantalla para avanzar y la de arriba para volver. También puedes deslizar el dedo.", "Se puede quitar en Ajustes"],
      ["lock", "Salir", "Toca el centro de la pantalla y aparece «Mantén pulsado para salir»: mantén el dedo hasta que se llene. Ni los toques sueltos ni el gesto de «atrás» te sacan del discurso."],
      ["lock", "Que no se salga de la app", p.android
        ? "El gesto de ir a la pantalla de inicio es del sistema y ninguna app lo puede bloquear. Usa «Fijar aplicaciones» de Android (Ajustes → Seguridad)."
        : "El gesto de ir a la pantalla de inicio es del sistema y ninguna app lo puede bloquear. Usa «Acceso guiado»: Ajustes → Accesibilidad → Acceso guiado; luego, en Atril, tres pulsaciones del botón superior (o del de inicio). En Android: «Fijar aplicaciones»."],
      ["history", "Si se cierra", "Al volver a abrir Atril estarás en el mismo sitio, con el cronómetro en marcha."],
    ],
  },
  {
    id: "ensayar", icon: "history", titulo: "Ensayar",
    items: [
      ["clock", "Minutos de cada parte", "Pon la duración del discurso en «Letra». En el editor, «Minutos de la parte» añade «(5 min)» al título de cada parte para llevar el ritmo por partes.", "Editor → Insertar"],
      ["history", "Ensayos", "Cada vez que pones el cronómetro a cero tras 30 segundos o más se guarda el ensayo, con el tiempo de cada parte comparado con tu objetivo.", "Lector → Más → Ensayos"],
      ["bookmark", "Cómo vas", "Con tus últimos ensayos, Atril te dice tu tiempo habitual, qué parte se pasa más y qué practicar. Toca una parte para practicarla sola: el cronómetro se para al llegar a la siguiente y no cuenta como ensayo.", "Lector → Más → Ensayos"],
      ["mic", "Grabar tu voz", "Se graba mientras corre el cronómetro; luego te escuchas y saltas a cada parte. Las grabaciones se quedan en el dispositivo.", "Ajustes → Grabar audio al ensayar"],
      ["calendar", "Dónde lo he dado", "Apunta la fecha, el lugar y unas notas. Si vas a darlo donde ya lo diste, te avisa.", "Lector → Más, o ⋯ del discurso"],
    ],
  },
  {
    id: "editar", icon: "edit", titulo: "Editar",
    intro: "Como en Word: arriba, pestañas con los botones. Se guarda solo mientras escribes.",
    items: [
      ["edit", "Abrir el editor", "Desde el lector, o desde ⋯ en la lista.", "Lector → Editar"],
      ["timer", "Cronómetro mientras escribes", "También en el editor, aunque el discurso sea nuevo: tócalo para empezar o pararlo sin que se cierre el teclado. Ámbar en el último minuto de la duración y rojo si te pasas. Lo que cronometras escribiendo no cuenta como ensayo; si vienes del lector con un ensayo en marcha, sigue contando.", "Editor → arriba"],
      ["marker", "Dar formato", "Estilos (Normal, Título 1, 2 y 3), negrita, cursiva, subrayado, tachado, resaltador de 4 colores, color de letra y listas. Selecciona el texto y toca el botón.", "Editor → Inicio"],
      ["plus", "Insertar", "Una parte nueva con sus minutos, los minutos de una parte, una pausa «‖» (al leer sale destacada), el texto bíblico de la cita donde está el cursor, un dibujo o escritura a mano, y dictar.", "Editor → Insertar"],
      ["search", "Revisar", "Buscar y reemplazar, y cuánto dura. Si seleccionas texto, abajo dice cuántas palabras son y cuánto tardas en decirlas.", "Editor → Revisar"],
      ["panel", "Panel de navegación", "Con el iPad en horizontal sale a la izquierda: cada parte con lo que dura y flechas para subirla o bajarla entera.", "Editor → Vista"],
      ["history", "Versiones anteriores", "Atril guarda una copia cada vez que empiezas a editar. Si te equivocas, recupera la que quieras (se guardan las 10 últimas).", "Editor → Revisar → Versiones"],
      ["marker", "Qué significa cada color", "Ponle nombre a cada color (por ejemplo, amarillo = ideas clave). Sale en los botones del editor y en el filtro del esquema.", "Ajustes, o ⋯ del editor"],
      ["template", "Con teclado", "⌘B negrita, ⌘I cursiva, ⌘F buscar, ⌘⌥1, 2 y 3 títulos…", "Editor → ⋯ → Atajos de teclado"],
    ],
  },
  {
    id: "lapiz", icon: "pluma", titulo: "Lápiz y voz",
    items: [
      ["pluma", "Escribir a mano y que pase a letra", "Con el Apple Pencil, escribe directamente sobre el texto del editor y el iPad lo convierte en letra. Tiene que estar activado en Ajustes del iPad → Apple Pencil → Escribir a mano."],
      ["rotulador", "Dibujar o dejarlo a mano", "Bolígrafo (engorda al apretar), rotulador, goma, 4 colores y 3 grosores. Con el lápiz puedes apoyar la mano. Se ve al leer y sale en Word y PDF.", "Editor → Insertar → Dibujo o a mano"],
      ["pluma", "Nota a mano", "Abre directamente una hoja para escribir o dibujar, y se guarda como nota.", "Notas → Nota a mano"],
      ["mic", "Dictar", "Se abre el teclado: toca su micrófono y habla. Di «coma», «punto» o «nuevo párrafo».", "Notas → Dictar, o Editor → Insertar → Dictar"],
    ],
  },
  {
    id: "notas", icon: "note", titulo: "Notas",
    items: [
      ["note", "Notas rápidas", "Ideas sueltas, apuntes o borradores. Se guardan solas.", "Pestaña Notas → Nueva nota"],
      ["book", "Leer en grande", "Abre la nota en el lector, con letra grande, como un discurso.", "⋯ de la nota"],
      ["move", "Pasar a Discursos", "Cuando una nota se convierte en discurso, pásala a su pestaña.", "⋯ de la nota"],
    ],
  },
  {
    id: "compartir", icon: "share", titulo: "Compartir y guardar",
    items: [
      ["chat", "Mandar por WhatsApp", "Se abre WhatsApp con el texto escrito y eliges el chat. Sale con negritas y cursivas (*así*); si lo prefieres, quítalas con el interruptor.", "⋯ → Compartir, Lector → Más → Compartir, o el botón de compartir del editor"],
      ["share", "A otra app o copiado", "«Otra app» abre la lista del sistema: correo, Mensajes, Telegram, Notas, Claude… «Copiar el texto» lo deja listo para pegar donde quieras.", "⋯ → Compartir"],
      ["word", "Como archivo", "Word (se abre en Word, Pages o Google Docs) o PDF (para leerlo o imprimirlo tal cual, con letra normal, grande o muy grande y las mismas letras de Atril, con todas las tildes y comillas).", "⋯ → Compartir → Como archivo"],
      ["word", "El Word del PC, al día", p.escritorio
        ? "«Guardar como Word» lo guarda encima del Word que abriste (si lo tienes abierto en Word, ciérralo antes). Si ese Word ha cambiado fuera de Atril, te avisa antes de sustituirlo."
        : "Si un discurso vino de un Word y lo cambias aquí, su tarjeta dice «Cambiado en el iPad». «Guardar como Word» lo crea con el mismo nombre: Guardar en Archivos → la misma carpeta → «Reemplazar».", "⋯ → Guardar como Word"],
      ["clock", "Tus tiempos van dentro del Word", "El Word que guarda Atril lleva dentro la duración, tus ensayos y dónde lo has dado (Word lo conserva aunque lo edites). Al abrirlo con Atril en otro dispositivo, llega con todo. Al compartirlo con otros no se pone.", "⋯ → Guardar como Word"],
      ["escudo", "Copia de seguridad", "Todo está solo en este dispositivo: si borras la app, se borra. Abajo en el inicio ves la «Protección»: cuándo fue la última copia y cuánto has cambiado desde entonces. Guarda la copia en OneDrive o iCloud; Atril te lo recuerda cada semana.", "Inicio, abajo; Ajustes → Hacer copia de seguridad"],
      ["download", "Actualizaciones", p.escritorio
        ? "Cuando hay una versión nueva para el ordenador, Atril te avisa: descarga el instalador y ábrelo; se instala encima y conserva tus discursos y notas."
        : "Atril se actualiza sola y tus datos no se tocan. Para mirarlo ahora mismo, «Buscar actualizaciones».", "Ajustes → Versión"],
    ],
  },
];

function h(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) n.append(c);
  return n;
}

let abierta = null;

/**
 * Abre la guía a pantalla completa.
 * @param {{seccion?: string, icon: (n: string) => string, alProbar?: () => void, ios?: boolean, android?: boolean}} op
 */
export function abrirGuia({ seccion, icon, alProbar, android = false, escritorio = false } = {}) {
  if (abierta) abierta.cerrar();
  const secciones = SECCIONES({ android, escritorio });
  const chips = h("nav", { class: "guia-chips", "aria-label": "Apartados de la guía" });
  const cuerpo = h("div", { class: "guia-body" });
  const wrap = h("div", { class: "guia-wrap" });
  cuerpo.append(wrap);

  wrap.append(
    h("p", { class: "guia-intro", text: "Aquí tienes qué hace cada cosa y dónde está. Toca un apartado arriba para ir directo." }),
    alProbar ? h("div", { class: "guia-probar" },
      h("button", { class: "btn primary", id: "guia-probar", html: icon("book") + "<span>Probar con un ejemplo</span>", onclick: () => cerrar().then(alProbar) })) : null,
  );
  for (const s of secciones) {
    const sec = h("section", { class: "guia-sec", id: "guia-" + s.id },
      h("h3", { html: icon(s.icon) + `<span></span>` }),
      s.intro ? h("p", { text: s.intro }) : null,
      h("ul", { class: "guia-items" }, s.items.map(([ic, titulo, texto, donde]) =>
        h("li", {},
          h("span", { class: "guia-ic", html: icon(ic) }),
          h("b", { text: titulo }),
          h("span", { class: "guia-txt" }, texto, donde ? h("span", { class: "guia-donde", text: donde }) : null)))));
    sec.querySelector("h3 span").textContent = s.titulo;
    wrap.append(sec);
    chips.append(h("button", { "data-sec": s.id, "aria-pressed": "false", html: icon(s.icon) + `<span>${s.titulo}</span>`, onclick: () => ir(s.id, true) }));
  }
  wrap.append(h("p", { class: "guia-pie", text: "¿Algo no funciona o se te ocurre una mejora? Cuéntaselo a quien te pasó Atril." }));

  const botonCerrar = h("button", { id: "guia-cerrar", text: "Cerrar", onclick: () => cerrar() });
  const raiz = h("div", { class: "guia", id: "guia", role: "dialog", "aria-modal": "true", "aria-label": "Guía de Atril" },
    h("header", { class: "guia-bar" }, h("h2", { html: icon("guia") + "<span>Guía de Atril</span>" }), botonCerrar),
    chips, cuerpo);
  document.body.append(raiz);

  const marcar = (id) => {
    for (const b of chips.children) {
      const si = b.dataset.sec === id;
      b.setAttribute("aria-pressed", String(si));
      if (si) {
        const izq = b.offsetLeft - 12, der = b.offsetLeft + b.offsetWidth - chips.clientWidth + 12;
        if (chips.scrollLeft > izq) chips.scrollLeft = izq;
        else if (chips.scrollLeft < der) chips.scrollLeft = der;
      }
    }
  };
  let saltando = 0;
  function ir(id, suave) {
    const sec = wrap.querySelector("#guia-" + id);
    if (!sec) return;
    marcar(id);
    clearTimeout(saltando);
    saltando = setTimeout(() => { saltando = 0; }, suave ? 700 : 50);
    cuerpo.scrollTo({ top: sec.offsetTop - 8, behavior: suave ? "smooth" : "auto" });
  }
  cuerpo.addEventListener("scroll", () => {
    if (saltando) return;
    const tope = cuerpo.scrollTop + 60;
    let actual = secciones[0].id;
    for (const s of secciones) { const n = wrap.querySelector("#guia-" + s.id); if (n.offsetTop <= tope) actual = s.id; }
    if (cuerpo.scrollTop + cuerpo.clientHeight >= cuerpo.scrollHeight - 4) actual = secciones[secciones.length - 1].id;
    marcar(actual);
  }, { passive: true });

  // «Atrás» (Android, o el gesto) cierra la guía en vez de cambiar de pantalla
  history.pushState({ atril: "guia" }, "");
  let alCerrar = null;
  const quitar = () => {
    if (!raiz.isConnected) return;
    raiz.remove();
    document.removeEventListener("keydown", tecla, true);
    window.removeEventListener("popstate", atras);
    abierta = null;
    const r = alCerrar; alCerrar = null;
    if (r) r();
  };
  function atras() { quitar(); }
  function tecla(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(); }
  }
  /** Cierra y quita el paso del historial; la promesa se cumple cuando ya se ha vuelto. */
  function cerrar() {
    return new Promise((ok) => {
      if (!raiz.isConnected) { ok(); return; }
      if (history.state && history.state.atril === "guia") {
        alCerrar = ok;
        history.back();
        setTimeout(quitar, 600); // por si el navegador no avisa
      } else { quitar(); ok(); }
    });
  }
  window.addEventListener("popstate", atras);
  document.addEventListener("keydown", tecla, true);
  abierta = { cerrar };

  marcar(secciones[0].id);
  requestAnimationFrame(() => { if (seccion) ir(seccion, false); botonCerrar.focus({ preventScroll: true }); });
  return abierta;
}
