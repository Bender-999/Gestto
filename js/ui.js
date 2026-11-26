/* Interfaz de La Hoja.
   Todo se pinta con render() a partir del estado S y se maneja con delegación de eventos:
   - data-set / data-id / data-val: cambia un valor (ver applySet).
   - data-act, data-view, data-scope, etc.: acciones concretas (ver el manejador de click). */
import * as L from './logic.js';
import {SAMPLE} from './sample.js';
import {PROMPT} from './prompt.js';
import {openStore} from './storage.js';
import {esc, stepper, seg, chips, blocks, toggle, datePick, menu, slotsTrack, axis, bindSlots, parseHM, hm, slotWithHours, longDate} from './controls.js';

const {LV, fmt, dec, nh, hh, toTime, toMin, allocate, objectives, subState, buildItems, dayBlocks, makeDay, slotsHours, studyHours} = L;

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const dn = new Date(), TODAY = dn.getFullYear() + '-' + pad(dn.getMonth() + 1) + '-' + pad(dn.getDate());
const dayLabel = (d, o) => new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', {timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', ...o});
const chip = l => `<span class="chip c${l}">${LV[l]}</span>`;
const colorOf = sid => `var(--s${(S.app.order.indexOf(sid) % 6 + 6) % 6 + 1})`;
const sw = sid => `<span class="sw" style="background:${colorOf(sid)}"></span>`;
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const PRIO = [{v: 1, label: 'Alta', dot: 'var(--accent)'}, {v: 2, label: 'Media', dot: 'var(--exam)'}, {v: 3, label: 'Baja', dot: 'var(--low)'}];
const PRIO4 = [{v: 1, label: 'A', title: 'Alta', dot: 'var(--accent)'}, {v: 2, label: 'M', title: 'Media', dot: 'var(--exam)'}, {v: 3, label: 'B', title: 'Baja', dot: 'var(--low)'}, {v: 0, label: 'F', title: 'Fuera del plan', dot: 'var(--muted)'}];
const hTxt = x => nh(x) + ' h';

let S = L.newState(), view = 'config', scope = 'general', expanded = new Set(), undo = null, month = TODAY.slice(0, 7);
let draft = {text: '', res: null, diffs: null}, confirmDel = false, props = null, parar = false, showExtra = false, planAdd = false, formErr = '';
let pick = null, pickMonth = null, menuOpen = null, slotEdit = null, dayPop = null;
/* Gráfico de días: preferencias de este dispositivo (cuántos días se ven). */
const UIK = 'la-hoja-ui';
const uiPref = (() => {try {return JSON.parse(localStorage.getItem(UIK) || '{}')} catch (e) {return {}}})();
const saveUi = () => {try {localStorage.setItem(UIK, JSON.stringify(uiPref))} catch (e) {}};
if (!uiPref.dev) {uiPref.dev = Math.random().toString(36).slice(2, 10); saveUi()} /* Identifica este dispositivo para los avisos. */
let alertList = [], alertShown = new Set(), toastT = null, undoSnap = null;
const hOpen = new Set(); /* Días con la sección «Hechas» abierta. */
const LOADED = Date.now();
let chartN = [3, 7, 10, 14].includes(uiPref.n) ? uiPref.n : (innerWidth < 640 ? 7 : 14), chartStart = TODAY, chartAnim = '';
let dayView = null, doneAsk = null, moveAsk = null, selMode = false, selAsk = null;
const sel = new Set();
const exitSel = () => {selMode = false; selAsk = null; sel.clear()};
let ma = {sid: '', nom: '', min: 30, pri: 1, tipo: 'una'}, ex = {sid: '', nom: '', tipo: 'hoy', min: 30}, dvAdd = false;
const TIPO = [{v: 'una', label: 'Una vez'}, {v: 'dia', label: 'Cada día hasta acabarla'}];
let store = {kind: 'local'};

/* ---------- Pintado ---------- */
function render() {
  const a = document.activeElement && document.activeElement.id, al = allocate(S, TODAY);
  document.body.classList.toggle('simple', !!uiPref.simple);
  $('modeSwitch').innerHTML = (uiPref.simple ? '<button type="button" class="btn ghost sm" data-simple="off">Versión completa</button>' : '<button type="button" class="btn ghost sm" data-simple="on">Usar la versión simplificada en este dispositivo</button>') + notifBlock();
  if (uiPref.simple) {
    ['headblock', 'chart', 'scopes', 'tabs'].forEach(id => {$(id).hidden = true});
    $('overlay').innerHTML = '';
    renderSimple(al); renderAccount(); renderRunbar(); tick();
    if (a && $(a) && $(a) !== document.activeElement) $(a).focus();
    return;
  }
  const ob = objectives(S, al), none = !S.app.order.length;
  if (scope !== 'general' && scope !== 'nueva' && !S.subs[scope]) scope = 'general';
  const add = scope === 'nueva', foc = view === 'sesion' && !add;
  renderScopes();
  $('headblock').hidden = foc; $('chart').hidden = foc || none || add; $('tabs').hidden = add || none;
  ['config', 'plan', 'sesion', 'datos'].forEach(v => $('v-' + v).setAttribute('aria-selected', v === view));
  if (!foc) renderHead(al, ob);
  if (none && !add && !(view === 'config' && scope === 'general')) renderWelcome();
  else if (add) renderAdd();
  else if (view === 'plan') renderPlan(al);
  else if (view === 'sesion') renderSession(al);
  else if (view === 'datos') renderData();
  else if (scope === 'general') renderGeneral(al, ob);
  else renderSubject(al, ob);
  $('overlay').innerHTML = view === 'sesion' || scope === 'nueva' ? '' : dayViewModal(al);
  renderAccount(); renderRunbar();
  tick();
  if (a && $(a) && $(a) !== document.activeElement) $(a).focus();
  if (slotEdit && slotEdit.focus) {const i = $('slotEditTxt'); if (i) {i.focus(); i.select()} slotEdit.focus = false}
}
function renderScopes() {
  const n = S.app.order.length;
  $('scopes').innerHTML = `<button class="scope" data-scope="general" aria-pressed="${scope === 'general'}">General</button>` +
    S.app.order.map(id => {const w = subState(S, S.subs[id], TODAY); return `<button class="scope ${w === 'espera' || w === 'pausa' ? 'wait' : ''}" data-scope="${esc(id)}" aria-pressed="${scope === id}">${sw(id)}${esc(S.subs[id].nombre)}</button>`}).join('') +
    `<button class="scope add" data-scope="nueva" aria-pressed="${scope === 'nueva'}">+ Añadir</button>`;
  if (!n) $('scopes').querySelector('[data-scope=general]').hidden = false;
}
/* Avisos de la sesión. Salen mientras La Hoja está abierta: dentro de la app si la estás
   mirando y, si has dado permiso, como notificación del sistema cuando está detrás o minimizada
   (útil en Windows; el iPhone para la app en segundo plano y no puede avisar). */
const canNotify = () => 'Notification' in window && !/iPhone|iPad|iPod/.test(navigator.userAgent);
function notifBlock() {
  if (!canNotify()) return '';
  const p = Notification.permission;
  let x;
  if (p === 'granted' && uiPref.notif !== false) x = '<span>Avisos del sistema activados con La Hoja abierta</span><button type="button" class="btn ghost sm" data-notif="test">Probar</button><button type="button" class="btn ghost sm" data-notif="off">Desactivar</button>';
  else if (p === 'denied') x = '<span>Los avisos del sistema están bloqueados para La Hoja en el navegador.</span>';
  else x = '<button type="button" class="btn ghost sm" data-notif="on">Avisar también con La Hoja minimizada</button>';
  return `<div class="push-opt">${x}</div>`;
}
function planAlerts() {alertList = L.alerts(S)}
function checkAlerts(now) {
  for (const x of alertList) if (x.at <= now && x.at > LOADED && x.at > now - 10 * 60000 && !alertShown.has(x.id)) {alertShown.add(x.id); fireAlert(x)}
}
function fireAlert(x) {
  const sys = canNotify() && Notification.permission === 'granted' && uiPref.notif !== false;
  if (sys && (document.hidden || !document.hasFocus())) {
    const o = {body: x.body, tag: x.kind, icon: 'icons/icon-192.png'};
    (navigator.serviceWorker ? navigator.serviceWorker.getRegistration() : Promise.resolve(null))
      .then(r => r ? r.showNotification(x.title, o) : new Notification(x.title, o)).catch(() => {});
  }
  showToast(x);
}
function showToast(x) {
  const el = $('toast'); clearTimeout(toastT);
  el.innerHTML = `<div class="toast" role="status"><div><b>${esc(x.title)}</b><span>${esc(x.body)}</span></div>${x.undo ? '<button type="button" class="btn ghost sm" data-undo="1">Deshacer</button>' : '<button type="button" class="btn ghost sm" data-toast="0" aria-label="Cerrar">Vale</button>'}</div>`;
  el.hidden = false; toastT = setTimeout(() => {el.hidden = true; el.innerHTML = ''; if (x.undo) undoSnap = null}, x.undo ? 7000 : 15000);
  if (!x.undo) try {navigator.vibrate && navigator.vibrate([180, 80, 180])} catch (e) {}
}
/* Marcar hechas a mano: la tarea sale de las listas y del gráfico, y unos segundos se puede deshacer.
   También se desmarca desde «Hechas», al final de cada día. */
function markWithUndo(list) {
  const snap = [];
  for (const [it, day, end] of list) {
    const s = S.subs[it.sid], ks = it.unit ? [...it.children, it.key] : [it.key];
    if (it.open) ks.push(it.taskKey);
    ks.forEach(k => snap.push({sid: it.sid, k, done: s.done[k], real: s.real[k]}));
    if (end) L.closeOpen(S, it, day, +s.real[it.key] || 0); else L.markDone(S, it, day, +s.real[it.key] || 0);
  }
  if (!list.length) return;
  undoSnap = snap;
  const one = list.length === 1 ? list[0][0] : null;
  showToast({title: one ? (one.open ? (list[0][2] ? 'Tarea acabada' : 'Hecha por hoy') : 'Tarea hecha') : list.length + ' tareas hechas', body: one ? one.subName + ' · ' + one.name : 'Están en «Hechas», al final de cada día.', undo: true});
}
function undoDone() {
  if (!undoSnap) return;
  for (const x of undoSnap) {const s = S.subs[x.sid]; if (!s) continue; if (x.done === undefined) delete s.done[x.k]; else s.done[x.k] = x.done; if (x.real === undefined) delete s.real[x.k]; else s.real[x.k] = x.real}
  undoSnap = null; clearTimeout(toastT); $('toast').hidden = true; $('toast').innerHTML = ''; commit();
}
/* Barra de la sesión: se ve en las demás pantallas mientras hay una sesión abierta. */
function renderRunbar() {
  const r = S.app.run, el = $('runbar'), onSes = uiPref.simple ? sp === 'sesion' : view === 'sesion';
  const show = !!r && !onSes && scope !== 'nueva';
  const enter = show && !document.body.classList.contains('has-runbar');
  document.body.classList.toggle('has-runbar', show);
  planAlerts();
  if (!show) {el.innerHTML = ''; el.hidden = true; return}
  const it = r.key ? L.findItem(S, r.key, r.day) : null, ph = r.phase, base = ph === 'break' ? r.back : ph;
  const lbl = it && it.open ? 'Por hoy' : base === 'review' ? 'Revisada' : it && it.rev ? 'A revisar' : 'Hecha';
  const B = (act, t, cls = '') => `<button type="button" class="btn ${cls}" data-act="${act}">${t}</button>`;
  let b = '';
  if (ph === 'pause') b = B('unpause', 'Reanudar');
  else if (ph === 'break') b = B('resume', 'Reanudar') + B('next', lbl, 'alt');
  else if (ph === 'do' || ph === 'review') b = B('break', 'Descanso', 'alt') + B('next', lbl);
  el.hidden = false;
  el.innerHTML = `<div class="rb${enter ? ' rb-in' : ''}" data-phase="${ph}"><button type="button" class="rb-info" data-runbar="1" aria-label="Abrir la sesión">
    <span class="rb-st"><i></i>${STATE[ph]}</span><span class="rb-name">${it ? sw(it.sid) + '<span>' + esc(it.name) + '</span>' : '<span>Sin tareas</span>'}</span><b class="rb-t" id="rbT"></b></button>
    ${b ? `<div class="rb-btns">${b}</div>` : ''}</div>`;
}
/* Configuración › General › Cuenta. Arriba solo se avisa si falta entrar. */
function accountBlock() {
  let x;
  if (store.kind === 'firebase' && store.user) x = `<p class="sub">Sincronizado como <b>${esc(store.user.email || store.user.name)}</b>. Lo que cambies aquí se ve en el PC y en el móvil.</p><div class="row-btns"><button type="button" class="btn ghost" data-logout="1">Salir</button></div>`;
  else if (store.kind === 'firebase' && store.needLogin) x = `<p class="sub">Sin entrar: se guarda solo en este navegador.</p><div class="row-btns"><button type="button" class="btn" data-login="1">Entrar con Google</button></div>`;
  else if (store.kind === 'claude') x = '<p class="sub">Guardado en Claude.</p>';
  else x = '<p class="sub">Se guarda solo en este navegador.</p>';
  return `<section class="card"><h2>Cuenta</h2>${x}</section>`;
}
function renderAccount() {
  const el = $('account');
  if (store.kind === 'firebase' && store.needLogin) el.innerHTML = `<span>Entra con tu cuenta de Google para sincronizar el PC y el móvil.</span><button class="btn sm" data-login="1">Entrar con Google</button>`;
  else el.innerHTML = '';
  el.hidden = !el.innerHTML;
}
function renderHead(al, ob) {
  if (scope === 'nueva') {$('verdict').textContent = 'Añade una asignatura o proyecto'; $('lead').textContent = 'Copia el prompt, úsalo en tu IA y pega aquí el resultado.'; return}
  if (!S.app.order.length) {$('verdict').textContent = 'Organiza tus asignaturas y proyectos'; $('lead').textContent = 'Una IA estima las tareas, tú ajustas y la hoja reparte tu tiempo. Empieza por tu horario y añade asignaturas con + Añadir.'; $('chart').innerHTML = ''; return}
  const cap = al.cap, n = al.days.filter(d => !d.closed).length;
  if (scope === 'general') {
    if (!n) $('verdict').textContent = 'Añade tus días para ver hasta dónde llegas.';
    else $('verdict').textContent = ob.miss > 0 ? 'Te faltan ' + fmt(ob.miss) + ' para tus objetivos.' : 'Llegas a tus objetivos, con ' + fmt(Math.max(0, cap - ob.need)) + ' de margen.';
    $('lead').textContent = `Tienes ${fmt(cap)} en ${n} ${n === 1 ? 'día' : 'días'} y tus objetivos piden ${fmt(ob.need)}. Modo: ${S.app.mode === 'pct' ? 'porcentajes' : 'prioridad y fecha'}.`;
  } else {
    const o = ob.list.find(x => x.sid === scope), s = S.subs[scope];
    if (!o || !o.t) {const w = subState(S, s, TODAY); $('verdict').textContent = w === 'pausa' ? s.nombre + ' está en pausa.' : w === 'espera' ? s.nombre + ' está en espera.' : w === 'sin-tareas' ? s.nombre + ' necesita tareas.' : 'No queda nada pendiente en ' + s.nombre + '.'; $('lead').textContent = w === 'espera' ? 'Entrará en el plan cuando tenga tareas o una fecha cercana.' : w === 'sin-tareas' ? 'Su fecha se acerca. Añade tareas abajo o con un texto de la IA.' : ''}
    else {
      $('verdict').textContent = o.miss > 0 ? `A ${s.nombre} le faltan ${fmt(o.miss)} para tu objetivo.` : `${s.nombre} llega a tu objetivo.`;
      $('lead').textContent = `Tu objetivo llega hasta ${o.t.name} y pide ${fmt(o.need)}.` + (s.limites&&s.limites.length>1?' Fechas: '+s.limites.map(l=>l.nombre+' '+dayLabel(l.fecha)).join(', ')+'.' : s.limite?` Fecha límite: ${dayLabel(s.limite)}.`:'');
    }
  }
  renderChart(al, ob);
}
/* ---------- Gráfico de días ---------- */
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WD = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
function groupRows(rows) {
  const out = [];
  for (const r of rows) {
    const l = out[out.length - 1];
    if (l && l.sid === r.it.sid && l.done === !!r.done) l.m += r.m;
    else out.push({sid: r.it.sid, done: !!r.done, m: r.m});
  }
  return out;
}
function renderChart(al, ob) {
  const n = chartN, dates = [...Array(n)].map((_, i) => L.addDays(chartStart, i)), byDay = {};
  al.days.forEach(x => {byDay[x.d] = x});
  const H = 170, seen = new Set();
  const info = dates.map(d => {
    const x = byDay[d], rows = (al.plan[d] || []).filter(r => !r.done), tot = rows.reduce((a, r) => a + r.m, 0), cap = x ? x.h * 60 : 0;
    const free = x && !x.closed ? Math.max(0, al.rem[d] || 0) : 0;
    return {d, x, rows, tot, cap, free};
  });
  const maxM = Math.max(60, ...info.map(o => Math.max(o.cap, o.tot)));
  const col = o => {
    const dt = new Date(o.d + 'T00:00:00Z'), wd = dt.getUTCDay(), we = wd === 0 || wd === 6, today = o.d === TODAY;
    const mine = id => scope === 'general' || id === scope;
    const segs = groupRows(o.rows).map(g => {
      seen.add(g.sid);
      const h = g.m / maxM * H, nm = S.subs[g.sid] ? S.subs[g.sid].nombre : g.sid;
      return `<i class="sg ${g.done ? 'done' : ''}" style="height:${h.toFixed(1)}px;background:${mine(g.sid) ? colorOf(g.sid) : 'var(--line)'}" title="${esc(nm)}: ${fmt(g.m)}${g.done ? ' (hecho)' : ''}">${h >= 20 && mine(g.sid) ? `<em>${esc(nm)}</em>` : ''}</i>`;
    }).join('');
    const freeH = o.free / maxM * H;
    const own = scope === 'general' ? o.tot : o.rows.filter(r => r.it.sid === scope).reduce((a, r) => a + r.m, 0);
    const hm2 = m => Math.floor(m / 60) + ':' + String(Math.round(m % 60)).padStart(2, '0');
    const top = own ? `<span class="f">${fmt(own)}</span><span class="s">${hm2(own)}</span>` : o.tot ? '—' : o.x ? (o.x.closed ? '' : 'libre') : '';
    const lbl = `${dayLabel(o.d, {weekday: 'long', month: 'long'})}: ${o.x ? fmt(o.tot) + ' de ' + fmt(o.cap) : 'sin estudio'}`;
    return `<button type="button" class="dch-col ${today ? 'today' : ''} ${we ? 'we' : ''} ${o.x ? '' : 'off'} ${o.x && o.x.closed ? 'past' : ''}" data-dayview="${o.d}" aria-label="${esc(lbl)}" title="${esc(lbl)}">
      <span class="dch-top">${top}</span>
      <span class="dch-bar" style="height:${Math.max(o.x ? 8 : 4, (Math.max(o.cap, o.tot) / maxM * H)).toFixed(1)}px">${freeH >= 1 ? `<i class="sg free" style="height:${freeH.toFixed(1)}px">${freeH >= 18 && n <= 10 ? '<em>libre</em>' : ''}</i>` : ''}${segs}</span>
      <span class="dch-d"><b>${today ? 'Hoy' : WD[wd]}</b>${dt.getUTCDate()}</span></button>`;
  };
  const groups = [];
  info.forEach(o => {const m = o.d.slice(0, 7), l = groups[groups.length - 1]; if (l && l.m === m) l.list.push(o); else groups.push({m, list: [o]})});
  const body = groups.map(g => {const [y, m] = g.m.split('-').map(Number); return `<div class="dch-m" style="flex:${g.list.length}"><div class="dch-mh">${MES[m - 1]}${y !== +TODAY.slice(0, 4) ? ' ' + y : ''}</div><div class="dch-cols">${g.list.map(col).join('')}</div></div>`}).join('');
  const last = dates[dates.length - 1], rng = `${dayLabel(dates[0], {weekday: undefined})} – ${dayLabel(last, {weekday: undefined})}`;
  const legend = [...seen].filter(id => scope === 'general' || id === scope).sort((a, b) => S.app.order.indexOf(a) - S.app.order.indexOf(b)).map(id => `<span>${sw(id)}${esc(S.subs[id] ? S.subs[id].nombre : id)}</span>`).join('') +
    (scope === 'general' ? '' : '<span><span class="sw" style="background:var(--line)"></span>Otras</span>') +
    '<span><span class="sw free"></span>Libre</span><span><span class="sw donesw"></span>Hecho</span>';
  const miss = ob.list.filter(o => o.miss > 0 && (scope === 'general' || o.sid === scope)).map(o => `${esc(o.s.nombre)} ${fmt(o.miss)}`).join(' · ');
  $('chart').innerHTML = `<div class="dch-nav"><div class="dch-btns"><button type="button" class="icon round" data-chnav="-1" aria-label="Días anteriores">‹</button><button type="button" class="btn ghost sm" data-chnav="0" ${chartStart === TODAY ? 'disabled' : ''}>Hoy</button><button type="button" class="icon round" data-chnav="1" aria-label="Días siguientes">›</button><span class="dch-rng">${rng}</span></div>
    ${seg({key: 'chartN', value: n, size: 'sm', label: 'Días que se ven', options: [3, 7, 10, 14].map(v => ({v, label: v + ' días'}))})}</div>
    <div class="dch-win ${chartAnim} n${n}">${body}</div>
    <div class="legend">${legend}${miss ? `<span class="neg"><span class="sw hatch"></span>Sin sitio: ${miss}</span>` : ''}<span class="hint">Toca un día para ver y mover sus tareas.</span></div>`;
  chartAnim = '';
}

