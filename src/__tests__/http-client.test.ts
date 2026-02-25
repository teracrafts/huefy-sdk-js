import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../http/http-client';
import { HuefyError } from '../errors/huefy-error';
import { ErrorCode } from '../errors/error-codes';

// Mock global fetch
const mockFetch = vi.fn();

describe('HttpClient', () => {
  let client: HttpClient;
  const baseUrl = 'https://api.example.com';
  const apiKey = 'sdk_test_key_123';

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();

    client = new HttpClient({
      baseUrl,
      apiKey,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('constructs correct URL from base + path', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await client.request('GET', '/api/v1/health');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/health');
  });

  it('sends X-API-Key header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await client.request('GET', '/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-API-Key']).toBe(apiKey);
  });

  it('sends correct Content-Type for JSON body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await client.request('POST', '/emails/send', {
      body: { to: 'user@example.com', subject: 'Test' },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({
      to: 'user@example.com',
      subject: 'Test',
    });
  });

  it('handles successful JSON response', async () => {
    const responseData = { id: '123', status: 'sent' };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const result = await client.request('GET', '/status');

    expect(result).toEqual(responseData);
  });

  it('throws HuefyError on 4xx response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ message: 'Validation failed', error: 'Invalid email' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await expect(client.request('POST', '/emails/send')).rejects.toThrow(HuefyError);

    try {
      await client.request('POST', '/emails/send');
    } catch (err) {
      expect(err).toBeInstanceOf(HuefyError);
      expect((err as HuefyError).statusCode).toBe(422);
    }
  });

  it('throws HuefyError on 5xx response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal server error' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await expect(client.request('GET', '/health')).rejects.toThrow(HuefyError);

    try {
      await client.request('GET', '/health');
    } catch (err) {
      expect(err).toBeInstanceOf(HuefyError);
      const sdkError = err as HuefyError;
      expect(sdkError.statusCode).toBe(500);
      expect(sdkError.recoverable).toBe(true);
    }
  });

  it('throws NetworkError on fetch failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(client.request('GET', '/health')).rejects.toThrow(HuefyError);

    try {
      await client.request('GET', '/health');
    } catch (err) {
      expect(err).toBeInstanceOf(HuefyError);
      expect((err as HuefyError).code).toBe(ErrorCode.NETWORK_ERROR);
    }
  });

  it('respects custom timeout', async () => {
    const clientWithTimeout = new HttpClient({
      baseUrl,
      apiKey,
      timeout: 5000,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await clientWithTimeout.request('GET', '/test');

    const [, options] = mockFetch.mock.calls[0];
    // The client should pass a signal for timeout control
    expect(options.signal).toBeDefined();
  });

  it('close() resets circuit breaker', () => {
    // close() should not throw and should reset internal state
    expect(() => client.close()).not.toThrow();
  });
});
