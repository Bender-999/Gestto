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
let pick = null, pickMonth = null, menuOpen = null, slotEdit = null;
let ma = {sid: '', nom: '', min: 30, pri: 1}, ex = {sid: '', nom: ''};
let store = {kind: 'local'};

/* ---------- Pintado ---------- */
function render() {
  const a = document.activeElement && document.activeElement.id, al = allocate(S, TODAY), ob = objectives(S, al), none = !S.app.order.length;
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
  renderAccount();
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
function renderAccount() {
  const el = $('account');
  if (store.kind === 'firebase' && store.needLogin) el.innerHTML = `<span>Entra con tu cuenta de Google para sincronizar el PC y el móvil.</span><button class="btn sm" data-login="1">Entrar con Google</button>`;
  else if (store.kind === 'firebase' && store.user) el.innerHTML = `<span>Sincronizado como ${esc(store.user.email || store.user.name)}</span><button class="btn ghost sm" data-logout="1">Salir</button>`;
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
      $('lead').textContent = `Tu objetivo llega hasta ${o.t.name} y pide ${fmt(o.need)}.` + (s.limite ? ` Fecha límite: ${dayLabel(s.limite)}.` : '');
    }
  }
  const open = al.days.filter(d => !d.closed), maxM = Math.max(60, ...open.map(d => Math.max(d.h * 60, al.plan[d.d].reduce((a, r) => a + r.m, 0))));
  const short = m => nh(Math.round(m / 15) / 4);
  const seen = new Set();
  const cols = open.map(d => {
    const by = {};
    al.plan[d.d].forEach(r => {by[r.it.sid] = (by[r.it.sid] || 0) + r.m});
    const rows = [...new Set(al.plan[d.d].map(r => r.it.sid))], tot = Object.values(by).reduce((a, b) => a + b, 0), base = Math.max(d.h * 60, tot, 1);
    const segs = rows.map(id => {
      const m = by[id], mine = scope === 'general' || id === scope; seen.add(id);
      const nm = S.subs[id] ? S.subs[id].nombre : id, tall = m / maxM * 132 >= 20;
      return `<i style="height:${100 * m / base}%;background:${mine ? colorOf(id) : 'var(--line)'};color:${mine ? 'var(--bg)' : 'var(--muted)'}" title="${esc(nm)}: ${fmt(m)}">${tall ? short(m) : ''}</i>`;
    }).join('');
    const x = new Date(d.d + 'T00:00:00Z'), lab = x.toLocaleDateString('es-ES', {timeZone: 'UTC', weekday: 'short'}).replace('.', '');
    const own = scope === 'general' ? tot : (by[scope] || 0);
    return `<div class="dc" title="${dayLabel(d.d)}: ${fmt(tot)} de ${fmt(d.h * 60)}"><b>${scope === 'general' ? fmt(tot) : (own ? fmt(own) : '—')}</b><div class="dtrack" style="height:${Math.max(6, 132 * Math.max(d.h * 60, tot) / maxM)}px">${segs}</div><span>${lab}<br>${x.getUTCDate()}/${x.getUTCMonth() + 1}</span></div>`;
  }).join('');
  const legend = [...seen].sort((a, b) => S.app.order.indexOf(a) - S.app.order.indexOf(b)).filter(id => scope === 'general' || id === scope).map(id => `<span>${sw(id)}${esc(S.subs[id].nombre)}</span>`).join('') + (scope === 'general' ? '' : '<span><span class="sw" style="background:var(--line)"></span>Otras asignaturas</span>') + '<span><span class="sw" style="background:var(--track);box-shadow:inset 0 0 0 1px var(--line)"></span>Libre</span>';
  const miss = ob.list.filter(o => o.miss > 0 && (scope === 'general' || o.sid === scope)).map(o => `${esc(o.s.nombre)} ${fmt(o.miss)}`).join(' · ');
  $('chart').innerHTML = open.length ? `<div class="dcols-wrap"><div class="dcols">${cols}</div></div><div class="legend">${legend}${miss ? `<span class="neg"><span class="sw hatch"></span>Sin sitio: ${miss}</span>` : ''}</div>` : '<div class="empty">Añade días para ver el reparto de horas.</div>';
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
  const days = [...S.app.days].sort((a, b) => a.d < b.d ? -1 : 1), lims = S.app.order.map(i => S.subs[i].limite).filter(Boolean);
  const [y, m] = month.split('-').map(Number), first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, len = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const nm = first.toLocaleDateString('es-ES', {timeZone: 'UTC', month: 'long', year: 'numeric'});
  let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<span>${d}</span>`).join('') + '<i></i>'.repeat(lead);
  for (let i = 1; i <= len; i++) {
    const d = month + '-' + pad(i), e = days.find(x => x.d === d), past = d < TODAY;
    cells += `<button class="cd ${e ? 'on' : ''} ${past && !e ? 'past' : ''} ${d === TODAY ? 'today' : ''} ${lims.includes(d) ? 'lim' : ''}" data-cal="${d}" ${past && !e ? 'disabled' : ''} aria-pressed="${!!e}" aria-label="${dayLabel(d)}${e ? ', ' + e.h + ' horas' : ''}">${i}<small>${e ? nh(e.h) : ''}</small></button>`;
  }
  const sum = days.filter(x => x.d >= TODAY && !S.app.closed[x.d]).reduce((a, x) => a + (+x.h || 0), 0);
  const list = days.length ? days.map(x => {
    const past = x.d < TODAY, has = x.slots && x.slots.length;
    const right = has || past ? `<span class="num dl-h">${fmt(x.h * 60)}</span>` : stepper({key: 'dayh', id: x.d, value: x.h, step: .25, min: 0, max: 16, fmt: hTxt, label: 'Horas del ' + dayLabel(x.d), size: 'sm'});
    return `<div class="dl ${past ? 'off' : ''}"><div class="w"><span>${dayLabel(x.d)}</span>${past ? '<small>Ya pasado</small>' : has ? '' : '<small>Sin franjas: horas a mano</small>'}</div>
      ${slotsTrack({sk: 'day:' + x.d, slots: x.slots || [], app: S.app, edit: slotEdit, label: 'Franjas del ' + dayLabel(x.d), readonly: past})}
      ${right}<button class="icon round" data-rm="${x.d}" aria-label="Quitar ${dayLabel(x.d)}">×</button></div>`;
  }).join('') + `<div class="dl total"><div class="w"><span>Total que cuenta</span></div><span class="num">${fmt(sum * 60)}</span></div>` : '<div class="dl"><div class="w"><span>Sin días todavía. Toca días en el calendario.</span></div></div>';
  return `<section class="card"><h2>Tus días</h2><p class="sub">Pulsa un día del calendario para añadirlo o quitarlo. En la lista ajustas sus franjas como en el horario. El borde rojo marca una fecha límite.</p>
   <div class="fields">
    <div class="field"><span class="lbl">Horas si el día no tiene horario</span>${stepper({key: 'defH', value: S.app.defH, step: .25, min: .25, max: 16, fmt: hTxt, label: 'Horas si el día no tiene horario'})}</div>
    <div class="field"><span class="lbl">Máximo de horas al día</span>${stepper({key: 'maxH', value: S.app.maxH, step: .5, min: 1, max: 16, fmt: hTxt, label: 'Máximo de horas al día'})}</div>
    <div class="field"><span class="lbl">Fecha cercana: días antes</span>${chips({key: 'standby', value: S.app.standby ?? 30, label: 'Días de fecha cercana', options: [7, 14, 30, 60, 90].map(v => ({v, label: v + ' días'}))})}</div></div>
   <div class="days-grid"><div class="cal"><div class="cal-head"><button class="icon round" data-month="-1" aria-label="Mes anterior">‹</button><strong>${nm[0].toUpperCase() + nm.slice(1)}</strong><button class="icon round" data-month="1" aria-label="Mes siguiente">›</button></div><div class="cal-grid">${cells}</div></div>
   <div class="daylist">${list}</div></div></section>`;
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
    return `<div class="pr"><div class="w"><b>${sw(id)}${esc(s.nombre)}${tag}</b><small>${w === 'espera' ? 'Sin tareas todavía' : w === 'sin-tareas' ? 'Su fecha se acerca' : w === 'pausa' ? 'No entra en el plan' : o && o.need ? (o.miss ? 'Faltan ' + fmt(o.miss) + ' de ' + fmt(o.need) : 'Llega · ' + fmt(o.need)) : 'Sin pendientes'}${s.limite ? ' · hasta ' + dayLabel(s.limite) : ''}</small></div>
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
    ${toggle({key: 'useRitmo', value: !!S.app.useRitmo, label: 'Corregir lo que queda con mi ritmo real'})}</section></div>
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
    const l = items.filter(x => x.gid === g.id), rec = g.tipo === 'recurrente', open = expanded.has(scope + g.id), lv = rec || g.sim ? [l[0] ? l[0].lvl : g.prio] : [...new Set(l.map(x => x.lvl))], mix = lv.length > 1, m = rec ? g.minSem : g.tareas.reduce((a, t) => a + (+s.mins[scope + '/' + t.id] || t.min), 0);
    const sub = rec ? `${fmt(g.minSem)} por semana` : `${g.tareas.length} tareas · ${fmt(m)}${g.freq ? ' · ' + esc(g.freq) : ''}`;
    const tasks = g.tareas.map(t => {
      const k = scope + '/' + t.id;
      return `<div class="si"><div class="w"><span>${esc(t.nombre)}</span><small>${esc(t.det)}${t.limite ? ' · hasta ' + dayLabel(t.limite) : ''}${t.dep.length ? ' · tras ' + t.dep.map(esc).join(', ') : ''}</small></div>
      <div class="si-ctl">${stepper({key: 'min', id: k, base: t.min, value: +s.mins[k] || t.min, step: 5, min: 5, max: 900, fmt: v => v + ' min', label: 'Minutos de ' + t.nombre, size: 'sm'})}
      ${g.sim ? '' : seg({key: 'ilvl', id: k, value: s.lvl[k] ?? t.prio ?? g.prio, options: PRIO4, label: 'Prioridad de ' + t.nombre, size: 'xs'})}${t.manual ? `<button class="icon round" data-delman="${esc(k)}" aria-label="Quitar ${esc(t.nombre)}">×</button>` : ''}</div></div>`;
    }).join('');
    return `<div class="pr grp">${rec ? '<span class="exp"></span>' : `<button class="exp" data-exp="${esc(g.id)}" aria-expanded="${open}" aria-label="Desplegar ${esc(g.nombre)}"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${open ? 'M5 8l5 5 5-5' : 'M8 5l5 5-5 5'}"/></svg></button>`}
     <div class="w"><b>${esc(g.nombre)}</b><small>${sub}</small></div>
     <div class="pr-ctl">${seg({key: 'glvl', id: g.id, value: mix ? '' : lv[0], options: PRIO4, label: 'Prioridad de ' + g.nombre + (mix ? ' (mixta)' : ''), size: 'xs'})}
     <div class="updown"><button class="icon round" data-gmv="${esc(g.id)}" data-d="-1" aria-label="Subir ${esc(g.nombre)}" ${i ? '' : 'disabled'}>↑</button><button class="icon round" data-gmv="${esc(g.id)}" data-d="1" aria-label="Bajar ${esc(g.nombre)}" ${i < s.grupos.length - 1 ? '' : 'disabled'}>↓</button></div></div></div>
     ${open && !rec ? `<div class="sub-items">${g.manual ? '' : `<div class="si">${toggle({key: 'sim', id: g.id, value: !!g.sim, label: 'Simulacro: todo el mismo día con un solo temporizador'})}</div>`}${tasks}</div>` : ''}`;
  }).join('');
  $('main').innerHTML = `<div class="cfg"><div>
   <section class="card"><h2>${esc(s.nombre)}</h2><div class="fields">
    <div class="field wide"><label class="lbl" for="f-nombre">Nombre</label><input id="f-nombre" type="text" value="${esc(s.nombre)}"></div>
    <div class="field"><span class="lbl">Fecha límite</span>${datePick({key: 'limite', value: s.limite, open: pick === 'limite|', month: pickMonth, today: TODAY, label: 'Fecha límite de ' + s.nombre})}</div>
    <div class="field"><span class="lbl">Prioridad</span>${seg({key: 'prio', value: s.prio, options: PRIO, label: 'Prioridad de ' + s.nombre})}</div>
    <div class="field"><span class="lbl">Mínimo al día</span>${stepper({key: 'minDia', value: s.minDia || 0, step: .25, min: 0, max: 12, fmt: hTxt, label: 'Mínimo de horas al día'})}</div>
    <div class="field wide"><span class="lbl">Reservar para revisar: <b>${s.revPct || 0} %</b></span>${blocks({key: 'revPct', value: Math.min(50, s.revPct || 0), values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50], label: 'Porcentaje para revisar', fmt: v => v + ' %'})}</div></div>
    ${toggle({key: 'revDef', value: !!s.revDef, label: 'Las tareas tienen fase de revisión'})}
    <div class="row-btns"><button class="btn ghost" data-update="1">Actualizar con texto nuevo</button><button class="btn ghost" data-export="1">Copiar texto actual</button><span class="status" id="copied"></span>${confirmDel ? `<button class="btn warn" data-del="2">Sí, eliminar ${esc(s.nombre)}</button><button class="btn ghost" data-del="0">Cancelar</button>` : '<button class="btn ghost" data-del="1">Eliminar</button>'}</div></section>
   <section class="card"><h2>Prioridades y tiempos</h2><p class="sub">A, M y B son alta, media y baja y deciden el orden. F saca la tarea del plan. El orden de los grupos con ↑ ↓ cuenta dentro de cada prioridad.</p>${groups ? `<div class="ptable">${groups}</div>` : '<div class="empty">Sin tareas todavía. Añade una aquí o actualiza con un texto de la IA.</div>'}${manualForm(scope)}</section></div>
   <aside class="side"><h2>Hasta dónde llegas</h2><p class="sub">Elige hasta qué fila es tu objetivo en ${esc(s.nombre)}.</p><div class="lad">${lad || '<div class="empty">Nada pendiente.</div>'}</div></aside></div>`;
}
function subOptions() {return S.app.order.map(id => ({v: id, label: S.subs[id].nombre, sw: colorOf(id)}))}
function manualForm(fixed) {
  if (!fixed && !S.subs[ma.sid]) ma.sid = S.app.order[0] || '';
  return `<div class="addbox">${fixed ? '' : `<div class="field wide"><span class="lbl">Asignatura</span>${chips({key: 'maSub', value: ma.sid, options: subOptions(), label: 'Asignatura de la tarea'})}</div>`}
   <div class="field wide"><label class="lbl" for="ma-nom">Tarea</label><input id="ma-nom" type="text" value="${esc(ma.nom)}" placeholder="Qué hay que hacer"></div>
   <div class="field"><span class="lbl">Minutos aprox.</span>${stepper({key: 'maMin', value: ma.min, step: 5, min: 5, max: 600, fmt: v => v + ' min', label: 'Minutos aproximados'})}</div>
   <div class="field"><span class="lbl">Prioridad</span>${seg({key: 'maPri', value: ma.pri, options: PRIO, label: 'Prioridad de la tarea'})}</div>
   <div class="row-btns"><button class="btn" data-addman="${esc(fixed || '')}">Añadir tarea</button><span class="status neg">${esc(formErr)}</span></div></div>`;
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
    const rows = al.plan[x.d].filter(f), capM = x.h * 60, sum = {}; rows.forEach(r => sum[r.it.sid] = (sum[r.it.sid] || 0) + r.m);
    const tot = rows.reduce((a, r) => a + r.m, 0), free = x.closed ? 0 : al.rem[x.d];
    if (scope !== 'general' && !rows.length) return '';
    const sl = x.raw && x.raw.slots && x.raw.slots.length ? x.raw.slots.map(y => y.ini + '–' + y.fin).join(' · ') : '';
    return `<article class="session"><div class="s-head"><h3>${dayLabel(x.d, {weekday: 'long', month: 'long'})}</h3><span class="num">${sl ? sl + ' · ' : ''}${fmt(tot)} de ${fmt(capM)}</span>
     ${x.d < TODAY ? '<span class="num">Pasado</span>' : toggle({key: 'closed', id: x.d, value: !!S.app.closed[x.d], label: 'Terminado'})}</div>
     <div class="fill">${Object.keys(sum).map(id => `<i style="width:${capM ? Math.min(100, 100 * sum[id] / capM) : 0}%;background:${colorOf(id)}"></i>`).join('')}</div>
     ${al.warn && al.warn[x.d] ? `<div class="warn">Los mínimos suman ${fmt(al.warn[x.d].tot)} y hay ${fmt(al.warn[x.d].cap)}. Hoy no se aplican.</div>` : ''}
     ${rows.length ? '<div class="cols"><span>Tarea</span><span>Estimado</span><span>Real (min)</span></div>' : ''}${dayBlocks(S.app, x.raw, al.plan[x.d]).filter(b => scope === 'general' || b.sid === scope).map(b => `<div class="blk">${sw(b.sid)}${esc(b.name)}<span class="num">${b.ini !== null ? toTime(b.ini) + ' a ' + toTime(b.fin) + ' · ' : ''}${fmt(b.m)}</span></div>${b.rows.map(r => rowHTML(r, x.d)).join('')}`).join('')}
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
  return `<div class="addbox"><div class="field wide"><span class="lbl">Asignatura</span>${chips({key: 'exSub', value: ex.sid, options: subOptions(), label: 'Asignatura'})}</div><div class="field wide"><label class="lbl" for="ex-nom">Qué vas a hacer</label><input id="ex-nom" type="text" value="${esc(ex.nom)}"></div><div class="row-btns"><button class="btn" data-extra="1">Empezar con cronómetro</button><span class="status neg">${esc(formErr)}</span></div></div>`;
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
  const base = pa ? r.pb.phase : (brk ? from : ph), toRev = base === 'do' && it && it.rev, lbl = toRev ? 'Siguiente: revisar' : 'Tarea acabada';
  let b = '';
  if (pa) b = '<button class="btn" data-act="unpause">Reanudar</button><button class="btn ghost" data-act="end">Acabar día</button>';
  else if (parar) b = '<button class="btn" data-act="pause">Pausa</button><button class="btn alt" data-act="end">Acabar día</button><button class="btn ghost" data-act="noparar">Cancelar</button>';
  else {
    if (ph === 'do' || ph === 'review') b = `<button class="btn" data-act="next">${lbl}</button><button class="btn alt" data-act="break">Descanso</button>`;
    if (brk) b = `<button class="btn" data-act="resume">Reanudar</button><button class="btn alt" data-act="next">${lbl}</button>`;
    b += '<button class="btn ghost" data-act="parar">Parar</button>';
  }
  const stale = r.day < TODAY ? `<div class="banner"><span>Esta sesión sigue abierta desde el ${dayLabel(r.day)}.</span><div class="row-btns"><button class="btn alt" data-act="carry">Seguir hoy</button><button class="btn alt" data-act="discard">Cerrarla sin contar el último tramo</button></div></div>` : '';
  const pend = al.pend.filter(p => p.it.key !== r.key).slice(0, 80);
  const changes = nxt && nxt.sid !== r.sid;
  v.innerHTML = stale + `<div class="focus" data-phase="${ph === 'free' ? '' : ph}"><div class="state"><i></i>${STATE[ph]}</div><div class="phase">${it ? esc(it.subName) : ''}${brk ? ' · parado en ' + PHASE[from].toLowerCase() : ''}${pa ? ' · parado en ' + PHASE[base === 'break' ? 'break' : base].toLowerCase() : ''}${it && it.extra ? ' · fuera del plan' : ''}</div>
    <h2>${it ? esc(it.name) : 'Has acabado lo previsto'}</h2>${it && it.det ? `<p>${esc(it.det)}</p>` : ''}${it ? '' : '<p>Si sigues estudiando, añade abajo lo que vas a hacer. Si no, pulsa Parar.</p>'}
    <div class="big" id="bigT"></div><div class="bigsub" id="bigS"></div><div class="actions">${b}</div></div>
   <div class="minis"><div><small>Estudio hoy</small><b id="miStudy"></b></div><div><small>Descanso hoy</small><b id="miBreak"></b></div><div><small>Esta tarea</small><b id="miTask"></b></div><div><small>${changes ? 'Después cambias a' : 'Después'}</small><span class="nx">${nxt ? esc(nxt.subName) + ' · ' + esc(nxt.name) : 'Nada más pendiente'}</span></div></div>
   <div class="row-btns">${it ? `<button class="btn ghost" data-showextra="1">Tarea fuera del plan</button><button class="btn ghost" data-act="minus5">Quitar 5 min a este tramo</button>` : ''}</div>
   ${showExtra || !it ? extraForm() : ''}
   ${it && pend.length ? `<div class="aux"><div class="field wide"><span class="lbl">Cambiar de tarea</span>${menu({key: 'switchTask', value: '', open: menuOpen === 'switchTask|', placeholder: 'Elige otra tarea', label: 'Cambiar de tarea', options: pend.map(p => ({v: p.it.key, label: p.it.name, sub: p.it.det, sw: colorOf(p.it.sid), group: p.it.subName}))})}</div></div>` : ''}`;
}
function tick() {
  const r = S.app.run, now = Date.now(), b = $('startBtn');
  b.textContent = r ? 'Volver a la sesión' : 'Empezar día'; b.hidden = view === 'sesion';
  if (!r || view !== 'sesion' || !$('bigT')) return;
  const c = L.clock(S, now, TODAY); let big = 0, sub = '', over = false;
  const lib = c.it && c.it.libre, base = r.phase === 'pause' ? r.pb.phase : r.phase;
  if (r.phase === 'pause') {big = base === 'review' ? c.rev : base === 'break' ? c.cur : lib ? c.doM : c.left; sub = 'En pausa desde hace ' + L.fmtClock(c.cur) + '. No cuenta como estudio ni como descanso'}
  else if (r.phase === 'do') {if (lib) {big = c.doM; sub = 'Cronómetro. Cuenta como estudio de ' + c.it.subName} else {big = c.left; over = c.left < 0; sub = over ? '<span class="pill">Tiempo superado</span>' : 'Queda de ' + fmt(c.it ? c.it.m : 0)}}
  else if (r.phase === 'review') {big = c.cur; sub = 'Revisión sin límite. Cuenta como estudio'}
  else if (r.phase === 'break') {big = c.cur; sub = 'Estudio y tarea parados'}
  $('bigT').textContent = L.fmtClock(big); $('bigS').innerHTML = sub.startsWith('<') ? sub : esc(sub);
  const day = S.app.days.find(x => x.d === r.day);
  $('miStudy').textContent = L.fmtClock(c.sDay) + (day ? ' de ' + fmt(day.h * 60) : ''); $('miBreak').textContent = L.fmtClock(c.bDay); $('miTask').textContent = L.fmtClock(c.doM) + ' + ' + L.fmtClock(c.rev) + ' rev.';
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
    case 'limite': curSub().limite = val; pick = null; break;
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
    case 'exSub': ex.sid = val; render(); return;
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
});
document.addEventListener('change', e => {
  const el = e.target, d = el.dataset, num = parseFloat(el.value);
  if (d.done) {
    const it = L.findItem(S, d.done, TODAY); if (!it) return;
    if (el.checked) L.markDone(S, it, d.day, +S.subs[it.sid].real[it.key] || 0); else L.unmarkDone(S, it); touch();
  }
  else if (d.real) {const sid = d.real.split('/')[0], s = S.subs[sid], v = Math.max(0, num || 0); if (v) s.real[d.real] = v; else delete s.real[d.real]; touch()}
  else if (d.target) {curSub().target = d.target; touch()}
  else if (el.id === 'f-nombre') {if (el.value.trim()) {curSub().nombre = el.value.trim(); touch()}}
});
document.addEventListener('click', e => {
  if ((pick && !e.target.closest('.dp')) || (menuOpen && !e.target.closest('.mn'))) {pick = null; menuOpen = null; render(); if (!e.target.closest('button')) return}
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
    formErr = ''; L.addManual(S, sid, {nombre: nom, min: ma.min, prio: ma.pri}, Date.now()); ma.nom = ''; planAdd = false; commit();
  }
  else if (d.planadd) {planAdd = true; formErr = ''; render()}
  else if (d.delman) {L.removeManual(S, d.delman); commit()}
  else if (d.showextra) {showExtra = !showExtra; formErr = ''; render()}
  else if (d.extra) {
    const nom = ex.nom.trim();
    if (!nom || !ex.sid) {formErr = 'Escribe qué vas a hacer.'; render(); return}
    formErr = ''; L.startExtra(S, ex.sid, nom, Date.now()); ex.nom = ''; showExtra = false; commit(); wake();
  }
  else if (d.applysched) {S.app.days = S.app.days.map(x => {if (x.d < TODAY) return x; const n = makeDay(S.app, x.d); return n.slots ? n : x}); commit()}
  else if (d.update) {scope = 'nueva'; render()}
  else if (d.del === '1') {confirmDel = true; render()}
  else if (d.del === '0') {confirmDel = false; render()}
  else if (d.del === '2') {const id = scope; delete S.subs[id]; S.app.order = S.app.order.filter(x => x !== id); if (S.app.run && S.app.run.sid === id) S.app.run = null; scope = 'general'; confirmDel = false; commit()}
  else if (d.act) {
    const now = Date.now();
    if (d.act === 'go') {if (!S.app.run) {L.startDay(S, TODAY, now); wake()} view = 'sesion'}
    else if (d.act === 'next') {L.nextStep(S, now); wake()}
    else if (d.act === 'break') L.goBreak(S, now);
    else if (d.act === 'resume') {L.resumeWork(S, now); wake()}
    else if (d.act === 'end') {L.endDay(S, now); parar = false}
    else if (d.act === 'parar') parar = true;
    else if (d.act === 'noparar') parar = false;
    else if (d.act === 'pause') {L.goPause(S, now); parar = false}
    else if (d.act === 'unpause') {L.unpause(S, now); wake()}
    else if (d.act === 'carry') L.carryOver(S, TODAY, now);
    else if (d.act === 'discard') L.discardRun(S);
    else if (d.act === 'minus5') L.trimRun(S, 5, now);
    commit();
  }
  else if (d.cal) {const i = S.app.days.findIndex(x => x.d === d.cal); if (i >= 0) S.app.days.splice(i, 1); else S.app.days.push(makeDay(S.app, d.cal)); touch()}
  else if (d.rm) {S.app.days = S.app.days.filter(x => x.d !== d.rm); touch()}
  else if (d.month) {const [y, m] = month.split('-').map(Number); month = new Date(Date.UTC(y, m - 1 + +d.month, 1)).toISOString().slice(0, 7); render()}
  else if (d.exp) {const k = scope + d.exp; if (expanded.has(k)) expanded.delete(k); else expanded.add(k); render()}
  else if (d.subup) {const o = [...S.app.order], i = o.indexOf(d.subup), j = i + +d.d; if (j >= 0 && j < o.length) {[o[i], o[j]] = [o[j], o[i]]; S.app.order = o; touch()}}
  else if (d.gmv) {const l = curSub().grupos, i = l.findIndex(g => g.id === d.gmv), j = i + +d.d; if (j >= 0 && j < l.length) {[l[i], l[j]] = [l[j], l[i]]; touch()}}
  else if (d.prop) {undo = S.app.days.map(x => ({...x})); S.app.days = props[d.prop].days.map(x => ({...x})); touch()}
  else if (d.undo && undo) {S.app.days = undo; undo = null; touch()}
});
bindSlots({get: getSlots, set: setSlots, edit: openSlotEdit});
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
    if (S.app.run) view = 'sesion';
    render(); setStatus(store.warn || (store.needLogin ? 'Sin entrar: se guarda solo en este navegador.' : 'Se guarda solo en este navegador.')); return;
  }
  db = store.db; let first = true;
  const slow = setTimeout(() => setStatus('Aún no llega lo guardado. Puede estar desactualizado.'), 10000);
  const apply = () => {if (first && S.app.run) view = 'sesion'; render()};
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