/* ---------- Ventana de un día ---------- */
const CHECK = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9"/></svg>';
const DOTS = '<svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor"><circle cx="3" cy="3" r="1.6"/><circle cx="9" cy="3" r="1.6"/><circle cx="3" cy="9" r="1.6"/><circle cx="9" cy="9" r="1.6"/><circle cx="3" cy="15" r="1.6"/><circle cx="9" cy="15" r="1.6"/></svg>';
function doneDayOptions(d) {
  const opts = [{v: TODAY, label: 'Hoy'}];
  if (d !== TODAY && d < TODAY) opts.push({v: d, label: dayLabel(d, {weekday: 'short', month: undefined})});
  const ay = L.addDays(TODAY, -1); if (ay !== d || d >= TODAY) if (!opts.some(o => o.v === ay)) opts.push({v: ay, label: 'Ayer'});
  return opts;
}
/* Casilla de selección: estado 'on', 'part' (algunas) u ''. */
const selBox = (st, attrs, label) => `<button type="button" class="dv-sel ${st}" role="checkbox" aria-checked="${st === 'on' ? 'true' : st === 'part' ? 'mixed' : 'false'}" aria-label="${esc(label)}" ${attrs}>${st === 'part' ? '<i></i>' : CHECK}</button>`;
function dayViewModal(al, page) {
  const d = dayView; if (!d) return '';
  const x = S.app.days.find(y => y.d === d), rows = al.plan[d] || [], past = d < TODAY, closed = !!S.app.closed[d];
  const act = rows.filter(r => !r.done), dn = rows.filter(r => r.done);
  const tot = act.reduce((a, r) => a + r.m, 0), free = x && !past && !closed ? Math.max(0, al.rem[d] || 0) : 0;
  const slots = x && x.slots && x.slots.length ? x.slots.map(y => y.ini + '–' + y.fin).join(' · ') : '';
  const study = new Set(S.app.days.filter(y => y.d >= TODAY && !S.app.closed[y.d]).map(y => y.d));
  const open = rows.filter(r => !r.done && !past).map(r => r.it.key);
  [...sel].forEach(k => {if (!open.includes(k)) sel.delete(k)});
  const keysOf = (sid, gid) => rows.filter(r => !r.done && !past && r.it.sid === sid && (!gid || r.it.gid === gid)).map(r => r.it.key);
  const stOf = ks => !ks.length ? '' : ks.every(k => sel.has(k)) ? 'on' : ks.some(k => sel.has(k)) ? 'part' : '';
  const calMarks = Object.fromEntries([...study].map(v => [v, 1]));
  const item = r => {
    const it = r.it, k = it.key, on = sel.has(k), part = r.part ? ` · parte ${r.part}/${r.parts}` : '';
    const short = it.name.startsWith(it.gName + ' · ') ? it.name.slice(it.gName.length + 3) : it.name;
    const nm = short + (it.extra ? ' · fuera del plan' : '');
    let ask = '';
    if (!selMode && doneAsk === k && it.open) {
      ask = `<li class="dv-ask"><span class="lbl">Tarea de cada día</span><div class="row-btns"><button type="button" class="btn sm" data-dvopen="hoy" data-key="${esc(k)}">Hecha por hoy</button><button type="button" class="btn sm alt" data-dvopen="fin" data-key="${esc(k)}">Acabada del todo</button><button type="button" class="btn ghost sm" data-dvcancel="1">Cancelar</button></div></li>`;
    } else if (!selMode && doneAsk === k) {
      ask = `<li class="dv-ask"><span class="lbl">¿Qué día la hiciste?</span>${chips({key: 'doneOn', id: k, value: '', options: doneDayOptions(d), label: 'Día en que la hiciste'})}
        ${datePick({key: 'doneOn', id: k, value: '', open: pick === 'doneOn|' + k, month: pickMonth, today: TODAY, label: 'Otro día', empty: 'Otro día…', allowed: v => v <= TODAY, foot: ''})}
        <button type="button" class="btn ghost sm" data-dvcancel="1">Cancelar</button></li>`;
    } else if (!selMode && moveAsk === k) {
      ask = `<li class="dv-ask"><span class="lbl">Mover a otro día de estudio${it.pinned ? ` · ahora fijada el ${dayLabel(it.pinned)}` : ''}</span>
        ${datePick({key: 'moveTo', id: k, value: it.pinned || '', inline: true, month: pickMonth, today: TODAY, label: 'Mover a', allowed: v => study.has(v), marks: calMarks, foot: ''})}
        <div class="row-btns">${it.pinned ? `<button type="button" class="btn ghost sm" data-dvunpin="${esc(k)}">Soltar: que la coloque el plan</button>` : ''}<button type="button" class="btn ghost sm" data-dvcancel="1">Cancelar</button></div></li>`;
    }
    const canSel = selMode && !r.done && !past;
    return `<li class="dv-r ${r.done ? 'done' : ''} ${on ? 'sel' : ''}" data-key="${esc(k)}">
      ${selMode ? (canSel ? selBox(on ? 'on' : '', `data-dvselk="${esc(k)}"`, 'Seleccionar ' + it.name) : '<span class="dv-sel off"></span>') : ''}
      <button type="button" class="dv-chk" data-dvdone="${esc(k)}" aria-pressed="${!!r.done}" aria-label="${r.done ? 'Desmarcar ' : 'Marcar hecha '}${esc(it.name)}">${CHECK}</button>
      ${!past && !r.done ? `<span class="dv-h" data-dvdrag="1" title="Arrastra para cambiar el orden" aria-hidden="true">${DOTS}</span>` : '<span class="dv-h off"></span>'}
      <span class="dv-t"><b>${esc(nm)}</b><small>${fmt(r.m)}${it.open ? ' al día · hasta que la acabes' : ''}${part}${it.pinned === d ? ' · <span class="pin">Fija</span>' : ''}${r.done ? ' · hecha' : ''}</small></span>
      ${!r.done && !past && !selMode && !it.open ? `<button type="button" class="btn ghost sm" data-dvmove="${esc(k)}" aria-expanded="${moveAsk === k}">Mover</button>` : '<span></span>'}</li>${ask}`;
  };
  /* Lista en el orden del día, con una cabecera cada vez que empieza otra asignatura o grupo. */
  let list = '', ls = null, lg = null;
  act.forEach((r, i) => {
    const it = r.it;
    if (it.sid !== ls) {
      let m = 0; for (let j = i; j < act.length && act[j].it.sid === it.sid; j++) m += act[j].m;
      const ks = keysOf(it.sid);
      list += `<li class="dv-hd sub">${selMode && ks.length ? selBox(stOf(ks), `data-dvsel="${esc(it.sid)}"`, 'Seleccionar todo ' + it.subName) : ''}${sw(it.sid)}<b>${esc(it.subName)}</b><span class="num">${fmt(m)}</span></li>`;
      ls = it.sid; lg = null;
    }
    if (it.gid !== lg) {
      const ks = keysOf(it.sid, it.gid);
      list += `<li class="dv-hd grp">${selMode && ks.length ? selBox(stOf(ks), `data-dvsel="${esc(it.sid + '|' + it.gid)}"`, 'Seleccionar todo ' + it.gName) : ''}<span>${esc(it.gName)}</span></li>`;
      lg = it.gid;
    }
    list += item(r);
  });
  if (!act.length && dn.length) list += `<li class="dv-empty">${past ? 'Nada pendiente de este día.' : 'No quedan tareas este día.'}</li>`;
  /* Hechas: plegadas al final, solo para desmarcar una por error. */
  const hechas = dn.length ? `<div class="dv-hechas"><button type="button" class="dv-hbtn" data-hechas="${d}" aria-expanded="${hOpen.has(d)}"><span>Hechas</span><b class="num">${dn.length}</b><i aria-hidden="true">›</i></button>${hOpen.has(d) ? `<ul class="dv-done">${dn.map(r => `<li class="dv-r done" data-key="${esc(r.it.key)}"><button type="button" class="dv-chk" data-dvdone="${esc(r.it.key)}" aria-pressed="true" aria-label="Desmarcar ${esc(r.it.name)}">${CHECK}</button><span class="dv-h off"></span><span class="dv-t"><b>${esc(r.it.name)}</b><small>${sw(r.it.sid)}${esc(r.it.subName)} · ${fmt(r.m)}</small></span><span></span></li>`).join('')}</ul>` : ''}</div>` : '';
  let bar = '';
  if (selMode) {
    const n = sel.size, anyPin = [...sel].some(k => {const s = S.subs[k.split('/')[0]]; return s && s.pin && s.pin[k]});
    let ask = '';
    if (n && selAsk === 'done') ask = `<div class="dv-bar-ask"><span class="lbl">¿Qué día las hiciste?</span>${chips({key: 'doneOnSel', value: '', options: doneDayOptions(d), label: 'Día en que las hiciste'})}${datePick({key: 'doneOnSel', value: '', open: pick === 'doneOnSel|', month: pickMonth, today: TODAY, label: 'Otro día', empty: 'Otro día…', allowed: v => v <= TODAY, foot: ''})}</div>`;
    if (n && selAsk === 'move') ask = `<div class="dv-bar-ask"><span class="lbl">Mover ${n === 1 ? 'la tarea' : 'las ' + n + ' tareas'} a otro día de estudio</span>${datePick({key: 'moveToSel', value: '', inline: true, month: pickMonth, today: TODAY, label: 'Mover a', allowed: v => study.has(v), marks: calMarks, foot: ''})}</div>`;
    bar = `<div class="dv-bar">${ask}<div class="dv-bar-r"><b>${n ? n + (n === 1 ? ' seleccionada' : ' seleccionadas') : 'Toca tareas o cabeceras para seleccionarlas'}</b>
      <div class="row-btns">${n ? `<button type="button" class="btn sm" data-dvbulk="done" aria-expanded="${selAsk === 'done'}">Marcar hechas</button><button type="button" class="btn sm alt" data-dvbulk="move" aria-expanded="${selAsk === 'move'}">Mover</button>${anyPin ? '<button type="button" class="btn ghost sm" data-dvbulk="unpin">Soltar</button>' : ''}` : `<button type="button" class="btn ghost sm" data-dvbulk="all">Todas</button>`}<button type="button" class="btn ghost sm" data-dvbulk="exit">Cancelar</button></div></div></div>`;
  }
  const addF = !past && !selMode ? (dvAdd ? `<div class="dv-add">${manualForm('', d)}</div>` : `<button type="button" class="btn ghost sm dv-addbtn" data-dvaddtask="1">+ Añadir tarea a este día</button>`) : '';
  if (page) return {list, hechas, addF, bar, rows, x, past, closed, tot, free, slots, open};
  const prev = L.addDays(d, -1), next = L.addDays(d, 1);
  return `<div class="modal-bg" data-modalbg="dv"><div class="modal dv ${selMode ? 'selecting' : ''}" role="dialog" aria-modal="true" aria-label="${esc(dayLabel(d, {weekday: 'long', month: 'long'}))}">
    <div class="modal-h"><button type="button" class="icon round" data-dvgo="${prev}" aria-label="Día anterior">‹</button><h3>${dayLabel(d, {weekday: 'long', month: 'long'})}${d === TODAY ? ' · hoy' : ''}</h3><button type="button" class="icon round" data-dvgo="${next}" aria-label="Día siguiente">›</button><button type="button" class="icon round" data-dvclose="1" aria-label="Cerrar">×</button></div>
    <div class="dv-sub"><p class="sub">${x ? `${fmt(tot)} planificadas de ${fmt(x.h * 60)}${slots ? ' · ' + slots : ''}${closed ? ' · terminado' : ''}` : 'No es uno de tus días de estudio.'}</p>${open.length && !selMode ? '<button type="button" class="btn ghost sm" data-dvbulk="enter">Seleccionar</button>' : ''}</div>
    ${rows.length ? `<ul class="dv-list" data-dvday="${d}">${list}</ul>${hechas}${addF}${selMode ? '' : '<p class="sub dv-help">Toca el círculo para marcarla hecha. Arrastra los puntos para cambiar el orden. «Mover» la fija en otro día. Mantén pulsada una tarea o usa «Seleccionar» para elegir varias.</p>'}` : `<div class="empty">${x ? 'No hay tareas este día.' : past ? 'Día pasado sin estudio.' : 'Añádelo para que el plan le reparta tareas.'}</div>${x ? addF : ''}`}
    ${bar || `<div class="modal-f">${free ? `<span class="sub">Libre: ${fmt(free)}</span>` : '<span></span>'}<div class="row-btns">${x && !past ? `<button type="button" class="btn ghost sm" data-dvslots="${d}">Editar franjas</button>` : ''}${!x && !past ? `<button type="button" class="btn sm" data-dvadd="${d}">Añadir este día</button>` : ''}<button type="button" class="btn sm" data-dvclose="1">Listo</button></div></div>`}
  </div></div>`;
}

