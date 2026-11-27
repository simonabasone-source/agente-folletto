// Pulizia del testo dettato prima dell'analisi.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function capitalizza(s) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && ['di', 'da', 'del', 'della', 'delle', 'dei', 'degli'].includes(lower)) return lower;
      if (i > 0 && /^d'\p{L}/u.test(lower)) return "d'" + lower.charAt(2).toUpperCase() + lower.slice(3);
      // gestisce apostrofi: "d'adda" -> "d'Adda"
      return lower.replace(/(^|['’-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ')
    .replace(/^(\p{L})/u, (c) => c.toUpperCase());
}

// correzioni: [{ da: 'con tardi', a: 'Contardi' }]
export function applicaCorrezioni(testo, correzioni = []) {
  let out = testo;
  // prima le correzioni più lunghe
  const ordinate = [...correzioni].sort((a, b) => b.da.length - a.da.length);
  for (const { da, a } of ordinate) {
    if (!da || !a) continue;
    const re = new RegExp(`(^|[^\\p{L}])${escapeRe(da)}(?=$|[^\\p{L}])`, 'giu');
    out = out.replace(re, (m, pre) => pre + a);
  }
  return out;
}

// ---------- numeri scritti in lettere dalla tastiera ("civico tre", "dodici campanelli", "alle sei") ----------
const UNITA = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci',
  'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const DECINE = { venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90 };

export const NUMERI_PAROLE = (() => {
  const m = new Map(UNITA.map((w, i) => [w, i]));
  m.set('un', 1); m.set('una', 1); m.set('tré', 3);
  for (const [d, v] of Object.entries(DECINE)) {
    m.set(d, v);
    for (let u = 1; u <= 9; u++) {
      const parola = UNITA[u];
      // ventuno, ventotto: la vocale finale cade davanti a "uno" e "otto"
      const base = (u === 1 || u === 8) ? d.slice(0, -1) : d;
      m.set(base + (u === 3 ? 'tré' : parola), v + u);
      if (u === 3) m.set(base + 'tre', v + 3);
    }
  }
  m.set('cento', 100);
  return m;
})();

const ALT_NUMERI = [...NUMERI_PAROLE.keys()].sort((a, b) => b.length - a.length).join('|');
const MESI_ALT = 'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre';
const B = '(?<![\\p{L}\\d])';
const E = '(?![\\p{L}\\d])';
// solo dove un numero è sicuro: dopo civico/numero/interno/alle/ore, prima di campanelli o di un mese
const RE_DOPO = new RegExp(`${B}(civico|numero|interno|alle|ore|dalle|per le|verso le|dopo le|prima delle)\\s+(${ALT_NUMERI})${E}`, 'giu');
const RE_PRIMA = new RegExp(`${B}(${ALT_NUMERI})(\\s+(?:campanell[io]|appartament[io]|interni|famiglie|${MESI_ALT}))${E}`, 'giu');

export function numeriInCifre(t) {
  const n = (w) => NUMERI_PAROLE.get(w.toLowerCase());
  return t
    .replace(RE_DOPO, (m, pre, w) => (n(w) === undefined ? m : `${pre} ${n(w)}`))
    .replace(RE_PRIMA, (m, w, dopo) => (n(w) === undefined ? m : `${n(w)}${dopo}`));
}

export function normalizza(testo, correzioni = []) {
  let t = ` ${testo} `;
  t = t.replace(/[’`]/g, "'");
  // punteggiatura dettata come parola
  t = t.replace(/\s+virgola\b/gi, ',');
  t = t.replace(/\s+punto e virgola\b/gi, ';');
  t = t.replace(/\s+punto\s*(?=$|\s)/gi, '. ');
  // modelli Folletto: "vk 135", "VK-135" -> "VK135"
  t = t.replace(/\bvk\s*-?\s*(\d{2,4})\b/gi, 'VK$1');
  t = numeriInCifre(t);
  t = t.replace(/[ \t]+/g, ' ').trim();
  return applicaCorrezioni(t, correzioni);
}
