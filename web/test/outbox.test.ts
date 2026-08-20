import { describe, expect, it } from "vitest";
import { afterFailure, collapseByStack, dueOps, makePutStackOp, nextBackoff, type PutStackOp } from "../src/lib/outbox";
import type { Stack } from "../src/lib/types";

function makeStack(id: string): Stack {
  return {
    id,
    name: "Home",
    lastInteractionAt: "2026-08-19T10:00:00.000Z",
    currentPaper: { paperIndex: 1, createdAt: "2026-08-19T10:00:00.000Z", themes: [], items: [] },
    archive: [],
  };
}

describe("makePutStackOp", () => {
  it("builds a putStack op carrying the full stack payload", () => {
    const stack = makeStack("s1");
    const op = makePutStackOp(stack, "op-1", 1000);
    expect(op).toEqual({ opId: "op-1", kind: "putStack", stackId: "s1", payload: stack, attempts: 0, nextAttemptAt: 1000 });
  });
});

describe("dueOps", () => {
  it("returns only ops whose nextAttemptAt has arrived, oldest first", () => {
    const ops: PutStackOp[] = [
      makePutStackOp(makeStack("a"), "op-a", 3000),
      makePutStackOp(makeStack("b"), "op-b", 1000),
      makePutStackOp(makeStack("c"), "op-c", 5000),
    ];
    const due = dueOps(ops, 3000);
    expect(due.map((o) => o.opId)).toEqual(["op-b", "op-a"]);
  });
});

describe("nextBackoff / afterFailure", () => {
  it("doubles the delay per attempt, capped", () => {
    expect(nextBackoff(0, 0)).toBe(1000);
    expect(nextBackoff(1, 0)).toBe(2000);
    expect(nextBackoff(2, 0)).toBe(4000);
    expect(nextBackoff(20, 0)).toBe(5 * 60 * 1000); // capped
  });

  it("increments attempts and reschedules", () => {
    const op = makePutStackOp(makeStack("a"), "op-a", 0);
    const failed = afterFailure(op, 1000);
    expect(failed.attempts).toBe(1);
    // nextBackoff(1, ...) → BASE_DELAY_MS * 2^1 = 2000ms, since attempts is
    // already incremented to 1 by the time nextBackoff is called.
    expect(failed.nextAttemptAt).toBe(1000 + 2000);
  });
});

describe("collapseByStack", () => {
  it("keeps only the latest op per stack, dropping superseded ones", () => {
    const older = makePutStackOp(makeStack("a"), "op-old", 1000);
    const newer = makePutStackOp(makeStack("a"), "op-new", 2000);
    const other = makePutStackOp(makeStack("b"), "op-b", 1500);

    const result = collapseByStack([older, newer, other]);

    expect(result).toHaveLength(2);
    expect(result.find((o) => o.stackId === "a")?.opId).toBe("op-new");
    expect(result.find((o) => o.stackId === "b")?.opId).toBe("op-b");
  });

  it("is a no-op when every op is for a different stack", () => {
    const ops = [makePutStackOp(makeStack("a"), "op-a", 1000), makePutStackOp(makeStack("b"), "op-b", 1000)];
    expect(collapseByStack(ops)).toHaveLength(2);
  });
});
