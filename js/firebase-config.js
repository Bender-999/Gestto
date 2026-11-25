/* Configuración de Firebase del proyecto la-hoja-15712.
   Estos valores no son secretos: quien protege los datos son las reglas de firestore.rules
   (cada cuenta solo lee y escribe lo suyo). Con null, la app guarda solo en el navegador.
   En la app publicada, storage.js usa como authDomain el propio dominio (la-hoja-15712.web.app)
   para que el inicio de sesión funcione en el iPhone. */
export const firebaseConfig = {
  apiKey: 'AIzaSyCdKT4tSKo7FVrnkuykd5485AknauCU92U',
  authDomain: 'la-hoja-15712.firebaseapp.com',
  projectId: 'la-hoja-15712',
  storageBucket: 'la-hoja-15712.firebasestorage.app',
  messagingSenderId: '1000721125440',
  appId: '1:1000721125440:web:047375f7c2086ec22c4fa5'
};
