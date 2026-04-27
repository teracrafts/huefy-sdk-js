import type { SingleRecipient } from '../types/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_TEMPLATE_KEY_LENGTH = 100;
const MAX_BULK_RECIPIENTS = 1000;
const VALID_RECIPIENT_TYPES = new Set(['to', 'cc', 'bcc']);

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return 'Recipient email is required';
  }
  const trimmed = email.trim();
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return `Email exceeds maximum length of ${MAX_EMAIL_LENGTH} characters`;
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return `Invalid email address: ${trimmed}`;
  }
  return null;
}

export function validateTemplateKey(templateKey: string): string | null {
  if (!templateKey || typeof templateKey !== 'string') {
    return 'Template key is required';
  }
  const trimmed = templateKey.trim();
  if (trimmed.length === 0) {
    return 'Template key cannot be empty';
  }
  if (trimmed.length > MAX_TEMPLATE_KEY_LENGTH) {
    return `Template key exceeds maximum length of ${MAX_TEMPLATE_KEY_LENGTH} characters`;
  }
  return null;
}

export function validateEmailData(data: Record<string, unknown>): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Template data must be a non-null object';
  }
  return null;
}

export function validateBulkCount(count: number): string | null {
  if (count <= 0) {
    return 'At least one recipient is required';
  }
  if (count > MAX_BULK_RECIPIENTS) {
    return `Maximum of ${MAX_BULK_RECIPIENTS} recipients per bulk request`;
  }
  return null;
}

export function validateRecipient(recipient: SingleRecipient): string | null {
  if (typeof recipient === 'string') {
    return validateEmail(recipient);
  }

  if (!recipient || typeof recipient !== 'object' || Array.isArray(recipient)) {
    return 'Recipient must be an email string or recipient object';
  }

  const emailError = validateEmail(recipient.email);
  if (emailError) {
    return emailError;
  }

  const normalizedType = typeof recipient.type === 'string' ? recipient.type.trim().toLowerCase() : recipient.type;
  if (
    normalizedType !== undefined &&
    (typeof normalizedType !== 'string' || !VALID_RECIPIENT_TYPES.has(normalizedType))
  ) {
    return 'Recipient type must be one of: to, cc, bcc';
  }

  if (
    recipient.data !== undefined &&
    (!recipient.data || typeof recipient.data !== 'object' || Array.isArray(recipient.data))
  ) {
    return 'Recipient data must be an object when provided';
  }

  return null;
}

export function validateSendEmailInput(
  templateKey: string,
  data: Record<string, unknown>,
  recipient: SingleRecipient,
): string[] {
  const errors: string[] = [];
  const keyError = validateTemplateKey(templateKey);
  if (keyError) errors.push(keyError);
  const dataError = validateEmailData(data);
  if (dataError) errors.push(dataError);
  const emailError = validateRecipient(recipient);
  if (emailError) errors.push(emailError);
  return errors;
}
