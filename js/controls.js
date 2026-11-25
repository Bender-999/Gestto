/* Controles propios de la hoja. Cada función devuelve HTML.
   Convención: un botón que cambia un valor lleva data-set="<clave>", data-id (opcional) y
   data-val con el valor ya calculado; ui.js los recoge en un único manejador (applySet). */
import {toMin, toClock, studyHours, DAY_START, DAY_END} from './logic.js';

export const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const r2 = x => Math.round(x * 100) / 100;
const idAttr = id => id === undefined || id === null || id === '' ? '' : ` data-id="${esc(id)}"`;

/* Botones − y + alrededor de un valor. */
export function stepper({key, id, value, step = 1, min = 0, max = Infinity, fmt = String, label = '', size = '', base}) {
  const v = +value || 0, dn = Math.max(min, r2(v - step)), up = Math.min(max, r2(v + step));
  const b = base === undefined ? '' : ` data-base="${esc(base)}"`;
  return `<div class="stp ${size}" role="group" aria-label="${esc(label)}">` +
    `<button type="button" class="stp-b" data-set="${key}"${idAttr(id)}${b} data-val="${dn}" aria-label="${esc(label)}: menos" ${v <= min ? 'disabled' : ''}>−</button>` +
    `<output class="stp-v">${esc(fmt(v))}</output>` +
    `<button type="button" class="stp-b" data-set="${key}"${idAttr(id)}${b} data-val="${up}" aria-label="${esc(label)}: más" ${v >= max ? 'disabled' : ''}>+</button></div>`;
}

/* Opciones excluyentes unidas en una barra. options: [{v, label, dot, title}] */
export function seg({key, id, value, options, label = '', size = ''}) {
  return `<div class="segc ${size}" role="group" aria-label="${esc(label)}">` + options.map(o => {
    const on = String(o.v) === String(value);
    return `<button type="button" data-set="${key}"${idAttr(id)} data-val="${esc(o.v)}" aria-pressed="${on}" ${o.title ? `title="${esc(o.title)}" aria-label="${esc(o.title)}"` : ''}>` +
      `${o.dot ? `<i class="dot" style="background:${o.dot}"></i>` : ''}${esc(o.label)}</button>`;
  }).join('') + '</div>';
}

/* Fichas sueltas en forma de píldora. */
export function chips({key, id, value, options, label = ''}) {
  return `<div class="chips" role="group" aria-label="${esc(label)}">` + options.map(o => {
    const on = String(o.v) === String(value);
    return `<button type="button" class="chipb" data-set="${key}"${idAttr(id)} data-val="${esc(o.v)}" aria-pressed="${on}">` +
      `${o.sw ? `<i class="dot" style="background:${o.sw}"></i>` : ''}${esc(o.label)}</button>`;
  }).join('') + '</div>';
}

/* Fila de bloques: se rellenan hasta el valor elegido. */
export function blocks({key, id, value, values, label = '', fmt = String}) {
  return `<div class="blocks" role="group" aria-label="${esc(label)}" style="grid-template-columns:repeat(${values.length},minmax(0,1fr))">` +
    values.map(v => `<button type="button" data-set="${key}"${idAttr(id)} data-val="${v}" aria-pressed="${v === +value}" aria-label="${esc(fmt(v))}" class="${+value > 0 && v > 0 && v <= +value ? 'fill' : ''}"></button>`).join('') +
    `</div><div class="blocks-scale"><span>${esc(fmt(values[0]))}</span><span>${esc(fmt(values[Math.floor(values.length / 2)]))}</span><span>${esc(fmt(values[values.length - 1]))}</span></div>`;
}

/* Interruptor. */
export function toggle({key, id, value, label}) {
  return `<button type="button" class="tgl" role="switch" aria-checked="${!!value}" data-set="${key}"${idAttr(id)} data-val="${!value}"><span class="tgl-k"></span><span class="tgl-l">${esc(label)}</span></button>`;
}

