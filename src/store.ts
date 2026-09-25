/* Storage abstraction: async key-value note store with two
 * implementations — IndexedDB (browser) and in-memory (tests/fallback).
 * Both share one interface so the UI and tests use identical code. */

import type { Note } from "./core.ts";

export interface NoteStore {
  getAll(): Promise<Note[]>;
  put(note: Note): Promise<void>;
  delete(id: string): Promise<void>;
}

/** In-memory implementation (tests and no-IDB fallback). */
export function memoryStore(initial: Note[] = []): NoteStore & { data: Note[] } {
  const map = new Map<string, Note>();
  for (const note of initial) map.set(note.id, note);
  return {
    data: initial,
    async getAll() {
      return [...map.values()];
    },
    async put(note) {
      map.set(note.id, note);
    },
    async delete(id) {
      map.delete(id);
    },
  };
}

const DB_NAME = "offline-notes";
const STORE = "notes";

/** IndexedDB implementation with a promise wrapper. */
export function idbStore(): Promise<NoteStore> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("idb open failed"));
    request.onsuccess = () => {
      const db = request.result;
      const run = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> =>
        new Promise((res, rej) => {
          const tx = db.transaction(STORE, mode);
          const store = tx.objectStore(STORE);
          const req = fn(store);
          req.onsuccess = () => res(req.result as T);
          req.onerror = () => rej(req.error ?? new Error("idb request failed"));
        });
      resolve({
        async getAll() {
          return run<Note[]>("readonly", (store) => store.getAll());
        },
        async put(note: Note) {
          await run("readwrite", (store) => store.put(note));
        },
        async delete(id: string) {
          await run("readwrite", (store) => store.delete(id));
        },
      });
    };
  });
}

/** Pick the best available store. */
export async function openStore(): Promise<NoteStore> {
  if (typeof indexedDB !== "undefined") {
    try {
      return await idbStore();
    } catch {
      /* fall through to memory */
    }
  }
  return memoryStore();
}
