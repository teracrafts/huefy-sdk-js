/**
 * Huefy Client
 * Main client class for the Huefy SDK
 */

import type {
  HuefyConfig,
  EmailData,
  SendEmailOptions,
  SendEmailRequest,
  SendEmailResponse,
  HealthResponse,
  HuefyEventCallbacks,
} from './types.js';
import { HttpClient } from './http.js';
import { HuefyError, ValidationError } from './errors.js';

/**
 * Main Huefy SDK client for sending emails
 */
export class HuefyClient {
  private readonly http: HttpClient;
  private readonly callbacks?: HuefyEventCallbacks;

  /**
   * Create a new Huefy client
   * 
   * @param config - Configuration options
   * @param callbacks - Optional event callbacks for monitoring
   * 
   * @example
   * ```typescript
   * const huefy = new HuefyClient({
   *   apiKey: 'your-api-key'
   * });
   * 
   * // With custom configuration
   * const huefy = new HuefyClient({
   *   apiKey: 'your-api-key',
   *   baseUrl: 'https://api.huefy.com/api/v1/sdk',
   *   timeout: 30000,
   *   retryAttempts: 3
   * });
   * ```
   */
  constructor(config: HuefyConfig, callbacks?: HuefyEventCallbacks) {
    this.http = new HttpClient(config);
    this.callbacks = callbacks;
  }

  /**
   * Send an email using a template
   * 
   * @param templateKey - The template identifier
   * @param data - Template variables as key-value pairs
   * @param recipient - The recipient's email address
   * @param options - Optional sending configuration
   * @returns Promise resolving to email send result
   * 
   * @example
   * ```typescript
   * // Send with default SES provider
   * const result = await huefy.sendEmail('welcome-email', {
   *   name: 'John Doe',
   *   company: 'Acme Corp'
   * }, 'john@example.com');
   * 
   * // Send with specific provider
   * const result = await huefy.sendEmail('newsletter', {
   *   name: 'Jane Smith',
   *   unsubscribe_url: 'https://app.example.com/unsubscribe'
   * }, 'jane@example.com', {
   *   provider: 'sendgrid'
   * });
   * ```
   */
  async sendEmail(
    templateKey: string,
    data: EmailData,
    recipient: string,
    options?: SendEmailOptions,
  ): Promise<SendEmailResponse> {
    // Validate input parameters
    this.validateSendEmailInput(templateKey, data, recipient);

    // Build request payload
    const request: SendEmailRequest = {
      templateKey: templateKey,
      data,
      recipient,
      ...(options?.provider && { providerType: options.provider }),
    };

    try {
      // Trigger onSendStart callback
      this.callbacks?.onSendStart?.(request);

      // Make the API request
      const response = await this.http.post<SendEmailResponse>('/emails/send', request);

      // Trigger onSendSuccess callback
      this.callbacks?.onSendSuccess?.(response.data);

      return response.data;
    } catch (error) {
      // Convert to HuefyError if needed and trigger callback
      const huefyError = error instanceof HuefyError ? error : new HuefyError(
        error instanceof Error ? error.message : String(error),
        'UNEXPECTED_ERROR',
      );

      this.callbacks?.onSendError?.(huefyError);
      throw huefyError;
    }
  }

  /**
   * Send multiple emails with different template data
   * 
   * @param emails - Array of email sending requests
   * @returns Promise resolving to array of results
   * 
   * @example
   * ```typescript
   * const results = await huefy.sendBulkEmails([
   *   {
   *     templateKey: 'welcome-email',
   *     data: { name: 'John Doe' },
   *     recipient: 'john@example.com'
   *   },
   *   {
   *     templateKey: 'welcome-email', 
   *     data: { name: 'Jane Smith' },
   *     recipient: 'jane@example.com',
   *     options: { provider: 'sendgrid' }
   *   }
   * ]);
   * ```
   */
  async sendBulkEmails(
    emails: Array<{
      templateKey: string;
      data: EmailData;
      recipient: string;
      options?: SendEmailOptions;
    }>,
  ): Promise<Array<{
    email: string;
    success: boolean;
    result?: SendEmailResponse;
    error?: HuefyError;
  }>> {
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new ValidationError('Emails array is required and must not be empty');
    }

