/**
 * Infisical client for secrets management
 * Loads secrets from Infisical into environment at startup
 * 
 * NOTE: This is a placeholder. Install @infisical/sdk to enable.
 */

export async function initInfisical(): Promise<void> {
  console.warn('⚠️  Infisical not configured, using .env only');
}

export function getSecret(key: string): string | undefined {
  return process.env[key];
}

export function getSecrets(...keys: string[]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    result[key] = getSecret(key);
  }
  return result;
}

export async function refreshSecrets(): Promise<void> {
  // No-op placeholder
}

export function closeInfisical(): void {
  // No-op placeholder
}