/* Pruebas de la lógica. Ejecuta: npm test (o node --test) */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import {SAMPLE} from '../js/sample.js';

const app = (o = {}) => ({...L.newState().app, brkH: 10, ...o});

test('studyHours descuenta el descanso por hora y redondea a cuartos', () => {
  assert.equal(L.studyHours(app(), '15:00', '20:30'), 4.75);
  assert.equal(L.studyHours(app({brkH: 0}), '16:00', '21:00'), 5);
  assert.equal(L.studyHours(app(), '21:00', '16:00'), 0);
});

test('migrateApp pasa el horario de una franja a varias', () => {
  const a = L.migrateApp(app({
    sched: {0: {on: true, ini: '15:00', fin: '20:30'}, 5: {on: false, ini: '10:00', fin: '14:00'}},
    days: [{d: '2026-11-13', h: 4.25, ini: '16:00', fin: '21:00', auto: true}, {d: '2026-11-14', h: 8}]
  }));
  assert.equal(a.v, 3);
  assert.deepEqual(a.dord, {});
  assert.deepEqual(a.sched[0], {slots: [{ini: '15:00', fin: '20:30'}]});
  assert.deepEqual(a.sched[5], {slots: []});
  assert.deepEqual(a.days[0].slots, [{ini: '16:00', fin: '21:00'}]);
  assert.equal(a.days[0].ini, undefined);
  assert.equal(a.days[1].slots, undefined);
  assert.deepEqual(L.migrateApp(a), a, 'migrar dos veces no cambia nada');
});

test('cleanSlots ordena y une franjas que se solapan', () => {
  assert.deepEqual(L.cleanSlots([{ini: '18:00', fin: '20:00'}, {ini: '09:00', fin: '11:00'}, {ini: '19:00', fin: '21:00'}]),
    [{ini: '09:00', fin: '11:00'}, {ini: '18:00', fin: '21:00'}]);
});

test('makeDay copia las franjas del día de la semana y suma sus horas', () => {
  const a = app({sched: {0: {slots: [{ini: '09:00', fin: '12:30'}, {ini: '16:00', fin: '20:40'}]}}});
  const d = L.makeDay(a, '2026-11-16'); // lunes
  assert.equal(d.slots.length, 2);
  assert.equal(d.h, L.studyHours(a, '09:00', '12:30') + L.studyHours(a, '16:00', '20:40'));
  const free = L.makeDay(a, '2026-11-17'); // martes sin franjas
  assert.equal(free.slots, undefined);
  assert.equal(free.h, Math.min(a.defH, a.maxH));
});

test('withHours estira o recorta la última franja', () => {
  const a = app(), d = {d: '2026-11-16', h: 4.75, slots: [{ini: '15:00', fin: '20:30'}], auto: true};
  assert.deepEqual(L.withHours(a, d, 6).slots, [{ini: '15:00', fin: '22:00'}]);
  assert.equal(L.withHours(a, d, 3).h, 3);
  const two = {d: '2026-11-16', h: 0, slots: [{ini: '10:00', fin: '11:00'}, {ini: '17:00', fin: '18:00'}]};
  const r = L.withHours(a, two, 0.25);
  assert.equal(r.slots.length, 1, 'si sobra una franja entera, se quita');
});

test('dayBlocks salta el hueco entre franjas', () => {
  const a = app({brkH: 0});
  const day = {d: '2026-11-16', h: 4, slots: [{ini: '09:00', fin: '11:00'}, {ini: '16:00', fin: '18:00'}]};
  const it = sid => ({sid, subName: sid});
  const b = L.dayBlocks(a, day, [{it: it('a'), m: 90}, {it: it('b'), m: 90}]);
  assert.equal(L.toTime(b[0].ini), '09:00');
  assert.equal(L.toTime(b[1].ini), '10:30');
  assert.equal(L.toTime(b[1].fin), '17:00', '30 min antes de las 11 y 60 desde las 16');
});

