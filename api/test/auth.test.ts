import { describe, expect, it } from "vitest";
import { checkAppToken } from "../src/auth.js";

describe("checkAppToken", () => {
  const token = "s3cr3t-token-value";

  it("accepts the correct token", () => {
    expect(checkAppToken(token, token)).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(checkAppToken("wrong-token-value", token)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(checkAppToken(undefined, token)).toBe(false);
  });

  it("rejects a token of different length", () => {
    expect(checkAppToken("short", token)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(checkAppToken("", token)).toBe(false);
  });
});
