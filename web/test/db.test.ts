import { describe, expect, it } from "vitest";
import { clearAllLocalData, deleteOp, enqueueOp, getAllOps, getAllStacks, getMeta, putOp, putStack, putStacks, setMeta } from "../src/lib/db";
import { makePutStackOp } from "../src/lib/outbox";
import type { Stack } from "../src/lib/types";

function makeStack(id: string, name: string): Stack {
  return {
    id,
    name,
    lastInteractionAt: "2026-08-07T10:00:00.000Z",
    currentPaper: { paperIndex: 1, createdAt: "2026-08-07T10:00:00.000Z", themes: [], items: [] },
    archive: [],
  };
}

// fake-indexeddb persists across tests in the same module unless the DB is
// deleted, so each test uses distinct ids to stay independent.
describe("stacks store", () => {
  it("round-trips a single stack", async () => {
    const stack = makeStack("db-test-1", "Test Stack 1");
    await putStack(stack);
    const all = await getAllStacks();
    expect(all.find((s) => s.id === "db-test-1")).toEqual(stack);
  });

  it("putStacks writes a batch in one transaction", async () => {
    const batch = [makeStack("db-test-batch-1", "Batch 1"), makeStack("db-test-batch-2", "Batch 2")];
    await putStacks(batch);
    const all = await getAllStacks();
    expect(all.some((s) => s.id === "db-test-batch-1")).toBe(true);
    expect(all.some((s) => s.id === "db-test-batch-2")).toBe(true);
  });

  it("putStack overwrites an existing stack by id", async () => {
    const stack = makeStack("db-test-overwrite", "Original");
    await putStack(stack);
    await putStack({ ...stack, name: "Renamed" });
    const all = await getAllStacks();
    expect(all.find((s) => s.id === "db-test-overwrite")?.name).toBe("Renamed");
  });
});

describe("outbox store", () => {
  it("enqueues and lists an op", async () => {
    const op = makePutStackOp(makeStack("outbox-test-1", "Outbox 1"), "outbox-op-1", 1000);
    await enqueueOp(op);
    const all = await getAllOps();
    expect(all.find((o) => o.opId === "outbox-op-1")).toEqual(op);
  });

  it("putOp overwrites an existing op by opId", async () => {
    const op = makePutStackOp(makeStack("outbox-test-2", "Outbox 2"), "outbox-op-2", 1000);
    await enqueueOp(op);
    await putOp({ ...op, attempts: 3, nextAttemptAt: 9999 });
    const all = await getAllOps();
    const found = all.find((o) => o.opId === "outbox-op-2");
    expect(found?.attempts).toBe(3);
    expect(found?.nextAttemptAt).toBe(9999);
  });

  it("deleteOp removes it — this is how a successful send clears the queue", async () => {
    const op = makePutStackOp(makeStack("outbox-test-3", "Outbox 3"), "outbox-op-3", 1000);
    await enqueueOp(op);
    await deleteOp("outbox-op-3");
    const all = await getAllOps();
    expect(all.find((o) => o.opId === "outbox-op-3")).toBeUndefined();
  });
});

describe("clearAllLocalData", () => {
  it("wipes stacks, outbox, and meta entirely", async () => {
    await putStack(makeStack("reset-test-1", "Before Reset"));
    await enqueueOp(makePutStackOp(makeStack("reset-test-1", "Before Reset"), "reset-op-1", 1000));
    await setMeta("activeStackId", "reset-test-1");

    await clearAllLocalData();

    expect(await getAllStacks()).toEqual([]);
    expect(await getAllOps()).toEqual([]);
    expect(await getMeta("activeStackId")).toBeUndefined();
  });
});

describe("meta store", () => {
  it("round-trips an arbitrary value by key", async () => {
    await setMeta("test-meta-key", "abc123");
    expect(await getMeta("test-meta-key")).toBe("abc123");
  });

  it("returns undefined for a key that was never set", async () => {
    expect(await getMeta("test-meta-key-never-set")).toBeUndefined();
  });

  it("overwrites a previously set value", async () => {
    await setMeta("test-meta-overwrite", "first");
    await setMeta("test-meta-overwrite", "second");
    expect(await getMeta("test-meta-overwrite")).toBe("second");
  });
});
