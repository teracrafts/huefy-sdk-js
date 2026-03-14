import type { Logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignedPayload {
  data: unknown;
  signature: string;
  timestamp: number;
  keyId: string;
}

export interface RequestSignature {
  signature: string;
  timestamp: number;
  keyId: string;
}

// ---------------------------------------------------------------------------
// PII detection
// ---------------------------------------------------------------------------

/**
 * 40+ PII field patterns used for case-insensitive matching.
 *
 * Each pattern is stored in its normalised form (lowercase, no separators)
 * so comparisons only need a single normalisation pass on the input.
 */
const piiPatterns: string[] = [
  'email', 'phone', 'telephone', 'mobile',
  'ssn', 'social_security', 'socialsecurity',
  'credit_card', 'creditcard', 'card_number', 'cardnumber', 'cvv',
  'password', 'passwd', 'secret',
  'token', 'api_key', 'apikey',
  'private_key', 'privatekey',
  'access_token', 'accesstoken',
  'refresh_token', 'refreshtoken',
  'auth_token', 'authtoken',
  'address', 'street', 'zip_code', 'zipcode', 'postal_code', 'postalcode',
  'date_of_birth', 'dateofbirth', 'dob', 'birth_date', 'birthdate',
  'passport', 'driver_license', 'driverlicense',
  'national_id', 'nationalid',
  'bank_account', 'bankaccount',
  'routing_number', 'routingnumber',
  'iban', 'swift',
];

/** Pre-computed normalised patterns (lowercase, hyphens and underscores removed). */
const normalizedPatterns: string[] = piiPatterns.map((p) =>
  p.toLowerCase().replace(/[-_]/g, ''),
);

/**
 * Normalise a field name for PII comparison.
 *
 * Converts to lowercase and strips hyphens / underscores so that
 * `date-of-birth`, `date_of_birth`, and `dateOfBirth` all match.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[-_]/g, '');
}

/**
 * Returns `true` when `fieldName` looks like it could contain PII.
 *
 * Matching is case-insensitive and ignores hyphens / underscores.
 */
export function isPotentialPIIField(fieldName: string): boolean {
  const normalized = normalize(fieldName);
  return normalizedPatterns.some((pattern) => normalized.includes(pattern));
}

/**
 * Recursively inspects `data` and returns the dot-delimited paths of any
 * keys that look like PII fields.
 *
 * A `visited` set guards against infinite recursion on circular references.
 */
export function detectPotentialPII(
  data: Record<string, unknown>,
  prefix?: string,
  visited: Set<object> = new Set(),
): string[] {
  const results: string[] = [];

  if (visited.has(data)) return results;
  visited.add(data);

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isPotentialPIIField(key)) {
      results.push(path);
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      results.push(
        ...detectPotentialPII(value as Record<string, unknown>, path, visited),
      );
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          results.push(
            ...detectPotentialPII(item as Record<string, unknown>, `${path}[${i}]`, visited),
          );
        }
      });
    }
  }

  return results;
}

/**
 * Logs a warning when `data` contains fields that look like PII.
 *
 * The warning includes the detected field paths and advice to review
 * whether the data should be transmitted.
 */
export function warnIfPotentialPII(
  data: Record<string, unknown>,
  dataType: string,
  logger: Logger,
): void {
  const piiFields = detectPotentialPII(data);
  if (piiFields.length === 0) return;

  logger.warn(
    `Potential PII detected in ${dataType} data. ` +
      `Fields: [${piiFields.join(', ')}]. ` +
      'Please review whether this data should be transmitted and ensure ' +
      'compliance with your data protection policies.',
  );
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/**
 * Returns the first 8 characters of an API key, suitable for logging
 * without exposing the full secret.
 */
export function getKeyId(apiKey: string): string {
  return apiKey.slice(0, 8);
}

/**
 * Returns `true` when the key is a server-side key (prefixed with `srv_`).
 */
export function isServerKey(apiKey: string): boolean {
  return apiKey.startsWith('srv_');
}

/**
 * Returns `true` when the key is a client-side key (prefixed with `sdk_` or `cli_`).
 */
export function isClientKey(apiKey: string): boolean {
  return apiKey.startsWith('sdk_') || apiKey.startsWith('cli_');
}

// ---------------------------------------------------------------------------
// HMAC-SHA256
// ---------------------------------------------------------------------------

/**
 * Converts an ArrayBuffer to its lowercase hex string representation.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Generates an HMAC-SHA256 hex digest of `message` using `key`.
 *
 * Prefers the Web Crypto API (`crypto.subtle`) for broad browser
 * compatibility.  Falls back to Node.js `node:crypto` when subtle is
 * not available (e.g. older Node versions or non-secure contexts).
 */
export async function generateHMACSHA256(
  message: string,
  key: string,
): Promise<string> {
  const encoder = new TextEncoder();

  // --- Web Crypto (browser + modern Node) ---
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined'
  ) {
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(message),
    );
    return bufferToHex(signature);
  }

  // --- Node.js fallback ---
  const nodeCrypto = await import('node:crypto');
  const hmac = nodeCrypto.createHmac('sha256', key);
  hmac.update(message);
  return hmac.digest('hex');
}

/** Default maximum age for request signatures (5 minutes in milliseconds). */
const DEFAULT_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Payload signing
// ---------------------------------------------------------------------------

/**
 * Signs arbitrary data with an HMAC-SHA256 signature.
 *
 * @returns A {@link SignedPayload} containing the original data, signature,
 *          timestamp, and a truncated key identifier.
 */
export async function signPayload(
  data: unknown,
  apiKey: string,
  timestamp?: number,
): Promise<SignedPayload> {
  const ts = timestamp ?? Date.now();
  const message = JSON.stringify({ data, timestamp: ts });
  const signature = await generateHMACSHA256(message, apiKey);

  return {
    data,
    signature,
    timestamp: ts,
    keyId: getKeyId(apiKey),
  };
}

/**
 * Creates an HMAC-SHA256 signature for an HTTP request body.
 *
 * The signed message has the form `<timestamp>.<body>` so that the
 * timestamp is bound to the payload and cannot be replayed independently.
 */
export async function createRequestSignature(
  body: string,
  apiKey: string,
): Promise<RequestSignature> {
  const timestamp = Date.now();
  const message = `${timestamp}.${body}`;
  const signature = await generateHMACSHA256(message, apiKey);

  return {
    signature,
    timestamp,
    keyId: getKeyId(apiKey),
  };
}

/**
 * Verifies an HMAC-SHA256 request signature.
 *
 * @param body      - The raw request body that was signed.
 * @param signature - The hex signature to verify.
 * @param timestamp - The epoch-millisecond timestamp bound to the signature.
 * @param apiKey    - The shared secret used to produce the signature.
 * @param maxAgeMs  - Maximum acceptable age of the signature in milliseconds.
 *                    Defaults to 5 minutes (300 000 ms).
 * @returns `true` when the signature is valid and within the age window.
 */
export async function verifyRequestSignature(
  body: string,
  signature: string,
  timestamp: number,
  apiKey: string,
  maxAgeMs: number = DEFAULT_SIGNATURE_MAX_AGE_MS,
): Promise<boolean> {
  // Reject if the signature is too old (or from the future).
  const age = Math.abs(Date.now() - timestamp);
  if (age > maxAgeMs) {
    return false;
  }

  const message = `${timestamp}.${body}`;
  const expected = await generateHMACSHA256(message, apiKey);

  // Constant-time comparison to avoid timing attacks.
  if (expected.length !== signature.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return mismatch === 0;
}
