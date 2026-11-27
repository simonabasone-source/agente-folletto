// Interfaccia dell'app. Usa: parser (capire le frasi), db (salvare), stats (numeri), agenda.
import { analizza } from './parser/index.js';
import { isoDate, isoTime, dataEstesa, dataBreve, addDays } from './parser/dates.js';
import * as db from './db.js';
import { statistiche } from './stats.js';
import { vociAgenda, daFissare, sovrapposizioni, raggruppaPerGiorno } from './agenda.js';
import { istantanea, differenze, messaggio } from './segnalazioni.js';
import { raggruppaPerVia, chiaveVia } from './raggruppa.js';
import { novitaDaMostrare, nonLette } from './notifiche.js';

const VERSIONE_APP = '1.6.0 (Step 1)';
const NUMERO_VERSIONE = VERSIONE_APP.split(' ')[0];

const stato = {
  vista: 'giro',
  ctx: { comune: null, via: null, civico: null, condominio: null },
  contatti: [],
  posizioni: [],
  correzioni: [],
  coda: [],
  dettaglioNumeri: false,
  tendine: {}, // chiave via -> aperta/chiusa scelta da Dani
  notifiche: [], // campanella: {id, tipo, titolo, righe, quando, letta}
  protetto: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oggi = () => isoDate(new Date());
const ETICHETTA = { appuntamento: 'Appuntamento', ripassare: 'Ripassare', non_interessato: 'Non interessato', assente: 'Assente', null: 'Da scegliere' };
const ETICHETTA_AGENDA = { appuntamento: 'Appuntamento', ripasso: 'Ripasso', richiamo: 'Richiamare' };
const prefissoOra = (t) => ({ dopo: 'dopo le ', verso: 'verso le ', prima: 'prima delle ' }[t] ?? '');

// ---------------------------------------------------------------- avvio
async function avvio() {
  stato.contatti = await db.tutti('contatti');
  stato.posizioni = await db.tutti('posizioni');
  stato.correzioni = await db.tutti('correzioni');
  stato.ctx = await db.leggiMeta('ctx', stato.ctx);
  stato.protetto = await db.proteggiArchivio();

  document.querySelectorAll('#nav button').forEach((b) => b.addEventListener('click', () => vai(b.dataset.vista)));
  stato.notifiche = await db.leggiMeta('notifiche', []);
  await registraNovita();
  collegaListe();
  render();
  ripristinaBozzaDettatura();

  if ('serviceWorker' in navigator) {
    const avevaVersione = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.update();
      // controlla gli aggiornamenti ogni 15 minuti e ogni volta che Dani riprende in mano il telefono
      setInterval(() => reg.update().catch(() => {}), 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
    // nuova versione installata: notifica nella campanella (mai ricarica automatica)
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (avevaVersione) segnalaAggiornamento(); });
  }
  window.__folletto = { segnalaAggiornamento }; // usato dalle prove automatiche
}

// ---------------------------------------------------------------- campanella
async function salvaNotifiche() {
  stato.notifiche = stato.notifiche.slice(0, 30);
  await db.scriviMeta('notifiche', stato.notifiche);
  disegnaCampanella();
}

async function registraNovita() {
  const vista = await db.leggiMeta('ultimaVersioneVista', null);
  const nuove = novitaDaMostrare(vista, NUMERO_VERSIONE);
  for (const n of nuove.reverse()) {
    stato.notifiche.unshift({ id: db.nuovoId(), tipo: 'novita', titolo: `Novità della versione ${n.versione}`, righe: n.righe, quando: new Date().toISOString(), letta: false });
  }
  // l'aggiornamento è avvenuto: la notifica "versione pronta" non serve più
  stato.notifiche = stato.notifiche.filter((n) => n.tipo !== 'aggiornamento');
  await db.scriviMeta('ultimaVersioneVista', NUMERO_VERSIONE);
  await db.scriviMeta('notifiche', stato.notifiche);
}

async function segnalaAggiornamento() {
  if (stato.notifiche.some((n) => n.tipo === 'aggiornamento')) return;
  stato.notifiche.unshift({ id: db.nuovoId(), tipo: 'aggiornamento', titolo: 'Nuova versione pronta', righe: ['Tocca Aggiorna quando sei tra un citofono e l\'altro.'], quando: new Date().toISOString(), letta: false });
  await salvaNotifiche();
}

function disegnaCampanella() {
  const b = $('#campanella');
  if (!b) return;
  const n = nonLette(stato.notifiche);
  const pronta = stato.notifiche.some((x) => x.tipo === 'aggiornamento');
  b.classList.toggle('pronta', pronta);
  b.innerHTML = `<span aria-hidden="true">🔔</span>${n ? `<span class="pallino">${n}</span>` : ''}`;
  b.setAttribute('aria-label', n ? `Notifiche: ${n} nuove` : 'Notifiche');
}

