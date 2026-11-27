// Notifiche dentro l'app (la campanella). Funzioni pure + elenco delle novità per Dani.
//
// A ogni nuova versione: aggiungere in cima a NOVITA una voce con la versione e
// 1–3 righe semplici su cosa cambia per Dani (non dettagli tecnici).

export const NOVITA = [
  {
    versione: '1.6.1',
    righe: ['Nei condomini, sotto ogni condominio trovi i suoi cognomi nell\'ordine in cui li hai dettati. Poi il condominio successivo.'],
  },
  {
    versione: '1.6.0',
    righe: [
      'Arriva la campanella: qui trovi gli aggiornamenti e cosa è cambiato.',
      'Quando c\'è una versione nuova, tocca Aggiorna dalla campanella. Quello che stavi dettando non si perde.',
    ],
  },
  {
    versione: '1.5.0',
    righe: ['I condomini compaiono nella tendina della via: toccali per correggere i campanelli o eliminarli.'],
  },
];

// "1.10.0" > "1.9.2"
export function confrontaVersioni(a, b) {
  const pa = String(a ?? '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b ?? '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * Novità da mostrare dopo un aggiornamento: le versioni più nuove dell'ultima vista,
 * fino a quella installata. Alla prima installazione (ultimaVista nulla) solo quella installata.
 */
export function novitaDaMostrare(ultimaVista, installata, novita = NOVITA) {
  if (!ultimaVista) return novita.filter((n) => confrontaVersioni(n.versione, installata) === 0);
  return novita.filter((n) => confrontaVersioni(n.versione, ultimaVista) > 0 && confrontaVersioni(n.versione, installata) <= 0);
}

export function nonLette(notifiche) {
  return notifiche.filter((n) => !n.letta).length;
}
