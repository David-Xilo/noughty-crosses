// This device's game storage (GDD §8): IndexedDB on the web, and the same web storage in
// the desktop app. One key-value store holds the autosave and the progress. Writes run in
// order, so the last one wins. Without IndexedDB (blocked storage) nothing is kept past
// this visit.

const DB = "noughty-crosses";
const STORE = "kv";

let db: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  db ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return db;
}

function run<T>(mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (d) =>
      new Promise<T | undefined>((resolve) => {
        if (!d) return resolve(undefined);
        try {
          // Settled when the transaction commits, so a write is on disk before the app quits.
          const tx = d.transaction(STORE, mode);
          const req = act(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req.result);
          tx.onerror = tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

let writes: Promise<unknown> = Promise.resolve();
const queue = <T>(f: () => Promise<T>) => {
  const next = writes.then(f);
  writes = next;
  return next;
};

export const store = {
  get: (key: string): Promise<unknown> => queue(() => run("readonly", (s) => s.get(key))),
  put: (key: string, value: unknown) => queue(() => run("readwrite", (s) => s.put(value, key))),
  delete: (key: string) => queue(() => run("readwrite", (s) => s.delete(key))),
};
