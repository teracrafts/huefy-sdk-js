import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  CircuitOpenError,
} from '../http/circuit-breaker';
import { ErrorCode } from '../errors/error-codes';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with default config', () => {
    beforeEach(() => {
      breaker = new CircuitBreaker();
    });

    it('starts in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('transitions to OPEN after failureThreshold failures (default 5)', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('rejects calls with CircuitOpenError when OPEN', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trip the breaker (default threshold = 5)
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Next call should be rejected immediately with CircuitOpenError
      try {
        await breaker.execute(vi.fn());
        // Should not reach here
        expect.unreachable('Expected CircuitOpenError to be thrown');
      } catch (err) {
        // CircuitOpenError extends Error directly, not HuefyError
        expect(err).toBeInstanceOf(CircuitOpenError);
        expect((err as CircuitOpenError).code).toBe(ErrorCode.CIRCUIT_OPEN);
      }
    });

    it('reset() returns to CLOSED state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('getStats() returns correct statistics', async () => {
      const successFn = vi.fn().mockResolvedValue('ok');
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      await breaker.execute(successFn);
      await breaker.execute(successFn);
      await expect(breaker.execute(failingFn)).rejects.toThrow();

      const stats = breaker.getStats();

      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(1);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('with custom config', () => {
    beforeEach(() => {
      breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 100,
      });
    });

    it('transitions to OPEN after custom failureThreshold', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('transitions to HALF_OPEN after resetTimeout when execute is called', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('ok');

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Advance past the reset timeout
      vi.advanceTimersByTime(150);

      // The circuit transitions to HALF_OPEN lazily when execute() is called.
      // A successful call during that probe transitions it to CLOSED.
      await breaker.execute(successFn);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('transitions back to CLOSED on success in HALF_OPEN', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('ok');

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout, then a successful call closes the circuit
      vi.advanceTimersByTime(150);

      // The execute() call triggers OPEN -> HALF_OPEN -> CLOSED on success
      await breaker.execute(successFn);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('transitions back to OPEN on failure in HALF_OPEN', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      vi.advanceTimersByTime(150);

      // The execute() call triggers OPEN -> HALF_OPEN, and failure re-opens it
      await expect(breaker.execute(failingFn)).rejects.toThrow('fail');

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });
});
