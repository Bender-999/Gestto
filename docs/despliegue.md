# Despliegue: Firebase, PC e iPhone

Objetivo: que la hoja esté publicada en una dirección propia, se instale como app en Windows y en el iPhone y guarde los datos en tu cuenta para que los dos dispositivos vean lo mismo.

Todo cabe en el plan gratuito de Firebase (Spark) para un solo usuario.

## 1. Crear el proyecto de Firebase

1. Entra en [console.firebase.google.com](https://console.firebase.google.com) con tu cuenta de Google y crea un proyecto (por ejemplo, `hoja-carga`). Google Analytics no hace falta.
2. **Authentication › Método de inicio de sesión**: activa **Google**.
3. **Firestore Database › Crear base de datos**: elige el modo de producción y una ubicación en Europa (`europe-southwest1`, que es Madrid, o `eur3`). La ubicación no se puede cambiar después.
4. **Configuración del proyecto › General › Tus apps**: añade una app **Web** (icono `</>`), con el alias que quieras. No hace falta marcar Hosting en este paso.
5. Copia el objeto `firebaseConfig` que aparece y pégalo en `js/firebase-config.js` en lugar de `null`:

```js
export const firebaseConfig = {
  apiKey: '...',
  authDomain: 'hoja-carga.firebaseapp.com',
  projectId: 'hoja-carga',
  storageBucket: 'hoja-carga.appspot.com',
  messagingSenderId: '...',
  appId: '...'
};
```

Estos valores no son secretos y se pueden subir al repositorio. Quien protege los datos son las reglas de `firestore.rules`: cada usuario solo lee y escribe lo suyo.

## 2. Publicar

Desde la carpeta del repositorio:

```bash
npx firebase-tools login
npx firebase-tools use --add          # elige el proyecto y ponle el alias "default"
npx firebase-tools deploy             # sube la app (Hosting) y las reglas de Firestore
```

Al terminar te da la dirección, del tipo `https://hoja-carga.web.app`. Para siguientes versiones basta con `npm run deploy`. **Antes de cada publicación, sube `VERSION` en `sw.js`.**

## 3. Instalarla

**Windows (Edge o Chrome)**: abre la dirección, pulsa el icono de instalar de la barra de direcciones (o Menú › Aplicaciones › Instalar esta página como aplicación). Queda con su icono en el menú Inicio y se abre en una ventana propia.

**iPhone (Safari)**: abre la dirección, pulsa Compartir › **Añadir a pantalla de inicio**. Se abre a pantalla completa, sin la barra de Safari.

En cada dispositivo, pulsa **Entrar con Google** la primera vez. A partir de ahí los cambios se sincronizan solos y, sin conexión, se guardan y suben al volver la red.

## 4. Si el inicio de sesión falla en el iPhone

Safari bloquea el almacenamiento de terceros, y el inicio de sesión por redirección necesita que la app y el dominio de autenticación sean el mismo. Si al volver de Google sigue pidiendo entrar:

1. En `js/firebase-config.js`, cambia `authDomain` por el dominio donde está publicada la app (por ejemplo, `hoja-carga.web.app`).
2. En [Google Cloud › APIs y servicios › Credenciales](https://console.cloud.google.com/apis/credentials), abre el cliente OAuth web que creó Firebase y añade en «URI de redireccionamiento autorizados» `https://hoja-carga.web.app/__/auth/handler`.
3. Comprueba que el dominio aparece en Firebase › Authentication › Configuración › Dominios autorizados.
4. Publica de nuevo.

Más detalle: [Best practices for using signInWithRedirect](https://firebase.google.com/docs/auth/web/redirect-best-practices).

## 5. Pasar datos de la versión anterior

Si tienes datos en la hoja publicada en Claude o en el `localStorage` de un navegador, la hoja los convierte sola al formato nuevo (`migrateApp` en `js/logic.js`). Para pasarlos a Firebase, la forma más sencilla es exportar cada asignatura con **Copiar texto actual** y pegarla en la versión nueva con **+ Añadir**. El progreso marcado no viaja con el texto.

## Notas

- La versión del SDK de Firebase está fijada en `js/storage.js` (`FB`). Se puede actualizar cambiando el número.
- Sin `firebase-config.js`, la app funciona igual, pero guarda solo en el navegador donde la abras.