    if (emails.length > 100) {
      throw new ValidationError('Maximum 100 emails allowed per bulk request');
    }

    // Process emails concurrently with a reasonable limit
    const results = await Promise.allSettled(
      emails.map(async (email) => {
        try {
          const result = await this.sendEmail(
            email.templateKey,
            email.data,
            email.recipient,
            email.options,
          );
          return {
            email: email.recipient,
            success: true as const,
            result,
          };
        } catch (error) {
          return {
            email: email.recipient,
            success: false as const,
            error: error instanceof HuefyError ? error : new HuefyError(
              error instanceof Error ? error.message : String(error),
              'UNEXPECTED_ERROR',
            ),
          };
        }
      }),
    );

    return results.map((result) =>
      result.status === 'fulfilled' ? result.value : result.reason,
    );
  }

  /**
   * Check the health of the Huefy API
   * 
   * @returns Promise resolving to health status
   * 
   * @example
   * ```typescript
   * const health = await huefy.healthCheck();
   * console.log('API Status:', health.status);
   * ```
   */
  async healthCheck(): Promise<HealthResponse> {
    const response = await this.http.get<HealthResponse>('/health');
    return response.data;
  }

  /**
   * Validate a template by attempting to render it with test data
   * 
   * @param templateKey - The template identifier
   * @param testData - Test data for validation
   * @returns Promise resolving to validation result
   * 
   * @example
   * ```typescript
   * const isValid = await huefy.validateTemplate('welcome-email', {
   *   name: 'Test User',
   *   company: 'Test Company'
   * });
   * ```
   */
  async validateTemplate(templateKey: string, testData: EmailData): Promise<boolean> {
    try {
      // Use a test recipient that won't actually send
      await this.sendEmail(templateKey, testData, 'test@huefy.com');
      return true;
    } catch (error) {
      if (error instanceof HuefyError) {
        // Template validation errors vs actual sending errors
        return !['TEMPLATE_NOT_FOUND', 'INVALID_TEMPLATE_DATA'].includes(error.code);
      }
      return false;
    }
  }

  /**
   * Get client configuration information
   * 
   * @returns Client configuration details
   */
  getConfig(): {
    baseUrl: string;
    timeout: number;
    retryConfig: any;
  } {
    return {
      baseUrl: this.http.getBaseUrl(),
      timeout: this.http.getTimeout(),
      retryConfig: this.http.getRetryConfig(),
    };
  }

  /**
   * Validate input parameters for sendEmail
   */
  private validateSendEmailInput(
    templateKey: string,
    data: EmailData,
    recipient: string,
  ): void {
    if (!templateKey || typeof templateKey !== 'string') {
      throw new ValidationError('Template key is required and must be a string');
    }

    if (templateKey.trim().length === 0) {
      throw new ValidationError('Template key cannot be empty');
    }

    if (templateKey.length > 100) {
      throw new ValidationError('Template key cannot exceed 100 characters');
    }

    if (!data || typeof data !== 'object') {
      throw new ValidationError('Data is required and must be an object');
    }

    if (Array.isArray(data)) {
      throw new ValidationError('Data must be an object, not an array');
    }

    // Validate that all data values are strings
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'string') {
        throw new ValidationError(
          `Data value for key '${key}' must be a string, got ${typeof value}`,
        );
      }
    }

    if (!recipient || typeof recipient !== 'string') {
      throw new ValidationError('Recipient is required and must be a string');
    }

    if (!this.isValidEmail(recipient)) {
      throw new ValidationError(`Invalid email address: ${recipient}`);
    }

    if (recipient.length > 254) {
      throw new ValidationError('Email address cannot exceed 254 characters');
    }
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}