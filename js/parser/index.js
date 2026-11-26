// Parser della dettatura di Dani.
// Funzione pura: riceve il testo dettato, il momento della dettatura e la posizione
// corrente; restituisce gli elementi riconosciuti (posizioni e contatti) e la nuova posizione.
// Nessun accesso a database o interfaccia: si testa da solo (vedi tests/).

import { normalizza, capitalizza } from './normalize.js';
import { GIORNI, MESI, isoDate, isoTime, addDays, weekday, hhmm, dataEstesa } from './dates.js';

// Confine di parola che funziona anche con lettere accentate (\b di JS non le riconosce).
const WB = '(?:(?<![\\p{L}\\d])(?=[\\p{L}\\d])|(?<=[\\p{L}\\d])(?![\\p{L}\\d]))';
const R = (src, flags = 'iu') => new RegExp(src.replace(/\\b/g, WB), flags);

// ---------- esiti ----------
const RE_NON_INT = R("\\bnon\\s+(?:(?:è|e|era|sono|erano)\\s+)?interessat[aoie]\\b|\\bnon\\s+(?:gli|le)\\s+interessa\\b|\\bnon\\s+vuol(?:e|ono)\\b|\\bnon\\s+vogliono\\b");
const RE_APP = R('\\bappuntament[oi]\\b|\\bfissat[oa]\\s+(?:per|il|alle|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|domani|oggi)\\b');
const RE_RIP = R('\\b(?:ri)?passare\\b|\\bripass(?:o|a|i)\\b|\\b(?:ri)?tornare\\b|\\brichiamare\\b|\\brisentir(?:ci|si)\\b');
const RE_ASS = R("\\bassent[ei]\\b|\\bnon\\s+c'è\\s+nessuno\\b|\\bnessuno\\b|\\bnon\\s+rispond(?:e|ono)\\b");

// parole che chiudono il cognome ("Mitev marito ha detto..." -> "Mitev")
const STOP = new Set(['marito', 'moglie', 'figlio', 'figlia', 'figli', 'signora', 'signore', 'signor', 'sig',
  'mamma', 'papà', 'nonna', 'nonno', "c'era", "c'è", 'ha', 'hanno', 'dice', 'dicono', 'detto', 'era',
  'erano', 'solo', 'non', 'cliente', 'già', 'gia', 'però', 'pero', 'anche', 'oggi', 'domani',
  'appuntamento', 'assente', 'assenti', 'ripassare', 'passare']);

// ---------- dettagli ----------
const CONCORRENTI = ['dyson', 'rowenta', 'kirby', 'hoover', 'miele', 'kärcher', 'karcher', 'roomba', 'irobot',
  'dreame', 'polti', 'vileda', 'electrolux', 'bosch', 'philips', 'samsung', 'lg', 'imetec', 'hyla', 'rainbow',
  'thermomix', 'bimby', 'ariete', 'de longhi', 'delonghi', 'xiaomi', 'roborock', 'ecovacs'];
const RE_PRETESTO = R('\\b(sanificazion[ei]|igien[ea]|pulizi[ae]|dimostrazion[ei]|prova|controllo|manutenzione|revisione)\\b');
const RE_VK = R('\\bVK(\\d{2,4})\\b');
const RE_TEL = /(?:\+\s*39\s*)?(?:\d\s*){8,11}\d/g;
const RE_TEL_PRE = R('(?:\\b(?:al|il|col|con il)\\s+)?\\b(?:numero|cellulare|cell|telefono|tel)\\b(?:\\s+(?:è|e))?\\s*$');