function apriNotifiche() {
  const p = $('#pannello-notifiche');
  const lista = stato.notifiche;
  p.innerHTML = `
    <div class="contenuto">
      <div class="testata"><b>Notifiche</b><button type="button" class="secondario" id="n-chiudi">Chiudi</button></div>
      ${lista.length ? lista.map((n) => `
        <div class="notifica ${n.letta ? '' : 'nuova'} n-${n.tipo}">
          <div class="titolo">${esc(n.titolo)}</div>
          ${n.righe.map((r) => `<p>${esc(r)}</p>`).join('')}
          <div class="n-ora">${esc(dataBreve(isoDate(new Date(n.quando))))} ${esc(isoTime(new Date(n.quando)))}</div>
          ${n.tipo === 'aggiornamento' ? '<button type="button" class="conferma" id="n-aggiorna">Aggiorna</button>' : ''}
        </div>`).join('') : '<p class="vuoto">Nessuna notifica.</p>'}
    </div>`;
  p.hidden = false;
  $('#n-chiudi').addEventListener('click', chiudiNotifiche);
  $('#n-aggiorna')?.addEventListener('click', aggiornaOra);
  stato.notifiche = stato.notifiche.map((n) => ({ ...n, letta: true }));
  salvaNotifiche();
}

function chiudiNotifiche() {
  $('#pannello-notifiche').hidden = true;
  $('#pannello-notifiche').innerHTML = '';
}

// Ricarica conservando quello che Dani stava dettando.
function aggiornaOra() {
  const testo = $('#testo')?.value ?? '';
  try { if (testo.trim()) sessionStorage.setItem('bozzaDettatura', testo); } catch { /* niente */ }
  location.reload();
}

function ripristinaBozzaDettatura() {
  try {
    const t = sessionStorage.getItem('bozzaDettatura');
    if (t && $('#testo')) { $('#testo').value = t; sessionStorage.removeItem('bozzaDettatura'); }
  } catch { /* niente */ }
}

function vai(vista) {
  stato.vista = vista;
  $('#toast').hidden = true;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('attivo', b.dataset.vista === vista));
  render();
  window.scrollTo(0, 0);
}

function render() {
  const app = $('#app');
  if (stato.vista === 'giro') { app.innerHTML = htmlGiro(); collegaGiro(); aggiornaGiro(); }
  if (stato.vista === 'agenda') { app.innerHTML = htmlAgenda(); }
  if (stato.vista === 'menu') { app.innerHTML = htmlMenu(); collegaMenu(); }
}

// ---------------------------------------------------------------- giro
function testoPosizione() {
  const { comune, via, civico, condominio } = stato.ctx;
  if (!comune && !via && !condominio && !civico) return 'Tocca per impostare paese e via';
  let t = [via, comune].filter(Boolean).join(' · ') || 'Via non detta';
  if (condominio) t += ` · condominio civico ${condominio.civico} (${condominio.campanelli ?? '?'} campanelli)`;
  else if (civico) t += ` · civico ${civico}`;
  return t;
}

function htmlGiro() {
  return `
    <div class="testata-giro">
      <button class="posizione" id="btn-pos"><small>Sei in</small><strong id="pos"></strong></button>
      <button class="campanella" id="campanella" type="button" aria-label="Notifiche"></button>
    </div>
    <div class="contatori" id="contatori"></div>
    <div id="dettaglio-num"></div>
    <div class="dettatura">
      <textarea id="testo" rows="3" placeholder="Tocca qui, poi il microfono della tastiera e detta…" autocapitalize="sentences" enterkeyhint="send"></textarea>
      <div class="riga">
        <button class="svuota" id="svuota" type="button">Svuota</button>
        <button class="invia" id="invia" type="button">Invia</button>
      </div>
      <p class="aiuto">«Civico 12 Rossi assente» · «Adesso via Roma» · «Civico 30 condominio 12 campanelli»</p>
    </div>
    <h2>Oggi</h2>
    <div id="lista-oggi"></div>`;
}

function collegaGiro() {
  $('#invia').addEventListener('click', invia);
  $('#svuota').addEventListener('click', () => { $('#testo').value = ''; $('#testo').focus(); });
  $('#testo').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(); } });
  $('#btn-pos').addEventListener('click', modificaPosizione);
  $('#campanella').addEventListener('click', apriNotifiche);
  disegnaCampanella();
  $('#contatori').addEventListener('click', () => { stato.dettaglioNumeri = !stato.dettaglioNumeri; aggiornaGiro(); });
}

