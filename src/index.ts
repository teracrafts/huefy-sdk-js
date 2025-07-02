/**
 * Huefy SDK for JavaScript/TypeScript
 * 
 * @packageDocumentation
 */

// Export main client
export { HuefyClient } from './client.js';

// Export HTTP client (for advanced use cases)
export { HttpClient } from './http.js';

// Export all types
export type {
  HuefyConfig,
  EmailProvider,
  EmailData,
  SendEmailOptions,
  SendEmailRequest,
  SendEmailResponse,
  ErrorResponse,
  HealthResponse,
  HuefyResult,
  HuefyError as HuefyErrorType,
  HuefyResponse,
  RetryConfig,
  HttpResponse,
  HuefyEventCallbacks,
} from './types.js';

// Export error classes
export {
  HuefyError,
  AuthenticationError,
  TemplateNotFoundError,
  InvalidTemplateDataError,
  InvalidRecipientError,
  ProviderError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ValidationError,
  createErrorFromResponse,
  isHuefyError,
  isErrorCode,
  isRetryableError,
} from './errors.js';

// Export error codes enum
export { ErrorCode } from './types.js';

// Default export for convenience
import { HuefyClient } from './client.js';
export default HuefyClient;

/**
 * Create a new Huefy client instance
 * 
 * @param config - Configuration options
 * @returns Configured Huefy client
 * 
 * @example
 * ```typescript
 * import { createClient } from '@huefy/sdk';
 * 
 * const huefy = createClient({
 *   apiKey: 'your-api-key'
 * });
 * 
 * await huefy.sendEmail('welcome-email', {
 *   name: 'John Doe'
 * }, 'john@example.com');
 * ```
 */
export function createClient(config: import('./types.js').HuefyConfig): HuefyClient {
  return new HuefyClient(config);
}

/**
 * Package version
 */
export const VERSION = '1.0.0-beta.1';

/**
 * Package information
 */
export const SDK_INFO = {
  name: '@huefy-dev/sdk',
  version: VERSION,
  language: 'JavaScript/TypeScript',
  repository: 'https://github.com/huefy/huefy-sdk',
  documentation: 'https://docs.huefy.com/sdk/javascript',
} as const;