import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../http/circuit-breaker';
import { HuefyError } from '../errors/huefy-error';
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

      // Next call should be rejected immediately with circuit-open error
      await expect(breaker.execute(vi.fn())).rejects.toThrow();

      try {
        await breaker.execute(vi.fn());
      } catch (err) {
        expect(err).toBeInstanceOf(HuefyError);
        expect((err as HuefyError).code).toBe(ErrorCode.CIRCUIT_OPEN);
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

    it('transitions to HALF_OPEN after resetTimeout', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Advance past the reset timeout
      vi.advanceTimersByTime(150);

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('transitions back to CLOSED on success in HALF_OPEN', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('ok');

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout to transition to HALF_OPEN
      vi.advanceTimersByTime(150);

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Successful call should close the circuit
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

      // Wait for reset timeout to transition to HALF_OPEN
      vi.advanceTimersByTime(150);

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Failure in HALF_OPEN should re-open the circuit
      await expect(breaker.execute(failingFn)).rejects.toThrow('fail');

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });
});
