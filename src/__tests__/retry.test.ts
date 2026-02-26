import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  parseRetryAfter,
  calculateDelay,
  isRetryableError,
} from '../http/retry';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRetry', () => {
    it('succeeds on first attempt without retrying', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable errors up to maxRetries', async () => {
      const retryableError = Object.assign(new Error('Service unavailable'), {
        statusCode: 503,
      });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
      });

      // Flush timers to allow retries to proceed
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws last error after exhausting retries', async () => {
      const error = Object.assign(new Error('Server error'), {
        statusCode: 500,
      });
      const fn = vi.fn().mockRejectedValue(error);

      const resultPromise = withRetry(fn, {
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 100,
      });

      // Attach catch handler immediately to avoid unhandled rejection warnings
      const caughtPromise = resultPromise.catch((e: unknown) => e);

      await vi.runAllTimersAsync();

      const caught = await caughtPromise;
      expect(caught).toBe(error);
      expect((caught as Error).message).toBe('Server error');
      // 1 initial + 2 retries = 3 total calls
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('respects Retry-After header (seconds format)', async () => {
      const retryableError = Object.assign(new Error('Rate limited'), {
        statusCode: 429,
        retryAfter: 2,
      });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 5000,
      });

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('parseRetryAfter', () => {
    it('handles seconds string and returns milliseconds', () => {
      // parseRetryAfter returns delay in milliseconds
      const result = parseRetryAfter('120');
      expect(result).toBe(120_000);
    });

    it('handles HTTP-date string and returns milliseconds', () => {
      // Use a fixed date in the future relative to the fake timer start
      const futureDate = new Date(Date.now() + 30_000);
      const httpDate = futureDate.toUTCString();

      const result = parseRetryAfter(httpDate);

      // Should return approximately 30,000 ms (allow some tolerance)
      expect(result).toBeGreaterThan(25_000);
      expect(result).toBeLessThanOrEqual(31_000);
    });

    it('returns null for invalid input', () => {
      expect(parseRetryAfter('')).toBeNull();
      expect(parseRetryAfter('not-a-date-or-number')).toBeNull();
      expect(parseRetryAfter(undefined as unknown as string)).toBeNull();
    });
  });

  describe('calculateDelay', () => {
    it('applies exponential backoff with jitter within expected range', () => {
      // The actual signature is calculateDelay(attempt, baseDelay, maxDelay).
      // Jitter is always applied (+/-25%), so we check ranges instead of exact values.
      const base = 100;

      // Attempt 0 -> base * 2^0 = 100, with jitter: [75, 125]
      const delay0 = calculateDelay(0, base, 10000);
      expect(delay0).toBeGreaterThanOrEqual(75);
      expect(delay0).toBeLessThanOrEqual(125);

      // Attempt 1 -> base * 2^1 = 200, with jitter: [150, 250]
      const delay1 = calculateDelay(1, base, 10000);
      expect(delay1).toBeGreaterThanOrEqual(150);
      expect(delay1).toBeLessThanOrEqual(250);

      // Attempt 2 -> base * 2^2 = 400, with jitter: [300, 500]
      const delay2 = calculateDelay(2, base, 10000);
      expect(delay2).toBeGreaterThanOrEqual(300);
      expect(delay2).toBeLessThanOrEqual(500);
    });

    it('adds jitter producing varying results', () => {
      const base = 1000;
      const delays = new Set<number>();

      // Run many times to check jitter produces varying results
      for (let i = 0; i < 50; i++) {
        const delay = calculateDelay(0, base, 10000);
        delays.add(delay);

        // Jitter should be within +/- 25% of the base delay
        expect(delay).toBeGreaterThanOrEqual(base * 0.75);
        expect(delay).toBeLessThanOrEqual(base * 1.25);
      }

      // With 50 iterations, jitter should produce at least a few different values
      expect(delays.size).toBeGreaterThan(1);
    });

    it('caps at maxDelay', () => {
      const maxDelay = 500;

      // High attempt number would produce very large delay without cap
      // With jitter the result should be in [maxDelay*0.75, maxDelay*1.25]
      const delay = calculateDelay(20, 100, maxDelay);

      expect(delay).toBeGreaterThanOrEqual(maxDelay * 0.75);
      expect(delay).toBeLessThanOrEqual(maxDelay * 1.25);
    });
  });

  describe('isRetryableError', () => {
    it.each([429, 500, 502, 503, 504])(
      'returns true for status code %d',
      (statusCode) => {
        const error = Object.assign(new Error('fail'), { statusCode });
        expect(isRetryableError(error)).toBe(true);
      },
    );

    it.each([400, 401, 403, 404, 422])(
      'returns false for status code %d',
      (statusCode) => {
        const error = Object.assign(new Error('fail'), { statusCode });
        expect(isRetryableError(error)).toBe(false);
      },
    );

    it('returns false for errors without a status code', () => {
      // isRetryableError only checks statusCode/status properties,
      // so errors without a numeric status code are not retryable
      const error = new TypeError('fetch failed');
      expect(isRetryableError(error)).toBe(false);
    });
  });
});