test('el ejemplo de Estructuras se lee y se reparte en los días', () => {
  const r = L.parseText(JSON.stringify(SAMPLE));
  assert.ok(r.ok);
  const S = L.newState();
  r.subs.forEach(s => L.applySub(S, s));
  S.app.days = ['2026-11-16', '2026-11-17', '2026-11-18'].map(d => ({d, h: 4}));
  const al = L.allocate(S, '2026-11-16');
  const planned = Object.values(al.plan).flat().reduce((a, x) => a + x.m, 0);
  assert.ok(planned > 11 * 60 && planned <= 12 * 60, 'llena casi todas las 12 h (los restos de menos de 15 min quedan libres)');
  assert.ok(al.lost.length > 0, 'lo que no cabe queda fuera');
});

test('una tarea fijada a un día va a ese día y el resto se recoloca', () => {
  const S = L.newState();
  L.parseText(JSON.stringify(SAMPLE)).subs.forEach(s => L.applySub(S, s));
  const days = ['2026-11-16', '2026-11-17', '2026-11-18'];
  S.app.days = days.map(d => ({d, h: 2}));
  const before = L.allocate(S, '2026-11-16');
  const first = before.plan['2026-11-16'][0].it.key;
  assert.ok(before.plan['2026-11-16'].some(r => r.it.key === first));
  L.pinTask(S, first, '2026-11-18');
  const after = L.allocate(S, '2026-11-16');
  assert.ok(!after.plan['2026-11-16'].some(r => r.it.key === first), 'ya no está el lunes');
  const row = after.plan['2026-11-18'].find(r => r.it.key === first);
  assert.ok(row && row.it.pinned === '2026-11-18', 'está fijada el miércoles');
  L.pinTask(S, first, '');
  assert.equal(S.subs[first.split('/')[0]].pin[first], undefined);
});

test('una fijación a un día pasado se ignora', () => {
  const S = L.newState();
  L.parseText(JSON.stringify(SAMPLE)).subs.forEach(s => L.applySub(S, s));
  S.app.days = ['2026-11-15', '2026-11-16'].map(d => ({d, h: 2}));
  const key = L.allocate(S, '2026-11-16').plan['2026-11-16'][0].it.key;
  L.pinTask(S, key, '2026-11-15');
  assert.ok(L.allocate(S, '2026-11-16').plan['2026-11-16'].some(r => r.it.key === key));
});

test('el orden puesto a mano en un día se respeta', () => {
  const S = L.newState();
  L.parseText(JSON.stringify(SAMPLE)).subs.forEach(s => L.applySub(S, s));
  S.app.days = [{d: '2026-11-16', h: 3}];
  const keys = L.allocate(S, '2026-11-16').plan['2026-11-16'].map(r => r.it.key);
  assert.ok(keys.length >= 3);
  const nuevo = [keys[2], keys[0], keys[1], ...keys.slice(3)];
  L.setDayOrder(S, '2026-11-16', nuevo);
  assert.deepEqual(L.allocate(S, '2026-11-16').plan['2026-11-16'].map(r => r.it.key), nuevo);
});

test('reimportar una asignatura conserva las fijaciones', () => {
  const S = L.newState(), sub = L.parseText(JSON.stringify(SAMPLE)).subs[0];
  L.applySub(S, sub);
  L.pinTask(S, 'estructuras/tor1', '2026-11-20');
  L.applySub(S, L.parseText(JSON.stringify(SAMPLE)).subs[0]);
  assert.equal(S.subs.estructuras.pin['estructuras/tor1'], '2026-11-20');
});

