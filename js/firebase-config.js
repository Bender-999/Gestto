/* Configuración de Firebase.
   Mientras valga null, la hoja guarda solo en este navegador (localStorage).
   Para sincronizar entre el PC y el iPhone, sigue docs/despliegue.md y pega aquí el objeto
   que da la consola de Firebase (Configuración del proyecto › Tus apps › SDK setup and configuration).
   Estos valores no son secretos: quien protege los datos son las reglas de firestore.rules.

   Ejemplo:
   export const firebaseConfig = {
     apiKey: '...',
     authDomain: 'tu-proyecto.firebaseapp.com',
     projectId: 'tu-proyecto',
     storageBucket: 'tu-proyecto.appspot.com',
     messagingSenderId: '...',
     appId: '...'
   };
*/
export const firebaseConfig = null;
