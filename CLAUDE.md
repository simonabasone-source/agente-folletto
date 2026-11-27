# Regole del progetto Agente Folletto

App personale per Dani (agente Folletto). Il contesto completo e le decisioni sono nel Diario di progetto
(progetto claude.ai "Software di supporto Agente Folletto", `claude/Diario di progetto.md`).

## Regola fissa: test di regressione a ogni modifica (richiesta di Simona, 2026-11-26)

Ogni modifica al codice, anche di una riga, segue questo ordine. Nessuna eccezione.

1. **Prima di toccare il codice**: `npm run test:tutto` deve essere verde. Se non lo è, si sistema prima quello.
2. **Durante**: ogni comportamento nuovo o corretto riceve un test.
   - frase di Dani capita male → nuovo test in `tests/parser.test.mjs` con la frase **esatta** (testo originale)
   - nuova funzione dell'interfaccia → nuova prova in `tests/browser/regressione.py`
   - un test esistente non si cancella né si indebolisce per far passare una modifica: se va cambiato, si spiega perché a Simona
3. **Prima di pubblicare**: `npm run test:tutto` di nuovo, tutto verde. Se qualcosa fallisce, non si pubblica.
4. **Nel messaggio a Simona**: quanti test sono passati (es. "32 controlli + 18 prove sul telefono simulato, tutti superati") e se ne sono stati aggiunti.
5. **Nel Diario**: aggiornare il numero dei test.

### Cosa copre ogni livello
| Comando | Cosa controlla | Trova |
|---|---|---|
| `npm test` | parser, numeri, agenda, segnalazioni, tendine — una parte alla volta | quale parte si è rotta |
| `npm run test:browser` | l'app intera su un telefono simulato, come la usa Dani | problemi tra le parti (es. righe che non si aprono) |

Servono entrambi: un guasto nel parser lo vede `npm test`, un tasto che non risponde lo vede solo il browser.

## Rilascio
- Lavorare su un ramo, aprire una PR verso `main`, unirla solo con i test verdi.
- Aggiornare `VERSIONE` in `sw.js` (e l'elenco `FILE` se si aggiungono file) e `VERSIONE_APP` in `js/app.js`.
- Aggiungere in cima a `NOVITA` in `js/notifiche.js` 1–3 righe semplici per Dani su cosa cambia: compaiono nella campanella dopo l'aggiornamento.
- Dopo l'unione GitHub Pages pubblica in 1–2 minuti; sul telefono la campanella diventa gialla con "Nuova versione pronta" (controllo ogni 15 minuti e quando Dani riprende il telefono).

## Vincoli dell'app
- Funziona offline, dati solo sul telefono (IndexedDB), nessuna libreria esterna, nessuna compilazione.
- Giorno e ora degli appuntamenti devono essere giusti: nel dubbio l'app avvisa, non indovina.
- Dani usa il telefono il meno possibile (freddo, guanti): ogni tocco in più va giustificato.
