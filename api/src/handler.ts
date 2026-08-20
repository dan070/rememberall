import type { LambdaFunctionURLEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { checkAppToken } from "./auth.js";
import { getBearerToken } from "./config.js";
import { putStack, querySince, type StackInput } from "./stacks.js";

const TABLE_NAME = process.env.TABLE_NAME ?? "rememberall";

const ddbClient = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(ddbClient);

// Narrower than the SDK's LambdaFunctionURLResult (which also allows a bare
// string) — every response this handler returns takes the object form, so
// callers and tests get a concrete, non-union shape.
export interface JsonResponse {
  statusCode: number;
  headers: { "content-type": string };
  body: string;
}

function json(status: number, body: unknown): JsonResponse {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isBubbleState(value: unknown): value is "live" | "done" | "cancelled" {
  return value === "live" || value === "done" || value === "cancelled";
}

function isNote(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.text === "string" && typeof v.done === "boolean";
}

function isTheme(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.text === "string" &&
    (v.date === null || typeof v.date === "string") &&
    isBubbleState(v.state) &&
    (v.statusAt === null || typeof v.statusAt === "string") &&
    typeof v.x === "number" &&
    typeof v.y === "number"
  );
}

function isItem(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.themeId === "string" &&
    typeof v.text === "string" &&
    (v.date === null || typeof v.date === "string") &&
    isBubbleState(v.state) &&
    typeof v.x === "number" &&
    typeof v.y === "number" &&
    Array.isArray(v.notes) &&
    v.notes.every(isNote)
  );
}

function isCurrentPaper(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.paperIndex === "number" &&
    typeof v.createdAt === "string" &&
    Array.isArray(v.themes) &&
    v.themes.every(isTheme) &&
    Array.isArray(v.items) &&
    v.items.every(isItem)
  );
}

function isArchivedPaper(value: unknown): boolean {
  if (!isCurrentPaper(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.retiredAt === "string";
}

function isStackInput(value: unknown): value is StackInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.name === "string" &&
    typeof v.lastInteractionAt === "string" &&
    isCurrentPaper(v.currentPaper) &&
    Array.isArray(v.archive) &&
    v.archive.every(isArchivedPaper)
  );
}

export async function handler(
  event: LambdaFunctionURLEvent,
): Promise<JsonResponse> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  let bearerToken: string;
  try {
    bearerToken = await getBearerToken();
  } catch (err) {
    // Fail closed, not open, if SSM is unreachable or misconfigured.
    console.error("failed to load bearer token", err);
    return json(500, { error: "server misconfigured" });
  }

  // Custom header, not Authorization — see auth.ts for why: CloudFront's
  // Origin Access Control to this Lambda needs Authorization for its own
  // SigV4 signature, so our app-level token has to live elsewhere.
  const appToken = event.headers?.["x-rmb-token"] ?? event.headers?.["X-RMB-Token"];
  if (!checkAppToken(appToken, bearerToken)) {
    return json(401, { error: "unauthorized" });
  }

  try {
    if (method === "POST" && path === "/api/stacks") {
      return await handlePutStack(event);
    }

    if (method === "GET" && path === "/api/sync") {
      return await handleSync(event);
    }

    return json(404, { error: "not found" });
  } catch (err) {
    console.error("handler error", err);
    return json(500, { error: "internal error" });
  }
}

async function handlePutStack(
  event: LambdaFunctionURLEvent,
): Promise<JsonResponse> {
  let parsed: unknown;
  try {
    parsed = event.body ? JSON.parse(event.body) : null;
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  if (!isStackInput(parsed)) {
    return json(400, { error: "invalid stack" });
  }

  const stack = await putStack(doc, TABLE_NAME, parsed);
  return json(200, stack);
}

async function handleSync(
  event: LambdaFunctionURLEvent,
): Promise<JsonResponse> {
  const cursor = event.queryStringParameters?.since ?? "0";
  const result = await querySince(doc, TABLE_NAME, cursor);
  return json(200, result);
}
