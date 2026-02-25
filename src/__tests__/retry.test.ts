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

      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('Server error');
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
    it('handles seconds string', () => {
      const result = parseRetryAfter('120');
      expect(result).toBe(120);
    });

    it('handles HTTP-date string', () => {
      // Use a fixed date in the future relative to the fake timer start
      const futureDate = new Date(Date.now() + 30_000);
      const httpDate = futureDate.toUTCString();

      const result = parseRetryAfter(httpDate);

      // Should return approximately 30 seconds (allow some tolerance)
      expect(result).toBeGreaterThan(25);
      expect(result).toBeLessThanOrEqual(31);
    });

    it('returns null for invalid input', () => {
      expect(parseRetryAfter('')).toBeNull();
      expect(parseRetryAfter('not-a-date-or-number')).toBeNull();
      expect(parseRetryAfter(undefined as unknown as string)).toBeNull();
    });
  });

  describe('calculateDelay', () => {
    it('applies exponential backoff', () => {
      // Attempt 0 -> baseDelay * 2^0 = baseDelay
      // Attempt 1 -> baseDelay * 2^1 = baseDelay * 2
      // Attempt 2 -> baseDelay * 2^2 = baseDelay * 4
      const base = 100;

      const delay0 = calculateDelay(0, { baseDelay: base, maxDelay: 10000, jitter: false });
      const delay1 = calculateDelay(1, { baseDelay: base, maxDelay: 10000, jitter: false });
      const delay2 = calculateDelay(2, { baseDelay: base, maxDelay: 10000, jitter: false });

      expect(delay0).toBe(100);
      expect(delay1).toBe(200);
      expect(delay2).toBe(400);
    });

    it('adds jitter within expected range', () => {
      const base = 1000;
      const delays = new Set<number>();

      // Run many times to check jitter produces varying results
      for (let i = 0; i < 50; i++) {
        const delay = calculateDelay(0, { baseDelay: base, maxDelay: 10000, jitter: true });
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
      const delay = calculateDelay(20, { baseDelay: 100, maxDelay, jitter: false });

      expect(delay).toBe(maxDelay);
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

    it('returns true for network errors without status code', () => {
      const error = new TypeError('fetch failed');
      expect(isRetryableError(error)).toBe(true);
    });
  });
});
