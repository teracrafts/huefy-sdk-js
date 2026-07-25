import { describe, it, expect } from 'vitest';
import {
  HuefyDomainError,
  AuthenticationError,
  TemplateNotFoundError,
  InvalidTemplateDataError,
  InvalidRecipientError,
  ProviderError,
  RateLimitError,
  InsufficientQuotaError,
  createHuefyErrorFromResponse,
  isHuefyDomainError,
} from '../errors/huefy-errors';
import { HuefyErrorCode } from '../errors/huefy-error-codes';
import { HuefyError } from '../errors/huefy-error';
import { ErrorCode } from '../errors/error-codes';

describe('Huefy Domain Errors', () => {
  it('AuthenticationError has correct properties', () => {
    const err = new AuthenticationError();
    expect(err.code).toBe(HuefyErrorCode.INVALID_API_KEY);
    expect(err.statusCode).toBe(401);
    expect(err.numericCode).toBe(2100);
  });

  it('TemplateNotFoundError includes key', () => {
    const err = new TemplateNotFoundError('welcome');
    expect(err.message).toContain('welcome');
    expect(err.statusCode).toBe(404);
  });

  it('InvalidRecipientError includes recipient', () => {
    const err = new InvalidRecipientError('bad@');
    expect(err.message).toContain('bad@');
    expect(err.statusCode).toBe(400);
  });

  it('RateLimitError has retryAfter', () => {
    const err = new RateLimitError('slow down', 30);
    expect(err.retryAfter).toBe(30);
    expect(err.statusCode).toBe(429);
  });

  it('InsufficientQuotaError has billing status and code', () => {
    const err = new InsufficientQuotaError('upgrade required');
    expect(err.code).toBe(HuefyErrorCode.INSUFFICIENT_QUOTA);
    expect(err.statusCode).toBe(402);
    expect(err.numericCode).toBe(2114);
  });

  it('createHuefyErrorFromResponse maps codes correctly', () => {
    const err = createHuefyErrorFromResponse({ error: 'bad key', code: 'INVALID_API_KEY' }, 401);
    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it('createHuefyErrorFromResponse maps insufficient quota correctly', () => {
    const err = createHuefyErrorFromResponse({ error: 'quota exceeded', code: 'INSUFFICIENT_QUOTA' }, 402);
    expect(err).toBeInstanceOf(InsufficientQuotaError);
    expect(err.statusCode).toBe(402);
  });

  it('isHuefyDomainError detects domain errors', () => {
    expect(isHuefyDomainError(new ProviderError())).toBe(true);
    expect(isHuefyDomainError(new Error('nope'))).toBe(false);
  });

  it('toJSON serializes correctly', () => {
    const err = new InvalidTemplateDataError('bad data');
    const json = err.toJSON();
    expect(json.code).toBe(HuefyErrorCode.INVALID_TEMPLATE_DATA);
    expect(json.numericCode).toBe(2102);
  });

  it('HuefyError.createErrorFromResponse unwraps backend SDK error envelopes', () => {
    const err = HuefyError.createErrorFromResponse(409, {
      success: false,
      error: {
        code: 'TEMPLATE_NOT_PUBLISHED',
        message: 'Template is not published',
        correlationId: 'corr-123',
        retryable: false,
        details: { templateKey: 'welcome' },
      },
    });

    expect(err.code).toBe(ErrorCode.TEMPLATE_NOT_PUBLISHED);
    expect(err.message).toBe('Template is not published');
    expect(err.requestId).toBe('corr-123');
    expect(err.recoverable).toBe(false);
    expect(err.details).toEqual({
      success: false,
      error: {
        code: 'TEMPLATE_NOT_PUBLISHED',
        message: 'Template is not published',
        correlationId: 'corr-123',
        retryable: false,
        details: { templateKey: 'welcome' },
      },
    });
  });

  it('HuefyError.createErrorFromResponse preserves backend retry hints', () => {
    const err = HuefyError.createErrorFromResponse(429, {
      success: false,
      error: {
        code: 'PROVIDER_RATE_LIMIT',
        message: 'Provider rate limit exceeded',
        retryable: true,
        retryAfter: 60,
      },
    });

    expect(err.code).toBe(ErrorCode.PROVIDER_RATE_LIMIT);
    expect(err.recoverable).toBe(true);
    expect(err.retryAfter).toBe(60);
  });

  it('HuefyError.createErrorFromResponse prefers Retry-After header over body retryAfter', () => {
    const err = HuefyError.createErrorFromResponse(429, {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryable: true,
        retryAfter: 60,
      },
    }, '5');

    expect(err.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(err.retryAfter).toBe(5);
  });
});