// ---------- date ----------
const GIORNO_ALT = 'lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica';
const MESE_ALT = MESI.join('|');
const RE_REL = R('\\b(dopodomani|domani mattina|domani pomeriggio|domani sera|domani|oggi pomeriggio|oggi|stamattina|stamani|stasera|stanotte)\\b');
const RE_GIORNO = R(`\\b(${GIORNO_ALT})(?:\\s+prossim[oa])?\\b`);
const RE_DATA_GM = R(`\\b(\\d{1,2})\\s+(${MESE_ALT})\\b`);
const RE_DATA_MG = R(`\\b(${MESE_ALT})\\s+(\\d{1,2})\\b(?!\\s*[:.]\\s*\\d)`);
const RE_DATA_NUM = R('\\b(\\d{1,2})\\s*/\\s*(\\d{1,2})(?:\\s*/\\s*(\\d{2,4}))?\\b');
const RE_VAGA = R('\\b(la\\s+settimana\\s+prossima|settimana\\s+prossima|la\\s+prossima\\s+settimana|prossima\\s+settimana|il\\s+mese\\s+prossimo|mese\\s+prossimo|fine\\s+mese|più\\s+avanti|in\\s+settimana)\\b');
const RE_TRA = R('\\b(?:tra|fra)\\s+(un|una|uno|due|tre|quattro|\\d+)\\s+(giorn[oi]|settiman[ae])\\b');
const RE_ORA = R('\\b(alle|ore|per\\s+le|verso\\s+le|dopo\\s+le|prima\\s+delle|dalle|dopo\\s+delle)\\s+(?:ore\\s+)?(\\d{1,2})(?:\\s*(?::|\\.|\\s+e)\\s*(\\d{2}|mezza|mezzo|un\\s+quarto|quarto)|\\s*:\\s*(\\d{2})|\\s+(\\d{2})(?!\\s*\\d))?\\b');
const RE_PARTE = R('\\b(mattina|mattino|stamattina|pomeriggio|sera|stasera)\\b');
const RE_RICHIAMO = R('\\brichiamar(?:e|lo|la|li|le)?\\s+(il\\s+giorno\\s+prima|(?:(un|una|uno|due|tre|quattro|\\d+)\\s+(giorn[oi]|settiman[ae])\\s+prima))\\b');

const NUM = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4 };
const num = (s) => NUM[s?.toLowerCase()] ?? Number(s);

const GIORNO_IDX = (s) => {
  const base = s.toLowerCase().replace(/i$/, 'ì');
  return GIORNI.indexOf(base === 'sabatì' ? 'sabato' : base === 'domenicì' ? 'domenica' : base);
};

// ---------- posizione ----------
const RE_STRADA = R("\\b(via|viale|v\\.le|piazza|piazzale|p\\.zza|corso|vicolo|strada|stradone|largo|località|loc\\.|frazione|borgo|contrada|vicoletto|traversa)\\b");

function nuovoCtx(ctx = {}) {
  return { comune: ctx.comune ?? null, via: ctx.via ?? null, civico: ctx.civico ?? null, condominio: ctx.condominio ?? null };
}

function puliziaCivico(s) {
  return s.replace(/\s+/g, '').toUpperCase();
}

function parsePosizioneAdesso(resto, ctx) {
  const avvisi = [];
  let r = resto.replace(/^[\s,]*(?:siamo\s+)?(?:a|in|ad)\s+(?=\S)/i, '').trim();
  const m = r.match(RE_STRADA);
  let comune = null; let via = null; let civico = null;
  if (m) {
    comune = r.slice(0, m.index).replace(/[,\s]+$/, '').replace(/\s+(?:in|a)$/i, '').trim() || null;
    let v = r.slice(m.index).replace(/[.,;\s]+$/, '');
    const c = v.match(/\s+(\d{1,4}(?:\s*[a-z])?)$/i);
    if (c) { civico = puliziaCivico(c[1]); v = v.slice(0, c.index); }
    via = capitalizza(v);
  } else if (r) {
    comune = r.replace(/[.,;\s]+$/, '');
    avvisi.push('Ho capito un cambio di paese, senza via.');
  }
  const nuovo = nuovoCtx(ctx);
  if (comune) { nuovo.comune = capitalizza(comune); nuovo.via = via; }
  else nuovo.via = via;
  nuovo.civico = civico;
  nuovo.condominio = null;
  return { tipo: 'posizione', sottotipo: 'via', comune: nuovo.comune, via: nuovo.via, civico, avvisi, ctx: nuovo };
}

