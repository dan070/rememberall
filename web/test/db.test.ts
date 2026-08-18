import { describe, expect, it } from "vitest";
import { getAllStacks, getMeta, putStack, putStacks, setMeta } from "../src/lib/db";
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
