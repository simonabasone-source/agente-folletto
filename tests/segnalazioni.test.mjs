import test from 'node:test';
import assert from 'node:assert/strict';
import { istantanea, differenze, messaggio, parti } from '../js/segnalazioni.js';

const letto = istantanea({ identificativo: 'Con Tardi', esito: 'appuntamento', data: '2026-12-03', ora: '17:00' });

test('nessuna differenza se Dani conferma senza cambiare', () => {
  assert.deepEqual(differenze(letto, { ...letto }), []);
});

test('rileva cognome, giorno e ora cambiati', () => {
  const finale = { identificativo: 'Contardi', esito: 'appuntamento', data: '2026-11-26', ora: '17:30', daFissare: false };
  assert.deepEqual(differenze(letto, finale), ['cognome', 'giorno', 'ora']);
});

test('da assente a un altro esito NON è un errore: Dani aggiorna dopo aver parlato col cliente (27/11)', () => {
  // frasi esatte del 27/11: «Sant'Angelo assente» → non interessato, «Bisotti assente» → appuntamento sab 28 nov 10:00
  const l = istantanea({ identificativo: "Sant'Angelo", esito: 'assente' });
  assert.deepEqual(differenze(l, { identificativo: "Sant'Angelo", esito: 'non_interessato' }), []);
  const b = istantanea({ identificativo: 'Bisotti', esito: 'assente' });
  assert.deepEqual(differenze(b, { identificativo: 'Bisotti', esito: 'appuntamento', data: '2026-11-28', ora: '10:00' }), []);
});

test('assente con cognome sbagliato: resta segnalato solo il cognome («Da Getty assente» → Daghetti)', () => {
  const l = istantanea({ identificativo: 'Da Getty', esito: 'assente' });
  assert.deepEqual(differenze(l, { identificativo: 'Daghetti', esito: 'assente' }), ['cognome']);
  assert.deepEqual(differenze(l, { identificativo: 'Daghetti', esito: 'non_interessato' }), ['cognome']);
});

test('esito capito male resta segnalato (es. non interessato → ripassare, esito non capito → assente)', () => {
  const l = istantanea({ identificativo: 'Rossi', esito: 'non_interessato' });
  assert.deepEqual(differenze(l, { identificativo: 'Rossi', esito: 'ripassare', daFissare: true }), ['esito']);
  const n = istantanea({ identificativo: 'Neri Baccianella Assent', esito: null });
  assert.deepEqual(differenze(n, { identificativo: 'Neri Baccianella', esito: 'assente' }), ['cognome', 'esito']);
});

test('il messaggio contiene frase originale, versione app e versione Dani', () => {
  const m = messaggio([{
    testoOriginale: 'Con tardi appuntamento giovedì alle 17', creato: '2026-11-26T10:09:00.000Z', letto,
    identificativo: 'Contardi', esito: 'appuntamento', data: '2026-12-03', ora: '17:00', daFissare: false,
  }]);
  assert.match(m, /«Con tardi appuntamento giovedì alle 17»/);
  assert.match(m, /App: {2}Con Tardi · appuntamento · gio 3 dic · 17:00/);
  assert.match(m, /Dani: Contardi/);
});

const finta = (i) => ({
  testoOriginale: `Cognome${i} assente`, creato: '2026-11-27T09:30:00.000Z', giorno: '2026-11-27',
  letto: { identificativo: `Cognome${i}`, esito: 'assente' }, identificativo: `Cognome${i}`, esito: 'non_interessato',
});

test('79 frasi (caso 27/11): divise in parti sotto il limite, nessuna persa', () => {
  const lista = Array.from({ length: 79 }, (_, i) => finta(i + 1));
  const pp = parti(lista);
  assert.ok(pp.length >= 2);
  assert.ok(pp.every((p) => p.testo.length <= 3000), pp.map((p) => p.testo.length).join());
  assert.deepEqual(pp.flatMap((p) => p.contatti), lista);
  assert.equal(pp[0].da, 1); assert.equal(pp.at(-1).a, 79);
  assert.match(pp[0].testo, /\(79\) · parte 1 di \d/);
  assert.match(pp.at(-1).testo, /79\) «Cognome79 assente»/);
});

test('poche frasi: una parte sola, uguale al messaggio di sempre', () => {
  const lista = [finta(1), finta(2)];
  const pp = parti(lista);
  assert.equal(pp.length, 1);
  assert.equal(pp[0].testo, messaggio(lista));
});
