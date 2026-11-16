/* Punto de entrada: arranca la interfaz y registra el service worker para que la hoja
   se pueda instalar como app (Windows, iPhone) y abrir sin conexión. */
import {start} from './ui.js';

start();

/* Dentro de un iframe (vista previa en Claude) no se registra. */
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker:', e));
}
