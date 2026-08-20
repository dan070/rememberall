import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

class FakeSSMClient {
  send = sendMock;
}

class FakeGetParameterCommand {
  input: unknown;
  constructor(input: unknown) {
    this.input = input;
  }
}

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: FakeSSMClient,
  GetParameterCommand: FakeGetParameterCommand,
}));

const { getBearerToken, _resetCacheForTests } = await import("../src/config.js");

beforeEach(() => {
  sendMock.mockReset();
  _resetCacheForTests();
  delete process.env.BEARER_TOKEN_PARAM;
});

describe("getBearerToken", () => {
  it("fetches from SSM and returns the decrypted value", async () => {
    process.env.BEARER_TOKEN_PARAM = "/rememberall/bearer-token";
    sendMock.mockResolvedValueOnce({ Parameter: { Value: "abc123" } });

    const token = await getBearerToken();

    expect(token).toBe("abc123");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("caches the value across calls (only fetches once)", async () => {
    process.env.BEARER_TOKEN_PARAM = "/rememberall/bearer-token";
    sendMock.mockResolvedValueOnce({ Parameter: { Value: "abc123" } });

    await getBearerToken();
    await getBearerToken();
    await getBearerToken();

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("throws if BEARER_TOKEN_PARAM is unset", async () => {
    await expect(getBearerToken()).rejects.toThrow(/BEARER_TOKEN_PARAM/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("throws if the parameter has no value", async () => {
    process.env.BEARER_TOKEN_PARAM = "/rememberall/bearer-token";
    sendMock.mockResolvedValueOnce({ Parameter: {} });

    await expect(getBearerToken()).rejects.toThrow(/no value/);
  });
});
