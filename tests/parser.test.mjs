// Test del parser sulle 20 frasi reali dettate da Dani (26/11/2026, ore 10:09, giovedì).
// Esegui con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { analizza } from '../js/parser/index.js';

const now = new Date(2026, 10, 26, 10, 9); // giovedì 26 novembre 2026, 10:09
const uno = (testo, ctx = {}, correzioni = []) => analizza(testo, { now, ctx, correzioni }).items[0];

test('assente e non interessato: salvati senza conferma', () => {
  const a = uno('Nicolini assente');
  assert.equal(a.identificativo, 'Nicolini');
  assert.equal(a.esito, 'assente');
  assert.equal(a.daConfermare, false);
  const b = uno('Colombi non interessato');
  assert.equal(b.esito, 'non_interessato');
  assert.equal(b.daConfermare, false);
});

test('Contardi: cognome spezzato, giovedì = settimana prossima, Dyson, note', () => {
  const c = uno('Con tardi appuntamento giovedì alle 17 moglie fissata con pulizie cliente Dyson hanno cane e figlio');
  assert.equal(c.esito, 'appuntamento');
  assert.equal(c.data, '2026-12-03');
  assert.equal(c.ora, '17:00');
  assert.equal(c.concorrente, 'Dyson');
  assert.equal(c.pretesto, null); // "fissata con pulizie" è una nota, non il pretesto
  assert.match(c.note, /moglie fissata con pulizie/);
  assert.ok(c.avvisi.some((a) => a.includes('spezzato')));
});

test('correzione imparata: "Con tardi" diventa "Contardi"', () => {
  const c = uno('Con tardi appuntamento giovedì alle 17', {}, [{ da: 'con tardi', a: 'Contardi' }]);
  assert.equal(c.identificativo, 'Contardi');
  assert.ok(!c.avvisi.some((a) => a.includes('spezzato')));
});

test('Galli: lunedì alle 11, sanificazione, VK220', () => {
  const c = uno('Galli appuntamento lunedì alle 11 per sanificazione vk220');
  assert.equal(c.data, '2026-11-30');
  assert.equal(c.ora, '11:00');
  assert.equal(c.pretesto, 'sanificazione');
  assert.equal(c.modello, 'VK220');
});

test('Follieri: oggi pomeriggio alle 14, "virgola" diventa punteggiatura', () => {
  const c = uno('Follieri appuntamento oggi pomeriggio alle 14 sanificazione VK 135 virgola voleva comunque sapere dei prezzi');
  assert.equal(c.data, '2026-11-26');
  assert.equal(c.ora, '14:00');
  assert.equal(c.modello, 'VK135');
  assert.doesNotMatch(c.note, /virgola/);
  assert.match(c.note, /sapere dei prezzi/);
});

test('Giovanardi: 23 dicembre, richiamo 7 giorni prima, telefono', () => {
  const c = uno('Giovanardi appuntamento dicembre 23 richiamare una settimana prima al numero 333 333 333 3');
  assert.equal(c.data, '2026-12-23');
  assert.equal(c.ora, null);
  assert.equal(c.telefono, '3333333333');
  assert.deepEqual(c.richiamo, { giorniPrima: 7, data: '2026-12-16' });
  assert.ok(c.avvisi.some((a) => a.includes("Manca l'ora")));
});

test('Fuochi: ripassare alle 18, giorno non detto = oggi con avviso', () => {
  const c = uno("Fuochi c'era solo il figlio ripassare alle 18");
  assert.equal(c.identificativo, 'Fuochi');
  assert.equal(c.esito, 'ripassare');
  assert.equal(c.data, '2026-11-26');
  assert.equal(c.ora, '18:00');
  assert.equal(c.note, "c'era solo il figlio");
  assert.ok(c.avvisi.some((a) => a.includes('Giorno non detto')));
});

test('Ricciardi: settimana prossima = da fissare, mai una data inventata', () => {
  const c = uno('Ricciardi ripassare settimana prossima non aveva tempo meglio verso sera ore 18');
  assert.equal(c.data, null);
  assert.equal(c.daFissare, true);
  assert.equal(c.ora, '18:00');
  assert.equal(c.oraTipo, 'verso');
});

test('Mitev: "passare" = ripassare, cognome si ferma a "marito"', () => {
  const c = uno("Mitev marito ha detto di passare domani alle 14 quello c'è anche la moglie");
  assert.equal(c.identificativo, 'Mitev');
  assert.equal(c.esito, 'ripassare');
  assert.equal(c.data, '2026-11-27');
  assert.equal(c.ora, '14:00');
});

test('posizioni: via, paese + via, civico con lettera', () => {
  assert.equal(uno('Adesso via Alfieri').via, 'Via Alfieri');
  const p = uno('Adesso Santo Stefano Lodigiano via Roma');
  assert.equal(p.tipo, 'posizione');
  assert.equal(p.comune, 'Santo Stefano Lodigiano');
  assert.equal(p.via, 'Via Roma');
  const q = uno("Adesso Castelnuovo Bocca d'Adda via Rocca Stanga 12 a");
  assert.equal(q.comune, "Castelnuovo Bocca d'Adda");
  assert.equal(q.via, 'Via Rocca Stanga');
  assert.equal(q.civico, '12A');
});

