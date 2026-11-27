// Raggruppa i contatti per paese e via (le "tendine" della schermata Giro). Funzione pura.

const numeroCivico = (c) => {
  const n = parseInt(String(c ?? ''), 10);
  return Number.isNaN(n) ? Infinity : n;
};

export const chiaveVia = (comune, via) => `${(comune ?? '').toLowerCase()}|${(via ?? '').toLowerCase()}`;

/**
 * @returns {Array<{chiave, comune, via, contatti, conteggi:{citofoni, appuntamenti, ripassi, daConfermare}}>}
 *   vie ordinate dalla più recente; dentro ogni via, contatti per numero civico (poi per ora).
 */
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
