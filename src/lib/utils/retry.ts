export interface RetryOptions {
  retries?: number;
  backoffMs?: number;
}

/**
 * Retries `fn` with linear backoff. Used by real API clients (network
 * flakiness) and exercised by mock clients' simulated failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, backoffMs = 300 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