test('cambio via mantiene il paese; cambio paese azzera civico e condominio', () => {
  let r = analizza('Adesso Santo Stefano Lodigiano via Roma', { now });
  r = analizza('Civico 30 condominio 12 campanelli', { now, ctx: r.ctx });
  assert.deepEqual(r.ctx.condominio, { civico: '30', campanelli: 12 });
  r = analizza('Adesso via Alfieri', { now, ctx: r.ctx });
  assert.equal(r.ctx.comune, 'Santo Stefano Lodigiano');
  assert.equal(r.ctx.condominio, null);
});

test('condominio: posizione con numero di campanelli; i contatti successivi ci appartengono', () => {
  let r = analizza('Civico 30 condominio 12 campanelli', { now, ctx: { via: 'Via Roma' } });
  const p = r.items[0];
  assert.equal(p.sottotipo, 'condominio');
  assert.equal(p.campanelli, 12);
  r = analizza('Rossi non interessato', { now, ctx: r.ctx });
  assert.deepEqual(r.items[0].condominio, { civico: '30', campanelli: 12 });
  r = analizza('Civico 12 non interessato', { now, ctx: r.ctx });
  assert.equal(r.items[0].condominio, null, 'un altro civico chiude il condominio');
});

test('Giorgiani: "non interessato" vince su "passare"; la nota chiede conferma', () => {
  const c = uno('Giorgiani non interessato dice di passare però dai vicini');
  assert.equal(c.esito, 'non_interessato');
  assert.equal(c.note, 'dice di passare però dai vicini');
  assert.equal(c.daConfermare, true);
});

test('civico come identificativo', () => {
  const a = uno('Civico 12 non interessato');
  assert.equal(a.identificativo, 'Civico 12');
  assert.equal(a.daConfermare, false);
  const b = uno("Civico 8 ripassare quando c'è anche la moglie ovvero dopo le 19");
  assert.equal(b.esito, 'ripassare');
  assert.equal(b.ora, '19:00');
  assert.equal(b.oraTipo, 'dopo');
});

test('Civico 15: "martedì 4 dicembre" ma il 4 è venerdì → avviso', () => {
  const c = uno('Civico 15 appuntamento martedì 4 dicembre ore 15:30 per igiene VK 121');
  assert.equal(c.data, '2026-12-04');
  assert.equal(c.ora, '15:30');
  assert.equal(c.pretesto, 'igiene');
  assert.equal(c.modello, 'VK121');
  assert.ok(c.avvisi.some((a) => a.includes('venerdì')));
});

test('ore del pomeriggio dette come 1–7', () => {
  const c = uno('Bianchi appuntamento domani alle 3');
  assert.equal(c.ora, '15:00');
  const d = uno('Bianchi appuntamento domani mattina alle 7');
  assert.equal(d.ora, '07:00');
  const e = uno('Bianchi appuntamento domani alle 15 e 30');
  assert.equal(e.ora, '15:30');
});

test('orario già passato oggi → avviso', () => {
  const c = uno('Verdi appuntamento oggi alle 9');
  assert.ok(c.avvisi.some((a) => a.includes('già passato')));
});

test('esito non capito → da confermare', () => {
  const c = uno('Ferrari ha un cane');
  assert.equal(c.esito, null);
  assert.equal(c.daConfermare, true);
});

test('più frasi in una sola dettatura', () => {
  const r = analizza('Adesso via Roma Nicolini assente', { now });
  assert.equal(r.items.length, 1, 'senza separatore resta una posizione');
  const r2 = analizza('Nicolini assente. Adesso via Roma', { now });
  assert.equal(r2.items.length, 2);
  assert.equal(r2.items[0].esito, 'assente');
  assert.equal(r2.items[1].via, 'Via Roma');
});

test('pretesto e modello non si ripetono nelle note', () => {
  const c = uno('Follieri appuntamento oggi pomeriggio alle 14 sanificazione VK 135 virgola voleva comunque sapere dei prezzi');
  assert.equal(c.note, 'voleva comunque sapere dei prezzi');
  assert.equal(uno('Galli appuntamento lunedì alle 11 per sanificazione vk220').note, '');
});

test('il civico di un contatto non passa al contatto successivo', () => {
  let r = analizza('Civico 15 non interessato', { now, ctx: { via: 'Via Roma' } });
  r = analizza('Rossi assente', { now, ctx: r.ctx });
  assert.equal(r.items[0].civico, null);
});

