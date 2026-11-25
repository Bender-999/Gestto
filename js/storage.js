/* Dónde se guardan los datos.
   1. Dentro de Claude (artefacto publicado): la base de datos del artefacto.
   2. Con js/firebase-config.js relleno: Firestore, con caché sin conexión y cuenta de Google.
      Todo cuelga de users/<uid>/ con las mismas rutas: app/estado, asig/<id>, log/<AAAA-MM>.
   3. Si no hay nada de lo anterior: localStorage de este navegador.
   La interfaz que devuelve imita la del artefacto: db.doc(ruta).set/delete/onSnapshot y
   db.collection(nombre).onSnapshot, así ui.js no distingue entre las dos primeras. */
import {firebaseConfig} from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function openStore({onError} = {}) {
  if (window.claude && typeof window.claude.use === 'function') {
    try {const db = await window.claude.use('db'); if (db) return {kind: 'claude', db}} catch (e) {}
  }
  if (firebaseConfig && firebaseConfig.apiKey) {
    try {return await openFirebase(onError)} catch (e) {
      console.error(e);
      return {kind: 'local', warn: 'No se ha podido conectar con Firebase. Se guarda solo en este navegador.'};
    }
  }
  return {kind: 'local'};
}

async function openFirebase(onError) {
  const [{initializeApp}, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')
  ]);
  /* Publicada en Firebase Hosting, el inicio de sesión va por el mismo dominio de la app:
     Safari (iPhone) bloquea el almacenamiento de terceros y, si no, la redirección no vuelve. */
  const cfg = {...firebaseConfig};
  if (/\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) cfg.authDomain = location.hostname;
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.initializeFirestore(app, {localCache: F.persistentLocalCache({tabManager: F.persistentMultipleTabManager()})});
  await A.getRedirectResult(auth).catch(() => {});
  const user = await new Promise(res => {const off = A.onAuthStateChanged(auth, u => {off(); res(u)})});
  const login = async () => {
    const p = new A.GoogleAuthProvider();
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    try {if (standalone) await A.signInWithRedirect(auth, p); else {await A.signInWithPopup(auth, p); location.reload()}}
    catch (e) {await A.signInWithRedirect(auth, p)}
  };
  if (!user) return {kind: 'firebase', needLogin: true, login};
  const base = ['users', user.uid];
  /* Las escrituras no se esperan: Firestore las aplica al momento en la caché local y las sube
     cuando hay red. Si fallan (permisos, cuota) se avisa por onError. */
  const fail = e => {console.error(e); if (onError) onError(e)};
  const wrap = {
    doc: p => {
      const ref = F.doc(db, ...base, ...p.split('/'));
      return {
        set: d => {F.setDoc(ref, d).catch(fail); return Promise.resolve()},
        delete: () => {F.deleteDoc(ref).catch(fail); return Promise.resolve()},
        onSnapshot: (cb, err) => F.onSnapshot(ref, {includeMetadataChanges: true},
          s => cb({exists: s.exists(), data: () => s.data(), metadata: s.metadata}), err)
      };
    },
    collection: c => {
      const ref = F.collection(db, ...base, c);
      return {
        onSnapshot: (cb, err) => F.onSnapshot(ref, {includeMetadataChanges: true},
          q => cb({docs: q.docs.map(x => ({id: x.id, data: () => x.data()})), metadata: q.metadata}), err)
      };
    }
  };
  return {kind: 'firebase', db: wrap, user: {name: user.displayName || '', email: user.email || ''},
    logout: () => A.signOut(auth).then(() => location.reload())};
}
