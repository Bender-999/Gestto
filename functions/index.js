/* Avisos de la sesión.
   La app deja en users/<uid>/aviso/cola la lista de avisos que vienen ({items, next}), y en
   users/<uid>/disp/<id> la suscripción de cada dispositivo que los ha activado.
   Cada minuto esta función busca los avisos que ya tocan y los manda a todos los dispositivos.
   Lo enviado se apunta en «sent» para no repetirlo si la app reescribe la lista. */
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();
const VAPID_PRIVATE = defineSecret('VAPID_PRIVATE');
const VAPID_PUBLIC = 'BCc9Hq_bd6rMxPaoypMGaf9aZ03OESqFkSfw7Y6F62CGP-bbP89_KJ6OvC3JHMSsXf3TkZxqTevO7fX_9QBhoFk';
const STALE = 10 * 60000; // Un aviso con más de 10 min de retraso ya no se manda.

exports.avisos = onSchedule({schedule: 'every 1 minutes', region: 'europe-west1', timeZone: 'Europe/Madrid', secrets: [VAPID_PRIVATE], memory: '256MiB', maxInstances: 1}, async () => {
  webpush.setVapidDetails('https://la-hoja-15712.web.app', VAPID_PUBLIC, VAPID_PRIVATE.value());
  const db = admin.firestore(), now = Date.now();
  const q = await db.collectionGroup('aviso').where('next', '<=', now).get();
  for (const doc of q.docs) {
    const userRef = doc.ref.parent.parent;
    const due = await db.runTransaction(async tx => {
      const s = await tx.get(doc.ref), d = s.data() || {}, items = d.items || [], sent = d.sent || [];
      const go = items.filter(x => x.at <= now && x.at > now - STALE && !sent.includes(x.id));
      const gone = items.filter(x => x.at <= now).map(x => x.id);
      const left = items.filter(x => x.at > now && !sent.includes(x.id));
      tx.update(doc.ref, {sent: [...new Set([...sent, ...gone])].slice(-40), next: left.length ? Math.min(...left.map(x => x.at)) : null});
      return go;
    });
    if (!due.length) continue;
    const subs = await userRef.collection('disp').get();
    for (const it of due) {
      const body = JSON.stringify({title: it.title, body: it.body, tag: it.kind || 'la-hoja'});
      await Promise.all(subs.docs.map(s => webpush.sendNotification(s.data().sub, body, {TTL: 600, urgency: 'high'}).catch(e => {
        if (e.statusCode === 404 || e.statusCode === 410) return s.ref.delete(); // El dispositivo ya no está suscrito.
        console.error('Aviso no enviado', e.statusCode, e.body);
      })));
    }
  }
});
