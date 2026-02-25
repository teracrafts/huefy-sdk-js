import type { RetryConfig } from '../http/retry';
import type { CircuitBreakerConfig } from '../http/circuit-breaker';
import type { Logger } from '../utils/logger';

export interface HuefyConfig {
  /** API key for authentication */
  apiKey: string;
  /** Custom base URL (overrides environment detection) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Logger instance */
  logger?: Logger;
  /** Retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Circuit breaker configuration */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  /** Secondary API key for key rotation */
  secondaryApiKey?: string;
  /** Enable HMAC request signing */
  enableRequestSigning?: boolean;
  /** Enable error message sanitization */
  enableErrorSanitization?: boolean;
}

export type { RetryConfig } from '../http/retry';
export type { CircuitBreakerConfig } from '../http/circuit-breaker';
export type { Logger } from '../utils/logger';