/* ---------- Versión simplificada (móvil) ----------
   Se activa por dispositivo (uiPref.simple). Tres pantallas: el día (sp = 'dia'), la sesión ('sesion')
   y el resumen de un día ('resumen'). El día usa dayView y reutiliza la lista de la ventana del día. */
let sp = 'dia', spSum = TODAY, spMore = false, spAnim = '';
function spGo(d, dir) {dayView = d; spAnim = dir > 0 ? 'from-r' : 'from-l'; exitSel(); doneAsk = moveAsk = null; pick = null; render()}
function renderSimple(al) {
  if (S.app.run && sp === 'dia' && !dayView) sp = 'sesion';
  if (!dayView) dayView = TODAY;
  if (sp === 'sesion' && S.app.run) return renderSimpleSession(al);
  if (sp === 'sesion' && !S.app.run) {sp = S.app.closed[TODAY] && S.app.lastDay === TODAY ? 'resumen' : 'dia'; spSum = TODAY}
  if (sp === 'resumen') return renderSimpleSummary();
  renderSimpleDay(al);
}
function renderSimpleDay(al) {
  const d = dayView, p = dayViewModal(al, true), isToday = d === TODAY, r = S.app.run;
  const done = p.rows.filter(x => x.done), doneM = done.reduce((a, x) => a + x.m, 0);
  const all = p.tot + doneM, pct = all ? Math.round(100 * doneM / all) : 0, dt = new Date(d + 'T00:00:00Z');
  const wd = dt.toLocaleDateString('es-ES', {timeZone: 'UTC', weekday: 'long'});
  let cta = '';
  if (r) cta = '';
  else if (isToday && !p.closed && p.x) cta = `<button type="button" class="sp-cta" data-act="go">Empezar sesión</button>`;
  else if (isToday && !p.x) cta = `<button type="button" class="sp-cta" data-act="go">Empezar sesión</button><p class="sub sp-note">Hoy no está entre tus días. Al empezar se añade con tu horario.</p>`;
  else if (isToday && p.closed) cta = `<button type="button" class="sp-cta alt" data-sp="resumen" data-day="${d}">Ver el resumen de hoy</button><button type="button" class="btn ghost sp-wide" data-act="go">Seguir estudiando hoy</button>`;
  else if (d < TODAY) cta = `<button type="button" class="sp-cta alt" data-sp="resumen" data-day="${d}">Ver el resumen del día</button>`;
  const list = p.rows.length ? `<div class="sp-listh"><b>Tareas</b>${p.open.length && !selMode ? '<button type="button" class="btn ghost sm" data-dvbulk="enter">Seleccionar</button>' : ''}</div><ul class="dv-list" data-dvday="${d}">${p.list}</ul>${p.hechas}${p.addF}${selMode ? '' : '<p class="sub dv-help">Toca el círculo para marcarla hecha. Arrastra los puntos para ordenarlas. Mantén pulsada una tarea para elegir varias.</p>'}`
    : `<div class="empty">${p.x ? 'No hay tareas este día.' : d < TODAY ? 'Día pasado sin estudio.' : 'No es uno de tus días de estudio.'}</div>${p.x ? p.addF : ''}${!p.x && d >= TODAY ? `<button type="button" class="btn ghost sp-wide" data-dvadd="${d}">Añadir este día</button>` : ''}`;
  $('main').innerHTML = `<div class="sp ${spAnim}" data-swipe="1">
    <div class="sp-head"><button type="button" class="icon round" data-spgo="-1" aria-label="Día anterior">‹</button>
      <div class="sp-date"><b>${isToday ? 'Hoy' : wd[0].toUpperCase() + wd.slice(1)}</b><span>${dayLabel(d, {weekday: isToday ? 'long' : undefined, month: 'long'})}</span></div>
      <button type="button" class="icon round" data-spgo="1" aria-label="Día siguiente">›</button></div>
    ${isToday ? '' : '<div class="sp-back"><button type="button" class="btn ghost sm" data-spgo="0">Volver a hoy</button></div>'}
    ${p.x ? `<div class="sp-sum"><div><b>${fmt(all)}</b><span>de estudio${p.slots ? ' · ' + p.slots : ''}</span></div><div class="sp-prog" role="img" aria-label="${pct} % hecho"><i style="width:${pct}%"></i></div><small>${done.length} de ${p.rows.length} ${p.rows.length === 1 ? 'tarea hecha' : 'tareas hechas'}${p.free ? ' · libre ' + fmt(p.free) : ''}</small></div>` : ''}
    ${cta}${list}${p.bar}</div>`;
  spAnim = '';
}
function renderSimpleSession(al) {
  const r = S.app.run, now = Date.now(), c = L.clock(S, now, TODAY), it = c.it, ph = r.phase, brk = ph === 'break', pa = ph === 'pause';
  const base = pa ? r.pb.phase : (brk ? r.back : ph), toRev = base === 'do' && it && it.rev, op = it && it.open;
  const B = (act, label, cls = '') => `<button type="button" class="sp-btn ${cls}" data-act="${act}">${label}</button>`;
  let acts;
  if (pa) acts = B('unpause', 'Reanudar', 'main') + B('end', 'Acabar día', 'ghost');
  else if (parar) acts = B('pause', 'Pausa', 'main') + B('end', 'Acabar día', 'alt') + B('noparar', 'Cancelar', 'ghost');
  else if (ph === 'free') acts = `<button type="button" class="sp-btn main" data-showextra="1">Tarea fuera del plan</button>` + B('parar', 'Parar', 'ghost');
  else if (brk) acts = B('resume', 'Reanudar', 'main') + B('parar', 'Parar', 'ghost');
  else if (op) acts = B('next', 'Por hoy', 'main') + B('finopen', 'Acabada', 'alt') + B('break', 'Descanso', 'alt') + B('parar', 'Parar', 'ghost');
  else acts = B('next', toRev ? 'Hecha: a revisar' : ph === 'review' ? 'Revisión hecha' : 'Tarea hecha', 'main') + B('break', 'Descanso', 'alt') + B('parar', 'Parar', 'ghost');
  const pend = al.pend.filter(p => p.it.key !== r.key).slice(0, 80), nxt = L.nextKey(S, r.day, r.sid, r.key);
  const stale = r.day < TODAY ? `<div class="banner"><span>Esta sesión sigue abierta desde el ${dayLabel(r.day)}.</span><div class="row-btns"><button class="btn alt sm" data-act="carry">Seguir hoy</button><button class="btn alt sm" data-act="discard">Cerrarla sin contar el último tramo</button></div></div>` : '';
  const more = spMore ? `<div class="sp-more">
      ${it ? `<button type="button" class="btn ghost" data-showextra="1">Tarea fuera del plan</button><button type="button" class="btn ghost" data-act="minus5">Quitar 5 min a este tramo</button>` : ''}
      ${it && pend.length ? `<div class="field wide"><span class="lbl">Cambiar de tarea</span>${menu({key: 'switchTask', value: '', open: menuOpen === 'switchTask|', placeholder: 'Elige otra tarea', label: 'Cambiar de tarea', options: pend.map(p => ({v: p.it.key, label: p.it.name, sub: p.it.det, sw: colorOf(p.it.sid), group: p.it.subName}))})}</div>` : ''}</div>` : '';
  $('main').innerHTML = stale + `<div class="sp-ses" data-phase="${ph === 'free' ? '' : ph}">
    <div class="sp-ses-top"><button type="button" class="btn ghost sm" data-sp="dia">‹ Día</button><span class="state"><i></i>${STATE[ph]}</span><button type="button" class="btn ghost sm" data-spmore="1" aria-expanded="${spMore}">Más</button></div>
    ${more}
    <div class="sp-ses-main"><div class="sp-ses-sub">${it ? sw(it.sid) + esc(it.subName) : ''}</div><h2>${it ? esc(it.name) : 'Has acabado lo previsto'}</h2>
    <div class="big" id="bigT"></div><div class="bigsub" id="bigS"></div></div>
    <div class="sp-acts">${acts}</div>
    <div class="sp-today"><span>Hoy <b id="miStudy"></b></span><span>Descanso <b id="miBreak"></b></span></div>
    ${nxt ? `<p class="sub sp-next">Después: ${esc(nxt.subName)} · ${esc(nxt.name)}</p>` : ''}
    ${showExtra || !it ? extraForm() : ''}</div>`;
}
function renderSimpleSummary() {
  const d = spSum || TODAY, o = L.dayStats(S, d, Date.now()), pct = o.plan ? Math.round(100 * o.study / o.plan) : 0;
  const subs = Object.keys(o.bySub).sort((a, b) => o.bySub[b] - o.bySub[a]);
  const bar = subs.map(id => `<i style="width:${o.study ? 100 * o.bySub[id] / o.study : 0}%;background:${colorOf(id)}"></i>`).join('');
  const leg = subs.map(id => `<li>${sw(id)}<span>${esc(S.subs[id] ? S.subs[id].nombre : id)}</span><b class="num">${fmt(o.bySub[id])}</b></li>`).join('');
  const dev = t => {if (!t.real || !t.est) return ''; const v = Math.round(100 * (t.real / t.est - 1)); return `<em class="${v > 0 ? 'neg' : 'pos'}">${v >= 0 ? '+' : '−'}${Math.abs(v)} %</em>`};
  const tasks = o.tasks.map(t => `<li>${sw(t.sid)}<span>${esc(t.name)}<small>${esc(t.subName)}</small></span><b class="num">${t.real ? fmt(t.real) : '—'}<small>de ${fmt(t.est)}</small></b>${dev(t)}</li>`).join('');
  $('main').innerHTML = `<div class="sp sp-res">
    <div class="sp-head"><button type="button" class="btn ghost sm" data-sp="dia">‹ Día</button><div class="sp-date"><b>Resumen</b><span>${dayLabel(d, {weekday: 'long', month: 'long'})}</span></div><span></span></div>
    <div class="sp-hero"><b>${fmt(o.study)}</b><span>de estudio${o.plan ? ` de ${fmt(o.plan)} previstas` : ''}</span>${o.plan ? `<div class="sp-prog big"><i style="width:${Math.min(100, pct)}%"></i></div><small>${pct} % de lo previsto</small>` : ''}</div>
    <div class="sp-tiles"><div><b>${fmt(o.brk)}</b><small>de descanso${o.nBreaks ? ` en ${o.nBreaks} ${o.nBreaks === 1 ? 'parada' : 'paradas'}` : ''}</small></div><div><b>${fmt(o.maxStint)}</b><small>bloque más largo sin parar</small></div><div><b>${fmt(o.paus)}</b><small>en pausa, no cuenta</small></div><div><b>${o.tasks.length}</b><small>${o.tasks.length === 1 ? 'tarea hecha' : 'tareas hechas'}</small></div></div>
    ${subs.length ? `<section class="card"><h2>Por asignatura</h2><div class="sp-stack">${bar}</div><ul class="sp-leg">${leg}</ul></section>` : ''}
    ${o.tasks.length ? `<section class="card"><h2>Tareas hechas</h2><ul class="sp-tasks">${tasks}</ul></section>` : ''}
    ${!o.study && !o.tasks.length ? '<div class="empty">Ese día no hay estudio registrado.</div>' : ''}
    ${d === TODAY ? '<button type="button" class="btn ghost sp-wide" data-act="go">Seguir estudiando hoy</button>' : ''}</div>`;
}

function renderWelcome() {
  $('main').innerHTML = `<section><div class="empty"><p>Aún no tienes asignaturas. Pulsa <b>+ Añadir</b>, copia el prompt, pásalo a tu IA con tus materiales y pega el resultado. Luego lo ajustas en Configuración y aparece en Plan, Sesión y Mis datos.</p></div>
   <div class="row-btns"><button class="btn" data-goadd="1">Añadir la primera</button><button class="btn ghost" data-sample="1">Probar con Estructuras de ejemplo</button></div></section>`;
}