// ---------- date e ore ----------
function trovaOra(body) {
  const m = body.match(RE_ORA);
  if (!m) return null;
  let h = Number(m[2]);
  const minRaw = m[3] ?? m[4] ?? m[5];
  let min = 0;
  if (minRaw) {
    const l = minRaw.toLowerCase();
    if (l === 'mezza' || l === 'mezzo') min = 30;
    else if (l.includes('quarto')) min = 15;
    else min = Number(minRaw);
  }
  if (h > 23 || min > 59) return null;
  const prep = m[1].toLowerCase().replace(/\s+/g, ' ');
  const prima = body.slice(Math.max(0, m.index - 14), m.index).toLowerCase();
  const verso = prep.startsWith('verso') || /verso\s+(?:sera|le|il)?\s*$/.test(prima);
  const tipo = prep.startsWith('dopo') ? 'dopo' : verso ? 'verso' : prep.startsWith('prima') ? 'prima' : 'esatta';
  return { h, min, tipo, span: [m.index, m.index + m[0].length] };
}

function risolviDataOra(body, now, esito) {
  const avvisi = [];
  const spans = [];
  const oggi = isoDate(now);
  let data = null;
  let daFissare = false;
  let fonte = null;

  const parte = body.match(RE_PARTE)?.[1]?.toLowerCase() ?? null;

  const rel = body.match(RE_REL);
  const gm = body.match(RE_DATA_GM);
  const mg = gm ? null : body.match(RE_DATA_MG);
  const dn = (gm || mg) ? null : body.match(RE_DATA_NUM);
  const gs = body.match(RE_GIORNO);
  const vaga = body.match(RE_VAGA);
  const tra = body.match(RE_TRA);

  if (gm || mg || dn) {
    let giorno; let mese; let anno = now.getFullYear(); let m;
    if (gm) { m = gm; giorno = Number(gm[1]); mese = MESI.indexOf(gm[2].toLowerCase()); }
    else if (mg) { m = mg; giorno = Number(mg[2]); mese = MESI.indexOf(mg[1].toLowerCase()); }
    else { m = dn; giorno = Number(dn[1]); mese = Number(dn[2]) - 1; if (dn[3]) anno = Number(dn[3].length === 2 ? '20' + dn[3] : dn[3]); }
    const d = new Date(anno, mese, giorno);
    if (d.getMonth() !== mese || d.getDate() !== giorno) {
      avvisi.push(`La data "${m[0]}" non esiste.`);
    } else {
      if (isoDate(d) < oggi && !(dn && dn[3])) d.setFullYear(d.getFullYear() + 1);
      data = isoDate(d);
      fonte = 'data';
    }
    spans.push([m.index, m.index + m[0].length]);
    if (gs) {
      spans.push([gs.index, gs.index + gs[0].length]);
      if (data && GIORNO_IDX(gs[1]) !== weekday(data)) {
        avvisi.push(`Hai detto ${gs[1].toLowerCase()}, ma il ${dataEstesa(data).replace(/^\S+\s/, '')} è ${GIORNI[weekday(data)]}. Controlla il giorno.`);
      }
    }
  } else if (rel) {
    const k = rel[1].toLowerCase();
    if (k.startsWith('dopodomani')) data = addDays(oggi, 2);
    else if (k.startsWith('domani')) data = addDays(oggi, 1);
    else data = oggi;
    fonte = 'relativa';
    spans.push([rel.index, rel.index + rel[0].length]);
  } else if (gs) {
    const target = GIORNO_IDX(gs[1]);
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) {
      diff = 7;
      avvisi.push(`Hai detto ${gs[1].toLowerCase()}, che è oggi: ho messo ${gs[1].toLowerCase()} della settimana prossima.`);
    }
    data = addDays(oggi, diff);
    fonte = 'giorno';
    spans.push([gs.index, gs.index + gs[0].length]);
  } else if (tra) {
    const n = num(tra[1]);
    const giorni = tra[2].toLowerCase().startsWith('settiman') ? n * 7 : n;
    data = addDays(oggi, giorni);
    fonte = 'tra';
    spans.push([tra.index, tra.index + tra[0].length]);
  } else if (vaga) {
    daFissare = true;
    fonte = 'vaga';
    spans.push([vaga.index, vaga.index + vaga[0].length]);
    avvisi.push(`Data vaga ("${vaga[0]}"): resta da fissare.`);
  }

  // ora
  let ora = null; let oraTipo = null;
  const o = trovaOra(body);
  if (o) {
    let h = o.h;
    const sera = parte && /pomeriggio|sera/.test(parte);
    const mattina = parte && /matt/.test(parte);
    if (h < 12 && sera) h += 12;
    else if (h >= 1 && h <= 7 && !mattina) {
      h += 12;
      avvisi.push(`Ho inteso le ${hhmm(h, o.min)} (pomeriggio).`);
    }
    ora = hhmm(h, o.min);
    oraTipo = o.tipo;
    spans.push(o.span);
  }

  if (!data && !daFissare) {
    if (ora) {
      data = oggi;
      fonte = 'implicita';
      avvisi.push('Giorno non detto: ho messo oggi.');
    } else {
      daFissare = true;
      if (esito === 'appuntamento') avvisi.push('Mancano giorno e ora: resta da fissare.');
    }
  }
  if (data && !ora && esito === 'appuntamento') avvisi.push("Manca l'ora.");

  if (data && ora) {
    const quando = `${data}T${ora}`;
    const adesso = `${oggi}T${isoTime(now)}`;
    if (quando < adesso) avvisi.push('Questo orario è già passato.');
  }

  return { data, ora, oraTipo, daFissare, fonteData: fonte, avvisi, spans };
}

