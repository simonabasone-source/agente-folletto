import test from 'node:test';
import assert from 'node:assert/strict';
import { istantanea, differenze, messaggio } from '../js/segnalazioni.js';

const letto = istantanea({ identificativo: 'Con Tardi', esito: 'appuntamento', data: '2026-12-03', ora: '17:00' });

test('nessuna differenza se Dani conferma senza cambiare', () => {
  assert.deepEqual(differenze(letto, { ...letto }), []);
});

test('rileva cognome, giorno e ora cambiati', () => {
  const finale = { identificativo: 'Contardi', esito: 'appuntamento', data: '2026-11-26', ora: '17:30', daFissare: false };
  assert.deepEqual(differenze(letto, finale), ['cognome', 'giorno', 'ora']);
});

test('rileva esito cambiato (frase salvata da sola e poi corretta)', () => {
  const l = istantanea({ identificativo: 'Rossi', esito: 'assente' });
  assert.deepEqual(differenze(l, { identificativo: 'Rossi', esito: 'non_interessato' }), ['esito']);
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