/* ---------- Añadir ---------- */
function renderAdd() {
  const r = draft.res, ds = draft.diffs || [];
  const subs = r && r.ok ? r.subs : [], anyNew = subs.some(x => !S.subs[x.id]);
  $('main').innerHTML = `<div class="steps">
   <section class="card"><h2>Definir sin tareas</h2><p class="sub">Escribe una por línea. Quedan en espera hasta que tengan tareas o una fecha cercana. Para ponerles fecha, añade punto y coma: Física; 2027-02-01.</p>
    <textarea id="quick" style="min-height:92px" aria-label="Lista de asignaturas o proyectos" placeholder="Física; 2027-02-01&#10;TFG&#10;Proyecto de control"></textarea>
    <div class="row-btns"><button class="btn" data-quick="1">Crear en espera</button><span class="status neg">${esc(formErr)}</span></div></section>
   <section class="card"><h2>Crear con IA: copia el prompt</h2><p class="sub">Pásalo a Claude o a otra IA junto con el temario, los enunciados o la descripción del proyecto. Si actualizas una asignatura, adjunta también su texto actual, que copias desde su Configuración, para que conserve los id.</p>
    <div class="promptbox" id="promptbox" tabindex="0">${esc(PROMPT)}</div>
    <div class="row-btns"><button class="btn" data-copy="1">Copiar prompt</button><span class="status" id="copied"></span></div></section>
   <section class="card"><h2>Pega el resultado</h2>
    <textarea id="pasted" aria-label="Resultado de la IA" placeholder='{ "formato": "hoja-carga/1", "asignatura": { ... } }'>${esc(draft.text)}</textarea>
    <div class="row-btns"><button class="btn" data-check="1">Comprobar</button><button class="btn ghost" data-sample="1">Usar Estructuras de ejemplo</button></div>
    ${r && !r.ok ? `<ul class="errs">${r.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>
   ${subs.length ? `<section class="card"><h2>Revisa y aplica</h2>${subs.map((x, i) => {const d = ds[i], ex = S.subs[x.id]; return `<div class="prev"><b>${esc(x.nombre)}: ${ex ? 'actualización conservando tu progreso' : 'nueva'}</b>
     <span>${x.grupos.length} grupos, ${x.grupos.reduce((a, g) => a + g.tareas.length, 0)} tareas y ${fmt(x.grupos.reduce((a, g) => a + g.tareas.reduce((b, t) => b + t.min, 0), 0))} estimadas${x.limite ? `. Fecha límite: ${dayLabel(x.limite)}` : ''}.</span>
     ${ex ? `<ul>${d.added.length ? `<li>Tareas nuevas: ${d.added.map(esc).join(', ')}</li>` : ''}${d.changed.length ? `<li>Cambian: ${d.changed.map(esc).join(', ')}</li>` : ''}${d.removed.length ? `<li>Desaparecen: ${d.removed.map(y => esc(y.nombre) + (y.done ? ' (estaba hecha)' : '')).join(', ')}</li>` : ''}<li>${d.keep} tareas se mantienen con su progreso. Las añadidas a mano no se tocan.</li></ul>` : ''}</div>`}).join('')}
     <div class="row-btns"><button class="btn" data-apply-sub="1">${anyNew ? 'Añadir' : 'Aplicar cambios'}</button></div></section>` : ''}
  </div>`;
}
function checkDraft() {
  draft.res = L.parseText(draft.text);
  draft.diffs = draft.res.ok ? draft.res.subs.map(x => L.diffSub(S.subs[x.id] || null, x)) : null;
}

/* ---------- General ---------- */
function getSlots(sk) {
  const [k, v] = sk.split(':');
  if (k === 'sched') return L.schedSlots(S.app, +v);
  const x = S.app.days.find(y => y.d === sk.slice(4));
  return x ? (x.slots || []) : [];
}
function setSlots(sk, slots) {
  const [k, v] = sk.split(':');
  if (k === 'sched') {S.app.sched = S.app.sched || {}; S.app.sched[+v] = {slots}}
  else {
    const x = S.app.days.find(y => y.d === sk.slice(4)); if (!x) return;
    x.slots = slots;
    if (slots.length) {x.h = Math.min(24, slotsHours(S.app, slots)); x.auto = true} else {x.h = 0; x.auto = false}
  }
  slotEdit = null; touch();
}
function scheduleBlock() {
  const rows = DAYS.map((n, i) => {
    const sl = L.schedSlots(S.app, i), h = slotsHours(S.app, sl);
    return `<div class="sched-r"><span class="dpill ${sl.length ? 'on' : ''}" title="${n}">${n.slice(0, 3)}</span>${slotsTrack({sk: 'sched:' + i, slots: sl, app: S.app, edit: slotEdit, label: 'Franjas del ' + n})}<span class="num sched-h ${sl.length ? '' : 'mut'}">${sl.length ? fmt(h * 60) : 'Libre'}</span></div>`;
  }).join('');
  const tot = DAYS.reduce((a, _, i) => a + slotsHours(S.app, L.schedSlots(S.app, i)), 0);
  return `<section class="card"><h2>Tu horario habitual</h2><p class="sub">Doble clic en un hueco para añadir una franja. Arrástrala para moverla y tira de sus bordes para alargarla. Doble clic sobre una franja para escribir sus horas de estudio (hh:mm) o borrarla. Al marcar un día en el calendario coge el horario de su día de la semana.</p>
   <div class="sched"><div class="sched-r head"><span></span>${axis()}<span class="num sched-h mut">Estudio</span></div>${rows}</div>
   <div class="sched-foot"><div class="field"><span class="lbl">Descanso por hora de estudio</span>${seg({key: 'brkH', value: S.app.brkH ?? 0, label: 'Descanso por hora de estudio', options: [0, 5, 10, 15, 20].map(v => ({v, label: v + ' min'}))})}</div>
   <div class="tot"><span class="lbl">Total semanal</span><b>${fmt(tot * 60)}</b><small>de estudio, ya sin descansos</small></div></div>
   <div class="row-btns"><button class="btn ghost" data-applysched="1">Aplicar el horario a mis próximos días</button></div></section>`;
}
function daysBlock() {
  const days = [...S.app.days].sort((a, b) => a.d < b.d ? -1 : 1), lims = [...new Set(S.app.order.flatMap(i => {const s=S.subs[i];return s.limites&&s.limites.length?s.limites.map(l=>l.fecha):(s.limite?[s.limite]:[])}).filter(Boolean))];
  const [y, m] = month.split('-').map(Number), first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, len = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const nm = first.toLocaleDateString('es-ES', {timeZone: 'UTC', month: 'long', year: 'numeric'});
  let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<span>${d}</span>`).join('') + '<i></i>'.repeat(lead);
  for (let i = 1; i <= len; i++) {
    const d = month + '-' + pad(i), e = days.find(x => x.d === d), past = d < TODAY;
    cells += `<button class="cd ${e ? 'on' : ''} ${past && !e ? 'past' : ''} ${d === TODAY ? 'today' : ''} ${lims.includes(d) ? 'lim' : ''}" data-cal="${d}" ${past && !e ? 'disabled' : ''} aria-pressed="${!!e}" aria-label="${dayLabel(d)}${e ? ', ' + e.h + ' horas' : ''}">${i}<small>${e ? nh(e.h) : ''}</small></button>`;
  }
  const fut = days.filter(x => x.d >= TODAY && !S.app.closed[x.d]), sum = fut.reduce((a, x) => a + (+x.h || 0), 0);
  return `<section class="card"><h2>Tus días</h2><p class="sub">Pulsa un día para añadirlo o quitarlo. Deja el cursor encima de un día (o mantenlo pulsado en el móvil) para ver su información, y haz doble clic para editar sus franjas. El borde rojo marca una fecha límite.</p>
   <div class="fields">
    <div class="field"><span class="lbl">Horas si el día no tiene horario</span>${stepper({key: 'defH', value: S.app.defH, step: .25, min: .25, max: 16, fmt: hTxt, label: 'Horas si el día no tiene horario'})}</div>
    <div class="field"><span class="lbl">Máximo de horas al día</span>${stepper({key: 'maxH', value: S.app.maxH, step: .5, min: 1, max: 16, fmt: hTxt, label: 'Máximo de horas al día'})}</div>
    <div class="field"><span class="lbl">Fecha cercana: días antes</span>${chips({key: 'standby', value: S.app.standby ?? 30, label: 'Días de fecha cercana', options: [7, 14, 30, 60, 90].map(v => ({v, label: v + ' días'}))})}</div></div>
   <div class="cal big"><div class="cal-head"><button class="icon round" data-month="-1" aria-label="Mes anterior">‹</button><strong>${nm[0].toUpperCase() + nm.slice(1)}</strong><button class="icon round" data-month="1" aria-label="Mes siguiente">›</button></div><div class="cal-grid">${cells}</div>
   <div class="cal-sum"><span>${fut.length ? fut.length + (fut.length === 1 ? ' día por delante' : ' días por delante') : 'Sin días por delante. Toca días en el calendario.'}</span>${fut.length ? `<b class="num">${fmt(sum * 60)}</b>` : ''}</div></div></section>${dayModal()}`;
}
const plural = n => n.endsWith('s') ? n : n + 's';
/* Ficha de un día al dejar el cursor encima (o mantener pulsado en el móvil). */
function dayTipHTML(d) {
  const x = S.app.days.find(y => y.d === d), past = d < TODAY, wi = L.weekIdx(d), sch = L.schedSlots(S.app, wi);
  const lims = S.app.order.filter(i => {const s=S.subs[i];return s.limites&&s.limites.length?s.limites.some(l=>l.fecha===d):s.limite===d;}).map(i => S.subs[i].nombre);
  let body = '';
  if (!x) body = `<p>${past ? 'Día pasado sin estudio.' : 'Libre. Pulsa para añadirlo.'}</p>` + (!past && sch.length ? `<p class="mut">Tu horario de los ${plural(DAYS[wi].toLowerCase())}: ${sch.map(y => y.ini + '–' + y.fin).join(' · ')}</p>` : '');
  else {
    const al = allocate(S, TODAY), by = {};
    (al.plan[d] || []).filter(r => !r.done).forEach(r => {by[r.it.sid] = (by[r.it.sid] || 0) + r.m});
    const plan = Object.keys(by).map(id => `<li>${sw(id)}${esc(S.subs[id] ? S.subs[id].nombre : id)}<b class="num">${fmt(by[id])}</b></li>`).join('');
    body = `<div class="tip-big"><b>${fmt(x.h * 60)}</b><span>de estudio${S.app.closed[d] ? ' · terminado' : ''}</span></div>
      <p>${x.slots && x.slots.length ? x.slots.map(y => y.ini + '–' + y.fin).join(' · ') : 'Sin franjas: horas a mano'}</p>
      ${plan ? `<ul>${plan}</ul>` : `<p class="mut">${past ? 'Sin tareas registradas.' : 'Aún no hay tareas para este día.'}</p>`}`;
  }
  return `<h4>${dayLabel(d, {weekday: 'long', month: 'long'})}</h4>${body}${lims.length ? `<p class="neg">Fecha límite: ${lims.map(esc).join(', ')}</p>` : ''}${x || !past ? `<small>${x ? 'Doble clic para editar sus franjas' : 'Doble clic para añadirlo y editarlo'}</small>` : ''}`;
}
function dayModal() {
  const x = dayPop && S.app.days.find(y => y.d === dayPop);
  if (!x) {dayPop = null; return ''}
  const past = x.d < TODAY, has = x.slots && x.slots.length, sch = L.schedSlots(S.app, L.weekIdx(x.d));
  const hours = has || past ? `<span class="num dl-h big">${fmt(x.h * 60)}</span>` : stepper({key: 'dayh', id: x.d, value: x.h, step: .25, min: 0, max: 16, fmt: hTxt, label: 'Horas del ' + dayLabel(x.d)});
  return `<div class="modal-bg" data-modalbg="1"><div class="modal" role="dialog" aria-modal="true" aria-label="Franjas del ${dayLabel(x.d, {weekday: 'long', month: 'long'})}">
    <div class="modal-h"><h3>${dayLabel(x.d, {weekday: 'long', month: 'long'})}</h3><button class="icon round" data-dayclose="1" aria-label="Cerrar">×</button></div>
    <p class="sub">${past ? 'Día pasado: solo se puede consultar.' : 'Doble clic en un hueco para añadir una franja. Arrástrala, estírala por los bordes o haz doble clic sobre ella para escribir sus horas o borrarla.'}</p>
    <div class="modal-trk">${axis()}${slotsTrack({sk: 'day:' + x.d, slots: x.slots || [], app: S.app, edit: slotEdit, label: 'Franjas del ' + dayLabel(x.d), readonly: past})}</div>
    <div class="modal-f"><div class="field"><span class="lbl">${has ? 'Horas de estudio' : 'Horas de estudio (sin franjas)'}</span>${hours}</div>
    <div class="row-btns"><button class="btn danger sm" data-rm="${x.d}">Quitar este día</button>${!past && sch.length ? `<button class="btn ghost sm" data-dayreset="${x.d}">Usar mi horario de los ${plural(DAYS[L.weekIdx(x.d)].toLowerCase())}</button>` : ''}<button class="btn sm" data-dayclose="1">Listo</button></div></div>
  </div></div>`;
}
function propsBlock(ob) {
  if (!ob.need) return '';
  if (ob.miss <= 0) return `<div class="prop"><b>Objetivos alcanzados</b><small>Te sobran ${fmt(Math.max(0, allocate(S, TODAY).cap - ob.need))}.</small></div>` + undoBtn();
  const a = L.proposeStretch(S, TODAY), b = L.proposeNew(S, TODAY); props = {a, b};
  const gain = c => c.reduce((n, x) => n + x.to - x.from, 0), li = c => c.map(x => `<li>${dayLabel(x.d)}: ${x.from ? hh(x.from) + ' → ' : 'nuevo, '}${hh(x.to)}</li>`).join('');
  const card = (t, p, id, why) => `<div class="prop"><b>${t}: +${hh(gain(p.changes))}</b>${p.changes.length ? `<ul>${li(p.changes)}</ul>` : ''}${p.ok ? `<button class="btn" data-prop="${id}">Aplicar a mis días</button>` : `<small>${why}</small>`}</div>`;
  return card('Alargando tus días', a, 'a', 'No llega ni con el máximo de horas al día. Súbelo o añade días.') + card('Añadiendo días', b, 'b', 'No llega antes de las fechas límite. Baja el objetivo o saca tareas.') + undoBtn();
}
const warnList = al => {const k = Object.keys(al.warn || {}); return k.length ? `<div class="prop"><b>Mínimos que no caben</b><ul>${k.map(d => `<li>${dayLabel(d)}: suman ${fmt(al.warn[d].tot)} y hay ${fmt(al.warn[d].cap)}</li>`).join('')}</ul><small>Esos días no se aplican mínimos. Ajústalos o añade horas.</small></div>` : ''};
const undoBtn = () => undo ? '<button class="btn ghost" data-undo="1">Deshacer el último cambio de días</button>' : '';
function renderGeneral(al, ob) {
  const pct = S.app.mode === 'pct', tw = S.app.order.reduce((a, i) => a + (S.subs[i].activa === false ? 0 : +S.subs[i].pct || 0), 0);
  const rows = S.app.order.map((id, i) => {
    const s = S.subs[id], o = ob.list.find(x => x.sid === id);
    const w = subState(S, s, TODAY), tag = w === 'espera' ? '<span class="tagst">En espera</span>' : w === 'sin-tareas' ? '<span class="tagst w">Faltan tareas</span>' : w === 'pausa' ? '<span class="tagst">En pausa</span>' : '';
    const limLabel=s.limites&&s.limites.length>1?' · '+s.limites.map(l=>dayLabel(l.fecha)).join(', '):s.limite?' · hasta '+dayLabel(s.limite):'';
    return `<div class="pr"><div class="w"><b>${sw(id)}${esc(s.nombre)}${tag}</b><small>${w === 'espera' ? 'Sin tareas todavía' : w === 'sin-tareas' ? 'Su fecha se acerca' : w === 'pausa' ? 'No entra en el plan' : o && o.need ? (o.miss ? 'Faltan ' + fmt(o.miss) + ' de ' + fmt(o.need) : 'Llega · ' + fmt(o.need)) : 'Sin pendientes'}${limLabel}</small></div>
    <div class="pr-ctl"><div class="field"><span class="lbl">Mín. al día</span>${stepper({key: 'minsub', id, value: s.minDia || 0, step: .25, min: 0, max: 12, fmt: hTxt, label: 'Mínimo diario de ' + s.nombre, size: 'sm'})}</div>
    ${pct ? `<div class="field"><span class="lbl">Parte</span>${stepper({key: 'pct', id, value: s.pct || 0, step: 5, min: 0, max: 100, fmt: v => v + ' %', label: 'Porcentaje de ' + s.nombre, size: 'sm'})}</div>` : `<div class="field"><span class="lbl">Prioridad</span>${seg({key: 'sprio', id, value: s.prio, options: PRIO, label: 'Prioridad de ' + s.nombre, size: 'sm'})}</div>`}
    ${toggle({key: 'active', id, value: s.activa !== false, label: 'Activa'})}
    <div class="updown"><button class="icon round" data-subup="${esc(id)}" data-d="-1" aria-label="Subir ${esc(s.nombre)}" ${i ? '' : 'disabled'}>↑</button><button class="icon round" data-subup="${esc(id)}" data-d="1" aria-label="Bajar ${esc(s.nombre)}" ${i < S.app.order.length - 1 ? '' : 'disabled'}>↓</button></div></div></div>`;
  }).join('');
  const welcome = S.app.order.length ? '' : `<section class="card"><h2>Empieza aquí</h2><p class="sub">Ajusta tu horario y marca tus días. Después pulsa <b>+ Añadir</b>, copia el prompt, pásalo a tu IA con tus materiales y pega el resultado: la hoja reparte tu tiempo y aparece en Plan, Sesión y Mis datos.</p>
   <div class="row-btns"><button class="btn" data-goadd="1">Añadir la primera asignatura</button><button class="btn ghost" data-sample="1">Probar con Estructuras de ejemplo</button></div></section>`;
  $('main').innerHTML = `<div class="cfg"><div>${welcome}${scheduleBlock()}${daysBlock()}
   <section class="card"><h2>Reparto</h2>${seg({key: 'mode', value: S.app.mode, label: 'Modo de reparto', options: [{v: 'prio', label: 'Prioridad y fecha'}, {v: 'pct', label: 'Porcentajes'}]})}
    <p class="sub">${pct ? 'Primero se cubren los mínimos. El resto del día se reparte con estos porcentajes.' : 'Primero se cubren los mínimos. El resto va a lo más prioritario, y si una fecha límite corre peligro, lo que vence antes pasa delante.'} Cada asignatura es un solo bloque al día y las más importantes van antes.</p>
    ${pct && tw !== 100 ? `<p class="sub neg">Los porcentajes suman ${tw} %. Se reparte en proporción, aunque no sumen 100.</p>` : ''}
    ${rows ? `<div class="ptable">${rows}</div>` : '<div class="empty">Todavía no hay asignaturas. Añádelas con + Añadir.</div>'}
    ${toggle({key: 'useRitmo', value: !!S.app.useRitmo, label: 'Corregir lo que queda con mi ritmo real'})}</section>${accountBlock()}</div>
   <aside class="side"><h2>Cuántas horas añadir</h2>${propsBlock(ob) || '<p class="sub">Añade asignaturas y días para ver el balance.</p>'}
    ${al.late.length ? `<p class="sub neg">${al.late.length} ${al.late.length === 1 ? 'tarea no llega' : 'tareas no llegan'} antes de su fecha límite.</p>` : ''}${warnList(al)}</aside></div>`;
}

