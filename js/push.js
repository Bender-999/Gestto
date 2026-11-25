/* Avisos en este dispositivo (Web Push).
   Al activarlos, el navegador da una suscripción que se guarda en users/<uid>/disp/<id>.
   La función «avisos» (functions/index.js) manda a esas suscripciones los avisos de la cola.
   En el iPhone solo funcionan con La Hoja abierta desde el icono de la pantalla de inicio. */
import {VAPID_PUBLIC} from './firebase-config.js';

const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const key = s => {const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0))};
const reg = () => navigator.serviceWorker.getRegistration();

/* 'on', 'off', 'denied' (bloqueados en el sistema), 'install' (iPhone fuera de la app instalada)
   o 'no' (este navegador no puede). */
export async function pushState() {
  if (!VAPID_PUBLIC || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios() && !standalone() ? 'install' : 'no';
  if (Notification.permission === 'denied') return 'denied';
  const r = await reg(); if (!r) return 'no';
  return (await r.pushManager.getSubscription()) ? 'on' : 'off';
}

/* Hay que llamarla directamente desde un toque: el iPhone solo pide permiso así. */
export async function pushOn(db, dev) {
  const p = await Notification.requestPermission();
  if (p !== 'granted') return p === 'denied' ? 'denied' : 'off';
  const r = await navigator.serviceWorker.ready;
  const sub = (await r.pushManager.getSubscription()) || await r.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: key(VAPID_PUBLIC)});
  await saveSub(db, dev, sub);
  return 'on';
}
export async function pushOff(db, dev) {
  const r = await reg(), sub = r && await r.pushManager.getSubscription();
  if (sub) await sub.unsubscribe().catch(() => {});
  await db.doc('disp/' + dev).delete();
  return 'off';
}
/* Al abrir la app se vuelve a guardar: el navegador puede cambiar la suscripción. */
export async function pushRefresh(db, dev) {
  const r = await reg(), sub = r && await r.pushManager.getSubscription();
  if (sub) await saveSub(db, dev, sub);
}
function saveSub(db, dev, sub) {
  return db.doc('disp/' + dev).set({sub: JSON.parse(JSON.stringify(sub)), ua: navigator.userAgent.slice(0, 160), at: Date.now()});
}
