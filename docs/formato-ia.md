# Formato del texto de la IA (`hoja-carga/1`)

La hoja lee un JSON con `"formato": "hoja-carga/1"`. El prompt completo está en `js/prompt.js`, y la propia hoja lo copia desde **+ Añadir › Copiar prompt**. Para varias asignaturas a la vez, usa `{"formato": "hoja-carga/1", "asignaturas": [ ... ]}`.

```json
{
  "formato": "hoja-carga/1",
  "asignatura": {
    "id": "estructuras", "nombre": "Estructuras", "tipo": "asignatura",
    "prioridad": "alta",
    "fechas_limite": [{"id": "final", "nombre": "Final", "fecha": "2027-01-20", "empezar_antes": 30}],
    "revision": true, "revision_reservada_pct": 10, "minimo_horas_dia": 1,
    "grupos": [
      {
        "id": "tema-1", "nombre": "Tema 1", "tipo": "ejercicios",
        "prioridad": "alta", "frecuencia": "8/10 exámenes", "limite_id": "final",
        "tareas": [
          {"id": "t1-ej1", "nombre": "Ej 1", "detalle": "Una línea", "minutos": 30,
           "prioridad": "media", "fecha_limite": "2027-01-10",
           "depende_de": ["t1-teoria"], "revision": true},
          {"id": "t1-lectura", "nombre": "Leer el capítulo 3",
           "minutos_por_dia": 30, "desde": "2026-12-01"}
        ]
      },
      {"id": "seguimiento", "nombre": "Trabajo semanal", "tipo": "recurrente",
       "minutos_por_semana": 120, "minutos_por_bloque": 60},
      {"id": "repaso", "nombre": "Repasar apuntes", "tipo": "diaria",
       "minutos_por_dia": 20, "detalle": "Repaso del día"}
    ]
  }
}
```

## Asignatura

| Propiedad | Obligatoria | Qué es |
|---|---|---|
| `id` | No (sale del nombre) | Identificador corto. No cambia entre versiones |
| `nombre` | Sí | Nombre visible |
| `tipo` | No | `asignatura` o `proyecto` |
| `prioridad` | No (media) | `alta`, `media`, `baja` o `fuera` |
| `fecha_limite` | No | Una sola fecha, `AAAA-MM-DD`: el día del examen o la entrega. El trabajo acaba el día anterior |
| `empezar_antes` | No | Con `fecha_limite`: días antes en que empieza a planificarse. 0 = desde ya |
| `fechas_limite` | No | Varias fechas: `[{id, nombre, fecha, empezar_antes}]`. No se usa junto a `fecha_limite` |
| `revision` | No (`true`) | Si las tareas tienen fase de revisión por defecto |
| `revision_reservada_pct` | No (0) | Porcentaje del tiempo que se reserva para revisar |
| `minimo_horas_dia` | No (0) | Horas mínimas cada día de estudio |
| `notas` | No | Texto libre |
| `grupos` | No | Lista de grupos. Sin grupos, la asignatura queda en espera |

## Grupo

| Propiedad | Para qué tipos | Qué es |
|---|---|---|
| `id`, `nombre` | Todos | Identificador y nombre visible |
| `tipo` | Todos | `ejercicios`, `examen` o `bloque` (con lista de tareas), `recurrente` o `diaria` |
| `prioridad` | Todos | Por defecto, la de la asignatura |
| `limite_id` | Todos | Id de una de `fechas_limite`. Si falta, se usa la primera |
| `fecha_limite` | Con tareas | Fecha límite propia del grupo |
| `frecuencia` | Con tareas | Texto informativo, por ejemplo «8/10 exámenes» |
| `simulacro` | Con tareas | `true`: todas las tareas el mismo día con un solo temporizador |
| `tareas` | Con tareas | Lista de tareas (abajo) |
| `minutos_por_semana`, `minutos_por_bloque` | `recurrente` | Trabajo semanal sin lista cerrada, en bloques |
| `minutos_por_dia`, `detalle` | `diaria` | Un rato cada día hasta marcar el grupo acabado o llegar a su fecha límite |

## Tarea

| Propiedad | Obligatoria | Qué es |
|---|---|---|
| `id` | No (sale del nombre) | Identificador. No cambia entre versiones: así se conserva el progreso |
| `nombre` | Sí | Nombre visible |
| `detalle` | No | Qué hay que hacer, en una línea |
| `minutos` | Una de las dos | Tiempo de hacerla una vez, sin revisar, en múltiplos de 5 |
| `minutos_por_dia` | Una de las dos | **Tarea abierta** (nueva en la 2.5): sin tiempo total, sale cada día de estudio con ese rato hasta que la marques acabada o llegue su fecha límite. En la sesión: «Por hoy» o «Acabada» |
| `desde` | No | Solo con `minutos_por_dia`: primer día, `AAAA-MM-DD` |
| `prioridad` | No | Si difiere de la del grupo |
| `fecha_limite` | No | Fecha límite propia |
| `limite_id` | No | Id de una de `fechas_limite` |
| `depende_de` | No | Ids de tareas de la misma asignatura que van antes. Nunca en círculo. No vale para tareas abiertas |
| `revision` | No | `false` si no necesita revisión. Las tareas abiertas no tienen |

## Reglas

- Los `id` usan minúsculas, números y guiones, no se repiten y no cambian entre versiones.
- Una tarea lleva `minutos` o `minutos_por_dia`, nunca los dos. Sin ninguno, el texto da error.
- Al reimportar se conserva el progreso por id de tarea y no se tocan las tareas añadidas a mano.

## Tareas añadidas a mano

No vienen del texto de la IA, pero se guardan igual en el grupo «Añadidas a mano» (`manual: true`). Se crean desde Plan › Añadir tarea, desde la ventana del día (quedan fijas en ese día, o empiezan ese día si son de cada día) y desde la sesión («Tarea fuera del plan»: solo ahora o varios días).

## Referencia de estimación (Estructuras, noviembre de 2026)

Los 25 ejercicios del Tema 1 sumaron 16 h 15, unos 39 min de media. Cada examen por problemas se estimó en 3 h con corrección. Sirven como referencia para estimar asignaturas parecidas.