/* Selector de fecha con calendario propio. */
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
export function longDate(v) {
  if (!v) return '';
  const d = new Date(v + 'T00:00:00Z');
  return DIA[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MES[d.getUTCMonth()] + (d.getUTCFullYear() !== new Date().getFullYear() ? ' de ' + d.getUTCFullYear() : '');
}
export function datePick({key, id, value, open, month, today, label, empty = 'Sin fecha', marks = {}, allowed = null, inline = false, foot = null}) {
  const tok = key + '|' + (id ?? '');
  const days = value ? Math.round((Date.parse(value) - Date.parse(today)) / 864e5) : null;
  const sub = value ? (days > 0 ? `faltan ${days} ${days === 1 ? 'día' : 'días'}` : days === 0 ? 'es hoy' : 'ya pasó') : '';
  let pop = '';
  if (open || inline) {
    const m = month || (value || today).slice(0, 7), [y, mo] = m.split('-').map(Number);
    const first = new Date(Date.UTC(y, mo - 1, 1)), off = (first.getUTCDay() + 6) % 7, end = value ? iso(new Date(Date.parse(value) - 864e5)) : '';
    let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span class="dp-wd">${x}</span>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = new Date(Date.UTC(y, mo - 1, 1 - off + i)), v = iso(d), inM = d.getUTCMonth() === mo - 1;
      const cls = [inM ? '' : 'out', v === today ? 'today' : '', v === value ? 'sel' : '', v === end ? 'end' : '', v < today ? 'past' : '', marks[v] ? 'mark' : ''].join(' ');
      const dis = allowed && !allowed(v);
      cells += `<button type="button" class="dp-d ${cls}" data-set="${key}"${idAttr(id)} data-val="${v}" aria-label="${longDate(v)}" ${dis ? 'disabled' : ''}>${d.getUTCDate()}</button>`;
    }
    pop = `<div class="dp-pop" role="dialog" aria-label="${esc(label)}">
      <div class="dp-head"><button type="button" class="icon round" data-dpm="-1" aria-label="Mes anterior">‹</button><b>${MES[mo - 1][0].toUpperCase() + MES[mo - 1].slice(1)} ${y}</b><button type="button" class="icon round" data-dpm="1" aria-label="Mes siguiente">›</button></div>
      <div class="dp-grid">${cells}</div>
      ${foot !== null ? foot : `<div class="dp-foot"><span>${value ? 'El trabajo acaba el ' + longDate(end) + ' (en verde claro).' : ''}</span>${value ? `<button type="button" class="btn ghost sm" data-set="${key}"${idAttr(id)} data-val="">Quitar fecha</button>` : ''}</div>`}</div>`;
  }
  if (inline) return `<div class="dp dp-inline">${pop}</div>`;
  return `<div class="dp"><button type="button" class="dp-btn" data-dp="${esc(tok)}" aria-expanded="${!!open}" aria-label="${esc(label)}"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4.5" width="14" height="12.5" rx="3"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/></svg><span><b>${value ? esc(longDate(value)) : esc(empty)}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>${pop}</div>`;
}

/* Desplegable propio. options: [{v, label, sub, sw, group}] */
export function menu({key, id, value, options, open, placeholder = 'Elige', label = ''}) {
  const tok = key + '|' + (id ?? ''), cur = options.find(o => String(o.v) === String(value));
  let pop = '';
  if (open) {
    let last = null;
    pop = `<div class="mn-pop" role="listbox" aria-label="${esc(label)}">` + options.map(o => {
      const g = o.group && o.group !== last ? `<div class="mn-g">${esc(o.group)}</div>` : '';
      last = o.group;
      return g + `<button type="button" role="option" aria-selected="${o === cur}" data-set="${key}"${idAttr(id)} data-val="${esc(o.v)}">${o.sw ? `<i class="dot" style="background:${o.sw}"></i>` : ''}<span>${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span></button>`;
    }).join('') + '</div>';
  }
  return `<div class="mn"><button type="button" class="mn-btn" data-mn="${esc(tok)}" aria-expanded="${!!open}" aria-haspopup="listbox" aria-label="${esc(label)}">${cur && cur.sw ? `<i class="dot" style="background:${cur.sw}"></i>` : ''}<span>${esc(cur ? cur.label : placeholder)}</span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l5 5 5-5"/></svg></button>${pop}</div>`;
}

