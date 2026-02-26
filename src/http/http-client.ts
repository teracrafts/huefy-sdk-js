import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import type { CircuitBreakerConfig } from './circuit-breaker';
import { withRetry, DEFAULT_RETRY_CONFIG } from './retry';
import type { RetryConfig } from './retry';
import { HuefyError } from '../errors/huefy-error';
import { ErrorCode } from '../errors/error-codes';
import type { Logger } from '../utils/logger';
import { NoopLogger } from '../utils/logger';
import { SDK_VERSION } from '../utils/version';
import { getSDKUserAgent, isNode } from '../utils/platform';
import { createRequestSignature } from '../utils/security';
import { sanitizeErrorMessage } from '../errors/error-sanitizer';

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

/** Default production base URL. */
export const BASE_URL = 'https://api.huefy.dev/api/v1/sdk';

/** Base URL used when running in local development mode. */
export const LOCAL_BASE_URL = 'https://api.huefy.on/api/v1/sdk';

/**
 * Resolves the base URL for API requests.
 *
 * Checks the `HUEFY_MODE` environment variable (Node.js) or the
 * equivalent global variable (browser).  When the value is `"local"` the
 * {@link LOCAL_BASE_URL} is returned; otherwise {@link BASE_URL}.
 */
export function getBaseUrl(): string {
  let mode: string | undefined;

  // Node.js
  if (typeof process !== 'undefined' && process.env) {
    mode = process.env['HUEFY_MODE'];
  }

  // Browser / global fallback
  if (!mode && typeof globalThis !== 'undefined') {
    mode = (globalThis as Record<string, unknown>)['HUEFY_MODE'] as
      | string
      | undefined;
  }

  return mode === 'local' ? LOCAL_BASE_URL : BASE_URL;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  /** Request timeout in milliseconds (default: 30 000). */
  timeout?: number;
  /** An existing `AbortSignal` to honour. */
  signal?: AbortSignal;
  /** Skip the retry wrapper for this request. */
  skipRetry?: boolean;
  /** Skip automatic `X-API-Key` header injection. */
  skipAuth?: boolean;
}

export interface HttpClientOptions {
  baseUrl?: string;
  /** Default request timeout in milliseconds. */
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  logger?: Logger;
  /** Fallback API key used when the primary key receives a 401. */
  secondaryApiKey?: string;
  /** When `true`, every request includes HMAC signature headers. */
  enableRequestSigning?: boolean;
}

