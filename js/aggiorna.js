// Aggiornare a voce un contatto già in lista oggi (richiesta di Dani, 27/11).
// Dani segna "assente" quando suona; se poi parla col cliente ridetta
// "Civico 12 Bisotti appuntamento sabato alle 10" e l'app aggiorna il Bisotti
// già in lista invece di crearne un doppione.
//
// Il contatto si riconosce da cognome + civico: ci possono essere cognomi
// uguali a civici diversi. Il civico è quello detto nella frase o, se non lo
// dice, quello in cui si trova. Se i candidati sono più di uno l'app chiede,
// non indovina.

const norm = (s) => (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

export function candidati(contatti, it, giorno) {
  if (!it.identificativo) return [];
  const nome = norm(it.identificativo);
  const civico = norm(it.civico);
  return contatti.filter((c) => c.giorno === giorno && norm(c.identificativo) === nome && norm(c.civico) === civico);
}

const CAMPI_ESITO = ['esito', 'data', 'ora', 'oraTipo', 'daFissare'];
const CAMPI_DETTAGLIO = ['pretesto', 'modello', 'concorrente', 'telefono', 'richiamo'];

// Nuova versione del contatto: esito, giorno e ora vengono dalla nuova frase;
// i dettagli già noti restano se la nuova frase non ne dice di nuovi; le note si sommano;
// le frasi dettate prima restano conservate.
export function applica(vecchio, it, now) {
  const n = structuredClone(vecchio);
  for (const k of CAMPI_ESITO) n[k] = it[k] ?? (k === 'daFissare' ? false : null);
  for (const k of CAMPI_DETTAGLIO) if (it[k] != null) n[k] = it[k];
  n.note = [vecchio.note, it.note].filter((x) => x && x.trim()).join(' · ');
  n.testiPrecedenti = [...(vecchio.testiPrecedenti ?? []), { testo: vecchio.testoOriginale, creato: vecchio.aggiornato ?? vecchio.creato }];
  n.testoOriginale = it.testoOriginale;
  n.aggiornato = now.toISOString();
  n.avvisi = it.avvisi ?? [];
  n.confermato = !it.daConfermare;
  // cosa ha capito l'app: esito/giorno/ora della nuova frase, ma il cognome resta quello letto la prima volta
  // (così una correzione del cognome non ancora mandata a Simona non si perde)
  n.letto = { ...(vecchio.letto ?? {}), esito: it.esito ?? null, data: it.data ?? null, ora: it.ora ?? null, daFissare: !!it.daFissare };
  return n;
}
