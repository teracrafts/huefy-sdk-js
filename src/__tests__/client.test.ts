import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HuefyClient } from '../client';

// Mock the HttpClient module so we can control its behavior
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

// Access the mocked functions for assertions
async function getMocks() {
  const mod = await import('../http/http-client');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockRequest: (mod as any).__mockRequest as ReturnType<typeof vi.fn>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockClose: (mod as any).__mockClose as ReturnType<typeof vi.fn>,
  };
}

describe('HuefyClient', () => {
  let mockRequest: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mocks = await getMocks();
    mockRequest = mocks.mockRequest;
    mockClose = mocks.mockClose;
    mockRequest.mockReset();
    mockClose.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws if apiKey is empty', () => {
      expect(() => new HuefyClient({ apiKey: '' })).toThrow();

      try {
        new HuefyClient({ apiKey: '' });
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('apiKey is required');
      }
    });

    it('throws if apiKey is not provided', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new HuefyClient({} as any)).toThrow();
    });

    it('creates client with valid config', () => {
      const client = new HuefyClient({
        apiKey: 'sdk_test_key_123',
      });

      expect(client).toBeDefined();
    });

    it('accepts optional baseUrl', () => {
      const client = new HuefyClient({
        apiKey: 'sdk_test_key_123',
        baseUrl: 'https://custom-api.example.com',
      });

      expect(client).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('makes GET /health request', async () => {
      mockRequest.mockResolvedValue({ status: 'ok', version: '1.0.0' });

      const client = new HuefyClient({ apiKey: 'sdk_test_key_123' });

      const result = await client.healthCheck();

      expect(mockRequest).toHaveBeenCalledWith('/health', { method: 'GET' });
      expect(result).toEqual({ status: 'ok', version: '1.0.0' });
    });
  });

  describe('getConfig', () => {
    it('returns config without apiKey', () => {
      const client = new HuefyClient({
        apiKey: 'sdk_secret_key_abc',
        baseUrl: 'https://api.example.com',
      });

      const config = client.getConfig();

      // Should expose baseUrl but NOT the apiKey
      expect(config.baseUrl).toBe('https://api.example.com');
      expect(config).not.toHaveProperty('apiKey');
      expect(JSON.stringify(config)).not.toContain('sdk_secret_key_abc');
    });
  });

  describe('close', () => {
    it('calls http.close', () => {
      const client = new HuefyClient({ apiKey: 'sdk_test_key_123' });

      client.close();

      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });
});
