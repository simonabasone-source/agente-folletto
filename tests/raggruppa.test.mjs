import test from 'node:test';
import assert from 'node:assert/strict';
import { raggruppaPerVia, chiaveVia } from '../js/raggruppa.js';

test('raggruppa per paese e via, civici in ordine di numero, via più recente prima', () => {
  const c = [
    { id: 'a', comune: 'Carpaneto', via: 'Via Roma', civico: '12', esito: 'assente', confermato: true, creato: '2026-11-26T10:00' },
    { id: 'b', comune: 'Carpaneto', via: 'Via Roma', civico: '3', esito: 'appuntamento', confermato: true, creato: '2026-11-26T10:05' },
    { id: 'c', comune: 'Carpaneto', via: 'Via Roma', civico: '12A', esito: 'ripassare', confermato: false, creato: '2026-11-26T10:06' },
    { id: 'd', comune: 'Carpaneto', via: 'Via Alfieri', civico: null, esito: 'assente', confermato: true, creato: '2026-11-26T11:00' },
    { id: 'e', comune: 'Santo Stefano', via: 'Via Roma', civico: '1', esito: 'assente', confermato: true, creato: '2026-11-26T09:00' },
  ];
  const g = raggruppaPerVia(c);
  assert.deepEqual(g.map((x) => `${x.comune}/${x.via}`), ['Carpaneto/Via Alfieri', 'Carpaneto/Via Roma', 'Santo Stefano/Via Roma']);
  assert.deepEqual(g[1].contatti.map((x) => x.id), ['b', 'a', 'c']);
  assert.deepEqual(g[1].conteggi, { citofoni: 3, appuntamenti: 1, ripassi: 1, daConfermare: 1 });
  assert.equal(g[1].chiave, chiaveVia('Carpaneto', 'Via Roma'));
});

test('un condominio senza cognomi crea comunque la sua tendina (caso di Dani 27/11)', () => {
  const condomini = [{ id: 'p1', comune: null, via: null, civico: '30', campanelli: 12, creato: '2026-11-27T09:00' }];
  const g = raggruppaPerVia([], condomini);
  assert.equal(g.length, 1);
  assert.equal(g[0].via, null);
  assert.deepEqual(g[0].condomini.map((p) => p.id), ['p1']);
  assert.equal(g[0].conteggi.citofoni, 0);
});
