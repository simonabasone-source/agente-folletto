// Frasi che l'app aveva capito male: Dani le corregge nella scheda, l'app se lo segna
// e prepara il messaggio da mandare a Simona per migliorare il parser.
import { dataBreve, isoTime } from './parser/dates.js';

const ESITO = { appuntamento: 'appuntamento', ripassare: 'ripassare', non_interessato: 'non interessato', assente: 'assente' };

// Cosa ha capito l'app, salvato al momento della dettatura.
export function istantanea(c) {
  return {
    identificativo: c.identificativo ?? '',
    esito: c.esito ?? null,
    data: c.data ?? null,
    ora: c.ora ?? null,
    daFissare: !!c.daFissare,
  };
}

const conData = (e) => e === 'appuntamento' || e === 'ripassare';

// Elenco dei campi che Dani ha cambiato rispetto a quello che aveva capito l'app.
export function differenze(letto, finale) {
  if (!letto) return [];
  const d = [];
  if ((letto.identificativo ?? '').trim().toLowerCase() !== (finale.identificativo ?? '').trim().toLowerCase()) d.push('cognome');
  if (letto.esito !== finale.esito) d.push('esito');
  if (conData(finale.esito) && conData(letto.esito)) {
    if (!!letto.daFissare !== !!finale.daFissare || (!finale.daFissare && letto.data !== finale.data)) d.push('giorno');
    if (letto.ora !== finale.ora) d.push('ora');
  }
  return d;
}

function descrivi(v) {
  const parti = [v.identificativo || '?', ESITO[v.esito] ?? 'esito non capito'];
  if (conData(v.esito)) {
    parti.push(v.daFissare || !v.data ? 'da fissare' : dataBreve(v.data));
    if (v.ora) parti.push(v.ora);
  }
  return parti.join(' · ');
}

function blocco(c, n) {
  const righe = [`${n}) «${c.testoOriginale}»`];
  const quando = c.creato ? new Date(c.creato) : null;
  if (quando) righe.push(`   Dettata: ${dataBreve(c.giorno ?? '')} ${isoTime(quando)}`.replace(':  ', ': '));
  righe.push(`   App:  ${descrivi(c.letto)}`);
  righe.push(`   Dani: ${descrivi(c)}`);
  return righe.join('\n');
}

export function messaggio(contatti) {
  const righe = [`Frasi da correggere — app Folletto (${contatti.length})`, ''];
  contatti.forEach((c, i) => { righe.push(blocco(c, i + 1)); righe.push(''); });
  return righe.join('\n').trim();
}

// WhatsApp tronca i testi lunghi (il 27/11 su 79 frasi ne sono arrivate 30 e mezza, ~4000 caratteri):
// si divide in parti che stanno sotto il limite, senza mai spezzare una frase.
export const MAX_PARTE = 3000;

export function parti(contatti, max = MAX_PARTE) {
  const gruppi = [];
  const spazio = max - 80; // riga del titolo ("… (79) · parte 1 di 3") e a capo
  let corrente = [], lung = 0;
  contatti.forEach((c, i) => {
    const l = blocco(c, i + 1).length + 2;
    if (corrente.length && lung + l > spazio) { gruppi.push(corrente); corrente = []; lung = 0; }
    corrente.push({ c, n: i + 1 }); lung += l;
  });
  if (corrente.length) gruppi.push(corrente);
  const tot = gruppi.length;
  return gruppi.map((g, k) => {
    const titolo = `Frasi da correggere — app Folletto (${contatti.length})` + (tot > 1 ? ` · parte ${k + 1} di ${tot}` : '');
    const testo = [titolo, '', ...g.flatMap(({ c, n }) => [blocco(c, n), ''])].join('\n').trim();
    return { testo, contatti: g.map(({ c }) => c), da: g[0].n, a: g[g.length - 1].n };
  });
}
