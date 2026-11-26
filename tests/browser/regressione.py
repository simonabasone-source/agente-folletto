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

        print('Correggere una riga salvata da sola')
        await riga(pg, 'Verdi')
        verifica('la riga si apre al tocco', await pg.is_visible('#s-conferma'))
        await pg.click('#scheda .esiti button[data-esito=non_interessato]')
        await pg.click('#s-conferma'); await pg.wait_for_timeout(200)
        verifica('esito cambiato in lista', 'Non interessato' in await pg.inner_text('#lista-oggi'))

        print('Agenda')
        await pg.click('#nav button[data-vista=agenda]'); await pg.wait_for_timeout(200)
        ag = await pg.inner_text('#app')
        verifica('agenda con Neri, Gialli, Contardi', all(n in ag for n in ['Neri', 'Gialli', 'Contardi']), ag[:300])

        print('Frasi da mandare a Simona')
        await pg.click('#nav button[data-vista=menu]'); await pg.wait_for_timeout(200)
        etichetta = await pg.inner_text('#m-segnala')
        verifica('contate le correzioni (Contardi, Verdi)', '(2)' in etichetta, etichetta)
        await pg.click('#m-segnala'); await pg.wait_for_timeout(300)
        testo = await pg.evaluate('window.__condiviso') or ''
        verifica('messaggio con frase originale e correzione', '«Civico 3 Verdi assente»' in testo and 'Dani: Verdi · non interessato' in testo, testo)
        verifica('elenco svuotato dopo l\'invio', '(0)' in await pg.inner_text('#m-segnala'))

        print('Senza internet')
        await pg.wait_for_function('navigator.serviceWorker.controller !== null', timeout=10000)
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_selector('#testo', timeout=8000)
        verifica('si riapre offline con i dati', 'Rossi' in await pg.inner_text('#lista-oggi'))
        await ctx.set_offline(False)

        verifica('nessun errore JavaScript', not errori, errori)
        await b.close()
    srv.shutdown()

    falliti = [r for r in RISULTATI if not r[1]]
    print(f'\n{len(RISULTATI) - len(falliti)}/{len(RISULTATI)} prove superate')
    sys.exit(1 if falliti else 0)


if __name__ == '__main__':
    asyncio.run(main())
