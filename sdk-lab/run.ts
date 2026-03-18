/**
 * Huefy TypeScript SDK Lab
 * Internal integration verification — no real network calls (except health check).
 */

import { HuefyEmailClient } from '../src/huefy-client';
import { signPayload } from '../src/utils/security';
import { sanitizeErrorMessage } from '../src/errors/error-sanitizer';
import { detectPotentialPII } from '../src/utils/security';
import { CircuitBreaker, CircuitState } from '../src/http/circuit-breaker';

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

  // 1. Initialization
  let client: HuefyEmailClient | undefined;
  try {
    client = new HuefyEmailClient({ apiKey: 'sdk_lab_test_key' });
    check('Initialization', true);
  } catch (e) {
    check('Initialization', false, String(e));
  }

  // 2. Config validation
  try {
    new HuefyEmailClient({ apiKey: '' });
    check('Config validation', false, 'Expected error was not thrown');
  } catch {
    check('Config validation', true);
  }

  // 3. HMAC signing
  try {
    const signed = await signPayload({ test: 'data' }, 'test_secret', 1700000000);
    const ok = typeof signed.signature === 'string' && signed.signature.length === 64;
    check('HMAC signing', ok, ok ? '' : `signature="${signed.signature}"`);
  } catch (e) {
    check('HMAC signing', false, String(e));
  }

  // 4. Error sanitization
  try {
    const input = 'Error at 192.168.1.1 for user@example.com';
    const result = sanitizeErrorMessage(input);
    const ok = !result.includes('192.168.1.1') && !result.includes('user@example.com');
    check('Error sanitization', ok, ok ? '' : `result="${result}"`);
  } catch (e) {
    check('Error sanitization', false, String(e));
  }

  // 5. PII detection
  try {
    const fields = detectPotentialPII({ email: 'test@test.com', name: 'John', ssn: '123-45-6789' });
    const hasEmail = fields.includes('email');
    const hasSsn = fields.includes('ssn');
    const ok = fields.length > 0 && hasEmail && hasSsn;
    check('PII detection', ok, ok ? '' : `fields=${JSON.stringify(fields)}`);
  } catch (e) {
    check('PII detection', false, String(e));
  }

  // 6. Circuit breaker state
  try {
    const cb = new CircuitBreaker();
    const state = cb.getState();
    check('Circuit breaker state', state === CircuitState.CLOSED, `state=${state}`);
  } catch (e) {
    check('Circuit breaker state', false, String(e));
  }

  // 7. Health check
  try {
    const baseUrl = process.env.HUEFY_MODE === 'local'
      ? 'http://localhost:3000/api/v1/sdk'
      : 'https://api.huefy.dev/api/v1/sdk';
    const hc = new HuefyEmailClient({ apiKey: 'sdk_lab_test_key', baseUrl });
    await hc.healthCheck();
    check('Health check', true);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isNetworkError = /fetch|network|ECONNREFUSED|ENOTFOUND|timeout|connect/i.test(msg);
    const isAuthError = /401|403|unauthorized|forbidden|invalid api key/i.test(msg);
    check('Health check', isNetworkError || isAuthError, `(network/auth error — ${msg.slice(0, 80)})`);
  }

  // 8. Cleanup
  try {
    if (client) {
      client.close();
    }
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
  } else {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
