import { RateLimitError } from "./errors.js";
import type { ProviderId } from "./types.js";

export interface RequestCoreOptions {
  provider: ProviderId;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  retries?: number;
  timeoutMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
}

export interface RequestCoreResponse {
  status: number;
  text: string;
  headers: Headers;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number): number {
  const min = Math.max(0, Math.floor(baseMs * 0.2));
  const max = Math.max(min + 1, Math.floor(baseMs * 0.6));
  return min + Math.floor(Math.random() * (max - min));
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return undefined;
  const asNum = Number(retryAfter);
  if (!Number.isNaN(asNum)) return asNum * 1000;
  const dateMs = Date.parse(retryAfter);
  if (Number.isNaN(dateMs)) return undefined;
  const delta = dateMs - Date.now();
  return delta > 0 ? delta : undefined;
}

export async function requestCore(
  opts: RequestCoreOptions,
): Promise<RequestCoreResponse> {
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const retryBaseMs = opts.retryBaseMs ?? 1_000;
  const retryMaxMs = opts.retryMaxMs ?? 12_000;
  const method = opts.method ?? "GET";

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(opts.url, {
        method,
        headers: opts.headers,
        body: opts.body,
        signal: controller.signal,
      });
      const text = await response.text();

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response.headers);
        if (attempt <= retries) {
          const base =
            retryAfterMs ??
            Math.min(retryMaxMs, retryBaseMs * 2 ** (attempt - 1));
          await wait(base + jitter(base));
          continue;
        }
        throw new RateLimitError(
          opts.provider,
          `Rate limited by ${opts.provider}`,
          retryAfterMs,
        );
      }

      if (
        response.status >= 500 &&
        response.status < 600 &&
        attempt <= retries
      ) {
        const base = Math.min(retryMaxMs, retryBaseMs * 2 ** (attempt - 1));
        await wait(base + jitter(base));
        continue;
      }

      return { status: response.status, text, headers: response.headers };
    } catch (error) {
      lastError = error;
      if (attempt > retries) break;
      const base = Math.min(retryMaxMs, retryBaseMs * 2 ** (attempt - 1));
      await wait(base + jitter(base));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error(`Request failed for ${opts.provider}`);
}
