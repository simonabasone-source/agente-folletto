// Raggruppa i contatti per paese e via (le "tendine" della schermata Giro). Funzione pura.

const numeroCivico = (c) => {
  const n = parseInt(String(c ?? ''), 10);
  return Number.isNaN(n) ? Infinity : n;
};

export const chiaveVia = (comune, via) => `${(comune ?? '').toLowerCase()}|${(via ?? '').toLowerCase()}`;

/**
 * @returns {Array<{chiave, comune, via, contatti, conteggi:{citofoni, appuntamenti, ripassi, daConfermare}}>}
 *   vie ordinate dalla più recente; dentro ogni via le righe in `righe` (ultimo campanello in alto).
 */
/**
 * Ordine delle righe dentro una via (richieste di Dani 27/11):
 * - l'ULTIMO campanello suonato in alto, il primo in fondo;
 * - ogni condominio resta un blocco: la sua riga e sotto i suoi cognomi (anche lì l'ultimo in alto);
 *   il blocco sta dove cade il suo campanello più recente.
 * @returns {Array<{tipo:'condominio', posizione, contatti} | {tipo:'contatto', contatto}>}
 */
export function righeInOrdine(contatti, condomini) {
  const ids = new Set(condomini.map((p) => p.id));
  const piuRecenteprima = (a, b) => (b.creato ?? '').localeCompare(a.creato ?? '');
  const blocchi = [
    ...condomini.map((p) => {
      const dentro = contatti.filter((c) => c.condominioId === p.id).sort(piuRecenteprima);
      const ultimo = [p.creato, ...dentro.map((c) => c.creato)].filter(Boolean).sort().pop() ?? '';
      return { tipo: 'condominio', posizione: p, contatti: dentro, creato: ultimo };
    }),
    ...contatti.filter((c) => !(c.condominioId && ids.has(c.condominioId)))
      .map((c) => ({ tipo: 'contatto', contatto: c, creato: c.creato })),
  ];
  blocchi.sort(piuRecenteprima);
  return blocchi.map(({ creato, ...b }) => b);
}

export function raggruppaPerVia(contatti, condomini = []) {
  const mappa = new Map();
  const gruppo = (x) => {
    const k = chiaveVia(x.comune, x.via);
    if (!mappa.has(k)) mappa.set(k, { chiave: k, comune: x.comune ?? null, via: x.via ?? null, contatti: [], condomini: [], ultimo: '' });
    const g = mappa.get(k);
    if ((x.creato ?? '') > g.ultimo) g.ultimo = x.creato ?? '';
    return g;
  };
  for (const c of contatti) gruppo(c).contatti.push(c);
  // i condomini compaiono come righe da toccare (per correggere i campanelli o eliminarli)
  for (const p of condomini) gruppo(p).condomini.push(p);
  const gruppi = [...mappa.values()];
  for (const g of gruppi) {
    g.contatti.sort((a, b) => (numeroCivico(a.civico) - numeroCivico(b.civico))
      || String(a.civico ?? '').localeCompare(String(b.civico ?? ''))
      || (a.creato ?? '').localeCompare(b.creato ?? ''));
    g.condomini.sort((a, b) => numeroCivico(a.civico) - numeroCivico(b.civico));
    g.righe = righeInOrdine(g.contatti, g.condomini);
    g.conteggi = {
      citofoni: g.contatti.length,
      appuntamenti: g.contatti.filter((c) => c.esito === 'appuntamento').length,
      ripassi: g.contatti.filter((c) => c.esito === 'ripassare').length,
      daConfermare: g.contatti.filter((c) => !c.confermato).length,
    };
  }
  gruppi.sort((a, b) => b.ultimo.localeCompare(a.ultimo));
  return gruppi.map(({ ultimo, ...g }) => g);
}
