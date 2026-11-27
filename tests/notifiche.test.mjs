import test from 'node:test';
import assert from 'node:assert/strict';
import { confrontaVersioni, novitaDaMostrare, nonLette } from '../js/notifiche.js';

const N = [{ versione: '1.7.0', righe: ['c'] }, { versione: '1.6.0', righe: ['b'] }, { versione: '1.5.0', righe: ['a'] }];

test('confronto versioni', () => {
  assert.equal(confrontaVersioni('1.10.0', '1.9.2'), 1);
  assert.equal(confrontaVersioni('1.5.0', '1.5.0'), 0);
  assert.equal(confrontaVersioni('1.4.9', '1.5.0'), -1);
});

test('novità: solo le versioni nuove fino a quella installata', () => {
  assert.deepEqual(novitaDaMostrare('1.5.0', '1.7.0', N).map((n) => n.versione), ['1.7.0', '1.6.0']);
  assert.deepEqual(novitaDaMostrare('1.6.0', '1.6.0', N), []);
  assert.deepEqual(novitaDaMostrare(null, '1.6.0', N).map((n) => n.versione), ['1.6.0']);
});

test('conteggio non lette', () => {
  assert.equal(nonLette([{ letta: true }, { letta: false }, {}]), 2);
});
