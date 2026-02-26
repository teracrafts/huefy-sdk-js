import { HttpClient } from './http/http-client';
import type { HuefyConfig } from './types/config';
import { createLogger } from './utils/logger';
import type { Logger } from './utils/logger';
import { setDefaultSanitizationConfig } from './errors/error-sanitizer';

/**
 * Base client for the Huefy SDK.
 *
 * Provides HTTP connectivity, health-checking, and safe configuration
 * access.  Language-specific SDKs extend this class with domain methods.
 */
export class HuefyClient {
  protected readonly http: HttpClient;
  protected readonly logger: Logger;
  private readonly config: HuefyConfig;

  constructor(config: HuefyConfig) {
    if (!config.apiKey) {
      throw new Error('apiKey is required');
    }

    this.config = config;
    const logger = config.logger ?? createLogger({ debug: false });
    this.logger = logger;

    if (config.enableErrorSanitization) {
      setDefaultSanitizationConfig({ enabled: true, preserveOriginal: false });
    }

    this.http = new HttpClient(config.apiKey, {
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retryConfig: config.retryConfig,
      circuitBreakerConfig: config.circuitBreakerConfig,
      logger,
      secondaryApiKey: config.secondaryApiKey,
      enableRequestSigning: config.enableRequestSigning,
    });
  }

  /**
   * Sends a lightweight request to the `/health` endpoint.
   *
   * Useful for verifying connectivity and that the API key is valid
   * before issuing business requests.
   */
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    version?: string;
  }> {
    return this.http.request<{
      status: string;
      timestamp: string;
      version?: string;
    }>('/health', { method: 'GET' });
  }

  /**
   * Returns a frozen, read-only snapshot of the current configuration
   * with sensitive fields (`apiKey`, `secondaryApiKey`) omitted.
   */
  getConfig(): Readonly<
    Omit<HuefyConfig, 'apiKey' | 'secondaryApiKey'>
  > {
    const { apiKey, secondaryApiKey, ...rest } = this.config;
    return Object.freeze(rest);
  }

  /**
   * Releases any resources held by the underlying HTTP client
   * (e.g. open sockets, timers).
   */
  close(): void {
    this.http.close();
  }
}
