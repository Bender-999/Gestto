# Publicación: Firebase, PC e iPhone

La Hoja está publicada en **https://la-hoja-15712.web.app** (proyecto de Firebase `la-hoja-15712`).

- **Datos**: Firestore (edición Standard, `europe-southwest1`). Todo cuelga de `users/<uid>/` y las reglas de `firestore.rules` solo dejan a cada cuenta leer y escribir lo suyo.
- **Cuenta**: inicio de sesión con Google.
- **Configuración**: `js/firebase-config.js`. Los valores no son secretos.

## Cómo se publica

- **Subir a `main` publica solo.** El flujo `.github/workflows/firebase-hosting-merge.yml` pasa las pruebas, pone una versión nueva al service worker y sube la app. Tarda uno o dos minutos. Si las pruebas fallan, no se publica.
- **Cada solicitud de cambios tiene una dirección de pruebas** que dura 7 días. GitHub la deja como comentario en la solicitud. En esa dirección no se puede entrar con Google, porque el dominio no está autorizado, así que guarda solo en el navegador. Sirve para ver cambios, no para usar tus datos.
- **Las reglas de Firestore no se publican solas.** Si cambias `firestore.rules`, publícalas con `npx firebase-tools deploy --only firestore:rules`.

## Puesta en marcha (una sola vez)

Desde la carpeta del repositorio, con la rama que trae esta configuración:

```bash
npx firebase-tools login
npx firebase-tools deploy
npx firebase-tools init hosting:github
```

1. `login` abre el navegador para entrar con tu cuenta de Google.
2. `deploy` sube las reglas de Firestore y la primera versión de la app.
3. `init hosting:github` conecta GitHub con Firebase y guarda en el repositorio el secreto `FIREBASE_SERVICE_ACCOUNT_LA_HOJA_15712`. A sus preguntas:
   - Repositorio: `Bender-999/Gestto`.
   - Script de compilación antes de publicar: **No**.
   - Publicar al fusionar en la rama principal: **Sí**, rama `main`.
   - Si pregunta si sobrescribe los archivos de `.github/workflows`, da igual lo que respondas: los suyos y los nuestros hacen lo mismo.

### Inicio de sesión en el iPhone

En la app publicada, el inicio de sesión va por el propio dominio (`la-hoja-15712.web.app`), porque Safari bloquea el almacenamiento de terceros. Para que Google acepte ese dominio:

1. Entra en [Google Cloud › APIs y servicios › Credenciales](https://console.cloud.google.com/apis/credentials?project=la-hoja-15712).
2. Abre el cliente «Web client (auto created by Google Service)».
3. En **URI de redireccionamiento autorizados**, añade `https://la-hoja-15712.web.app/__/auth/handler` y guarda.

Más detalle: [Best practices for using signInWithRedirect](https://firebase.google.com/docs/auth/web/redirect-best-practices).

## Avisos de la sesión (una sola vez)

Los avisos de la pantalla de bloqueo («Toca descanso», «Tiempo cumplido», «Se acabó el descanso») los manda la función `avisos` de `functions/index.js`. Corre cada minuto en Cloud Functions, mira la cola `users/<uid>/aviso/cola` que deja la app y manda lo que toca a los dispositivos de `users/<uid>/disp/`.

1. **Plan Blaze.** Cloud Functions pide el plan de pago por uso: consola de Firebase › Uso y facturación › Modificar plan › Blaze. Hay que poner una tarjeta, pero con este uso entra en la parte gratuita (unas 43 000 ejecuciones al mes de 2 millones gratis y un solo trabajo programado de 3 gratis). Pon una alerta de presupuesto de 1 € para quedarte tranquilo.
2. **Clave privada de los avisos.** No está en el repositorio. Guárdala como secreto:
   ```bash
   npx firebase-tools functions:secrets:set VAPID_PRIVATE
   ```
   y pega la clave cuando la pida. La pública está en `js/firebase-config.js` y en `functions/index.js`: si cambias una, cambia las dos.
3. **Publicar la función y el índice:**
   ```bash
   cd functions && npm install && cd ..
   npx firebase-tools deploy --only functions,firestore
   ```
   Si pregunta por activar servicios de Google Cloud, di que sí. Si pregunta cuántos días guardar las imágenes de la función, pon 1.
4. **En cada dispositivo**, abajo del todo: «Activar avisos de la sesión en este dispositivo» y luego «Probar». El aviso de prueba llega en un minuto como mucho. En el iPhone hay que abrir La Hoja desde el icono de la pantalla de inicio (iOS 16.4 o posterior); en Safari normal no se puede.

La función no se publica sola con `main`: si cambias `functions/`, vuelve a ejecutar el paso 3. Los registros están en la consola de Firebase › Functions › avisos › Registros.

## Instalarla

- **Windows (Edge o Chrome)**: abre https://la-hoja-15712.web.app y pulsa el icono de instalar de la barra de direcciones (o Menú › Aplicaciones › Instalar esta página como aplicación). Queda en el menú Inicio y se puede anclar a la barra de tareas.
- **iPhone (Safari)**: abre la dirección y pulsa Compartir › **Añadir a pantalla de inicio**.

En cada dispositivo, pulsa **Entrar con Google** la primera vez.

## Probar en local

`npm start` y abre http://localhost:5173. En local el inicio de sesión usa una ventana emergente y guarda en la misma base de datos que la app publicada, así que lo que hagas en local con tu cuenta también se ve en el móvil.