test('dayStats resume el día: estudio, descansos, bloque más largo y tareas', () => {
  const S = L.newState();
  L.parseText(JSON.stringify(SAMPLE)).subs.forEach(s => L.applySub(S, s));
  const d = '2026-11-16', t0 = Date.UTC(2026, 10, 16, 15), min = 60000;
  S.app.days = [{d, h: 4}];
  S.log['2026-11'] = [
    {a: 'estructuras', d, k: 'estructuras/tor1', s: t0, e: t0 + 12 * min, t: 'd'},
    {a: 'estructuras', d, k: 'estructuras/tor1', s: t0 + 12 * min, e: t0 + 15 * min, t: 'r'},
    {a: 'estructuras', d, k: 'estructuras/tor1', s: t0 + 15 * min, e: t0 + 20 * min, t: 'b'},
    {a: 'estructuras', d, k: 'estructuras/tor2', s: t0 + 20 * min, e: t0 + 45 * min, t: 'd'},
    {a: 'estructuras', d, k: 'estructuras/tor2', s: t0 + 45 * min, e: t0 + 50 * min, t: 'p'}
  ];
  S.subs.estructuras.done['estructuras/tor1'] = d;
  const o = L.dayStats(S, d, t0 + 60 * min);
  assert.equal(o.plan, 240);
  assert.equal(Math.round(o.study), 40);
  assert.equal(Math.round(o.brk), 5);
  assert.equal(o.nBreaks, 1);
  assert.equal(Math.round(o.paus), 5);
  assert.equal(Math.round(o.maxStint), 25);
  assert.equal(Math.round(o.bySub.estructuras), 40);
  assert.equal(o.tasks.length, 1);
  assert.equal(Math.round(o.tasks[0].real), 15);
  assert.equal(o.tasks[0].est, 10);
});

test('alerts: descanso a los 50 min seguidos, fin de tarea y fin del descanso', () => {
  const S = L.newState();
  L.parseText(JSON.stringify(SAMPLE)).subs.forEach(s => L.applySub(S, s));
  const d = '2026-11-16', t0 = Date.UTC(2026, 10, 16, 15), min = 60000;
  S.app.days = [{d, h: 4}];
  L.startDay(S, d, t0);
  const r = S.app.run, it = L.findItem(S, r.key, d);
  let a = L.alerts(S);
  assert.equal(a.find(x => x.kind === 'brk').at, t0 + 50 * min);
  assert.equal(a.find(x => x.kind === 'tarea').at, t0 + it.m * min);
  assert.deepEqual(L.alerts(S), a, 'no depende de la hora');
  // 30 min estudiando, pasa a revisar: el descanso sigue contando desde el principio.
  S.log['2026-11'] = [{a: r.sid, d, k: r.key, s: t0, e: t0 + 30 * min, t: 'd'}];
  r.phase = 'review'; r.since = t0 + 30 * min;
  a = L.alerts(S);
  assert.equal(a.length, 1);
  assert.equal(a[0].at, t0 + 50 * min);
  // Descanso: avisa a los 10 min.
  L.goBreak(S, t0 + 40 * min);
  a = L.alerts(S);
  assert.equal(a.length, 1);
  assert.equal(a[0].kind, 'fin');
  assert.equal(a[0].at, t0 + 50 * min);
  // Tras el descanso, el contador de 50 min vuelve a empezar.
  L.resumeWork(S, t0 + 48 * min);
  assert.equal(L.alerts(S)[0].at, t0 + 98 * min);
  // En pausa no hay avisos; una pausa larga cuenta como descanso.
  L.goPause(S, t0 + 60 * min);
  assert.deepEqual(L.alerts(S), []);
  L.unpause(S, t0 + 75 * min);
  assert.equal(L.alerts(S)[0].at, t0 + 125 * min);
  assert.deepEqual(L.alerts({app: {run: null}, subs: {}, log: {}}), []);
});

