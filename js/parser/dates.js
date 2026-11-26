// Utilità date: lavoriamo sempre con date "locali" come stringhe YYYY-MM-DD
// e ore come "HH:MM", per evitare problemi di fuso orario.

export const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const pad = (n) => String(n).padStart(2, '0');

export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function weekday(iso) {
  return fromIso(iso).getDay();
}

export function hhmm(h, m = 0) {
  return `${pad(h)}:${pad(m)}`;
}

// "VENERDÌ 4 DICEMBRE"
export function dataEstesa(iso) {
  if (!iso) return '';
  const d = fromIso(iso);
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

export function dataBreve(iso) {
  if (!iso) return '';
  const d = fromIso(iso);
  return `${GIORNI[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`;
}