/* ---------- Asignatura ---------- */
function renderSubject(al, ob) {
  const s = S.subs[scope], o = ob.list.find(x => x.sid === scope), items = buildItems(S, TODAY).filter(i => i.sid === scope);
  const t = o && o.t, lad = o ? o.rows.map((r, i) => {
    const st = r.ok === r.n ? '<span class="st ok">Cabe</span>' : r.ok ? `<span class="st part">${r.ok}/${r.n} · +${fmt(r.miss)}</span>` : `<span class="st no">+${fmt(r.miss)}</span>`;
    return `<label class="lr ${r === t ? 'tg' : ''}" for="tg-${i}"><input type="radio" name="target" id="tg-${i}" data-target="${esc(r.key)}" ${r === t ? 'checked' : ''}><span class="w"><span>${chip(r.lvl)}${esc(r.name)}</span><small>${r.n} ${r.n === 1 ? 'tarea' : 'tareas'} · ${fmt(r.m)}</small></span>${st}</label>`;
  }).join('') : '';
  const groups = s.grupos.map((g, i) => {
    const l = items.filter(x => x.gid === g.id), rec = g.tipo === 'recurrente', dia = g.tipo === 'diaria', open = expanded.has(scope + g.id), lv = rec || dia || g.sim ? [l[0] ? l[0].lvl : g.prio] : [...new Set(l.map(x => x.lvl))], mix = lv.length > 1, m = rec ? g.minSem : dia ? g.minDia : (g.tareas||[]).reduce((a, t) => a + (t.minDia ? 0 : +s.mins[scope + '/' + t.id] || t.min), 0);
    const ts = g.tareas || [], nT = ts.length, isD = t => !!(s.done && s.done[scope + '/' + t.id]), nD = ts.filter(isD).length;
    const mLeft = ts.filter(t => !isD(t) && !t.minDia).reduce((a, t) => a + (+s.mins[scope + '/' + t.id] || t.min), 0), allD = nT > 0 && nD === nT;
    const cnt = `${nT} ${nT === 1 ? 'tarea' : 'tareas'}`;
    const nOpen = ts.filter(t => t.minDia && !isD(t)).length;
    const sub = rec ? `${fmt(g.minSem)} por semana` : dia ? `${fmt(g.minDia)} al día${g.det?' · '+esc(g.det):''}` : (allD ? `${cnt} · <span class="okc">${nT === 1 ? 'hecha' : 'todas hechas'}</span>` : nD ? `${cnt} · ${nD} ${nD === 1 ? 'hecha' : 'hechas'}${mLeft ? ' · quedan ' + fmt(mLeft) : ''}` : `${cnt}${m ? ' · ' + fmt(m) : ''}`) + (nOpen ? ` · ${nOpen} de cada día` : '') + (g.freq ? ' · ' + esc(g.freq) : '');
    const tasks = !rec && !dia ? (g.tareas||[]).map(t => {
      const k = scope + '/' + t.id, dn = s.done && s.done[k];
      const chk = g.sim ? '' : `<button type="button" class="dv-chk" data-sdone="${esc(k)}" aria-pressed="${!!dn}" aria-label="${dn ? 'Desmarcar ' : 'Marcar hecha '}${esc(t.nombre)}">${CHECK}</button>`;
      return `<div class="si ${dn ? 'done' : ''}">${chk}<div class="w"><span>${esc(t.nombre)}</span><small>${dn ? `<span class="okc">${t.minDia ? 'Acabada' : 'Hecha'}${L.isDate(dn) ? ' el ' + dayLabel(dn) : ''}</span>${t.det ? ' · ' : ''}` : t.minDia ? `Cada día hasta acabarla${t.desde ? ', desde el ' + dayLabel(t.desde) : ''}${t.det ? ' · ' : ''}` : ''}${esc(t.det)}${t.limite && !dn ? ' · hasta ' + dayLabel(t.limite) : ''}${t.dep.length ? ' · tras ' + t.dep.map(esc).join(', ') : ''}</small></div>
      <div class="si-ctl">${stepper({key: 'min', id: k, base: t.minDia || t.min, value: +s.mins[k] || t.minDia || t.min, step: 5, min: 5, max: 900, fmt: v => v + (t.minDia ? ' min/día' : ' min'), label: (t.minDia ? 'Minutos al día de ' : 'Minutos de ') + t.nombre, size: 'sm'})}
      ${g.sim ? '' : seg({key: 'ilvl', id: k, value: s.lvl[k] ?? t.prio ?? g.prio, options: PRIO4, label: 'Prioridad de ' + t.nombre, size: 'xs'})}${t.manual ? `<button class="icon round" data-delman="${esc(k)}" aria-label="Quitar ${esc(t.nombre)}">×</button>` : ''}</div></div>`;
    }).join('') : '';
    return `<div class="pr grp ${allD ? 'done' : ''}">${rec || dia ? '<span class="exp"></span>' : `<button class="exp" data-exp="${esc(g.id)}" aria-expanded="${open}" aria-label="Desplegar ${esc(g.nombre)}"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${open ? 'M5 8l5 5 5-5' : 'M8 5l5 5-5 5'}"/></svg></button>`}
     <div class="w"><b>${esc(g.nombre)}</b><small>${sub}</small></div>
     <div class="pr-ctl">${dia ? toggle({key:'diariadone',id:g.id,value:!!(s.done&&s.done[scope+'/'+g.id]),label:'Marcar como acabada'}) : seg({key: 'glvl', id: g.id, value: mix ? '' : lv[0], options: PRIO4, label: 'Prioridad de ' + g.nombre + (mix ? ' (mixta)' : ''), size: 'xs'})}
     <div class="updown"><button class="icon round" data-gmv="${esc(g.id)}" data-d="-1" aria-label="Subir ${esc(g.nombre)}" ${i ? '' : 'disabled'}>↑</button><button class="icon round" data-gmv="${esc(g.id)}" data-d="1" aria-label="Bajar ${esc(g.nombre)}" ${i < s.grupos.length - 1 ? '' : 'disabled'}>↓</button></div></div></div>
     ${open && !rec && !dia ? `<div class="sub-items">${g.manual ? '' : `<div class="si">${toggle({key: 'sim', id: g.id, value: !!g.sim, label: 'Simulacro: todo el mismo día con un solo temporizador'})}</div>`}${tasks}</div>` : ''}`;
  }).join('');
  $('main').innerHTML = `<div class="cfg"><div>
   <section class="card"><h2>${esc(s.nombre)}</h2><div class="fields">
    <div class="field wide"><label class="lbl" for="f-nombre">Nombre</label><input id="f-nombre" type="text" value="${esc(s.nombre)}"></div>
    ${s.limites&&s.limites.length>1 ? s.limites.map(l=>`<div class="field"><span class="lbl">${esc(l.nombre)}</span><span class="num" style="font-size:.85em">${l.fecha?dayLabel(l.fecha):'—'}</span><span class="lbl" style="margin-left:8px">Empezar</span>${stepper({key:'limEmpezar',id:l.id,value:l.empezarAntes||0,step:1,min:0,max:365,fmt:v=>v?v+' días antes':'El mismo día',label:'Días antes de '+esc(l.nombre),size:'sm'})}</div>`).join('') : `<div class="field"><span class="lbl">Fecha límite</span>${datePick({key:'limite',value:s.limite,open:pick==='limite|',month:pickMonth,today:TODAY,label:'Fecha límite de '+s.nombre})}</div>${s.limites&&s.limites[0]?`<div class="field"><span class="lbl">Empezar antes</span>${stepper({key:'limEmpezar',id:(s.limites[0]||{id:'examen'}).id,value:(s.limites[0]||{empezarAntes:0}).empezarAntes||0,step:1,min:0,max:365,fmt:v=>v?v+' días antes':'El mismo día',label:'Días antes de la fecha límite',size:'sm'})}</div>`:''}`}
    <div class="field"><span class="lbl">Prioridad</span>${seg({key: 'prio', value: s.prio, options: PRIO, label: 'Prioridad de ' + s.nombre})}</div>
    <div class="field"><span class="lbl">Mínimo al día</span>${stepper({key: 'minDia', value: s.minDia || 0, step: .25, min: 0, max: 12, fmt: hTxt, label: 'Mínimo de horas al día'})}</div>
    <div class="field wide"><span class="lbl">Reservar para revisar: <b>${s.revPct || 0} %</b></span>${blocks({key: 'revPct', value: Math.min(50, s.revPct || 0), values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50], label: 'Porcentaje para revisar', fmt: v => v + ' %'})}</div></div>
    ${toggle({key: 'revDef', value: !!s.revDef, label: 'Las tareas tienen fase de revisión'})}
    <div class="row-btns"><button class="btn ghost" data-update="1">Actualizar con texto nuevo</button><button class="btn ghost" data-export="1">Copiar texto actual</button><span class="status" id="copied"></span>${confirmDel ? `<button class="btn warn" data-del="2">Sí, eliminar ${esc(s.nombre)}</button><button class="btn ghost" data-del="0">Cancelar</button>` : '<button class="btn ghost" data-del="1">Eliminar</button>'}</div></section>
   <section class="card"><h2>Prioridades y tiempos</h2><p class="sub">A, M y B son alta, media y baja y deciden el orden. F saca la tarea del plan. El orden de los grupos con ↑ ↓ cuenta dentro de cada prioridad.</p>${groups ? `<div class="ptable">${groups}</div>` : '<div class="empty">Sin tareas todavía. Añade una aquí o actualiza con un texto de la IA.</div>'}${manualForm(scope)}</section></div>
   <aside class="side"><h2>Hasta dónde llegas</h2><p class="sub">Elige hasta qué fila es tu objetivo en ${esc(s.nombre)}.</p><div class="lad">${lad || '<div class="empty">Nada pendiente.</div>'}</div></aside></div>`;
}
function subOptions() {return S.app.order.map(id => ({v: id, label: S.subs[id].nombre, sw: colorOf(id)}))}
function manualForm(fixed, day) {
  if (!fixed && !S.subs[ma.sid]) ma.sid = S.app.order[0] || '';
  const dia = ma.tipo === 'dia';
  return `<div class="addbox">${fixed ? '' : `<div class="field wide"><span class="lbl">Asignatura</span>${chips({key: 'maSub', value: ma.sid, options: subOptions(), label: 'Asignatura de la tarea'})}</div>`}
   <div class="field wide"><label class="lbl" for="ma-nom">Tarea</label><input id="ma-nom" type="text" value="${esc(ma.nom)}" placeholder="Qué hay que hacer"></div>
   <div class="field wide"><span class="lbl">Cuándo</span>${seg({key: 'maTipo', value: ma.tipo, options: TIPO, label: 'Cuándo se hace'})}</div>
   <div class="field"><span class="lbl">${dia ? 'Rato al día' : 'Minutos aprox.'}</span>${stepper({key: 'maMin', value: ma.min, step: 5, min: 5, max: 600, fmt: v => v + (dia ? ' min al día' : ' min'), label: dia ? 'Minutos al día' : 'Minutos aproximados'})}</div>
   <div class="field"><span class="lbl">Prioridad</span>${seg({key: 'maPri', value: ma.pri, options: PRIO, label: 'Prioridad de la tarea'})}</div>
   ${dia ? `<p class="sub">Sale cada día de estudio${day ? ' desde el ' + dayLabel(day) : ''} con ese rato, hasta que la marques acabada.</p>` : day ? `<p class="sub">Se queda fija el ${dayLabel(day)}.</p>` : ''}
   <div class="row-btns"><button class="btn" data-addman="${esc(fixed || '')}"${day ? ` data-day="${day}"` : ''}>Añadir tarea</button>${day ? '<button type="button" class="btn ghost" data-dvaddtask="0">Cancelar</button>' : ''}<span class="status neg">${esc(formErr)}</span></div></div>`;
}

/* ---------- Plan ---------- */
function rowHTML(r, day) {
  const it = r.it, done = !!r.done, c = it.sid, first = r.part <= 1, tag = first ? '' : '-' + r.part, real = S.subs[c].real[it.key] || '';
  const part = r.part ? ` Parte ${r.part} de ${r.parts}: ${fmt(r.m)} de ${fmt(r.total)}${r.nextDay ? ', sigue el ' + dayLabel(r.nextDay) : ''}.` : '';
  const name = esc(it.name) + (it.extra ? ' · fuera del plan' : '');
  const sid = it.key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `<div class="row ${done ? 'done' : ''}"><label><input type="checkbox" class="chk" id="c-${sid}${tag}" data-done="${esc(it.key)}" data-day="${day}" ${done ? 'checked' : ''}><span><span class="t">${chip(it.lvl || 1)}${name}</span><span class="n">${esc(it.det)}${it.det ? '.' : ''}${part}${it.limit && !done ? ' Hasta ' + dayLabel(it.limit) + '.' : ''}</span></span></label><div class="e">${fmt(r.m)}</div>${first ? `<input type="text" inputmode="numeric" class="realin" id="r-${sid}" data-real="${esc(it.key)}" aria-label="Minutos reales de ${esc(it.name)}" placeholder="min" value="${real}">` : '<span></span>'}</div>`;
}
function renderPlan(al) {
  const f = r => scope === 'general' || r.it.sid === scope, past = (S.app.days.length ? al.days : []).map(x => ({...x, raw: S.app.days.find(y => y.d === x.d)}));
  const cards = past.map(x => {
    const all = al.plan[x.d].filter(f), rows = all.filter(r => !r.done), dn = all.filter(r => r.done), capM = x.h * 60, sum = {}; rows.forEach(r => sum[r.it.sid] = (sum[r.it.sid] || 0) + r.m);
    const tot = rows.reduce((a, r) => a + r.m, 0), free = x.closed ? 0 : al.rem[x.d];
    if (scope !== 'general' && !all.length) return '';
    const sl = x.raw && x.raw.slots && x.raw.slots.length ? x.raw.slots.map(y => y.ini + '–' + y.fin).join(' · ') : '';
    return `<article class="session"><div class="s-head"><h3>${dayLabel(x.d, {weekday: 'long', month: 'long'})}</h3><span class="num">${sl ? sl + ' · ' : ''}${fmt(tot)} de ${fmt(capM)}</span>
     ${x.d < TODAY ? '<span class="num">Pasado</span>' : toggle({key: 'closed', id: x.d, value: !!S.app.closed[x.d], label: 'Terminado'})}</div>
     <div class="fill">${Object.keys(sum).map(id => `<i style="width:${capM ? Math.min(100, 100 * sum[id] / capM) : 0}%;background:${colorOf(id)}"></i>`).join('')}</div>
     ${al.warn && al.warn[x.d] ? `<div class="warn">Los mínimos suman ${fmt(al.warn[x.d].tot)} y hay ${fmt(al.warn[x.d].cap)}. Hoy no se aplican.</div>` : ''}
     ${rows.length ? '<div class="cols"><span>Tarea</span><span>Estimado</span><span>Real (min)</span></div>' : ''}${dayBlocks(S.app, x.raw, rows).filter(b => scope === 'general' || b.sid === scope).map(b => `<div class="blk">${sw(b.sid)}${esc(b.name)}<span class="num">${b.ini !== null ? toTime(b.ini) + ' a ' + toTime(b.fin) + ' · ' : ''}${fmt(b.m)}</span></div>${b.rows.map(r => rowHTML(r, x.d)).join('')}`).join('')}
     ${dn.length ? `<div class="dv-hechas plan"><button type="button" class="dv-hbtn" data-hechas="${x.d}" aria-expanded="${hOpen.has(x.d)}"><span>Hechas</span><b class="num">${dn.length}</b><i aria-hidden="true">›</i></button>${hOpen.has(x.d) ? dn.map(r => rowHTML(r, x.d)).join('') : ''}</div>` : ''}
     ${free > 0 && scope === 'general' ? `<div class="free">Libre: ${fmt(free)}</div>` : ''}</article>`;
  }).join('');
  const lost = al.lost.filter(l => scope === 'general' || l.it.sid === scope);
  const its = buildItems(S, TODAY).filter(i => (scope === 'general' || i.sid === scope) && i.lvl > 0), de = its.filter(i => i.done).length;
  const rit = scope === 'general' ? null : L.pace(S, scope);
  $('main').innerHTML = `<section><h2>Plan por días</h2><div class="stats"><div><b class="num">${de}/${its.length}</b><small>tareas hechas</small></div><div><b>${fmt(al.cap)}</b><small>te quedan en días abiertos</small></div><div><b>${fmt(lost.reduce((a, l) => a + l.left, 0))}</b><small>sin sitio en el plan</small></div>${rit ? `<div><b class="num">×${dec(rit.ritmo, 2)}</b><small>${rit.logged ? 'tu ritmo frente a lo estimado' : 'ritmo, sin datos aún'}</small></div>` : ''}</div>
    <p class="sub">Marca cada tarea o deja que lo haga la Sesión. Lo pendiente de un día pasado o terminado se mueve solo al siguiente hueco.</p>
    ${planAdd ? manualForm(scope === 'general' ? '' : scope) : '<div class="row-btns"><button class="btn ghost" data-planadd="1">Añadir tarea</button></div>'}
    <div class="sessions">${cards || '<div class="empty">Añade días en General · Configuración.</div>'}</div></section>
   ${lost.length ? `<section><h2>${lost.length === 1 ? 'Se queda fuera 1 tarea' : 'Se quedan fuera ' + lost.length + ' tareas'}</h2><div class="outlist">${lost.map(l => `<div class="row"><div><div class="t">${chip(l.it.lvl)}${esc(l.it.subName)} · ${esc(l.it.name)}</div><div class="n">${l.late ? 'No llega antes de su fecha límite.' : esc(l.it.det)}</div></div><div class="e">${fmt(l.left)}</div></div>`).join('')}</div></section>` : ''}`;
}

/* ---------- Sesión ---------- */
const PHASE = {do: 'Hacer', review: 'Revisar', break: 'Descanso', pause: 'Pausa', free: 'Sin tareas'};
const STATE = {do: 'Estudiando', review: 'Revisando', break: 'Descanso', pause: 'En pausa', free: 'Sin tareas'};
function extraForm() {
  if (!S.subs[ex.sid]) ex.sid = S.app.run && S.subs[S.app.run.sid] ? S.app.run.sid : (S.app.order[0] || '');
  const dia = ex.tipo === 'dia';
  return `<div class="addbox"><div class="field wide"><span class="lbl">Asignatura</span>${chips({key: 'exSub', value: ex.sid, options: subOptions(), label: 'Asignatura'})}</div><div class="field wide"><label class="lbl" for="ex-nom">Qué vas a hacer</label><input id="ex-nom" type="text" value="${esc(ex.nom)}"></div>
   <div class="field wide"><span class="lbl">Cuánto dura</span>${seg({key: 'exTipo', value: ex.tipo, options: [{v: 'hoy', label: 'Solo ahora'}, {v: 'dia', label: 'Varios días'}], label: 'Cuánto dura'})}</div>
   ${dia ? `<div class="field"><span class="lbl">Rato al día</span>${stepper({key: 'exMin', value: ex.min, step: 5, min: 5, max: 600, fmt: v => v + ' min al día', label: 'Minutos al día'})}</div><p class="sub">Seguirá saliendo cada día hasta que pulses «Acabada».</p>` : '<p class="sub">Sin tiempo previsto: cuenta lo que tardes y se cierra al acabar la sesión.</p>'}
   <div class="row-btns"><button class="btn" data-extra="1">${dia ? 'Empezar' : 'Empezar con cronómetro'}</button><span class="status neg">${esc(formErr)}</span></div></div>`;
}
function renderSession(al) {
  const v = $('main'), r = S.app.run, now = Date.now();
  if (!r) {
    const closed = S.app.lastDay === TODAY && S.app.closed[TODAY], rows = (al.plan[TODAY] || []).filter(x => !x.done), day = S.app.days.find(x => x.d === TODAY);
    if (closed) {
      const o = L.stats(S, TODAY, now).days.find(x => x.d === TODAY) || {dom: 0, rev: 0, brk: 0, tasks: 0, plan: 0};
      v.innerHTML = `<div class="focus"><div class="phase">Día terminado</div><h2>${dayLabel(TODAY, {weekday: 'long', month: 'long'})}</h2><div class="big" style="font-size:clamp(70px,16vw,150px)">${fmt(o.dom + o.rev)}</div><p>de estudio, frente a ${fmt(o.plan)} previstas. ${fmt(o.brk)} de descanso y ${o.tasks} ${o.tasks === 1 ? 'tarea acabada' : 'tareas acabadas'}.</p><div class="actions"><button class="btn" data-view="datos">Ver mis datos</button><button class="btn alt" data-act="go">Seguir estudiando hoy</button></div></div>`; return;
    }
    const nx = L.nextKey(S, TODAY, null), blocks = day ? dayBlocks(S.app, day, rows) : [];
    v.innerHTML = `<div class="focus"><div class="phase">${dayLabel(TODAY, {weekday: 'long', month: 'long'})}</div><h2>${nx ? 'Lo siguiente: ' + esc(nx.subName) + ' · ' + esc(nx.name) : 'No queda nada pendiente'}</h2>
     <p>${day ? `Hoy tienes ${fmt(day.h * 60)} de estudio${blocks.length ? ': ' + blocks.map(b => esc(b.name) + (b.ini !== null ? ' a las ' + toTime(b.ini) : '')).join(', luego ') : ''}.` : 'Hoy no está entre tus días. Al empezar se añade con tu horario.'}</p>
     <div class="actions"><button class="btn" data-act="go">Empezar día</button></div></div>`; return;
  }
  const c = L.clock(S, now, TODAY), it = c.it, ph = r.phase, brk = ph === 'break', pa = ph === 'pause', from = r.back, nxt = L.nextKey(S, r.day, r.sid, r.key);
  const base = pa ? r.pb.phase : (brk ? from : ph), toRev = base === 'do' && it && it.rev, op = it && it.open, lbl = op ? 'Por hoy' : toRev ? 'Siguiente: revisar' : 'Tarea acabada';
  const fin = op ? '<button class="btn alt" data-act="finopen">Acabada</button>' : '';
  let b = '';
  if (pa) b = '<button class="btn" data-act="unpause">Reanudar</button><button class="btn ghost" data-act="end">Acabar día</button>';
  else if (parar) b = '<button class="btn" data-act="pause">Pausa</button><button class="btn alt" data-act="end">Acabar día</button><button class="btn ghost" data-act="noparar">Cancelar</button>';
  else {
    if (ph === 'do' || ph === 'review') b = `<button class="btn" data-act="next">${lbl}</button>${fin}<button class="btn alt" data-act="break">Descanso</button>`;
    if (brk) b = `<button class="btn" data-act="resume">Reanudar</button><button class="btn alt" data-act="next">${lbl}</button>`;
    b += '<button class="btn ghost" data-act="parar">Parar</button>';
  }
  const stale = r.day < TODAY ? `<div class="banner"><span>Esta sesión sigue abierta desde el ${dayLabel(r.day)}.</span><div class="row-btns"><button class="btn alt" data-act="carry">Seguir hoy</button><button class="btn alt" data-act="discard">Cerrarla sin contar el último tramo</button></div></div>` : '';
  const pend = al.pend.filter(p => p.it.key !== r.key).slice(0, 80);
  const changes = nxt && nxt.sid !== r.sid;
  v.innerHTML = stale + `<div class="focus" data-phase="${ph === 'free' ? '' : ph}"><div class="state"><i></i>${STATE[ph]}</div><div class="phase">${it ? esc(it.subName) : ''}${brk ? ' · parado en ' + PHASE[from].toLowerCase() : ''}${pa ? ' · parado en ' + PHASE[base === 'break' ? 'break' : base].toLowerCase() : ''}${it && it.extra ? ' · fuera del plan' : ''}${op ? ' · ' + fmt(it.m) + ' al día hasta que la acabes' : ''}</div>
    <h2>${it ? esc(it.name) : 'Has acabado lo previsto'}</h2>${it && it.det ? `<p>${esc(it.det)}</p>` : ''}${it ? '' : '<p>Si sigues estudiando, añade abajo lo que vas a hacer. Si no, pulsa Parar.</p>'}
    <div class="big" id="bigT"></div><div class="bigsub" id="bigS"></div><div class="actions">${b}</div></div>
   <div class="minis"><div><small>Estudio hoy</small><b id="miStudy"></b></div><div><small>Descanso hoy</small><b id="miBreak"></b></div><div><small>Esta tarea</small><b id="miTask"></b></div><div><small>${changes ? 'Después cambias a' : 'Después'}</small><span class="nx">${nxt ? esc(nxt.subName) + ' · ' + esc(nxt.name) : 'Nada más pendiente'}</span></div></div>
   <div class="row-btns">${it ? `<button class="btn ghost" data-showextra="1">Tarea fuera del plan</button><button class="btn ghost" data-act="minus5">Quitar 5 min a este tramo</button>` : ''}</div>
   ${showExtra || !it ? extraForm() : ''}
   ${it && pend.length ? `<div class="aux"><div class="field wide"><span class="lbl">Cambiar de tarea</span>${menu({key: 'switchTask', value: '', open: menuOpen === 'switchTask|', placeholder: 'Elige otra tarea', label: 'Cambiar de tarea', options: pend.map(p => ({v: p.it.key, label: p.it.name, sub: p.it.det, sw: colorOf(p.it.sid), group: p.it.subName}))})}</div></div>` : ''}`;
}
function tick() {
  const r = S.app.run, now = Date.now(), b = $('startBtn');
  checkAlerts(now);
  b.textContent = 'Empezar día'; b.hidden = view === 'sesion' || !!r;
  if (r && $('rbT')) {
    const c = L.clock(S, now, TODAY), lib = c.it && c.it.libre, base = r.phase === 'pause' ? r.pb.phase : r.phase;
    const t = base === 'do' ? (lib ? c.doM : c.left) : base === 'review' ? c.rev : c.cur;
    $('rbT').textContent = L.fmtClock(t); $('rbT').classList.toggle('over', base === 'do' && !lib && c.left < 0);
  }
  if (!r || !$('bigT')) return;
  const c = L.clock(S, now, TODAY); let big = 0, sub = '', over = false;
  const lib = c.it && c.it.libre, base = r.phase === 'pause' ? r.pb.phase : r.phase;
  if (r.phase === 'pause') {big = base === 'review' ? c.rev : base === 'break' ? c.cur : lib ? c.doM : c.left; sub = 'En pausa desde hace ' + L.fmtClock(c.cur) + '. No cuenta como estudio ni como descanso'}
  else if (r.phase === 'do') {if (lib) {big = c.doM; sub = 'Cronómetro. Cuenta como estudio de ' + c.it.subName} else {big = c.left; over = c.left < 0; sub = over ? '<span class="pill">Tiempo superado</span>' : 'Queda de ' + fmt(c.it ? c.it.m : 0)}}
  else if (r.phase === 'review') {big = c.cur; sub = 'Revisión sin límite. Cuenta como estudio'}
  else if (r.phase === 'break') {big = c.cur; sub = 'Estudio y tarea parados'}
  $('bigT').textContent = L.fmtClock(big); $('bigS').innerHTML = sub.startsWith('<') ? sub : esc(sub);
  const day = S.app.days.find(x => x.d === r.day);
  const put = (id, t) => {const el = $(id); if (el) el.textContent = t};
  put('miStudy', L.fmtClock(c.sDay) + (day ? ' de ' + fmt(day.h * 60) : '')); put('miBreak', L.fmtClock(c.bDay)); put('miTask', L.fmtClock(c.doM) + ' + ' + L.fmtClock(c.rev) + ' rev.');
}

/* ---------- Datos ---------- */
function renderData() {
  const sc = scope === 'general' ? null : scope, o = L.stats(S, TODAY, Date.now(), sc), v = $('main');
  if (!o.study && !o.brk) {v.innerHTML = '<section><h2>Mis datos</h2><div class="empty">Aún no hay datos. Pulsa Empezar día y aquí irán apareciendo tus horas reales, los descansos y lo que tardas frente a lo estimado.</div></section>'; return}
  const dev = o.estT ? o.domT / o.estT - 1 : 0, hrs = o.study / 60;
  const t = [[fmt(o.study), 'de estudio real'], ...(sc ? [] : [[fmt(o.planned), 'previstas hasta hoy'], [(o.planned ? Math.round(100 * o.study / o.planned) : 0) + ' %', 'de lo previsto cumplido']]), [fmt(o.brk), 'en descanso'], [fmt(o.meanStint), 'de media sin descanso'], [fmt(o.maxStint), 'tu bloque más largo'], [o.breaks.length ? fmt(o.meanBreak) : '—', 'de media por descanso'], [(o.study ? Math.round(100 * o.study / (o.study + o.brk)) : 0) + ' %', 'del tiempo sentado es estudio'], [fmt(o.rev), 'revisando, ' + (o.dom ? Math.round(100 * o.rev / o.dom) : 0) + ' % sobre lo hecho'], [fmt(o.paus), 'en pausa, no cuenta'], [fmt(o.extraMin), (o.extraN === 1 ? '1 tarea' : o.extraN + ' tareas') + ' fuera del plan'], [String(o.nt), 'tareas acabadas con temporizador'], [hrs ? dec(o.nt / hrs, 1) : '0', 'tareas por hora'], [o.nt ? (dev >= 0 ? '+' : '−') + Math.abs(Math.round(dev * 100)) + ' %' : '—', o.nt ? 'tardas frente a lo estimado, sin revisar' : 'desviación, sin tareas acabadas']].map(([a, b]) => `<div><b>${a}</b><small>${b}</small></div>`).join('');
  const days = sc ? o.days.filter(d => d.logged) : o.days, max = Math.max(1, ...days.map(d => Math.max(d.plan, d.dom + d.rev + d.brk))), pc = m => (100 * m / max * .76) + '%';
  const bar = d => {
    const subs = Object.keys(d.bySub).map(id => `<i style="width:${pc(d.bySub[id])};background:${colorOf(id)}" title="${esc(S.subs[id] ? S.subs[id].nombre : id)}: ${fmt(d.bySub[id])}"></i>`).join('');
    return `<div class="dr"><span>${dayLabel(d.d)}</span><div class="dbars">${sc ? '' : `<div class="db"><i class="pj" style="width:${pc(d.plan)}"></i><em>${fmt(d.plan)}</em></div>`}<div class="db">${subs}<i style="width:${pc(d.brk)};background:var(--track)"></i><em>${d.logged ? fmt(d.dom + d.rev) + ' + ' + fmt(d.brk) + ' de descanso' : ''}</em></div></div></div>`;
  };
  const sb = sc ? '' : Object.keys(o.bySub).sort((a, b) => o.bySub[b] - o.bySub[a]).map(id => `<tr><td>${S.subs[id] ? sw(id) + esc(S.subs[id].nombre) : esc(id)}</td><td class="r">${fmt(o.bySub[id])}</td><td class="r">${Math.round(100 * o.bySub[id] / o.study)} %</td></tr>`).join('');
  const rows = o.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="r">${r.n}</td><td class="r">${fmt(r.est)}</td><td class="r">${fmt(r.dom)}</td><td class="r">${fmt(r.rev)}</td><td class="r ${r.dom > r.est ? 'neg' : 'pos'}">${r.est ? (r.dom >= r.est ? '+' : '−') + Math.abs(Math.round(100 * (r.dom / r.est - 1))) + ' %' : '—'}</td></tr>`).join('');
  const dt = o.days.filter(d => d.logged).map(d => `<tr><td>${dayLabel(d.d)}</td>${sc ? '' : `<td class="r">${fmt(d.plan)}</td>`}<td class="r">${fmt(d.dom + d.rev)}</td><td class="r">${fmt(d.rev)}</td><td class="r">${fmt(d.brk)}</td><td class="r">${d.tasks}</td></tr>`).join('');
  v.innerHTML = `<section><h2>Mis datos${sc ? ' de ' + esc(S.subs[sc].nombre) : ''}</h2><div class="tiles">${t}</div></section>
   <section class="card"><h2>${sc ? 'Por día' : 'Previsto frente a real'}</h2><div class="legend"><span>${sc ? '' : 'Barra hueca: previsto. '}Barra de color: estudio por asignatura. Gris: descanso.</span></div><div class="dchart">${days.map(bar).join('')}</div></section>
   ${sb ? `<section><h2>Por asignatura</h2><div class="tw"><table style="min-width:360px"><thead><tr><th>Asignatura</th><th class="r">Estudio</th><th class="r">Parte</th></tr></thead><tbody>${sb}</tbody></table></div></section>` : ''}
   <section><h2>Tabla por día</h2><div class="tw"><table><thead><tr><th>Día</th>${sc ? '' : '<th class="r">Previsto</th>'}<th class="r">Estudio</th><th class="r">Revisión</th><th class="r">Descanso</th><th class="r">Tareas</th></tr></thead><tbody>${dt}</tbody></table></div></section>
   ${rows ? `<section><h2>Estimado frente a real</h2><p class="sub">Solo tareas acabadas con el temporizador. La desviación compara hacer con lo estimado.</p><div class="tw"><table><thead><tr><th>${sc ? 'Grupo' : 'Asignatura'}</th><th class="r">Tareas</th><th class="r">Estimado</th><th class="r">Hacer</th><th class="r">Revisión</th><th class="r">Desviación</th></tr></thead><tbody>${rows}</tbody></table></div></section>` : ''}`;
}
function wake() {try {if (S.app.run && S.app.run.phase !== 'break' && navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {})} catch (e) {}}