function aggiornaGiro() {
  if (stato.vista !== 'giro') return;
  $('#pos').textContent = testoPosizione();
  const s = statistiche(stato.posizioni, stato.contatti, oggi());
  $('#contatori').innerHTML = `
    <button><b>${s.campanelli}</b><span>Campanelli</span></button>
    <button><b>${s.appuntamenti}</b><span>Appuntam.</span></button>
    <button><b>${s.ripassi}</b><span>Ripassi</span></button>
    <button><b>${s.nonInteressati}</b><span>Non int.</span></button>`;
  $('#dettaglio-num').innerHTML = stato.dettaglioNumeri
    ? `<div class="dettaglio-num">Parlato con <b>${s.parlati}</b> · Assenti <b>${s.assenti}</b>${s.daConfermare ? ` · <span style="color:var(--rosso)">Da confermare <b>${s.daConfermare}</b></span>` : ''}</div>`
    : '';
  const condominiOggi = stato.posizioni.filter((p) => p.giorno === oggi() && p.sottotipo === 'condominio');
  const gruppi = raggruppaPerVia(stato.contatti.filter((c) => c.giorno === oggi()), condominiOggi);
  const qui = chiaveVia(stato.ctx.comune, stato.ctx.via);
  $('#lista-oggi').innerHTML = gruppi.length
    ? gruppi.map((g) => {
      const aperta = stato.tendine[g.chiave] ?? (g.chiave === qui);
      const n = g.conteggi;
      const conti = [`${n.citofoni} citofoni`, g.condomini.length && `${g.condomini.length} condomini`, n.appuntamenti && `${n.appuntamenti} app.`, n.ripassi && `${n.ripassi} rip.`].filter(Boolean).join(' · ');
      return `<details class="via" data-chiave="${esc(g.chiave)}" ${aperta ? 'open' : ''}>
        <summary>
          <span class="via-nome">${esc(g.via || 'Via non detta')}${n.daConfermare ? ' <span class="badge b-null">' + n.daConfermare + '</span>' : ''}</span>
          <span class="via-sotto">${esc([g.comune, conti].filter(Boolean).join(' · '))}</span>
        </summary>
        <ul class="lista">${g.condomini.map((p) => rigaCondominio(p)).join('')}${g.contatti.map((c) => rigaContatto(c, c.civico ?? '–', { senzaIndirizzo: true })).join('')}</ul>
      </details>`;
    }).join('')
    : '<p class="vuoto">Ancora nessun citofono oggi.</p>';
}

function rigaCondominio(p) {
  const dentro = stato.contatti.filter((c) => c.condominioId === p.id).length;
  const tot = Math.max(p.campanelli ?? 0, dentro);
  return `<li class="condominio"><button data-condo="${p.id}">
      <span class="ora">${esc(p.civico ?? '–')}</span>
      <span><span class="nome">Condominio · ${tot} campanelli</span></span>
      <span class="sotto">${dentro} con esito · ${tot - dentro} assenti — tocca per correggere o eliminare</span>
    </button></li>`;
}

function indirizzo(c) {
  const civ = c.identificativo?.startsWith('Civico') ? '' : (c.civico ? ` ${c.civico}` : '');
  return [c.via ? c.via + civ : null, c.comune].filter(Boolean).join(', ');
}

function rigaContatto(c, sinistra, { senzaIndirizzo = false } = {}) {
  const quando = (c.esito === 'appuntamento' || c.esito === 'ripassare')
    ? (c.daFissare || !c.data ? 'da fissare' : `${dataBreve(c.data)}${c.ora ? ' ' + prefissoOra(c.oraTipo) + c.ora : ''}`)
    : '';
  const sotto = [quando, senzaIndirizzo ? null : indirizzo(c), c.note].filter(Boolean).join(' · ');
  return `<li class="e-${c.esito}${c.confermato ? '' : ' da-confermare'}"><button data-id="${c.id}">
      <span class="ora">${esc(sinistra)}</span>
      <span><span class="nome">${esc(c.identificativo || '?')}</span> <span class="badge b-${c.esito}">${ETICHETTA[c.esito]}</span>${c.confermato ? '' : ' <span class="badge b-null">da confermare</span>'}</span>
      <span class="sotto">${esc(sotto)}</span>
    </button></li>`;
}

// Un solo ascoltatore per tutte le liste: funziona anche sulle righe aggiunte dopo.
function collegaListe() {
  $('#app').addEventListener('click', (e) => {
    // ricorda quali tendine Dani ha aperto o chiuso con un tocco
    const sum = e.target.closest('details.via > summary');
    if (sum) { const d = sum.parentElement; stato.tendine[d.dataset.chiave] = !d.open; return; }
    const bc = e.target.closest('.lista button[data-condo]');
    if (bc) { modificaCondominio(bc.dataset.condo); return; }
    const b = e.target.closest('.lista button[data-id]');
    if (!b) return;
    const c = stato.contatti.find((x) => x.id === b.dataset.id);
    if (c) apriScheda(c);
  });
}

