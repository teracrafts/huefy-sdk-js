/**
 * gRPC Client for Huefy SDK
 * Handles all gRPC communication with the Huefy API
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import type {
  HuefyConfig,
  SendEmailRequest,
  SendEmailResponse,
  HealthResponse,
  RetryConfig,
} from './types.js';
import {
  HuefyError,
  NetworkError,
  TimeoutError,
  AuthenticationError,
  TemplateNotFoundError,
  RateLimitError,
  ProviderError,
  InvalidRecipientError,
  ValidationError,
} from './errors.js';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  retryableStatusCodes: [14, 13, 8], // UNAVAILABLE, INTERNAL, RESOURCE_EXHAUSTED
};

/**
 * gRPC client for making requests to the Huefy API
 */
export class GrpcClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;
  private client: any;
  private packageDefinition: any;

  constructor(config: HuefyConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = this.getGrpcEndpoint(config);
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

    this.initializeGrpcClient();
  }

  /**
   * Determine the gRPC endpoint based on configuration
   */
  private getGrpcEndpoint(config: HuefyConfig): string {
    // If a custom baseUrl is provided, use it
    if (config.baseUrl) {
      return config.baseUrl;
    }

    // Default endpoints
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      return 'api.huefy.dev:50051';
    } else {
      return 'localhost:50051';
    }
  }

  /**
   * Initialize the gRPC client
   */
  private initializeGrpcClient(): void {
    try {
      // Load the protobuf definitions
      const protoPath = path.join(__dirname, '../proto/sdk/v1/sdk.service.proto');

      this.packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [path.join(__dirname, '../proto/sdk/v1')]
      });

      const protoDescriptor = grpc.loadPackageDefinition(this.packageDefinition);
      const huefyProto = protoDescriptor.huefy.sdk.v1 as any;

      // Create the gRPC client
      const credentials = this.endpoint.includes('localhost')
        ? grpc.credentials.createInsecure()
        : grpc.credentials.createSsl();

      this.client = new huefyProto.SDKService(this.endpoint, credentials);
    } catch (error) {
      throw new HuefyError(
        `Failed to initialize gRPC client: ${error instanceof Error ? error.message : String(error)}`,
        'GRPC_INIT_ERROR'
      );
    }
  }

  /**
   * Send an email using gRPC
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    const grpcRequest = this.convertToGrpcSendEmailRequest(request);
    return this.makeGrpcRequest('SendEmail', grpcRequest);
  }

  /**
   * Send multiple emails using gRPC
   */
  async sendBulkEmails(requests: SendEmailRequest[]): Promise<any> {
    const grpcRequests = requests.map(req => this.convertToGrpcSendEmailRequest(req));
    const grpcRequest = {
      emails: grpcRequests
    };
    return this.makeGrpcRequest('SendBulkEmail', grpcRequest);
  }

  /**
   * Check the health of the API using gRPC
   */
  async healthCheck(): Promise<HealthResponse> {
    const grpcRequest = {
      include_dependencies: false,
      include_metrics: false,
      include_version: true
    };

    const response = await this.makeGrpcRequest('HealthCheck', grpcRequest);

    return {
      status: response.status,
      timestamp: response.timestamp,
      version: response.version
    };
  }

  /**
   * Convert SDK request to gRPC request format
   */
  private convertToGrpcSendEmailRequest(request: SendEmailRequest): any {
    return {
      template_key: request.templateKey,
      data: request.data,
      recipient: {
        email: request.recipient,
        type: 'RECIPIENT_TYPE_TO'
      },
      provider_type: request.providerType || 'ses'
    };
  }

  /**
   * Make a gRPC request with retry logic
   */
  private async makeGrpcRequest<T = any>(method: string, request: any): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await this.executeGrpcCall(method, request);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Only retry if the error is retryable
        if (!this.isRetryableGrpcError(error)) {
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
    throw this.convertGrpcError(lastError);
  }

  /**
   * Execute a single gRPC call
   */
  private executeGrpcCall<T = any>(method: string, request: any): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add metadata for authentication
      const metadata = new grpc.Metadata();
      metadata.add('x-api-key', this.apiKey);

      // Set deadline
      const deadline = new Date();
      deadline.setMilliseconds(deadline.getMilliseconds() + this.timeout);

      this.client[method](request, metadata, { deadline }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Check if a gRPC error is retryable
   */
  private isRetryableGrpcError(error: any): boolean {
    if (!error || typeof error.code !== 'number') {
      return false;
    }

    return this.retryConfig.retryableStatusCodes.includes(error.code);
  }

  /**
   * Convert gRPC errors to SDK error types
   */
  private convertGrpcError(error: any): HuefyError {
    if (!error) {
      return new HuefyError('Unknown error occurred', 'UNKNOWN_ERROR');
    }

    const code = error.code;
    const message = error.details || error.message || 'Unknown gRPC error';

    switch (code) {
      case grpc.status.INVALID_ARGUMENT:
        return new ValidationError(message);
      case grpc.status.UNAUTHENTICATED:
        return new AuthenticationError(message);
      case grpc.status.PERMISSION_DENIED:
        return new AuthenticationError(message);
      case grpc.status.NOT_FOUND:
        return new TemplateNotFoundError(message);
      case grpc.status.RESOURCE_EXHAUSTED:
        return new RateLimitError(message, 0);
      case grpc.status.UNAVAILABLE:
        return new ProviderError('', '', message);
      case grpc.status.DEADLINE_EXCEEDED:
        return new TimeoutError(this.timeout);
      case grpc.status.INTERNAL:
        return new HuefyError(message, 'INTERNAL_ERROR');
      default:
        return new NetworkError(`gRPC error (${code}): ${message}`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the current endpoint
   */
  getEndpoint(): string {
    return this.endpoint;
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

  /**
   * Close the gRPC client connection
   */
  close(): void {
    if (this.client) {
      this.client.close();
    }
  }
}