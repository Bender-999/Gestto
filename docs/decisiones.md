# Decisiones tomadas

Estas respuestas las dio el usuario. No se cambian sin preguntarle.

| Tema | Decisión |
|---|---|
| Revisión | Cronómetro hacia arriba sin tiempo objetivo. Cuenta como estudio, pero el plan no le reserva tiempo, salvo el % opcional por asignatura |
| Tiempo agotado | La cuenta atrás sigue en negativo, sin sonido |
| Exámenes | Problema a problema, salvo los marcados como simulacro, que van enteros con un solo temporizador |
| Entrada de la IA | Copiar y pegar un JSON con formato fijo (`hoja-carga/1`) |
| Reparto | Dos modos: prioridad y fecha, o porcentajes por día (lo libre se reparte entre las demás). Las tareas siempre se ordenan por prioridad |
| Mínimos diarios | Se cubren primero y el resto va según el modo. Si no caben en un día, solo se avisa y ese día no se aplican |
| Bloques | Una asignatura por bloque al día, las más importantes antes, sin intercalar salvo cambio manual |
| Fin de bloque | Si una tarea queda a medias y queda día, el bloque se alarga hasta acabarla |
| Horario | Se rellenan los días que se marcan, editables uno a uno. Se descuentan minutos de descanso por hora de estudio |
| Botón de parada | Parar abre Pausa o Acabar día. La pausa no cuenta como estudio ni como descanso |
| En espera | Una asignatura entra en el plan si tiene tareas o si su fecha está a menos de 30 días (editable). Con fecha cercana y sin tareas, avisa |
| Tareas manuales | Desde Plan, con minutos aproximados. Desde Sesión, sin minutos: cuenta lo que tardes como estudio de esa asignatura |
| Reimportar | Actualiza conservando el progreso por id de tarea y no toca las tareas manuales |
| Uso | Solo para el usuario, sincronizado entre sus dispositivos (Windows e iPhone) |
| Sesión con varias asignaturas | Primero una asignatura y luego otra, sin saltar entre ellas |

## Añadidas en la versión 2 (16 de noviembre de 2026)

| Tema | Decisión |
|---|---|
| Plataforma | App web instalable (PWA) en Windows y en el iPhone, con los datos sincronizados |
| Sincronización | Firebase (Firestore y cuenta de Google). Se descartaron Google Drive y OneDrive porque guardan archivos enteros y el móvil y el PC se pisarían |
| Estética | Se mantienen la paleta y las tipografías. Todo redondeado: «tan cuadrado se ve antiguo» |
| Controles | Nada de desplegables, campos numéricos ni selectores de hora nativos. Se usan botones − y +, fichas, bloques, interruptores, un calendario y un desplegable propios |
| Horario | Varias franjas por día. Doble clic en un hueco añade una franja, arrastrar la mueve y los bordes la alargan. Doble clic sobre una franja abre sus horas de estudio en hh:mm, donde también se borra. Sin botones de inicio y fin |
| Marcar hecha a mano | Desde la ventana del día se elige qué día se hizo: hoy, el día planificado, ayer u otro día |
| Mover tareas | «Mover» fija la tarea en otro día de estudio: el plan la respeta y reparte lo demás alrededor; si no cabe entera, lo que sobra va al siguiente hueco. «Soltar» la devuelve al reparto automático. Dentro de un día se reordena arrastrando, y se puede intercalar asignaturas |
| Selección múltiple | En la ventana del día, la lista lleva cabeceras por asignatura y por grupo con su casilla. Se entra en selección con «Seleccionar» o manteniendo pulsada una tarea. Con varias seleccionadas: marcarlas hechas (eligiendo el día), moverlas a otro día, soltar su fijación o arrastrarlas juntas como un bloque |
| Versión simplificada | Para el móvil, con un interruptor manual por dispositivo («Usar la versión simplificada en este dispositivo» / «Versión completa»). Muestra un solo día por página (‹ ›, deslizar, «Volver a hoy»), en general y sin separar por asignaturas en la navegación, con un botón grande «Empezar sesión». Desde el día se marcan, mueven y reordenan tareas como en la ventana del día del PC |
| Sesión simplificada | Tarea actual, temporizador grande y botones grandes: Tarea hecha (o Hecha: a revisar), Descanso y Parar. Tarea fuera del plan, Quitar 5 min y Cambiar de tarea van en «Más» |
| Resumen del día | Al acabar el día: estudio real frente a previsto, descansos y pausas, bloque más largo, reparto por asignatura y tareas hechas con lo que tardaste frente a lo estimado. También se abre desde cualquier día pasado |
| Gráfico de días | 3, 7, 10 o 14 días (se recuerda en cada dispositivo), botones ‹ Hoy › con animación y sin barra de desplazamiento. Meses separados con su nombre, hoy remarcado, fines de semana sombreados, hueco libre rayado, nombre de la asignatura en cada tramo y una sola cifra por día. Tocar un día abre su ventana |
| Nombre | La app se llama **La Hoja**. El repositorio es Gestto |
| Tus días | Sin lista de días: solo el calendario. Un clic añade o quita el día, dejar el cursor encima (o mantener pulsado en el móvil) muestra su ficha (horas, franjas, plan por asignatura y fechas límite) y doble clic abre una ventana para editar sus franjas |
| Día con franjas | El nombre del día se rellena en oscuro. Si se quitan todas las franjas, el día pasa a «Libre» |
