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
        "tareas": [
          {
            "id": "t1-ej1",
            "nombre": "Ej 1",
            "detalle": "Qué hay que hacer, en una línea",
            "minutos": 30,
            "prioridad": "opcional, si difiere del grupo",
            "fecha_limite": "opcional",
            "depende_de": ["id de otra tarea"],
            "revision": true
          }
        ]
      },
      {
        "id": "seguimiento",
        "nombre": "Trabajo semanal",
        "tipo": "recurrente",
        "minutos_por_semana": 120,
        "minutos_por_bloque": 60
      }
    ]
  }
}

Reglas:
- fecha_limite es el día del examen o la entrega. El trabajo tiene que acabar antes de ese día.
- minutos es el tiempo de hacer la tarea una vez, a mano y con la teoría ya vista. No incluye revisar. Sé realista y usa múltiplos de 5.
- Cada id usa minúsculas, números y guiones. No se repite y no cambia entre versiones: si actualizas una asignatura, conserva los id de las tareas que sigan.
- depende_de solo apunta a tareas de esta misma asignatura y nunca forma un círculo. Quita el campo si no hay dependencias.
- simulacro true hace que todas las tareas del grupo se hagan juntas el mismo día con un solo temporizador. Úsalo solo para exámenes completos.
- revision false indica que esa tarea no necesita fase de revisión.
- Usa el grupo recurrente solo para trabajo sin lista cerrada, y no le pongas tareas.
- Ordena grupos y tareas en el orden lógico de trabajo.
- minimo_horas_dia es opcional: horas que quieres dedicarle cada día que estudies.
- Para definir varias asignaturas de golpe usa {"asignaturas": [ ... ]} en lugar de "asignatura". Una asignatura sin "grupos" queda en espera hasta que tenga tareas o una fecha cercana.
- Devuelve JSON válido, sin comentarios.`;
