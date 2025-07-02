# Huefy SDK for JavaScript/TypeScript

The official JavaScript/TypeScript SDK for Huefy - App Mail Templates. Create and manage email templates for your applications with dynamic data and multi-provider sending capabilities.

## Installation

```bash
npm install @teracrafts/huefy
```

## Quick Start

```typescript
import { HuefyClient } from '@teracrafts/huefy';

const huefy = new HuefyClient({
  apiKey: 'your-api-key'
});

// Send an email
const result = await huefy.sendEmail('welcome-email', {
  name: 'John Doe',
  company: 'Acme Corp'
}, 'john@example.com');

console.log('Email sent:', result.messageId);
```

## Features

- ✅ **Type Safe** - Full TypeScript support with comprehensive type definitions
- ✅ **Error Handling** - Detailed error types with retry logic
- ✅ **Multiple Providers** - Support for SES, SendGrid, Mailgun, Mailchimp
- ✅ **Retry Logic** - Automatic retries with exponential backoff
- ✅ **Bulk Sending** - Send multiple emails efficiently
- ✅ **Validation** - Input validation for all parameters
- ✅ **Node.js & Browser** - Works in both environments

## Configuration

```typescript
const huefy = new HuefyClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.huefy.com/api/v1/sdk', // Optional
  timeout: 30000, // Optional, default 30 seconds
  retryAttempts: 3, // Optional, default 3
  retryDelay: 1000, // Optional, default 1 second
});
```

## Sending Emails

### Basic Usage

```typescript
// Send with default SES provider
await huefy.sendEmail('welcome-email', {
  name: 'John Doe',
  company: 'Acme Corp'
}, 'john@example.com');
```

### Custom Provider

```typescript
// Send with specific provider
await huefy.sendEmail('newsletter', {
  name: 'Jane Smith',
  unsubscribe_url: 'https://app.example.com/unsubscribe'
}, 'jane@example.com', {
  provider: 'sendgrid'
});
```

### Bulk Sending

```typescript
const results = await huefy.sendBulkEmails([
  {
    templateKey: 'welcome-email',
    data: { name: 'John Doe' },
    recipient: 'john@example.com'
  },
  {
    templateKey: 'welcome-email',
    data: { name: 'Jane Smith' },
    recipient: 'jane@example.com',
    options: { provider: 'mailgun' }
  }
]);

results.forEach(result => {
  if (result.success) {
    console.log(`Email sent to ${result.email}: ${result.result?.messageId}`);
  } else {
    console.error(`Failed to send to ${result.email}: ${result.error?.message}`);
  }
});
```

## Error Handling

```typescript
import { 
  HuefyError, 
  TemplateNotFoundError, 
  RateLimitError 
} from '@huefy-dev/sdk';

try {
  await huefy.sendEmail('template-key', data, 'user@example.com');
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    console.error('Template not found:', error.details.template_key);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded, retry after:', error.details.reset_at);
  } else if (error instanceof HuefyError) {
    console.error('Huefy API error:', error.code, error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Event Callbacks

```typescript
const huefy = new HuefyClient(config, {
  onSendStart: (request) => {
    console.log('Sending email:', request.template_key);
  },
  onSendSuccess: (response) => {
    console.log('Email sent successfully:', response.message_id);
  },
  onSendError: (error) => {
    console.error('Email send failed:', error.message);
  },
  onRetry: (attempt, error) => {
    console.log(`Retry attempt ${attempt}:`, error.message);
  }
});
```

## Available Providers

- `ses` - Amazon SES (default)
- `sendgrid` - SendGrid
- `mailgun` - Mailgun
- `mailchimp` - Mailchimp

## API Reference

### HuefyClient

#### Constructor
- `new HuefyClient(config: HuefyConfig, callbacks?: HuefyEventCallbacks)`

#### Methods
- `sendEmail(templateKey: string, data: EmailData, recipient: string, options?: SendEmailOptions): Promise<SendEmailResponse>`
- `sendBulkEmails(emails: BulkEmailRequest[]): Promise<BulkEmailResult[]>`
- `healthCheck(): Promise<HealthResponse>`
- `validateTemplate(templateKey: string, testData: EmailData): Promise<boolean>`
- `getConfig(): ClientConfig`

### Types

See the [full type definitions](./src/types.ts) for comprehensive TypeScript support.

## Examples

Check out the [examples directory](../../examples/javascript) for complete working examples.

## Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Type check
npm run typecheck
```

## License

MIT - see [LICENSE](../../LICENSE) for details.