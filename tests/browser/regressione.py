"""Prove di regressione nel browser, su un telefono simulato (393x850, touch).

Usa l'app come farebbe Dani: detta, conferma, corregge, apre le tendine, va in agenda,
manda le frasi, riapre senza internet. Ogni prova controlla un risultato preciso.

Uso:    python3 tests/browser/regressione.py
Serve:  pip install playwright  (e un Chrome/Chromium; prova prima Chrome di sistema)
Esce con codice 1 se una prova fallisce.
"""
import asyncio
import functools
import http.server
import socket
import sys
import threading
from pathlib import Path

from playwright.async_api import async_playwright

RADICE = Path(__file__).resolve().parents[2]
RISULTATI = []


def avvia_server():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        porta = s.getsockname()[1]
    class Silenzioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Silenzioso, directory=str(RADICE))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', porta), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{porta}/'


def verifica(nome, condizione, dettaglio=''):
    RISULTATI.append((nome, bool(condizione), dettaglio))
    print(('  ok   ' if condizione else '  NO   ') + nome + ('' if condizione else f'  → {dettaglio}'))


async def detta(pg, frase, conferma=True):
    await pg.fill('#testo', frase)
    await pg.click('#invia')
    await pg.wait_for_timeout(250)
    aperta = await pg.is_visible('#s-conferma')
    if aperta and conferma:
        await pg.click('#s-conferma')
        await pg.wait_for_timeout(150)
    await pg.evaluate("document.querySelector('#toast').hidden = true")
    return aperta


async def riga(pg, testo):
    """Tocca la riga di un contatto nella lista di oggi (apre la sua tendina se serve)."""
    btn = pg.locator(f'#lista-oggi button[data-id]:has-text("{testo}")').first
    if not await btn.is_visible():
        dettagli = pg.locator('#lista-oggi details.via', has=pg.locator(f'button[data-id]:has-text("{testo}")'))
        await dettagli.locator('summary').click()
        await pg.wait_for_timeout(150)
    await btn.click()
    await pg.wait_for_timeout(200)


async def lancia_browser(p):
    try:
        return await p.chromium.launch(channel='chrome')
    except Exception:
        return await p.chromium.launch()


