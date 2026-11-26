// Database locale (IndexedDB). Tutto resta sul telefono.

const NOME = 'agente-folletto';
const VERSIONE = 1;
let dbp = null;

function apri() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME, VERSIONE);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('contatti')) db.createObjectStore('contatti', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('posizioni')) db.createObjectStore('posizioni', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('correzioni')) db.createObjectStore('correzioni', { keyPath: 'da' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function op(store, modo, fn) {
  return apri().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, modo);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(r?.result);
    tx.onerror = () => reject(tx.error);
  }));
}

export const tutti = (store) => op(store, 'readonly', (s) => s.getAll());
export const metti = (store, obj) => op(store, 'readwrite', (s) => s.put(obj));
export const togli = (store, id) => op(store, 'readwrite', (s) => s.delete(id));

export async function leggiMeta(k, def = null) {
  const r = await op('meta', 'readonly', (s) => s.get(k));
  return r ? r.v : def;
}
export const scriviMeta = (k, v) => metti('meta', { k, v });

export function nuovoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function esporta() {
  return {
    app: 'agente-folletto',
    versione: VERSIONE,
    esportato: new Date().toISOString(),
    contatti: await tutti('contatti'),
    posizioni: await tutti('posizioni'),
    correzioni: await tutti('correzioni'),
    meta: await tutti('meta'),
  };
}

export async function importa(dati) {
  if (dati?.app !== 'agente-folletto') throw new Error('Questo file non è un backup di Agente Folletto.');
  for (const store of ['contatti', 'posizioni', 'correzioni', 'meta']) {
    for (const r of dati[store] ?? []) await metti(store, r);
  }
}

export async function proteggiArchivio() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