// ---------- contatto ----------
function trovaIdentificativo(testo, idxEsito) {
  // ritorna la lunghezza del prefisso che è il cognome
  const limite = idxEsito >= 0 ? idxEsito : testo.length;
  const re = /\S+/g;
  let m; let fine = 0;
  while ((m = re.exec(testo)) && m.index < limite) {
    const w = m[0].toLowerCase().replace(/[.,;:]+$/, '');
    if (fine > 0 && STOP.has(w)) break;
    if (fine === 0 && STOP.has(w) && !/^\p{Lu}/u.test(m[0])) break;
    fine = m.index + m[0].replace(/[.,;:]+$/, '').length;
  }
  return fine;
}

function trovaEsito(t) {
  const cands = [
    ['non_interessato', t.match(RE_NON_INT)],
    ['appuntamento', t.match(RE_APP)],
    ['ripassare', t.match(RE_RIP)],
    ['assente', t.match(RE_ASS)],
  ];
  for (const [esito, m] of cands) if (m) return { esito, match: m };
  return { esito: null, match: null };
}

function rimuoviSpans(testo, spans) {
  // unisce gli intervalli sovrapposti, poi li toglie dal fondo
  const uniti = [];
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    const u = uniti[uniti.length - 1];
    if (u && a <= u[1]) u[1] = Math.max(u[1], b); else uniti.push([a, b]);
  }
  let out = testo;
  for (const [a, b] of uniti.reverse()) out = out.slice(0, a) + ' ' + out.slice(b);
  return out
    .replace(/\s+([,.;])/g, '$1')
    .replace(/([,.;])(?=[,.;])/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;]+|[\s,.;]+$/g, '')
    .replace(/^(?:per|e|di|al|il|alle|ore|,)\s+/i, '')
    .replace(/\s+(?:per|e|di|al|alle|ore|il)$/i, '')
    .trim();
}

