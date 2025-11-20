/**
 * Kernel Client for Huefy SDK
 * Handles communication with the kernel CLI binary
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
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
 * CLI request interface
 */
interface CLIRequest {
  command: string;
  config: {
    apiKey: string;
    endpoint?: string;
    timeout: number;
  };
  data?: any;
}

/**
 * CLI response interface
 */
interface CLIResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Kernel client for making requests via the kernel CLI binary
 */
export class KernelClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;
  private readonly kernelBinaryPath: string;

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

    this.kernelBinaryPath = this.getKernelBinaryPath();
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
   * Get the path to the kernel binary based on the current platform
   */
  private getKernelBinaryPath(): string {
    const platform = os.platform();
    const arch = os.arch();

    let binaryName: string;

    if (platform === 'darwin') {
      binaryName = arch === 'arm64' ? 'kernel-cli-darwin-arm64' : 'kernel-cli-darwin-amd64';
    } else if (platform === 'linux') {
      binaryName = arch === 'arm64' ? 'kernel-cli-linux-arm64' : 'kernel-cli-linux-amd64';
    } else if (platform === 'win32') {
      binaryName = 'kernel-cli-windows-amd64.exe';
    } else {
      throw new HuefyError(`Unsupported platform: ${platform}`, 'UNSUPPORTED_PLATFORM');
    }

    // Look for binary in the package's bin directory
    const packageDir = path.dirname(path.dirname(__dirname)); // Go up from dist/src to package root
    return path.join(packageDir, 'bin', binaryName);
  }

  /**
   * Send an email using the kernel CLI
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    const cliRequest: CLIRequest = {
      command: 'sendEmail',
      config: {
        apiKey: this.apiKey,
        endpoint: this.endpoint,
        timeout: this.timeout,
      },
      data: {
        templateKey: request.templateKey,
        data: request.data,
        recipient: request.recipient,
        providerType: request.providerType || 'ses'
      }
    };

    const response = await this.executeKernelCommand(cliRequest);
    return response as SendEmailResponse;
  }

  /**
   * Send multiple emails using the kernel CLI
   */
  async sendBulkEmails(requests: SendEmailRequest[]): Promise<any> {
    const cliData = requests.map(req => ({
      templateKey: req.templateKey,
      data: req.data,
      recipient: req.recipient,
      providerType: req.providerType || 'ses'
    }));

    const cliRequest: CLIRequest = {
      command: 'sendBulkEmails',
      config: {
        apiKey: this.apiKey,
        endpoint: this.endpoint,
        timeout: this.timeout,
      },
      data: cliData
    };

    const response = await this.executeKernelCommand(cliRequest);
    return response;
  }

  /**
   * Check the health of the API using the kernel CLI
   */
  async healthCheck(): Promise<HealthResponse> {
    const cliRequest: CLIRequest = {
      command: 'healthCheck',
      config: {
        apiKey: this.apiKey,
        endpoint: this.endpoint,
        timeout: this.timeout,
      }
    };

    const response = await this.executeKernelCommand(cliRequest);
    return response as HealthResponse;
  }

  /**
   * Execute a command via the kernel CLI binary
   */
  private async executeKernelCommand(request: CLIRequest): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await this.spawnKernelProcess(request);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Only retry if the error is retryable
        if (!this.isRetryableError(error)) {
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
    throw this.convertError(lastError);
  }

  /**
   * Spawn the kernel process and communicate via stdin/stdout
   */
  private spawnKernelProcess(request: CLIRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const kernelProcess: ChildProcess = spawn(this.kernelBinaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      kernelProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      kernelProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      kernelProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Kernel process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const response: CLIResponse = JSON.parse(stdout);

          if (!response.success) {
            const error = response.error;
            reject(new HuefyError(
              error?.message || 'Unknown kernel error',
              error?.code || 'KERNEL_ERROR'
            ));
            return;
          }

          resolve(response.data);
        } catch (parseError) {
          reject(new Error(`Failed to parse kernel response: ${parseError}`));
        }
      });

      kernelProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn kernel process: ${error.message}`));
      });

      // Send request to kernel via stdin
      try {
        kernelProcess.stdin?.write(JSON.stringify(request));
        kernelProcess.stdin?.end();
      } catch (error) {
        reject(new Error(`Failed to write to kernel process: ${error}`));
      }

      // Set timeout
      setTimeout(() => {
        kernelProcess.kill();
        reject(new TimeoutError(this.timeout));
      }, this.timeout);
    });
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof TimeoutError) {
      return true;
    }
    if (error instanceof NetworkError) {
      return true;
    }
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('timeout')) {
      return true;
    }
    return false;
  }

  /**
   * Convert errors to SDK error types
   */
  private convertError(error: any): HuefyError {
    if (!error) {
      return new HuefyError('Unknown error occurred', 'UNKNOWN_ERROR');
    }

    if (error instanceof HuefyError) {
      return error;
    }

    const message = error.message || 'Unknown kernel error';

    if (message.includes('API key')) {
      return new AuthenticationError(message);
    }
    if (message.includes('template')) {
      return new TemplateNotFoundError(message);
    }
    if (message.includes('rate limit')) {
      return new RateLimitError(message, 0);
    }
    if (message.includes('timeout')) {
      return new TimeoutError(this.timeout);
    }
    if (message.includes('network') || message.includes('connection')) {
      return new NetworkError(message);
    }

    return new HuefyError(message, 'KERNEL_ERROR');
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
   * Close any resources (no-op for CLI approach)
   */
  close(): void {
    // No persistent connections to close with CLI approach
  }
}