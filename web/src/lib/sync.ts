import { ApiError, createApiClient, type ApiClient } from "./api";
import { deleteOp, getAllOps, getAllStacks, getMeta, putOp, putStacks, setMeta } from "./db";
import { afterFailure, collapseByStack, dueOps } from "./outbox";
import { applyIncoming } from "./merge";
import type { Stack } from "./types";

const CURSOR_KEY = "syncCursor";
const TOKEN_KEY = "authToken";

export async function getAuthToken(): Promise<string | undefined> {
  return getMeta<string>(TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await setMeta(TOKEN_KEY, token);
}

let clientCache: { baseUrl: string; token: string; client: ApiClient } | null = null;

function getClient(baseUrl: string, token: string): ApiClient {
  if (clientCache?.baseUrl === baseUrl && clientCache.token === token) {
    return clientCache.client;
  }
  const client = createApiClient(baseUrl, token);
  clientCache = { baseUrl, token, client };
  return client;
}

/** Sends every due outbox op. Never throws on individual op failure — a
 * failing op is rescheduled with backoff and the flush continues with the
 * rest, so one bad op can't block the whole queue.
 *
 * Ops are collapsed per-stack before sending (see outbox.ts's
 * collapseByStack) so three quick edits to the same stack made while
 * offline become one upload of the latest snapshot, not three. */
export async function flushOutbox(baseUrl: string, token: string, now: number = Date.now()): Promise<{ sent: number; failed: number }> {
  const allOps = await getAllOps();
  const due = dueOps(allOps, now);
  const ops = collapseByStack(due);
  const client = getClient(baseUrl, token);

  // Ops superseded by collapseByStack are settled (removed from the
  // queue) without being sent — the op that replaced them already carries
  // every change theirs would have.
  const dueIds = new Set(due.map((op) => op.opId));
  const keptIds = new Set(ops.map((op) => op.opId));
  for (const id of dueIds) {
    if (!keptIds.has(id)) await deleteOp(id);
  }

  let sent = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      await client.putStack(op.payload);
      await deleteOp(op.opId);
      sent++;
    } catch (err) {
      // 4xx (bad token, malformed payload) won't succeed on retry either,
      // but we still back off rather than drop it — a bad token can be
      // fixed by the user, and the invariant is ops are never silently
      // dropped.
      if (err instanceof ApiError) {
        console.error(`outbox op ${op.opId} failed with ${err.status}`, err.body);
      } else {
        console.error(`outbox op ${op.opId} failed`, err);
      }
      await putOp(afterFailure(op, now));
      failed++;
    }
  }

  return { sent, failed };
}

/** Pulls everything newer than the stored cursor and merges it into the
 * local mirror. */
export async function pullSync(baseUrl: string, token: string): Promise<Stack[]> {
  const client = getClient(baseUrl, token);
  const cursor = (await getMeta<string>(CURSOR_KEY)) ?? "0";
  const result = await client.sync(cursor);

  if (result.items.length > 0) {
    // applyIncoming needs the full local set to merge correctly — for this
    // app's scale (single user, a handful of stacks) re-reading and
    // re-writing the whole mirror per sync is simpler than a partial-merge
    // API and cheap enough not to matter.
    const local = await getAllStacks();
    const merged = applyIncoming(local, result.items);
    await putStacks(merged);
  }

  // Set the cursor after the merge completes, not before — if the merge
  // throws partway, the next sync retries from the same cursor rather than
  // skipping the items that failed to persist.
  await setMeta(CURSOR_KEY, result.cursor);
  return result.items;
}

export async function runSync(baseUrl: string, token: string): Promise<void> {
  await flushOutbox(baseUrl, token);
  await pullSync(baseUrl, token);
}
