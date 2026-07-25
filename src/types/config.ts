import type { RetryConfig } from '../http/retry';
import type { CircuitBreakerConfig } from '../http/circuit-breaker';
import type { RateLimitInfo } from '../http/http-client';
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
  /** Called after each response when rate limit headers are present */
  onRateLimitUpdate?: (info: RateLimitInfo) => void;
  /** Called when remaining requests fall below 20% of limit */
  onRateLimitWarning?: (info: RateLimitInfo) => void;
}

export type { RetryConfig } from '../http/retry';
export type { CircuitBreakerConfig } from '../http/circuit-breaker';
export type { RateLimitInfo } from '../http/http-client';
export type { Logger } from '../utils/logger';