function parseContatto(testoIntero, idPrefisso, ctx, now) {
  // idPrefisso: { identificativo, lunghezza } se la frase inizia con "civico N" / "interno N"
  const { esito, match } = trovaEsito(testoIntero);
  let identificativo; let inizioBody;
  const avvisi = [];
  if (idPrefisso) {
    identificativo = idPrefisso.identificativo;
    inizioBody = idPrefisso.lunghezza;
  } else {
    const fine = trovaIdentificativo(testoIntero, match ? match.index : -1);
    identificativo = capitalizza(testoIntero.slice(0, fine).trim());
    inizioBody = fine;
    if (!identificativo) avvisi.push('Non ho capito il cognome.');
    else if (identificativo.split(' ').length > 1) avvisi.push(`Cognome "${identificativo}": controlla che non sia spezzato.`);
  }
  const body = testoIntero.slice(inizioBody);
  const bodyOffset = inizioBody;
  const spans = [];
  if (match && match.index >= bodyOffset) spans.push([match.index - bodyOffset, match.index - bodyOffset + match[0].length]);
  if (!esito) avvisi.push('Esito non capito: scegli tu.');

  const c = {
    tipo: 'contatto',
    identificativo,
    esito,
    data: null, ora: null, oraTipo: null, daFissare: false,
    pretesto: null, modello: null, concorrente: null, telefono: null, richiamo: null,
    note: '',
    avvisi,
  };

  if (esito === 'appuntamento' || esito === 'ripassare') {
    const d = risolviDataOra(body, now, esito);
    Object.assign(c, { data: d.data, ora: d.ora, oraTipo: d.oraTipo, daFissare: d.daFissare });
    avvisi.push(...d.avvisi);
    spans.push(...d.spans);

    const ric = body.match(RE_RICHIAMO);
    if (ric) {
      let giorni = 1;
      if (ric[2]) giorni = num(ric[2]) * (ric[3].toLowerCase().startsWith('settiman') ? 7 : 1);
      c.richiamo = { giorniPrima: giorni, data: c.data ? addDays(c.data, -giorni) : null };
      spans.push([ric.index, ric.index + ric[0].length]);
    }
  }

  // telefono
  RE_TEL.lastIndex = 0;
  let tm;
  while ((tm = RE_TEL.exec(body))) {
    const cifre = tm[0].replace(/\D/g, '');
    const nazionali = cifre.startsWith('39') && cifre.length > 11 ? cifre.slice(2) : cifre;
    if (nazionali.length >= 9 && nazionali.length <= 11) {
      c.telefono = nazionali;
      let a = tm.index;
      const pre = body.slice(0, a).match(RE_TEL_PRE);
      if (pre) a = pre.index;
      spans.push([a, tm.index + tm[0].length]);
      break;
    }
  }

  const vk = body.match(RE_VK);
  if (vk) { c.modello = `VK${vk[1]}`; spans.push([vk.index, vk.index + vk[0].length]); }

  const low = body.toLowerCase();
  for (const nome of CONCORRENTI) {
    if (R(`\\b${nome}\\b`).test(low)) { c.concorrente = capitalizza(nome); break; }
  }

  // pretesto: solo se preceduto da "per" o seguito da un modello VK
  const pr = body.match(R(`(?:\\bper\\s+)?\\b(sanificazion[ei]|igien[ea]|pulizi[ae]|dimostrazion[ei]|prova|controllo|manutenzione|revisione)\\b(\\s+(?:del\\s+|dell'|della\\s+)?VK\\d{2,4})?`));
  if (pr && (/^per\s/i.test(pr[0]) || pr[2])) {
    c.pretesto = pr[1].toLowerCase();
    spans.push([pr.index, pr.index + pr[0].length]);
  }

  c.note = rimuoviSpans(body, spans);
  if (c.note === identificativo) c.note = '';

  c.daConfermare = c.esito === 'appuntamento' || c.esito === 'ripassare' || !c.esito || c.note.length > 0 || c.avvisi.length > 0;
  return c;
}

// ---------- divisione in frasi ----------
function dividi(testo) {
  return testo
    .split(/\n+|(?<=[.;!?])\s+(?=\p{Lu})/u)
    .flatMap((s) => s.split(R('\\s+(?=\\badesso\\b\\s)')))
    .map((s) => s.trim().replace(/^[.,;\s]+|[.;\s]+$/g, ''))
    .filter(Boolean);
}

