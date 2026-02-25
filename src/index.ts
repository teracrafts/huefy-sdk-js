// Client
export { HuefyClient } from './client';

// Configuration types
export type {
  HuefyConfig,
  RetryConfig,
  CircuitBreakerConfig,
  Logger,
} from './types/config';

// Errors
export { HuefyError } from './errors/huefy-error';
export {
  ErrorCode,
  getNumericCode,
  isRecoverableCode,
} from './errors/error-codes';
export {
  sanitizeErrorMessage,
  type ErrorSanitizationConfig,
} from './errors/error-sanitizer';

// HTTP
export {
  HttpClient,
  type RequestOptions,
  BASE_URL,
  LOCAL_BASE_URL,
  getBaseUrl,
} from './http/http-client';
export {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitBreakerStats,
} from './http/circuit-breaker';
export {
  withRetry,
  parseRetryAfter,
  calculateDelay,
  DEFAULT_RETRY_CONFIG,
} from './http/retry';

// Security utilities
export {
  isPotentialPIIField,
  detectPotentialPII,
  warnIfPotentialPII,
  signPayload,
  createRequestSignature,
  verifyRequestSignature,
  getKeyId,
  isServerKey,
  isClientKey,
  type SignedPayload,
  type RequestSignature,
} from './utils/security';

// Logging
export { ConsoleLogger, NoopLogger, createLogger } from './utils/logger';

// Platform detection
export {
  isBrowser,
  isNode,
  getEnvironment,
  getSDKUserAgent,
} from './utils/platform';

// Version
export { SDK_VERSION, getVersion } from './utils/version';
