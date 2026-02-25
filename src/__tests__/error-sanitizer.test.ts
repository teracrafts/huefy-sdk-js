import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sanitizeErrorMessage,
  getDefaultSanitizationConfig,
  setDefaultSanitizationConfig,
  type ErrorSanitizationConfig,
} from '../errors/error-sanitizer';

describe('sanitizeErrorMessage', () => {
  // Store original config so we can restore it after each test
  let originalConfig: ErrorSanitizationConfig;

  beforeEach(() => {
    originalConfig = getDefaultSanitizationConfig();
  });

  afterEach(() => {
    setDefaultSanitizationConfig(originalConfig);
  });

  it('returns original message when sanitization disabled', () => {
    const message = 'Error at /home/user/secrets/key.pem with key sdk_abc123xyz';
    const config: ErrorSanitizationConfig = { enabled: false, preserveOriginal: false };

    const result = sanitizeErrorMessage(message, config);

    expect(result).toBe(message);
  });

  it('redacts Unix file paths', () => {
    const message = 'File not found: /home/user/project/config.json';

    const result = sanitizeErrorMessage(message);

    expect(result).toContain('[PATH]');
    expect(result).not.toContain('/home/user');
  });

  it('redacts Windows file paths', () => {
    const message = 'Cannot read C:\\Users\\admin\\Documents\\secret.txt';

    const result = sanitizeErrorMessage(message);

    expect(result).toContain('[PATH]');
    expect(result).not.toContain('C:\\Users');
  });

  it('redacts IPv4 addresses', () => {
    const message = 'Connection refused to 192.168.1.100:3000';

    const result = sanitizeErrorMessage(message);

    expect(result).toContain('[IP]');
    expect(result).not.toContain('192.168.1.100');
  });

  it('redacts SDK API keys', () => {
    const message = 'Authentication failed for key sdk_abc123def456';

    const result = sanitizeErrorMessage(message);

    expect(result).toContain('sdk_[REDACTED]');
    expect(result).not.toContain('sdk_abc123def456');
  });

  it('redacts server API keys', () => {
    const message = 'Invalid key: srv_abc123def456ghi';

    const result = sanitizeErrorMessage(message);

    expect(result).toContain('srv_[REDACTED]');
    expect(result).not.toContain('srv_abc123def456ghi');
  });

  it('redacts CLI API keys', () => {
    const message = 'CLI authentication with cli_abc123def456ghi';

    const result = sanitizeErrorMessage(message);

    expect(result).toContain('cli_[REDACTED]');
    expect(result).not.toContain('cli_abc123def456ghi');
  });

  it('redacts email addresses', () => {
    const message = 'Notification sent to admin@example.com failed';

    const result = sanitizeErrorMessage(message);

    expect(result).toContain('[EMAIL]');
    expect(result).not.toContain('admin@example.com');
  });

  it('redacts database connection strings', () => {
    const testCases = [
      'postgres://user:pass@host:5432/db',
      'mysql://root:secret@localhost/mydb',
      'mongodb://admin:pwd@cluster.mongodb.net/test',
      'redis://default:password@cache.example.com:6379',
    ];

    for (const connString of testCases) {
      const message = `Failed to connect: ${connString}`;
      const result = sanitizeErrorMessage(message);

      expect(result).toContain('[CONNECTION_STRING]');
      expect(result).not.toContain(connString);
    }
  });

  it('handles multiple patterns in same message', () => {
    const message =
      'Error at /var/log/app.log: user admin@corp.com with key sdk_secret123 from 10.0.0.5';

    const result = sanitizeErrorMessage(message);

    expect(result).toContain('[PATH]');
    expect(result).toContain('[EMAIL]');
    expect(result).toContain('sdk_[REDACTED]');
    expect(result).toContain('[IP]');
    expect(result).not.toContain('/var/log');
    expect(result).not.toContain('admin@corp.com');
    expect(result).not.toContain('sdk_secret123');
    expect(result).not.toContain('10.0.0.5');
  });

  describe('preserveOriginal option', () => {
    it('can be set via setDefaultSanitizationConfig', () => {
      setDefaultSanitizationConfig({ enabled: true, preserveOriginal: true });

      const config = getDefaultSanitizationConfig();

      expect(config.preserveOriginal).toBe(true);
      expect(config.enabled).toBe(true);
    });

    it('setDefaultSanitizationConfig creates a shallow copy', () => {
      const config: ErrorSanitizationConfig = { enabled: false, preserveOriginal: true };
      setDefaultSanitizationConfig(config);

      // Mutating the original object should not affect the stored config
      config.enabled = true;

      const storedConfig = getDefaultSanitizationConfig();
      expect(storedConfig.enabled).toBe(false);
    });

    it('getDefaultSanitizationConfig returns a copy each time', () => {
      const config1 = getDefaultSanitizationConfig();
      const config2 = getDefaultSanitizationConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });
});
