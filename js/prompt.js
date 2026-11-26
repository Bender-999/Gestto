/* Prompt que la hoja copia para que una IA genere el JSON con formato hoja-carga/1. */
export const PROMPT=`Actúa como planificador de estudio. Con los materiales que te adjunto (temario, enunciados, exámenes o descripción del proyecto), genera un único bloque JSON con esta estructura exacta y sin texto alrededor.

{
  "formato": "hoja-carga/1",
  "asignatura": {
    "id": "identificador-corto",
    "nombre": "Nombre visible",
    "tipo": "asignatura o proyecto",
    "prioridad": "alta, media o baja",

    "fecha_limite": "AAAA-MM-DD o null",
    "empezar_antes": 14,

    "fechas_limite": [
      { "id": "parcial1", "nombre": "Parcial 1", "fecha": "AAAA-MM-DD", "empezar_antes": 21 },
      { "id": "final",    "nombre": "Final",     "fecha": "AAAA-MM-DD", "empezar_antes": 30 }
    ],

    "revision": true,
    "revision_reservada_pct": 0,
    "minimo_horas_dia": 0,
    "grupos": [
      {
        "id": "tema-1",
        "nombre": "Tema 1",
        "tipo": "ejercicios, examen o bloque",
        "prioridad": "alta",
        "frecuencia": "opcional, por ejemplo 8/10 exámenes",
        "simulacro": false,
        "limite_id": "parcial1",
        "tareas": [
          {
            "id": "t1-ej1",
            "nombre": "Ej 1",
            "detalle": "Qué hay que hacer, en una línea",
            "minutos": 30,
            "prioridad": "opcional, si difiere del grupo",
            "fecha_limite": "opcional",
            "limite_id": "parcial1",
            "depende_de": ["id de otra tarea"],
            "revision": true
          },
          {
            "id": "t1-lectura",
            "nombre": "Leer el capítulo 3",
            "detalle": "Sin tiempo total: un rato cada día hasta acabarla",
            "minutos_por_dia": 30,
            "desde": "opcional, AAAA-MM-DD"
          }
        ]
      },
      {
        "id": "seguimiento",
        "nombre": "Trabajo semanal",
        "tipo": "recurrente",
        "minutos_por_semana": 120,
        "minutos_por_bloque": 60,
        "limite_id": "final"
      },
      {
        "id": "repaso-diario",
        "nombre": "Repasar apuntes",
        "tipo": "diaria",
        "minutos_por_dia": 20,
        "detalle": "Leer y repasar los apuntes del día",
        "limite_id": "final"
      }
    ]
  }
}

Reglas:
- Usa fecha_limite (una sola fecha) o fechas_limite (varias). No uses las dos a la vez.
- fecha_limite y fechas_limite[].fecha es el día del examen o la entrega; el trabajo tiene que acabar antes.
- empezar_antes indica cuántos días antes de la fecha límite empieza a planificarse esa materia o grupo. 0 = desde ya.
- limite_id apunta al id de una de las fechas_limite. Si lo omites, se usa la primera fecha límite de la asignatura.
- Cada tarea lleva minutos (se hace una vez) o minutos_por_dia (tarea abierta), nunca los dos.
- minutos_por_dia es para tareas sin tiempo total claro: salen cada día de estudio con ese rato hasta que se marquen acabadas o llegue su fecha límite. desde, opcional, es el primer día. No llevan depende_de ni revision.
- minutos es el tiempo de hacer la tarea una vez, a mano y con la teoría ya vista. No incluye revisar. Sé realista y usa múltiplos de 5.
- Cada id usa minúsculas, números y guiones. No se repite y no cambia entre versiones: si actualizas una asignatura, conserva los id de las tareas que sigan.
- depende_de solo apunta a tareas de esta misma asignatura y nunca forma un círculo. Quita el campo si no hay dependencias.
- simulacro true hace que todas las tareas del grupo se hagan juntas el mismo día con un solo temporizador. Úsalo solo para exámenes completos.
- revision false indica que esa tarea no necesita fase de revisión.
- Usa el grupo recurrente solo para trabajo sin lista cerrada, y no le pongas tareas.
- El grupo diaria genera una tarea mínima cada día hasta que se marque como acabada o llegue su fecha límite. Es ideal para repasos diarios, práctica constante o proyectos con trabajo diario obligatorio.
- Ordena grupos y tareas en el orden lógico de trabajo.
- minimo_horas_dia es opcional: horas que quieres dedicarle cada día que estudies.
- Para definir varias asignaturas de golpe usa {"asignaturas": [ ... ]} en lugar de "asignatura". Una asignatura sin "grupos" queda en espera hasta que tenga tareas o una fecha cercana.
- Devuelve JSON válido, sin comentarios.`;
