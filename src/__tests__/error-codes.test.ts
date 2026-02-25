import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  getNumericCode,
  isRecoverableCode,
  numericCodeMap,
} from '../errors/error-codes';

describe('ErrorCode', () => {
  it('has expected enum values', () => {
    expect(ErrorCode.INIT_FAILED).toBe('INIT_FAILED');
    expect(ErrorCode.INIT_TIMEOUT).toBe('INIT_TIMEOUT');
    expect(ErrorCode.AUTH_INVALID_KEY).toBe('AUTH_INVALID_KEY');
    expect(ErrorCode.AUTH_EXPIRED_KEY).toBe('AUTH_EXPIRED_KEY');
    expect(ErrorCode.AUTH_MISSING_KEY).toBe('AUTH_MISSING_KEY');
    expect(ErrorCode.AUTH_UNAUTHORIZED).toBe('AUTH_UNAUTHORIZED');
    expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ErrorCode.NETWORK_TIMEOUT).toBe('NETWORK_TIMEOUT');
    expect(ErrorCode.NETWORK_RETRY_LIMIT).toBe('NETWORK_RETRY_LIMIT');
    expect(ErrorCode.NETWORK_SERVICE_UNAVAILABLE).toBe('NETWORK_SERVICE_UNAVAILABLE');
    expect(ErrorCode.CIRCUIT_OPEN).toBe('CIRCUIT_OPEN');
    expect(ErrorCode.CONFIG_INVALID_URL).toBe('CONFIG_INVALID_URL');
    expect(ErrorCode.CONFIG_MISSING_REQUIRED).toBe('CONFIG_MISSING_REQUIRED');
    expect(ErrorCode.SECURITY_PII_DETECTED).toBe('SECURITY_PII_DETECTED');
    expect(ErrorCode.SECURITY_SIGNATURE_INVALID).toBe('SECURITY_SIGNATURE_INVALID');
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });
});

describe('getNumericCode', () => {
  it('returns correct numeric codes', () => {
    expect(getNumericCode(ErrorCode.INIT_FAILED)).toBe(1000);
    expect(getNumericCode(ErrorCode.INIT_TIMEOUT)).toBe(1001);
    expect(getNumericCode(ErrorCode.AUTH_INVALID_KEY)).toBe(1100);
    expect(getNumericCode(ErrorCode.AUTH_EXPIRED_KEY)).toBe(1101);
    expect(getNumericCode(ErrorCode.AUTH_MISSING_KEY)).toBe(1102);
    expect(getNumericCode(ErrorCode.AUTH_UNAUTHORIZED)).toBe(1103);
    expect(getNumericCode(ErrorCode.NETWORK_ERROR)).toBe(1200);
    expect(getNumericCode(ErrorCode.NETWORK_TIMEOUT)).toBe(1201);
    expect(getNumericCode(ErrorCode.NETWORK_RETRY_LIMIT)).toBe(1202);
    expect(getNumericCode(ErrorCode.NETWORK_SERVICE_UNAVAILABLE)).toBe(1203);
    expect(getNumericCode(ErrorCode.CIRCUIT_OPEN)).toBe(1300);
    expect(getNumericCode(ErrorCode.CONFIG_INVALID_URL)).toBe(1400);
    expect(getNumericCode(ErrorCode.CONFIG_MISSING_REQUIRED)).toBe(1401);
    expect(getNumericCode(ErrorCode.SECURITY_PII_DETECTED)).toBe(1500);
    expect(getNumericCode(ErrorCode.SECURITY_SIGNATURE_INVALID)).toBe(1501);
    expect(getNumericCode(ErrorCode.VALIDATION_ERROR)).toBe(1600);
  });

  it('has a numeric code for every ErrorCode member', () => {
    const errorCodes = Object.values(ErrorCode);

    for (const code of errorCodes) {
      expect(numericCodeMap[code]).toBeDefined();
      expect(typeof getNumericCode(code)).toBe('number');
    }
  });
});

describe('isRecoverableCode', () => {
  it.each([
    ErrorCode.NETWORK_ERROR,
    ErrorCode.NETWORK_TIMEOUT,
    ErrorCode.NETWORK_RETRY_LIMIT,
    ErrorCode.NETWORK_SERVICE_UNAVAILABLE,
    ErrorCode.CIRCUIT_OPEN,
  ])('returns true for %s', (code) => {
    expect(isRecoverableCode(code)).toBe(true);
  });

  it.each([
    ErrorCode.AUTH_INVALID_KEY,
    ErrorCode.AUTH_EXPIRED_KEY,
    ErrorCode.AUTH_MISSING_KEY,
    ErrorCode.AUTH_UNAUTHORIZED,
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.CONFIG_INVALID_URL,
    ErrorCode.CONFIG_MISSING_REQUIRED,
    ErrorCode.INIT_FAILED,
    ErrorCode.INIT_TIMEOUT,
    ErrorCode.SECURITY_PII_DETECTED,
    ErrorCode.SECURITY_SIGNATURE_INVALID,
  ])('returns false for %s', (code) => {
    expect(isRecoverableCode(code)).toBe(false);
  });
});