/* ---------- Guardado ---------- */
let db = null, saved = {}, dirty = false, saving = false, timer = null;
function docs() {
  const o = {'app/estado': S.app};
  for (const id of Object.keys(S.subs)) o['asig/' + id] = S.subs[id];
  for (const k of Object.keys(S.log)) o['log/' + k] = {segs: S.log[k]};
  return o;
}
function setStatus(t) {$('status').textContent = t}
const LS = 'hoja-carga'; /* Clave de los datos en localStorage: no cambiarla aunque cambie el nombre de la app. */
function lsGet() {try {return JSON.parse(localStorage.getItem(LS) || localStorage.getItem('hoja') || 'null')} catch (e) {return null}}
function lsSet() {try {localStorage.setItem(LS, JSON.stringify(S))} catch (e) {}}
function touch() {render(); dirty = true; clearTimeout(timer); timer = setTimeout(flush, 600)}
function commit() {render(); dirty = true; clearTimeout(timer); flush()}
async function flush() {
  if (!db) {lsSet(); dirty = false; return}
  if (saving) {timer = setTimeout(flush, 400); return}
  saving = true; dirty = false; setStatus('Guardando…');
  try {
    const d = docs();
    for (const p of Object.keys(d)) {const j = JSON.stringify(d[p]); if (saved[p] !== j) {await db.doc(p).set(JSON.parse(j)); saved[p] = j}}
    for (const p of Object.keys(saved)) if (!d[p]) {await db.doc(p).delete(); delete saved[p]}
    setStatus(store.kind === 'firebase' ? 'Guardado y sincronizado.' : 'Guardado.');
  } catch (e) {lsSet(); setStatus(e && e.code === 'quota_exceeded' ? 'Sin espacio. Elimina asignaturas antiguas.' : 'No se ha podido guardar. Los cambios siguen en esta pantalla.')}
  saving = false;
}

