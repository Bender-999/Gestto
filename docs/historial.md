# Historial

## Origen (noviembre de 2026)

Empezó el 3 de noviembre de 2026 como un plan para preparar el examen de Estructuras (Tema 1, ETSIAE) y acabó siendo un planificador general para varias asignaturas y proyectos, publicado como artefacto en Claude.

1. Estimación de 25 ejercicios y balance frente a 4 tardes de 4 h 30 y un día de 8 h.
2. Configuración de días con calendario, prioridades y propuestas de cuántas horas añadir y dónde.
3. Sesión con temporizador (hacer, revisar, descanso) y página de datos.
4. Hoja genérica: asignaturas cargadas desde un JSON que genera una IA, con sección por asignatura y una general.
5. Horario habitual, mínimos diarios, bloques sin intercalar, pausa, tareas manuales y asignaturas en espera.
6. Gráfico de cabecera con una columna por día y el reparto por asignatura.

## Versión 2.2 (25 de noviembre de 2026)

- Gráfico de días nuevo: 3, 7, 10 o 14 días, botones con animación, meses separados, hoy y fines de semana visibles, hueco libre rayado y nombres en los tramos.
- Ventana del día al tocar una columna: marcar hecha eligiendo el día, reordenar arrastrando y mover a otro día (la tarea queda fija).
- Al arrastrar, la tarea sigue al cursor y un hueco punteado marca dónde caerá.
- Selección múltiple con cabeceras por asignatura y grupo: marcar hechas, mover, soltar y arrastrar en bloque.
- Datos: `app.v` 3 con `app.dord`, y `pin` en cada asignatura.

## Publicación (25 de noviembre de 2026)

- Firebase configurado (proyecto `la-hoja-15712`): datos sincronizados con la cuenta de Google.
- Publicación automática en https://la-hoja-15712.web.app al subir a `main` y dirección de pruebas para cada solicitud de cambios.

## Versión 2.0.1 (16 de noviembre de 2026)

- La app pasa a llamarse **La Hoja**. El formato de la IA (`hoja-carga/1`) y la clave de los datos no cambian.

## Versión 2.0.0 (16 de noviembre de 2026)

- Repositorio propio: código separado en módulos (`logic`, `ui`, `controls`, `storage`), pruebas con `node --test` y documentación.
- App instalable (PWA) en Windows y en el iPhone, con service worker para funcionar sin conexión.
- Guardado preparado para Firebase (Firestore y Google) para sincronizar dispositivos. Sin configurar, guarda en el navegador.
- Estética redondeada y controles propios en lugar de desplegables, campos numéricos y selectores de hora nativos: botones − y +, barras de opciones, fichas, bloques, interruptores, un calendario y un desplegable.
- Horario con varias franjas por día: se añaden con doble clic, se arrastran y se estiran por los bordes, y sus horas de estudio se escriben en hh:mm. Los días del calendario también tienen franjas, que se editan en una ventana con doble clic.
- «Tus días» sin lista: calendario grande con ficha de cada día al dejar el cursor encima o mantenerlo pulsado.
- Migración automática de los datos de la v1 (una sola franja por día).

## Puntos débiles conocidos

- El temporizador sigue contando con la página cerrada. Si se apaga sin pulsar Parar, ese tiempo cuenta como estudio. Se corrige con «Quitar 5 min» o cerrando la sesión sin el último tramo.
- La revisión no reserva tiempo, así que el plan se queda corto al revisar. Se compensa con «Corregir lo que queda con mi ritmo real» o con el % de revisión por asignatura.
- Las dependencias solo funcionan dentro de una asignatura.
- Una tarea que desaparece del texto al reimportar deja de salir en el plan aunque estuviera hecha.
- Sin fecha límite, la propuesta de añadir días mira 60 días hacia delante.
- No se ha probado a fondo el guardado con muchas sesiones. Conviene revisar Mis datos tras los primeros días de uso.
