import test from 'node:test';
import assert from 'node:assert/strict';
import { candidati, applica } from '../js/aggiorna.js';
import { analizza } from '../js/parser/index.js';

const now = new Date('2026-11-27T11:00:00');
const G = '2026-11-27';
const leggi = (t, ctx) => analizza(t, { now, ctx, correzioni: [] }).items[0];
const c = (id, identificativo, civico, extra = {}) => ({
  id, giorno: G, identificativo, civico, esito: 'assente', note: '', testoOriginale: `${identificativo} assente`,
  creato: '2026-11-27T10:30:00.000Z', letto: { identificativo, esito: 'assente' }, ...extra,
});

test('stesso cognome e stesso civico: è lui (frase di Dani: «Civico 12 Bisotti appuntamento sabato alle 10»)', () => {
  const lista = [c('a', 'Bisotti', '12'), c('b', 'Rossi', '12')];
  const it = leggi('Civico 12 Bisotti appuntamento sabato alle 10', { via: 'Via Roma', civico: '14' });
  assert.deepEqual(candidati(lista, it, G).map((x) => x.id), ['a']);
});

test('stesso cognome a civici diversi: non si confondono', () => {
  const lista = [c('a', 'Bisotti', '12'), c('b', 'Bisotti', '20')];
  const it = leggi('Civico 20 Bisotti non interessato', { via: 'Via Roma' });
  assert.deepEqual(candidati(lista, it, G).map((x) => x.id), ['b']);
});

test('civico non detto: vale il civico in cui si trova', () => {
  const lista = [c('a', 'Bisotti', '12'), c('b', 'Bisotti', '20')];
  assert.deepEqual(candidati(lista, leggi('Bisotti non interessato', { via: 'Via Roma', civico: '12' }), G).map((x) => x.id), ['a']);
  assert.deepEqual(candidati(lista, leggi('Bisotti non interessato', { via: 'Via Roma', civico: '30' }), G), []);
});

test('nessun civico da nessuna parte: due Bisotti senza civico → due candidati (l\'app chiede)', () => {
  const lista = [c('a', 'Bisotti', null), c('b', 'Bisotti', null)];
  assert.equal(candidati(lista, leggi('Bisotti non interessato', { via: 'Via Roma' }), G).length, 2);
});

test('solo i contatti di oggi, cognome senza maiuscole/spazi in più', () => {
  const lista = [c('a', 'Boselli Terret', '3', { giorno: '2026-11-26' }), c('b', 'boselli  terret', '3')];
  assert.deepEqual(candidati(lista, leggi('Civico 3 Boselli terret non interessato', {}), G).map((x) => x.id), ['b']);
});

test('aggiornamento: nuovo esito, giorno e ora; la frase vecchia resta; nessun doppione', () => {
  const v = c('a', 'Bisotti', '12', { note: 'cane', concorrente: 'Dyson' });
  const it = leggi('Civico 12 Bisotti appuntamento sabato alle 10', { via: 'Via Roma' });
  const n = applica(v, it, now);
  assert.equal(n.id, 'a');
  assert.equal(n.esito, 'appuntamento');
  assert.equal(n.data, '2026-11-28');
  assert.equal(n.ora, '10:00');
  assert.equal(n.concorrente, 'Dyson');
  assert.equal(n.note, 'cane');
  assert.equal(n.testoOriginale, 'Civico 12 Bisotti appuntamento sabato alle 10');
  assert.deepEqual(n.testiPrecedenti.map((x) => x.testo), ['Bisotti assente']);
  assert.equal(n.confermato, false); // appuntamento: scheda di conferma come sempre
  assert.equal(v.esito, 'assente'); // il vecchio non viene toccato (serve per Annulla)
});

test('aggiornamento a non interessato: salvato senza scheda; il cognome letto la prima volta resta', () => {
  const v = c('a', 'Daghetti', '5', { letto: { identificativo: 'Da Getty', esito: 'assente' } });
  const n = applica(v, leggi('Civico 5 Daghetti non interessato', {}), now);
  assert.equal(n.esito, 'non_interessato');
  assert.equal(n.confermato, true);
  assert.equal(n.letto.identificativo, 'Da Getty');
  assert.equal(n.letto.esito, 'non_interessato');
});
