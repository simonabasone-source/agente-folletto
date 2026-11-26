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

export function normalizza(testo, correzioni = []) {
  let t = ` ${testo} `;
  t = t.replace(/[’`]/g, "'");
  // punteggiatura dettata come parola
  t = t.replace(/\s+virgola\b/gi, ',');
  t = t.replace(/\s+punto e virgola\b/gi, ';');
  t = t.replace(/\s+punto\s*(?=$|\s)/gi, '. ');
  // modelli Folletto: "vk 135", "VK-135" -> "VK135"
  t = t.replace(/\bvk\s*-?\s*(\d{2,4})\b/gi, 'VK$1');
  t = t.replace(/[ \t]+/g, ' ').trim();
  return applicaCorrezioni(t, correzioni);
}
