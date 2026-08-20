import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StackInput } from "../src/stacks.js";

const sendMock = vi.fn();

class FakeCommand {
  input: unknown;
  constructor(input: unknown) {
    this.input = input;
  }
}

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  PutCommand: FakeCommand,
  QueryCommand: FakeCommand,
}));

const { putStack, querySince, padTimestamp, USER_PK } = await import("../src/stacks.js");

beforeEach(() => {
  sendMock.mockReset();
});

function makeStackInput(id: string): StackInput {
  return {
    id,
    name: "Home",
    lastInteractionAt: "2026-08-19T10:00:00.000Z",
    currentPaper: {
      paperIndex: 1,
      createdAt: "2026-08-19T10:00:00.000Z",
      themes: [{ id: "t1", text: "renovate", date: null, state: "live", statusAt: null, x: 100, y: 100 }],
      items: [{ id: "i1", themeId: "t1", text: "buy paint", date: null, state: "live", x: 150, y: 150, notes: [] }],
    },
    archive: [],
  };
}

describe("putStack", () => {
  it("sends a PutCommand keyed by pk + a stack-scoped sort key, with a server-assigned updatedAt", async () => {
    sendMock.mockResolvedValueOnce({});
    const doc = { send: sendMock } as any;

    const result = await putStack(doc, "rememberall-test", makeStackInput("stack-1"), 5000);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]?.[0];
    expect(command.input.TableName).toBe("rememberall-test");
    expect(command.input.Item.pk).toBe(USER_PK);
    expect(command.input.Item.sk).toBe("S#stack-1");
    expect(command.input.Item.gsi1pk).toBe(USER_PK);
    expect(command.input.Item.gsi1sk).toBe(`${padTimestamp(5000)}#stack-1`);
    expect(command.input.Item.updatedAt).toBe(5000);
    expect(result.updatedAt).toBe(5000);
    expect(result.id).toBe("stack-1");
  });

  it("never leaks internal DynamoDB keys (pk/sk/gsi1pk/gsi1sk) into the returned value", async () => {
    sendMock.mockResolvedValueOnce({});
    const doc = { send: sendMock } as any;

    const result = await putStack(doc, "rememberall-test", makeStackInput("stack-2"), 6000);

    expect(result).not.toHaveProperty("pk");
    expect(result).not.toHaveProperty("sk");
    expect(result).not.toHaveProperty("gsi1pk");
    expect(result).not.toHaveProperty("gsi1sk");
  });

  it("preserves the full nested paper/theme/item structure round-trip", async () => {
    sendMock.mockResolvedValueOnce({});
    const doc = { send: sendMock } as any;
    const input = makeStackInput("stack-3");

    const result = await putStack(doc, "rememberall-test", input, 7000);

    expect(result.currentPaper).toEqual(input.currentPaper);
    expect(result.archive).toEqual(input.archive);
  });
});

describe("querySince", () => {
  it("queries gsi1 with the cursor and returns items with internal keys stripped", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        {
          pk: USER_PK,
          sk: "S#stack-1",
          gsi1pk: USER_PK,
          gsi1sk: "0000000010000#stack-1",
          id: "stack-1",
          name: "Home",
          lastInteractionAt: "2026-08-19T10:00:00.000Z",
          currentPaper: { paperIndex: 1, createdAt: "2026-08-19T10:00:00.000Z", themes: [], items: [] },
          archive: [],
          updatedAt: 10000,
        },
      ],
    });
    const doc = { send: sendMock } as any;

    const result = await querySince(doc, "rememberall-test", "0");

    const command = sendMock.mock.calls[0]?.[0];
    expect(command.input.IndexName).toBe("gsi1");
    expect(command.input.ExpressionAttributeValues[":pk"]).toBe(USER_PK);
    expect(command.input.ExpressionAttributeValues[":cursor"]).toBe("0");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty("pk");
    expect(result.items[0]).not.toHaveProperty("gsi1sk");
    expect(result.items[0]!.id).toBe("stack-1");
    expect(result.cursor).toBe("0000000010000#stack-1");
  });

  it("returns the input cursor unchanged when there are no new items", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const doc = { send: sendMock } as any;

    const result = await querySince(doc, "rememberall-test", "some-cursor");

    expect(result.items).toEqual([]);
    expect(result.cursor).toBe("some-cursor");
  });
});
