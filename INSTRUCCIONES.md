# Atril: cómo ponerla en tu iPad

Atril es tu app para leer discursos con letra grande, retocarlos y tomar notas. Es gratis, funciona sin internet y todo se guarda en tu iPad.

## 1. Publicarla

La app se publica sola en GitHub Pages cada vez que hay cambios en GitHub (archivo `.github/workflows/publicar.yml`). La dirección queda así: `https://TU-USUARIO.github.io/atril/`.

La dirección es pública, pero solo contiene la app vacía: tus discursos y notas nunca salen de tu iPad.

*Alternativa sin GitHub:* ejecuta `npm install` y `npm run build`, entra en https://app.netlify.com/drop, arrastra la carpeta `dist` y reclama el sitio en menos de una hora.

## 2. Instalarla en el iPad

1. Abre esa dirección en **Safari** (tiene que ser Safari).
2. Toca **Compartir** (el cuadrado con la flecha hacia arriba) → **Añadir a pantalla de inicio** → **Añadir**.
3. Ábrela desde el icono nuevo. La primera vez, con internet. A partir de ahí funciona también sin conexión.

## 3. Cómo se usa

**Discursos**
- **Abrir Word**: eliges un .docx desde Archivos, iCloud, OneDrive o el correo (guardado antes en Archivos).
- **Leer**: separa dos dedos sobre el texto para agrandar la letra y pellízcalo para achicarla. El texto se recoloca solo, como en una web de móvil.
- **Un toque en el texto** oculta la barra de arriba para tener toda la pantalla. Otro toque la devuelve.
- **T**: tamaño, tema (claro, sepia u oscuro), tipo de letra e interlineado.
- **Cronómetro**: tócalo para empezar o pararlo. Con la flecha circular vuelve a cero.
- La pantalla no se apaga mientras lees (se puede desactivar en Ajustes).
- **Lápiz**: editar. Se guarda solo mientras escribes.
- **⋯ → Guardar como Word**, y luego **Guardar en Archivos** (o mandarlo por correo o WhatsApp).

**Notas**
- **Nueva nota**: título y texto. Se guarda sola.
- Para pasármelas: **⋯ → Compartir el texto** y eliges la app de Claude, o **Copiar el texto** y lo pegas en el chat.
- También puedes guardarla como Word directamente.

**Copia de seguridad** (rueda dentada → Hacer copia de seguridad)
Haz una de vez en cuando y guárdala en Archivos o iCloud. **Si borras el icono de la app, se borran sus datos**, y con la copia los recuperas (Restaurar una copia).

## 4. Cuando haya una versión nueva

Cada cambio que se sube a GitHub se publica solo en unos minutos. Al abrir Atril en el iPad saldrá «Hay una versión nueva» → **Actualizar**. Tus datos no se tocan.

## 5. Seguir mejorándola con Claude Code en tu PC

1. El proyecto está en `C:\Users\ermak\Proyectos\Atril`.
2. En PowerShell, dentro de esa carpeta: `npm install` y luego `claude`.
3. Pídele lo que quieras («añade un modo teleprompter», por ejemplo). El archivo CLAUDE.md le explica cómo está hecha.
4. Cuando funcione, que lo suba a GitHub (`git push`) y se publica solo.