async function invia() {
  const ta = $('#testo');
  const testo = ta.value.trim();
  if (!testo) { ta.focus(); return; }
  const now = new Date();
  const r = analizza(testo, { now, ctx: stato.ctx, correzioni: stato.correzioni });
  const salvati = [];
  const messaggi = [];
  let nuovoCondo = null;

  for (const it of r.items) {
    if (it.tipo === 'posizione') {
      const rec = {
        id: db.nuovoId(), creato: now.toISOString(), giorno: isoDate(now), sottotipo: it.sottotipo,
        comune: it.comune, via: it.via, civico: it.civico ?? null, campanelli: it.campanelli ?? null, testoOriginale: it.testoOriginale,
      };
      await db.metti('posizioni', rec);
      stato.posizioni.push(rec);
      salvati.push({ store: 'posizioni', id: rec.id });
      if (it.sottotipo === 'condominio') nuovoCondo = { id: rec.id, civico: rec.civico, campanelli: rec.campanelli };
      messaggi.push(it.avvisi?.length ? it.avvisi[0] : `Ora sei in: ${[it.via, it.comune].filter(Boolean).join(', ')}${it.sottotipo === 'condominio' ? ` · condominio ${it.civico}` : it.civico ? ` ${it.civico}` : ''}`);
      continue;
    }
    let condominioId = it.condominio?.id ?? null;
    if (!condominioId && it.condominio && nuovoCondo && it.condominio.civico === nuovoCondo.civico) condominioId = nuovoCondo.id;
    const rec = {
      id: db.nuovoId(), creato: now.toISOString(), giorno: isoDate(now),
      comune: it.comune, via: it.via, civico: it.civico, condominioId,
      identificativo: it.identificativo, identificativoLetto: it.identificativo,
      esito: it.esito, data: it.data, ora: it.ora, oraTipo: it.oraTipo, daFissare: it.daFissare,
      pretesto: it.pretesto, modello: it.modello, concorrente: it.concorrente, telefono: it.telefono, richiamo: it.richiamo,
      note: it.note, avvisi: it.avvisi, testoOriginale: it.testoOriginale,
      confermato: !it.daConfermare,
    };
    rec.letto = istantanea(rec);
    await db.metti('contatti', rec);
    stato.contatti.push(rec);
    salvati.push({ store: 'contatti', id: rec.id });
    if (rec.confermato) messaggi.push(`Salvato: ${rec.identificativo} — ${ETICHETTA[rec.esito].toLowerCase()}`);
    else stato.coda.push(rec.id);
  }

  if (chiaveVia(r.ctx.comune, r.ctx.via) !== chiaveVia(stato.ctx.comune, stato.ctx.via)) delete stato.tendine[chiaveVia(r.ctx.comune, r.ctx.via)];
  stato.ctx = { ...r.ctx };
  if (stato.ctx.condominio && !stato.ctx.condominio.id && nuovoCondo && stato.ctx.condominio.civico === nuovoCondo.civico) {
    stato.ctx.condominio = nuovoCondo;
  }
  await db.scriviMeta('ctx', stato.ctx);

  ta.value = '';
  aggiornaGiro();

  if (stato.coda.length) {
    apriScheda(stato.contatti.find((c) => c.id === stato.coda[0]));
  } else {
    ta.focus();
  }
  if (messaggi.length) {
    toast(messaggi.join(' · '), async () => {
      for (const s of salvati) {
        await db.togli(s.store, s.id);
        if (s.store === 'contatti') stato.contatti = stato.contatti.filter((c) => c.id !== s.id);
        else stato.posizioni = stato.posizioni.filter((p) => p.id !== s.id);
      }
      stato.coda = stato.coda.filter((id) => !salvati.some((s) => s.id === id));
      aggiornaGiro();
    });
  }
}

// ---------------------------------------------------------------- scheda di conferma
let bozza = null;
let toccatoData = false;
let toccatoNome = false;
let eliminaArmato = false;

function apriScheda(c) {
  bozza = structuredClone(c);
  toccatoData = false;
  toccatoNome = false;
  eliminaArmato = false;
  $('#scheda').hidden = false;
  disegnaScheda();
  $('#scheda').scrollTo(0, 0);
}

function chiudiScheda() {
  $('#scheda').hidden = true;
  $('#scheda').innerHTML = '';
  bozza = null;
}

function avvisiCorrenti() {
  const base = (bozza.confermato ? [] : bozza.avvisi ?? []).filter((a) => {
    if (/cognome/i.test(a)) return !toccatoNome;
    if (/Esito non capito/.test(a)) return !bozza.esito;
    return !toccatoData;
  });
  const extra = [];
  const conData = bozza.esito === 'appuntamento' || bozza.esito === 'ripassare';
  if (conData && toccatoData) {
    if (bozza.data && !bozza.daFissare && !bozza.ora && bozza.esito === 'appuntamento') extra.push("Manca l'ora.");
    if (bozza.data && bozza.ora && !bozza.daFissare && `${bozza.data}T${bozza.ora}` < `${oggi()}T${isoTime(new Date())}`) extra.push('Questo orario è già passato.');
  }
  for (const s of sovrapposizioni(bozza, stato.contatti)) {
    extra.push(`Hai già ${s.identificativo} alle ${s.ora} (${ETICHETTA[s.esito].toLowerCase()}).`);
  }
  return [...base, ...extra];
}

