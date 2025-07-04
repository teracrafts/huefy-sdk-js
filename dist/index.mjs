import fetch from 'cross-fetch';

/* Huefy SDK - https://huefy.com */


// src/errors.ts
var HuefyError = class _HuefyError extends Error {
  constructor(message, code = "UNKNOWN_ERROR", statusCode, details) {
    super(message);
    this.isHuefyError = true;
    this.name = "HuefyError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _HuefyError);
    }
  }
  /**
   * Create HuefyError from API error response
   */
  static fromErrorResponse(response, statusCode) {
    return new _HuefyError(response.error, response.code, statusCode, response.details);
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
      details: this.details
    };
  }
};
var AuthenticationError = class extends HuefyError {
  constructor(message = "Invalid or missing API key", details) {
    super(message, "INVALID_API_KEY", 401, details);
    this.name = "AuthenticationError";
  }
};
var TemplateNotFoundError = class extends HuefyError {
  constructor(templateKey, details) {
    super(`Template '${templateKey}' not found`, "TEMPLATE_NOT_FOUND", 404, {
      templateKey,
      ...details
    });
    this.name = "TemplateNotFoundError";
  }
};
var InvalidTemplateDataError = class extends HuefyError {
  constructor(message = "Invalid template data", details) {
    super(message, "INVALID_TEMPLATE_DATA", 400, details);
    this.name = "InvalidTemplateDataError";
  }
};
var InvalidRecipientError = class extends HuefyError {
  constructor(recipient, details) {
    super(`Invalid recipient email: ${recipient}`, "INVALID_RECIPIENT", 400, {
      recipient,
      ...details
    });
    this.name = "InvalidRecipientError";
  }
};
var ProviderError = class extends HuefyError {
  constructor(message = "Email provider error", details) {
    super(message, "PROVIDER_ERROR", 500, details);
    this.name = "ProviderError";
  }
};
var RateLimitError = class extends HuefyError {
  constructor(message = "Rate limit exceeded", details) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, details);
    this.name = "RateLimitError";
  }
};
var NetworkError = class extends HuefyError {
  constructor(message = "Network error", cause) {
    super(message, "NETWORK_ERROR", void 0, { cause: cause?.message });
    this.name = "NetworkError";
  }
};
var TimeoutError = class extends HuefyError {
  constructor(timeout) {
    super(`Request timed out after ${timeout}ms`, "TIMEOUT_ERROR", void 0, { timeout });
    this.name = "TimeoutError";
  }
};
var ValidationError = class extends HuefyError {
  constructor(message = "Validation error", details) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
};
function createErrorFromResponse(data, statusCode) {
  switch (data.code) {
    case "INVALID_API_KEY":
      return new AuthenticationError(data.error, data.details);
    case "TEMPLATE_NOT_FOUND":
      return new TemplateNotFoundError(
        data.details?.templateKey || data.details?.template_key || "unknown",
        data.details
      );
    case "INVALID_TEMPLATE_DATA":
      return new InvalidTemplateDataError(data.error, data.details);
    case "INVALID_RECIPIENT":
      return new InvalidRecipientError(
        data.details?.recipient || "unknown",
        data.details
      );
    case "PROVIDER_ERROR":
      return new ProviderError(data.error, data.details);
    case "RATE_LIMIT_EXCEEDED":
      return new RateLimitError(data.error, data.details);
    default:
      return new HuefyError(data.error, data.code, statusCode, data.details);
  }
}
function isHuefyError(error) {
  return error && typeof error === "object" && error.isHuefyError === true;
}
function isErrorCode(error, code) {
  return isHuefyError(error) && error.code === code;
}
function isRetryableError(error) {
  if (!isHuefyError(error)) {
    return false;
  }
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }
  if (error.statusCode && error.statusCode >= 500) {
    return true;
  }
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return error.statusCode === 429;
  }
  return false;
}

