/**
 * Huefy TypeScript SDK Lab
 * Core email contract verification without live sends.
 */

import { HuefyEmailClient } from '../src/huefy-client';

declare const process: { exit(code?: number): never };

const PASS = '\x1b[32m[PASS]\x1b[0m';
const FAIL = '\x1b[31m[FAIL]\x1b[0m';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`${PASS} ${label}`);
    passed++;
  } else {
    console.log(`${FAIL} ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function run(): Promise<void> {
  console.log('=== Huefy TypeScript SDK Lab ===\n');

  let client: HuefyEmailClient | undefined;
  try {
    client = new HuefyEmailClient({ apiKey: 'sdk_lab_test_key' });
    check('Initialization', true);
  } catch (e) {
    check('Initialization', false, String(e));
  }

  try {
    const emailClient = new HuefyEmailClient({ apiKey: 'sdk_lab_test_key' }) as HuefyEmailClient & {
      http: { request: <T = unknown>(path: string, options?: Record<string, unknown>) => Promise<T> };
    };
    let capturedPath = '';
    let capturedOptions: Record<string, unknown> | undefined;
    emailClient.http = {
      request: async (path: string, options?: Record<string, unknown>) => {
        capturedPath = path;
        capturedOptions = options;
        return {
          success: true,
          data: {
            emailId: 'email_123',
            status: 'queued',
            recipients: [{ email: 'alice@example.com', status: 'queued' }],
          },
          correlationId: 'corr_send_123',
        };
      },
    };

    const response = await emailClient.sendEmail({
      templateKey: ' welcome-email ',
      data: { firstName: 'Alice' },
      recipient: { email: ' alice@example.com ', type: 'cc', data: { locale: 'en' } },
      provider: 'ses',
    });

    const body = capturedOptions?.body as Record<string, unknown> | undefined;
    const recipient = body?.recipient as Record<string, unknown> | undefined;
    const ok =
      capturedPath === '/emails/send' &&
      capturedOptions?.method === 'POST' &&
      body?.templateKey === 'welcome-email' &&
      recipient?.email === 'alice@example.com' &&
      recipient?.type === 'cc' &&
      body?.providerType === 'ses' &&
      response.data.emailId === 'email_123';
    check('Single email contract', ok, ok ? '' : JSON.stringify({ capturedPath, capturedOptions, response }));
  } catch (e) {
    check('Single email contract', false, String(e));
  }

  try {
    const emailClient = new HuefyEmailClient({ apiKey: 'sdk_lab_test_key' }) as HuefyEmailClient & {
      http: { request: <T = unknown>(path: string, options?: Record<string, unknown>) => Promise<T> };
    };
    let capturedPath = '';
    let capturedOptions: Record<string, unknown> | undefined;
    emailClient.http = {
      request: async (path: string, options?: Record<string, unknown>) => {
        capturedPath = path;
        capturedOptions = options;
        return {
          success: true,
          data: {
            batchId: 'batch_123',
            status: 'processing',
            templateKey: 'digest',
            templateVersion: 3,
            senderUsed: 'alerts@huefy.dev',
            senderVerified: true,
            totalRecipients: 2,
            processedCount: 0,
            successCount: 0,
            failureCount: 0,
            suppressedCount: 0,
            startedAt: '2026-05-07T10:00:00Z',
            recipients: [
              { email: 'alice@example.com', status: 'queued' },
              { email: 'bob@example.com', status: 'queued' },
            ],
          },
          correlationId: 'corr_bulk_123',
        };
      },
    };

    const response = await emailClient.sendBulkEmails({
      templateKey: ' digest ',
      recipients: [
        { email: ' alice@example.com ', type: 'to', data: { locale: 'en' } },
        { email: ' bob@example.com ', type: 'bcc' },
      ],
      provider: 'mailgun',
    });

    const body = capturedOptions?.body as Record<string, unknown> | undefined;
    const recipients = body?.recipients as Array<Record<string, unknown>> | undefined;
    const ok =
      capturedPath === '/emails/send-bulk' &&
      capturedOptions?.method === 'POST' &&
      body?.templateKey === 'digest' &&
      body?.providerType === 'mailgun' &&
      recipients?.[0]?.email === 'alice@example.com' &&
      recipients?.[0]?.type === 'to' &&
      recipients?.[1]?.type === 'bcc' &&
      response.data.batchId === 'batch_123';
    check('Bulk email contract', ok, ok ? '' : JSON.stringify({ capturedPath, capturedOptions, response }));
  } catch (e) {
    check('Bulk email contract', false, String(e));
  }

  try {
    const emailClient = new HuefyEmailClient({ apiKey: 'sdk_lab_test_key' }) as HuefyEmailClient & {
      http: { request: <T = unknown>(path: string, options?: Record<string, unknown>) => Promise<T> };
    };
    let reachedTransport = false;
    emailClient.http = {
      request: async () => {
        reachedTransport = true;
        return {};
      },
    };
    await emailClient.sendEmail({
      templateKey: 'welcome',
      data: {},
      recipient: { email: 'not-an-email' },
    });
    check('Validation rejects invalid single recipient', false, 'expected validation error');
    void reachedTransport;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(
      'Validation rejects invalid single recipient',
      /invalid email|recipient type/i.test(msg),
      msg,
    );
  }

  try {
    const emailClient = new HuefyEmailClient({ apiKey: 'sdk_lab_test_key' }) as HuefyEmailClient & {
      http: { request: <T = unknown>(path: string, options?: Record<string, unknown>) => Promise<T> };
    };
    let reachedTransport = false;
    emailClient.http = {
      request: async () => {
        reachedTransport = true;
        return {};
      },
    };
    await emailClient.sendBulkEmails({
      templateKey: 'digest',
      recipients: [],
    });
    check('Validation rejects invalid bulk request', false, 'expected validation error');
    void reachedTransport;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check('Validation rejects invalid bulk request', /at least one email/i.test(msg), msg);
  }

  try {
    const healthClient = new HuefyEmailClient({ apiKey: 'sdk_lab_test_key' }) as HuefyEmailClient & {
      http: { request: <T = unknown>(path: string, options?: Record<string, unknown>) => Promise<T> };
    };
    let capturedPath = '';
    let capturedMethod = '';
    healthClient.http = {
      request: async (path: string, options?: Record<string, unknown>) => {
        capturedPath = path;
        capturedMethod = String(options.method ?? '');
        return {
          success: true,
          data: {
            status: 'healthy',
            timestamp: '2026-05-07T10:00:00Z',
            version: '1.0.0',
          },
          correlationId: 'corr_health_123',
        };
      },
    };
    const response = await healthClient.healthCheck();
    const ok =
      capturedPath === '/health' &&
      capturedMethod === 'GET' &&
      response.data.status === 'healthy';
    check('Health check path', ok, ok ? '' : JSON.stringify({ capturedPath, capturedMethod, response }));
  } catch (e) {
    check('Health check path', false, String(e));
  }

  try {
    client?.close();
    check('Cleanup', true);
  } catch (e) {
    check('Cleanup', false, String(e));
  }

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed === 0) {
    console.log('All verifications passed!');
    process.exit(0);
  }
  process.exit(1);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
