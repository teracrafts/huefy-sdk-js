/**
 * Error message sanitizer that strips sensitive data before it leaves the SDK.
 *
 * The sanitizer matches common patterns (file paths, IP addresses, API keys,
 * email addresses, database connection strings) and replaces them with safe
 * placeholder tokens.
 */

export interface ErrorSanitizationConfig {
  /** Master switch — when `false` messages pass through untouched. */
  enabled: boolean;
  /**
   * When `true` the original unsanitized message is kept in a secondary
   * field (useful for local debugging).  Should **never** be enabled in
   * production.
   */
  preserveOriginal: boolean;
}

interface SanitizationRule {
  /** Human-readable label for the rule (used in tests / debugging). */
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Ordered list of sanitization rules.
 *
 * Rules are applied sequentially.  More specific patterns (e.g. connection
 * strings that contain paths) come before generic ones to avoid partial
 * matches.
 */
const SANITIZATION_RULES: readonly SanitizationRule[] = [
  // Database / service connection strings — must precede generic path rules.
  {
    name: 'connection-string',
    pattern: /\b(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|rediss):\/\/[^\s'"`,;)}\]]+/gi,
    replacement: '[CONNECTION_STRING]',
  },
  // SDK keys  (sdk_...)
  {
    name: 'sdk-key',
    pattern: /\bsdk_[A-Za-z0-9_\-]+/g,
    replacement: 'sdk_[REDACTED]',
  },
  // Server keys  (srv_...)
  {
    name: 'server-key',
    pattern: /\bsrv_[A-Za-z0-9_\-]+/g,
    replacement: 'srv_[REDACTED]',
  },
  // CLI keys  (cli_...)
  {
    name: 'cli-key',
    pattern: /\bcli_[A-Za-z0-9_\-]+/g,
    replacement: 'cli_[REDACTED]',
  },
  // Email addresses
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },
  // IPv4 addresses
  {
    name: 'ipv4',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[IP]',
  },
  // Windows paths  (C:\foo\bar)
  {
    name: 'windows-path',
    pattern: /\b[A-Z]:\\(?:[^\s\\'"`,;)}\]]+\\)*[^\s\\'"`,;)}\]]*/gi,
    replacement: '[PATH]',
  },
  // Unix paths  (/foo/bar/baz) — at least two segments to avoid false positives
  {
    name: 'unix-path',
    pattern: /(?:\/[A-Za-z0-9._\-]+){2,}(?:\/[A-Za-z0-9._\-]*)*/g,
    replacement: '[PATH]',
  },
];

/**
 * Sanitizes `message` by applying every rule whose pattern matches.
 *
 * When `config.enabled` is `false` the original message is returned as-is.
 */
export function sanitizeErrorMessage(
  message: string,
  config: ErrorSanitizationConfig = getDefaultSanitizationConfig(),
): string {
  if (!config.enabled) {
    return message;
  }

  let sanitized = message;

  for (const rule of SANITIZATION_RULES) {
    sanitized = sanitized.replace(rule.pattern, rule.replacement);
  }

  return sanitized;
}

// ---------------------------------------------------------------------------
// Module-level default configuration
// ---------------------------------------------------------------------------

let _defaultConfig: ErrorSanitizationConfig = {
  enabled: true,
  preserveOriginal: false,
};

/**
 * Returns a shallow copy of the current default sanitization configuration.
 */
export function getDefaultSanitizationConfig(): ErrorSanitizationConfig {
  return { ..._defaultConfig };
}

/**
 * Replaces the default sanitization configuration.
 *
 * This affects all future calls to {@link sanitizeErrorMessage} that do not
 * supply an explicit config argument.
 */
export function setDefaultSanitizationConfig(config: ErrorSanitizationConfig): void {
  _defaultConfig = { ...config };
}