function htmlQuando() {
  const conData = bozza.esito === 'appuntamento' || bozza.esito === 'ripassare';
  if (!conData) return '';
  if (bozza.daFissare || !bozza.data) {
    return `<div class="quando fissare"><div class="giorno">Da fissare</div>${bozza.ora ? `<div>${prefissoOra(bozza.oraTipo)}${bozza.ora}</div>` : ''}</div>`;
  }
  return `<div class="quando"><div class="giorno">${esc(dataEstesa(bozza.data))}</div>
    <div class="orario">${bozza.ora ? esc(prefissoOra(bozza.oraTipo) + bozza.ora) : '— : —'}</div></div>`;
}

function disegnaScheda() {
  const conData = bozza.esito === 'appuntamento' || bozza.esito === 'ripassare';
  const avvisi = avvisiCorrenti();
  const dett = [
    bozza.pretesto && `<span>${esc(bozza.pretesto)}</span>`,
    bozza.modello && `<span>Ha ${esc(bozza.modello)}</span>`,
    bozza.concorrente && `<span>Ha ${esc(bozza.concorrente)}</span>`,
    bozza.richiamo?.data && `<span>Richiamare ${esc(dataBreve(bozza.richiamo.data))}</span>`,
  ].filter(Boolean).join('');
  const rimasti = stato.coda.filter((id) => id !== bozza.id).length;

  $('#scheda').innerHTML = `
    <div class="contenuto">
      ${rimasti ? `<p class="coda">Ancora ${rimasti} da confermare dopo questo</p>` : ''}
      <label class="campo"><span>Cognome o civico</span><input id="s-nome" value="${esc(bozza.identificativo)}" autocomplete="off"></label>
      <div class="esiti">
        ${['appuntamento', 'ripassare', 'non_interessato', 'assente'].map((e) => `<button type="button" data-esito="${e}" class="${bozza.esito === e ? 'scelto' : ''}">${ETICHETTA[e]}</button>`).join('')}
      </div>
      <div id="s-quando">${htmlQuando()}</div>
      <ul class="avvisi" id="s-avvisi">${avvisi.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      ${conData ? `
        <div class="data-ora">
          <label class="campo"><span>Giorno</span><input type="date" id="s-data" value="${esc(bozza.data ?? '')}"></label>
          <label class="campo"><span>Ora</span><input type="time" id="s-ora" value="${esc(bozza.ora ?? '')}"></label>
        </div>
        <label class="spunta"><input type="checkbox" id="s-fissare" ${bozza.daFissare ? 'checked' : ''}> Da fissare (giorno non deciso)</label>` : ''}
      ${dett ? `<div class="dettagli">${dett}</div>` : ''}
      <label class="campo"><span>Telefono</span><input type="tel" id="s-tel" value="${esc(bozza.telefono ?? '')}" inputmode="tel"></label>
      ${bozza.telefono ? `<div class="dettagli"><a href="tel:${esc(bozza.telefono)}">Chiama ${esc(bozza.telefono)}</a></div>` : ''}
      <label class="campo"><span>Note</span><textarea id="s-note">${esc(bozza.note)}</textarea></label>
      <div class="campo"><span>Hai detto</span><div class="originale">${esc(bozza.testoOriginale)}</div></div>
      <p class="nota">${esc(indirizzo(bozza))} · dettato ${esc(dataBreve(isoDate(new Date(bozza.creato))))} alle ${esc(isoTime(new Date(bozza.creato)))}</p>
    </div>
    <div class="azioni"><div class="dentro">
      <button type="button" class="elimina" id="s-elimina">${eliminaArmato ? 'Sicuro?' : 'Elimina'}</button>
      <button type="button" class="secondario" id="s-dopo">Dopo</button>
      <button type="button" class="conferma" id="s-conferma">Conferma</button>
    </div></div>`;

  $('#s-nome').addEventListener('input', (e) => { bozza.identificativo = e.target.value; if (!toccatoNome) { toccatoNome = true; aggiornaAvvisi(); } });
  document.querySelectorAll('#scheda .esiti button').forEach((b) => b.addEventListener('click', () => {
    bozza.esito = b.dataset.esito;
    toccatoData = true;
    if ((bozza.esito === 'appuntamento' || bozza.esito === 'ripassare') && !bozza.data) bozza.daFissare = true;
    salvaCampiTesto();
    disegnaScheda();
  }));
  $('#s-data')?.addEventListener('change', (e) => { bozza.data = e.target.value || null; bozza.daFissare = !bozza.data; toccatoData = true; aggiornaQuando(); });
  $('#s-ora')?.addEventListener('change', (e) => { bozza.ora = e.target.value || null; bozza.oraTipo = 'esatta'; toccatoData = true; aggiornaQuando(); });
  $('#s-fissare')?.addEventListener('change', (e) => { bozza.daFissare = e.target.checked; toccatoData = true; aggiornaQuando(); });
  $('#s-conferma').addEventListener('click', conferma);
  $('#s-dopo').addEventListener('click', () => { salvaCampiTesto(); salvaBozza(false).then(prossimo); });
  $('#s-elimina').addEventListener('click', elimina);
}

