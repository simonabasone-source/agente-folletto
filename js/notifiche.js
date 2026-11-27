// Notifiche dentro l'app (la campanella). Funzioni pure + elenco delle novità per Dani.
//
// A ogni nuova versione: aggiungere in cima a NOVITA una voce con la versione e
// 1–3 righe semplici su cosa cambia per Dani (non dettagli tecnici).

export const NOVITA = [
  {
    versione: '1.7.4',
    righe: [
      'Frasi da mandare a Simona: se sono tante, l\'app le divide in più messaggi. Tocca le parti una alla volta.',
      'Nel Menu c\'è "Rimetti in elenco le frasi già mandate": toccalo una volta e rimanda a Simona quelle di oggi.',
      '"assent" (con la e tagliata dalla tastiera) ora vale come assente.',
    ],
  },
  {
    versione: '1.7.3',
    righe: ['Quando correggi una riga della lista e confermi, resti nello stesso punto: niente più ritorno in cima e niente tastiera.'],
  },
  {
    versione: '1.7.2',
    righe: ['Il condominio si può dire in più modi: "Condominio 12 campanelli", "12 campanelli", "Condominio civico 3 da 12 campanelli". Se non dici il civico, usa quello in cui sei.'],
  },
  {
    versione: '1.7.1',
    righe: ['Se la tastiera scrive i numeri in lettere ("civico tre", "dodici campanelli", "alle sei") l\'app ora li capisce.'],
  },
  {
    versione: '1.7.0',
    righe: ['L\'ultimo campanello suonato ora è in alto, il primo in fondo. Anche dentro i condomini.'],
  },
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