/* ---------- Cambios de valor (data-set) ---------- */
const curSub = () => S.subs[scope];
function groupOf(gid) {return curSub().grupos.find(g => g.id === gid)}
function recalcAuto() {S.app.days.forEach(x => {if (x.d >= TODAY && x.slots && x.slots.length) x.h = Math.min(24, slotsHours(S.app, x.slots))})}
function applySet(key, id, val, el) {
  const n = parseFloat(val), b = val === 'true';
  switch (key) {
    case 'brkH': S.app.brkH = n; recalcAuto(); break;
    case 'defH': S.app.defH = n; break;
    case 'maxH': S.app.maxH = n; break;
    case 'standby': S.app.standby = n; break;
    case 'mode': S.app.mode = val; if (val === 'pct') {const ids = S.app.order, sum = ids.reduce((a, i) => a + (+S.subs[i].pct || 0), 0); if (!sum) ids.forEach(i => {S.subs[i].pct = Math.round(100 / ids.length)})} break;
    case 'useRitmo': S.app.useRitmo = b; break;
    case 'dayh': {const x = S.app.days.find(y => y.d === id); if (x) {x.h = n; x.auto = false} break}
    case 'minsub': S.subs[id].minDia = n; break;
    case 'pct': S.subs[id].pct = n; break;
    case 'sprio': S.subs[id].prio = n; break;
    case 'active': S.subs[id].activa = b; break;
    case 'closed': if (b) S.app.closed[id] = true; else delete S.app.closed[id]; break;
    case 'limite': {const s=curSub();s.limite=val;if(!s.limites)s.limites=[];if(s.limites.length){s.limites[0].fecha=val}else{s.limites.push({id:'examen',nombre:'Fecha límite',fecha:val,empezarAntes:0})}pick=null;break}
    case 'limEmpezar': {const s=curSub();if(!s.limites)s.limites=[];const li=s.limites.find(x=>x.id===id);if(li)li.empezarAntes=+val;break}
    case 'diariadone': {const s=curSub();if(val==='true')s.done[scope+'/'+id]=TODAY;else delete s.done[scope+'/'+id];break}
    case 'prio': curSub().prio = n; break;
    case 'minDia': curSub().minDia = n; break;
    case 'revPct': curSub().revPct = n; break;
    case 'revDef': curSub().revDef = b; break;
    case 'glvl': {const s = curSub(), g = groupOf(id); s.lvl[scope + '/g:' + g.id] = n; g.tareas.forEach(t => {s.lvl[scope + '/' + t.id] = n}); break}
    case 'ilvl': curSub().lvl[id] = n; break;
    case 'min': {const s = curSub(), base = +(el && el.dataset.base); if (n > 0 && n !== base) s.mins[id] = n; else delete s.mins[id]; break}
    case 'sim': groupOf(id).sim = b; break;
    case 'maSub': ma.sid = val; render(); return;
    case 'maMin': ma.min = n; render(); return;
    case 'maPri': ma.pri = n; render(); return;
    case 'maTipo': ma.tipo = val; render(); return;
    case 'exTipo': ex.tipo = val; render(); return;
    case 'exMin': ex.min = n; render(); return;
    case 'exSub': ex.sid = val; render(); return;
    case 'chartN': chartN = n; uiPref.n = n; saveUi(); render(); return;
    case 'doneOn': {const it = L.findItem(S, id, TODAY); if (it) markWithUndo([[it, val]]); doneAsk = null; pick = null; break}
    case 'moveTo': {L.pinTask(S, id, val); moveAsk = null; pick = null; setStatus('Tarea fijada el ' + dayLabel(val) + '.'); break}
    case 'doneOnSel': {const l = []; for (const k of sel) {const it = L.findItem(S, k, TODAY); if (it && !it.done) l.push([it, val])} markWithUndo(l); exitSel(); pick = null; break}
    case 'moveToSel': {const n = sel.size; for (const k of sel) L.pinTask(S, k, val); exitSel(); pick = null; setStatus((n === 1 ? 'Tarea fijada' : n + ' tareas fijadas') + ' el ' + dayLabel(val) + '.'); break}
    case 'switchTask': menuOpen = null; L.switchTask(S, val, Date.now()); commit(); return;
    default: return;
  }
  touch();
}

/* ---------- Editor de horas de una franja ---------- */
function openSlotEdit(sk, j) {
  const x = getSlots(sk)[j]; if (!x) return;
  const up = sk.startsWith('sched:') && +sk.slice(6) >= 4;
  slotEdit = {sk, j, txt: hm(studyHours(S.app, x.ini, x.fin)), up, focus: true};
  render();
}
function slotPreview() {
  if (!slotEdit) return '';
  const sl = getSlots(slotEdit.sk), h = parseHM(slotEdit.txt);
  if (h === null || h <= 0) return sl[slotEdit.j] ? sl[slotEdit.j].ini + '–' + sl[slotEdit.j].fin : '';
  const n = slotWithHours(S.app, sl, slotEdit.j, h)[slotEdit.j]; return n.ini + '–' + n.fin;
}
function applySlotEdit() {
  if (!slotEdit) return;
  const h = parseHM(slotEdit.txt), sk = slotEdit.sk, j = slotEdit.j;
  if (h === null || h <= 0) {slotEdit = null; render(); return}
  setSlots(sk, slotWithHours(S.app, getSlots(sk), j, h));
}

/* ---------- Eventos ---------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'pasted') draft.text = el.value;
  else if (el.id === 'ma-nom') ma.nom = el.value;
  else if (el.id === 'ex-nom') ex.nom = el.value;
  else if (el.id === 'slotEditTxt' && slotEdit) {slotEdit.txt = el.value; const p = $('slotPrev'); if (p) p.textContent = slotPreview()}
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'slotEditTxt') {
    if (e.key === 'Enter') {e.preventDefault(); applySlotEdit()}
    else if (e.key === 'Escape') {e.preventDefault(); slotEdit = null; render()}
  } else if (e.key === 'Escape' && (pick || menuOpen || slotEdit)) {pick = null; menuOpen = null; slotEdit = null; render()}
  else if (e.key === 'Escape' && dayPop) {dayPop = null; render()}
  else if (e.key === 'Escape' && dayView) {if (doneAsk || moveAsk || selAsk) {doneAsk = moveAsk = selAsk = null} else if (selMode) exitSel(); else dayView = null; render()}
});
document.addEventListener('change', e => {
  const el = e.target, d = el.dataset, num = parseFloat(el.value);
  if (d.done) {
    const it = L.findItem(S, d.done, TODAY); if (!it) return;
    if (el.checked) markWithUndo([[it, d.day]]); else L.unmarkDone(S, it); touch();
  }
  else if (d.real) {const sid = d.real.split('/')[0], s = S.subs[sid], v = Math.max(0, num || 0); if (v) s.real[d.real] = v; else delete s.real[d.real]; touch()}
  else if (d.target) {curSub().target = d.target; touch()}
  else if (el.id === 'f-nombre') {if (el.value.trim()) {curSub().nombre = el.value.trim(); touch()}}
});
document.addEventListener('click', e => {
  if ((pick && !e.target.closest('.dp')) || (menuOpen && !e.target.closest('.mn'))) {pick = null; menuOpen = null; render(); if (!e.target.closest('button')) return}
  if (e.target.dataset && e.target.dataset.modalbg === 'dv') {dayView = null; doneAsk = moveAsk = null; pick = null; exitSel(); render(); return}
  if (lpFired) {lpFired = false; return}
  if (selMode && dayView) {const row = e.target.closest('.dv-r[data-key]'); if (row && !row.classList.contains('done') && !e.target.closest('button,[data-dvdrag]')) {const k = row.dataset.key; if (sel.has(k)) sel.delete(k); else sel.add(k); render(); return}}
  if (dayPop && e.target.dataset && e.target.dataset.modalbg) {dayPop = null; slotEdit = null; render(); return}
  if (slotEdit && !e.target.closest('.slot-pop') && !e.target.closest('.slot')) {slotEdit = null; render(); return}
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.set !== undefined) {applySet(d.set, d.id, d.val, b); return}
  if (d.dp !== undefined) {pick = pick === d.dp ? null : d.dp; pickMonth = null; render(); return}
  if (d.dpm) {const s = curSub(), m0 = pickMonth || (s && s.limite || TODAY).slice(0, 7), [y, m] = m0.split('-').map(Number); pickMonth = new Date(Date.UTC(y, m - 1 + +d.dpm, 1)).toISOString().slice(0, 7); render(); return}
  if (d.mn !== undefined) {menuOpen = menuOpen === d.mn ? null : d.mn; render(); return}
  if (d.slotstep) {const cur = parseHM(slotEdit.txt), x = getSlots(slotEdit.sk)[slotEdit.j], base = cur === null ? studyHours(S.app, x.ini, x.fin) : cur; slotEdit.txt = hm(Math.max(.25, Math.round((base + +d.slotstep) * 4) / 4)); const i = $('slotEditTxt'); if (i) i.value = slotEdit.txt; const p = $('slotPrev'); if (p) p.textContent = slotPreview(); return}
  if (d.slot === 'apply') {applySlotEdit(); return}
  if (d.slot === 'cancel') {slotEdit = null; render(); return}
  if (d.slot === 'del') {const sl = getSlots(slotEdit.sk).filter((_, k) => k !== slotEdit.j); setSlots(slotEdit.sk, sl); return}
  if (d.simple) {uiPref.simple = d.simple === 'on'; saveUi(); exitSel(); doneAsk = moveAsk = null; dayView = uiPref.simple ? TODAY : null; sp = S.app.run ? 'sesion' : 'dia'; scrollTo(0, 0); render(); return}
  if (d.sp) {sp = d.sp; if (d.day) spSum = d.day; spMore = false; showExtra = false; parar = false; if (sp === 'dia' && !dayView) dayView = TODAY; scrollTo(0, 0); render(); return}
  if (d.spgo !== undefined) {const k = +d.spgo; spGo(k === 0 ? TODAY : L.addDays(dayView || TODAY, k), k === 0 ? (dayView > TODAY ? -1 : 1) : k); return}
  if (d.spmore) {spMore = !spMore; render(); return}
  if (d.runbar) {if (uiPref.simple) {sp = 'sesion'; spMore = false} else view = 'sesion'; parar = false; scrollTo(0, 0); render(); return}
  if (d.undo) {undoDone(); return}
  if (d.dvopen) {const it = L.findItem(S, d.key, TODAY); if (it) markWithUndo([[it, dayView && dayView <= TODAY ? dayView : TODAY, d.dvopen === 'fin']]); doneAsk = null; commit(); return}
  if (d.sdone) {
    const [ssid, tid] = d.sdone.split('/'), ss = S.subs[ssid], tt = ss && ss.grupos.flatMap(g => g.tareas || []).find(x => x.id === tid);
    if (tt && tt.minDia) {const pseudo = {sid: ssid, key: d.sdone, name: tt.nombre, subName: ss.nombre}; if (ss.done[d.sdone]) delete ss.done[d.sdone]; else markWithUndo([[pseudo, TODAY]]); commit(); return}
    const it = L.findItem(S, d.sdone, TODAY); if (!it) return; if (it.done) {L.unmarkDone(S, it); touch()} else {markWithUndo([[it, TODAY]]); commit()} return}
  if (d.hechas) {hOpen.has(d.hechas) ? hOpen.delete(d.hechas) : hOpen.add(d.hechas); render(); return}
  if (d.toast) {clearTimeout(toastT); $('toast').hidden = true; $('toast').innerHTML = ''; return}
  if (d.notif) {
    if (d.notif === 'test') {showToast({title: 'Prueba de La Hoja', body: 'Así te avisará. Minimiza la app para ver la notificación del sistema.'}); setTimeout(() => fireAlert({kind: 'prueba', title: 'Prueba de La Hoja', body: 'Los avisos del sistema funcionan.'}), 4000); return}
    if (d.notif === 'off') {uiPref.notif = false; saveUi(); render(); return}
    Notification.requestPermission().then(p => {uiPref.notif = p === 'granted'; saveUi(); render()});
    return;
  }
  if (d.dayclose) {dayPop = null; slotEdit = null; render(); return}
  if (d.chnav !== undefined) {const k = +d.chnav; if (k === 0) {chartAnim = chartStart > TODAY ? 'from-l' : 'from-r'; chartStart = TODAY} else {chartStart = L.addDays(chartStart, k * chartN); chartAnim = k > 0 ? 'from-r' : 'from-l'} render(); return}
  if (d.dayview) {dayView = d.dayview; doneAsk = null; moveAsk = null; pick = null; exitSel(); render(); return}
  if (d.dvclose) {dayView = null; doneAsk = moveAsk = null; pick = null; exitSel(); render(); return}
  if (d.dvgo) {dayView = d.dvgo; doneAsk = moveAsk = null; pick = null; exitSel(); render(); return}
  if (d.dvselk) {if (sel.has(d.dvselk)) sel.delete(d.dvselk); else sel.add(d.dvselk); render(); return}
  if (d.dvsel) {const [sid, gid] = d.dvsel.split('|'), al = allocate(S, TODAY), ks = (al.plan[dayView] || []).filter(r => !r.done && r.it.sid === sid && (!gid || r.it.gid === gid)).map(r => r.it.key); const all = ks.every(k => sel.has(k)); ks.forEach(k => all ? sel.delete(k) : sel.add(k)); render(); return}
  if (d.dvbulk) {
    const a = d.dvbulk;
    if (a === 'enter') {selMode = true; doneAsk = moveAsk = null}
    else if (a === 'exit') exitSel();
    else if (a === 'all') {const al = allocate(S, TODAY); (al.plan[dayView] || []).filter(r => !r.done).forEach(r => sel.add(r.it.key))}
    else if (a === 'done') {selAsk = selAsk === 'done' ? null : 'done'; pick = null; pickMonth = TODAY.slice(0, 7)}
    else if (a === 'move') {selAsk = selAsk === 'move' ? null : 'move'; pick = null; pickMonth = dayView.slice(0, 7)}
    else if (a === 'unpin') {sel.forEach(k => L.pinTask(S, k, '')); exitSel(); touch(); return}
    render(); return;
  }
  if (d.dvcancel) {doneAsk = moveAsk = null; pick = null; render(); return}
  if (d.dvdone) {const it = L.findItem(S, d.dvdone, TODAY); if (it && it.done) {L.unmarkDone(S, it); touch()} else {doneAsk = doneAsk === d.dvdone ? null : d.dvdone; moveAsk = null; pick = null; pickMonth = TODAY.slice(0, 7); render()} return}
  if (d.dvmove) {moveAsk = moveAsk === d.dvmove ? null : d.dvmove; doneAsk = null; pick = null; pickMonth = dayView.slice(0, 7); render(); return}
  if (d.dvunpin) {L.pinTask(S, d.dvunpin, ''); moveAsk = null; touch(); return}
  if (d.dvslots) {dayPop = d.dvslots; dayView = null; render(); return}
  if (d.dvadd) {if (!S.app.days.some(y => y.d === d.dvadd)) S.app.days.push(makeDay(S.app, d.dvadd)); touch(); return}
  if (d.dayreset) {const i = S.app.days.findIndex(y => y.d === d.dayreset); if (i >= 0) S.app.days[i] = makeDay(S.app, d.dayreset); slotEdit = null; touch(); return}
  if (d.login) {store.login && store.login(); return}
  if (d.logout) {store.logout && store.logout(); return}
  if (d.view) {view = d.view; render()}
  else if (d.scope) {scope = d.scope; confirmDel = false; pick = null; if (view === 'sesion') view = 'config'; render()}
  else if (d.goadd) {scope = 'nueva'; render()}
  else if (d.sample) {draft.text = JSON.stringify(SAMPLE, null, 1); checkDraft(); scope = 'nueva'; render()}
  else if (d.check) {checkDraft(); render()}
  else if (d.copy) {const done = t => {$('copied').textContent = t}; if (navigator.clipboard) navigator.clipboard.writeText(PROMPT).then(() => done('Copiado'), () => {const r = document.createRange(); r.selectNodeContents($('promptbox')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); done('Seleccionado: cópialo con Ctrl+C')})}
  else if (d.export) {const t = JSON.stringify(L.exportSub(curSub()), null, 2); if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => {$('copied').textContent = 'Copiado'}, () => {draft.text = t; scope = 'nueva'; render()}); else {draft.text = t; scope = 'nueva'; render()}}
  else if (d.applySub) {const r = draft.res; if (r && r.ok) {r.subs.forEach(x => L.applySub(S, x)); scope = r.subs.length === 1 ? r.subs[0].id : 'general'; view = 'config'; draft = {text: '', res: null, diffs: null}; commit()}}
  else if (d.quick) {
    const lines = $('quick').value.split('\n').map(x => x.trim()).filter(Boolean); formErr = '';
    if (!lines.length) {formErr = 'Escribe al menos un nombre.'; render(); return}
    for (const l of lines) {const [n, f] = l.split(';').map(x => x.trim()); const e = L.emptySub(n, f); if (e.id && !S.subs[e.id]) L.applySub(S, e); else if (e.id && L.isDate(f)) S.subs[e.id].limite = f}
    scope = 'general'; view = 'config'; commit();
  }
  else if (d.addman !== undefined) {
    const sid = d.addman || ma.sid, nom = ma.nom.trim();
    if (!sid || !nom || !(ma.min > 0)) {formErr = 'Pon nombre y minutos aproximados.'; render(); return}
    const day = d.day && d.day >= TODAY ? d.day : '', dia = ma.tipo === 'dia';
    formErr = ''; const k = L.addManual(S, sid, dia ? {nombre: nom, minDia: ma.min, prio: ma.pri, desde: day} : {nombre: nom, min: ma.min, prio: ma.pri}, Date.now());
    if (day && !dia) {if (!S.app.days.some(y => y.d === day)) S.app.days.push(makeDay(S.app, day)); L.pinTask(S, k, day)}
    ma.nom = ''; planAdd = false; dvAdd = false; commit();
  }
  else if (d.planadd) {planAdd = true; formErr = ''; render()}
  else if (d.dvaddtask !== undefined) {dvAdd = d.dvaddtask === '1'; formErr = ''; doneAsk = moveAsk = null; render()}
  else if (d.delman) {L.removeManual(S, d.delman); commit()}
  else if (d.showextra) {showExtra = !showExtra; formErr = ''; render()}
  else if (d.extra) {
    const nom = ex.nom.trim();
    if (!nom || !ex.sid) {formErr = 'Escribe qué vas a hacer.'; render(); return}
    formErr = ''; if (ex.tipo === 'dia') L.startOpen(S, ex.sid, nom, ex.min, Date.now()); else L.startExtra(S, ex.sid, nom, Date.now()); ex.nom = ''; showExtra = false; commit(); wake();
  }
  else if (d.applysched) {S.app.days = S.app.days.map(x => {if (x.d < TODAY) return x; const n = makeDay(S.app, x.d); return n.slots ? n : x}); commit()}
  else if (d.update) {scope = 'nueva'; render()}
  else if (d.del === '1') {confirmDel = true; render()}
  else if (d.del === '0') {confirmDel = false; render()}
  else if (d.del === '2') {const id = scope; delete S.subs[id]; S.app.order = S.app.order.filter(x => x !== id); if (S.app.run && S.app.run.sid === id) S.app.run = null; scope = 'general'; confirmDel = false; commit()}
  else if (d.act) {
    const now = Date.now();
    if (d.act === 'go') {if (!S.app.run) {L.startDay(S, TODAY, now); wake()} view = 'sesion'; sp = 'sesion'; spMore = false}
    else if (d.act === 'next') {L.nextStep(S, now); wake()}
    else if (d.act === 'finopen') {L.finishOpen(S, now); wake()}
    else if (d.act === 'break') L.goBreak(S, now);
    else if (d.act === 'resume') {L.resumeWork(S, now); wake()}
    else if (d.act === 'end') {const day = S.app.run && S.app.run.day; L.endDay(S, now); parar = false; sp = 'resumen'; spSum = day || TODAY}
    else if (d.act === 'parar') parar = true;
    else if (d.act === 'noparar') parar = false;
    else if (d.act === 'pause') {L.goPause(S, now); parar = false}
    else if (d.act === 'unpause') {L.unpause(S, now); wake()}
    else if (d.act === 'carry') L.carryOver(S, TODAY, now);
    else if (d.act === 'discard') {L.discardRun(S); sp = 'resumen'; spSum = TODAY}
    else if (d.act === 'minus5') L.trimRun(S, 5, now);
    commit();
  }
  else if (d.cal) {
    hideTip();
    if (tipSuppress) {tipSuppress = false; return}
    const day = d.cal;
    if (calLast === day && calTimer) {
      clearTimeout(calTimer); calTimer = null; calLast = null;
      if (!S.app.days.some(x => x.d === day)) S.app.days.push(makeDay(S.app, day));
      dayPop = day; slotEdit = null; touch(); return;
    }
    clearTimeout(calTimer); calLast = day;
    calTimer = setTimeout(() => {calTimer = null; calLast = null; const i = S.app.days.findIndex(x => x.d === day); if (i >= 0) S.app.days.splice(i, 1); else S.app.days.push(makeDay(S.app, day)); touch()}, 260);
  }
  else if (d.rm) {S.app.days = S.app.days.filter(x => x.d !== d.rm); if (dayPop === d.rm) {dayPop = null; slotEdit = null} touch()}
  else if (d.month) {const [y, m] = month.split('-').map(Number); month = new Date(Date.UTC(y, m - 1 + +d.month, 1)).toISOString().slice(0, 7); render()}
  else if (d.exp) {const k = scope + d.exp; if (expanded.has(k)) expanded.delete(k); else expanded.add(k); render()}
  else if (d.subup) {const o = [...S.app.order], i = o.indexOf(d.subup), j = i + +d.d; if (j >= 0 && j < o.length) {[o[i], o[j]] = [o[j], o[i]]; S.app.order = o; touch()}}
  else if (d.gmv) {const l = curSub().grupos, i = l.findIndex(g => g.id === d.gmv), j = i + +d.d; if (j >= 0 && j < l.length) {[l[i], l[j]] = [l[j], l[i]]; touch()}}
  else if (d.prop) {undo = S.app.days.map(x => ({...x})); S.app.days = props[d.prop].days.map(x => ({...x})); touch()}
  else if (d.undo && undo) {S.app.days = undo; undo = null; touch()}
});
bindSlots({get: getSlots, set: setSlots, edit: openSlotEdit});
/* Calendario de «Tus días»: un clic añade o quita el día (con una breve espera por si llega
   el segundo clic), doble clic abre sus franjas y dejar el cursor encima muestra su ficha. */
