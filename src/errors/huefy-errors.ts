import { HuefyErrorCode, HUEFY_NUMERIC_CODES } from './huefy-error-codes';

export class HuefyDomainError extends Error {
  public readonly code: HuefyErrorCode;
  public readonly numericCode: number;
  public readonly statusCode?: number;
  public readonly details?: unknown;
  public readonly isHuefyError = true;

  constructor(
    message: string,
    code: HuefyErrorCode = HuefyErrorCode.UNEXPECTED_ERROR,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message);
    this.name = 'HuefyDomainError';
    this.code = code;
    this.numericCode = HUEFY_NUMERIC_CODES[code] ?? 2112;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      numericCode: this.numericCode,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class AuthenticationError extends HuefyDomainError {
  constructor(message = 'Invalid or missing API key', details?: unknown) {
    super(message, HuefyErrorCode.INVALID_API_KEY, 401, details);
    this.name = 'AuthenticationError';
  }
}

export class TemplateNotFoundError extends HuefyDomainError {
  constructor(templateKey: string, details?: unknown) {
    super(`Template not found: ${templateKey}`, HuefyErrorCode.TEMPLATE_NOT_FOUND, 404, details);
    this.name = 'TemplateNotFoundError';
  }
}

export class InvalidTemplateDataError extends HuefyDomainError {
  constructor(message = 'Invalid template data', details?: unknown) {
    super(message, HuefyErrorCode.INVALID_TEMPLATE_DATA, 400, details);
    this.name = 'InvalidTemplateDataError';
  }
}

export class InvalidRecipientError extends HuefyDomainError {
  constructor(recipient: string, details?: unknown) {
    super(`Invalid recipient email: ${recipient}`, HuefyErrorCode.INVALID_RECIPIENT, 400, details);
    this.name = 'InvalidRecipientError';
  }
}

export class ProviderError extends HuefyDomainError {
  constructor(message = 'Email provider error', details?: unknown) {
    super(message, HuefyErrorCode.PROVIDER_ERROR, 500, details);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends HuefyDomainError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number, details?: unknown) {
    super(message, HuefyErrorCode.RATE_LIMIT_EXCEEDED, 429, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export function createHuefyErrorFromResponse(data: { error: string; code: string; details?: unknown }, statusCode: number): HuefyDomainError {
  const code = data.code as HuefyErrorCode;
  switch (code) {
    case HuefyErrorCode.INVALID_API_KEY:
      return new AuthenticationError(data.error, data.details);
    case HuefyErrorCode.TEMPLATE_NOT_FOUND:
      return new TemplateNotFoundError(data.error, data.details);
    case HuefyErrorCode.INVALID_TEMPLATE_DATA:
      return new InvalidTemplateDataError(data.error, data.details);
    case HuefyErrorCode.INVALID_RECIPIENT:
      return new InvalidRecipientError(data.error, data.details);
    case HuefyErrorCode.PROVIDER_ERROR:
      return new ProviderError(data.error, data.details);
    case HuefyErrorCode.RATE_LIMIT_EXCEEDED:
      return new RateLimitError(data.error, undefined, data.details);
    default:
      return new HuefyDomainError(data.error, code || HuefyErrorCode.UNEXPECTED_ERROR, statusCode, data.details);
  }
}

export function isHuefyDomainError(error: unknown): error is HuefyDomainError {
  return error instanceof HuefyDomainError || (error !== null && typeof error === 'object' && 'isHuefyError' in error);
}
