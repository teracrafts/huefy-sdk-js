# @teracrafts/huefy

Official TypeScript SDK for [Huefy](https://huefy.dev) — transactional email delivery made simple.

## Installation

```bash
npm install @teracrafts/huefy
# or
yarn add @teracrafts/huefy
# or
pnpm add @teracrafts/huefy
```

## Requirements

- Node.js 18+
- TypeScript 5.0+ (optional but recommended)

## Quick Start

```typescript
import { HuefyEmailClient } from '@teracrafts/huefy';

const client = new HuefyEmailClient({
  apiKey: process.env.HUEFY_API_KEY!,
});

const response = await client.sendEmail({
  templateKey: 'welcome-email',
  recipient: { email: 'alice@example.com', name: 'Alice' },
  variables: { firstName: 'Alice', trialDays: 14 },
});

console.log(response.messageId);
client.close();
```

## Key Features

- **Retry with exponential backoff** — configurable attempts, base delay, ceiling, and jitter to prevent thundering herd
- **Circuit breaker** — opens after 5 consecutive failures, probes after 30 s, resets automatically
- **HMAC-SHA256 signing** — optional request signing for additional integrity verification
- **Key rotation** — primary + secondary API key with seamless failover
- **Rate limit callbacks** — `onRateLimitUpdate` fires whenever rate-limit headers change
- **PII detection** — warns when template variables contain sensitive field patterns
- **Error sanitization** — redacts file paths, IPs, keys, and emails from error messages
- **Pluggable logger** — bring your own logger (winston, pino, etc.) or use the built-in console logger

## Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | **Required.** Must have prefix `sdk_`, `srv_`, or `cli_` |
| `baseUrl` | `string` | `https://api.huefy.dev/api/v1/sdk` | Override the API base URL |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `retryConfig.maxAttempts` | `number` | `3` | Total attempts including the first |
| `retryConfig.baseDelayMs` | `number` | `500` | Exponential backoff base delay |
| `retryConfig.maxDelayMs` | `number` | `10000` | Maximum backoff delay |
| `retryConfig.jitter` | `number` | `0.2` | Random jitter factor (0–1) |
| `circuitBreakerConfig.failureThreshold` | `number` | `5` | Consecutive failures before circuit opens |
| `circuitBreakerConfig.resetTimeoutMs` | `number` | `30000` | Milliseconds before half-open probe |
| `logger` | `Logger` | `ConsoleLogger` | Custom logging sink |
| `secondaryApiKey` | `string` | — | Backup key used during key rotation |
| `enableRequestSigning` | `boolean` | `false` | Enable HMAC-SHA256 request signing |
| `onRateLimitUpdate` | `(info: RateLimitInfo) => void` | — | Callback fired on rate-limit header changes |

## Bulk Email

```typescript
const bulk = await client.sendBulkEmails({
  emails: [
    { templateKey: 'promo', recipient: { email: 'bob@example.com' } },
    { templateKey: 'promo', recipient: { email: 'carol@example.com' } },
  ],
});

console.log(`Sent: ${bulk.totalSent}, Failed: ${bulk.totalFailed}`);
```

## Error Handling

```typescript
import {
  HuefyEmailClient,
  HuefyAuthError,
  HuefyRateLimitError,
  HuefyCircuitOpenError,
  HuefyNetworkError,
} from '@teracrafts/huefy';

try {
  const res = await client.sendEmail({
    templateKey: 'order-confirmation',
    recipient: { email: 'user@example.com' },
  });
  console.log('Delivered:', res.messageId);
} catch (err) {
  if (err instanceof HuefyAuthError) {
    console.error('Invalid API key');
  } else if (err instanceof HuefyRateLimitError) {
    console.error(`Rate limited. Retry after ${err.retryAfter}s`);
  } else if (err instanceof HuefyCircuitOpenError) {
    console.error('Circuit open — service unavailable, backing off');
  } else if (err instanceof HuefyNetworkError) {
    console.error('Network error:', err.message);
  }
}
```

### Error Code Reference

| Class | Code | Meaning |
|-------|------|---------|
| `HuefyInitError` | 1001 | Client failed to initialise |
| `HuefyAuthError` | 1102 | API key rejected |
| `HuefyNetworkError` | 1201 | Upstream request failed |
| `HuefyCircuitOpenError` | 1301 | Circuit breaker tripped |
| `HuefyRateLimitError` | 2003 | Rate limit exceeded |
| `HuefyTemplateMissingError` | 2005 | Template key not found |

## Health Check

```typescript
const health = await client.healthCheck();
if (health.status !== 'healthy') {
  console.warn('Huefy degraded:', health.status);
}
```

## Local Development

Set `HUEFY_MODE=local` to point the SDK at a local Huefy server:

```bash
HUEFY_MODE=local node my-script.js
```

Or set `baseUrl` explicitly:

```typescript
const client = new HuefyEmailClient({
  apiKey: 'sdk_local_key',
  baseUrl: 'http://localhost:3000/api/v1/sdk',
});
```

## Custom Logger

```typescript
import winston from 'winston';

const log = winston.createLogger({ level: 'info', transports: [new winston.transports.Console()] });

const client = new HuefyEmailClient({
  apiKey: process.env.HUEFY_API_KEY!,
  logger: {
    debug: (msg, meta) => log.debug(msg, meta),
    info:  (msg, meta) => log.info(msg, meta),
    warn:  (msg, meta) => log.warn(msg, meta),
    error: (msg, meta) => log.error(msg, meta),
  },
});
```

## Developer Guide

Full documentation, advanced patterns, and provider configuration are in the [TypeScript Developer Guide](../../docs/spec/guides/typescript.guide.md).

## License

MIT
