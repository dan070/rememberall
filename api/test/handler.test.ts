import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LambdaFunctionURLEvent } from "aws-lambda";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(),
}));

class FakeCommand {
  input: unknown;
  constructor(input: unknown) {
    this.input = input;
  }
}

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: sendMock }) },
  PutCommand: FakeCommand,
  QueryCommand: FakeCommand,
}));

vi.mock("../src/config.js", () => ({
  getBearerToken: vi.fn().mockResolvedValue("test-token"),
}));

process.env.TABLE_NAME = "rememberall-test";

const { handler } = await import("../src/handler.js");

function makeEvent(
  overrides: Partial<{
    method: string;
    path: string;
    body: string | null;
    headers: Record<string, string>;
    query: Record<string, string>;
  }>,
): LambdaFunctionURLEvent {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: overrides.path ?? "/api/stacks",
    rawQueryString: "",
    headers: overrides.headers ?? { "x-rmb-token": "test-token" },
    queryStringParameters: overrides.query,
    requestContext: {
      http: {
        method: overrides.method ?? "POST",
        path: overrides.path ?? "/api/stacks",
      },
    },
    body: overrides.body ?? null,
    isBase64Encoded: false,
  } as unknown as LambdaFunctionURLEvent;
}

function validStackBody(id: string) {
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

beforeEach(() => {
  sendMock.mockReset();
});

describe("handler auth", () => {
  it("returns 401 with no x-rmb-token header", async () => {
    const res = await handler(makeEvent({ headers: {} }));
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with a wrong token", async () => {
    const res = await handler(makeEvent({ headers: { "x-rmb-token": "nope" } }));
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/stacks", () => {
  it("stores a valid stack and returns it with a server-assigned updatedAt", async () => {
    sendMock.mockResolvedValueOnce({});

    const res = await handler(makeEvent({ body: JSON.stringify(validStackBody("stack-1")) }));

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.id).toBe("stack-1");
    expect(typeof body.updatedAt).toBe("number");
    expect(sendMock).toHaveBeenCalledTimes(1);
    // Internal DynamoDB keys must never leak to the client.
    expect(body.pk).toBeUndefined();
    expect(body.sk).toBeUndefined();
    expect(body.gsi1pk).toBeUndefined();
    expect(body.gsi1sk).toBeUndefined();
  });

  it("preserves the full nested paper/theme/item structure", async () => {
    sendMock.mockResolvedValueOnce({});
    const input = validStackBody("stack-2");

    const res = await handler(makeEvent({ body: JSON.stringify(input) }));

    const body = JSON.parse(res.body as string);
    expect(body.currentPaper).toEqual(input.currentPaper);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await handler(makeEvent({ body: "{not json" }));
    expect(res.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a body missing required fields with 400", async () => {
    const res = await handler(makeEvent({ body: JSON.stringify({ name: "no id" }) }));
    expect(res.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a theme with an invalid state with 400", async () => {
    const bad = validStackBody("stack-3");
    bad.currentPaper.themes[0]!.state = "not-a-state" as any;
    const res = await handler(makeEvent({ body: JSON.stringify(bad) }));
    expect(res.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects an item with a malformed notes array with 400", async () => {
    const bad = validStackBody("stack-4");
    (bad.currentPaper.items[0] as any).notes = [{ text: "ok" }]; // missing `done`
    const res = await handler(makeEvent({ body: JSON.stringify(bad) }));
    expect(res.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects an archived paper missing retiredAt with 400", async () => {
    const bad = validStackBody("stack-5");
    (bad.archive as any) = [{ paperIndex: 1, createdAt: "2026-08-01", themes: [], items: [] }];
    const res = await handler(makeEvent({ body: JSON.stringify(bad) }));
    expect(res.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/sync", () => {
  it("queries GSI1 and returns items + cursor", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        {
          pk: "U#dan",
          sk: "S#stack-1",
          gsi1pk: "U#dan",
          gsi1sk: "0000000000123#stack-1",
          id: "stack-1",
          name: "Home",
          lastInteractionAt: "2026-08-19T10:00:00.000Z",
          currentPaper: { paperIndex: 1, createdAt: "2026-08-19T10:00:00.000Z", themes: [], items: [] },
          archive: [],
          updatedAt: 123,
        },
      ],
    });

    const res = await handler(makeEvent({ method: "GET", path: "/api/sync", query: { since: "0" } }));

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("stack-1");
    expect(body.items[0].pk).toBeUndefined();
    expect(body.items[0].gsi1sk).toBeUndefined();
    expect(body.cursor).toBe("0000000000123#stack-1");
  });

  it("returns the same cursor when there are no new items", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const res = await handler(makeEvent({ method: "GET", path: "/api/sync", query: { since: "0000000000999#zzz" } }));
    const body = JSON.parse(res.body as string);
    expect(body.items).toHaveLength(0);
    expect(body.cursor).toBe("0000000000999#zzz");
  });

  it("defaults the cursor to '0' when `since` is omitted", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const res = await handler(makeEvent({ method: "GET", path: "/api/sync" }));
    expect(res.statusCode).toBe(200);
    const command = sendMock.mock.calls[0]?.[0];
    expect(command.input.ExpressionAttributeValues[":cursor"]).toBe("0");
  });
});

describe("routing", () => {
  it("returns 404 for an unknown route", async () => {
    const res = await handler(makeEvent({ method: "GET", path: "/nope" }));
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for DELETE /api/stacks (no delete endpoint in scope)", async () => {
    const res = await handler(makeEvent({ method: "DELETE", path: "/api/stacks" }));
    expect(res.statusCode).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