test('tarea abierta: un rato cada día hasta acabarla', () => {
  const S = L.newState();
  L.parseText(JSON.stringify(SAMPLE)).subs.forEach(s => L.applySub(S, s));
  const sid = S.app.order[0], d1 = '2026-11-16', d2 = '2026-11-17', d3 = '2026-11-18', t0 = Date.UTC(2026, 10, 16, 15), min = 60000;
  S.app.days = [{d: d1, h: 4}, {d: d2, h: 4}, {d: d3, h: 4}];
  const k = L.addManual(S, sid, {nombre: 'Leer el libro', minDia: 30, desde: d1}, t0);
  let its = L.buildItems(S, d1).filter(i => i.taskKey === k);
  assert.deepEqual(its.map(i => i.key), [k + '@' + d1, k + '@' + d2, k + '@' + d3]);
  assert.ok(its.every(i => i.open && i.m === 30));
  const al = L.allocate(S, d1);
  assert.ok(al.plan[d1].some(r => r.it.key === k + '@' + d1), 'entra el primer día');
  assert.ok(al.plan[d2].some(r => r.it.key === k + '@' + d2), 'y el segundo');
  // Sesión: «Por hoy» marca solo el día; sigue al día siguiente.
  S.app.run = {day: d1, phase: 'do', key: k + '@' + d1, sid, since: t0, back: null};
  L.nextStep(S, t0 + 40 * min);
  assert.equal(S.subs[sid].done[k + '@' + d1], d1);
  assert.ok(!S.subs[sid].done[k]);
  assert.equal(L.buildItems(S, d2).filter(i => i.taskKey === k && !i.done).length, 2);
  // «Acabada» la cierra: no sale más días.
  S.app.run = {day: d2, phase: 'do', key: k + '@' + d2, sid, since: t0 + 24 * 60 * min, back: null};
  L.finishOpen(S, t0 + 24 * 60 * min + 20 * min);
  assert.equal(S.subs[sid].done[k], d2);
  assert.equal(L.buildItems(S, d2).filter(i => i.taskKey === k).length, 0);
  // Desmarcarla la reabre.
  L.unmarkDone(S, {sid, key: k + '@' + d2, taskKey: k, open: true});
  assert.ok(!S.subs[sid].done[k]);
  // Desde el texto de la IA.
  const r = L.parseText(JSON.stringify({formato: 'hoja-carga/1', asignatura: {nombre: 'TFG', grupos: [{id: 'g', nombre: 'Memoria', tareas: [{id: 'escribir', nombre: 'Escribir', minutos_por_dia: 45, desde: '2026-11-20'}]}]}}));
  assert.ok(r.ok, JSON.stringify(r.errors));
  const T = r.subs[0].grupos[0].tareas[0];
  assert.equal(T.minDia, 45); assert.equal(T.desde, '2026-11-20');
  const back = L.exportSub(Object.assign(L.emptyProgress(), r.subs[0]));
  assert.equal(back.asignatura.grupos[0].tareas[0].minutos_por_dia, 45);
  assert.ok(!L.parseText(JSON.stringify({formato: 'hoja-carga/1', asignatura: {nombre: 'X', grupos: [{nombre: 'G', tareas: [{nombre: 'Sin tiempo'}]}]}})).ok);
});

test('reparto: tareas enteras; los exámenes no se parten', () => {
  const S = L.newState();
  const exams = Array.from({length: 10}, (_, i) => ({id: 'ex' + i, nombre: 'Examen ' + i, minutos: 150}));
  const r = L.parseText(JSON.stringify({formato: 'hoja-carga/1', asignatura: {nombre: 'Fluidos', fecha_limite: '2026-12-20', grupos: [
    {id: 'ondas', nombre: 'Ondas', tipo: 'examen', tareas: exams},
    {id: 'ej', nombre: 'Ejercicios', tipo: 'ejercicios', tareas: [{id: 'e1', nombre: 'Ej 1', minutos: 100}]}]}}));
  assert.ok(r.ok, JSON.stringify(r.errors));
  r.subs.forEach(s => L.applySub(S, s));
  const t = '2026-11-26';
  S.app.days = Array.from({length: 10}, (_, i) => ({d: L.addDays(t, i), h: 3.75}));
  const al = L.allocate(S, t);
  const rows = Object.values(al.plan).flat().filter(x => x.it.gid === 'ondas');
  assert.equal(rows.length, 10, 'un trozo por examen');
  assert.ok(rows.every(x => x.m === 150 && !x.part), 'cada examen entero: ' + rows.map(x => x.m).join(','));
  // El ejercicio de 100 min se parte si no cabe en lo que queda del día.
  const ej = Object.values(al.plan).flat().filter(x => x.it.key.endsWith('/e1'));
  assert.equal(ej.reduce((a, x) => a + x.m, 0), 100);
});
