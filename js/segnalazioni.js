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

export function messaggio(contatti) {
  const righe = [`Frasi da correggere — app Folletto (${contatti.length})`, ''];
  contatti.forEach((c, i) => {
    righe.push(`${i + 1}) «${c.testoOriginale}»`);
    const quando = c.creato ? new Date(c.creato) : null;
    if (quando) righe.push(`   Dettata: ${dataBreve(c.giorno ?? '')} ${isoTime(quando)}`.replace(':  ', ': '));
    righe.push(`   App:  ${descrivi(c.letto)}`);
    righe.push(`   Dani: ${descrivi(c)}`);
    righe.push('');
  });
  return righe.join('\n').trim();
}
