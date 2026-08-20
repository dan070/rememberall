import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});

const cache = new Map<string, string>();

/** Reads an SSM SecureString parameter once per cold start and caches it in
 * module scope — a secret never sits in a Lambda env var (plaintext in the
 * console / CFN diff) and never gets re-fetched on every request. */
async function getSecret(paramNameEnvVar: string): Promise<string> {
  const cached = cache.get(paramNameEnvVar);
  if (cached !== undefined) return cached;

  const paramName = process.env[paramNameEnvVar];
  if (!paramName) {
    throw new Error(`${paramNameEnvVar} env var is not set`);
  }

  const result = await ssm.send(
    new GetParameterCommand({ Name: paramName, WithDecryption: true }),
  );

  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter ${paramName} has no value`);
  }

  cache.set(paramNameEnvVar, value);
  return value;
}

export function getBearerToken(): Promise<string> {
  return getSecret("BEARER_TOKEN_PARAM");
}

/** Test-only escape hatch — resets the module-scope cache between test runs. */
export function _resetCacheForTests(): void {
  cache.clear();
}