async def main():
    srv, url = avvia_server()
    errori = []
    async with async_playwright() as p:
        b = await lancia_browser(p)
        ctx = await b.new_context(viewport={'width': 393, 'height': 850}, is_mobile=True, has_touch=True, locale='it-IT')
        await ctx.add_init_script("window.__condiviso = null; navigator.share = async (d) => { window.__condiviso = d.text; };")
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errori.append(str(e)))
        pg.on('console', lambda m: errori.append(m.text) if m.type == 'error' else None)
        await pg.goto(url)
        await pg.wait_for_selector('#testo')

        print('Giro e posizione')
        await detta(pg, 'Adesso Carpaneto via Alfieri')
        verifica('la barra mostra paese e via', 'Via Alfieri · Carpaneto' in await pg.inner_text('#pos'))

        print('Civico + cognome, salvataggio automatico')
        aperta = await detta(pg, 'Civico 3 Verdi assente')
        verifica('assente salvato senza scheda', not aperta)
        verifica('il cognome è il nome, il civico è a sinistra', 'Verdi' in await pg.inner_text('#lista-oggi'))

        print('Scheda di conferma, sovrapposizione')
        await detta(pg, 'Civico 7 Neri appuntamento domani alle 17')
        await pg.fill('#testo', 'Civico 9 Gialli appuntamento domani alle 17 e 30')
        await pg.click('#invia'); await pg.wait_for_timeout(250)
        avvisi = await pg.inner_text('#s-avvisi')
        verifica('avviso di sovrapposizione', 'Hai già Neri alle 17:00' in avvisi, avvisi)
        verifica('giorno e ora per esteso', '17:30' in await pg.inner_text('#s-quando'))
        await pg.click('#s-conferma'); await pg.wait_for_timeout(150)

        print('Giorno della settimana incoerente')
        await pg.fill('#testo', 'Civico 15 Blu appuntamento martedì 4 dicembre ore 15:30')
        await pg.click('#invia'); await pg.wait_for_timeout(250)
        avvisi = await pg.inner_text('#s-avvisi')
        verifica('avviso "martedì ma è …"', 'Hai detto martedì' in avvisi, avvisi)
        await pg.click('#s-conferma'); await pg.wait_for_timeout(150)

        print('Cognome spezzato imparato')
        await pg.fill('#testo', 'Civico 20 Con tardi appuntamento lunedì alle 10')
        await pg.click('#invia'); await pg.wait_for_timeout(250)
        await pg.fill('#s-nome', 'Contardi'); await pg.click('#s-conferma'); await pg.wait_for_timeout(150)
        await pg.fill('#testo', 'Con tardi ripassare domani alle 19')
        await pg.click('#invia'); await pg.wait_for_timeout(250)
        verifica('la seconda volta scrive Contardi', await pg.input_value('#s-nome') == 'Contardi')
        await pg.click('#s-conferma'); await pg.wait_for_timeout(150)

        print('Condominio e numeri')
        await detta(pg, 'Adesso via Roma')
        await detta(pg, 'Civico 30 condominio 10 campanelli')
        await detta(pg, 'Rossi non interessato')
        await pg.click('#contatori'); await pg.wait_for_timeout(100)
        num = await pg.inner_text('#contatori')
        verifica('campanelli contati (6 case + 10 condominio)', num.split('\n')[0].strip() == '16', num)
        await pg.evaluate("document.querySelector('#toast').hidden = true")

        print('Tendine per via')
        tendine = await pg.locator('#lista-oggi details.via').count()
        verifica('una tendina per via (2)', tendine == 2, tendine)
        aperte = await pg.evaluate("[...document.querySelectorAll('#lista-oggi details.via')].map(d => d.querySelector('.via-nome').textContent.trim() + ':' + d.open)")
        verifica('la via corrente è aperta, le altre chiuse', aperte[0].startswith('Via Roma:true') and aperte[1].endswith(':false'), aperte)

        print('Colori delle righe per esito')
        colori = await pg.evaluate("""Object.fromEntries([...document.querySelectorAll('#lista-oggi li[class*="e-"]')]
            .map(li => [li.className.match(/e-(\\w+)/)[1], getComputedStyle(li).backgroundColor]))""")
        verifica('assente bianco', colori.get('assente') == 'rgb(255, 255, 255)', colori)
        verifica('ripassare azzurro chiaro', colori.get('ripassare') == 'rgb(219, 238, 252)', colori)
        verifica('non interessato grigio', colori.get('non_interessato') == 'rgb(227, 230, 229)', colori)

        print('Correggere una riga salvata da sola')
        await riga(pg, 'Verdi')
        verifica('la riga si apre al tocco', await pg.is_visible('#s-conferma'))
        await pg.click('#scheda .esiti button[data-esito=non_interessato]')
        await pg.click('#s-conferma'); await pg.wait_for_timeout(200)
        verifica('esito cambiato in lista', 'Non interessato' in await pg.inner_text('#lista-oggi'))

        print('Condominio dettato per sbaglio (caso di Dani 27/11)')
        await pg.click('#contatori'); await pg.wait_for_timeout(100)  # chiude il dettaglio numeri
        prima = int((await pg.inner_text('#contatori')).split('\n')[0])
        await detta(pg, 'Civico 40 condominio 12 campanelli')
        dopo = int((await pg.inner_text('#contatori')).split('\n')[0])
        verifica('il condominio aggiunge 12 campanelli', dopo == prima + 12, (prima, dopo))
        riga_condo = pg.locator('#lista-oggi button[data-condo]:has-text("12 campanelli")')
        verifica('il condominio compare nella tendina', await riga_condo.count() == 1)
        await riga_condo.click(); await pg.wait_for_timeout(150)
        await pg.fill('dialog.dialog-condo input[name=campanelli]', '6')
        await pg.click('dialog.dialog-condo button[value=salva]'); await pg.wait_for_timeout(250)
        verifica('campanelli corretti a 6', int((await pg.inner_text('#contatori')).split('\n')[0]) == prima + 6)
        await pg.locator('#lista-oggi button[data-condo]:has-text("6 campanelli")').click(); await pg.wait_for_timeout(150)
        await pg.click('#c-elimina'); await pg.click('#c-elimina'); await pg.wait_for_timeout(300)
        verifica('condominio eliminato, campanelli tornano come prima', int((await pg.inner_text('#contatori')).split('\n')[0]) == prima)
        verifica('la riga del condominio sparisce', await pg.locator('#lista-oggi button[data-condo]:has-text("Civico 40"), #lista-oggi button[data-condo]:has-text("6 campanelli")').count() == 0)
        await pg.evaluate("document.querySelector('#toast').hidden = true")

        print('Condomini in ordine (richiesta di Dani 27/11)')
        await detta(pg, 'Adesso via Verdi')
        for f in ['Civico 6A condominio 3 campanelli', 'Uno assente', 'Due non interessato',
                  'Civico 6B condominio 3 campanelli', 'Tre assente', 'Quattro assente']:
            await detta(pg, f)
        ordine = await pg.evaluate("""[...[...document.querySelectorAll('#lista-oggi details.via')].find(d => d.querySelector('.via-nome').textContent.trim().startsWith('Via Verdi')).querySelectorAll('li')]
            .map(li => li.classList.contains('condominio') ? '[' + li.querySelector('.ora').textContent.trim() + ']' : li.querySelector('.nome').textContent.trim())""")
        verifica('ultimo in alto: 6B con i suoi (ultimo prima), poi 6A con i suoi', ordine == ['[6B]', 'Quattro', 'Tre', '[6A]', 'Due', 'Uno'], ordine)
        await detta(pg, 'Adesso via Gialla')
        for f in ['Civico 9 Primo assente', 'Civico 2 Secondo assente', 'Civico 5 Terzo non interessato']:
            await detta(pg, f)
        case = await pg.evaluate("""[...[...document.querySelectorAll('#lista-oggi details.via')].find(d => d.querySelector('.via-nome').textContent.trim().startsWith('Via Gialla')).querySelectorAll('li .nome')].map(n => n.textContent.trim())""")
        verifica('case singole: l\'ultimo suonato in alto, il primo in fondo', case == ['Terzo', 'Secondo', 'Primo'], case)
        await pg.click('#lista-oggi details.via:has(.via-nome:text-is("Via Verdi")) summary'); await pg.wait_for_timeout(100)
        rientro = await pg.locator('#lista-oggi details.via:has(.via-nome:text-is("Via Verdi")) li.in-condominio').count()
        verifica('i cognomi del condominio sono rientrati sotto di esso', rientro == 4, rientro)

        print('Numeri in lettere (caso di Dani 27/11)')
        prima = int((await pg.inner_text('#contatori')).split('\n')[0])
        aperta = await detta(pg, 'Civico tre condominio 12 Campanelli', conferma=False)
        verifica('"Civico tre condominio 12 Campanelli" crea il condominio, senza scheda', not aperta)
        verifica('i campanelli salgono di 12', int((await pg.inner_text('#contatori')).split('\n')[0]) == prima + 12)
        verifica('la barra mostra il condominio civico 3', 'condominio civico 3 (12 campanelli)' in await pg.inner_text('#pos'))

        print('Condominio detto senza civico (caso di Dani 27/11)')
        await detta(pg, 'Civico 7')
        prima = int((await pg.inner_text('#contatori')).split('\n')[0])
        aperta = await detta(pg, 'Condominio 10 campanelli', conferma=False)
        verifica('"Condominio 10 campanelli" dopo "Civico 7": condominio, senza scheda', not aperta)
        verifica('i campanelli salgono di 10', int((await pg.inner_text('#contatori')).split('\n')[0]) == prima + 10)
        verifica('la barra mostra il condominio civico 7', 'condominio civico 7 (10 campanelli)' in await pg.inner_text('#pos'))

        print('Agenda')
        await pg.click('#nav button[data-vista=agenda]'); await pg.wait_for_timeout(200)
        ag = await pg.inner_text('#app')
        verifica('agenda con Neri, Gialli, Contardi', all(n in ag for n in ['Neri', 'Gialli', 'Contardi']), ag[:300])

        print('Frasi da mandare a Simona')
        await pg.click('#nav button[data-vista=menu]'); await pg.wait_for_timeout(200)
        etichetta = await pg.inner_text('#m-segnala')
        verifica('contata solo Contardi: Verdi da assente a non interessato è un aggiornamento di Dani, non un errore', '(1)' in etichetta, etichetta)
        await pg.click('#m-segnala'); await pg.wait_for_timeout(300)
        testo = await pg.evaluate('window.__condiviso') or ''
        verifica('messaggio con frase originale e correzione', 'Dani: Contardi' in testo and '«' in testo, testo)
        verifica('Verdi (assente → non interessato) non è nel messaggio', 'Verdi' not in testo, testo)
        verifica('elenco svuotato dopo l\'invio', '(0)' in await pg.inner_text('#m-segnala'))
        verifica('compare il tasto per rimettere in elenco le frasi già mandate', '(1)' in await pg.inner_text('#m-rimetti'))
        await pg.click('#m-rimetti'); await pg.wait_for_timeout(300)
        verifica('le frasi già mandate tornano in elenco (caso 27/11: perse 49 frasi)', '(1)' in await pg.inner_text('#m-segnala'))
        await pg.click('#m-segnala'); await pg.wait_for_timeout(300)
        verifica('rimandate: elenco di nuovo vuoto', '(0)' in await pg.inner_text('#m-segnala'))

        print('Correggere una riga in fondo alla lista: si resta lì (caso di Dani 27/11)')
        await pg.click('#nav button[data-vista=giro]'); await pg.wait_for_timeout(150)
        await detta(pg, 'Adesso via Lunga')
        for i in range(1, 16):
            await detta(pg, f'Civico {i} Cognome{i} assente')
        await pg.evaluate("document.querySelector('#testo').blur()")
        # scorre in basso nella lista e tocca la riga che si trova in mezzo allo schermo
        await pg.evaluate('window.scrollTo(0, 1400)'); await pg.wait_for_timeout(200)
        prima_scroll = await pg.evaluate('window.scrollY')
        info = await pg.evaluate('[document.scrollingElement.scrollHeight, innerHeight]')
        # tocca (come un dito) la prima riga ben visibile a metà schermo
        punto = await pg.evaluate("""(() => { const b = [...document.querySelectorAll('#lista-oggi button[data-id]')]
            .find(b => { const r = b.getBoundingClientRect(); return r.height > 0 && r.top > 250 && r.bottom < innerHeight - 150; });
            const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()""")
        await pg.mouse.click(punto[0], punto[1]); await pg.wait_for_timeout(250)
        await pg.click('#scheda .esiti button[data-esito=non_interessato]')
        await pg.click('#s-conferma'); await pg.wait_for_timeout(300)
        dopo_scroll = await pg.evaluate('window.scrollY')
        verifica('dopo Conferma resta nello stesso punto della lista', prima_scroll > 300 and abs(dopo_scroll - prima_scroll) < 40, (prima_scroll, dopo_scroll, info))
        verifica('dopo Conferma la tastiera non si apre', await pg.evaluate("document.activeElement?.id") != 'testo')
        aperta = await detta(pg, 'Civico 16 Ultimo appuntamento domani alle 9', conferma=False)
        await pg.click('#s-conferma'); await pg.wait_for_timeout(200)
        verifica('dopo una dettatura invece si torna pronti a dettare', aperta and await pg.evaluate("document.activeElement?.id") == 'testo')

        print('Cognomi in più parti: niente conferma (Dani 27/11)')
        await pg.click('#nav button[data-vista=giro]'); await pg.wait_for_timeout(150)
        await detta(pg, 'Adesso via Mazzini')
        aperta = await detta(pg, 'Civico 4 Boselli terret assente', conferma=False)
        verifica('«Civico 4 Boselli terret assente» salvato senza scheda', not aperta)

        print('Aggiornare a voce: cognome + civico (Dani 27/11)')
        conta = lambda nome: pg.evaluate(f"window.__folletto.stato.contatti.filter(c => c.identificativo === '{nome}').length")
        esito = lambda nome, civ: pg.evaluate(f"window.__folletto.stato.contatti.find(c => c.identificativo === '{nome}' && c.civico === '{civ}')?.esito")
        await detta(pg, 'Civico 31 Bisotti assente')
        aperta = await detta(pg, 'Civico 31 Bisotti non interessato', conferma=False)
        verifica('assente → non interessato a voce: senza scheda', not aperta)
        verifica('nessun doppione: un solo Bisotti', await conta('Bisotti') == 1, await conta('Bisotti'))
        verifica('Bisotti ora è non interessato', await esito('Bisotti', '31') == 'non_interessato')
        aperta = await detta(pg, 'Civico 31 Bisotti appuntamento domani alle 10', conferma=False)
        verifica('appuntamento a voce: scheda di conferma come sempre', aperta)
        await pg.click('#s-conferma'); await pg.wait_for_timeout(200)
        verifica('ancora un solo Bisotti, ora appuntamento', await conta('Bisotti') == 1 and await esito('Bisotti', '31') == 'appuntamento')
        await pg.click('#nav button[data-vista=agenda]'); await pg.wait_for_timeout(200)
        verifica('Bisotti compare in agenda', 'Bisotti' in await pg.inner_text('#app'))
        await pg.click('#nav button[data-vista=giro]'); await pg.wait_for_timeout(150)
        await detta(pg, 'Civico 33 Bisotti assente')
        verifica('stesso cognome a un altro civico: contatto nuovo', await conta('Bisotti') == 2 and await esito('Bisotti', '31') == 'appuntamento')
        # Annulla dopo un aggiornamento: si torna a com'era
        await pg.fill('#testo', 'Civico 33 Bisotti non interessato'); await pg.click('#invia'); await pg.wait_for_timeout(250)
        await pg.click('#toast button'); await pg.wait_for_timeout(250)
        verifica('Annulla dopo un aggiornamento: Bisotti 33 torna assente, nessuno sparisce', await esito('Bisotti', '33') == 'assente' and await conta('Bisotti') == 2)
        # due contatti uguali (stesso cognome e civico): l'app chiede quale
        await detta(pg, 'Civico 40 Gallo assente')
        await pg.evaluate("(() => { const st = window.__folletto.stato; const g = st.contatti.find(c => c.identificativo === 'Gallo'); st.contatti.push({ ...structuredClone(g), id: 'gallo-2', creato: new Date(Date.now() + 1000).toISOString() }); })()")
        await pg.fill('#testo', 'Civico 40 Gallo non interessato'); await pg.click('#invia'); await pg.wait_for_timeout(250)
        verifica('due Gallo al civico 40: l\'app chiede quale', await pg.is_visible('#scegli-contatto'))
        await pg.click('#scegli-contatto button[value="1"]'); await pg.wait_for_timeout(250)
        gallo = await pg.evaluate("window.__folletto.stato.contatti.filter(c => c.identificativo === 'Gallo').map(c => c.id + ':' + c.esito).sort()")
        verifica('aggiornato solo quello scelto', len(gallo) == 2 and 'gallo-2:non_interessato' in gallo and sum(':assente' in g for g in gallo) == 1, gallo)
        await pg.fill('#testo', 'Civico 40 Gallo ripassare domani'); await pg.click('#invia'); await pg.wait_for_timeout(250)
        await pg.click('#scegli-contatto button[value="nuovo"]'); await pg.wait_for_timeout(250)
        if await pg.is_visible('#s-conferma'):
            await pg.click('#s-conferma'); await pg.wait_for_timeout(150)
        verifica('"È un altro": contatto nuovo', await conta('Gallo') == 3, await conta('Gallo'))
        await pg.evaluate("document.querySelector('#toast').hidden = true")

        print('Tante frasi: si mandano in più parti (caso di Dani 27/11: 79 frasi, arrivate 30)')
        await pg.evaluate("""(() => { const st = window.__folletto.stato; st.contatti.forEach((c) => {
            c.testoOriginale = (c.testoOriginale || 'frase') + ' ' + 'x'.repeat(60);
            c.letto = { identificativo: c.identificativo + ' x', esito: c.esito }; c.segnalazione = { campi: ['cognome'], inviata: false }; }); })()""")
        await pg.click('#nav button[data-vista=menu]'); await pg.wait_for_timeout(200)
        n_frasi = int((await pg.inner_text('#m-segnala')).split('(')[1].split(')')[0])
        await pg.click('#m-segnala'); await pg.wait_for_timeout(300)
        tasti = pg.locator('#m-segnala-dopo button[data-parte]')
        n_parti = await tasti.count()
        verifica(f'{n_frasi} frasi lunghe → più parti', n_frasi >= 20 and n_parti >= 2, (n_frasi, n_parti))
        lunghezze, numeri = [], []
        for k in range(n_parti):
            await tasti.nth(k).click(); await pg.wait_for_timeout(250)
            t = await pg.evaluate('window.__condiviso') or ''
            lunghezze.append(len(t))
            numeri += [int(r.split(')')[0]) for r in t.split('\n') if r[:1].isdigit() and ') «' in r]
        verifica('ogni parte sotto i 3000 caratteri', all(l <= 3000 for l in lunghezze), lunghezze)
        verifica('nessuna frase persa né doppia, numerazione continua', numeri == list(range(1, n_frasi + 1)), numeri)
        verifica('titolo con "parte 1 di N"', f'parte {n_parti} di {n_parti}' in t, t[:80])
        verifica('dopo l\'ultima parte l\'elenco è vuoto', '(0)' in await pg.inner_text('#m-segnala'))
        await pg.wait_for_timeout(1700)

        print('Giorni precedenti (Dani 28/11: rivedere gli assenti di ieri)')
        await pg.click('#nav button[data-vista=giro]'); await pg.wait_for_timeout(200)
        verifica('solo dati di oggi: nessun tasto dei giorni', (await pg.inner_text('#giorni')).strip() == '')
        await pg.evaluate("""(() => { const st = window.__folletto.stato;
            const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
            const giorno = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
            const base = { comune: 'Carpaneto', via: 'Via Ieri', esito: 'assente', confermato: true, note: '', avvisi: [] };
            st.contatti.push({ ...base, id: 'ieri-1', giorno: giorno(1), creato: d(1) + 'T09:00:00.000Z', civico: '5', identificativo: 'Ieriassente', testoOriginale: 'Civico 5 Ieriassente assente' });
            st.contatti.push({ ...base, id: 'ieri-2', giorno: giorno(1), creato: d(1) + 'T09:05:00.000Z', civico: '7', identificativo: 'Ieriappunt', esito: 'non_interessato', testoOriginale: 'x' });
            st.contatti.push({ ...base, id: 'vecchio', giorno: giorno(3), creato: d(3) + 'T09:00:00.000Z', civico: '9', identificativo: 'Treggiorni', testoOriginale: 'x' });
        })()""")
        await pg.click('#nav button[data-vista=agenda]'); await pg.wait_for_timeout(100)
        await pg.click('#nav button[data-vista=giro]'); await pg.wait_for_timeout(200)
        tasti = await pg.inner_text('#giorni')
        verifica('tasti Oggi, Ieri e un giorno di 3 giorni fa', tasti.startswith('Oggi') and 'Ieri' in tasti and len(await pg.locator('#giorni button').all()) == 3, tasti)
        verifica('oggi non mostra i contatti di ieri', 'Ieriassente' not in await pg.text_content('#lista-oggi'))
        await pg.click('#giorni button:has-text("Ieri")'); await pg.wait_for_timeout(200)
        lista = await pg.text_content('#lista-oggi')
        verifica('tocco su Ieri: la lista mostra i citofoni di ieri', 'Ieriassente' in lista and 'Ieriappunt' in lista and 'Treggiorni' not in lista, lista[:200])
        verifica('il titolo dice Ieri', (await pg.text_content('#titolo-lista')).startswith('Ieri'))
        verifica('i numeri sono quelli di ieri (1 non interessato)', (await pg.inner_text('#contatori')).split('\n')[6] == '1', await pg.inner_text('#contatori'))
        await pg.click('#lista-oggi details.via:has(.via-nome:text-is("Via Ieri")) summary') if not await pg.is_visible('#lista-oggi button[data-id="ieri-1"]') else None
        await pg.click('#lista-oggi button[data-id="ieri-1"]'); await pg.wait_for_timeout(200)
        verifica('una riga di ieri si apre e si può correggere', await pg.is_visible('#s-conferma'))
        await pg.click('#scheda .esiti button[data-esito=non_interessato]'); await pg.click('#s-conferma'); await pg.wait_for_timeout(200)
        verifica('dopo la correzione si resta su ieri', (await pg.text_content('#titolo-lista')).startswith('Ieri'))
        await pg.click('#giorni button:nth-child(3)'); await pg.wait_for_timeout(200)
        verifica('tre giorni fa: Treggiorni', 'Treggiorni' in await pg.text_content('#lista-oggi'))
        await detta(pg, 'Civico 50 Nuovodioggi assente')
        verifica('dettando si torna a oggi e il contatto è di oggi', (await pg.text_content('#titolo-lista')) == 'Oggi' and 'Nuovodioggi' in await pg.text_content('#lista-oggi'))

        print('Campanella delle notifiche')
        await pg.click('#nav button[data-vista=giro]'); await pg.wait_for_timeout(150)
        pallino = await pg.locator('#campanella .pallino').count()
        verifica('al primo avvio la campanella ha le novità', pallino == 1)
        await pg.click('#campanella'); await pg.wait_for_timeout(150)
        pannello = await pg.inner_text('#pannello-notifiche')
        verifica('il pannello mostra le novità', 'Novità della versione' in pannello, pannello[:200])
        await pg.click('#n-chiudi'); await pg.wait_for_timeout(150)
        verifica('dopo la lettura il pallino sparisce', await pg.locator('#campanella .pallino').count() == 0)
        await pg.evaluate('window.__folletto.segnalaAggiornamento()'); await pg.wait_for_timeout(200)
        verifica('nuova versione: pallino e campanella gialla', await pg.locator('#campanella.pronta .pallino').count() == 1)
        await pg.fill('#testo', 'Civico 99 Prova appuntamento')
        await pg.click('#campanella'); await pg.wait_for_timeout(150)
        await pg.click('#n-aggiorna'); await pg.wait_for_selector('#testo'); await pg.wait_for_timeout(400)
        verifica('Aggiorna conserva il testo dettato', await pg.input_value('#testo') == 'Civico 99 Prova appuntamento')
        verifica('dopo l\'aggiornamento la notifica sparisce', await pg.locator('#campanella.pronta').count() == 0)
        await pg.fill('#testo', '')

        print('Senza internet')
        await pg.wait_for_function('navigator.serviceWorker.controller !== null', timeout=10000)
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_selector('#testo', timeout=8000)
        # textContent: legge anche le tendine chiuse (la via aperta ora è Via Verdi)
        verifica('si riapre offline con i dati', 'Rossi' in await pg.evaluate("document.querySelector('#lista-oggi').textContent"))
        await ctx.set_offline(False)

        verifica('nessun errore JavaScript', not errori, errori)
        await b.close()
    srv.shutdown()

    falliti = [r for r in RISULTATI if not r[1]]
    print(f'\n{len(RISULTATI) - len(falliti)}/{len(RISULTATI)} prove superate')
    sys.exit(1 if falliti else 0)


if __name__ == '__main__':
    asyncio.run(main())