/* ---------- Franjas horarias ---------- */
const SPAN = DAY_END - DAY_START;
const pct = m => ((m - DAY_START) / SPAN * 100).toFixed(3) + '%';
export const hm = h => {const t = Math.round(h * 60); return pad(Math.floor(t / 60)) + ':' + pad(t % 60)};
export function parseHM(t) {
  const x = String(t || '').trim().toLowerCase().replace(/\s+/g, '');
  let m = /^(\d{1,2})[:h](\d{1,2})?$/.exec(x);
  if (m) return +m[1] + (m[2] ? +m[2] : 0) / 60;
  m = /^(\d{1,2})(?:[.,](\d+))?$/.exec(x);
  if (m) return parseFloat(m[1] + '.' + (m[2] || '0'));
  m = /^(\d{3,4})$/.exec(x);
  if (m) {const v = m[1].padStart(4, '0'); return +v.slice(0, 2) + +v.slice(2) / 60}
  return null;
}
export function axis() {
  let s = '';
  for (let m = DAY_START; m <= DAY_END; m += 120) s += `<i style="left:${pct(m)}">${m / 60}</i>`;
  return `<div class="trk-axis" aria-hidden="true">${s}</div>`;
}
function slotLabel(app, x) {
  const a = toMin(x.ini), b = toMin(x.fin), len = b - a;
  return len >= 150 ? x.ini + '–' + x.fin : len >= 45 ? hm(studyHours(app, x.ini, x.fin)) : '';
}
/* Aplica h horas de estudio a la franja j sin pisar a sus vecinas. */
export function slotWithHours(app, slots, j, h) {
  const k = (60 + (+app.brkH || 0)) / 60, s = slots.map(x => ({ini: toMin(x.ini), fin: toMin(x.fin)}));
  const lo = j > 0 ? s[j - 1].fin : DAY_START, hi = j < s.length - 1 ? s[j + 1].ini : DAY_END;
  const mins = Math.max(15, Math.round(h * 60 * k / 15) * 15);
  let ini = s[j].ini, fin = ini + mins;
  if (fin > hi) {fin = hi; ini = Math.max(lo, hi - mins)}
  s[j] = {ini, fin};
  return s.map(x => ({ini: toClock(x.ini), fin: toClock(x.fin)}));
}
export function slotsTrack({sk, slots, app, edit, label, readonly}) {
  let ticks = '';
  for (let m = DAY_START; m <= DAY_END; m += 120) ticks += `<i style="left:${pct(m)}"></i>`;
  const items = (slots || []).map((x, j) => {
    const a = toMin(x.ini), b = toMin(x.fin), on = edit && edit.sk === sk && edit.j === j;
    return `<div class="slot ${on ? 'editing' : ''}" data-j="${j}" style="left:${pct(a)};width:${((b - a) / SPAN * 100).toFixed(3)}%" title="${x.ini}–${x.fin} · ${hm(studyHours(app, x.ini, x.fin))} de estudio${readonly ? '' : ' · arrastra para mover, doble clic para editar'}">` +
      (readonly ? '' : '<span class="hd l" data-hd="l"></span>') + `<span class="slot-t">${esc(slotLabel(app, x))}</span>` + (readonly ? '' : '<span class="hd r" data-hd="r"></span>') + '</div>';
  }).join('');
  let pop = '';
  if (edit && edit.sk === sk && slots[edit.j]) {
    const x = slots[edit.j], c = (toMin(x.ini) + toMin(x.fin)) / 2, left = Math.min(78, Math.max(22, (c - DAY_START) / SPAN * 100));
    pop = `<div class="slot-pop ${edit.up ? 'up' : ''}" style="left:${left.toFixed(2)}%">
      <div class="slot-pop-h"><span>Horas de estudio</span><span id="slotPrev">${esc(edit.prev || (x.ini + '–' + x.fin))}</span></div>
      <div class="slot-pop-r"><div class="stp lg"><button type="button" class="stp-b" data-slotstep="-0.25" aria-label="15 minutos menos">−</button><input id="slotEditTxt" type="text" inputmode="numeric" placeholder="hh:mm" value="${esc(edit.txt)}" aria-label="Horas de estudio en formato hh:mm" autocomplete="off"><button type="button" class="stp-b" data-slotstep="0.25" aria-label="15 minutos más">+</button></div>
      <button type="button" class="btn icon-btn" data-slot="apply" aria-label="Aplicar"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9"/></svg></button></div>
      <div class="slot-pop-r"><button type="button" class="btn danger sm" data-slot="del">Borrar franja</button><button type="button" class="btn ghost sm" data-slot="cancel">Cancelar</button></div></div>`;
  }
  const free = !(slots || []).length ? `<span class="trk-free">${readonly ? 'Sin franjas' : 'Libre · doble clic para añadir una franja'}</span>` : '';
  return `<div class="trk ${readonly ? 'ro' : ''}" data-sk="${esc(sk)}" role="group" aria-label="${esc(label)}"><div class="trk-bg">${ticks}${free}</div>${items}${pop}</div>`;
}

