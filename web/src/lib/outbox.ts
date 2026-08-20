import type { Stack } from "./types";

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 5 * 60 * 1000;

/** A whole-stack upsert. There's no delete/create distinction and no
 * item-level ops — see api/src/types.ts's Stack doc comment for why Step
 * 2 syncs entire stacks as one blob rather than per-theme/item rows. */
export interface PutStackOp {
  opId: string;
  kind: "putStack";
  stackId: string;
  /** The full stack payload to send, as of enqueue time. */
  payload: Stack;
  attempts: number;
  nextAttemptAt: number;
}

export type OutboxOp = PutStackOp;

export function makePutStackOp(stack: Stack, opId: string, now: number): PutStackOp {
  return {
    opId,
    kind: "putStack",
    stackId: stack.id,
    payload: stack,
    attempts: 0,
    nextAttemptAt: now,
  };
}

/** Ops whose retry time has arrived, oldest first. Pure — no I/O, no clock
 * reads beyond the `now` passed in, so this is trivially testable. */
export function dueOps(ops: OutboxOp[], now: number): OutboxOp[] {
  return ops.filter((op) => op.nextAttemptAt <= now).sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);
}

/** Exponential backoff, capped, jitter-free (deterministic — easier to
 * reason about and test; jitter doesn't matter for a single-user client). */
export function nextBackoff(attempts: number, now: number): number {
  const delay = Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
  return now + delay;
}

/** Op after a failed send: attempts incremented, next retry scheduled. Pure
 * — the caller persists the result. */
export function afterFailure(op: OutboxOp, now: number): OutboxOp {
  const attempts = op.attempts + 1;
  return { ...op, attempts, nextAttemptAt: nextBackoff(attempts, now) };
}

/** Collapses same-stack ops so only the LATEST edit to a given stack is
 * ever sent — e.g. ticking off three items in a row while offline
 * shouldn't enqueue three separate whole-stack uploads of increasingly
 * stale snapshots. Superseded ops are dropped outright (not sent, not
 * retried) since the newer op's payload already carries every change the
 * older one would have. */
export function collapseByStack(ops: OutboxOp[]): OutboxOp[] {
  const latestByStack = new Map<string, PutStackOp>();
  for (const op of ops) {
    const existing = latestByStack.get(op.stackId);
    if (!existing || op.nextAttemptAt >= existing.nextAttemptAt) {
      latestByStack.set(op.stackId, op);
    }
  }
  return [...latestByStack.values()];
}
