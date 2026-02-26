import { ErrorCode, getNumericCode, isRecoverableCode } from './error-codes';
import { parseRetryAfter } from '../http/retry';

export interface HuefyErrorOptions {
  statusCode?: number;
  recoverable?: boolean;
  retryAfter?: number;
  requestId?: string;
  details?: Record<string, unknown>;
}

/**
 * Base error class for the SDK template.
 *
 * > The class name `HuefyError` is a placeholder.  The scaffolding tool
 * > will rename it to match the concrete SDK (e.g. `HuefyError`).
 *
 * Every SDK error carries a structured {@link ErrorCode}, a numeric
 * companion code, and optional metadata that helps callers decide
 * whether to retry the operation.
 */
export class HuefyError extends Error {
  /** Canonical error code. */
  readonly code: ErrorCode;

  /** Stable numeric identifier matching {@link code}. */
  readonly numericCode: number;

  /** HTTP status code when the error originates from an API response. */
  readonly statusCode?: number;

  /** `true` when the error represents a transient failure worth retrying. */
  readonly recoverable: boolean;

  /** Seconds the caller should wait before retrying, if available. */
  readonly retryAfter?: number;

  /** Server-assigned request identifier for correlation. */
  readonly requestId?: string;

  /** Epoch millisecond timestamp of when the error was created. */
  readonly timestamp: number;

  /** Arbitrary structured metadata attached to the error. */
  readonly details: Record<string, unknown>;

  constructor(message: string, code: ErrorCode, options: HuefyErrorOptions = {}) {
    super(message);

    // Maintain proper prototype chain for instanceof checks.
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = 'HuefyError';
    this.code = code;
    this.numericCode = getNumericCode(code);
    this.statusCode = options.statusCode;
    this.recoverable = options.recoverable ?? isRecoverableCode(code);
    this.retryAfter = options.retryAfter;
    this.requestId = options.requestId;
    this.timestamp = Date.now();
    this.details = options.details ?? {};
  }

  // ---------------------------------------------------------------------------
  // Static factory helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates an error representing a generic network failure.
   */
  static NetworkError(message: string, cause?: Error): HuefyError {
    const details: Record<string, unknown> = {};
    if (cause) {
      details.cause = cause.message;
      details.causeName = cause.name;
    }
    return new HuefyError(message, ErrorCode.NETWORK_ERROR, {
      recoverable: true,
      details,
    });
  }

  /**
   * Creates an authentication error.
   *
   * @param code - Defaults to {@link ErrorCode.AUTH_INVALID_KEY}.
   */
  static AuthenticationError(
    message: string,
    code: ErrorCode = ErrorCode.AUTH_INVALID_KEY,
  ): HuefyError {
    return new HuefyError(message, code, {
      recoverable: false,
    });
  }

  /**
   * Creates a timeout error (recoverable by default).
   */
  static TimeoutError(message: string): HuefyError {
    return new HuefyError(message, ErrorCode.NETWORK_TIMEOUT, {
      recoverable: true,
    });
  }

  /**
   * Maps an HTTP response status and body to the most appropriate error.
   *
   * @param status           - HTTP status code.
   * @param body             - Parsed response body (or raw string).
   * @param retryAfterHeader - Raw value of the `Retry-After` response header.
   */
  static createErrorFromResponse(
    status: number,
    body: Record<string, unknown> | string,
    retryAfterHeader?: string | null,
  ): HuefyError {
    const parsed: Record<string, unknown> = typeof body === 'string' ? { raw: body } : body;
    const serverMessage =
      (typeof parsed.message === 'string' ? parsed.message : undefined) ??
      (typeof parsed.error === 'string' ? parsed.error : undefined) ??
      `Request failed with status ${status}`;
    const requestId = typeof parsed.requestId === 'string' ? parsed.requestId : undefined;

    // Parse the Retry-After header (seconds) — used for 429 and optionally 503.
    const retryAfterMs = parseRetryAfter(retryAfterHeader ?? null);
    // Convert milliseconds to seconds for the error's retryAfter field.
    const retryAfterSec =
      retryAfterMs != null ? Math.ceil(retryAfterMs / 1000) : undefined;

    // 401 Unauthorized
    if (status === 401) {
      return new HuefyError(serverMessage, ErrorCode.AUTH_UNAUTHORIZED, {
        statusCode: status,
        recoverable: false,
        requestId,
        details: parsed,
      });
    }

    // 403 Forbidden — treat as invalid / expired key
    if (status === 403) {
      return new HuefyError(serverMessage, ErrorCode.AUTH_INVALID_KEY, {
        statusCode: status,
        recoverable: false,
        requestId,
        details: parsed,
      });
    }

    // 429 Too Many Requests — prefer header-based Retry-After, fall back to body
    if (status === 429) {
      const retryAfter =
        retryAfterSec ??
        (typeof parsed.retryAfter === 'number'
          ? parsed.retryAfter
          : typeof parsed.retry_after === 'number'
            ? parsed.retry_after
            : undefined);

      return new HuefyError(serverMessage, ErrorCode.NETWORK_RETRY_LIMIT, {
        statusCode: status,
        recoverable: true,
        retryAfter,
        requestId,
        details: parsed,
      });
    }

    // 5xx Server errors
    if (status >= 500) {
      const code =
        status === 503
          ? ErrorCode.NETWORK_SERVICE_UNAVAILABLE
          : ErrorCode.NETWORK_ERROR;

      return new HuefyError(serverMessage, code, {
        statusCode: status,
        recoverable: true,
        retryAfter: retryAfterSec,
        requestId,
        details: parsed,
      });
    }

    // 4xx catch-all
    return new HuefyError(serverMessage, ErrorCode.VALIDATION_ERROR, {
      statusCode: status,
      recoverable: false,
      requestId,
      details: parsed,
    });
  }
}
