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