// ---------------------------------------------------------------------------
// HttpClient
// ---------------------------------------------------------------------------

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly logger: Logger;
  private readonly secondaryApiKey?: string;
  private readonly enableRequestSigning: boolean;

  constructor(apiKey: string, options: HttpClientOptions = {}) {
    if (!apiKey || apiKey.trim() === '') {
      throw new HuefyError(
        'API key is required',
        ErrorCode.AUTH_MISSING_KEY,
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? getBaseUrl()).replace(/\/+$/, '');
    this.timeout = options.timeout ?? 30_000;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    this.circuitBreaker = new CircuitBreaker(
      options.circuitBreakerConfig,
      options.logger,
    );
    this.logger = options.logger ?? new NoopLogger();
    this.secondaryApiKey = options.secondaryApiKey;
    this.enableRequestSigning = options.enableRequestSigning ?? false;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Sends an HTTP request to the API.
   *
   * The request is wrapped with the circuit breaker and, unless `skipRetry`
   * is set, the retry policy.  On a 401 response, when a secondary API key
   * is configured the request is transparently retried with that key before
   * the error is propagated.
   *
   * @typeParam T - Expected shape of the parsed JSON response body.
   */
  async request<T = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const method = options.method ?? 'GET';
    const requestTimeout = options.timeout ?? this.timeout;

    // -- Serialise body (moved before headers so Content-Type is conditional) -
    const serialisedBody =
      options.body != null
        ? typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
        : undefined;

    // -- Build headers -------------------------------------------------------
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-SDK-Version': SDK_VERSION,
      ...options.headers,
    };

    // Only set Content-Type when there is a request body.
    if (serialisedBody !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    // User-Agent is only safe to set in Node.js (browsers disallow it).
    if (isNode()) {
      headers['User-Agent'] = getSDKUserAgent();
    }

    if (!options.skipAuth) {
      headers['X-API-Key'] = this.apiKey;
    }

    // -- Request signing (optional) ------------------------------------------
    if (this.enableRequestSigning && !options.skipAuth) {
      const sig = await createRequestSignature(
        serialisedBody ?? '',
        this.apiKey,
      );
      headers['X-Timestamp'] = sig.timestamp.toString();
      headers['X-Key-Id'] = sig.keyId;
      headers['X-Signature'] = sig.signature;
    }

    // -- Execute with circuit breaker (and optional retry) --------------------
    const execute = async (overrideHeaders?: Record<string, string>) => {
      const finalHeaders = overrideHeaders
        ? { ...headers, ...overrideHeaders }
        : headers;

      return this.circuitBreaker.execute<T>(async () => {
        const controller = new AbortController();
        const externalSignal = options.signal;

        // Honour an external AbortSignal if supplied.
        const onExternalAbort = () => controller.abort();
        externalSignal?.addEventListener('abort', onExternalAbort, {
          once: true,
        });

        const timer = setTimeout(() => controller.abort(), requestTimeout);

        try {
          const response = await fetch(url, {
            method,
            headers: finalHeaders,
            body: serialisedBody,
            signal: controller.signal,
          });

          if (!response.ok) {
            const retryAfterHeader = response.headers.get('Retry-After');
            const body = await this.safeParseBody(response);
            // Sanitize response body messages before creating errors
            const sanitizedBody = typeof body === 'string'
              ? sanitizeErrorMessage(body)
              : {
                  ...body,
                  ...(typeof body.message === 'string'
                    ? { message: sanitizeErrorMessage(body.message) }
                    : {}),
                  ...(typeof body.error === 'string'
                    ? { error: sanitizeErrorMessage(body.error) }
                    : {}),
                };
            const apiError = HuefyError.createErrorFromResponse(
              response.status,
              sanitizedBody,
              retryAfterHeader,
            );
            throw apiError;
          }

          // 204 No Content — return empty object as T.
          if (response.status === 204) {
            return {} as T;
          }

          return (await response.json()) as T;
        } catch (error: unknown) {
          if (error instanceof HuefyError) {
            throw error;
          }
          if (error instanceof CircuitOpenError) {
            throw error;
          }

          // AbortController fires DOMException with name "AbortError".
          if (
            error instanceof DOMException &&
            error.name === 'AbortError'
          ) {
            throw HuefyError.TimeoutError(
              sanitizeErrorMessage(`Request to ${method} ${path} timed out after ${requestTimeout}ms`),
            );
          }

          const networkMsg = sanitizeErrorMessage(`Network error during ${method} ${path}`);
          const cause = error instanceof Error ? error : undefined;
          throw HuefyError.NetworkError(networkMsg, cause);
        } finally {
          clearTimeout(timer);
          externalSignal?.removeEventListener('abort', onExternalAbort);
        }
      });
    };

    // -- Retry wrapper -------------------------------------------------------
    const executeWithRetry = async (
      overrideHeaders?: Record<string, string>,
    ): Promise<T> => {
      if (options.skipRetry) {
        return execute(overrideHeaders);
      }
      return withRetry(() => execute(overrideHeaders), this.retryConfig, this.logger, options.signal);
    };

    try {
      return await executeWithRetry();
    } catch (error: unknown) {
      // Transparent secondary-key fallback on 401.
      if (
        this.secondaryApiKey &&
        error instanceof HuefyError &&
        error.statusCode === 401
      ) {
        this.logger.warn(
          'Primary API key returned 401. Retrying with secondary key.',
        );

        const fallbackHeaders: Record<string, string> = {
          'X-API-Key': this.secondaryApiKey,
        };

        // Recompute request signature with the secondary key.
        if (this.enableRequestSigning) {
          const sig = await createRequestSignature(
            serialisedBody ?? '',
            this.secondaryApiKey,
          );
          fallbackHeaders['X-Timestamp'] = sig.timestamp.toString();
          fallbackHeaders['X-Key-Id'] = sig.keyId;
          fallbackHeaders['X-Signature'] = sig.signature;
        }

        return executeWithRetry(fallbackHeaders);
      }

      throw error;
    }
  }

  /**
   * Resets the circuit breaker to its initial CLOSED state.
   *
   * Call this when you want to force the client to attempt requests again
   * after a prolonged outage, without waiting for the automatic reset
   * timeout.
   */
  close(): void {
    this.circuitBreaker.reset();
    this.logger.info('HttpClient circuit breaker reset');
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Safely parses the response body as JSON, falling back to raw text.
   *
   * Reads the body stream exactly once via `response.text()` and then
   * attempts `JSON.parse`, avoiding the double-consumption bug that
   * occurs when calling `.json()` followed by `.text()` on the same
   * response.
   */
  private async safeParseBody(
    response: Response,
  ): Promise<Record<string, unknown> | string> {
    let text: string;
    try {
      text = await response.text();
    } catch {
      return `Unparseable response (status ${response.status})`;
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return text;
    }
  }

}
