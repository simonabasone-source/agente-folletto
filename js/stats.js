// Numeri della giornata. Funzione pura, testata in tests/stats.test.mjs.
//
// Regole (da Dani, 26/11/2026):
// - condominio "N campanelli": li suona tutti → N campanelli suonati; quelli senza esito dettato = assenti
// - casa singola: ogni contatto dettato = 1 campanello

export function statistiche(posizioni, contatti, giorno) {
  const condomini = posizioni.filter((p) => p.giorno === giorno && p.sottotipo === 'condominio');
  const oggi = contatti.filter((c) => c.giorno === giorno);

  const s = { campanelli: 0, parlati: 0, assenti: 0, nonInteressati: 0, appuntamenti: 0, ripassi: 0, daConfermare: 0 };

  for (const c of oggi) {
    if (c.esito === 'assente') s.assenti++;
    else if (c.esito) s.parlati++;
    if (c.esito === 'non_interessato') s.nonInteressati++;
    if (c.esito === 'appuntamento') s.appuntamenti++;
    if (c.esito === 'ripassare') s.ripassi++;
    if (!c.confermato) s.daConfermare++;
    if (!c.condominioId) s.campanelli++;
  }

  for (const cond of condomini) {
    const dentro = oggi.filter((c) => c.condominioId === cond.id).length;
    const tot = Math.max(cond.campanelli ?? 0, dentro);
    s.campanelli += tot;
    s.assenti += tot - dentro;
  }

  return s;
}
