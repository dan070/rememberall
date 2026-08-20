import { openDB, type IDBPDatabase } from "idb";
import type { OutboxOp } from "./outbox";
import type { Stack } from "./types";

const DB_NAME = "rememberall";
const DB_VERSION = 2;
const STACKS_STORE = "stacks";
const META_STORE = "meta";
const OUTBOX_STORE = "outbox";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(STACKS_STORE, { keyPath: "id" });
          db.createObjectStore(META_STORE); // keyPath-less: get/put by explicit key
        }
        if (oldVersion < 2) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: "opId" });
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

// --- outbox ---

export async function enqueueOp(op: OutboxOp): Promise<void> {
  const db = await getDb();
  await db.put(OUTBOX_STORE, op);
}

export async function putOp(op: OutboxOp): Promise<void> {
  const db = await getDb();
  await db.put(OUTBOX_STORE, op);
}

export async function deleteOp(opId: string): Promise<void> {
  const db = await getDb();
  await db.delete(OUTBOX_STORE, opId);
}

export async function getAllOps(): Promise<OutboxOp[]> {
  const db = await getDb();
  return db.getAll(OUTBOX_STORE);
}

// --- full reset ---

/** Wipes every local store (stacks, meta, outbox) — used by the "Reset
 * local data" action to recover from a device whose local mirror is stuck
 * or suspected stale, without needing dev-tools access to clear site
 * data manually. Does not touch the server; a fresh sync afterwards
 * repopulates from there. */
export async function clearAllLocalData(): Promise<void> {
  const db = await getDb();
  await Promise.all([db.clear(STACKS_STORE), db.clear(META_STORE), db.clear(OUTBOX_STORE)]);
}
