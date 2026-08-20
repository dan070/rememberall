import { timingSafeEqual } from "node:crypto";

/** Timing-safe comparison — a plain === would let an attacker infer the
 * token byte-by-byte from response-time differences.
 *
 * Deliberately NOT the Authorization header: this app sits behind
 * CloudFront with Origin Access Control to the Lambda Function URL, which
 * needs Authorization for its own SigV4 signature. A client-supplied
 * Authorization header collides with — and gets overwritten by —
 * CloudFront's OAC signing before the request reaches Lambda, so our own
 * app-level token must travel in a different header (see handler.ts). */
export function checkAppToken(
  providedToken: string | undefined,
  expectedToken: string,
): boolean {
  if (!providedToken) return false;

  const a = Buffer.from(providedToken);
  const b = Buffer.from(expectedToken);
  // timingSafeEqual throws on length mismatch rather than returning false,
  // so bail out first (a length mismatch alone means "wrong token").
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
