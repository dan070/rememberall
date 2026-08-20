import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stack } from "../src/lib/types";

const putStackMock = vi.fn();
const syncMock = vi.fn();

vi.mock("../src/lib/api.js", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super(`API error ${status}`);
      this.status = status;
      this.body = body;
    }
  },
  createApiClient: () => ({
    putStack: putStackMock,
    sync: syncMock,
  }),
}));

const { flushOutbox, pullSync } = await import("../src/lib/sync.js");
const { enqueueOp, getAllOps, getAllStacks, getMeta, putStack } = await import("../src/lib/db.js");
const { makePutStackOp } = await import("../src/lib/outbox.js");

function makeStack(id: string, overrides: Partial<Stack> = {}): Stack {
  return {
    id,
    name: "Home",
    lastInteractionAt: "2026-08-19T10:00:00.000Z",
    currentPaper: { paperIndex: 1, createdAt: "2026-08-19T10:00:00.000Z", themes: [], items: [] },
    archive: [],
    ...overrides,
  };
}

beforeEach(() => {
  putStackMock.mockReset();
  syncMock.mockReset();
});

describe("flushOutbox", () => {
  it("sends a due op and removes it from the outbox on success", async () => {
    const stack = makeStack("sync-test-1");
    const op = makePutStackOp(stack, "sync-op-1", 1000);
    await enqueueOp(op);
    putStackMock.mockResolvedValueOnce({ ...stack, updatedAt: 5000 });

    const result = await flushOutbox("https://api.example", "tok", 2000);

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(putStackMock).toHaveBeenCalledWith(stack);
    const remaining = await getAllOps();
    expect(remaining.find((o) => o.opId === "sync-op-1")).toBeUndefined();
  });

  it("does not send an op whose retry time is in the future", async () => {
    const op = makePutStackOp(makeStack("sync-test-2"), "sync-op-2", 999999999999);
    await enqueueOp(op);

    const result = await flushOutbox("https://api.example", "tok", 0);

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(putStackMock).not.toHaveBeenCalled();
  });

  it("reschedules with backoff on failure instead of dropping the op", async () => {
    const op = makePutStackOp(makeStack("sync-test-3"), "sync-op-3", 1000);
    await enqueueOp(op);
    putStackMock.mockRejectedValueOnce(new Error("network down"));

    const result = await flushOutbox("https://api.example", "tok", 2000);

    expect(result).toEqual({ sent: 0, failed: 1 });
    const remaining = await getAllOps();
    const found = remaining.find((o) => o.opId === "sync-op-3");
    expect(found).toBeDefined();
    expect(found?.attempts).toBe(1);
    expect(found?.nextAttemptAt).toBeGreaterThan(2000);
  });

  it("continues flushing remaining ops after one fails", async () => {
    const opFail = makePutStackOp(makeStack("sync-test-4a"), "sync-op-4a", 1000);
    const opOk = makePutStackOp(makeStack("sync-test-4b"), "sync-op-4b", 1000);
    await enqueueOp(opFail);
    await enqueueOp(opOk);
    putStackMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ ...opOk.payload, updatedAt: 1 });

    const result = await flushOutbox("https://api.example", "tok", 2000);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("collapses multiple queued edits to the same stack into a single upload of the latest snapshot", async () => {
    const older = makePutStackOp(makeStack("sync-test-5", { name: "old-name" }), "sync-op-5a", 1000);
    const newer = makePutStackOp(makeStack("sync-test-5", { name: "new-name" }), "sync-op-5b", 1500);
    await enqueueOp(older);
    await enqueueOp(newer);
    putStackMock.mockResolvedValueOnce({ ...newer.payload, updatedAt: 9000 });

    const result = await flushOutbox("https://api.example", "tok", 2000);

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(putStackMock).toHaveBeenCalledTimes(1);
    expect(putStackMock).toHaveBeenCalledWith(newer.payload);
    const remaining = await getAllOps();
    expect(remaining.find((o) => o.stackId === "sync-test-5")).toBeUndefined();
  });
});

describe("pullSync", () => {
  it("starts from cursor '0' when no cursor has been stored yet", async () => {
    syncMock.mockResolvedValueOnce({ items: [], cursor: "0" });
    await pullSync("https://api.example", "tok");
    expect(syncMock).toHaveBeenCalledWith("0");
  });

  it("merges incoming stacks into the local mirror and advances the cursor", async () => {
    const incoming = makeStack("sync-pull-1", { updatedAt: 42, name: "server-name" });
    syncMock.mockResolvedValueOnce({ items: [incoming], cursor: "0000000000042#sync-pull-1" });

    await pullSync("https://api.example", "tok");

    const local = await getAllStacks();
    expect(local.find((s) => s.id === "sync-pull-1")?.name).toBe("server-name");
    expect(await getMeta("syncCursor")).toBe("0000000000042#sync-pull-1");
  });

  it("does not overwrite a newer local stack with a stale incoming one", async () => {
    await putStack(makeStack("sync-pull-2", { updatedAt: 100, name: "local-newer" }));
    syncMock.mockResolvedValueOnce({ items: [makeStack("sync-pull-2", { updatedAt: 50, name: "server-stale" })], cursor: "x" });

    await pullSync("https://api.example", "tok");

    const local = await getAllStacks();
    expect(local.find((s) => s.id === "sync-pull-2")?.name).toBe("local-newer");
  });

  it("still advances the cursor when there are no new items", async () => {
    syncMock.mockResolvedValueOnce({ items: [], cursor: "unchanged-cursor" });
    await pullSync("https://api.example", "tok");
    expect(await getMeta("syncCursor")).toBe("unchanged-cursor");
  });
});
