import { ErrorCode, getNumericCode } from '../errors/error-codes';
import type { Logger } from '../utils/logger';
import { NoopLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures required to trip the circuit. */
  failureThreshold: number;
  /** Milliseconds to wait before transitioning from OPEN to HALF_OPEN. */
  resetTimeout: number;
  /** Number of trial requests allowed in the HALF_OPEN state. */
  halfOpenRequests: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30_000,
  halfOpenRequests: 1,
};

// ---------------------------------------------------------------------------
// CircuitOpenError
// ---------------------------------------------------------------------------

/**
 * Thrown when a request is rejected because the circuit breaker is in the
 * OPEN state.
 */
export class CircuitOpenError extends Error {
  readonly code = ErrorCode.CIRCUIT_OPEN;
  readonly numericCode = getNumericCode(ErrorCode.CIRCUIT_OPEN);
  /** Seconds until the circuit transitions to HALF_OPEN. */
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      `Circuit breaker is open. Retry after ${retryAfter}s.`,
    );
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'CircuitOpenError';
    this.retryAfter = retryAfter;
  }
}

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly logger: Logger;

  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private halfOpenAttempts = 0;
  private activeHalfOpenRequests = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;

  constructor(config: Partial<CircuitBreakerConfig> = {}, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger ?? new NoopLogger();
  }

  /**
   * Wraps an asynchronous operation with circuit breaker semantics.
   *
   * - **CLOSED** — the operation runs normally.  A failure increments the
   *   failure counter; when the threshold is reached the circuit opens.
   * - **OPEN** — requests are rejected immediately with a
   *   {@link CircuitOpenError} until `resetTimeout` has elapsed, at which
   *   point the circuit moves to HALF_OPEN.
   * - **HALF_OPEN** — a limited number of probe requests are allowed
   *   through.  Success closes the circuit; failure re-opens it.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    switch (this.state) {
      case CircuitState.OPEN:
        return this.handleOpen(fn);
      case CircuitState.HALF_OPEN:
        return this.handleHalfOpen(fn);
      case CircuitState.CLOSED:
      default:
        return this.handleClosed(fn);
    }
  }

  /** Returns the current circuit state. */
  getState(): CircuitState {
    return this.state;
  }

  /** Resets the circuit breaker to a pristine CLOSED state. */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenAttempts = 0;
    this.activeHalfOpenRequests = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.logger.info('Circuit breaker reset to CLOSED');
  }

  /** Returns a snapshot of the circuit breaker statistics. */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailureTime,
      lastSuccess: this.lastSuccessTime,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async handleClosed<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
      throw error;
    }
  }

  private async handleOpen<T>(fn: () => Promise<T>): Promise<T> {
    const elapsed = Date.now() - (this.lastFailureTime ?? 0);

    if (elapsed >= this.config.resetTimeout) {
      this.transitionTo(CircuitState.HALF_OPEN);
      this.halfOpenAttempts = 0;
      return this.handleHalfOpen(fn);
    }

    const retryAfterSeconds = Math.ceil(
      (this.config.resetTimeout - elapsed) / 1000,
    );
    throw new CircuitOpenError(retryAfterSeconds);
  }

  private async handleHalfOpen<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeHalfOpenRequests >= this.config.halfOpenRequests) {
      const retryAfterSeconds = Math.ceil(this.config.resetTimeout / 1000);
      throw new CircuitOpenError(retryAfterSeconds);
    }

    this.activeHalfOpenRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      this.transitionTo(CircuitState.CLOSED);
      return result;
    } catch (error) {
      this.onFailure();
      this.transitionTo(CircuitState.OPEN);
      throw error;
    } finally {
      this.activeHalfOpenRequests--;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    // Reset consecutive failure count on success in CLOSED state.
    if (this.state === CircuitState.CLOSED) {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }

  private transitionTo(newState: CircuitState): void {
    const previous = this.state;
    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.halfOpenAttempts = 0;
      // Note: activeHalfOpenRequests is decremented by the finally block in
      // handleHalfOpen — do NOT reset it here or the finally decrement goes negative.
    }

    this.logger.info(
      `Circuit breaker transitioned: ${previous} -> ${newState}`,
    );
  }
}