// src/http.ts
var DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1e3,
  backoffMultiplier: 2,
  maxDelay: 1e4,
  retryableStatusCodes: [429, 500, 502, 503, 504]
};
var HttpClient = class {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.proxyUrl || config.baseUrl || "http://localhost:8080/huefy-proxy";
    this.timeout = config.timeout || 3e4;
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      maxAttempts: config.retryAttempts || DEFAULT_RETRY_CONFIG.maxAttempts,
      initialDelay: config.retryDelay || DEFAULT_RETRY_CONFIG.initialDelay
    };
    if (!this.apiKey || typeof this.apiKey !== "string") {
      throw new HuefyError("API key is required and must be a string", "INVALID_CONFIG");
    }
    if (this.timeout < 0) {
      throw new HuefyError("Timeout must be a positive number", "INVALID_CONFIG");
    }
  }
  /**
   * Make a POST request to the API
   */
  async post(endpoint2, data, options = {}) {
    return this.request("POST", endpoint2, data, options);
  }
  /**
   * Make a GET request to the API
   */
  async get(endpoint2, options = {}) {
    return this.request("GET", endpoint2, void 0, options);
  }
  /**
   * Make an HTTP request with retry logic
   */
  async request(method, endpoint2, data, options = {}) {
    const url = `${this.baseUrl}${endpoint2}`;
    const timeout = options.timeout || this.timeout;
    let lastError = null;
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await this.makeRequest(method, url, data, timeout);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }
        if (!isRetryableError(error)) {
          break;
        }
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );
        await this.sleep(delay);
      }
    }
    throw lastError;
  }
  /**
   * Make a single HTTP request
   */
  async makeRequest(method, url, data, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const headers = {
        "User-Agent": "Huefy-SDK-JS/1.0.0",
        "Accept": "application/json",
        "Content-Type": "application/json"
      };
      const proxyRequest = {
        // Configuration for secure processing
        config: {
          apiKey: this.apiKey,
          timeout: this.timeout,
          retryConfig: this.retryConfig
        },
        // Original request details
        method,
        endpoint,
        data: data || null
      };
      const requestInit = {
        method: "POST",
        // Always POST to proxy
        headers,
        signal: controller.signal,
        body: JSON.stringify(proxyRequest)
      };
      const response = await fetch(url, requestInit);
      clearTimeout(timeoutId);
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        throw new HuefyError(
          "Failed to parse response as JSON",
          "INVALID_RESPONSE",
          response.status
        );
      }
      if (!response.ok) {
        const errorData = responseData;
        throw createErrorFromResponse(errorData, response.status);
      }
      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: this.extractHeaders(response.headers)
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(timeout || this.timeout);
      }
      if (error instanceof TypeError || error instanceof Error && error.message.includes("fetch")) {
        const message = error instanceof Error ? error.message : "Unknown network error";
        throw new NetworkError(`Network error: ${message}`, error instanceof Error ? error : void 0);
      }
      if (error instanceof HuefyError) {
        throw error;
      }
      throw new HuefyError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        "UNEXPECTED_ERROR"
      );
    }
  }
  /**
   * Extract headers from Response object to plain object
   */
  extractHeaders(headers) {
    const result = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Get the base URL being used
   */
  getBaseUrl() {
    return this.baseUrl;
  }
  /**
   * Get the current timeout setting
   */
  getTimeout() {
    return this.timeout;
  }
  /**
   * Get the current retry configuration
   */
  getRetryConfig() {
    return { ...this.retryConfig };
  }
};