function salvaCampiTesto() {
  bozza.note = $('#s-note')?.value.trim() ?? bozza.note;
  bozza.telefono = ($('#s-tel')?.value ?? bozza.telefono ?? '').replace(/[^\d+]/g, '') || null;
  bozza.identificativo = $('#s-nome')?.value.trim() ?? bozza.identificativo;
}

function aggiornaQuando() {
  $('#s-quando').innerHTML = htmlQuando();
  const f = $('#s-fissare'); if (f) f.checked = !!bozza.daFissare;
  aggiornaAvvisi();
}

function aggiornaAvvisi() {
  $('#s-avvisi').innerHTML = avvisiCorrenti().map((a) => `<li>${esc(a)}</li>`).join('');
}

async function salvaBozza(confermato) {
  const conData = bozza.esito === 'appuntamento' || bozza.esito === 'ripassare';
  if (!conData) { bozza.data = null; bozza.ora = null; bozza.daFissare = false; bozza.richiamo = null; }
  if (bozza.richiamo?.giorniPrima && bozza.data && !bozza.daFissare) bozza.richiamo.data = addDays(bozza.data, -bozza.richiamo.giorniPrima);
  if (confermato) { bozza.confermato = true; bozza.avvisi = []; }
  const diff = differenze(bozza.letto, bozza);
  if (diff.length) bozza.segnalazione = { campi: diff, inviata: false };
  else if (bozza.segnalazione && !bozza.segnalazione.inviata) delete bozza.segnalazione;
  await db.metti('contatti', bozza);
  stato.contatti = stato.contatti.map((c) => (c.id === bozza.id ? bozza : c));
}

async function conferma() {
  salvaCampiTesto();
  // impara la correzione del cognome ("Con tardi" -> "Contardi")
  const letto = (bozza.identificativoLetto ?? '').trim();
  const nuovo = bozza.identificativo.trim();
  if (letto && nuovo && letto.toLowerCase() !== nuovo.toLowerCase() && !/^(civico|interno|scala|piano)\b/i.test(letto)) {
    const corr = { da: letto.toLowerCase(), a: nuovo };
    await db.metti('correzioni', corr);
    stato.correzioni = [...stato.correzioni.filter((c) => c.da !== corr.da), corr];
    bozza.identificativoLetto = nuovo;
  }
  await salvaBozza(true);
  prossimo();
}

async function elimina() {
  if (!eliminaArmato) { eliminaArmato = true; $('#s-elimina').textContent = 'Sicuro?'; return; }
  await db.togli('contatti', bozza.id);
  stato.contatti = stato.contatti.filter((c) => c.id !== bozza.id);
  prossimo();
}

function prossimo() {
  const fatto = bozza?.id;
  stato.coda = stato.coda.filter((id) => id !== fatto);
  const next = stato.coda.map((id) => stato.contatti.find((c) => c.id === id)).find(Boolean);
  if (next) { apriScheda(next); return; }
  chiudiScheda();
  render();
  if (stato.vista === 'giro') $('#testo')?.focus();
}

// ---------------------------------------------------------------- agenda
function htmlAgenda() {
  const g = oggi();
  const voci = vociAgenda(stato.contatti, g);
  const gruppi = raggruppaPerGiorno(voci);
  const sospesi = stato.contatti.filter((c) => !c.confermato).sort((a, b) => a.creato.localeCompare(b.creato));
  const fissare = daFissare(stato.contatti);

  const riga = (v) => {
    const c = v.contatto;
    const ora = v.tipo === 'richiamo' ? '☎' : (c.ora ? (c.oraTipo && c.oraTipo !== 'esatta' ? `${c.oraTipo === 'dopo' ? '>' : '~'}${c.ora}` : c.ora) : '—');
    const sotto = [
      v.tipo === 'richiamo' ? `appuntamento ${dataBreve(c.data)}${c.ora ? ' ' + c.ora : ''}` : null,
      indirizzo(c), c.telefono, c.pretesto, c.modello, c.note,
    ].filter(Boolean).join(' · ');
    return `<li class="e-${c.esito}${c.confermato ? '' : ' da-confermare'}"><button data-id="${c.id}">
      <span class="ora">${esc(ora)}</span>
      <span><span class="nome">${esc(c.identificativo)}</span> <span class="badge b-${v.tipo}">${ETICHETTA_AGENDA[v.tipo]}</span></span>
      <span class="sotto">${esc(sotto)}</span></button></li>`;
  };

  let h = '';
  if (sospesi.length) h += `<h2 style="color:var(--rosso)">Da confermare</h2><ul class="lista">${sospesi.map((c) => rigaContatto(c, isoTime(new Date(c.creato)))).join('')}</ul>`;
  h += '<h2>Prossimi giorni</h2>';
  if (!gruppi.length) h += '<p class="vuoto">Nessun appuntamento in agenda.</p>';
  for (const [data, vv] of gruppi) {
    const etichetta = data === g ? `Oggi · ${dataEstesa(data)}` : data === addDays(g, 1) ? `Domani · ${dataEstesa(data)}` : dataEstesa(data);
    h += `<div class="giorno-titolo ${data === g ? 'oggi' : ''}">${esc(etichetta)}</div><ul class="lista">${vv.map(riga).join('')}</ul>`;
  }
  if (fissare.length) {
    h += `<h2>Da fissare</h2><ul class="lista">${fissare.map((c) => riga({ tipo: c.esito === 'appuntamento' ? 'appuntamento' : 'ripasso', contatto: c })).join('')}</ul>`;
  }
  return h;
}

