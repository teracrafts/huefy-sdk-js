/**
 * HTTP Client for Huefy SDK
 * Handles all HTTP communication with the Huefy API
 */

import fetch from 'cross-fetch';
import type {
  HuefyConfig,
  HttpResponse,
  RetryConfig,
  ErrorResponse,
} from './types.js';
import {
  HuefyError,
  NetworkError,
  TimeoutError,
  createErrorFromResponse,
  isRetryableError,
} from './errors.js';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * HTTP client for making requests to the Huefy API
 */
export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;

  constructor(config: HuefyConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.huefy.com/api/v1/sdk';
    this.timeout = config.timeout || 30000;
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      maxAttempts: config.retryAttempts || DEFAULT_RETRY_CONFIG.maxAttempts,
      initialDelay: config.retryDelay || DEFAULT_RETRY_CONFIG.initialDelay,
    };

    // Validate configuration
    if (!this.apiKey || typeof this.apiKey !== 'string') {
      throw new HuefyError('API key is required and must be a string', 'INVALID_CONFIG');
    }

    if (this.timeout < 0) {
      throw new HuefyError('Timeout must be a positive number', 'INVALID_CONFIG');
    }
  }

  /**
   * Make a POST request to the API
   */
  async post<T = any>(
    endpoint: string,
    data: any,
    options: { timeout?: number } = {},
  ): Promise<HttpResponse<T>> {
    return this.request('POST', endpoint, data, options);
  }

  /**
   * Make a GET request to the API
   */
  async get<T = any>(
    endpoint: string,
    options: { timeout?: number } = {},
  ): Promise<HttpResponse<T>> {
    return this.request('GET', endpoint, undefined, options);
  }

  /**
   * Make an HTTP request with retry logic
   */
  private async request<T = any>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
    options: { timeout?: number } = {},
  ): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = options.timeout || this.timeout;
    
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await this.makeRequest<T>(method, url, data, timeout);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Only retry if the error is retryable
        if (!isRetryableError(error)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay,
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }

  /**
   * Make a single HTTP request
   */
  private async makeRequest<T = any>(
    method: 'GET' | 'POST',
    url: string,
    data?: any,
    timeout?: number,
  ): Promise<HttpResponse<T>> {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'X-API-Key': this.apiKey,
        'User-Agent': 'Huefy-SDK-JS/1.0.0',
        'Accept': 'application/json',
      };

      // Add content type for POST requests
      if (method === 'POST' && data) {
        headers['Content-Type'] = 'application/json';
      }

      const requestInit: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };
      
      if (method === 'POST' && data) {
        requestInit.body = JSON.stringify(data);
      }

      const response = await fetch(url, requestInit);

      clearTimeout(timeoutId);

      // Parse response
      let responseData: T;
      try {
        responseData = await response.json();
      } catch (parseError) {
        throw new HuefyError(
          'Failed to parse response as JSON',
          'INVALID_RESPONSE',
          response.status,
        );
      }

      // Handle error responses
      if (!response.ok) {
        const errorData = responseData as unknown as ErrorResponse;
        throw createErrorFromResponse(errorData, response.status);
      }

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: this.extractHeaders(response.headers),
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(timeout || this.timeout);
      }

      // Handle network errors
      if (error instanceof TypeError || (error instanceof Error && error.message.includes('fetch'))) {
        const message = error instanceof Error ? error.message : 'Unknown network error';
        throw new NetworkError(`Network error: ${message}`, error instanceof Error ? error : undefined);
      }

      // Re-throw HuefyErrors as-is
      if (error instanceof HuefyError) {
        throw error;
      }

      // Wrap other errors
      throw new HuefyError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        'UNEXPECTED_ERROR',
      );
    }
  }

  /**
   * Extract headers from Response object to plain object
   */
  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the base URL being used
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the current timeout setting
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Get the current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}