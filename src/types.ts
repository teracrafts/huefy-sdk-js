/**
 * Huefy SDK Types
 * TypeScript type definitions for the Huefy email sending API
 */

/**
 * Supported email providers
 */
export type EmailProvider = 'ses' | 'sendgrid' | 'mailgun' | 'mailchimp';

/**
 * Configuration for the Huefy client
 */
export interface HuefyConfig {
  /** Your Huefy API key */
  apiKey: string;
  /** Base URL for the API (optional) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 3) */
  retryAttempts?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Template data for email variables
 */
export interface EmailData {
  [key: string]: string;
}

/**
 * Options for sending an email
 */
export interface SendEmailOptions {
  /** Email provider to use (optional, defaults to 'ses') */
  provider?: EmailProvider;
}

/**
 * Request payload for sending an email
 */
export interface SendEmailRequest {
  /** The template key/identifier */
  templateKey: string;
  /** Template variables */
  data: EmailData;
  /** Recipient email address */
  recipient: string;
  /** Email provider (optional, defaults to 'ses') */
  providerType?: EmailProvider;
}

/**
 * Response from sending an email
 */
export interface SendEmailResponse {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Human-readable status message */
  message: string;
  /** Unique identifier for the sent email */
  messageId: string;
  /** The provider that was used to send the email */
  provider: EmailProvider;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** The field that failed validation */
  field: string;
  /** Validation error message */
  message: string;
  /** Validation error code */
  code?: string;
}

/**
 * API error response
 */
export interface ErrorResponse {
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code */
  code: string;
  /** Additional error details */
  details?: {
    [key: string]: any;
    templateKey?: string;
    missingVariables?: string[];
    validationErrors?: ValidationError[];
  };
}

/**
 * Error codes returned by the API
 */
export enum ErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  INVALID_TEMPLATE_DATA = 'INVALID_TEMPLATE_DATA',
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Health check response
 */
export interface HealthResponse {
  /** Service status */
  status: string;
  /** Timestamp of the health check */
  timestamp: string;
  /** API version */
  version: string;
}

/**
 * SDK result type for successful operations
 */
export interface HuefyResult<T = SendEmailResponse> {
  /** The result data */
  data: T;
  /** Whether the operation was successful */
  success: true;
}

/**
 * SDK error type for failed operations
 */
export interface HuefyError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** HTTP status code */
  statusCode?: number;
  /** Additional error details */
  details?: any;
  /** Whether the operation was successful */
  success: false;
}

/**
 * Unified result type that can be either success or error
 */
export type HuefyResponse<T = SendEmailResponse> = HuefyResult<T> | HuefyError;

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds */
  initialDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: number[];
}

/**
 * Internal HTTP response type
 */
export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * Event callback types for monitoring
 */
export interface HuefyEventCallbacks {
  /** Called when an email send attempt starts */
  onSendStart?: (request: SendEmailRequest) => void;
  /** Called when an email is sent successfully */
  onSendSuccess?: (response: SendEmailResponse) => void;
  /** Called when an email send fails */
  onSendError?: (error: HuefyError) => void;
  /** Called before a retry attempt */
  onRetry?: (attempt: number, error: HuefyError) => void;
}