// ---------------------------------------------------------------- menu
function htmlMenu() {
  const corr = [...stato.correzioni].sort((a, b) => a.a.localeCompare(b.a));
  const segn = daSegnalare();
  return `
    <h2>Frasi capite male</h2>
    <button class="menu-voce" id="m-segnala" ${segn.length ? 'style="border:2px solid var(--rosso);font-weight:700"' : ''}>Frasi da mandare a Simona (${segn.length})</button>
    <p class="nota">Ogni volta che correggi qualcosa che l'app aveva capito male, finisce qui. Tocca per mandarle su WhatsApp.</p>
    <div id="m-segnala-dopo"></div>
    <h2>Posizione</h2>
    <button class="menu-voce" id="m-pos">Cambia paese / via / civico a mano</button>
    <h2>Backup</h2>
    <button class="menu-voce" id="m-esporta">Esporta backup (file)</button>
    <button class="menu-voce" id="m-importa">Importa backup</button>
    <input type="file" id="m-file" accept="application/json,.json" hidden>
    <p class="nota">I dati sono solo su questo telefono. Fai un backup una volta a settimana e salvalo sul tuo Google Drive. Non mandarlo in chat: contiene i dati dei clienti.</p>
    <h2>Cognomi corretti (${corr.length})</h2>
    ${corr.length ? `<ul class="lista">${corr.map((c) => `<li><button data-corr="${esc(c.da)}"><span class="ora">✕</span><span><span class="nome">${esc(c.a)}</span></span><span class="sotto">quando la tastiera scrive «${esc(c.da)}»</span></button></li>`).join('')}</ul><p class="nota">Tocca una correzione per eliminarla.</p>` : '<p class="vuoto">Nessuna. Quando correggi un cognome nella scheda, l\'app lo ricorda qui.</p>'}
    <h2>Info</h2>
    <p class="nota">Versione ${VERSIONE_APP} · ${stato.contatti.length} contatti salvati · Archivio protetto: ${stato.protetto ? 'sì' : 'no (fai backup spesso)'}</p>`;
}

function daSegnalare() {
  return stato.contatti
    .filter((c) => c.segnalazione && !c.segnalazione.inviata)
    .sort((a, b) => a.creato.localeCompare(b.creato));
}

async function segnaInviate(lista) {
  for (const c of lista) {
    c.segnalazione.inviata = true;
    await db.metti('contatti', c);
  }
  toast(`${lista.length} frasi segnate come inviate. Grazie!`);
  render();
}

