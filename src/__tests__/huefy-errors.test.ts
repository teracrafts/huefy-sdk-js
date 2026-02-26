import { describe, it, expect } from 'vitest';
import {
  HuefyDomainError,
  AuthenticationError,
  TemplateNotFoundError,
  InvalidTemplateDataError,
  InvalidRecipientError,
  ProviderError,
  RateLimitError,
  createHuefyErrorFromResponse,
  isHuefyDomainError,
} from '../errors/huefy-errors';
import { HuefyErrorCode } from '../errors/huefy-error-codes';

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

  it('createHuefyErrorFromResponse maps codes correctly', () => {
    const err = createHuefyErrorFromResponse({ error: 'bad key', code: 'INVALID_API_KEY' }, 401);
    expect(err).toBeInstanceOf(AuthenticationError);
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
});
