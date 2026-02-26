import { describe, it, expect } from 'vitest';
import {
  isPotentialPIIField,
  detectPotentialPII,
  getKeyId,
  isServerKey,
  isClientKey,
  generateHMACSHA256,
  createRequestSignature,
  verifyRequestSignature,
} from '../utils/security';

describe('isPotentialPIIField', () => {
  it.each(['email', 'phone', 'ssn', 'credit_card', 'password'])(
    'detects "%s" as potential PII field',
    (field) => {
      expect(isPotentialPIIField(field)).toBe(true);
    },
  );

  it.each(['name', 'age', 'color', 'flagKey'])(
    'returns false for safe field "%s"',
    (field) => {
      expect(isPotentialPIIField(field)).toBe(false);
    },
  );

  it('handles case-insensitive and separator variants', () => {
    expect(isPotentialPIIField('EMAIL')).toBe(true);
    expect(isPotentialPIIField('Email')).toBe(true);
    expect(isPotentialPIIField('e-mail')).toBe(true);
    expect(isPotentialPIIField('e_mail')).toBe(true);
    expect(isPotentialPIIField('Phone')).toBe(true);
    expect(isPotentialPIIField('PHONE')).toBe(true);
    expect(isPotentialPIIField('phone_number')).toBe(true);
    expect(isPotentialPIIField('creditCard')).toBe(true);
  });
});

describe('detectPotentialPII', () => {
  it('finds nested PII fields', () => {
    const data = {
      user: {
        name: 'John',
        email: 'john@example.com',
        profile: {
          phone: '555-1234',
          bio: 'Hello',
        },
      },
    };

    const result = detectPotentialPII(data);

    expect(result.length).toBeGreaterThanOrEqual(2);

    // detectPotentialPII returns string[] of dot-delimited paths
    expect(result.some((p) => p.includes('email'))).toBe(true);
    expect(result.some((p) => p.includes('phone'))).toBe(true);
  });

  it('returns empty array for safe data', () => {
    const data = {
      id: 123,
      status: 'active',
      config: {
        theme: 'dark',
        locale: 'en-US',
      },
    };

    const result = detectPotentialPII(data);

    expect(result).toEqual([]);
  });
});

describe('getKeyId', () => {
  it('returns first 8 characters', () => {
    expect(getKeyId('sdk_abc12345xyz')).toBe('sdk_abc1');
  });

  it('handles short keys', () => {
    expect(getKeyId('abc')).toBe('abc');
    expect(getKeyId('')).toBe('');
  });
});

describe('key classification', () => {
  it('isServerKey correctly classifies server key prefixes', () => {
    expect(isServerKey('srv_abc123')).toBe(true);
    expect(isServerKey('sdk_abc123')).toBe(false);
    expect(isServerKey('cli_abc123')).toBe(false);
    expect(isServerKey('random_key')).toBe(false);
  });

  it('isClientKey correctly classifies client key prefixes', () => {
    expect(isClientKey('sdk_abc123')).toBe(true);
    expect(isClientKey('cli_abc123')).toBe(true);
    expect(isClientKey('srv_abc123')).toBe(false);
    expect(isClientKey('random_key')).toBe(false);
  });
});

describe('generateHMACSHA256', () => {
  it('produces consistent hex output', async () => {
    const key = 'test-secret-key';
    const data = 'hello world';

    const hash1 = await generateHMACSHA256(data, key);
    const hash2 = await generateHMACSHA256(data, key);

    // Same input should produce same output
    expect(hash1).toBe(hash2);

    // Should be a hex string (64 chars for SHA-256)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different output for different data', async () => {
    const key = 'test-secret-key';

    const hash1 = await generateHMACSHA256('data-one', key);
    const hash2 = await generateHMACSHA256('data-two', key);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different output for different keys', async () => {
    const data = 'same-data';

    const hash1 = await generateHMACSHA256(data, 'key-one');
    const hash2 = await generateHMACSHA256(data, 'key-two');

    expect(hash1).not.toBe(hash2);
  });
});

describe('createRequestSignature', () => {
  it('returns signature, timestamp, and keyId', async () => {
    const apiKey = 'sdk_abc12345xyz';
    const body = JSON.stringify({ to: 'user@example.com', subject: 'Hello' });

    const result = await createRequestSignature(body, apiKey);

    expect(result).toHaveProperty('signature');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('keyId');

    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);

    expect(typeof result.timestamp).toBe('number');
    expect(result.timestamp).toBeGreaterThan(0);

    expect(result.keyId).toBe('sdk_abc1');
  });
});

describe('verifyRequestSignature', () => {
  it('validates correct signatures', async () => {
    const apiKey = 'sdk_abc12345xyz';
    const body = JSON.stringify({ to: 'user@example.com', subject: 'Test' });

    const { signature, timestamp } = await createRequestSignature(body, apiKey);

    const isValid = await verifyRequestSignature(body, signature, timestamp, apiKey);

    expect(isValid).toBe(true);
  });

  it('rejects tampered body', async () => {
    const apiKey = 'sdk_abc12345xyz';
    const originalBody = JSON.stringify({ to: 'user@example.com', subject: 'Test' });
    const tamperedBody = JSON.stringify({ to: 'attacker@evil.com', subject: 'Test' });

    const { signature, timestamp } = await createRequestSignature(originalBody, apiKey);

    const isValid = await verifyRequestSignature(tamperedBody, signature, timestamp, apiKey);

    expect(isValid).toBe(false);
  });

  it('rejects expired signatures', async () => {
    const apiKey = 'sdk_abc12345xyz';
    const body = JSON.stringify({ to: 'user@example.com', subject: 'Test' });

    const { signature } = await createRequestSignature(body, apiKey);

    // Use a timestamp far in the past (10 minutes ago)
    const expiredTimestamp = Date.now() - 10 * 60 * 1000;

    const isValid = await verifyRequestSignature(
      body,
      signature,
      expiredTimestamp,
      apiKey,
      300_000, // 5 minute max age
    );

    expect(isValid).toBe(false);
  });
});
