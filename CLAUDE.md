# Atril — lector y editor de discursos (PWA)

App web instalable (PWA) para el iPad de Ezequiel. Sirve para:

1. **Leer discursos** importados de Word (.docx) en modo lectura: el texto se reajusta al ancho y el tamaño de letra cambia con el gesto de dos dedos (separar = más grande, pellizcar = más pequeña), sin ampliar la página.
2. **Retocar** el texto (cambiar letras o palabras, negrita, cursiva, subrayado, resaltado, títulos y listas) y **guardarlo como Word**.
3. **Tomar notas** rápidas, que luego copia o comparte para pasárselas a Claude o guardarlas como Word.

Se instala desde Safari con *Compartir → Añadir a pantalla de inicio*, funciona sin conexión y guarda todo en el propio dispositivo (IndexedDB). No hay servidor ni cuentas.

Responde en español. Interfaz y textos de la app, en español de España.

## Estructura

```
src/
  index.html          vistas: inicio, lector, editor (se muestran/ocultan)
  styles.css          temas (claro, sepia, oscuro), tipografía y diseño táctil
  main.js             la app (sin frameworks): vistas, almacenamiento, lector, editor, notas
  biblia.js           detecta citas bíblicas en español y las enlaza a JW Library (jwlibrary:///finder) o jw.org
  tiempo.js           duración estimada, plan por partes (títulos con «(N min)») y ritmo adelantado/retrasado
  docx-export.js      HTML -> .docx (se carga solo al exportar; usa docx + docx/html)
  sw.js               service worker (plantilla: el build mete versión y lista de archivos)
  manifest.webmanifest
  icons/              iconos PNG (se generan con scripts/make-icons.mjs desde scripts/icon.svg)
build.mjs             construye dist/ con esbuild
test/e2e.mjs          prueba de punta a punta con Playwright (Chromium emulando iPad táctil)
test/e2e-funciones.mjs  pruebas de citas, esquema, tiempo objetivo y vista de móvil
test/biblia.test.mjs  pruebas del detector de citas (sin navegador)
dist/                 lo que se sube a internet (se genera; no editar a mano)
```

## Comandos

- `npm install` — dependencias (mammoth, docx, esbuild).
- `npm run build` — genera `dist/`. La versión se calcula sola con la huella del contenido, así el service worker detecta cada cambio.
- `npm run serve` — sirve `dist/` en http://localhost:8080 para probar.
- `npm test` — todas las pruebas (con `dist/` servido en el puerto 8080).
- `node test/e2e.mjs` — pruebas (con `dist/` servido en el puerto 8080). Requiere Playwright con Chromium (`npx playwright install chromium`). La ruta del .docx de prueba se pasa con `ATRIL_DOCX=...`.
- `npm run icons` — regenera los iconos.

## Cómo funciona por dentro

- **Datos**: IndexedDB `atril`, almacenes `docs` (discursos) y `notes` (notas). Cada elemento: `{id, title, html, created, updated, source?}`. Ajustes (tamaño de letra, tema, letra, interlineado, pestaña) en `localStorage` bajo `atril.settings`; posición de lectura en `atril.pos.<tipo>.<id>`.
- **HTML siempre limpio**: todo lo que entra (Word importado, copia restaurada, lo que guarda el editor) pasa por `sanitize()`, una lista blanca de etiquetas. Convierte `<b>/<i>` en `<strong>/<em>`, los fondos de color en `<mark>` y los `<div>` en `<p>`. No metas HTML sin pasar por ahí.
- **Importar .docx**: mammoth (`vendor/mammoth.browser.min.js`, cargado bajo demanda) con un `STYLE_MAP` para títulos, subrayado, tachado y resaltado.
- **Exportar .docx**: `docx-export.js` usa `htmlToContent` de `docx/html`. `<mark>` sale como resaltado amarillo de Word.
- **Guardar archivos en iPad**: se genera el archivo y luego un botón llama a `navigator.share({files})`. Tiene que ir en dos pasos porque Safari solo permite compartir dentro de un toque del usuario. Si no se puede compartir, se descarga.
- **Zoom de letra**: `attachPinch()`. En Safari usa los eventos `gesturestart/gesturechange/gestureend` (con `preventDefault` para que no se amplíe la página). En los demás navegadores usa dos toques con `touchmove`. Ctrl+rueda en ordenador. `captureAnchor/restoreAnchor` mantienen a la vista el párrafo que se estaba leyendo.
- **Citas bíblicas**: `enlazarCitas()` envuelve las citas en `<a class="bref">` solo al mostrar el lector; nunca se guardan en el documento. Exige «capítulo:versículo», salvo en libros de un capítulo («Judas 9»). Código del enlace: libro+capítulo(3)+versículo(3), p. ej. `19037004`; los rangos van con guion. Ajuste `settings.refLinks`: `app` | `web` | `off`.
- **Tiempo**: `item.target` = minutos de objetivo de cada discurso. Si algún título termina en «(N min)», el ritmo se calcula por partes; si no, se reparte el objetivo según las palabras. `palabraActual()` mira qué bloque cruza la línea a un tercio de la pantalla. Avisos: naranja cuando queda ≤ max(1 min, 10 %), rojo al pasarse. En modo atril (barra oculta) aparece un cronómetro flotante que pausa al tocarlo. Lectura estimada a 130 palabras/min.
- **Esquema**: botón del lector; muestra títulos y frases con `<mark>`. Tocar un punto vuelve al texto y lo resalta un momento.
- **Navegación**: rutas en el hash (`#/`, `#/leer/docs/<id>`, `#/editar/notes/<id>`). `route()` ignora navegaciones viejas (`routeSeq`) para que siempre gane la última.
- **Sin conexión**: `sw.js` precachea todos los archivos de `dist/` y sirve `index.html` en cualquier navegación. `_headers` (Netlify) evita que `sw.js` e `index.html` se queden en la caché del navegador.

## Reglas

- Pensada para iPad con Safari (iPadOS 15 o posterior) instalada en la pantalla de inicio. Prueba siempre con el viewport de iPad y con eventos táctiles.
- Botones táctiles de al menos 44 px, textos grandes y sin depender de pasar el ratón por encima.
- No usar `alert/confirm/prompt`: hay diálogos propios (`confirmDialog`, `promptDialog`, `actionSheet`).
- Nada de servidores ni de enviar datos fuera: los discursos y las notas no salen del dispositivo salvo que el usuario los comparta.
- Después de cambiar algo: `npm run build` y pasa las pruebas. Para publicar, haz push a `main`: `.github/workflows/publicar.yml` construye la app y la publica en GitHub Pages (`https://<usuario>.github.io/<repo>/`). Todas las rutas son relativas, así que funciona en una subcarpeta. Alternativa sin GitHub: subir `dist/` a Netlify (ver INSTRUCCIONES.md).

## Ideas pendientes (solo si las pide)

- Modo teleprompter con desplazamiento automático.
- Marcador de «voy por aquí» y resaltador de varios colores.
- Sincronizar iPad y móvil (necesitaría un servicio en la nube).
- Abrir .docx con "Abrir con…" desde Archivos (en iPad las PWA no lo permiten; requeriría app nativa).
