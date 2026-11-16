# Gestto

Herramienta de gestión de tiempo para estudios y proyectos. La app se llama **Hoja de carga de estudio**.

Planificador de estudio personal. Una IA estima las tareas de cada asignatura o proyecto, tú ajustas prioridades y tiempos, y la hoja reparte tus horas entre los días que tienes. Incluye un temporizador de sesión (hacer, revisar, descanso, pausa) y estadísticas de lo que estudias de verdad frente a lo previsto.

Es una app web sin compilación (HTML, CSS y JavaScript con módulos ES) que se instala como aplicación en Windows y en el iPhone. Con Firebase configurado, los datos se sincronizan entre dispositivos y funciona sin conexión.

## Probarla en local

Necesitas Node 20 o superior.

```bash
npm start      # sirve la carpeta en http://localhost:5173
npm test       # pruebas de la lógica (node --test)
```

También vale la extensión Live Server de VS Code. No se puede abrir `index.html` con doble clic: los módulos ES necesitan un servidor.

Sin configurar Firebase, la hoja guarda en el `localStorage` del navegador.

## Estructura

```
index.html              Página única y punto de montaje
css/base.css            Reset mínimo y márgenes seguros del iPhone
css/styles.css          Diseño: colores, tipografías, radios y controles propios
js/main.js              Arranque y registro del service worker
js/ui.js                Pantallas, eventos y guardado
js/controls.js          Controles propios (− +, opciones, fichas, bloques, interruptor,
                        calendario, desplegable y editor de franjas horarias)
js/logic.js             Lógica pura: lectura del texto de la IA, reparto, objetivos,
                        sesión y estadísticas. Sin DOM
js/storage.js           Dónde se guarda: artefacto de Claude, Firebase o localStorage
js/firebase-config.js   Configuración de Firebase (null = solo local)
js/prompt.js            Prompt que se copia para la IA
js/sample.js            Ejemplo: Estructuras (ETSIAE)
sw.js                   Service worker (app sin conexión)
manifest.webmanifest    Datos para instalarla como app
icons/                  Iconos
tests/                  Pruebas de logic.js
docs/                   Decisiones, formato de la IA y despliegue
firebase.json, firestore.rules   Hosting y reglas de seguridad de Firebase
```

## Documentación

- [docs/despliegue.md](docs/despliegue.md): configurar Firebase, publicarla e instalarla en el PC y el iPhone.
- [docs/decisiones.md](docs/decisiones.md): cómo debe comportarse la hoja. No se cambia sin preguntar.
- [docs/formato-ia.md](docs/formato-ia.md): formato `hoja-carga/1` del JSON que genera la IA.
- [docs/historial.md](docs/historial.md): de dónde viene y qué cambió en cada versión.
- [CLAUDE.md](CLAUDE.md): instrucciones para trabajar con Claude Code en este repositorio.
