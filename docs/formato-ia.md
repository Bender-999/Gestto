# Formato del texto de la IA (`hoja-carga/1`)

La hoja lee un JSON con `"formato": "hoja-carga/1"`. El prompt completo está en `js/prompt.js`, y la propia hoja lo copia desde **+ Añadir › Copiar prompt**.

```json
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
        "id": "tema-1", "nombre": "Tema 1",
        "tipo": "ejercicios, examen o bloque",
        "prioridad": "alta", "frecuencia": "8/10 exámenes", "simulacro": false,
        "tareas": [
          { "id": "t1-ej1", "nombre": "Ej 1", "detalle": "Una línea", "minutos": 30,
            "prioridad": "opcional", "fecha_limite": "opcional",
            "depende_de": ["id de otra tarea"], "revision": true }
        ]
      },
      { "id": "seguimiento", "nombre": "Trabajo semanal", "tipo": "recurrente",
        "minutos_por_semana": 120, "minutos_por_bloque": 60 }
    ]
  }
}
```

## Reglas

- `fecha_limite` es el día del examen o la entrega. El trabajo acaba el día anterior.
- `minutos` es el tiempo de hacer la tarea una vez, sin revisar, en múltiplos de 5.
- Los `id` no cambian entre versiones: así se conserva el progreso al actualizar.
- `depende_de` solo apunta a tareas de la misma asignatura y nunca forma un círculo.
- `simulacro: true` agrupa todas las tareas del grupo en un mismo día con un solo temporizador.
- Para varias asignaturas a la vez, usa `{"asignaturas": [ ... ]}`. Una asignatura sin `grupos` queda en espera.

## Referencia de estimación (Estructuras, noviembre de 2026)

Los 25 ejercicios del Tema 1 sumaron 16 h 15, unos 39 min de media. Cada examen por problemas se estimó en 3 h con corrección. Sirven como referencia para estimar asignaturas parecidas.