let calTimer = null, calLast = null, tipTimer = null, tipSuppress = false;
const tip = document.createElement('div');
tip.className = 'daytip'; tip.hidden = true; tip.setAttribute('role', 'tooltip');
document.body.appendChild(tip);
function showTip(cell) {
  if (!cell.isConnected) return;
  tip.innerHTML = dayTipHTML(cell.dataset.cal); tip.dataset.for = cell.dataset.cal; tip.hidden = false;
  const r = cell.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  let y = r.bottom + 8; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function hideTip() {clearTimeout(tipTimer); tip.hidden = true; tip.dataset.for = ''}
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const c = e.target.closest('.cd[data-cal]');
  if (!c || (!tip.hidden && tip.dataset.for === c.dataset.cal)) return;
  clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(c), 450);
});
document.addEventListener('pointerout', e => {
  if (e.pointerType !== 'mouse') return;
  const c = e.target.closest('.cd[data-cal]');
  if (c && !c.contains(e.relatedTarget)) hideTip();
});
document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  const c = e.target.closest('.cd[data-cal]');
  if (!c) {if (!tip.hidden) hideTip(); return}
  clearTimeout(tipTimer); tipTimer = setTimeout(() => {showTip(c); tipSuppress = true}, 450);
});
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, e => {if (e.pointerType !== 'mouse') clearTimeout(tipTimer)}));
addEventListener('scroll', () => {if (!tip.hidden && !tipSuppress) hideTip()}, {passive: true});
document.addEventListener('contextmenu', e => {if (e.target.closest('.cd[data-cal]')) e.preventDefault()});
/* Ventana del día: arrastrar los puntos de una tarea cambia su orden dentro del día.
   La tarea sigue al cursor (o al dedo) y una sombra marca el hueco donde caerá. */
let dvDrag = null;
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('[data-dvdrag]'); if (!h) return;
  const li = h.closest('.dv-r'), ul = li && li.closest('.dv-list'); if (!li || !ul) return;
  e.preventDefault(); clearTimeout(lpTimer);
  /* Si la tarea está seleccionada junto a otras, se arrastran todas como un bloque. */
  const group = selMode && sel.has(li.dataset.key) && sel.size > 1 ? [...ul.querySelectorAll('.dv-r')].filter(x => sel.has(x.dataset.key)) : [li];
  const r = li.getBoundingClientRect(), ph = document.createElement('li');
  ph.className = 'dv-ph'; ph.style.height = r.height + 'px';
  ul.insertBefore(ph, li);
  group.forEach(x => {if (x !== li) x.style.display = 'none'});
  Object.assign(li.style, {position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', zIndex: 80, pointerEvents: 'none'});
  li.classList.add('dragging');
  if (group.length > 1) li.setAttribute('data-count', '+' + (group.length - 1));
  dvDrag = {li, ul, ph, group, id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, y: e.clientY, x: e.clientX, start: [...ul.querySelectorAll('.dv-r')].map(x => x.dataset.key), box: ul.closest('.modal'), raf: 0};
  try {h.setPointerCapture(e.pointerId)} catch (_) {}
  const scroll = () => {
    const g = dvDrag; if (!g) return;
    const b = g.box ? g.box.getBoundingClientRect() : {top: 0, bottom: innerHeight}, edge = 56, by = v => g.box ? (g.box.scrollTop += v) : scrollBy(0, v);
    if (g.y < b.top + edge) by(-Math.ceil((b.top + edge - g.y) / 6));
    else if (g.y > b.bottom - edge) by(Math.ceil((g.y - b.bottom + edge) / 6));
    placeDv(g); g.raf = requestAnimationFrame(scroll);
  };
  dvDrag.raf = requestAnimationFrame(scroll);
});
function placeDv(g) {
  const sibs = [...g.ul.querySelectorAll('.dv-r')].filter(x => !g.group.includes(x));
  const after = sibs.find(x => {const r = x.getBoundingClientRect(); return g.y < r.top + r.height / 2});
  if (after) {if (g.ph.nextElementSibling !== after) g.ul.insertBefore(g.ph, after)}
  else {const last = sibs[sibs.length - 1]; if (last && last.nextElementSibling !== g.ph) last.after(g.ph)}
}
document.addEventListener('pointermove', e => {
  const g = dvDrag; if (!g || g.id !== e.pointerId) return;
  g.x = e.clientX; g.y = e.clientY;
  g.li.style.left = (e.clientX - g.dx) + 'px'; g.li.style.top = (e.clientY - g.dy) + 'px';
  placeDv(g);
});
/* Mantener pulsada una tarea entra en modo selección con esa tarea elegida. */
let lpTimer = null, lpFired = false, lpAt = null;
document.addEventListener('pointerdown', e => {
  const row = dayView && e.target.closest('.dv-r[data-key]');
  if (!row || row.classList.contains('done') || e.target.closest('button,[data-dvdrag]')) return;
  lpAt = {x: e.clientX, y: e.clientY, k: row.dataset.key};
  clearTimeout(lpTimer);
  lpTimer = setTimeout(() => {
    lpFired = true; doneAsk = moveAsk = null;
    if (!selMode) {selMode = true; sel.clear()}
    sel.add(lpAt.k);
    try {navigator.vibrate && navigator.vibrate(12)} catch (_) {}
    render();
  }, 480);
});
document.addEventListener('pointermove', e => {if (lpAt && Math.hypot(e.clientX - lpAt.x, e.clientY - lpAt.y) > 8) clearTimeout(lpTimer)});
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => {clearTimeout(lpTimer); setTimeout(() => {lpFired = false}, 60)}));
document.addEventListener('contextmenu', e => {if (e.target.closest('.dv-r')) e.preventDefault()});
const dvEnd = e => {
  const g = dvDrag; if (!g || g.id !== e.pointerId) return;
  dvDrag = null; cancelAnimationFrame(g.raf);
  g.group.forEach(x => g.ul.insertBefore(x, g.ph)); g.ph.remove();
  g.li.classList.remove('dragging'); g.group.forEach(x => x.removeAttribute('style')); g.li.removeAttribute('data-count');
  const keys = [...g.ul.querySelectorAll('.dv-r')].map(x => x.dataset.key);
  if (keys.join('|') === g.start.join('|')) return;
  L.setDayOrder(S, g.ul.dataset.dvday, keys); touch();
};
document.addEventListener('pointerup', dvEnd);
document.addEventListener('pointercancel', dvEnd);
/* Versión simplificada: deslizar a izquierda o derecha cambia de día. */
let swipe = null;
document.addEventListener('touchstart', e => {
  if (!uiPref.simple || sp !== 'dia' || dvDrag || selMode || e.touches.length !== 1 || !e.target.closest('[data-swipe]')) {swipe = null; return}
  const t = e.touches[0]; swipe = {x: t.clientX, y: t.clientY, t: Date.now()};
}, {passive: true});
document.addEventListener('touchend', e => {
  const g = swipe; swipe = null; if (!g || dvDrag) return;
  const t = e.changedTouches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && Date.now() - g.t < 700) spGo(L.addDays(dayView || TODAY, dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
}, {passive: true});
setInterval(tick, 500);
document.addEventListener('visibilitychange', () => {if (!document.hidden) {tick(); wake()}});

/* ---------- Arranque ---------- */
function loadState(o) {
  const n = L.newState();
  return {app: L.migrateApp({...n.app, ...(o && o.app)}), subs: (o && o.subs) || {}, log: (o && o.log) || {}};
}
export async function start() {
  render(); setStatus('Conectando…');
  store = await openStore({onError: () => setStatus('No se ha podido subir un cambio a la nube. Sigue guardado en este dispositivo.')});
  if (!store.db) {
    const l = lsGet(); if (l && l.app) S = loadState(l);
    if (S.app.run) {view = 'sesion'; sp = 'sesion'}
    render(); setStatus(store.warn || (store.needLogin ? 'Sin entrar: se guarda solo en este navegador.' : 'Se guarda solo en este navegador.')); return;
  }
  db = store.db; let first = true;
  const slow = setTimeout(() => setStatus('Aún no llega lo guardado. Puede estar desactualizado.'), 10000);
  const apply = () => {if (first && S.app.run) {view = 'sesion'; sp = 'sesion'} render()};
  const busy = m => dirty || saving || m.hasPendingWrites;
  db.doc('app/estado').onSnapshot(s => {
    if (!s.metadata.fromCache) {clearTimeout(slow); if (/^(Conectando|Aún)/.test($('status').textContent)) setStatus(store.kind === 'firebase' ? 'Sincronizado.' : 'Guardado.')}
    if (busy(s.metadata) || !s.exists) return;
    const d = JSON.parse(JSON.stringify(s.data())); saved['app/estado'] = JSON.stringify(d); S.app = L.migrateApp({...L.newState().app, ...d}); apply(); first = false;
  }, () => {clearTimeout(slow); setStatus('No se puede leer lo guardado ahora mismo.')});
  db.collection('asig').onSnapshot(q => {
    if (busy(q.metadata)) return;
    const n = {}; q.docs.forEach(x => {const d = JSON.parse(JSON.stringify(x.data())); n[x.id] = d; saved['asig/' + x.id] = JSON.stringify(d)}); S.subs = n; render();
  }, () => {});
  db.collection('log').onSnapshot(q => {
    if (busy(q.metadata)) return;
    const n = {}; q.docs.forEach(x => {const d = JSON.parse(JSON.stringify(x.data())); n[x.id] = d.segs || []; saved['log/' + x.id] = JSON.stringify({segs: n[x.id]})}); S.log = n; render();
  }, () => {});
}
