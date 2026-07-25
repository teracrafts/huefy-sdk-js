import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HuefyEmailClient } from '../huefy-client';
import { HuefyDomainError } from '../errors/huefy-errors';

vi.mock('../http/http-client', () => {
  const mockRequest = vi.fn();
  const mockClose = vi.fn();

  return {
    HttpClient: vi.fn().mockImplementation(() => ({
      request: mockRequest,
      close: mockClose,
    })),
    __mockRequest: mockRequest,
    __mockClose: mockClose,
  };
});

async function getMocks() {
  const mod = await import('../http/http-client');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockRequest: (mod as any).__mockRequest as ReturnType<typeof vi.fn>,
  };
}

describe('HuefyEmailClient', () => {
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    ({ mockRequest } = await getMocks());
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({
      success: true,
      correlationId: 'corr-1',
      data: {
        emailId: 'email-1',
        status: 'queued',
        recipients: [{ email: 'user@example.com', status: 'queued' }],
      },
    });
  });

  it('preserves string recipients for backward compatibility', async () => {
    const client = new HuefyEmailClient({ apiKey: 'sdk_test_key_123' });

    await client.sendEmail({
      templateKey: 'welcome-email',
      recipient: ' user@example.com ',
      data: { firstName: 'Ada' },
    });

    expect(mockRequest).toHaveBeenCalledWith('/emails/send', {
      method: 'POST',
      body: {
        templateKey: 'welcome-email',
        recipient: 'user@example.com',
        data: { firstName: 'Ada' },
        providerType: undefined,
        idempotencyKey: expect.any(String),
      },
    });
  });

  it('serializes recipient objects when provided', async () => {
    const client = new HuefyEmailClient({ apiKey: 'sdk_test_key_123' });

    await client.sendEmail({
      templateKey: 'welcome-email',
      recipient: {
        email: ' user@example.com ',
        type: 'cc',
        data: { locale: 'en' },
      },
      data: { firstName: 'Ada' },
    });

    expect(mockRequest).toHaveBeenCalledWith('/emails/send', {
      method: 'POST',
      body: {
        templateKey: 'welcome-email',
        recipient: {
          email: 'user@example.com',
          type: 'cc',
          data: { locale: 'en' },
        },
        data: { firstName: 'Ada' },
        providerType: undefined,
        idempotencyKey: expect.any(String),
      },
    });
  });

  it('normalizes structured recipient type casing', async () => {
    const client = new HuefyEmailClient({ apiKey: 'sdk_test_key_123' });

    await client.sendEmail({
      templateKey: 'welcome-email',
      recipient: {
        email: ' user@example.com ',
        type: 'CC' as 'cc',
        data: { locale: 'en' },
      },
      data: { firstName: 'Ada' },
    });

    expect(mockRequest).toHaveBeenCalledWith('/emails/send', {
      method: 'POST',
      body: {
        templateKey: 'welcome-email',
        recipient: {
          email: 'user@example.com',
          type: 'cc',
          data: { locale: 'en' },
        },
        data: { firstName: 'Ada' },
        providerType: undefined,
        idempotencyKey: expect.any(String),
      },
    });
  });

  it('uses caller-provided idempotency keys for single sends', async () => {
    const client = new HuefyEmailClient({ apiKey: 'sdk_test_key_123' });

    await client.sendEmail({
      templateKey: 'welcome-email',
      recipient: 'user@example.com',
      data: { firstName: 'Ada' },
      idempotencyKey: ' idem_custom_123 ',
    });

    expect(mockRequest).toHaveBeenCalledWith('/emails/send', {
      method: 'POST',
      body: {
        templateKey: 'welcome-email',
        recipient: 'user@example.com',
        data: { firstName: 'Ada' },
        providerType: undefined,
        idempotencyKey: 'idem_custom_123',
      },
    });
  });

  it('rejects idempotency keys longer than the backend limit', async () => {
    const client = new HuefyEmailClient({ apiKey: 'sdk_test_key_123' });

    await expect(client.sendEmail({
      templateKey: 'welcome-email',
      recipient: 'user@example.com',
      data: { firstName: 'Ada' },
      idempotencyKey: 'x'.repeat(129),
    })).rejects.toBeInstanceOf(HuefyDomainError);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('normalizes and validates bulk recipients', async () => {
    const client = new HuefyEmailClient({ apiKey: 'sdk_test_key_123' });

    await client.sendBulkEmails({
      templateKey: 'welcome-email',
      recipients: [
        {
          email: ' user@example.com ',
          type: 'BCC' as 'bcc',
          data: { locale: 'en' },
        },
      ],
    });

    expect(mockRequest).toHaveBeenCalledWith('/emails/send-bulk', {
      method: 'POST',
      body: {
        templateKey: 'welcome-email',
        recipients: [
          {
            email: 'user@example.com',
            type: 'bcc',
            data: { locale: 'en' },
          },
        ],
        providerType: undefined,
      },
    });
  });

  it('validates templates with optional version, test data, and correlation id', async () => {
    mockRequest.mockResolvedValue({
      success: true,
      correlationId: 'corr-validate-1',
      data: {
        isValid: true,
        errors: [],
        warnings: [],
        variables: ['firstName'],
        validatedAt: '2026-07-25T18:00:00Z',
      },
    });
    const client = new HuefyEmailClient({ apiKey: 'sdk_test_key_123' });

    const response = await client.validateTemplate({
      templateKey: ' welcome-email ',
      templateVersion: 3,
      testData: { firstName: 'Ada' },
      correlationId: 'corr-validate-1',
    });

    expect(mockRequest).toHaveBeenCalledWith('/emails/validate-template', {
      method: 'POST',
      body: {
        templateKey: 'welcome-email',
        templateVersion: 3,
        testData: { firstName: 'Ada' },
        correlationId: 'corr-validate-1',
      },
    });
    expect(response.data.isValid).toBe(true);
    expect(response.data.variables).toEqual(['firstName']);
  });

  it('rejects validateTemplate without a template key', async () => {
    const client = new HuefyEmailClient({ apiKey: 'sdk_test_key_123' });

    await expect(client.validateTemplate({
      templateKey: ' ',
    })).rejects.toBeInstanceOf(HuefyDomainError);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
