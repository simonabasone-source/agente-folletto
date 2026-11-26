# Agente Folletto

App personale di supporto al lavoro sul campo di Dani (agente Folletto).

Sostituisce il blocco note cartaceo: dettatura citofono per citofono, agenda appuntamenti, numeri della giornata. Funziona offline sul telefono; i dati restano solo sul dispositivo.

## Stato
**Step 1** — giro citofoni a voce, scheda di conferma per appuntamenti/ripassi/note, agenda dei prossimi giorni con avviso di sovrapposizione, numeri della giornata, backup.

## Come si usa
1. Tocca il campo grande, poi il microfono della tastiera, e detta. Poi **Invia**.
2. Frasi di posizione: «Adesso Santo Stefano Lodigiano via Roma», «Civico 30 condominio 12 campanelli», «Civico 8».
3. Assenti e non interessati senza note vengono salvati subito (c'è **Annulla** per qualche secondo).
4. Appuntamenti, ripassi e note aprono la scheda: controlla giorno e ora (scritti per esteso) e tocca **Conferma**.
5. **Agenda**: appuntamenti, ripassi e richiami da oggi in avanti, più quelli da fissare.
6. **Menu**: frasi capite male da mandare a Simona, posizione a mano, backup, cognomi corretti.

## Frasi capite male
Quando Dani corregge nella scheda qualcosa che l'app aveva capito (cognome, esito, giorno, ora), l'app se lo segna. Menu → **Frasi da mandare a Simona** apre WhatsApp con il messaggio pronto. Le frasi vanno aggiunte a `tests/parser.test.mjs` e il parser corretto.

## Installazione sul telefono (Android)
Apri l'indirizzo dell'app in Chrome → menu ⋮ → **Aggiungi a schermata Home** / **Installa app**.

## Struttura del codice
| Parte | File | Cosa fa |
|---|---|---|
| Parser | `js/parser/` | Capisce le frasi dettate (funzione pura, senza interfaccia) |
| Dati | `js/db.js` | Database locale IndexedDB, backup |
| Numeri | `js/stats.js` | Campanelli, appuntamenti, ripassi, assenti |
| Agenda | `js/agenda.js` | Voci per giorno, da fissare, sovrapposizioni |
| Segnalazioni | `js/segnalazioni.js` | Frasi corrette da Dani e messaggio per Simona |
| Interfaccia | `js/app.js`, `css/app.css`, `index.html` | Schermate |
| Offline | `sw.js`, `manifest.webmanifest` | App installabile e senza internet |

## Test (obbligatori a ogni modifica — vedi `CLAUDE.md`)
```
npm run test:tutto      # tutto: controlli delle singole parti + prove nel browser
npm test                # solo controlli delle singole parti (parser, numeri, agenda…)
npm run test:browser    # solo prove sul telefono simulato (serve: pip install playwright)
```
I test usano le frasi reali dettate da Dani (`tests/parser.test.mjs`). Ogni frase che il parser sbaglia diventa un test con il testo originale.

Quando si pubblica una nuova versione, aggiornare `VERSIONE` in `sw.js`.
