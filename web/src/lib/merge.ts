/** Last-write-wins on `updatedAt` (server-assigned, monotonic). Because
 * there's exactly one user and each stack syncs as a whole blob, "whichever
 * write reached the server last wins outright" is correct here, not just a
 * convenient simplification — same reasoning as WeightWatcher's merge.
 * Field-level merging of concurrent edits to the SAME stack from two
 * devices is deliberately out of scope for Step 2 (see the Step 2 vs 3
 * planning conversation) and would be Step 3's job if it's ever needed. */
export function mergeIncoming<T extends { updatedAt?: number }>(local: T | undefined, incoming: T): T {
  if (!local) return incoming;

  const localUpdatedAt = local.updatedAt ?? -1;
  const incomingUpdatedAt = incoming.updatedAt ?? -1;

  if (incomingUpdatedAt <= localUpdatedAt) return local;
  return incoming;
}

/** Applies a batch of incoming (server) records onto the local mirror,
 * keyed by id, returning the merged array. Pure — callers persist. */
export function applyIncoming<T extends { id: string; updatedAt?: number }>(local: T[], incoming: T[]): T[] {
  const byId = new Map(local.map((e) => [e.id, e]));
  for (const entry of incoming) {
    byId.set(entry.id, mergeIncoming(byId.get(entry.id), entry));
  }
  return [...byId.values()];
}
