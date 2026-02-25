/**
 * Canonical error codes used throughout the Huefy SDK.
 *
 * Each member carries a human-readable string value for serialisation
 * and logging.  A companion numeric code map is provided for systems
 * that require integer identifiers.
 */
export enum ErrorCode {
  // Initialisation
  INIT_FAILED = 'INIT_FAILED',
  INIT_TIMEOUT = 'INIT_TIMEOUT',

  // Authentication
  AUTH_INVALID_KEY = 'AUTH_INVALID_KEY',
  AUTH_EXPIRED_KEY = 'AUTH_EXPIRED_KEY',
  AUTH_MISSING_KEY = 'AUTH_MISSING_KEY',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',

  // Network
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_RETRY_LIMIT = 'NETWORK_RETRY_LIMIT',
  NETWORK_SERVICE_UNAVAILABLE = 'NETWORK_SERVICE_UNAVAILABLE',

  // Circuit breaker
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',

  // Configuration
  CONFIG_INVALID_URL = 'CONFIG_INVALID_URL',
  CONFIG_MISSING_REQUIRED = 'CONFIG_MISSING_REQUIRED',

  // Security
  SECURITY_PII_DETECTED = 'SECURITY_PII_DETECTED',
  SECURITY_SIGNATURE_INVALID = 'SECURITY_SIGNATURE_INVALID',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Maps each {@link ErrorCode} to a stable numeric identifier.
 */
export const numericCodeMap: Record<ErrorCode, number> = {
  [ErrorCode.INIT_FAILED]: 1000,
  [ErrorCode.INIT_TIMEOUT]: 1001,

  [ErrorCode.AUTH_INVALID_KEY]: 1100,
  [ErrorCode.AUTH_EXPIRED_KEY]: 1101,
  [ErrorCode.AUTH_MISSING_KEY]: 1102,
  [ErrorCode.AUTH_UNAUTHORIZED]: 1103,

  [ErrorCode.NETWORK_ERROR]: 1200,
  [ErrorCode.NETWORK_TIMEOUT]: 1201,
  [ErrorCode.NETWORK_RETRY_LIMIT]: 1202,
  [ErrorCode.NETWORK_SERVICE_UNAVAILABLE]: 1203,

  [ErrorCode.CIRCUIT_OPEN]: 1300,

  [ErrorCode.CONFIG_INVALID_URL]: 1400,
  [ErrorCode.CONFIG_MISSING_REQUIRED]: 1401,

  [ErrorCode.SECURITY_PII_DETECTED]: 1500,
  [ErrorCode.SECURITY_SIGNATURE_INVALID]: 1501,

  [ErrorCode.VALIDATION_ERROR]: 1600,
};

/**
 * Returns the numeric code for a given {@link ErrorCode}.
 */
export function getNumericCode(code: ErrorCode): number {
  return numericCodeMap[code];
}

/** Set of error codes that represent transient / recoverable failures. */
const RECOVERABLE_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  ErrorCode.NETWORK_ERROR,
  ErrorCode.NETWORK_TIMEOUT,
  ErrorCode.NETWORK_RETRY_LIMIT,
  ErrorCode.NETWORK_SERVICE_UNAVAILABLE,
  ErrorCode.CIRCUIT_OPEN,
]);

/**
 * Returns `true` when the given error code represents a transient failure
 * that may succeed on retry.
 */
export function isRecoverableCode(code: ErrorCode): boolean {
  return RECOVERABLE_CODES.has(code);
}
