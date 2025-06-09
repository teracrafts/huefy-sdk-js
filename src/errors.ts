/**
 * Huefy SDK Error Classes
 * Custom error types for better error handling and debugging
 */

import type { ErrorResponse, ErrorCode } from './types.js';

/**
 * Base error class for all Huefy SDK errors
 */
export class HuefyError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: any;
  public readonly isHuefyError = true;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode?: number,
    details?: any,
  ) {
    super(message);
    this.name = 'HuefyError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where error was thrown (Node.js only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HuefyError);
    }
  }

  /**
   * Create HuefyError from API error response
   */
  static fromErrorResponse(
    response: ErrorResponse,
    statusCode?: number,
  ): HuefyError {
    return new HuefyError(response.error, response.code, statusCode, response.details);
  }

  /**
   * Convert error to JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Error thrown when API key is invalid or missing
 */
export class AuthenticationError extends HuefyError {
  constructor(message: string = 'Invalid or missing API key', details?: any) {
    super(message, 'INVALID_API_KEY', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when template is not found
 */
export class TemplateNotFoundError extends HuefyError {
  constructor(templateKey: string, details?: any) {
    super(`Template '${templateKey}' not found`, 'TEMPLATE_NOT_FOUND', 404, {
      template_key: templateKey,
      ...details,
    });
    this.name = 'TemplateNotFoundError';
  }
}

/**
 * Error thrown when template data is invalid
 */
export class InvalidTemplateDataError extends HuefyError {
  constructor(message: string = 'Invalid template data', details?: any) {
    super(message, 'INVALID_TEMPLATE_DATA', 400, details);
    this.name = 'InvalidTemplateDataError';
  }
}

/**
 * Error thrown when recipient email is invalid
 */
export class InvalidRecipientError extends HuefyError {
  constructor(recipient: string, details?: any) {
    super(`Invalid recipient email: ${recipient}`, 'INVALID_RECIPIENT', 400, {
      recipient,
      ...details,
    });
    this.name = 'InvalidRecipientError';
  }
}

/**
 * Error thrown when email provider fails
 */
export class ProviderError extends HuefyError {
  constructor(message: string = 'Email provider error', details?: any) {
    super(message, 'PROVIDER_ERROR', 500, details);
    this.name = 'ProviderError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends HuefyError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown for network-related issues
 */
export class NetworkError extends HuefyError {
  constructor(message: string = 'Network error', cause?: Error) {
    super(message, 'NETWORK_ERROR', undefined, { cause: cause?.message });
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when request times out
 */
export class TimeoutError extends HuefyError {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`, 'TIMEOUT_ERROR', undefined, { timeout });
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown for validation failures
 */
export class ValidationError extends HuefyError {
  constructor(message: string = 'Validation error', details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Factory function to create appropriate error from HTTP response
 */
export function createErrorFromResponse(
  data: ErrorResponse,
  statusCode: number,
): HuefyError {
  switch (data.code) {
    case 'INVALID_API_KEY':
      return new AuthenticationError(data.error, data.details);
    
    case 'TEMPLATE_NOT_FOUND':
      return new TemplateNotFoundError(
        data.details?.template_key || 'unknown',
        data.details,
      );
    
    case 'INVALID_TEMPLATE_DATA':
      return new InvalidTemplateDataError(data.error, data.details);
    
    case 'INVALID_RECIPIENT':
      return new InvalidRecipientError(
        data.details?.recipient || 'unknown',
        data.details,
      );
    
    case 'PROVIDER_ERROR':
      return new ProviderError(data.error, data.details);
    
    case 'RATE_LIMIT_EXCEEDED':
      return new RateLimitError(data.error, data.details);
    
    default:
      return new HuefyError(data.error, data.code, statusCode, data.details);
  }
}

/**
 * Type guard to check if error is a HuefyError
 */
export function isHuefyError(error: any): error is HuefyError {
  return error && typeof error === 'object' && error.isHuefyError === true;
}

/**
 * Type guard to check if error is a specific Huefy error type
 */
export function isErrorCode(error: any, code: string): boolean {
  return isHuefyError(error) && error.code === code;
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!isHuefyError(error)) {
    return false;
  }

  // Retry on network errors, timeouts, and 5xx server errors
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }

  if (error.statusCode && error.statusCode >= 500) {
    return true;
  }

  // Don't retry on 4xx client errors (except 429 rate limit)
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return error.statusCode === 429; // Retry on rate limit
  }

  return false;
}