import type { Stack } from "./types";

export interface SyncResult {
  items: Stack[];
  cursor: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** SHA-256 hex digest via the standard Web Crypto API (available in every
 * browser we target, including iOS Safari — no library needed). */
async function sha256Hex(body: string): Promise<string> {
  const bytes = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function request<T>(baseUrl: string, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    // Custom header, not Authorization — CloudFront's Origin Access
    // Control to the Lambda needs Authorization for its own SigV4
    // signature, so our app-level token must travel elsewhere or it gets
    // overwritten before the request reaches the Lambda.
    "x-rmb-token": token,
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  // CloudFront's OAC-signed request to the Lambda Function URL requires
  // the body's SHA-256 hash for any request that has one — GET here never
  // carries a body, so this only applies to the stack upsert.
  if (typeof init.body === "string") {
    headers["x-amz-content-sha256"] = await sha256Hex(init.body);
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

export function createApiClient(baseUrl: string, token: string) {
  return {
    async putStack(stack: Stack): Promise<Stack> {
      return request<Stack>(baseUrl, token, "/api/stacks", {
        method: "POST",
        body: JSON.stringify(stack),
      });
    },

    async sync(since: string): Promise<SyncResult> {
      return request<SyncResult>(baseUrl, token, `/api/sync?since=${encodeURIComponent(since)}`);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
