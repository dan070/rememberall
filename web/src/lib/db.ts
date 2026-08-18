import { openDB, type IDBPDatabase } from "idb";
import type { Stack } from "./types";

const DB_NAME = "rememberall";
const DB_VERSION = 1;
const STACKS_STORE = "stacks";
const META_STORE = "meta";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(STACKS_STORE, { keyPath: "id" });
          db.createObjectStore(META_STORE); // keyPath-less: get/put by explicit key
        }
      },
    });
  }
  return dbPromise;
}

// --- stacks ---

export async function putStack(stack: Stack): Promise<void> {
  const db = await getDb();
  await db.put(STACKS_STORE, stack);
}

export async function putStacks(stacks: Stack[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STACKS_STORE, "readwrite");
  await Promise.all(stacks.map((s) => tx.store.put(s)));
  await tx.done;
}

export async function getAllStacks(): Promise<Stack[]> {
  const db = await getDb();
  return db.getAll(STACKS_STORE);
}

// --- meta (active stack id, viewing-archive state) ---

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get(META_STORE, key);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put(META_STORE, value, key);
}