// src/client.ts
var HuefyClient = class {
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
   *   timeout: 30000,
   *   retryAttempts: 3
   * });
   * ```
   */
  constructor(config, callbacks) {
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
  async sendEmail(templateKey, data, recipient, options) {
    this.validateSendEmailInput(templateKey, data, recipient);
    const request = {
      templateKey,
      data,
      recipient,
      ...options?.provider && { providerType: options.provider }
    };
    try {
      this.callbacks?.onSendStart?.(request);
      const response = await this.http.post("/emails/send", request);
      this.callbacks?.onSendSuccess?.(response.data);
      return response.data;
    } catch (error) {
      const huefyError = error instanceof HuefyError ? error : new HuefyError(
        error instanceof Error ? error.message : String(error),
        "UNEXPECTED_ERROR"
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
  async sendBulkEmails(emails) {
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new ValidationError("Emails array is required and must not be empty");
    }
    if (emails.length > 100) {
      throw new ValidationError("Maximum 100 emails allowed per bulk request");
    }
    const results = await Promise.allSettled(
      emails.map(async (email) => {
        try {
          const result = await this.sendEmail(
            email.templateKey,
            email.data,
            email.recipient,
            email.options
          );
          return {
            email: email.recipient,
            success: true,
            result
          };
        } catch (error) {
          return {
            email: email.recipient,
            success: false,
            error: error instanceof HuefyError ? error : new HuefyError(
              error instanceof Error ? error.message : String(error),
              "UNEXPECTED_ERROR"
            )
          };
        }
      })
    );
    return results.map(
      (result) => result.status === "fulfilled" ? result.value : result.reason
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
  async healthCheck() {
    const response = await this.http.get("/health");
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
  async validateTemplate(templateKey, testData) {
    try {
      await this.sendEmail(templateKey, testData, "test@huefy.com");
      return true;
    } catch (error) {
      if (error instanceof HuefyError) {
        return !["TEMPLATE_NOT_FOUND", "INVALID_TEMPLATE_DATA"].includes(error.code);
      }
      return false;
    }
  }
  /**
   * Get client configuration information
   * 
   * @returns Client configuration details
   */
  getConfig() {
    return {
      baseUrl: this.http.getBaseUrl(),
      timeout: this.http.getTimeout(),
      retryConfig: this.http.getRetryConfig()
    };
  }
  /**
   * Validate input parameters for sendEmail
   */
  validateSendEmailInput(templateKey, data, recipient) {
    if (!templateKey || typeof templateKey !== "string") {
      throw new ValidationError("Template key is required and must be a string");
    }
    if (templateKey.trim().length === 0) {
      throw new ValidationError("Template key cannot be empty");
    }
    if (templateKey.length > 100) {
      throw new ValidationError("Template key cannot exceed 100 characters");
    }
    if (!data || typeof data !== "object") {
      throw new ValidationError("Data is required and must be an object");
    }
    if (Array.isArray(data)) {
      throw new ValidationError("Data must be an object, not an array");
    }
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== "string") {
        throw new ValidationError(
          `Data value for key '${key}' must be a string, got ${typeof value}`
        );
      }
    }
    if (!recipient || typeof recipient !== "string") {
      throw new ValidationError("Recipient is required and must be a string");
    }
    if (!this.isValidEmail(recipient)) {
      throw new ValidationError(`Invalid email address: ${recipient}`);
    }
    if (recipient.length > 254) {
      throw new ValidationError("Email address cannot exceed 254 characters");
    }
  }
  /**
   * Simple email validation
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
};

// src/types.ts
var ErrorCode = /* @__PURE__ */ ((ErrorCode2) => {
  ErrorCode2["INVALID_API_KEY"] = "INVALID_API_KEY";
  ErrorCode2["TEMPLATE_NOT_FOUND"] = "TEMPLATE_NOT_FOUND";
  ErrorCode2["INVALID_TEMPLATE_DATA"] = "INVALID_TEMPLATE_DATA";
  ErrorCode2["INVALID_RECIPIENT"] = "INVALID_RECIPIENT";
  ErrorCode2["PROVIDER_ERROR"] = "PROVIDER_ERROR";
  ErrorCode2["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
  ErrorCode2["INTERNAL_ERROR"] = "INTERNAL_ERROR";
  return ErrorCode2;
})(ErrorCode || {});

// src/index.ts
var index_default = HuefyClient;
function createClient(config) {
  return new HuefyClient(config);
}
var VERSION = "1.0.0-beta.9";
var SDK_INFO = {
  name: "@teracrafts/huefy",
  version: VERSION,
  language: "JavaScript/TypeScript",
  repository: "https://github.com/teracrafts/huefy-sdk",
  documentation: "https://docs.huefy.com/sdk/javascript"
};

export { AuthenticationError, ErrorCode, HttpClient, HuefyClient, HuefyError, InvalidRecipientError, InvalidTemplateDataError, NetworkError, ProviderError, RateLimitError, SDK_INFO, TemplateNotFoundError, TimeoutError, VERSION, ValidationError, createClient, createErrorFromResponse, index_default as default, isErrorCode, isHuefyError, isRetryableError };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map