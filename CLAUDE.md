# CLAUDE.md

Guía para trabajar en este repositorio con Claude Code.

## Qué es

La Hoja de carga de estudio es un planificador personal de un único usuario, estudiante de Ingeniería Aeroespacial. Lo usa en Windows y en el iPhone y quiere los datos sincronizados entre los dos. Toda la interfaz está en español de España.

## Cómo trabajar

- **Pregunta antes de construir** si algo no está claro o toca una decisión de `docs/decisiones.md`. El usuario prefiere responder preguntas antes que rehacer trabajo.
- Prueba los cambios: `npm test` para la lógica y `npm start` para verla en `http://localhost:5173`.
- Antes de publicar, sube `VERSION` en `sw.js`. Si no, los dispositivos instalados siguen con la copia antigua.
- No añadas dependencias ni paso de compilación sin hablarlo. La app es HTML, CSS y módulos ES servidos tal cual.

## Arquitectura

- `js/logic.js` es lógica pura, sin DOM ni `window`: parseo del JSON de la IA (`parseText`), reparto (`allocate`), objetivos (`objectives`, `ladder`), propuestas (`proposeStretch`, `proposeNew`), sesión (`startDay`, `nextStep`, `goBreak`…) y estadísticas (`stats`). Todo lo nuevo de este tipo va aquí y con prueba en `tests/`.
- `js/ui.js` pinta con `render()` desde el estado `S` usando plantillas de texto y gestiona los eventos por delegación en `document`.
  - Un control que cambia un valor lleva `data-set="<clave>"`, `data-id` opcional y `data-val` ya calculado. Lo procesa `applySet(key, id, val, el)`. Para un ajuste nuevo, añade un `case` ahí.
  - `touch()` pinta y guarda con un pequeño retardo. `commit()` pinta y guarda al momento.
  - Escapa siempre el texto del usuario con `esc()`.
- `js/controls.js` tiene los controles propios: `stepper`, `seg`, `chips`, `blocks`, `toggle`, `datePick`, `menu` y `slotsTrack` (franjas horarias con arrastre y doble clic, enlazadas con `bindSlots`). **No uses controles nativos** (`select`, `input type=number/time/date`) en pantallas nuevas: al usuario no le encajan con la estética. Los textos libres (`input type=text`, `textarea`) sí valen.
- `js/storage.js` decide dónde se guarda. Las tres opciones exponen la misma interfaz: `db.doc(ruta).set/delete/onSnapshot` y `db.collection(nombre).onSnapshot`.

## Datos

Estado en memoria: `S = {app, subs, log}`. Se guarda en documentos:

| Ruta | Contenido |
|---|---|
| `app/estado` | `S.app`: días, horario, ajustes, sesión en curso (`run`) |
| `asig/<id>` | Una asignatura con su progreso (`done`, `real`, `mins`, `lvl`…) |
| `log/<AAAA-MM>` | `{segs: [...]}`, tramos del temporizador de ese mes |

En Firebase, todo cuelga de `users/<uid>/`.

Horario (versión 2 de `app`):
- `app.sched[0..6]` (lunes = 0) es `{slots: [{ini: 'HH:MM', fin: 'HH:MM'}]}`.
- Un día del calendario es `{d, h, slots?, auto?}`. Si tiene franjas, `h` se calcula de ellas.
- Las horas de estudio descuentan `app.brkH` minutos de descanso por hora: `studyHours`.

**Si cambias la forma de los datos guardados**, sube `app.v`, añade la conversión en `migrateApp` (que debe poder ejecutarse dos veces sin cambiar nada) y una prueba. La v1 tenía una sola franja por día (`sched[i] = {on, ini, fin}` y `day.ini/fin`).

## Estilo

- Las variables de color, tipografía y radio están en `:root` de `css/styles.css` y hay modo oscuro automático. Usa siempre las variables.
- Radios: `--r-s` 8 px, `--r` 12 px, `--r-l` 18 px y `--r-xl` 26 px. Píldoras con 999 px. Nada cuadrado.
- Tipografías: Barlow Condensed para títulos y cifras grandes, IBM Plex Sans para el texto e IBM Plex Mono para los datos.
- Zonas táctiles de 40 a 44 px como mínimo. Comprueba la pantalla a 390 px de ancho.
- Textos: frases cortas, sin jerga, en español de España.
