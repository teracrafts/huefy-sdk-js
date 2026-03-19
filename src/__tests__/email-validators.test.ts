import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateTemplateKey,
  validateEmailData,
  validateSendEmailInput,
  validateBulkCount,
} from '../validators/email-validators';

describe('Email Validators', () => {
  describe('validateEmail', () => {
    it('accepts valid email', () => {
      expect(validateEmail('user@example.com')).toBeNull();
    });
    it('rejects empty email', () => {
      expect(validateEmail('')).toBeTruthy();
    });
    it('rejects invalid email', () => {
      expect(validateEmail('not-an-email')).toBeTruthy();
    });
    it('rejects email without domain', () => {
      expect(validateEmail('user@')).toBeTruthy();
    });
    it('rejects overly long email', () => {
      const longEmail = 'a'.repeat(250) + '@b.co';
      expect(validateEmail(longEmail)).toBeTruthy();
    });
  });

  describe('validateTemplateKey', () => {
    it('accepts valid template key', () => {
      expect(validateTemplateKey('welcome-email')).toBeNull();
    });
    it('rejects empty template key', () => {
      expect(validateTemplateKey('')).toBeTruthy();
    });
    it('rejects overly long template key', () => {
      expect(validateTemplateKey('a'.repeat(101))).toBeTruthy();
    });
  });

  describe('validateEmailData', () => {
    it('accepts valid data', () => {
      expect(validateEmailData({ name: 'John' })).toBeNull();
    });
    it('rejects null', () => {
      expect(validateEmailData(null as any)).toBeTruthy();
    });
    it('rejects array', () => {
      expect(validateEmailData([] as any)).toBeTruthy();
    });
    it('accepts non-string values', () => {
      expect(validateEmailData({ count: 5 as any })).toBeNull();
    });
  });

  describe('validateSendEmailInput', () => {
    it('returns empty array for valid input', () => {
      expect(validateSendEmailInput('tpl', { name: 'John' }, 'user@test.com')).toEqual([]);
    });
    it('returns multiple errors for invalid input', () => {
      const errors = validateSendEmailInput('', null as any, 'bad');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateBulkCount', () => {
    it('accepts valid count', () => {
      expect(validateBulkCount(10)).toBeNull();
    });
    it('rejects zero', () => {
      expect(validateBulkCount(0)).toBeTruthy();
    });
    it('rejects over 1000', () => {
      expect(validateBulkCount(1001)).toBeTruthy();
    });
  });
});
