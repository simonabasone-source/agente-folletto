import test from 'node:test';
import assert from 'node:assert/strict';
import { statistiche } from '../js/stats.js';
import { vociAgenda, daFissare, sovrapposizioni } from '../js/agenda.js';

const G = '2026-11-26';

test('campanelli: case singole + condominio con assenti calcolati', () => {
  const posizioni = [{ id: 'p1', giorno: G, sottotipo: 'condominio', campanelli: 12 }];
  const contatti = [
    { id: 'a', giorno: G, esito: 'assente', confermato: true },
    { id: 'b', giorno: G, esito: 'non_interessato', confermato: true },
    { id: 'c', giorno: G, esito: 'appuntamento', confermato: true, condominioId: 'p1' },
    { id: 'd', giorno: G, esito: 'ripassare', confermato: false, condominioId: 'p1' },
    { id: 'e', giorno: '2026-11-25', esito: 'assente', confermato: true },
  ];
  const s = statistiche(posizioni, contatti, G);
  assert.equal(s.campanelli, 2 + 12);
  assert.equal(s.assenti, 1 + 10);
  assert.equal(s.parlati, 3);
  assert.equal(s.appuntamenti, 1);
  assert.equal(s.ripassi, 1);
  assert.equal(s.nonInteressati, 1);
  assert.equal(s.daConfermare, 1);
});

test('agenda: ordinata, con richiami, senza date vaghe', () => {
  const contatti = [
    { id: '1', esito: 'appuntamento', data: '2026-12-23', ora: null, richiamo: { data: '2026-12-16' } },
    { id: '2', esito: 'appuntamento', data: '2026-11-30', ora: '11:00' },
    { id: '3', esito: 'ripassare', data: null, daFissare: true },
    { id: '4', esito: 'assente' },
    { id: '5', esito: 'ripassare', data: '2026-11-20', ora: '10:00' },
  ];
  const v = vociAgenda(contatti, G);
  assert.deepEqual(v.map((x) => `${x.data} ${x.tipo}`), ['2026-11-30 appuntamento', '2026-12-16 richiamo', '2026-12-23 appuntamento']);
  assert.deepEqual(daFissare(contatti).map((c) => c.id), ['3']);
});

test('sovrapposizioni entro un\'ora', () => {
  const tutti = [
    { id: 'x', esito: 'appuntamento', data: '2026-12-04', ora: '15:00' },
    { id: 'y', esito: 'appuntamento', data: '2026-12-04', ora: '17:00' },
  ];
  const nuovo = { id: 'n', esito: 'appuntamento', data: '2026-12-04', ora: '15:30' };
  assert.deepEqual(sovrapposizioni(nuovo, tutti).map((c) => c.id), ['x']);
});

test('condominio eliminato: i suoi contatti contano come case singole', () => {
  const contatti = [
    { id: 'a', giorno: G, esito: 'non_interessato', confermato: true, condominioId: 'eliminato' },
    { id: 'b', giorno: G, esito: 'assente', confermato: true },
  ];
  const s = statistiche([], contatti, G);
  assert.equal(s.campanelli, 2);
  assert.equal(s.assenti, 1);
});

test('due condomini da 12 senza nessun cognome = 24 campanelli, 24 assenti', () => {
  const posizioni = [
    { id: 'p1', giorno: G, sottotipo: 'condominio', campanelli: 12 },
    { id: 'p2', giorno: G, sottotipo: 'condominio', campanelli: 12 },
  ];
  const s = statistiche(posizioni, [], G);
  assert.equal(s.campanelli, 24);
  assert.equal(s.assenti, 24);
});