async function inviaSegnalazioni() {
  const lista = daSegnalare();
  if (!lista.length) { toast('Nessuna frase da mandare: per ora l\'app non ha sbagliato.'); return; }
  const testo = messaggio(lista);
  if (navigator.share) {
    try { await navigator.share({ text: testo }); await segnaInviate(lista); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  // senza condivisione: apre WhatsApp e lascia il tasto per svuotare l'elenco
  window.open(`https://wa.me/?text=${encodeURIComponent(testo)}`, '_blank');
  $('#m-segnala-dopo').innerHTML = '<button class="menu-voce" id="m-svuota">Le ho mandate: svuota l\'elenco</button>';
  $('#m-svuota').addEventListener('click', () => segnaInviate(lista));
}

function collegaMenu() {
  $('#m-segnala').addEventListener('click', inviaSegnalazioni);
  $('#m-pos').addEventListener('click', modificaPosizione);
  $('#m-esporta').addEventListener('click', async () => {
    const dati = await db.esporta();
    const blob = new Blob([JSON.stringify(dati, null, 1)], { type: 'application/json' });
    const nome = `folletto-backup-${oggi()}.json`;
    const file = new File([blob], nome, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nome }); return; } catch { /* annullato: scarica */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $('#m-importa').addEventListener('click', () => $('#m-file').click());
  $('#m-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await db.importa(JSON.parse(await f.text()));
      stato.contatti = await db.tutti('contatti');
      stato.posizioni = await db.tutti('posizioni');
      stato.correzioni = await db.tutti('correzioni');
      toast('Backup importato.');
      render();
    } catch (err) { toast(err.message || 'File non valido.'); }
  });
  document.querySelectorAll('[data-corr]').forEach((b) => b.addEventListener('click', async () => {
    await db.togli('correzioni', b.dataset.corr);
    stato.correzioni = stato.correzioni.filter((c) => c.da !== b.dataset.corr);
    render();
  }));
}

// ---------------------------------------------------------------- posizione a mano
function modificaPosizione() {
  const d = document.createElement('dialog');
  const c = stato.ctx;
  d.innerHTML = `
    <form method="dialog">
      <label class="campo"><span>Paese</span><input name="comune" value="${esc(c.comune ?? '')}"></label>
      <label class="campo"><span>Via</span><input name="via" value="${esc(c.via ?? '')}"></label>
      <label class="campo"><span>Civico</span><input name="civico" value="${esc(c.condominio?.civico ?? c.civico ?? '')}"></label>
      <label class="campo"><span>Campanelli del condominio (vuoto se casa singola)</span><input name="campanelli" inputmode="numeric" value="${esc(c.condominio?.campanelli ?? '')}"></label>
      <div class="riga" style="display:flex;gap:8px">
        <button value="annulla" class="secondario" style="flex:1">Annulla</button>
        <button value="ok" class="conferma" style="flex:2">Salva</button>
      </div>
    </form>`;
  document.body.appendChild(d);
  d.addEventListener('close', async () => {
    if (d.returnValue === 'ok') {
      const f = new FormData(d.querySelector('form'));
      const val = (k) => String(f.get(k) ?? '').trim() || null;
      const campanelli = val('campanelli') ? Number(val('campanelli')) : null;
      const now = new Date();
      const rec = {
        id: db.nuovoId(), creato: now.toISOString(), giorno: isoDate(now),
        sottotipo: campanelli ? 'condominio' : 'via', comune: val('comune'), via: val('via'), civico: val('civico')?.toUpperCase() ?? null,
        campanelli, testoOriginale: '(modifica a mano)',
      };
      await db.metti('posizioni', rec);
      stato.posizioni.push(rec);
      stato.ctx = { comune: rec.comune, via: rec.via, civico: rec.civico, condominio: campanelli ? { id: rec.id, civico: rec.civico, campanelli } : null };
      await db.scriviMeta('ctx', stato.ctx);
      render();
    }
    d.remove();
  });
  d.showModal();
}

// ---------------------------------------------------------------- condominio: correggere o eliminare
function modificaCondominio(id) {
  const p = stato.posizioni.find((x) => x.id === id);
  if (!p) return;
  const dentro = stato.contatti.filter((c) => c.condominioId === id);
  const d = document.createElement('dialog');
  d.className = 'dialog-condo';
  d.innerHTML = `
    <form method="dialog">
      <p class="via-nome" style="margin:0 4px 8px">Condominio civico ${esc(p.civico ?? '?')}</p>
      <p class="nota">${esc([p.via, p.comune].filter(Boolean).join(', ') || 'Via non detta')} · ${dentro.length} con esito</p>
      <label class="campo"><span>Campanelli suonati davvero</span><input name="campanelli" inputmode="numeric" value="${esc(p.campanelli ?? '')}"></label>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button value="salva" class="conferma" style="flex:2">Salva</button>
        <button value="annulla" class="secondario" style="flex:1">Chiudi</button>
      </div>
      <button type="button" class="elimina" id="c-elimina" style="width:100%;margin-top:12px">Elimina condominio</button>
      <p class="nota">Eliminandolo, i campanelli non contano più. ${dentro.length ? 'I cognomi dettati lì restano, come case singole.' : ''}</p>
    </form>`;
  document.body.appendChild(d);
  let armato = false;
  d.querySelector('#c-elimina').addEventListener('click', async (e) => {
    if (!armato) { armato = true; e.target.textContent = 'Sicuro? Tocca di nuovo'; return; }
    await eliminaCondominio(id);
    d.close('eliminato');
  });
  d.addEventListener('close', async () => {
    if (d.returnValue === 'salva') {
      const n = parseInt(new FormData(d.querySelector('form')).get('campanelli'), 10);
      if (Number.isFinite(n) && n >= 0) {
        p.campanelli = n;
        await db.metti('posizioni', p);
        if (stato.ctx.condominio?.id === id) { stato.ctx.condominio = { ...stato.ctx.condominio, campanelli: n }; await db.scriviMeta('ctx', stato.ctx); }
      }
    }
    d.remove();
    render();
  });
  d.showModal();
}

async function eliminaCondominio(id) {
  await db.togli('posizioni', id);
  stato.posizioni = stato.posizioni.filter((p) => p.id !== id);
  for (const c of stato.contatti.filter((x) => x.condominioId === id)) {
    c.condominioId = null;
    await db.metti('contatti', c);
  }
  if (stato.ctx.condominio?.id === id) {
    stato.ctx = { ...stato.ctx, condominio: null };
    await db.scriviMeta('ctx', stato.ctx);
  }
  toast('Condominio eliminato.');
}

// ---------------------------------------------------------------- toast
let timerToast = null;
function toast(msg, annulla, etichetta = 'Annulla') {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${annulla ? `<button type="button">${esc(etichetta)}</button>` : ''}`;
  t.hidden = false;
  clearTimeout(timerToast);
  if (annulla) t.querySelector('button').addEventListener('click', async () => { t.hidden = true; await annulla(); });
  timerToast = setTimeout(() => { t.hidden = true; }, annulla ? 7000 : 3500);
}

avvio();