test('civico seguito dal cognome (come detta Dani)', () => {
  const ctx = { comune: 'Carpaneto', via: 'Via Roma' };
  const a = uno('Civico 12 Rossi assente', ctx);
  assert.equal(a.identificativo, 'Rossi');
  assert.equal(a.civico, '12');
  assert.equal(a.esito, 'assente');
  assert.equal(a.note, '');
  assert.equal(a.daConfermare, false);
  const b = uno('civico 8 bianchi appuntamento domani alle 17', ctx);
  assert.equal(b.identificativo, 'Bianchi');
  assert.equal(b.civico, '8');
  assert.equal(b.ora, '17:00');
  const c = uno('Civico 15 Con tardi appuntamento lunedì alle 11', ctx);
  assert.equal(c.identificativo, 'Con Tardi');
  assert.equal(c.civico, '15');
  const d = uno("Civico 4 Mitev marito ha detto di passare domani alle 14", ctx);
  assert.equal(d.identificativo, 'Mitev');
  assert.match(d.note, /marito/);
});

test('numero senza la parola civico', () => {
  const a = uno('12 Rossi non interessato', { via: 'Via Roma' });
  assert.equal(a.identificativo, 'Rossi');
  assert.equal(a.civico, '12');
  assert.equal(uno('30 condominio 8 campanelli').campanelli, 8);
});

test('civico senza cognome resta "Civico N"', () => {
  assert.equal(uno('Civico 12 non interessato').identificativo, 'Civico 12');
  assert.equal(uno("Civico 8 ripassare dopo le 19").identificativo, 'Civico 8');
});

test('numeri scritti in lettere dalla tastiera (caso di Dani 27/11: "Civico tre condominio 12 Campanelli")', () => {
  const p = uno('Civico tre condominio 12 Campanelli');
  assert.equal(p.tipo, 'posizione');
  assert.equal(p.sottotipo, 'condominio');
  assert.equal(p.civico, '3');
  assert.equal(p.campanelli, 12);
  const q = uno('Civico ventotto condominio dodici campanelli');
  assert.equal(q.civico, '28');
  assert.equal(q.campanelli, 12);
  const r = uno('civico tre Rossi assente');
  assert.equal(r.identificativo, 'Rossi');
  assert.equal(r.civico, '3');
  const s = uno('Bianchi appuntamento domani alle sei e mezza');
  assert.equal(s.ora, '18:30');
  const d = uno('Verdi appuntamento il tre dicembre alle dieci');
  assert.equal(d.data, '2026-12-03');
  assert.equal(d.ora, '10:00');
});

test('le parole-numero fuori contesto non vengono toccate', () => {
  const c = uno('Giovanardi appuntamento dicembre 23 richiamare una settimana prima');
  assert.deepEqual(c.richiamo, { giorniPrima: 7, data: '2026-12-16' });
  const n = uno('Rossi non interessato sei già cliente');
  assert.match(n.note, /sei già cliente/);
});

test('"le due" in una nota resta in lettere', () => {
  const c = uno('Rossi non interessato hanno le due figlie');
  assert.match(c.note, /le due figlie/);
});

test('condominio detto in altri modi (caso di Dani 27/11: bloccato davanti al condominio)', () => {
  const ctx = { comune: 'Piacenza', via: 'Via Dino Laudi', civico: '3' };
  const casi = [
    ['Condominio 12 campanelli', '3', 12],
    ['condominio di 12 campanelli', '3', 12],
    ['12 campanelli', '3', 12],
    ['Condominio civico 3 da 12 campanelli', '3', 12],
    ['Civico 3 - condominio 12 campanelli', '3', 12],
    ['Civico 3, condominio 12 campanelli', '3', 12],
    ['Civico 3 è un condominio da 12 campanelli', '3', 12],
    ['condominio dodici campanelli', '3', 12],
    ['Civico 5 condominio con 8 appartamenti', '5', 8],
  ];
  for (const [frase, civico, campanelli] of casi) {
    const r = analizza(frase, { now, ctx });
    const p = r.items[r.items.length - 1];
    assert.equal(p.sottotipo, 'condominio', frase);
    assert.equal(p.civico, civico, frase);
    assert.equal(p.campanelli, campanelli, frase);
    assert.deepEqual(r.ctx.condominio, { civico, campanelli }, frase);
  }
});

test('"Civico 3. Condominio 12 campanelli" (punto messo dalla tastiera)', () => {
  const r = analizza('Civico 3. Condominio 12 campanelli', { now, ctx: { via: 'Via Roma' } });
  const ultimo = r.items[r.items.length - 1];
  assert.equal(ultimo.sottotipo, 'condominio');
  assert.equal(ultimo.civico, '3');
  assert.equal(ultimo.campanelli, 12);
});

test('condominio senza civico né civico corrente: avvisa', () => {
  const p = uno('Condominio 12 campanelli', { via: 'Via Roma' });
  assert.equal(p.sottotipo, 'condominio');
  assert.equal(p.campanelli, 12);
  assert.ok(p.avvisi.some((a) => a.includes('Manca il civico')));
});

test('con un esito resta un contatto, anche se si parla di condominio', () => {
  const c = uno('Rossi non interessato vive in un condominio da 12 campanelli', { via: 'Via Roma', civico: '3' });
  assert.equal(c.tipo, 'contatto');
  assert.equal(c.identificativo, 'Rossi');
  assert.equal(c.esito, 'non_interessato');
});