const RE_CIVICO = R('^(?:al\\s+)?\\b(civico|numero|n\\.)\\s*(\\d{1,4}(?:\\s*[a-z](?![\\p{L}]))?)\\b', 'iu');
const RE_INTERNO = R('^\\b(interno|int\\.|scala|piano)\\s+(\\w{1,3})\\b', 'iu');
const RE_CONDO = R('^[\\s,]*(?:è\\s+un\\s+|e\\s+)?\\b(?:condominio|palazzina|palazzo)\\b(?:\\s+(?:di|da|con))?(?:\\s+(\\d{1,3})\\s+(?:campanell[io]|appartament[io]|famiglie|interni))?');

/**
 * @param {string} testo testo dettato
 * @param {{ now?: Date, ctx?: object, correzioni?: Array<{da:string,a:string}> }} opzioni
 * @returns {{ items: Array<object>, ctx: object, testoNormalizzato: string }}
 */
export function analizza(testo, { now = new Date(), ctx = {}, correzioni = [] } = {}) {
  const norm = normalizza(testo ?? '', correzioni);
  let corrente = nuovoCtx(ctx);
  const items = [];

  for (const frase of dividi(norm)) {
    const ad = frase.match(R('^\\b(?:adesso|ora|siamo)\\b\\s*'));
    if (ad) {
      const p = parsePosizioneAdesso(frase.slice(ad[0].length), corrente);
      corrente = p.ctx;
      delete p.ctx;
      items.push({ ...p, testoOriginale: frase });
      continue;
    }

    const civ = frase.match(RE_CIVICO);
    if (civ) {
      const civico = puliziaCivico(civ[2]);
      const resto = frase.slice(civ[0].length);
      const cond = resto.match(RE_CONDO);
      if (cond) {
        const campanelli = cond[1] ? Number(cond[1]) : null;
        corrente = { ...corrente, civico, condominio: { civico, campanelli } };
        items.push({
          tipo: 'posizione', sottotipo: 'condominio', comune: corrente.comune, via: corrente.via, civico, campanelli,
          avvisi: campanelli ? [] : ['Quanti campanelli ha il condominio?'], testoOriginale: frase,
        });
        const dopo = resto.slice(cond[0].length).trim();
        if (dopo.replace(/[.,;\s]/g, '')) {
          // il resto della frase dopo "condominio N campanelli" viene ignorato ma resta nel testo originale
        }
        continue;
      }
      // cambio civico: se diverso dal condominio, il condominio finisce
      if (corrente.condominio && corrente.condominio.civico !== civico) corrente = { ...corrente, condominio: null };
      corrente = { ...corrente, civico };
      if (!resto.replace(/[.,;\s]/g, '')) {
        items.push({ tipo: 'posizione', sottotipo: 'civico', comune: corrente.comune, via: corrente.via, civico, avvisi: [], testoOriginale: frase });
        continue;
      }
      const c = parseContatto(frase, { identificativo: `Civico ${civico}`, lunghezza: civ[0].length }, corrente, now);
      items.push({ ...c, comune: corrente.comune, via: corrente.via, civico, condominio: corrente.condominio, testoOriginale: frase });
      // la casa successiva ha un altro civico: non lo trasciniamo sui contatti dopo
      if (!corrente.condominio) corrente = { ...corrente, civico: null };
      continue;
    }

    const int = frase.match(RE_INTERNO);
    if (int) {
      const c = parseContatto(frase, { identificativo: capitalizza(int[0]), lunghezza: int[0].length }, corrente, now);
      items.push({ ...c, comune: corrente.comune, via: corrente.via, civico: corrente.civico, condominio: corrente.condominio, testoOriginale: frase });
      continue;
    }

    const c = parseContatto(frase, null, corrente, now);
    items.push({ ...c, comune: corrente.comune, via: corrente.via, civico: corrente.civico, condominio: corrente.condominio, testoOriginale: frase });
  }

  return { items, ctx: corrente, testoNormalizzato: norm };
}
