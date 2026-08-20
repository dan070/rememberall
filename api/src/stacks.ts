import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { ArchivedPaper, CurrentPaper, Stack } from "./types.js";

export const USER_PK = "U#dan"; // single-user app, same convention as weightwatcher

export function padTimestamp(ms: number): string {
  // Zero-padded so lexicographic sort == numeric sort in gsi1sk.
  return String(ms).padStart(13, "0");
}

export interface StackInput {
  id: string;
  name: string;
  lastInteractionAt: string;
  currentPaper: CurrentPaper;
  archive: ArchivedPaper[];
}

/** Upserts a whole stack as one item. Idempotent by design: a retried
 * write with the same id overwrites harmlessly, same contract as
 * weightwatcher's putEntry. Whole-stack-per-item (not one row per theme/
 * item) is deliberate for Step 2 — see types.ts's Stack doc comment. */
export async function putStack(
  doc: DynamoDBDocumentClient,
  tableName: string,
  input: StackInput,
  now: number = Date.now(),
): Promise<Stack> {
  const stack: Stack & { pk: string; sk: string; gsi1pk: string; gsi1sk: string } = {
    ...input,
    updatedAt: now,
    pk: USER_PK,
    sk: `S#${input.id}`,
    gsi1pk: USER_PK,
    gsi1sk: `${padTimestamp(now)}#${input.id}`,
  };

  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: stack,
    }),
  );

  // Internal DynamoDB keys must never reach the client.
  const { pk: _pk, sk: _sk, gsi1pk: _gsi1pk, gsi1sk: _gsi1sk, ...rest } = stack;
  return rest as Stack;
}

/** Delta sync: everything with updatedAt strictly greater than the cursor. */
export async function querySince(
  doc: DynamoDBDocumentClient,
  tableName: string,
  cursor: string,
): Promise<{ items: Stack[]; cursor: string }> {
  const result = await doc.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :pk AND gsi1sk > :cursor",
      ExpressionAttributeValues: {
        ":pk": USER_PK,
        ":cursor": cursor,
      },
      Limit: 200,
    }),
  );

  type RawItem = Stack & {
    pk: string;
    sk: string;
    gsi1pk: string;
    gsi1sk: string;
  };
  const items = (result.Items ?? []) as RawItem[];
  const lastItem = items.at(-1);
  const nextCursor = lastItem ? lastItem.gsi1sk : cursor;

  return {
    items: items.map(
      ({ pk: _pk, sk: _sk, gsi1pk: _gsi1pk, gsi1sk: _gsi1sk, ...rest }) =>
        rest as Stack,
    ),
    cursor: nextCursor,
  };
}
