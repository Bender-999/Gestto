# CLAUDE.md

Guía para trabajar en este repositorio con Claude Code.

## Qué es

La Hoja (antes «Hoja de carga de estudio») es un planificador personal de un único usuario, estudiante de Ingeniería Aeroespacial. Lo usa en Windows y en el iPhone y quiere los datos sincronizados entre los dos. Toda la interfaz está en español de España.

## Cómo trabajar

- **Pregunta antes de construir** si algo no está claro o toca una decisión de `docs/decisiones.md`. El usuario prefiere responder preguntas antes que rehacer trabajo.
- Prueba los cambios: `npm test` para la lógica y `npm start` para verla en `http://localhost:5173`.
- **Subir a `main` publica la app** en https://la-hoja-15712.web.app (GitHub Actions + Firebase Hosting). La versión de `sw.js` se pone sola en cada publicación. Trabaja en una rama y abre una solicitud de cambios: tendrá su propia dirección de pruebas. Detalles en `docs/despliegue.md`.
- `firestore.rules` no se publica sola: tras cambiarla, `npx firebase-tools deploy --only firestore:rules`.
- El identificador del formato de la IA (`hoja-carga/1`) y la clave de `localStorage` (`hoja-carga`) se quedan como están aunque la app se llame La Hoja: cambiarlos rompería los datos y los textos ya generados.
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

Plan a mano (versión 3 de `app`):
- `asig/<id>.pin[claveTarea] = 'AAAA-MM-DD'`: tarea fijada a un día con «Mover». `allocate` la coloca ahí antes que nada; si el día ya pasó o está cerrado, se ignora. Funciones: `pinTask`.
- `app.dord['AAAA-MM-DD'] = [claves]`: orden puesto a mano dentro de un día. Funciones: `setDayOrder`.
- Al marcar una tarea hecha desde la ventana del día, el usuario elige qué día la hizo (`markDone` con ese día).
- Gráfico de días: cuántos días se ven se guarda por dispositivo en `localStorage` (`la-hoja-ui`).

Tareas de cada día (abiertas):
- Una tarea con `minDia` (y `desde` opcional) en vez de `min`. En el texto de la IA: `minutos_por_dia` y `desde`.
- `buildItems` saca una tarea por día de estudio con clave `<sid>/<id>@AAAA-MM-DD`, `open: true` y `taskKey: '<sid>/<id>'`. «Por hoy» marca `done` de la del día; «Acabada» (`closeOpen`, `finishOpen`) marca también `done[taskKey]` y deja de salir. `unmarkDone` la reabre. `startOpen` la crea desde la sesión.
- Campo nuevo y opcional: no hace falta conversión ni subir `app.v`.

Versión simplificada (móvil):
- Se activa por dispositivo con `uiPref.simple` (también en `la-hoja-ui`). `render()` llama a `renderSimple` y oculta la versión completa.
- Pantallas según `sp`: `'dia'` (`renderSimpleDay`, usa `dayView` y la lista de `dayViewModal(al, true)`), `'sesion'` (`renderSimpleSession`, mismos `data-act` que la sesión completa) y `'resumen'` (`renderSimpleSummary`, con `dayStats` de `logic.js` y las gráficas de `stChart`).
- Cambiar de día: `spGo`, botones `data-spgo` y deslizar (eventos táctiles).

Sesión y avisos:
- `#runbar` (`renderRunbar` en `ui.js`): barra fija abajo mientras hay `S.app.run` y no se está en la pantalla de sesión. Usa los mismos `data-act`; `data-runbar` abre la sesión. `tick()` actualiza `#rbT`.
- `alerts(S)` en `logic.js` calcula los avisos que vienen en la fase actual (`BRK_EVERY` 50 min, `BRK_LEN` 10 min). Solo depende del estado.
- Los avisos salen solo con la app abierta: `tick()` llama a `checkAlerts`, que muestra `showToast` y, si la app no está a la vista y hay permiso (`uiPref.notif`), la notificación del sistema. No hay servidor: se descartó Web Push por necesitar el plan Blaze.
- `sw.js` abre la app al tocar una notificación.

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
