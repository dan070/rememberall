import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "../src/lib/api";
import type { Stack } from "../src/lib/types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function makeStack(overrides: Partial<Stack> = {}): Stack {
  return {
    id: "stack-1",
    name: "Home",
    lastInteractionAt: "2026-08-19T10:00:00.000Z",
    currentPaper: { paperIndex: 1, createdAt: "2026-08-19T10:00:00.000Z", themes: [], items: [] },
    archive: [],
    ...overrides,
  };
}

function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe("createApiClient", () => {
  it("sends the app token in x-rmb-token, not Authorization", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { items: [], cursor: "0" }));
    const client = createApiClient("https://example.com", "my-token");

    await client.sync("0");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["x-rmb-token"]).toBe("my-token");
    expect(init.headers.authorization).toBeUndefined();
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("computes an x-amz-content-sha256 header for a putStack request body", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, makeStack()));
    const client = createApiClient("https://example.com", "tok");

    await client.putStack(makeStack());

    const [, init] = fetchMock.mock.calls[0];
    // known SHA-256 hex digest of the exact JSON.stringify(makeStack())
    // body, computed independently — a regression here (wrong body, wrong
    // algorithm, wrong encoding) would silently 403 in production, since
    // this is exactly the header CloudFront's OAC needs for signed POSTs.
    const expectedBody = JSON.stringify(makeStack());
    const expectedHashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(expectedBody));
    const expectedHash = Array.from(new Uint8Array(expectedHashBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(init.headers["x-amz-content-sha256"]).toBe(expectedHash);
    expect(init.headers["x-amz-content-sha256"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not send x-amz-content-sha256 for a bodyless request (sync)", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { items: [], cursor: "0" }));
    const client = createApiClient("https://example.com", "tok");

    await client.sync("0");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["x-amz-content-sha256"]).toBeUndefined();
  });

  it("hits POST /api/stacks for putStack", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, makeStack()));
    const client = createApiClient("https://example.com", "tok");

    await client.putStack(makeStack());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/api/stacks");
    expect(init.method).toBe("POST");
  });

  it("hits GET /api/sync?since=... for sync", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { items: [], cursor: "0" }));
    const client = createApiClient("https://example.com", "tok");

    await client.sync("some-cursor");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/api/sync?since=some-cursor");
  });

  it("throws ApiError with the status and body on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(403, { message: "Forbidden" }));
    const client = createApiClient("https://example.com", "tok");

    await expect(client.sync("0")).rejects.toMatchObject(new ApiError(403, { message: "Forbidden" }));
  });
});
