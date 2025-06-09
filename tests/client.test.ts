/**
 * Tests for HuefyClient
 */

import { HuefyClient } from '../src/client.js';
import { ValidationError, AuthenticationError } from '../src/errors.js';
import type { HuefyConfig } from '../src/types.js';

describe('HuefyClient', () => {
  let client: HuefyClient;
  const validConfig: HuefyConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'http://localhost:8080/api/v1/sdk',
    timeout: 5000,
  };

  beforeEach(() => {
    client = new HuefyClient(validConfig);
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(client).toBeInstanceOf(HuefyClient);
      expect(client.getConfig().baseUrl).toBe(validConfig.baseUrl);
      expect(client.getConfig().timeout).toBe(validConfig.timeout);
    });

    it('should use default values for optional config', () => {
      const minimalClient = new HuefyClient({ apiKey: 'test-key' });
      const config = minimalClient.getConfig();
      
      expect(config.baseUrl).toBe('https://api.huefy.com/api/v1/sdk');
      expect(config.timeout).toBe(30000);
    });

    it('should throw error for missing API key', () => {
      expect(() => {
        new HuefyClient({} as HuefyConfig);
      }).toThrow('API key is required');
    });

    it('should throw error for invalid API key type', () => {
      expect(() => {
        new HuefyClient({ apiKey: 123 } as any);
      }).toThrow('API key is required and must be a string');
    });
  });

  describe('sendEmail', () => {
    const validTemplateKey = 'welcome-email';
    const validData = { name: 'John Doe', company: 'Acme Corp' };
    const validRecipient = 'john@example.com';

    it('should validate template key', async () => {
      await expect(
        client.sendEmail('', validData, validRecipient),
      ).rejects.toThrow(ValidationError);

      await expect(
        client.sendEmail(null as any, validData, validRecipient),
      ).rejects.toThrow(ValidationError);

      await expect(
        client.sendEmail('a'.repeat(101), validData, validRecipient),
      ).rejects.toThrow(ValidationError);
    });

    it('should validate data parameter', async () => {
      await expect(
        client.sendEmail(validTemplateKey, null as any, validRecipient),
      ).rejects.toThrow(ValidationError);

      await expect(
        client.sendEmail(validTemplateKey, [] as any, validRecipient),
      ).rejects.toThrow(ValidationError);

      await expect(
        client.sendEmail(validTemplateKey, { name: 123 } as any, validRecipient),
      ).rejects.toThrow(ValidationError);
    });

    it('should validate recipient email', async () => {
      await expect(
        client.sendEmail(validTemplateKey, validData, ''),
      ).rejects.toThrow(ValidationError);

      await expect(
        client.sendEmail(validTemplateKey, validData, 'invalid-email'),
      ).rejects.toThrow(ValidationError);

      await expect(
        client.sendEmail(validTemplateKey, validData, 'a'.repeat(250) + '@example.com'),
      ).rejects.toThrow(ValidationError);

      await expect(
        client.sendEmail(validTemplateKey, validData, null as any),
      ).rejects.toThrow(ValidationError);
    });

    it('should accept valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@subdomain.example.com',
      ];

      // Mock HTTP client to avoid actual API calls
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          success: true,
          message: 'Email sent successfully',
          message_id: 'test-id',
          provider: 'ses',
        },
      });

      (client as any).http.post = mockPost;

      for (const email of validEmails) {
        await expect(
          client.sendEmail(validTemplateKey, validData, email),
        ).resolves.not.toThrow();
      }
    });
  });

  describe('sendBulkEmails', () => {
    it('should validate emails array', async () => {
      await expect(
        client.sendBulkEmails([]),
      ).rejects.toThrow('Emails array is required and must not be empty');

      await expect(
        client.sendBulkEmails(null as any),
      ).rejects.toThrow('Emails array is required and must not be empty');

      // Test max limit
      const tooManyEmails = Array(101).fill({
        templateKey: 'test',
        data: { name: 'test' },
        recipient: 'test@example.com',
      });

      await expect(
        client.sendBulkEmails(tooManyEmails),
      ).rejects.toThrow('Maximum 100 emails allowed per bulk request');
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = client.getConfig();
      
      expect(config.baseUrl).toBe(validConfig.baseUrl);
      expect(config.timeout).toBe(validConfig.timeout);
      expect(config.retryConfig).toBeDefined();
    });
  });

  describe('email validation', () => {
    const isValidEmail = (client as any).isValidEmail.bind(client);

    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@subdomain.example.com',
        'a@b.co',
      ];

      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com',
        'user@example',
        '',
        'user name@example.com',
      ];

      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });
});