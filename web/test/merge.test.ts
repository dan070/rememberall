import { describe, expect, it } from "vitest";
import { applyIncoming, mergeIncoming } from "../src/lib/merge";

interface Row {
  id: string;
  updatedAt?: number;
  text: string;
}

describe("mergeIncoming", () => {
  it("takes the incoming record when there's no local copy", () => {
    const incoming: Row = { id: "a", updatedAt: 10, text: "new" };
    expect(mergeIncoming(undefined, incoming)).toBe(incoming);
  });

  it("takes incoming when it's strictly newer", () => {
    const local: Row = { id: "a", updatedAt: 5, text: "old" };
    const incoming: Row = { id: "a", updatedAt: 10, text: "new" };
    expect(mergeIncoming(local, incoming)).toBe(incoming);
  });

  it("keeps local when incoming is older", () => {
    const local: Row = { id: "a", updatedAt: 10, text: "current" };
    const incoming: Row = { id: "a", updatedAt: 5, text: "stale" };
    expect(mergeIncoming(local, incoming)).toBe(local);
  });

  it("keeps local on an exact tie (incoming <= local, not <)", () => {
    const local: Row = { id: "a", updatedAt: 10, text: "current" };
    const incoming: Row = { id: "a", updatedAt: 10, text: "same-timestamp" };
    expect(mergeIncoming(local, incoming)).toBe(local);
  });

  it("treats a missing updatedAt as -1 (never wins against anything real)", () => {
    const local: Row = { id: "a", text: "no timestamp" };
    const incoming: Row = { id: "a", updatedAt: 0, text: "has timestamp" };
    expect(mergeIncoming(local, incoming)).toBe(incoming);
  });
});

describe("applyIncoming", () => {
  it("merges a batch keyed by id, preserving local rows not present in the incoming batch", () => {
    const local: Row[] = [
      { id: "a", updatedAt: 5, text: "local-a" },
      { id: "b", updatedAt: 5, text: "local-b" },
    ];
    const incoming: Row[] = [{ id: "a", updatedAt: 10, text: "server-a" }];

    const result = applyIncoming(local, incoming);

    expect(result.find((r) => r.id === "a")?.text).toBe("server-a");
    expect(result.find((r) => r.id === "b")?.text).toBe("local-b");
  });

  it("adds a new row that only exists in the incoming batch", () => {
    const result = applyIncoming<Row>([], [{ id: "new", updatedAt: 1, text: "brand new" }]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("new");
  });
});