/* Arrastre y doble toque de las franjas. get(sk) devuelve las franjas; set(sk, slots) las guarda;
   edit(sk, j) abre el editor de horas de la franja j. */
export function bindSlots({get, set, edit}) {
  let drag = null, last = null;
  const dbl = (key, x) => {
    const now = Date.now();
    if (last && last.key === key && now - last.t < 350 && Math.abs(x - last.x) < 14) {last = null; return true}
    last = {key, t: now, x}; return false;
  };
  document.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    const trk = e.target.closest('.trk');
    if (!trk || trk.classList.contains('ro') || e.target.closest('.slot-pop')) return;
    const sk = trk.dataset.sk, slotEl = e.target.closest('.slot');
    if (slotEl) {
      e.preventDefault();
      const j = +slotEl.dataset.j, hd = e.target.closest('[data-hd]'), mode = hd ? hd.dataset.hd : 'm';
      if (mode === 'm' && dbl(sk + '#' + j, e.clientX)) {drag = null; edit(sk, j); return}
      const sl = get(sk) || [], x = sl[j];
      if (!x) return;
      drag = {sk, j, mode, id: e.pointerId, x0: e.clientX, w: trk.getBoundingClientRect().width, ini: toMin(x.ini), fin: toMin(x.fin),
        lo: j > 0 ? toMin(sl[j - 1].fin) : DAY_START, hi: j < sl.length - 1 ? toMin(sl[j + 1].ini) : DAY_END, el: slotEl, moved: false, nIni: toMin(x.ini), nFin: toMin(x.fin)};
      try {slotEl.setPointerCapture(e.pointerId)} catch (_) {}
      slotEl.classList.add('drag');
      return;
    }
    if (dbl(sk, e.clientX)) {
      const r = trk.getBoundingClientRect(), at = DAY_START + (e.clientX - r.left) / r.width * SPAN;
      const sl = (get(sk) || []).map(x => ({ini: toMin(x.ini), fin: toMin(x.fin)}));
      if (sl.some(x => x.ini < at && x.fin > at)) return;
      let lo = DAY_START, hi = DAY_END;
      for (const x of sl) {if (x.fin <= at) lo = Math.max(lo, x.fin); if (x.ini >= at) hi = Math.min(hi, x.ini)}
      if (hi - lo < 30) return;
      const ini = Math.min(Math.max(lo, Math.round((at - 30) / 15) * 15), hi - 30), fin = Math.min(ini + 60, hi);
      set(sk, [...sl, {ini, fin}].sort((a, b) => a.ini - b.ini).map(x => ({ini: toClock(x.ini), fin: toClock(x.fin)})));
    }
  });
  document.addEventListener('pointermove', e => {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    const dm = Math.round((e.clientX - g.x0) / g.w * SPAN / 15) * 15;
    let ini = g.ini, fin = g.fin;
    if (g.mode === 'm') {const len = g.fin - g.ini; ini = Math.min(Math.max(g.lo, g.ini + dm), g.hi - len); fin = ini + len}
    else if (g.mode === 'l') ini = Math.min(Math.max(g.lo, g.ini + dm), g.fin - 15);
    else fin = Math.max(Math.min(g.hi, g.fin + dm), g.ini + 15);
    if (ini === g.nIni && fin === g.nFin) return;
    g.nIni = ini; g.nFin = fin; g.moved = true;
    g.el.style.left = pct(ini); g.el.style.width = ((fin - ini) / SPAN * 100).toFixed(3) + '%';
    const t = g.el.querySelector('.slot-t'); if (t) t.textContent = toClock(ini) + '–' + toClock(fin);
  });
  const end = e => {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    drag = null; g.el.classList.remove('drag');
    if (!g.moved) return;
    const sl = (get(g.sk) || []).map(x => ({...x}));
    sl[g.j] = {ini: toClock(g.nIni), fin: toClock(g.nFin)};
    set(g.sk, sl);
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}
