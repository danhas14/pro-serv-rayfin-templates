import { getRayfinClient } from './rayfin/RayfinClientService';

/**
 * Build a create payload for an entity that declares both an explicit foreign
 * key column and an `@one()` navigation.
 *
 * The client expands `customer: { id }` into `customer_id` when it builds the
 * GraphQL mutation, so sending both produces "There can be only one input field
 * named `customer_id`". The FK columns are stripped and the navigations sent
 * alone. The `never` return records that the generated input type is wrong
 * here, not the payload.
 */
export function withRelationships<T extends object>(
  input: T,
  fkFields: readonly (keyof T & string)[],
  navigations: Record<string, { id: string } | undefined>
): never {
  const payload = { ...input } as Record<string, unknown>;
  for (const key of fkFields) delete payload[key];
  for (const [key, value] of Object.entries(navigations)) {
    if (value) payload[key] = value;
  }
  return payload as never;
}

/** Run `worker` over `items` with a bounded number of in-flight requests. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let done = 0;

  async function runner() {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
      done += 1;
      onProgress?.(done, items.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runner)
  );
  return results;
}

/**
 * Retry a single write.
 *
 * Loading the demo dataset issues thousands of small mutations; one transient
 * failure part-way through would otherwise leave a half-populated workspace.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * Page size used whenever a query may return more than Data API Builder's
 * default page of 100 rows. `count()` is not available on the client, so every
 * bulk read states an explicit ceiling.
 */
export const MAX_ROWS = 5000;

export function db() {
  return getRayfinClient().data;
}

export function currentSessionUserId(): string {
  const id = getRayfinClient().auth.getSession().user?.id;
  if (!id) throw new Error('You are not signed in.');
  return id;
}

export function currentSessionEmail(): string {
  const email = getRayfinClient().auth.getSession().user?.email;
  if (!email) throw new Error('You are not signed in.');
  return email;
}
