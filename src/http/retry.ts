import type { Logger } from '../utils/logger';
import { NoopLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryConfig {
  /** Maximum number of retry attempts (does not count the initial request). */
  maxRetries: number;
  /** Base delay in milliseconds before the first retry. */
  baseDelay: number;
  /** Upper bound on the computed delay in milliseconds. */
  maxDelay: number;
  /** HTTP status codes that are eligible for retry. */
  retryableStatusCodes: number[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Lower bound of the jitter multiplier (−25 %). */
const JITTER_MIN = 0.75;
/** Upper bound of the jitter multiplier (+25 %). */
const JITTER_MAX = 1.25;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses a `Retry-After` header value.
 *
 * Supports two formats defined in RFC 7231:
 * - **Seconds** — a non-negative integer (e.g. `120`).
 * - **HTTP-date** — an absolute timestamp (e.g. `Thu, 01 Dec 1994 16:00:00 GMT`).
 *
 * Returns the delay **in milliseconds**, or `null` when the header is
 * absent or unparseable.
 */
export function parseRetryAfter(header: string | null): number | null {
  if (header == null || header.trim() === '') {
    return null;
  }

  const trimmed = header.trim();

  // Attempt to parse as an integer (seconds).
  const seconds = Number(trimmed);
  if (!Number.isNaN(seconds) && Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds) * 1000;
  }

  // Attempt to parse as an HTTP-date.
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    const delta = date.getTime() - Date.now();
    return Math.max(0, delta);
  }

  return null;
}

/**
 * Calculates the delay for a given retry `attempt` using exponential
 * backoff with +/-25 % jitter.
 *
 * @param attempt   - Zero-based attempt index (0 = first retry).
 * @param baseDelay - Base delay in milliseconds.
 * @param maxDelay  - Maximum allowed delay in milliseconds.
 * @returns Delay in milliseconds.
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelay);

  // Apply +/-25 % jitter.
  const jitterFactor = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN); // [0.75, 1.25)
  return Math.round(capped * jitterFactor);
}

// ---------------------------------------------------------------------------
// Retry-aware error helpers
// ---------------------------------------------------------------------------

interface ErrorWithStatus {
  statusCode?: number;
  status?: number;
}

interface ErrorWithRecoverable {
  recoverable?: boolean;
}

interface ErrorWithRetryAfter {
  retryAfter?: number;
}

/**
 * Returns `true` when the error is eligible for retry.
 *
 * An error is retryable when:
 * - its HTTP status code is in the configured set of retryable codes, **or**
 * - it carries `recoverable: true` (e.g. network errors, timeout errors that
 *   have no `statusCode`).
 */
export function isRetryableError(
  error: unknown,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }

  // Check recoverable flag first — this covers network and timeout errors
  // that have no statusCode.
  if ((error as ErrorWithRecoverable).recoverable === true) {
    return true;
  }

  const statusError = error as ErrorWithStatus;
  const status = statusError.statusCode ?? statusError.status;

  if (typeof status !== 'number') {
    return false;
  }

  return config.retryableStatusCodes.includes(status);
}

// ---------------------------------------------------------------------------
// Core retry wrapper
// ---------------------------------------------------------------------------

/**
 * Executes `fn` and retries it up to `config.maxRetries` times when a
 * retryable error is encountered.
 *
 * The delay between attempts uses exponential backoff with jitter, but will
 * honour a `Retry-After` value carried on the error when available.
 *
 * @typeParam T - Resolved type of the wrapped function.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  logger?: Logger,
  signal?: AbortSignal,
): Promise<T> {
  const resolved: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const log: Logger = logger ?? new NoopLogger();

  let lastError: unknown;

  for (let attempt = 0; attempt <= resolved.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // If we have exhausted all retries, bail out immediately.
      if (attempt >= resolved.maxRetries) {
        log.error(
          `Retry limit reached after ${resolved.maxRetries} attempts`,
        );
        break;
      }

      // Only retry when the error is eligible.
      if (!isRetryableError(error, resolved)) {
        log.debug('Error is not retryable, propagating immediately');
        break;
      }

      // Determine delay — prefer Retry-After from the error when present.
      let delay: number;
      const retryAfterMs =
        typeof (error as ErrorWithRetryAfter).retryAfter === 'number'
          ? (error as ErrorWithRetryAfter).retryAfter! * 1000
          : null;

      if (retryAfterMs != null && retryAfterMs > 0) {
        delay = Math.min(retryAfterMs, resolved.maxDelay);
      } else {
        delay = calculateDelay(attempt, resolved.baseDelay, resolved.maxDelay);
      }

      log.warn(
        `Attempt ${attempt + 1}/${resolved.maxRetries} failed. ` +
          `Retrying in ${delay}ms...`,
      );

      await sleep(delay, signal);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      // Remove the abort listener when the timer fires normally to prevent leaks.
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
    } else {
      setTimeout(resolve, ms);
    }
  });
}
