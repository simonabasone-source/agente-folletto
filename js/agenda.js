// Agenda: appuntamenti, ripassi e promemoria di richiamo. Funzioni pure.

export const DURATA_MINUTI = 60; // sotto questa distanza due appuntamenti si sovrappongono

const minuti = (ora) => {
  const [h, m] = ora.split(':').map(Number);
  return h * 60 + m;
};

const conData = (c) => (c.esito === 'appuntamento' || c.esito === 'ripassare');

// Voci dell'agenda da `daGiorno` in avanti, ordinate per giorno e ora.
export function vociAgenda(contatti, daGiorno) {
  const voci = [];
  for (const c of contatti) {
    if (!conData(c)) continue;
    if (c.data && !c.daFissare && c.data >= daGiorno) {
      voci.push({ data: c.data, ora: c.ora, tipo: c.esito === 'appuntamento' ? 'appuntamento' : 'ripasso', contatto: c });
    }
    if (c.richiamo?.data && c.richiamo.data >= daGiorno) {
      voci.push({ data: c.richiamo.data, ora: null, tipo: 'richiamo', contatto: c });
    }
  }
  voci.sort((a, b) => (a.data + (a.ora ?? '99:99')).localeCompare(b.data + (b.ora ?? '99:99')));
  return voci;
}

export function daFissare(contatti) {
  return contatti
    .filter((c) => conData(c) && (c.daFissare || !c.data))
    .sort((a, b) => (a.creato ?? '').localeCompare(b.creato ?? ''));
}

// Altri appuntamenti/ripassi nello stesso giorno a meno di DURATA_MINUTI.
export function sovrapposizioni(contatto, contatti) {
  if (!conData(contatto) || !contatto.data || !contatto.ora || contatto.daFissare) return [];
  const t = minuti(contatto.ora);
  return contatti.filter((c) => c.id !== contatto.id && conData(c) && !c.daFissare
    && c.data === contatto.data && c.ora && Math.abs(minuti(c.ora) - t) < DURATA_MINUTI);
}

export function raggruppaPerGiorno(voci) {
  const g = new Map();
  for (const v of voci) {
    if (!g.has(v.data)) g.set(v.data, []);
    g.get(v.data).push(v);
  }
  return [...g.entries()];
}
